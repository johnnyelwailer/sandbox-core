# Roadmap

## Phase 0: contract and repo setup

Deliverables:

- monorepo structure
- core domain model
- schema package for requests, events, errors
- adapter interfaces
- minimal TypeScript SDK
- architecture tests that prevent adapter leakage into core

Exit criteria:

- core contract can describe sandbox lifecycle, exec, files, secrets, capabilities

## Phase 1: thin usable slice

Deliverables:

- local Docker adapter
- Azure adapter
- create, inspect, exec, upload, download, terminate
- `AsyncIterable` streaming for exec
- opaque secret refs with host-provided resolver

Exit criteria:

- one simple coding-agent workload can switch between local and Azure with the same consumer-facing API

## Phase 2: portability proof

Deliverables:

- OpenSandbox-backed adapter
- compatibility test suite reused across adapters
- capability conformance tests

Exit criteria:

- same consumer contract runs on at least three backends:
  - local Docker
  - Azure
  - OpenSandbox-backed

## Phase 3: browser capability

Deliverables:

- browser capability contract
- Playwright-shaped session acquisition
- optional local and hosted browser-capable backend support

Exit criteria:

- a consumer can acquire a browser session through the shared library without vendor-specific code paths in product logic

## Phase 4: durability and richer artifacts

Possible deliverables:

- durability capability contract
- reconnect semantics where supported
- richer artifact abstractions
- stronger isolation backend

Exit criteria:

- backend-specific persistence is surfaced cleanly without breaking the original core model

## Success metrics

- both `aloop` and `biwak` consume the same foundation without forking the core contract
- local and hosted switching does not require product-specific adapter glue everywhere
- secrets are handled without each product inventing its own runtime injection model
- browser support can be added without redesigning the foundation
