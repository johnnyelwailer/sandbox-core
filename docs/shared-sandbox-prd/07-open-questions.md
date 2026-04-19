# Open Questions

These are unresolved by design and should remain explicit.

## 1. Durability scope

Open question:

- should v1 define a minimal reconnect contract only
- or should it also define stronger persistence semantics for filesystem/process/browser state

Current recommendation:

- keep durability backend-specific in v1
- expose capability metadata rather than promise strong portable persistence too early

## 2. Artifact model depth

Open question:

- when does file transfer stop being enough and a richer artifact API become necessary

Current recommendation:

- do not make artifacts a hard v1 core requirement
- leave room for an optional artifact capability

## 3. Browser standardization details

Open question:

- whether to standardize strictly on Playwright protocol first
- or whether to admit multiple session protocol types immediately

Current recommendation:

- start Playwright-shaped
- avoid multiprotocol complexity in the first browser capability

## 4. Strong isolation timing

Open question:

- when to move beyond Docker/container-style isolation for local and hosted execution

Current recommendation:

- design the core model so stronger runtimes can slot in later
- do not block v1 on Firecracker/gVisor/Kata integration

## 5. Library versus future service boundary

Open question:

- whether future adoption pressure will justify a daemon/control-plane transport layer

Current recommendation:

- stay library-first in v1
- keep the schemas and event model transportable so a future service layer is still possible

## 6. Language surface

Open question:

- when to formalize a .NET SDK

Current recommendation:

- make the core schemas stable first
- add .NET once the TypeScript implementation proves the contract

## 7. Template model depth

Open question:

- how far environment templates should go beyond image/base configuration

Current recommendation:

- start with simple named profiles plus explicit specs
- avoid turning templates into a full deployment DSL in v1
