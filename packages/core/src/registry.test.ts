import test from "node:test";
import assert from "node:assert/strict";

import { SandboxRegistry } from "./registry";
import type {
  CreateSandboxRequest,
  Sandbox,
  SandboxBackend,
  SandboxCapabilityMap,
  SandboxContext,
  SandboxInfo,
  SandboxLookup
} from "./types";

function createSandboxStub(id: string, backend: string): Sandbox {
  return {
    backend,
    capabilities: [],
    id,
    async download(): Promise<Uint8Array> {
      return new Uint8Array();
    },
    async *exec() {
      yield {
        at: new Date(0).toISOString(),
        exitCode: 0,
        type: "exit" as const
      };
    },
    async getCapability<Name extends keyof SandboxCapabilityMap>(
      _name: Name
    ): Promise<SandboxCapabilityMap[Name] | null> {
      return null;
    },
    async inspect(): Promise<SandboxInfo> {
      return {
        backend,
        capabilities: [],
        createdAt: new Date(0).toISOString(),
        durability: {
          browserState: false,
          filesystemState: false,
          processState: false,
          reconnectable: false
        },
        id,
        status: "ready"
      };
    },
    async terminate(): Promise<void> {},
    async upload(): Promise<void> {}
  };
}

class FakeBackend implements SandboxBackend {
  readonly advertisedCapabilities = [];
  readonly displayName = "Fake";
  readonly id: string;

  constructor(id: string) {
    this.id = id;
  }

  async create(request: CreateSandboxRequest, _context?: SandboxContext): Promise<Sandbox> {
    return createSandboxStub(`${this.id}:${request.environment.kind}`, this.id);
  }

  async get(lookup: SandboxLookup, _context?: SandboxContext): Promise<Sandbox | null> {
    if (lookup.id === `known:${this.id}`) {
      return createSandboxStub(lookup.id, this.id);
    }
    return null;
  }
}

test("registry uses explicit backend from request", async () => {
  const registry = new SandboxRegistry({ defaultBackendId: "local-docker" });
  registry.register(new FakeBackend("local-docker"));
  registry.register(new FakeBackend("azure"));

  const sandbox = await registry.create({
    backend: "azure",
    environment: {
      image: "node:22",
      kind: "container"
    }
  });

  assert.equal(sandbox.backend, "azure");
  assert.equal(sandbox.id, "azure:container");
});

test("registry falls back to configured default backend", async () => {
  const registry = new SandboxRegistry({ defaultBackendId: "local-docker" });
  registry.register(new FakeBackend("local-docker"));

  const sandbox = await registry.create({
    environment: {
      kind: "template",
      template: "default"
    }
  });

  assert.equal(sandbox.backend, "local-docker");
});

test("registry can discover sandbox across registered backends", async () => {
  const registry = new SandboxRegistry();
  registry.register(new FakeBackend("local-docker"));
  registry.register(new FakeBackend("azure"));

  const sandbox = await registry.get({ id: "known:azure" });

  assert.notEqual(sandbox, null);
  assert.equal(sandbox?.backend, "azure");
});
