import { SandboxRegistry } from "@sandbox-core/core";
import type {
  BackendSelector,
  CreateSandboxRequest,
  Sandbox,
  SandboxBackend,
  SandboxContext,
  SandboxLookup,
  SandboxRegistryOptions
} from "@sandbox-core/core";

export * from "@sandbox-core/core";
export * from "@sandbox-core/schemas";

export interface SandboxClientOptions extends SandboxRegistryOptions {}

export class SandboxClient {
  private readonly registry: SandboxRegistry;

  constructor(options: SandboxClientOptions = {}) {
    this.registry = new SandboxRegistry(options);
  }

  register(backend: SandboxBackend): this {
    this.registry.register(backend);
    return this;
  }

  listBackends(): SandboxBackend[] {
    return this.registry.listBackends();
  }

  async create(request: CreateSandboxRequest, context: SandboxContext = {}): Promise<Sandbox> {
    return this.registry.create(request, context);
  }

  async get(lookup: SandboxLookup, context: SandboxContext = {}): Promise<Sandbox | null> {
    return this.registry.get(lookup, context);
  }
}

export function createSandboxClient(options: SandboxClientOptions = {}): SandboxClient {
  return new SandboxClient(options);
}

export type { BackendSelector };
