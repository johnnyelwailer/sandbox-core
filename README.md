# sandbox-core

Shared sandbox foundation for `aloop`, `biwak`, and future consumers.

Start here:

- [Constitution](./docs/CONSTITUTION.md)
- [Shared Sandbox Foundation PRD](./docs/shared-sandbox-prd/README.md)

## Current status

This repository now contains:

- the initial PRD
- a TypeScript monorepo scaffold
- a portable core contract
- a functional in-memory backend for tests and examples
- a minimally functional local Docker backend
- a minimally functional Azure backend via `az` CLI
- a functional OpenSandbox HTTP adapter

## Workspace layout

```text
packages/
  adapter-azure/
  adapter-memory/
  adapter-local-docker/
  adapter-opensandbox/
  conformance/
  core/
  schemas/
  sdk-typescript/
docs/
  shared-sandbox-prd/
```

## Scripts

```bash
npm install
npm run build
npm test
npm run test:docker   # optional, requires local Docker daemon
npm run test:azure    # optional, requires az login + Azure resource group
npm run test:azure:infra  # creates temporary Azure resource group, runs test:azure, then deletes group
npm run test:opensandbox  # optional, requires OpenSandbox endpoint
npm run test:opensandbox:infra  # creates temporary namespace, runs test:opensandbox, then cleans namespace
npm run typecheck
```

Useful environment variables for infra scripts:

- `AZURE_LOCATION` (default: `westeurope`)
- `AZURE_RESOURCE_GROUP_PREFIX` (default: `sandbox-core-local-e2e`)
- `OPENSANDBOX_BASE_URL` (required for OpenSandbox infra script)
- `OPENSANDBOX_API_KEY` (optional)
- `OPENSANDBOX_NAMESPACE_PREFIX` (default: `sandbox-core-local-e2e`)
- `OPENSANDBOX_DISPOSABLE_NAMESPACE` (default: `true`; set `false` to require explicit `OPENSANDBOX_NAMESPACE`)
- `OPENSANDBOX_CLEANUP_GENERATED_NAMESPACE` (default: `true`)

## CI

- `.github/workflows/ci.yml` runs `typecheck` and unit tests on push/PR.
- `.github/workflows/azure-infra-e2e.yml` is manual and runs the same local infra script path (`test:azure:infra`) for live verification.
- `.github/workflows/opensandbox-infra-e2e.yml` is manual and runs the same local infra script path (`test:opensandbox:infra`) with optional disposable namespace isolation and best-effort cleanup.

For GitHub-hosted Azure infra tests, configure one auth mode:

- `AZURE_CREDENTIALS` (service principal JSON for `azure/login`)
- or `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID` for OIDC login

For GitHub-hosted OpenSandbox infra tests, configure:

- `OPENSANDBOX_BASE_URL` (unless provided as workflow input)
- optional `OPENSANDBOX_API_KEY`
- optional workflow input `namespace` for a fixed namespace
- optional workflow input `namespace_prefix` for generated namespace naming
- optional workflow input `disposable_namespace=true` to auto-generate a run-scoped namespace when `namespace` is not provided
- when `disposable_namespace=false`, provide `namespace`
- optional workflow input `cleanup_generated_namespace=true` to run `scripts/opensandbox-cleanup.mjs` after test completion

## Notes

- `adapter-memory` is functional and intended for tests/examples only.
- `adapter-local-docker` supports lifecycle, exec, upload, and download via `docker` CLI, plus optional browser session capability.
- `adapter-azure` supports lifecycle, exec, upload, and download via `az` CLI + Azure Container Instances.
- `adapter-opensandbox` supports lifecycle, exec, upload, and download over HTTP transport.
- `@sandbox-core/conformance` provides shared backend conformance tests used by all adapter test suites.
- integration tests now use best-effort `finally` cleanup to reduce leaked resources on failures.
- Core stays backend-neutral.
- Browser, artifacts, and durability are modeled as optional capabilities.
