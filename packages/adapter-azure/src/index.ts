import { randomUUID } from "node:crypto";
import { basename, dirname } from "node:path";

import { redactSensitiveText, SandboxError } from "@sandbox-core/core";
import type {
  ContainerEnvironmentSpec,
  CreateSandboxRequest,
  DownloadRequest,
  ExecRequest,
  Sandbox,
  SandboxBackend,
  SandboxCapabilityDescriptor,
  SandboxCapabilityMap,
  SandboxContext,
  SandboxInfo,
  SandboxLookup,
  SandboxStatus,
  SecretRef,
  UploadRequest
} from "@sandbox-core/core";

import {
  createAzureCommandRunner,
  type AzureCommandRequest,
  type AzureCommandResult,
  type AzureCommandRunner
} from "./azure-runner";

export type { AzureCommandRequest, AzureCommandResult, AzureCommandRunner } from "./azure-runner";

interface AzureSandboxRecord {
  capabilities: SandboxCapabilityDescriptor[];
  containerName: string;
  createdAt: string;
  id: string;
  labels?: Record<string, string>;
  metadata?: CreateSandboxRequest["metadata"];
  resourceGroup: string;
  status: SandboxStatus;
  updatedAt?: string;
}

export interface AzureBackendOptions {
  azBinary?: string;
  containerNamePrefix?: string;
  cpu?: number;
  defaultContainerCommand?: string[];
  defaultImage?: string;
  idGenerator?: () => string;
  memoryInGb?: number;
  region?: string;
  resourceGroup?: string;
  runner?: AzureCommandRunner;
  templates?: Record<
    string,
    {
      env?: Record<string, string>;
      image: string;
      workingDirectory?: string;
    }
  >;
}

interface ParsedExecResult {
  exitCode: number;
  stderr: string;
  stdout: string;
  timedOut: boolean;
}

const EXIT_SENTINEL = "__SC_EXIT_CODE__=";

export class AzureBackend implements SandboxBackend {
  readonly advertisedCapabilities = ["durability"] as const;
  readonly displayName = "Azure";
  readonly id = "azure";
  private readonly commandRunner: AzureCommandRunner;
  private readonly defaultImage: string;
  private readonly defaultContainerCommand: string[];
  private readonly containerNamePrefix: string;
  private readonly idGenerator: () => string;
  private readonly defaultResourceGroup?: string;
  private readonly defaultRegion?: string;
  private readonly cpu: number;
  private readonly memoryInGb: number;
  private readonly sandboxes = new Map<string, AzureSandboxRecord>();

  constructor(readonly options: AzureBackendOptions = {}) {
    this.commandRunner = options.runner ?? createAzureCommandRunner(options.azBinary ?? "az");
    this.defaultImage = options.defaultImage ?? "mcr.microsoft.com/azurelinux/base/core:3.0";
    this.defaultContainerCommand = options.defaultContainerCommand ?? ["sh", "-lc", "tail -f /dev/null"];
    this.containerNamePrefix = options.containerNamePrefix ?? "sandbox-core";
    this.idGenerator = options.idGenerator ?? (() => randomUUID().replaceAll("-", ""));
    this.defaultResourceGroup = options.resourceGroup ?? process.env.AZURE_RESOURCE_GROUP;
    this.defaultRegion = options.region ?? process.env.AZURE_LOCATION;
    this.cpu = options.cpu ?? 1;
    this.memoryInGb = options.memoryInGb ?? 1;
  }

  async create(request: CreateSandboxRequest, context: SandboxContext = {}): Promise<Sandbox> {
    const resourceGroup = this.resolveResourceGroup();
    const region = this.resolveRegion();
    const containerName = this.generateContainerName();
    const sandboxId = this.buildSandboxId(resourceGroup, containerName);
    const createdAt = new Date().toISOString();
    const spec = await this.resolveContainerSpec(request, context);

    const args = [
      "container",
      "create",
      "--resource-group",
      resourceGroup,
      "--name",
      containerName,
      "--image",
      spec.image,
      "--cpu",
      String(this.cpu),
      "--memory",
      String(this.memoryInGb),
      "--os-type",
      "Linux",
      "--restart-policy",
      "Never",
      "--location",
      region,
      "--command-line",
      this.renderCommandLine(this.defaultContainerCommand),
      "--output",
      "json"
    ];

    if (spec.env !== undefined && Object.keys(spec.env).length > 0) {
      args.push("--environment-variables", ...this.toAzEnvArgs(spec.env));
    }

    await this.runAzStrict(
      { args },
      "create sandbox",
      "execution_failed",
      spec.secretValues
    );

    const record: AzureSandboxRecord = {
      capabilities: [{ name: "durability" }],
      containerName,
      createdAt,
      id: sandboxId,
      labels: request.labels,
      metadata: request.metadata,
      resourceGroup,
      status: "ready",
      updatedAt: createdAt
    };

    this.sandboxes.set(sandboxId, record);
    return this.asSandbox(record);
  }

  async get(lookup: SandboxLookup, _context: SandboxContext = {}): Promise<Sandbox | null> {
    const known = this.sandboxes.get(lookup.id);
    if (known !== undefined) {
      return this.asSandbox(known);
    }

    const parsed = this.parseSandboxId(lookup.id);
    if (parsed === null) {
      return null;
    }

    const show = await this.runAz({
      args: [
        "container",
        "show",
        "--resource-group",
        parsed.resourceGroup,
        "--name",
        parsed.containerName,
        "--output",
        "json"
      ]
    });

    if (show.exitCode !== 0) {
      return null;
    }

    const now = new Date().toISOString();
    const record: AzureSandboxRecord = {
      capabilities: [{ name: "durability" }],
      containerName: parsed.containerName,
      createdAt: now,
      id: lookup.id,
      resourceGroup: parsed.resourceGroup,
      status: "ready",
      updatedAt: now
    };
    this.sandboxes.set(lookup.id, record);
    return this.asSandbox(record);
  }

  private asSandbox(record: AzureSandboxRecord): Sandbox {
    return {
      backend: this.id,
      capabilities: record.capabilities,
      id: record.id,
      download: async (request: DownloadRequest): Promise<Uint8Array> =>
        this.downloadFile(record, request),
      exec: (request: ExecRequest) => this.execInContainer(record, request),
      getCapability: async <Name extends keyof SandboxCapabilityMap>(
        name: Name
      ): Promise<SandboxCapabilityMap[Name] | null> => {
        if (name !== "durability") {
          return null;
        }

        return {
          inspectDurability: async () => ({
            browserState: false,
            filesystemState: true,
            processState: false,
            reconnectable: true
          })
        } as SandboxCapabilityMap[Name];
      },
      inspect: async (): Promise<SandboxInfo> => this.inspectRecord(record),
      terminate: async (): Promise<void> => this.terminateRecord(record),
      upload: async (request: UploadRequest): Promise<void> => this.uploadFile(record, request)
    };
  }

  private async *execInContainer(record: AzureSandboxRecord, request: ExecRequest) {
    if (record.status === "terminated") {
      yield {
        at: new Date().toISOString(),
        code: "execution_failed",
        message: `Sandbox '${record.id}' is terminated.`,
        type: "error" as const
      };
      return;
    }

    record.status = "running";
    record.updatedAt = new Date().toISOString();

    yield {
      at: new Date().toISOString(),
      status: "running" as const,
      type: "status" as const
    };

    const commandScript = this.renderShellScript(request.command, request.args ?? [], {
      cwd: request.cwd,
      env: request.env
    });

    let result: ParsedExecResult;
    try {
      result = await this.runShell(record, commandScript, request.timeoutMs);
    } catch (error) {
      const mapped = this.mapUnhandledError("execution_failed", "run command in sandbox", error);
      record.status = "failed";
      record.updatedAt = new Date().toISOString();
      yield {
        at: new Date().toISOString(),
        code: mapped.code,
        message: mapped.message,
        type: "error" as const
      };
      return;
    }

    if (result.stdout.length > 0) {
      yield {
        at: new Date().toISOString(),
        data: result.stdout,
        type: "stdout" as const
      };
    }
    if (result.stderr.length > 0) {
      yield {
        at: new Date().toISOString(),
        data: result.stderr,
        type: "stderr" as const
      };
    }
    if (result.timedOut) {
      yield {
        at: new Date().toISOString(),
        code: "timeout",
        message: `Command timed out after ${request.timeoutMs ?? 0}ms.`,
        type: "error" as const
      };
    }

    yield {
      at: new Date().toISOString(),
      exitCode: result.exitCode,
      type: "exit" as const
    };

    record.status = "ready";
    record.updatedAt = new Date().toISOString();
  }

  private async uploadFile(record: AzureSandboxRecord, request: UploadRequest): Promise<void> {
    const content =
      typeof request.content === "string"
        ? new TextEncoder().encode(request.content)
        : request.content;
    const encoded = Buffer.from(content).toString("base64");

    const scriptLines: string[] = [];
    if (request.makeParents) {
      scriptLines.push(`mkdir -p ${this.shellQuote(dirname(request.destinationPath))}`);
    }
    scriptLines.push(
      `printf %s ${this.shellQuote(encoded)} | base64 -d > ${this.shellQuote(request.destinationPath)}`
    );
    if (request.mode !== undefined) {
      scriptLines.push(`chmod ${this.shellQuote(request.mode)} ${this.shellQuote(request.destinationPath)}`);
    }

    const shellScript = this.renderShellScript("sh", ["-lc", scriptLines.join(" && ")], {});
    const result = await this.runShell(record, shellScript);

    if (result.timedOut) {
      throw new SandboxError({
        code: "timeout",
        message: "Timed out while uploading file to Azure sandbox."
      });
    }
    if (result.exitCode !== 0) {
      throw new SandboxError({
        code: "file_transfer_failed",
        message: "Failed to upload file to Azure sandbox.",
        details: {
          stderr: result.stderr,
          stdout: result.stdout
        }
      });
    }
  }

  private async downloadFile(
    record: AzureSandboxRecord,
    request: DownloadRequest
  ): Promise<Uint8Array> {
    const script = this.renderShellScript("sh", ["-lc", `base64 < ${this.shellQuote(request.sourcePath)}`], {});
    const result = await this.runShell(record, script);

    if (result.timedOut) {
      throw new SandboxError({
        code: "timeout",
        message: "Timed out while downloading file from Azure sandbox."
      });
    }
    if (result.exitCode !== 0) {
      throw new SandboxError({
        code: "file_transfer_failed",
        message: "Failed to download file from Azure sandbox.",
        details: {
          stderr: result.stderr,
          stdout: result.stdout
        }
      });
    }

    const trimmed = result.stdout.trim();
    try {
      return Buffer.from(trimmed, "base64");
    } catch (error) {
      throw new SandboxError({
        code: "file_transfer_failed",
        message: "Azure sandbox returned invalid base64 output during download.",
        details: {
          outputPreview: trimmed.slice(0, 120)
        },
        cause: error
      });
    }
  }

  private async terminateRecord(record: AzureSandboxRecord): Promise<void> {
    record.status = "terminating";
    record.updatedAt = new Date().toISOString();

    const result = await this.runAz({
      args: [
        "container",
        "delete",
        "--resource-group",
        record.resourceGroup,
        "--name",
        record.containerName,
        "--yes"
      ]
    });

    if (result.exitCode !== 0 && !this.isMissingContainerError(result.stderr)) {
      throw this.mapAzFailure("execution_failed", "terminate sandbox", result);
    }

    record.status = "terminated";
    record.updatedAt = new Date().toISOString();
  }

  private async inspectRecord(record: AzureSandboxRecord): Promise<SandboxInfo> {
    if (record.status !== "terminated") {
      const result = await this.runAz({
        args: [
          "container",
          "show",
          "--resource-group",
          record.resourceGroup,
          "--name",
          record.containerName,
          "--output",
          "json"
        ]
      });

      if (result.exitCode !== 0) {
        record.status = this.isMissingContainerError(result.stderr) ? "terminated" : "failed";
      } else {
        try {
          const parsed = JSON.parse(result.stdout) as {
            createdTime?: string;
            instanceView?: { state?: string };
            provisioningState?: string;
          };

          const rawState = parsed.instanceView?.state ?? parsed.provisioningState ?? "";
          const lowered = rawState.toLowerCase();
          if (lowered.includes("running")) {
            record.status = "ready";
          } else if (lowered.includes("succeeded")) {
            record.status = "ready";
          } else if (lowered.includes("terminated") || lowered.includes("failed")) {
            record.status = "failed";
          }

          if (parsed.createdTime !== undefined) {
            record.createdAt = parsed.createdTime;
          }
        } catch {
          record.status = "failed";
        }
      }

      record.updatedAt = new Date().toISOString();
    }

    return {
      backend: this.id,
      capabilities: record.capabilities,
      createdAt: record.createdAt,
      durability: {
        browserState: false,
        filesystemState: true,
        processState: false,
        reconnectable: true
      },
      id: record.id,
      labels: record.labels,
      metadata: record.metadata,
      status: record.status,
      updatedAt: record.updatedAt
    };
  }

  private async resolveContainerSpec(
    request: CreateSandboxRequest,
    context: SandboxContext
  ): Promise<{
    env: Record<string, string>;
    image: string;
    secretValues: string[];
    workingDirectory?: string;
  }> {
    let resolved: {
      env: Record<string, string>;
      image: string;
      secretValues: string[];
      workingDirectory?: string;
    };

    if (request.environment.kind === "container") {
      const environment = request.environment as ContainerEnvironmentSpec;
      resolved = {
        env: { ...(environment.env ?? {}) },
        image: environment.image || this.defaultImage,
        secretValues: [],
        workingDirectory: environment.workingDirectory
      };
    } else {
      const template = this.options.templates?.[request.environment.template];
      if (template === undefined) {
        throw new SandboxError({
          code: "invalid_request",
          message: `Template '${request.environment.template}' is not configured for azure backend.`
        });
      }

      resolved = {
        env: { ...(template.env ?? {}) },
        image: template.image,
        secretValues: [],
        workingDirectory: template.workingDirectory
      };
    }

    if (request.secrets !== undefined && request.secrets.length > 0) {
      if (context.resolveSecret === undefined) {
        throw new SandboxError({
          code: "secret_resolution_failed",
          message: "Secret references were provided, but no resolveSecret context was provided."
        });
      }

      for (const secretRef of request.secrets) {
        const envPair = await this.resolveSecretRef(secretRef, context);
        resolved.env[envPair.name] = envPair.value;
        resolved.secretValues.push(envPair.value);
      }
    }

    return resolved;
  }

  private async resolveSecretRef(
    secretRef: SecretRef,
    context: SandboxContext
  ): Promise<{ name: string; value: string }> {
    const resolved = await context.resolveSecret?.(secretRef);
    if (resolved === null || resolved === undefined) {
      throw new SandboxError({
        code: "secret_resolution_failed",
        message: `Unable to resolve secret '${secretRef.name}'.`,
        details: {
          secret: secretRef.name,
          source: secretRef.source ?? null
        }
      });
    }

    return {
      name: resolved.name || secretRef.name,
      value: resolved.value
    };
  }

  private resolveResourceGroup(): string {
    if (this.defaultResourceGroup === undefined || this.defaultResourceGroup.length === 0) {
      throw new SandboxError({
        code: "invalid_request",
        message:
          "Azure resource group is not configured. Set options.resourceGroup or AZURE_RESOURCE_GROUP."
      });
    }

    return this.defaultResourceGroup;
  }

  private resolveRegion(): string {
    return this.defaultRegion ?? "westeurope";
  }

  private generateContainerName(): string {
    return `${this.containerNamePrefix}-${this.idGenerator()}`;
  }

  private buildSandboxId(resourceGroup: string, containerName: string): string {
    return `${this.id}:${resourceGroup}:${containerName}`;
  }

  private parseSandboxId(id: string): { containerName: string; resourceGroup: string } | null {
    const prefix = `${this.id}:`;
    if (!id.startsWith(prefix)) {
      return null;
    }
    const rest = id.slice(prefix.length);
    const parts = rest.split(":");
    if (parts.length !== 2) {
      return null;
    }

    return {
      resourceGroup: parts[0]!,
      containerName: parts[1]!
    };
  }

  private toAzEnvArgs(env: Record<string, string>): string[] {
    return Object.entries(env).map(([key, value]) => `${key}=${value}`);
  }

  private renderCommandLine(tokens: string[]): string {
    return tokens.map((token) => this.shellQuote(token)).join(" ");
  }

  private renderShellScript(
    command: string,
    args: string[],
    options: {
      cwd?: string;
      env?: Record<string, string>;
    }
  ): string {
    const lines: string[] = [];

    if (options.env !== undefined) {
      for (const [key, value] of Object.entries(options.env)) {
        this.assertValidEnvKey(key);
        lines.push(`export ${key}=${this.shellQuote(value)}`);
      }
    }
    if (options.cwd !== undefined) {
      lines.push(`cd ${this.shellQuote(options.cwd)}`);
    }

    lines.push(
      [command, ...args].map((token) => this.shellQuote(token)).join(" ")
    );
    lines.push("__sc_exit_code=$?");
    lines.push(`printf "\\n${EXIT_SENTINEL}%s\\n" "$__sc_exit_code"`);
    lines.push('exit "$__sc_exit_code"');

    return lines.join("\n");
  }

  private shellQuote(value: string): string {
    return `'${value.replace(/'/g, `'\"'\"'`)}'`;
  }

  private assertValidEnvKey(key: string): void {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new SandboxError({
        code: "invalid_request",
        message: `Invalid environment variable key '${key}'.`
      });
    }
  }

  private async runShell(
    record: AzureSandboxRecord,
    shellScript: string,
    timeoutMs?: number
  ): Promise<ParsedExecResult> {
    const execCommand = this.wrapScriptForExec(shellScript);
    const result = await this.runAz({
      args: [
        "container",
        "exec",
        "--resource-group",
        record.resourceGroup,
        "--name",
        record.containerName,
        "--exec-command",
        execCommand
      ],
      timeoutMs
    });

    return this.parseExecResult(result);
  }

  private wrapScriptForExec(shellScript: string): string {
    const encoded = Buffer.from(shellScript, "utf8").toString("base64");
    return `sh -c printf\${IFS}%s\${IFS}${encoded}|base64\${IFS}-d|sh`;
  }

  private parseExecResult(result: AzureCommandResult): ParsedExecResult {
    const combined = `${result.stdout}\n${result.stderr}`;
    const sentinelRegex = new RegExp(`${EXIT_SENTINEL}(\\d+)`);
    const match = combined.match(sentinelRegex);
    const sentinelExitCode = match === null ? null : Number(match[1]);

    const stripSentinel = (value: string): string =>
      value
        .split("\n")
        .filter((line) => !line.includes(EXIT_SENTINEL))
        .join("\n")
        .trim();

    return {
      exitCode: sentinelExitCode ?? result.exitCode,
      stderr: stripSentinel(result.stderr),
      stdout: stripSentinel(result.stdout),
      timedOut: result.timedOut
    };
  }

  private async runAz(request: AzureCommandRequest): Promise<AzureCommandResult> {
    try {
      return await this.commandRunner(request);
    } catch (error) {
      throw this.mapUnhandledError("backend_unavailable", "execute az command", error);
    }
  }

  private async runAzStrict(
    request: AzureCommandRequest,
    operation: string,
    failureCode: "execution_failed" | "file_transfer_failed",
    knownSecrets: readonly string[] = []
  ): Promise<AzureCommandResult> {
    const result = await this.runAz(request);
    if (result.timedOut) {
      throw new SandboxError({
        code: "timeout",
        message: `Azure command timed out during '${operation}'.`,
        details: {
          operation
        }
      });
    }
    if (result.exitCode !== 0) {
      throw this.mapAzFailure(failureCode, operation, result, knownSecrets);
    }

    return result;
  }

  private mapAzFailure(
    defaultCode: "execution_failed" | "file_transfer_failed",
    operation: string,
    result: AzureCommandResult,
    knownSecrets: readonly string[] = []
  ): SandboxError {
    const lowered = `${result.stderr}\n${result.stdout}`.toLowerCase();
    const code =
      lowered.includes("az login") ||
      lowered.includes("not logged in") ||
      lowered.includes("could not be found") ||
      lowered.includes("was not found") ||
      lowered.includes("not recognized")
        ? "backend_unavailable"
        : defaultCode;

    return new SandboxError({
      code,
      message: `Failed to ${operation}.`,
      details: {
        exitCode: result.exitCode,
        stderr: redactSensitiveText(result.stderr, knownSecrets),
        stdout: redactSensitiveText(result.stdout, knownSecrets)
      }
    });
  }

  private mapUnhandledError(
    code: "backend_unavailable" | "execution_failed" | "file_transfer_failed",
    operation: string,
    error: unknown
  ): SandboxError {
    if (error instanceof SandboxError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);
    const lowered = message.toLowerCase();
    const mappedCode =
      lowered.includes("enoent") || lowered.includes("not found")
        ? "backend_unavailable"
        : code;

    return new SandboxError({
      code: mappedCode,
      message: `Failed to ${operation}.`,
      details: {
        error: redactSensitiveText(message)
      },
      cause: error
    });
  }

  private isMissingContainerError(output: string): boolean {
    const lowered = output.toLowerCase();
    return lowered.includes("was not found") || lowered.includes("could not be found");
  }
}

export function createAzureBackend(options: AzureBackendOptions = {}): AzureBackend {
  return new AzureBackend(options);
}

export function parseAzureSandboxId(
  id: string
): { containerName: string; resourceGroup: string } | null {
  if (!id.startsWith("azure:")) {
    return null;
  }
  const rest = id.slice("azure:".length);
  const parts = rest.split(":");
  if (parts.length !== 2) {
    return null;
  }

  return {
    resourceGroup: parts[0] ?? "",
    containerName: parts[1] ?? basename(rest)
  };
}
