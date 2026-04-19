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
- stub backend packages for local Docker, Azure, and OpenSandbox

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
npm run typecheck
```

## Notes

- `adapter-memory` is functional and intended for tests/examples only.
- The Docker, Azure, and OpenSandbox packages are scaffold-only in this first cut.
- Core stays backend-neutral.
- Browser, artifacts, and durability are modeled as optional capabilities.
