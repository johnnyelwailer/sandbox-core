import test from "node:test";
import assert from "node:assert/strict";

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
