# Architecture

## Proposed architecture

Use a monorepo with a narrow portable core and pluggable adapters.

Example layout:

```text
packages/
  core/
  adapter-local-docker/
  adapter-azure/
  adapter-opensandbox/
  capability-browser-playwright/
  sdk-typescript/
  schemas/
docs/
  shared-sandbox-prd/
```

## Core model

The center of the design is a `Sandbox` plus optional capabilities.

Core package responsibilities:

- portable domain model
- lifecycle interfaces
- command execution interfaces
- file transfer interfaces
- capability discovery
- secret reference plumbing
- event and error contracts
- backend registration and selection hooks

Core package non-responsibilities:

- scheduling
- queueing
- workflow orchestration
- worktree management
- tracker integration
- cloud-vendor assumptions

## Capability model

A sandbox is created with a base contract and may expose optional capabilities such as:

- `browser`
- `ports`
- `artifacts`
- `durability`
- `networkPolicy`

Why this shape:

- lets backends stay honest about what they can do
- avoids pretending every environment is identical
- prevents browser or persistence semantics from bloating the core abstraction

## Backend architecture

Backends should implement the same core interfaces and advertise capability support explicitly.

Planned backends:

- local Docker adapter
- Azure-hosted adapter
- OpenSandbox-backed adapter

Longer-term candidates:

- Kubernetes-native adapter
- Firecracker-backed adapter
- gVisor/Kata-backed adapter

## Persistence architecture

Recommendation:

- keep persistence out of core orchestration responsibilities
- define backend-reported metadata for reconnectability and support levels
- allow consumers to store handles, sandbox IDs, and metadata externally

This keeps core simple while preserving an upgrade path.

Suggested model:

- sandbox has an ID
- backend reports whether that ID is reconnectable
- backend reports whether filesystem/process/browser state persistence exists
- consumers decide whether to rely on those semantics

## Secret architecture

Recommendation:

- core accepts opaque secret references
- adapter resolves and injects according to a host-provided resolver contract
- consuming product owns policy and secret provenance

This keeps the shared layer useful without forcing Key Vault, Vault, 1Password, or env-file assumptions into core.

## Browser architecture

Recommendation:

- browser is an optional capability
- standardize the contract around acquiring a browser session, not around "computer use"
- use a Playwright-shaped protocol as the likely first standard session form

Why:

- broad portability
- strong local and hosted tooling ecosystem
- compatible with future higher-level layers such as Stagehand or product-specific computer-use workflows

## Library-first stance

The repo should start as a library, not another daemon/service to operate.

Reason:

- simpler adoption inside both products
- easier local development
- lower setup burden
- preserves a future path to remote control-plane patterns if needed later

This does not prevent future transport/protocol layers. It only avoids forcing them into v1.
