import assert from "node:assert/strict";
import test from "node:test";

import type { Sandbox } from "@sandbox-core/core";

import { createOpenSandboxBackend } from "./index";

test("integration: create, exec, upload, download, terminate", async (context) => {
  if (process.env.RUN_OPENSANDBOX_TESTS !== "1") {
    context.skip("set RUN_OPENSANDBOX_TESTS=1 to run OpenSandbox integration tests");
    return;
  }

  const baseUrl = process.env.OPENSANDBOX_BASE_URL;
  if (baseUrl === undefined || baseUrl.length === 0) {
    context.skip("set OPENSANDBOX_BASE_URL to run OpenSandbox integration tests");
    return;
  }

  const backend = createOpenSandboxBackend({
    apiBaseUrl: baseUrl,
    apiKey: process.env.OPENSANDBOX_API_KEY,
    namespace: process.env.OPENSANDBOX_NAMESPACE
  });

  let sandbox: Sandbox | null = null;
  try {
    sandbox = await backend.create({
      environment: {
        image: "ubuntu:24.04",
        kind: "container"
      }
    });

    await sandbox.upload({
      content: "opensandbox-integration",
      destinationPath: "/tmp/integration.txt",
      makeParents: true
    });

    const events = [];
    for await (const event of sandbox.exec({ command: "cat", args: ["/tmp/integration.txt"] })) {
      events.push(event);
    }

    const stdout = events.find((event) => event.type === "stdout");
    assert.ok(stdout !== undefined);
    if (stdout?.type === "stdout") {
      assert.equal(stdout.data.trim(), "opensandbox-integration");
    }

    const downloaded = await sandbox.download({
      sourcePath: "/tmp/integration.txt"
    });
    assert.equal(new TextDecoder().decode(downloaded), "opensandbox-integration");

    await sandbox.terminate();
    const info = await sandbox.inspect();
    assert.equal(info.status, "terminated");
    sandbox = null;
  } finally {
    if (sandbox !== null) {
      await sandbox.terminate().catch(() => undefined);
    }
  }
});
