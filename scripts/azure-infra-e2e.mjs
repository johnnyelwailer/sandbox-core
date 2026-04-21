#!/usr/bin/env node

import { spawnSync } from "node:child_process";

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

function sanitizePrefix(value, fallback) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  const trimmed = normalized.replace(/^-+/, "").replace(/-+$/, "");
  return trimmed.length > 0 ? trimmed : fallback;
}

function assertAzInstalled() {
  const status = run("az", ["version"], { stdio: "ignore" });
  if (status !== 0) {
    console.error("Azure infra e2e requires Azure CLI (`az`) to be installed.");
    process.exit(1);
  }
}

function assertAzAuthenticated() {
  const status = run("az", ["account", "show", "--output", "none"], { stdio: "ignore" });
  if (status !== 0) {
    console.error("Azure infra e2e requires an authenticated Azure CLI session. Run `az login` first.");
    process.exit(1);
  }
}

function buildResourceGroupName() {
  const prefix = sanitizePrefix(trimEnv("AZURE_RESOURCE_GROUP_PREFIX"), "sandbox-core-local-e2e");
  const runSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${runSuffix}`.slice(0, 90);
}

function createResourceGroup(name, location) {
  return run("az", [
    "group",
    "create",
    "--name",
    name,
    "--location",
    location,
    "--tags",
    "owner=local-e2e",
    "project=sandbox-core",
    "--output",
    "none"
  ]);
}

function deleteResourceGroup(name) {
  return run("az", ["group", "delete", "--name", name, "--yes", "--no-wait"]);
}

function runAzureIntegration(resourceGroup, location) {
  return run("npm", ["run", "test:azure"], {
    env: {
      ...process.env,
      AZURE_LOCATION: location,
      AZURE_RESOURCE_GROUP: resourceGroup,
      RUN_AZURE_TESTS: "1"
    }
  });
}

function main() {
  assertAzInstalled();
  assertAzAuthenticated();

  const location = trimEnv("AZURE_LOCATION") || "westeurope";
  const resourceGroup = trimEnv("AZURE_RESOURCE_GROUP") || buildResourceGroupName();

  if (trimEnv("AZURE_RESOURCE_GROUP").length > 0) {
    console.log(`Using existing resource group: ${resourceGroup}`);
  } else {
    console.log(`Creating temporary resource group: ${resourceGroup} (${location})`);
    const createStatus = createResourceGroup(resourceGroup, location);
    if (createStatus !== 0) {
      console.error("Failed to create temporary Azure resource group.");
      process.exit(createStatus);
    }
  }

  const testStatus = runAzureIntegration(resourceGroup, location);

  if (trimEnv("AZURE_RESOURCE_GROUP").length === 0) {
    console.log(`Deleting temporary resource group: ${resourceGroup}`);
    const deleteStatus = deleteResourceGroup(resourceGroup);
    if (deleteStatus !== 0) {
      console.error("Warning: failed to request deletion of temporary resource group.");
    }
  }

  process.exit(testStatus);
}

main();
