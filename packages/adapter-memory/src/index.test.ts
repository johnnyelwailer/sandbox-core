import test from "node:test";
import assert from "node:assert/strict";

import { SandboxError, hasCapability } from "@sandbox-core/core";

import { createMemoryBackend } from "./index";

test("memory backend preserves uploaded files across lookup", async () => {
  const backend = createMemoryBackend();

  const sandbox = await backend.create({
    environment: {
      kind: "template",
      template: "default"
    }
  });

  await sandbox.upload({
    content: "hello",
    destinationPath: "/tmp/hello.txt"
  });

  const lookup = await backend.get({ id: sandbox.id });

  assert.notEqual(lookup, null);

  const content = await lookup?.download({ sourcePath: "/tmp/hello.txt" });

  assert.equal(new TextDecoder().decode(content), "hello");
});

test("memory backend emits simple exec events", async () => {
  const backend = createMemoryBackend();

  const sandbox = await backend.create({
    environment: {
      image: "node:22",
      kind: "container"
    }
  });

  const events = [];
  for await (const event of sandbox.exec({ args: ["hello"], command: "echo" })) {
    events.push(event);
  }

  assert.equal(events[0]?.type, "status");
  assert.equal(events[1]?.type, "stdout");
  assert.equal(events[2]?.type, "exit");

  if (events[1]?.type !== "stdout") {
    assert.fail("expected stdout event");
  }

  assert.equal(events[1].data, "echo hello");
});

test("memory backend exposes durability capability", async () => {
  const backend = createMemoryBackend();
  const sandbox = await backend.create({
    environment: {
      kind: "template",
      template: "default"
    }
  });

  assert.equal(hasCapability(sandbox.capabilities, "durability"), true);

  const durability = await sandbox.getCapability("durability");
  assert.notEqual(durability, null);
  const durabilityState = await durability?.inspectDurability();
  assert.deepEqual(durabilityState, {
    browserState: false,
    filesystemState: true,
    processState: false,
    reconnectable: true
  });

  const info = await sandbox.inspect();
  assert.deepEqual(durabilityState, info.durability);
});

test("memory backend resolves secret refs during create", async () => {
  const backend = createMemoryBackend();
  const resolved: string[] = [];

  await backend.create(
    {
      environment: {
        image: "node:22",
        kind: "container"
      },
      secrets: [{ name: "API_KEY", source: "test" }]
    },
    {
      resolveSecret: async (secretRef) => {
        resolved.push(secretRef.name);
        return {
          name: secretRef.name,
          value: "resolved-value"
        };
      }
    }
  );

  assert.deepEqual(resolved, ["API_KEY"]);
});

test("memory backend fails when secret refs exist without resolver", async () => {
  const backend = createMemoryBackend();

  await assert.rejects(
    () =>
      backend.create({
        environment: {
          image: "node:22",
          kind: "container"
        },
        secrets: [{ name: "MISSING_SECRET" }]
      }),
    (error: unknown) =>
      error instanceof SandboxError &&
      error.code === "secret_resolution_failed" &&
      error.message.includes("resolveSecret")
  );
});
