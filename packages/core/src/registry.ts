import { SandboxError } from "./errors";
import type {
  CreateSandboxRequest,
  Sandbox,
  SandboxBackend,
  SandboxContext,
  SandboxLookup
} from "./types";

export type BackendSelector = (
  request: CreateSandboxRequest,
  backends: ReadonlyMap<string, SandboxBackend>
) => string;

export interface SandboxRegistryOptions {
  defaultBackendId?: string;
  selectBackend?: BackendSelector;
}

export class SandboxRegistry {
  private readonly backends = new Map<string, SandboxBackend>();
  private readonly defaultBackendId?: string;
  private readonly selectBackend?: BackendSelector;

  constructor(options: SandboxRegistryOptions = {}) {
    this.defaultBackendId = options.defaultBackendId;
    this.selectBackend = options.selectBackend;
  }

  register(backend: SandboxBackend): this {
    this.backends.set(backend.id, backend);
    return this;
  }

  listBackends(): SandboxBackend[] {
    return [...this.backends.values()];
  }

  getBackend(id: string): SandboxBackend | null {
    return this.backends.get(id) ?? null;
  }

  async create(request: CreateSandboxRequest, context: SandboxContext = {}): Promise<Sandbox> {
    const backend = this.resolveCreateBackend(request);
    return backend.create(request, context);
  }

  async get(lookup: SandboxLookup, context: SandboxContext = {}): Promise<Sandbox | null> {
    if (lookup.backend !== undefined) {
      const backend = this.backends.get(lookup.backend);
      if (backend === undefined) {
        throw new SandboxError({
          code: "backend_not_found",
          message: `Sandbox backend '${lookup.backend}' is not registered.`,
          details: { backend: lookup.backend }
        });
      }
      return backend.get(lookup, context);
    }

    for (const backend of this.backends.values()) {
      const sandbox = await backend.get(lookup, context);
      if (sandbox !== null) {
        return sandbox;
      }
    }

    return null;
  }

  private resolveCreateBackend(request: CreateSandboxRequest): SandboxBackend {
    const requestedBackend = request.backend;

    if (requestedBackend !== undefined) {
      const backend = this.backends.get(requestedBackend);
      if (backend === undefined) {
        throw new SandboxError({
          code: "backend_not_found",
          message: `Sandbox backend '${requestedBackend}' is not registered.`,
          details: { backend: requestedBackend }
        });
      }
      return backend;
    }

    if (this.selectBackend !== undefined) {
      const selectedId = this.selectBackend(request, this.backends);
      const selectedBackend = this.backends.get(selectedId);
      if (selectedBackend === undefined) {
        throw new SandboxError({
          code: "backend_not_found",
          message: `Selected sandbox backend '${selectedId}' is not registered.`,
          details: { backend: selectedId }
        });
      }
      return selectedBackend;
    }

    if (this.defaultBackendId !== undefined) {
      const defaultBackend = this.backends.get(this.defaultBackendId);
      if (defaultBackend === undefined) {
        throw new SandboxError({
          code: "backend_not_found",
          message: `Default sandbox backend '${this.defaultBackendId}' is not registered.`,
          details: { backend: this.defaultBackendId }
        });
      }
      return defaultBackend;
    }

    throw new SandboxError({
      code: "invalid_request",
      message: "No sandbox backend was specified or configured.",
      details: { reason: "missing_backend_selection" }
    });
  }
}
