import { SandboxError } from "@sandbox-core/core";
import type {
  CreateSandboxRequest,
  Sandbox,
  SandboxBackend,
  SandboxContext,
  SandboxLookup
} from "@sandbox-core/core";

export interface OpenSandboxBackendOptions {
  apiBaseUrl?: string;
  namespace?: string;
}

export class OpenSandboxBackend implements SandboxBackend {
  readonly advertisedCapabilities = ["artifacts", "browser", "durability", "ports"] as const;
  readonly displayName = "OpenSandbox";
  readonly id = "opensandbox";

  constructor(readonly options: OpenSandboxBackendOptions = {}) {}

  async create(_request: CreateSandboxRequest, _context: SandboxContext = {}): Promise<Sandbox> {
    throw SandboxError.notImplemented(
      "OpenSandbox backend execution is not implemented yet.",
      { backend: this.id }
    );
  }

  async get(_lookup: SandboxLookup, _context: SandboxContext = {}): Promise<Sandbox | null> {
    throw SandboxError.notImplemented(
      "OpenSandbox backend lookup is not implemented yet.",
      { backend: this.id }
    );
  }
}

export function createOpenSandboxBackend(
  options: OpenSandboxBackendOptions = {}
): OpenSandboxBackend {
  return new OpenSandboxBackend(options);
}
