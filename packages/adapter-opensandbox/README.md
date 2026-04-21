# @sandbox-core/adapter-opensandbox

OpenSandbox HTTP backend for `sandbox-core`.

Current behavior:

- create/get/inspect/terminate sandboxes over OpenSandbox HTTP API
- run commands with streamed status/stdout/stderr/exit events
- upload and download files using base64 payload transport
- optional secret resolution through `SandboxContext.resolveSecret`

Configuration:

- `apiBaseUrl` option or `OPENSANDBOX_BASE_URL` env var
- optional `apiKey` or `OPENSANDBOX_API_KEY`
- optional namespace via option or `OPENSANDBOX_NAMESPACE`

Tests:

- fast unit tests run through root `npm test`
- optional integration test:
  - `npm run test:opensandbox`
  - requires `RUN_OPENSANDBOX_TESTS=1` (set by script) and `OPENSANDBOX_BASE_URL`
  - optional `OPENSANDBOX_NAMESPACE` for isolated test runs
  - test includes best-effort cleanup in `finally` on failures
  - convenience command: `npm run test:opensandbox:infra` (auto-generates a temporary namespace and cleans it)
