# @sandbox-core/adapter-local-docker

Local Docker backend for `sandbox-core`.

Current behavior:

- create/get/inspect/terminate sandboxes using Docker containers
- run commands with streamed status/stdout/stderr/exit events
- upload and download files with `docker cp`
- optional secret resolution through `SandboxContext.resolveSecret`
- optional browser capability (Playwright-style endpoint) when `browser.enable` is set

Notes:

- this adapter uses the local `docker` CLI
- durability is process-local plus reconnect by sandbox id
- artifact capability is not implemented yet

Tests:

- fast unit tests run through the root `npm test`
- optional real-docker integration test:
  - `npm run test:docker`
  - requires `RUN_DOCKER_TESTS=1` (set by script) and an available local Docker daemon
