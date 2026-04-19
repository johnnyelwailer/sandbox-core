import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { SandboxError } from "@sandbox-core/core";
import type {
  CreateSandboxRequest,
  DownloadRequest,
  ExecRequest,
  Sandbox,
  SandboxBackend,
  SandboxCapabilityDescriptor,
  SandboxCapabilityMap,
  SandboxContext,
  SandboxInfo,
  SandboxLookup
} from "@sandbox-core/core";
import type { ContainerEnvironmentSpec, SecretRef, UploadRequest } from "@sandbox-core/core";

import {
  createDockerCommandRunner,
  type DockerCommandRequest,
  type DockerCommandResult,
  type DockerCommandRunner
} from "./docker-runner";

export type { DockerCommandRequest, DockerCommandResult, DockerCommandRunner } from "./docker-runner";

export interface LocalDockerBackendOptions {
  containerNamePrefix?: string;
  defaultContainerCommand?: string[];
  defaultImage?: string;
  dockerBinary?: string;
  idGenerator?: () => string;
  templates?: Record<
    string,
    {
      env?: Record<string, string>;
      image: string;
      workingDirectory?: string;
    }
  >;
  runner?: DockerCommandRunner;
}

interface DockerSandboxRecord {
  capabilities: SandboxCapabilityDescriptor[];
  containerName: string;
  createdAt: string;
  id: string;
  labels?: Record<string, string>;
  metadata?: CreateSandboxRequest["metadata"];
  status: SandboxInfo["status"];
  updatedAt?: string;
}

export class LocalDockerBackend implements SandboxBackend {
  readonly advertisedCapabilities = ["durability"] as const;
  readonly displayName = "Local Docker";
  readonly id = "local-docker";
  private readonly commandRunner: DockerCommandRunner;
  private readonly sandboxes = new Map<string, DockerSandboxRecord>();
  private readonly defaultImage: string;
  private readonly defaultContainerCommand: string[];
  private readonly containerNamePrefix: string;
  private readonly idGenerator: () => string;

  constructor(readonly options: LocalDockerBackendOptions = {}) {
    this.commandRunner =
      options.runner ?? createDockerCommandRunner(options.dockerBinary ?? "docker");
    this.defaultImage = options.defaultImage ?? "alpine:3.20";
    this.defaultContainerCommand = options.defaultContainerCommand ?? ["sh", "-lc", "tail -f /dev/null"];
    this.containerNamePrefix = options.containerNamePrefix ?? "sandbox-core";
    this.idGenerator = options.idGenerator ?? (() => randomUUID().replaceAll("-", ""));
  }

  async create(request: CreateSandboxRequest, context: SandboxContext = {}): Promise<Sandbox> {
    const resolvedSpec = await this.resolveContainerSpec(request, context);
    const containerName = this.generateContainerName();
    const sandboxId = this.buildSandboxId(containerName);
    const createdAt = new Date().toISOString();

    const runArgs = [
      "run",
      "-d",
      "--name",
      containerName,
      "--label",
      `sandbox-core.backend=${this.id}`,
      "--label",
      `sandbox-core.id=${sandboxId}`,
      ...this.toDockerEnvArgs(resolvedSpec.env)
    ];

    if (resolvedSpec.workingDirectory !== undefined) {
      runArgs.push("-w", resolvedSpec.workingDirectory);
    }

    runArgs.push(resolvedSpec.image, ...this.defaultContainerCommand);

    await this.runDockerStrict(
      {
        args: runArgs
      },
      "create sandbox",
      "execution_failed"
    );

    const record: DockerSandboxRecord = {
      capabilities: [{ name: "durability" }],
      containerName,
      createdAt,
      id: sandboxId,
      labels: request.labels,
      metadata: request.metadata,
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

    const containerName = this.parseContainerName(lookup.id);
    if (containerName === null) {
      return null;
    }

    const inspectResult = await this.runDocker({
      args: ["inspect", containerName]
    });

    if (inspectResult.exitCode !== 0) {
      return null;
    }

    const now = new Date().toISOString();
    const record: DockerSandboxRecord = {
      capabilities: [{ name: "durability" }],
      containerName,
      createdAt: now,
      id: lookup.id,
      status: "ready",
      updatedAt: now
    };

    this.sandboxes.set(lookup.id, record);
    return this.asSandbox(record);
  }

  private asSandbox(record: DockerSandboxRecord): Sandbox {
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

  private async *execInContainer(record: DockerSandboxRecord, request: ExecRequest) {
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

    const execArgs = ["exec"];
    if (request.stdin !== undefined) {
      execArgs.push("-i");
    }

    execArgs.push(...this.toDockerEnvArgs(request.env));

    if (request.cwd !== undefined) {
      execArgs.push("-w", request.cwd);
    }

    execArgs.push(record.containerName, request.command, ...(request.args ?? []));

    let result: DockerCommandResult;
    try {
      result = await this.runDocker({
        args: execArgs,
        stdin: request.stdin,
        timeoutMs: request.timeoutMs
      });
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

  private async downloadFile(
    record: DockerSandboxRecord,
    request: DownloadRequest
  ): Promise<Uint8Array> {
    const tempDir = await mkdtemp(join(tmpdir(), "sandbox-core-download-"));
    const outputPath = join(tempDir, "payload");

    try {
      await this.runDockerStrict(
        {
          args: ["cp", `${record.containerName}:${request.sourcePath}`, outputPath]
        },
        "download file from sandbox",
        "file_transfer_failed"
      );

      return await readFile(outputPath);
    } catch (error) {
      if (error instanceof SandboxError) {
        throw error;
      }

      throw this.mapUnhandledError(
        "file_transfer_failed",
        "download file from sandbox",
        error
      );
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  }

  private async uploadFile(record: DockerSandboxRecord, request: UploadRequest): Promise<void> {
    const tempDir = await mkdtemp(join(tmpdir(), "sandbox-core-upload-"));
    const inputPath = join(tempDir, "payload");
    const content =
      typeof request.content === "string"
        ? new TextEncoder().encode(request.content)
        : request.content;

    try {
      await writeFile(inputPath, content);

      if (request.makeParents) {
        await this.runDockerStrict(
          {
            args: ["exec", record.containerName, "mkdir", "-p", dirname(request.destinationPath)]
          },
          "create parent directories in sandbox",
          "file_transfer_failed"
        );
      }

      await this.runDockerStrict(
        {
          args: ["cp", inputPath, `${record.containerName}:${request.destinationPath}`]
        },
        "upload file to sandbox",
        "file_transfer_failed"
      );

      if (request.mode !== undefined) {
        await this.runDockerStrict(
          {
            args: ["exec", record.containerName, "chmod", request.mode, request.destinationPath]
          },
          "set file mode in sandbox",
          "file_transfer_failed"
        );
      }
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  }

  private async terminateRecord(record: DockerSandboxRecord): Promise<void> {
    record.status = "terminating";
    record.updatedAt = new Date().toISOString();

    const result = await this.runDocker({
      args: ["rm", "-f", record.containerName]
    });

    if (result.exitCode !== 0 && !this.isMissingContainerError(result.stderr)) {
      throw this.mapDockerFailure("execution_failed", "terminate sandbox", result);
    }

    record.status = "terminated";
    record.updatedAt = new Date().toISOString();
  }

  private async inspectRecord(record: DockerSandboxRecord): Promise<SandboxInfo> {
    if (record.status !== "terminated") {
      const result = await this.runDocker({
        args: ["inspect", "-f", "{{.State.Status}}", record.containerName]
      });

      if (result.exitCode !== 0) {
        if (this.isMissingContainerError(result.stderr)) {
          record.status = "terminated";
        } else {
          record.status = "failed";
        }
      } else {
        const containerStatus = result.stdout.trim();
        if (containerStatus === "running") {
          record.status = "ready";
        } else if (containerStatus === "exited" || containerStatus === "dead") {
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
    workingDirectory?: string;
  }> {
    let resolved: {
      env: Record<string, string>;
      image: string;
      workingDirectory?: string;
    };

    if (request.environment.kind === "container") {
      const environment = request.environment as ContainerEnvironmentSpec;
      resolved = {
        env: { ...(environment.env ?? {}) },
        image: environment.image || this.defaultImage,
        workingDirectory: environment.workingDirectory
      };
    } else {
      const template = this.options.templates?.[request.environment.template];
      if (template === undefined) {
        throw new SandboxError({
          code: "invalid_request",
          message: `Template '${request.environment.template}' is not configured for local-docker backend.`
        });
      }

      resolved = {
        env: { ...(template.env ?? {}) },
        image: template.image,
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

  private toDockerEnvArgs(env: Record<string, string> | undefined): string[] {
    if (env === undefined) {
      return [];
    }

    const args: string[] = [];
    for (const [key, value] of Object.entries(env)) {
      args.push("-e", `${key}=${value}`);
    }

    return args;
  }

  private generateContainerName(): string {
    return `${this.containerNamePrefix}-${this.idGenerator()}`;
  }

  private buildSandboxId(containerName: string): string {
    return `${this.id}:${containerName}`;
  }

  private parseContainerName(sandboxId: string): string | null {
    const prefix = `${this.id}:`;
    if (!sandboxId.startsWith(prefix)) {
      return null;
    }
    return sandboxId.slice(prefix.length);
  }

  private async runDocker(request: DockerCommandRequest): Promise<DockerCommandResult> {
    try {
      return await this.commandRunner(request);
    } catch (error) {
      throw this.mapUnhandledError("backend_unavailable", "execute docker command", error);
    }
  }

  private async runDockerStrict(
    request: DockerCommandRequest,
    operation: string,
    failureCode: "execution_failed" | "file_transfer_failed"
  ): Promise<DockerCommandResult> {
    const result = await this.runDocker(request);
    if (result.timedOut) {
      throw new SandboxError({
        code: "timeout",
        message: `Docker command timed out during '${operation}'.`,
        details: {
          operation
        }
      });
    }

    if (result.exitCode !== 0) {
      throw this.mapDockerFailure(failureCode, operation, result);
    }

    return result;
  }

  private mapDockerFailure(
    defaultCode: "execution_failed" | "file_transfer_failed",
    operation: string,
    result: DockerCommandResult
  ): SandboxError {
    if (result.timedOut) {
      return new SandboxError({
        code: "timeout",
        message: `Docker command timed out during '${operation}'.`,
        details: {
          operation
        }
      });
    }

    const stderr = result.stderr.toLowerCase();
    const code =
      stderr.includes("cannot connect to the docker daemon") ||
      stderr.includes("is the docker daemon running")
        ? "backend_unavailable"
        : defaultCode;

    return new SandboxError({
      code,
      message: `Failed to ${operation}.`,
      details: {
        exitCode: result.exitCode,
        stderr: result.stderr,
        stdout: result.stdout
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
        error: message
      },
      cause: error
    });
  }

  private isMissingContainerError(stderr: string): boolean {
    return stderr.toLowerCase().includes("no such container");
  }
}

export function createLocalDockerBackend(
  options: LocalDockerBackendOptions = {}
): LocalDockerBackend {
  return new LocalDockerBackend(options);
}
