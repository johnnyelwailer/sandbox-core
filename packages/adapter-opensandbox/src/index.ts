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
  createOpenSandboxFetchTransport,
  type OpenSandboxRequest,
  type OpenSandboxResponse,
  type OpenSandboxTransport
} from "./transport";

export type { OpenSandboxRequest, OpenSandboxResponse, OpenSandboxTransport } from "./transport";

interface OpenSandboxRecord {
  capabilities: SandboxCapabilityDescriptor[];
  createdAt: string;
  id: string;
  labels?: Record<string, string>;
  metadata?: CreateSandboxRequest["metadata"];
  status: SandboxStatus;
  updatedAt?: string;
}

export interface OpenSandboxBackendOptions {
  apiBaseUrl?: string;
  apiKey?: string;
  namespace?: string;
  templates?: Record<
    string,
    {
      env?: Record<string, string>;
      image: string;
      workingDirectory?: string;
    }
  >;
  transport?: OpenSandboxTransport;
}

export class OpenSandboxBackend implements SandboxBackend {
  readonly advertisedCapabilities = ["durability"] as const;
  readonly displayName = "OpenSandbox";
  readonly id = "opensandbox";

  private readonly transport: OpenSandboxTransport;
  private readonly namespace?: string;
  private readonly records = new Map<string, OpenSandboxRecord>();

  constructor(readonly options: OpenSandboxBackendOptions = {}) {
    const apiBaseUrl = options.apiBaseUrl ?? process.env.OPENSANDBOX_BASE_URL;
    if (options.transport !== undefined) {
      this.transport = options.transport;
    } else if (apiBaseUrl !== undefined) {
      this.transport = createOpenSandboxFetchTransport({
        apiBaseUrl,
        apiKey: options.apiKey ?? process.env.OPENSANDBOX_API_KEY
      });
    } else {
      this.transport = async () => ({
        status: 500
      });
    }
    this.namespace = options.namespace ?? process.env.OPENSANDBOX_NAMESPACE;
  }

  async create(request: CreateSandboxRequest, context: SandboxContext = {}): Promise<Sandbox> {
    const spec = await this.resolveContainerSpec(request, context);
    const response = await this.send({
      body: {
        env: spec.env,
        image: spec.image,
        labels: request.labels,
        metadata: request.metadata,
        workingDirectory: spec.workingDirectory
      },
      method: "POST",
      path: "/sandboxes"
    });

    if (response.status < 200 || response.status >= 300) {
      throw this.toError("execution_failed", "create sandbox", response);
    }

    const body = this.asObject(response.body);
    const id = this.readString(body, "id");
    if (id === null) {
      throw new SandboxError({
        code: "execution_failed",
        message: "OpenSandbox create response did not include sandbox id.",
        details: {
          bodyPreview: this.previewBody(response.body)
        }
      });
    }

    const now = new Date().toISOString();
    const record: OpenSandboxRecord = {
      capabilities: [{ name: "durability" }],
      createdAt: this.readString(body, "createdAt") ?? now,
      id,
      labels: request.labels,
      metadata: request.metadata,
      status: this.mapStatus(this.readString(body, "status")),
      updatedAt: now
    };
    this.records.set(id, record);

    return this.asSandbox(record);
  }

  async get(lookup: SandboxLookup, _context: SandboxContext = {}): Promise<Sandbox | null> {
    const known = this.records.get(lookup.id);
    if (known !== undefined) {
      return this.asSandbox(known);
    }

    const response = await this.send({
      method: "GET",
      path: `/sandboxes/${encodeURIComponent(lookup.id)}`
    });
    if (response.status === 404) {
      return null;
    }
    if (response.status < 200 || response.status >= 300) {
      throw this.toError("execution_failed", "get sandbox", response);
    }

    const body = this.asObject(response.body);
    const now = new Date().toISOString();
    const record: OpenSandboxRecord = {
      capabilities: [{ name: "durability" }],
      createdAt: this.readString(body, "createdAt") ?? now,
      id: lookup.id,
      status: this.mapStatus(this.readString(body, "status")),
      updatedAt: this.readString(body, "updatedAt") ?? now
    };
    this.records.set(lookup.id, record);
    return this.asSandbox(record);
  }

  private asSandbox(record: OpenSandboxRecord): Sandbox {
    return {
      backend: this.id,
      capabilities: record.capabilities,
      id: record.id,
      download: async (request: DownloadRequest): Promise<Uint8Array> =>
        this.downloadFile(record, request),
      exec: (request: ExecRequest) => this.execInSandbox(record, request),
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

  private async *execInSandbox(record: OpenSandboxRecord, request: ExecRequest) {
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

    const response = await this.send({
      body: {
        args: request.args ?? [],
        command: request.command,
        cwd: request.cwd,
        env: request.env,
        stdin: request.stdin,
        timeoutMs: request.timeoutMs
      },
      method: "POST",
      path: `/sandboxes/${encodeURIComponent(record.id)}/exec`,
      timeoutMs: request.timeoutMs
    });

    if (response.status < 200 || response.status >= 300) {
      const error = this.toError("execution_failed", "run command in sandbox", response);
      record.status = "failed";
      record.updatedAt = new Date().toISOString();
      yield {
        at: new Date().toISOString(),
        code: error.code,
        message: error.message,
        type: "error" as const
      };
      return;
    }

    const body = this.asObject(response.body);
    const stdout = this.readString(body, "stdout");
    const stderr = this.readString(body, "stderr");
    const exitCode = this.readNumber(body, "exitCode") ?? 0;
    const timedOut = this.readBoolean(body, "timedOut") ?? false;

    if (stdout !== null && stdout.length > 0) {
      yield {
        at: new Date().toISOString(),
        data: stdout,
        type: "stdout" as const
      };
    }
    if (stderr !== null && stderr.length > 0) {
      yield {
        at: new Date().toISOString(),
        data: stderr,
        type: "stderr" as const
      };
    }
    if (timedOut) {
      yield {
        at: new Date().toISOString(),
        code: "timeout",
        message: `Command timed out after ${request.timeoutMs ?? 0}ms.`,
        type: "error" as const
      };
    }

    yield {
      at: new Date().toISOString(),
      exitCode,
      type: "exit" as const
    };

    record.status = "ready";
    record.updatedAt = new Date().toISOString();
  }

  private async uploadFile(record: OpenSandboxRecord, request: UploadRequest): Promise<void> {
    const content =
      typeof request.content === "string"
        ? new TextEncoder().encode(request.content)
        : request.content;
    const response = await this.send({
      body: {
        contentBase64: Buffer.from(content).toString("base64"),
        makeParents: request.makeParents ?? false,
        mode: request.mode ?? null
      },
      method: "PUT",
      path: `/sandboxes/${encodeURIComponent(record.id)}/files`,
      query: {
        path: request.destinationPath
      }
    });

    if (response.status < 200 || response.status >= 300) {
      throw this.toError("file_transfer_failed", "upload file to sandbox", response);
    }
  }

  private async downloadFile(
    record: OpenSandboxRecord,
    request: DownloadRequest
  ): Promise<Uint8Array> {
    const response = await this.send({
      method: "GET",
      path: `/sandboxes/${encodeURIComponent(record.id)}/files`,
      query: {
        path: request.sourcePath
      }
    });

    if (response.status < 200 || response.status >= 300) {
      throw this.toError("file_transfer_failed", "download file from sandbox", response);
    }

    if (typeof response.body === "string") {
      return new TextEncoder().encode(response.body);
    }

    const body = this.asObject(response.body);
    const base64 = this.readString(body, "contentBase64");
    if (base64 === null) {
      throw new SandboxError({
        code: "file_transfer_failed",
        message: "OpenSandbox download response did not include contentBase64.",
        details: {
          bodyPreview: this.previewBody(response.body)
        }
      });
    }

    return Buffer.from(base64, "base64");
  }

  private async inspectRecord(record: OpenSandboxRecord): Promise<SandboxInfo> {
    if (record.status !== "terminated") {
      const response = await this.send({
        method: "GET",
        path: `/sandboxes/${encodeURIComponent(record.id)}`
      });

      if (response.status === 404) {
        record.status = "terminated";
      } else if (response.status < 200 || response.status >= 300) {
        record.status = "failed";
      } else {
        const body = this.asObject(response.body);
        record.status = this.mapStatus(this.readString(body, "status"));
        record.updatedAt = this.readString(body, "updatedAt") ?? new Date().toISOString();
      }
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

  private async terminateRecord(record: OpenSandboxRecord): Promise<void> {
    record.status = "terminating";
    record.updatedAt = new Date().toISOString();

    const response = await this.send({
      method: "DELETE",
      path: `/sandboxes/${encodeURIComponent(record.id)}`
    });

    if (response.status >= 200 && response.status < 300) {
      record.status = "terminated";
      record.updatedAt = new Date().toISOString();
      return;
    }

    if (response.status === 404) {
      record.status = "terminated";
      record.updatedAt = new Date().toISOString();
      return;
    }

    throw this.toError("execution_failed", "terminate sandbox", response);
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
        image: environment.image,
        workingDirectory: environment.workingDirectory
      };
    } else {
      const template = this.options.templates?.[request.environment.template];
      if (template === undefined) {
        throw new SandboxError({
          code: "invalid_request",
          message: `Template '${request.environment.template}' is not configured for opensandbox backend.`
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
        const resolvedSecret = await this.resolveSecretRef(secretRef, context);
        resolved.env[resolvedSecret.name] = resolvedSecret.value;
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

  private mapStatus(status: string | null): SandboxStatus {
    const value = (status ?? "").toLowerCase();
    if (value.includes("running")) {
      return "ready";
    }
    if (value.includes("ready")) {
      return "ready";
    }
    if (value.includes("creating") || value.includes("pending")) {
      return "creating";
    }
    if (value.includes("terminat")) {
      return "terminating";
    }
    if (value.includes("deleted") || value.includes("terminated")) {
      return "terminated";
    }
    if (value.includes("fail")) {
      return "failed";
    }

    return "ready";
  }

  private async send(request: OpenSandboxRequest): Promise<OpenSandboxResponse> {
    if (this.options.transport === undefined && this.options.apiBaseUrl === undefined && process.env.OPENSANDBOX_BASE_URL === undefined) {
      throw new SandboxError({
        code: "invalid_request",
        message: "OpenSandbox API base URL is not configured. Set options.apiBaseUrl or OPENSANDBOX_BASE_URL."
      });
    }

    const query = {
      ...(request.query ?? {}),
      ...(this.namespace !== undefined ? { namespace: this.namespace } : {})
    };

    try {
      return await this.transport({
        ...request,
        query
      });
    } catch (error) {
      throw new SandboxError({
        code: "backend_unavailable",
        message: "Failed to communicate with OpenSandbox API.",
        details: {
          error: redactSensitiveText(error instanceof Error ? error.message : String(error))
        },
        cause: error
      });
    }
  }

  private toError(
    code: "execution_failed" | "file_transfer_failed",
    operation: string,
    response: OpenSandboxResponse
  ): SandboxError {
    const payload = this.asObject(response.body);
    const message = redactSensitiveText(
      this.readString(payload, "message") ?? `Failed to ${operation}.`
    );

    return new SandboxError({
      code,
      message,
      details: {
        bodyPreview: this.previewBody(response.body),
        status: response.status
      }
    });
  }

  private previewBody(value: unknown): string {
    if (typeof value === "string") {
      return redactSensitiveText(value).slice(0, 500);
    }

    try {
      return redactSensitiveText(JSON.stringify(value)).slice(0, 500);
    } catch {
      return redactSensitiveText(String(value)).slice(0, 500);
    }
  }

  private asObject(value: unknown): Record<string, unknown> {
    if (value === null || value === undefined || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private readString(record: Record<string, unknown>, key: string): string | null {
    const value = record[key];
    return typeof value === "string" ? value : null;
  }

  private readNumber(record: Record<string, unknown>, key: string): number | null {
    const value = record[key];
    return typeof value === "number" ? value : null;
  }

  private readBoolean(record: Record<string, unknown>, key: string): boolean | null {
    const value = record[key];
    return typeof value === "boolean" ? value : null;
  }
}

export function createOpenSandboxBackend(
  options: OpenSandboxBackendOptions = {}
): OpenSandboxBackend {
  return new OpenSandboxBackend(options);
}
