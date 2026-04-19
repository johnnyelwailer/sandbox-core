import { SandboxError } from "./errors";
import type {
  Sandbox,
  SandboxCapabilityDescriptor,
  SandboxCapabilityMap
} from "./types";

function capabilityListToSet(
  capabilities: readonly SandboxCapabilityDescriptor[]
): Set<string> {
  return new Set(capabilities.map((capability) => capability.name));
}

export function hasCapability<Name extends keyof SandboxCapabilityMap>(
  capabilities: readonly SandboxCapabilityDescriptor[],
  name: Name
): boolean {
  return capabilityListToSet(capabilities).has(name);
}

export async function requireCapability<Name extends keyof SandboxCapabilityMap>(
  sandbox: Sandbox,
  name: Name
): Promise<SandboxCapabilityMap[Name]> {
  const capability = await sandbox.getCapability(name);
  if (capability === null) {
    throw new SandboxError({
      code: "capability_not_supported",
      message: `Sandbox '${sandbox.id}' does not support capability '${name}'.`,
      details: {
        capability: name,
        sandboxId: sandbox.id
      }
    });
  }

  return capability;
}
