import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import test from "node:test";

import { SandboxError } from "@sandbox-core/core";

import { createLocalDockerBackend } from "./index";
import type { DockerCommandRequest, DockerCommandResult } from "./docker-runner";

function createRunner(
  handler: (request: DockerCommandRequest) => Promise<DockerCommandResult> | DockerCommandResult
) {
  const calls: DockerCommandRequest[] = [];

  return {
    calls,
    runner: async (request: DockerCommandRequest): Promise<DockerCommandResult> => {
      calls.push(request);
      return handler(request);
    }
  };
}

test("create resolves secret refs and starts a keepalive container", async () => {
  const { calls, runner } = createRunner(async (request) => {
    if (request.args[0] === "run") {
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: "container-id\n",
        timedOut: false
      };
    }

    return {
      exitCode: 0,
      signal: null,
      stderr: "",
      stdout: "",
      timedOut: false
    };
  });

  const backend = createLocalDockerBackend({
    idGenerator: () => "abc123",
    runner
  });

  const sandbox = await backend.create(
    {
      environment: {
        env: {
          FOO: "bar"
        },
        image: "node:22-alpine",
        kind: "container"
      },
      secrets: [{ name: "API_KEY", source: "test" }]
    },
    {
      resolveSecret: async (ref) => ({
        name: ref.name,
        value: "secret-value"
      })
    }
  );

  assert.equal(sandbox.id, "local-docker:sandbox-core-abc123");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.args[0], "run");
  assert.ok(calls[0]?.args.includes("node:22-alpine"));
  assert.ok(calls[0]?.args.includes("FOO=bar"));
  assert.ok(calls[0]?.args.includes("API_KEY=secret-value"));
});

test("exec emits status/stdout/stderr/exit", async () => {
  const { runner } = createRunner(async (request) => {
    if (request.args[0] === "run") {
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: "container-id\n",
        timedOut: false
      };
    }

    if (request.args[0] === "exec") {
      return {
        exitCode: 7,
        signal: null,
        stderr: "bad things\n",
        stdout: "hello\n",
        timedOut: false
      };
    }

    return {
      exitCode: 0,
      signal: null,
      stderr: "",
      stdout: "",
      timedOut: false
    };
  });

  const backend = createLocalDockerBackend({
    idGenerator: () => "exec1",
    runner
  });

  const sandbox = await backend.create({
    environment: {
      image: "alpine:3.20",
      kind: "container"
    }
  });

  const events = [];
  for await (const event of sandbox.exec({ args: ["hello"], command: "echo" })) {
    events.push(event);
  }

  assert.equal(events[0]?.type, "status");
  assert.equal(events[1]?.type, "stdout");
  assert.equal(events[2]?.type, "stderr");
  assert.equal(events[3]?.type, "exit");
  assert.equal(events[3]?.type === "exit" ? events[3].exitCode : -1, 7);
});

test("upload honors makeParents and mode", async () => {
  const { calls, runner } = createRunner(async () => ({
    exitCode: 0,
    signal: null,
    stderr: "",
    stdout: "",
    timedOut: false
  }));

  const backend = createLocalDockerBackend({
    idGenerator: () => "upload1",
    runner
  });

  const sandbox = await backend.create({
    environment: {
      image: "alpine:3.20",
      kind: "container"
    }
  });

  await sandbox.upload({
    content: "hello",
    destinationPath: "/tmp/path/hello.txt",
    makeParents: true,
    mode: "600"
  });

  assert.ok(calls.some((call) => call.args.join(" ").includes("mkdir -p /tmp/path")));
  assert.ok(calls.some((call) => call.args[0] === "cp"));
  assert.ok(calls.some((call) => call.args.join(" ").includes("chmod 600 /tmp/path/hello.txt")));
});

test("download returns transferred file bytes", async () => {
  const { runner } = createRunner(async (request) => {
    if (request.args[0] === "run") {
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: "container-id\n",
        timedOut: false
      };
    }

    if (request.args[0] === "cp") {
      const destination = request.args[2];
      if (destination !== undefined) {
        await writeFile(destination, "downloaded");
      }
    }

    return {
      exitCode: 0,
      signal: null,
      stderr: "",
      stdout: "",
      timedOut: false
    };
  });

  const backend = createLocalDockerBackend({
    idGenerator: () => "download1",
    runner
  });

  const sandbox = await backend.create({
    environment: {
      image: "alpine:3.20",
      kind: "container"
    }
  });

  const content = await sandbox.download({
    sourcePath: "/tmp/path/hello.txt"
  });

  assert.equal(new TextDecoder().decode(content), "downloaded");
});

test("template requests fail if template is unknown", async () => {
  const backend = createLocalDockerBackend({
    runner: async () => ({
      exitCode: 0,
      signal: null,
      stderr: "",
      stdout: "",
      timedOut: false
    })
  });

  await assert.rejects(
    () =>
      backend.create({
        environment: {
          kind: "template",
          template: "missing"
        }
      }),
    (error: unknown) =>
      error instanceof SandboxError &&
      error.code === "invalid_request" &&
      error.message.includes("Template 'missing'")
  );
});

test("create fails when secret refs exist without resolver", async () => {
  const backend = createLocalDockerBackend({
    runner: async () => ({
      exitCode: 0,
      signal: null,
      stderr: "",
      stdout: "",
      timedOut: false
    })
  });

  await assert.rejects(
    () =>
      backend.create({
        environment: {
          image: "alpine:3.20",
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

test("create failure redacts secrets from error details", async () => {
  const { runner } = createRunner(async () => ({
    exitCode: 1,
    signal: null,
    stderr: "docker failed mystery123",
    stdout: "stdout mystery123",
    timedOut: false
  }));

  const backend = createLocalDockerBackend({
    idGenerator: () => "redact1",
    runner
  });

  await assert.rejects(
    () =>
      backend.create(
        {
          environment: {
            image: "alpine:3.20",
            kind: "container"
          },
          secrets: [{ name: "SESSION_ID", source: "test" }]
        },
        {
          resolveSecret: async () => ({
            name: "SESSION_ID",
            value: "mystery123"
          })
        }
      ),
    (error: unknown) =>
      error instanceof SandboxError &&
      typeof error.details?.stderr === "string" &&
      typeof error.details?.stdout === "string" &&
      !error.details.stderr.includes("mystery123") &&
      !error.details.stdout.includes("mystery123") &&
      error.details.stderr.includes("[REDACTED]") &&
      error.details.stdout.includes("[REDACTED]")
  );
});

test("terminate tolerates missing container and reports terminated on inspect", async () => {
  const { runner } = createRunner(async (request) => {
    if (request.args[0] === "run") {
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: "container-id\n",
        timedOut: false
      };
    }

    if (request.args[0] === "rm") {
      return {
        exitCode: 1,
        signal: null,
        stderr: "Error: No such container: sandbox-core-term1",
        stdout: "",
        timedOut: false
      };
    }

    if (request.args[0] === "inspect") {
      return {
        exitCode: 1,
        signal: null,
        stderr: "Error: No such container: sandbox-core-term1",
        stdout: "",
        timedOut: false
      };
    }

    return {
      exitCode: 0,
      signal: null,
      stderr: "",
      stdout: "",
      timedOut: false
    };
  });

  const backend = createLocalDockerBackend({
    idGenerator: () => "term1",
    runner
  });

  const sandbox = await backend.create({
    environment: {
      image: "alpine:3.20",
      kind: "container"
    }
  });

  await sandbox.terminate();
  const info = await sandbox.inspect();
  assert.equal(info.status, "terminated");
});

test("browser capability starts session and returns playwright endpoint", async () => {
  const { runner } = createRunner(async (request) => {
    if (request.args[0] === "run" && request.args.includes("-p")) {
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: "browser-id\n",
        timedOut: false
      };
    }

    if (request.args[0] === "run") {
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: "container-id\n",
        timedOut: false
      };
    }

    if (request.args[0] === "port") {
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: "0.0.0.0:49153\n",
        timedOut: false
      };
    }

    return {
      exitCode: 0,
      signal: null,
      stderr: "",
      stdout: "",
      timedOut: false
    };
  });

  const backend = createLocalDockerBackend({
    browser: {
      enable: true
    },
    idGenerator: () => "browser1",
    runner
  });

  const sandbox = await backend.create({
    environment: {
      image: "alpine:3.20",
      kind: "container"
    }
  });

  const browser = await sandbox.getCapability("browser");
  assert.notEqual(browser, null);

  const session = await browser?.acquireSession({ headless: true });
  assert.equal(session?.protocol, "playwright");
  assert.equal(session?.endpoint, "ws://127.0.0.1:49153/");
});

test("terminate cleans browser containers before sandbox container", async () => {
  const rmCalls: string[] = [];
  const { runner } = createRunner(async (request) => {
    if (request.args[0] === "run" && request.args.includes("-p")) {
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: "browser-id\n",
        timedOut: false
      };
    }
    if (request.args[0] === "run") {
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: "container-id\n",
        timedOut: false
      };
    }
    if (request.args[0] === "port") {
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: "0.0.0.0:49153\n",
        timedOut: false
      };
    }
    if (request.args[0] === "rm") {
      rmCalls.push(request.args[2] ?? "");
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: "",
        timedOut: false
      };
    }

    return {
      exitCode: 0,
      signal: null,
      stderr: "",
      stdout: "",
      timedOut: false
    };
  });

  const backend = createLocalDockerBackend({
    browser: {
      enable: true
    },
    idGenerator: () => "termbrowser",
    runner
  });

  const sandbox = await backend.create({
    environment: {
      image: "alpine:3.20",
      kind: "container"
    }
  });
  const browser = await sandbox.getCapability("browser");
  await browser?.acquireSession();
  await sandbox.terminate();

  assert.equal(rmCalls.length, 2);
  assert.ok(rmCalls[0]?.includes("browser"));
  assert.equal(rmCalls[1], "sandbox-core-termbrowser");
});
