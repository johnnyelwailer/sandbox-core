import { SandboxError } from "@sandbox-core/core";
import type {
  CreateSandboxRequest,
  Sandbox,
  SandboxBackend,
  SandboxContext,
  SandboxLookup
} from "@sandbox-core/core";

export interface AzureBackendOptions {
  environmentName?: string;
  region?: string;
  resourceGroup?: string;
}

export class AzureBackend implements SandboxBackend {
  readonly advertisedCapabilities = ["artifacts", "browser", "durability", "ports"] as const;
  readonly displayName = "Azure";
  readonly id = "azure";

  constructor(readonly options: AzureBackendOptions = {}) {}

  async create(_request: CreateSandboxRequest, _context: SandboxContext = {}): Promise<Sandbox> {
    throw SandboxError.notImplemented(
      "Azure backend execution is not implemented yet.",
      { backend: this.id }
    );
  }

  async get(_lookup: SandboxLookup, _context: SandboxContext = {}): Promise<Sandbox | null> {
    throw SandboxError.notImplemented(
      "Azure backend lookup is not implemented yet.",
      { backend: this.id }
    );
  }
}

export function createAzureBackend(options: AzureBackendOptions = {}): AzureBackend {
  return new AzureBackend(options);
}
