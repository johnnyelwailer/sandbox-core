import assert from "node:assert/strict";
import test from "node:test";

import { SandboxError } from "@sandbox-core/core";

import { createAzureBackend, parseAzureSandboxId } from "./index";
import type { AzureCommandRequest, AzureCommandResult } from "./azure-runner";

function createRunner(
  handler: (request: AzureCommandRequest) => Promise<AzureCommandResult> | AzureCommandResult
) {
  const calls: AzureCommandRequest[] = [];

  return {
    calls,
    runner: async (request: AzureCommandRequest): Promise<AzureCommandResult> => {
      calls.push(request);
      return handler(request);
    }
  };
}

test("create provisions container with env and resolved secrets", async () => {
  const { calls, runner } = createRunner(async (request) => {
    if (request.args[0] === "container" && request.args[1] === "create") {
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: JSON.stringify({ id: "container-id" }),
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

  const backend = createAzureBackend({
    idGenerator: () => "abc123",
    region: "swedencentral",
    resourceGroup: "rg-test",
    runner
  });

  const sandbox = await backend.create(
    {
      environment: {
        env: {
          FOO: "bar"
        },
        image: "alpine:3.20",
        kind: "container"
      },
      secrets: [{ name: "API_KEY", source: "kv" }]
    },
    {
      resolveSecret: async (ref) => ({
        name: ref.name,
        value: "secret-value"
      })
    }
  );

  assert.equal(sandbox.id, "azure:rg-test:sandbox-core-abc123");
  assert.equal(calls.length, 1);
  const createArgs = calls[0]?.args.join(" ") ?? "";
  assert.ok(createArgs.includes("container create"));
  assert.ok(createArgs.includes("--resource-group rg-test"));
  assert.ok(createArgs.includes("--location swedencentral"));
  assert.ok(createArgs.includes("FOO=bar"));
  assert.ok(createArgs.includes("API_KEY=secret-value"));
});

test("exec parses sentinel-based exit code", async () => {
  const { runner } = createRunner(async (request) => {
    if (request.args[0] === "container" && request.args[1] === "create") {
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: "{}",
        timedOut: false
      };
    }

    if (request.args[0] === "container" && request.args[1] === "exec") {
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: "hello\n__SC_EXIT_CODE__=7\n",
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

  const backend = createAzureBackend({
    idGenerator: () => "exec1",
    resourceGroup: "rg-test",
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
  assert.equal(events[2]?.type, "exit");
  assert.equal(events[2]?.type === "exit" ? events[2].exitCode : -1, 7);
});

test("template requests fail when template is unknown", async () => {
  const backend = createAzureBackend({
    resourceGroup: "rg-test",
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

test("get returns null for missing azure container", async () => {
  const backend = createAzureBackend({
    resourceGroup: "rg-test",
    runner: async () => ({
      exitCode: 3,
      signal: null,
      stderr: "(ResourceNotFound) The Resource was not found",
      stdout: "",
      timedOut: false
    })
  });

  const sandbox = await backend.get({
    id: "azure:rg-test:does-not-exist"
  });
  assert.equal(sandbox, null);
});

test("sandbox id parser handles valid and invalid ids", () => {
  assert.deepEqual(parseAzureSandboxId("azure:rg:test"), {
    containerName: "test",
    resourceGroup: "rg"
  });
  assert.equal(parseAzureSandboxId("local:rg:test"), null);
  assert.equal(parseAzureSandboxId("azure:only-one-part"), null);
});

test("create fails when resource group is not configured", async () => {
  const backend = createAzureBackend({
    resourceGroup: "",
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
          image: "mcr.microsoft.com/azurelinux/base/core:3.0",
          kind: "container"
        }
      }),
    (error: unknown) =>
      error instanceof SandboxError &&
      error.code === "invalid_request" &&
      error.message.includes("resource group")
  );
});

test("create failure redacts secrets from error details", async () => {
  const { runner } = createRunner(async (request) => {
    if (request.args[0] === "container" && request.args[1] === "create") {
      return {
        exitCode: 1,
        signal: null,
        stderr: "mystery123 in stderr",
        stdout: "mystery123 in stdout",
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

  const backend = createAzureBackend({
    idGenerator: () => "redact1",
    resourceGroup: "rg-test",
    runner
  });

  await assert.rejects(
    () =>
      backend.create(
        {
          environment: {
            image: "mcr.microsoft.com/azurelinux/base/core:3.0",
            kind: "container"
          },
          secrets: [{ name: "SESSION_ID", source: "kv" }]
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

test("terminate tolerates missing container and inspect reports terminated", async () => {
  const { runner } = createRunner(async (request) => {
    if (request.args[0] === "container" && request.args[1] === "create") {
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: "{}",
        timedOut: false
      };
    }

    if (request.args[0] === "container" && request.args[1] === "delete") {
      return {
        exitCode: 1,
        signal: null,
        stderr: "(ResourceNotFound) The Resource was not found",
        stdout: "",
        timedOut: false
      };
    }

    if (request.args[0] === "container" && request.args[1] === "show") {
      return {
        exitCode: 1,
        signal: null,
        stderr: "(ResourceNotFound) The Resource was not found",
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

  const backend = createAzureBackend({
    idGenerator: () => "term1",
    resourceGroup: "rg-test",
    runner
  });

  const sandbox = await backend.create({
    environment: {
      image: "mcr.microsoft.com/azurelinux/base/core:3.0",
      kind: "container"
    }
  });

  await sandbox.terminate();
  const info = await sandbox.inspect();
  assert.equal(info.status, "terminated");
});

test("exec command wrapper avoids shell quotes for azure container exec", async () => {
  const { calls, runner } = createRunner(async (request) => {
    if (request.args[0] === "container" && request.args[1] === "create") {
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: "{}",
        timedOut: false
      };
    }

    if (request.args[0] === "container" && request.args[1] === "exec") {
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: "hello\n__SC_EXIT_CODE__=0\n",
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

  const backend = createAzureBackend({
    idGenerator: () => "wrap1",
    resourceGroup: "rg-test",
    runner
  });

  const sandbox = await backend.create({
    environment: {
      image: "mcr.microsoft.com/azurelinux/base/core:3.0",
      kind: "container"
    }
  });

  const events = [];
  for await (const event of sandbox.exec({ args: ["hello"], command: "echo" })) {
    events.push(event);
  }

  assert.equal(events[2]?.type, "exit");

  const execCall = calls.find(
    (call) => call.args[0] === "container" && call.args[1] === "exec"
  );
  const execCommandIndex = execCall?.args.findIndex((arg) => arg === "--exec-command") ?? -1;
  assert.ok(execCall !== undefined);
  assert.ok(execCommandIndex >= 0);
  const execCommand = execCall?.args[execCommandIndex + 1] ?? "";
  assert.ok(execCommand.includes("sh -c printf${IFS}%s${IFS}"));
  assert.ok(!execCommand.includes("'"));
});
