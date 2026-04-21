import assert from "node:assert/strict";
import test from "node:test";

import {
  createOpenSandboxFetchTransport,
  type OpenSandboxRequest
} from "./transport";

interface CapturedFetchCall {
  init?: RequestInit;
  input: URL | RequestInfo;
}

function installFetchMock(
  handler: (input: URL | RequestInfo, init?: RequestInit) => Promise<Response> | Response
): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: URL | RequestInfo, init?: RequestInit): Promise<Response> =>
    handler(input, init);
  return () => {
    globalThis.fetch = originalFetch;
  };
}

test("fetch transport applies query and auth headers", async () => {
  const calls: CapturedFetchCall[] = [];
  const restore = installFetchMock(async (input, init) => {
    calls.push({ init, input });
    return new Response(JSON.stringify({ id: "sbx-1" }), {
      headers: {
        "content-type": "application/json"
      },
      status: 201
    });
  });

  try {
    const transport = createOpenSandboxFetchTransport({
      apiBaseUrl: "https://example.opensandbox.local/",
      apiKey: "test-key"
    });

    const response = await transport({
      body: {
        image: "ubuntu:24.04"
      },
      method: "POST",
      path: "/sandboxes",
      query: {
        namespace: "team-a"
      }
    });

    assert.equal(response.status, 201);
    const firstCall = calls[0];
    assert.notEqual(firstCall, undefined);
    const url = new URL(String(firstCall?.input));
    assert.equal(url.origin, "https://example.opensandbox.local");
    assert.equal(url.pathname, "/sandboxes");
    assert.equal(url.searchParams.get("namespace"), "team-a");

    const headers = firstCall?.init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer test-key");
    assert.equal(headers["x-api-key"], "test-key");
    assert.equal(headers["Content-Type"], "application/json");
  } finally {
    restore();
  }
});

test("fetch transport omits content-type when body is absent", async () => {
  const calls: CapturedFetchCall[] = [];
  const restore = installFetchMock(async (input, init) => {
    calls.push({ init, input });
    return new Response("", {
      headers: {
        "content-type": "text/plain"
      },
      status: 200
    });
  });

  try {
    const transport = createOpenSandboxFetchTransport({
      apiBaseUrl: "https://example.opensandbox.local"
    });

    const response = await transport({
      method: "GET",
      path: "/sandboxes/sbx-1"
    });

    assert.equal(response.status, 200);
    assert.equal(response.body, undefined);
    const headers = calls[0]?.init?.headers as Record<string, string>;
    assert.equal(headers?.["Content-Type"], undefined);
  } finally {
    restore();
  }
});

test("fetch transport aborts timed out requests", async () => {
  const restore = installFetchMock(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal === undefined || signal === null) {
          reject(new Error("missing signal"));
          return;
        }

        if (signal.aborted) {
          reject(new Error("aborted"));
          return;
        }

        signal.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      })
  );

  try {
    const transport = createOpenSandboxFetchTransport({
      apiBaseUrl: "https://example.opensandbox.local"
    });

    await assert.rejects(
      () =>
        transport({
          method: "GET",
          path: "/slow",
          timeoutMs: 10
        } satisfies OpenSandboxRequest),
      (error: unknown) => error instanceof Error && error.message.includes("aborted")
    );
  } finally {
    restore();
  }
});
