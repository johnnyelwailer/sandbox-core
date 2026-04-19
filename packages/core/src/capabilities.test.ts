import assert from "node:assert/strict";
import test from "node:test";

import { hasCapability, requireCapability, SandboxError } from "./index";
import type { Sandbox, SandboxCapabilityDescriptor, SandboxCapabilityMap, SandboxInfo } from "./types";

function createSandboxStub(capabilities: SandboxCapabilityDescriptor[]): Sandbox {
  return {
    backend: "stub",
    capabilities,
    id: "sbx-cap",
    async download() {
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
      name: Name
    ): Promise<SandboxCapabilityMap[Name] | null> {
      if (name === "durability") {
        return {
          inspectDurability: async () => ({
            browserState: false,
            filesystemState: true,
            processState: false,
            reconnectable: true
          })
        } as SandboxCapabilityMap[Name];
      }
      return null;
    },
    async inspect(): Promise<SandboxInfo> {
      return {
        backend: "stub",
        capabilities,
        createdAt: new Date(0).toISOString(),
        durability: {
          browserState: false,
          filesystemState: true,
          processState: false,
          reconnectable: true
        },
        id: "sbx-cap",
        status: "ready"
      };
    },
    async terminate() {},
    async upload() {}
  };
}

test("hasCapability returns true for present capability", () => {
  assert.equal(hasCapability([{ name: "durability" }], "durability"), true);
  assert.equal(hasCapability([{ name: "durability" }], "browser"), false);
});

test("requireCapability returns capability when present", async () => {
  const sandbox = createSandboxStub([{ name: "durability" }]);
  const capability = await requireCapability(sandbox, "durability");
  const durability = await capability.inspectDurability();
  assert.equal(durability.filesystemState, true);
});

test("requireCapability throws capability_not_supported when missing", async () => {
  const sandbox = createSandboxStub([{ name: "durability" }]);
  await assert.rejects(
    () => requireCapability(sandbox, "browser"),
    (error: unknown) =>
      error instanceof SandboxError &&
      error.code === "capability_not_supported" &&
      error.message.includes("browser")
  );
});
