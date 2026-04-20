import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import test from "node:test";

import type { Sandbox } from "@sandbox-core/core";

import { createAzureBackend } from "./index";

function hasAzSession(): boolean {
  const info = spawnSync("az", ["account", "show", "--output", "none"], {
    stdio: "ignore"
  });
  return info.status === 0;
}

async function waitUntilReady(
  inspect: () => Promise<{ status: string }>,
  timeoutMs: number
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = await inspect();
    if (state.status === "ready") {
      return;
    }
    await sleep(2000);
  }

  throw new Error(`Timed out waiting for Azure sandbox to become ready after ${timeoutMs}ms`);
}

test("integration: create, exec, upload, download, terminate", async (context) => {
  if (process.env.RUN_AZURE_TESTS !== "1") {
    context.skip("set RUN_AZURE_TESTS=1 to run Azure integration tests");
    return;
  }

  const resourceGroup = process.env.AZURE_RESOURCE_GROUP;
  if (resourceGroup === undefined || resourceGroup.length === 0) {
    context.skip("set AZURE_RESOURCE_GROUP to run Azure integration tests");
    return;
  }

  if (!hasAzSession()) {
    context.skip("azure cli is not authenticated (run `az login`)");
    return;
  }

  const backend = createAzureBackend({
    defaultImage: "mcr.microsoft.com/azurelinux/base/core:3.0",
    region: process.env.AZURE_LOCATION ?? "westeurope",
    resourceGroup
  });

  let sandbox: Sandbox | null = null;
  try {
    const createdSandbox = await backend.create({
      environment: {
        image: "mcr.microsoft.com/azurelinux/base/core:3.0",
        kind: "container"
      }
    });
    sandbox = createdSandbox;

    await waitUntilReady(() => createdSandbox.inspect(), 120000);

    await createdSandbox.upload({
      content: "azure-integration",
      destinationPath: "/tmp/integration.txt",
      makeParents: true
    });

    const events = [];
    for await (const event of createdSandbox.exec({
      args: ["/tmp/integration.txt"],
      command: "cat",
      timeoutMs: 30000
    })) {
      events.push(event);
    }

    const stdoutEvent = events.find((event) => event.type === "stdout");
    assert.ok(stdoutEvent !== undefined);
    if (stdoutEvent?.type === "stdout") {
      assert.equal(stdoutEvent.data.trim(), "azure-integration");
    }

    const downloaded = await createdSandbox.download({
      sourcePath: "/tmp/integration.txt"
    });
    assert.equal(new TextDecoder().decode(downloaded), "azure-integration");

    await createdSandbox.terminate();
    const info = await createdSandbox.inspect();
    assert.equal(info.status, "terminated");
    sandbox = null;
  } finally {
    if (sandbox !== null) {
      await sandbox.terminate().catch(() => undefined);
    }
  }
});
