#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function getEnv(name) {
  return (process.env[name] ?? "").trim();
}

function withQuery(baseUrl, path, query) {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value.length > 0) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

async function send(baseUrl, apiKey, method, path, query = {}) {
  const headers = {
    Accept: "application/json"
  };
  if (apiKey.length > 0) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers["x-api-key"] = apiKey;
  }

  try {
    return await fetch(withQuery(baseUrl, path, query), {
      headers,
      method
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`OpenSandbox cleanup warning: request failed (${method} ${path}): ${message}`);
    return null;
  }
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function collectIdsFromArray(value, out) {
  for (const item of value) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    if (typeof item.id === "string" && item.id.length > 0) {
      out.add(item.id);
    }
  }
}

export function extractSandboxIds(value) {
  const out = new Set();
  if (Array.isArray(value)) {
    collectIdsFromArray(value, out);
    return [...out];
  }

  if (value === null || typeof value !== "object") {
    return [];
  }

  for (const key of ["items", "sandboxes", "results"]) {
    if (Array.isArray(value[key])) {
      collectIdsFromArray(value[key], out);
    }
  }

  if (Array.isArray(value.data)) {
    collectIdsFromArray(value.data, out);
  } else if (value.data !== null && typeof value.data === "object") {
    for (const key of ["items", "sandboxes", "results"]) {
      if (Array.isArray(value.data[key])) {
        collectIdsFromArray(value.data[key], out);
      }
    }
  }

  return [...out];
}

async function main() {
  const baseUrl = getEnv("OPENSANDBOX_BASE_URL");
  const namespace = getEnv("OPENSANDBOX_NAMESPACE");
  const apiKey = getEnv("OPENSANDBOX_API_KEY");

  if (baseUrl.length === 0 || namespace.length === 0) {
    console.log("OpenSandbox cleanup skipped: missing OPENSANDBOX_BASE_URL or OPENSANDBOX_NAMESPACE.");
    return;
  }

  const listResponse = await send(baseUrl, apiKey, "GET", "/sandboxes", {
    namespace
  });

  if (listResponse === null) {
    return;
  }

  if (listResponse.status < 200 || listResponse.status >= 300) {
    console.log(
      `OpenSandbox cleanup skipped: list API returned status ${listResponse.status}.`
    );
    return;
  }

  const body = await parseJson(listResponse);
  const sandboxIds = extractSandboxIds(body);
  if (sandboxIds.length === 0) {
    console.log(`OpenSandbox cleanup: no sandboxes found in namespace '${namespace}'.`);
    return;
  }

  let deleted = 0;
  for (const id of sandboxIds) {
    const response = await send(baseUrl, apiKey, "DELETE", `/sandboxes/${encodeURIComponent(id)}`, {
      namespace
    });
    if (response === null) {
      continue;
    }

    if (response.status === 404 || (response.status >= 200 && response.status < 300)) {
      deleted += 1;
      continue;
    }

    console.log(`OpenSandbox cleanup warning: failed to delete sandbox '${id}' (status ${response.status}).`);
  }

  console.log(
    `OpenSandbox cleanup complete for namespace '${namespace}': ${deleted}/${sandboxIds.length} sandboxes deleted.`
  );
}

const isEntrypoint =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  await main();
}
