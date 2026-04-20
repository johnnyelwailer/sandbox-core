import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import type { Sandbox } from "@sandbox-core/core";

import { createLocalDockerBackend } from "./index";

function hasDockerDaemon(): boolean {
  const info = spawnSync("docker", ["info"], { stdio: "ignore" });
  return info.status === 0;
}

test("integration: create, exec, upload, download, terminate", async (context) => {
  if (process.env.RUN_DOCKER_TESTS !== "1") {
    context.skip("set RUN_DOCKER_TESTS=1 to run docker integration tests");
    return;
  }

  if (!hasDockerDaemon()) {
    context.skip("docker daemon is not available");
    return;
  }

  const backend = createLocalDockerBackend({
    containerNamePrefix: "sandbox-core-it",
    defaultImage: "alpine:3.20"
  });

  let sandbox: Sandbox | null = null;

  try {
    sandbox = await backend.create({
      environment: {
        image: "alpine:3.20",
        kind: "container"
      }
    });

    await sandbox.upload({
      content: "integration",
      destinationPath: "/tmp/integration.txt",
      makeParents: true
    });

    const execEvents = [];
    for await (const event of sandbox.exec({
      args: ["/tmp/integration.txt"],
      command: "cat"
    })) {
      execEvents.push(event);
    }

    const stdoutEvent = execEvents.find((event) => event.type === "stdout");
    assert.ok(stdoutEvent !== undefined);
    if (stdoutEvent?.type === "stdout") {
      assert.equal(stdoutEvent.data.trim(), "integration");
    }

    const downloaded = await sandbox.download({
      sourcePath: "/tmp/integration.txt"
    });
    assert.equal(new TextDecoder().decode(downloaded), "integration");

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
