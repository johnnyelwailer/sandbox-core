import assert from "node:assert/strict";
import test from "node:test";

import { redactSensitiveText } from "./redaction";

test("redactSensitiveText redacts known secret values", () => {
  const input = "failed with secret-value and another-value";
  const output = redactSensitiveText(input, ["secret-value"]);
  assert.equal(output.includes("secret-value"), false);
  assert.equal(output.includes("[REDACTED]"), true);
  assert.equal(output.includes("another-value"), true);
});

test("redactSensitiveText redacts bearer and api key headers", () => {
  const input = "Authorization: Bearer abc123 x-api-key: xyz789";
  const output = redactSensitiveText(input);
  assert.equal(output.includes("abc123"), false);
  assert.equal(output.includes("xyz789"), false);
  assert.equal(output.includes("Authorization: Bearer [REDACTED]"), true);
  assert.equal(output.includes("x-api-key: [REDACTED]"), true);
});

test("redactSensitiveText redacts key-value and env assignment secrets", () => {
  const input = "API_KEY=secret-value token=abc123 password:\"pw1\"";
  const output = redactSensitiveText(input);
  assert.equal(output.includes("secret-value"), false);
  assert.equal(output.includes("abc123"), false);
  assert.equal(output.includes("pw1"), false);
  assert.equal(output.includes("API_KEY=[REDACTED]"), true);
  assert.equal(output.includes("token=[REDACTED]"), true);
  assert.equal(output.includes("password:[REDACTED]"), true);
});

test("redactSensitiveText redacts secret query params", () => {
  const input = "https://example.test?a=1&api_key=secret123&token=abc";
  const output = redactSensitiveText(input);
  assert.equal(output.includes("secret123"), false);
  assert.equal(output.includes("token=abc"), false);
  assert.equal(output.includes("api_key=[REDACTED]"), true);
  assert.equal(output.includes("token=[REDACTED]"), true);
});
