import { randomUUID } from "node:crypto";

import { SandboxError } from "@sandbox-core/core";
import type {
  CreateSandboxRequest,
  DownloadRequest,
  DurabilityCapability,
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

interface MemorySandboxRecord {
  capabilities: SandboxCapabilityDescriptor[];
  createdAt: string;
  files: Map<string, Uint8Array>;
  id: string;
  labels?: Record<string, string>;
  metadata?: CreateSandboxRequest["metadata"];
  status: SandboxStatus;
  updatedAt?: string;
}

export interface MemoryBackendOptions {
  id?: string;
}

function durabilitySnapshot(): ReturnType<DurabilityCapability["inspectDurability"]> extends Promise<
  infer Result
>
  ? Result
  : never {
  return {
    browserState: false,
    filesystemState: true,
    processState: false,
    reconnectable: true
  };
}

class MemorySandbox implements Sandbox {
  readonly backend: string;
  readonly capabilities: SandboxCapabilityDescriptor[];
  readonly id: string;

  constructor(private readonly record: MemorySandboxRecord, backend: string) {
    this.backend = backend;
    this.capabilities = record.capabilities;
    this.id = record.id;
  }

  async download(request: DownloadRequest): Promise<Uint8Array> {
    const content = this.record.files.get(request.sourcePath);
    if (content === undefined) {
      throw new SandboxError({
        code: "file_transfer_failed",
        message: `File '${request.sourcePath}' does not exist in sandbox '${this.id}'.`,
        details: {
          path: request.sourcePath,
          sandboxId: this.id
        }
      });
    }

    return content;
  }

  async *exec(request: ExecRequest) {
    this.record.status = "running";
    this.record.updatedAt = new Date().toISOString();

    yield {
      at: new Date().toISOString(),
      status: this.record.status,
      type: "status" as const
    };

    const renderedCommand = [request.command, ...(request.args ?? [])].join(" ").trim();

    yield {
      at: new Date().toISOString(),
      data: renderedCommand.length > 0 ? renderedCommand : request.command,
      type: "stdout" as const
    };

    this.record.status = "ready";
    this.record.updatedAt = new Date().toISOString();

    yield {
      at: new Date().toISOString(),
      exitCode: 0,
      type: "exit" as const
    };
  }

  async getCapability<Name extends keyof SandboxCapabilityMap>(
    name: Name
  ): Promise<SandboxCapabilityMap[Name] | null> {
    if (name !== "durability") {
      return null;
    }

    return {
      inspectDurability: async () => durabilitySnapshot()
    } as SandboxCapabilityMap[Name];
  }

  async inspect(): Promise<SandboxInfo> {
    return {
      backend: this.backend,
      capabilities: this.capabilities,
      createdAt: this.record.createdAt,
      durability: durabilitySnapshot(),
      id: this.id,
      labels: this.record.labels,
      metadata: this.record.metadata,
      status: this.record.status,
      updatedAt: this.record.updatedAt
    };
  }

  async terminate(): Promise<void> {
    this.record.status = "terminated";
    this.record.updatedAt = new Date().toISOString();
  }

  async upload(request: UploadRequest): Promise<void> {
    const content =
      typeof request.content === "string"
        ? new TextEncoder().encode(request.content)
        : request.content;

    this.record.files.set(request.destinationPath, content);
    this.record.updatedAt = new Date().toISOString();
  }
}

export class MemoryBackend implements SandboxBackend {
  readonly advertisedCapabilities = ["durability"] as const;
  readonly displayName = "Memory";
  readonly id: string;
  private readonly sandboxes = new Map<string, MemorySandboxRecord>();

  constructor(options: MemoryBackendOptions = {}) {
    this.id = options.id ?? "memory";
  }

  async create(request: CreateSandboxRequest, context: SandboxContext = {}): Promise<Sandbox> {
    await this.ensureSecretsResolved(request, context);

    const createdAt = new Date().toISOString();
    const id = `${this.id}:${randomUUID()}`;

    const record: MemorySandboxRecord = {
      capabilities: [{ name: "durability" }],
      createdAt,
      files: new Map<string, Uint8Array>(),
      id,
      labels: request.labels,
      metadata: request.metadata,
      status: "ready",
      updatedAt: createdAt
    };

    this.sandboxes.set(id, record);
    return new MemorySandbox(record, this.id);
  }

  async get(lookup: SandboxLookup, _context: SandboxContext = {}): Promise<Sandbox | null> {
    const record = this.sandboxes.get(lookup.id);
    if (record === undefined) {
      return null;
    }

    return new MemorySandbox(record, this.id);
  }

  private async ensureSecretsResolved(
    request: CreateSandboxRequest,
    context: SandboxContext
  ): Promise<void> {
    if (request.secrets === undefined || request.secrets.length === 0) {
      return;
    }

    if (context.resolveSecret === undefined) {
      throw new SandboxError({
        code: "secret_resolution_failed",
        message: "Secret references were provided, but no resolveSecret context was provided."
      });
    }

    for (const secretRef of request.secrets) {
      await this.resolveSecretRef(secretRef, context);
    }
  }

  private async resolveSecretRef(secretRef: SecretRef, context: SandboxContext): Promise<void> {
    const resolvedSecret = await context.resolveSecret?.(secretRef);
    if (resolvedSecret === null || resolvedSecret === undefined) {
      throw new SandboxError({
        code: "secret_resolution_failed",
        message: `Unable to resolve secret '${secretRef.name}'.`,
        details: {
          secret: secretRef.name,
          source: secretRef.source ?? null
        }
      });
    }
  }
}

export function createMemoryBackend(options: MemoryBackendOptions = {}): MemoryBackend {
  return new MemoryBackend(options);
}
