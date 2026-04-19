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
npm run test:opensandbox  # optional, requires OpenSandbox endpoint
npm run typecheck
```

## CI

- `.github/workflows/ci.yml` runs `typecheck` and unit tests on push/PR.
- `.github/workflows/azure-infra-e2e.yml` is manual and creates a temporary Azure resource group for live infra verification.

For GitHub-hosted Azure infra tests, configure one auth mode:

- `AZURE_CREDENTIALS` (service principal JSON for `azure/login`)
- or `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID` for OIDC login

## Notes

- `adapter-memory` is functional and intended for tests/examples only.
- `adapter-local-docker` supports lifecycle, exec, upload, and download via `docker` CLI.
- `adapter-azure` supports lifecycle, exec, upload, and download via `az` CLI + Azure Container Instances.
- `adapter-opensandbox` supports lifecycle, exec, upload, and download over HTTP transport.
- Core stays backend-neutral.
- Browser, artifacts, and durability are modeled as optional capabilities.
