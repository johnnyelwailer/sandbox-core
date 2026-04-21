import assert from "node:assert/strict";
import test from "node:test";

import { extractSandboxIds } from "./opensandbox-cleanup.mjs";

test("extractSandboxIds reads known top-level collection shapes", () => {
  assert.deepEqual(
    extractSandboxIds({
      sandboxes: [{ id: "sbx-1" }, { id: "sbx-2" }]
    }).sort(),
    ["sbx-1", "sbx-2"]
  );

  assert.deepEqual(
    extractSandboxIds({
      items: [{ id: "sbx-3" }]
    }),
    ["sbx-3"]
  );

  assert.deepEqual(
    extractSandboxIds({
      results: [{ id: "sbx-4" }]
    }),
    ["sbx-4"]
  );
});

test("extractSandboxIds reads known nested data shapes", () => {
  assert.deepEqual(
    extractSandboxIds({
      data: {
        items: [{ id: "sbx-1" }, { id: "sbx-2" }]
      }
    }).sort(),
    ["sbx-1", "sbx-2"]
  );

  assert.deepEqual(
    extractSandboxIds({
      data: [{ id: "sbx-3" }, { id: "sbx-4" }]
    }).sort(),
    ["sbx-3", "sbx-4"]
  );
});

test("extractSandboxIds ignores unrelated id fields and invalid entries", () => {
  assert.deepEqual(
    extractSandboxIds({
      id: "top-level-not-a-sandbox-list",
      meta: {
        id: "also-not-a-sandbox-list"
      },
      sandboxes: [{ id: "sbx-1" }, { id: 123 }, null, "bad"]
    }),
    ["sbx-1"]
  );
});

test("extractSandboxIds deduplicates ids", () => {
  assert.deepEqual(
    extractSandboxIds({
      sandboxes: [{ id: "sbx-1" }, { id: "sbx-1" }],
      data: {
        items: [{ id: "sbx-2" }, { id: "sbx-1" }]
      }
    }).sort(),
    ["sbx-1", "sbx-2"]
  );
});
