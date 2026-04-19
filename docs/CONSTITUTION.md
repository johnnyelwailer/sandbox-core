# Constitution

Status: active

This document defines the engineering rules for `sandbox-core`.

The point is not to collect generic software slogans. The point is to make design and review decisions consistent, especially while the project is still in greenfield mode.

## 1. Phase rule: greenfield first

Until the project reaches an explicitly declared stable public release, the default posture is:

- break fast
- delete aggressively
- do not preserve legacy behavior
- do not carry compatibility shims
- do not keep dead abstractions around "just in case"

If a design is wrong, remove it and replace it. Do not build migration burden into an unstable system.

Backward compatibility is **not** a goal in the greenfield phase.

Corollary:

- breaking changes are allowed and expected
- internal APIs may change freely
- package structure may change freely
- stale code should be removed immediately, not deprecated for later cleanup

Once a stable release exists, compatibility rules can be introduced deliberately. Until then, the correct behavior is to optimize for clarity and speed of convergence.

## 2. Scope

This repository is a shared sandbox foundation.

It is:

- a portable sandbox contract
- a TypeScript-first reference implementation
- a collection of backend adapters

It is not:

- a scheduler
- a workflow engine
- a product-specific orchestration layer
- a git/worktree abstraction
- a secret-management product

## 3. Architecture boundaries

### Core stays backend-neutral

`packages/core` must not import vendor or cloud SDKs.

Vendor-specific behavior belongs in adapter packages only.

### Product policy stays outside core

Consumer products decide:

- backend selection policy
- scheduling
- workflow semantics
- task routing
- secret policy

Core provides primitives, not product behavior.

### Capabilities over leakage

Optional features must be modeled as capabilities, not assumed unconditionally.

Unsupported capability paths must fail explicitly and predictably.

## 4. Code structure

### Prefer locality over premature sharing

Keep code close to the package and feature that owns it.

Do not extract shared helpers on first duplication. A small amount of duplication is preferable to a false abstraction.

### No boundary violations

- no cross-package reach-through imports
- no cyclic package dependencies
- no imports from another package's internal files

Packages communicate through their public entry points.

### Small units by default

Prefer:

- small files
- small interfaces
- narrow modules
- functions that fit on one screen

`~150 LOC` is a review warning sign, not an absolute law. If a file grows larger, either the shape is still obviously coherent or it should be split.

## 5. Testing

### Core changes are test-first by default

TDD is the preferred mode for core contract and behavior changes.

### Every bug fix gets a regression test

If a bug was real enough to fix, it is real enough to encode.

### Shared behavior needs shared tests

If behavior is meant to hold across backends, it belongs in conformance or contract tests, not only in adapter-local tests.

### Negative paths matter

Unsupported capabilities, invalid requests, missing secrets, and backend failures require explicit tests.

## 6. API and schema rules

### Public contracts are explicit

Request, event, and error shapes must be modeled intentionally and updated alongside implementation changes.

### No magic behavior

Important runtime behavior should not hide behind surprising defaults.

### Stable later, not now

Before stable release:

- change contracts freely when needed
- remove obsolete fields immediately
- do not keep compatibility aliases

After stable release:

- version public breakage deliberately
- add migration notes when needed

## 7. Security

### Secrets must not leak

- no raw secrets in logs
- no raw secrets in error messages
- no raw secrets committed to the repo
- prefer secret references over direct secret values in normal flows

### Isolation must be documented honestly

Backends must describe what isolation they actually provide. Do not imply stronger guarantees than the runtime really offers.

### Unsafe fallback must never be silent

If a secure or isolated path is unavailable, the system must not quietly downgrade behavior without making that explicit.

## 8. Operational semantics

### Streaming is first-class

Long-running operations should expose progress through streaming/evented interfaces where practical.

### Cancellation and failure are real states

Timeout, cancellation, unsupported capability, and backend unavailability must be modeled explicitly.

### Capability absence is normal

Not every backend will support every feature. The model must represent absence directly instead of hiding it with backend-specific hacks.

## 9. Portability

The abstraction is only real if materially different backends can implement it.

Therefore:

- core must not drift toward the first production backend
- local and hosted backends should aim for semantic parity
- portability claims should be proven through actual adapter implementations

## 10. Documentation

Documentation is part of the product surface.

Required behavior:

- update docs when core contracts change
- keep package-level intent documented
- keep the PRD and constitution aligned with the codebase

## 11. Review heuristics

In review, prefer these questions over generic taste arguments:

- does this leak backend assumptions into core?
- does this add product policy where a primitive should exist?
- does this introduce a false abstraction?
- does this make deletion harder later?
- does this preserve legacy behavior we should remove instead?
- does this keep secrets and isolation boundaries honest?

If the answer is bad, the change should be simplified or rejected.
