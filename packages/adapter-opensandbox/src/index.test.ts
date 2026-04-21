import assert from "node:assert/strict";
import test from "node:test";

import { SandboxError } from "@sandbox-core/core";

import { createOpenSandboxBackend } from "./index";
import type {
  OpenSandboxRequest,
  OpenSandboxResponse,
  OpenSandboxTransport
} from "./transport";

function createTransport(
  handler: (request: OpenSandboxRequest) => Promise<OpenSandboxResponse> | OpenSandboxResponse
): { calls: OpenSandboxRequest[]; transport: OpenSandboxTransport } {
  const calls: OpenSandboxRequest[] = [];
  return {
    calls,
    transport: async (request: OpenSandboxRequest): Promise<OpenSandboxResponse> => {
      calls.push(request);
      return handler(request);
    }
  };
}

test("create sends image/env and resolved secrets", async () => {
  const { calls, transport } = createTransport(async (request) => {
    if (request.method === "POST" && request.path === "/sandboxes") {
      return {
        body: {
          id: "sbx-1",
          status: "running"
        },
        status: 201
      };
    }

    return {
      status: 404
    };
  });

  const backend = createOpenSandboxBackend({
    namespace: "team-a",
    transport
  });

  const sandbox = await backend.create(
    {
      environment: {
        env: {
          FOO: "bar"
        },
        image: "ubuntu:24.04",
        kind: "container"
      },
      secrets: [{ name: "API_KEY" }]
    },
    {
      resolveSecret: async () => ({
        name: "API_KEY",
        value: "secret-value"
      })
    }
  );

  assert.equal(sandbox.id, "sbx-1");
  assert.equal(calls.length, 1);
  const body = calls[0]?.body as Record<string, unknown>;
  const env = body["env"] as Record<string, string>;
  assert.equal(env["FOO"], "bar");
  assert.equal(env["API_KEY"], "secret-value");
  assert.equal(calls[0]?.query?.["namespace"], "team-a");
});

test("exec emits stdout/stderr/exit events", async () => {
  const { transport } = createTransport(async (request) => {
    if (request.method === "POST" && request.path === "/sandboxes") {
      return {
        body: { id: "sbx-2", status: "running" },
        status: 201
      };
    }

    if (request.method === "POST" && request.path === "/sandboxes/sbx-2/exec") {
      return {
        body: {
          exitCode: 7,
          stderr: "oops",
          stdout: "hello"
        },
        status: 200
      };
    }

    return { status: 404 };
  });

  const backend = createOpenSandboxBackend({ transport });
  const sandbox = await backend.create({
    environment: {
      image: "ubuntu:24.04",
      kind: "container"
    }
  });

  const events = [];
  for await (const event of sandbox.exec({ command: "echo", args: ["hello"] })) {
    events.push(event);
  }

  assert.equal(events[0]?.type, "status");
  assert.equal(events[1]?.type, "stdout");
  assert.equal(events[2]?.type, "stderr");
  assert.equal(events[3]?.type, "exit");
});

test("upload and download file payloads", async () => {
  const { calls, transport } = createTransport(async (request) => {
    if (request.method === "POST" && request.path === "/sandboxes") {
      return {
        body: { id: "sbx-3", status: "running" },
        status: 201
      };
    }

    if (request.method === "PUT" && request.path === "/sandboxes/sbx-3/files") {
      return { status: 204 };
    }

    if (request.method === "GET" && request.path === "/sandboxes/sbx-3/files") {
      return {
        body: {
          contentBase64: Buffer.from("payload").toString("base64")
        },
        status: 200
      };
    }

    return { status: 404 };
  });

  const backend = createOpenSandboxBackend({ transport });
  const sandbox = await backend.create({
    environment: {
      image: "ubuntu:24.04",
      kind: "container"
    }
  });

  await sandbox.upload({
    content: "payload",
    destinationPath: "/tmp/test.txt",
    makeParents: true
  });

  const uploadedBody = calls.find(
    (call) => call.method === "PUT" && call.path === "/sandboxes/sbx-3/files"
  )?.body as Record<string, unknown>;
  assert.equal(typeof uploadedBody["contentBase64"], "string");
  assert.equal(calls.find((call) => call.method === "PUT")?.query?.["path"], "/tmp/test.txt");

  const downloaded = await sandbox.download({
    sourcePath: "/tmp/test.txt"
  });
  assert.equal(new TextDecoder().decode(downloaded), "payload");
});

test("get returns null for not found", async () => {
  const backend = createOpenSandboxBackend({
    transport: async () => ({
      status: 404
    })
  });

  const sandbox = await backend.get({ id: "missing" });
  assert.equal(sandbox, null);
});

test("create fails when secrets are provided without resolver", async () => {
  const backend = createOpenSandboxBackend({
    transport: async () => ({
      body: { id: "sbx", status: "running" },
      status: 201
    })
  });

  await assert.rejects(
    () =>
      backend.create({
        environment: {
          image: "ubuntu:24.04",
          kind: "container"
        },
        secrets: [{ name: "UNRESOLVED" }]
      }),
    (error: unknown) =>
      error instanceof SandboxError &&
      error.code === "secret_resolution_failed" &&
      error.message.includes("resolveSecret")
  );
});

test("create failure redacts secret-like response details", async () => {
  const backend = createOpenSandboxBackend({
    transport: async () => ({
      body: {
        message: "create failed api_key=secret-value Authorization: Bearer abc123",
        trace: "x-api-key: key789"
      },
      status: 500
    })
  });

  await assert.rejects(
    () =>
      backend.create({
        environment: {
          image: "ubuntu:24.04",
          kind: "container"
        }
      }),
    (error: unknown) =>
      error instanceof SandboxError &&
      !error.message.includes("secret-value") &&
      !error.message.includes("abc123") &&
      typeof error.details?.bodyPreview === "string" &&
      !error.details.bodyPreview.includes("secret-value") &&
      !error.details.bodyPreview.includes("abc123") &&
      !error.details.bodyPreview.includes("key789") &&
      error.details.bodyPreview.includes("[REDACTED]")
  );
});
