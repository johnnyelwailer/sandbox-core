import { SandboxError } from "@sandbox-core/core";
import type {
  CreateSandboxRequest,
  Sandbox,
  SandboxBackend,
  SandboxContext,
  SandboxLookup
} from "@sandbox-core/core";

export interface LocalDockerBackendOptions {
  defaultImage?: string;
  dockerBinary?: string;
}

export class LocalDockerBackend implements SandboxBackend {
  readonly advertisedCapabilities = ["artifacts", "browser", "durability", "ports"] as const;
  readonly displayName = "Local Docker";
  readonly id = "local-docker";

  constructor(readonly options: LocalDockerBackendOptions = {}) {}

  async create(_request: CreateSandboxRequest, _context: SandboxContext = {}): Promise<Sandbox> {
    throw SandboxError.notImplemented(
      "Local Docker backend execution is not implemented yet.",
      { backend: this.id }
    );
  }

  async get(_lookup: SandboxLookup, _context: SandboxContext = {}): Promise<Sandbox | null> {
    throw SandboxError.notImplemented(
      "Local Docker backend lookup is not implemented yet.",
      { backend: this.id }
    );
  }
}

export function createLocalDockerBackend(
  options: LocalDockerBackendOptions = {}
): LocalDockerBackend {
  return new LocalDockerBackend(options);
}
