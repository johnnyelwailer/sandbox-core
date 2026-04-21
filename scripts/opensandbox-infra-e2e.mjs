#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options
  });
  return result.status ?? 1;
}

function trimEnv(name) {
  return (process.env[name] ?? "").trim();
}

function toBool(value, defaultValue) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }
  return defaultValue;
}

function sanitizePrefix(value, fallback) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  const trimmed = normalized.replace(/^-+/, "").replace(/-+$/, "");
  return trimmed.length > 0 ? trimmed : fallback;
}

function buildNamespace() {
  const prefix = sanitizePrefix(trimEnv("OPENSANDBOX_NAMESPACE_PREFIX"), "sandbox-core-local-e2e");
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${suffix}`.slice(0, 63);
}

function runOpenSandboxIntegration(namespace) {
  return run("npm", ["run", "test:opensandbox"], {
    env: {
      ...process.env,
      OPENSANDBOX_NAMESPACE: namespace,
      RUN_OPENSANDBOX_TESTS: "1"
    }
  });
}

function cleanupNamespace(namespace) {
  const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "opensandbox-cleanup.mjs");
  return run(process.execPath, [scriptPath], {
    env: {
      ...process.env,
      OPENSANDBOX_NAMESPACE: namespace
    }
  });
}

function main() {
  const baseUrl = trimEnv("OPENSANDBOX_BASE_URL");
  if (baseUrl.length === 0) {
    console.error(
      "OpenSandbox infra e2e requires OPENSANDBOX_BASE_URL (for example: https://your-opensandbox-endpoint)."
    );
    process.exit(1);
  }

  const providedNamespace = trimEnv("OPENSANDBOX_NAMESPACE");
  const generatedNamespace = providedNamespace.length === 0 ? buildNamespace() : providedNamespace;
  const generatedByScript = providedNamespace.length === 0;
  const cleanupGenerated = toBool(trimEnv("OPENSANDBOX_CLEANUP_GENERATED_NAMESPACE"), true);

  if (generatedByScript) {
    console.log(`Using temporary OpenSandbox namespace: ${generatedNamespace}`);
  } else {
    console.log(`Using OpenSandbox namespace from environment: ${generatedNamespace}`);
  }

  const testStatus = runOpenSandboxIntegration(generatedNamespace);

  if (generatedByScript && cleanupGenerated) {
    console.log(`Cleaning generated OpenSandbox namespace: ${generatedNamespace}`);
    const cleanupStatus = cleanupNamespace(generatedNamespace);
    if (cleanupStatus !== 0) {
      console.error("Warning: OpenSandbox namespace cleanup exited with a non-zero status.");
    }
  }

  process.exit(testStatus);
}

main();
