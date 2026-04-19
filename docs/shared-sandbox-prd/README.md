# Shared Sandbox Foundation PRD

Status: draft

This PRD proposes a shared open source sandbox foundation consumed by both `aloop` and `biwak`.

The foundation is intentionally narrow:

- It is a sandbox layer, not an orchestrator.
- It is library-first, not a control plane product.
- It exposes a portable core contract with optional capabilities.
- It keeps product policy in the consuming product.

## Recommendation in one page

Build a monorepo with:

- a portable `core` package that defines the sandbox contract
- a local Docker adapter
- an Azure-hosted adapter as the fastest production path
- a second non-Azure backend early to prove portability, likely OpenSandbox-backed

Treat the public model as language-agnostic from day one, but ship a TypeScript reference implementation first.

Make browser/computer-use an optional capability, likely standardized around a Playwright-shaped session contract for v1, without baking AI/browser semantics into core.

Make secrets a first-class concern in core, but keep secret policy and provider choice in the consuming product via opaque secret references.

Design for stronger isolation later, including Firecracker/gVisor/Kata-style runtimes, without requiring them in v1.

## Doc map

- [01-problem-and-goals.md](./01-problem-and-goals.md)
- [02-requirements.md](./02-requirements.md)
- [03-architecture.md](./03-architecture.md)
- [04-capabilities-and-api.md](./04-capabilities-and-api.md)
- [05-backend-evaluation.md](./05-backend-evaluation.md)
- [06-roadmap.md](./06-roadmap.md)
- [07-open-questions.md](./07-open-questions.md)

## Working name

The PRD uses `sandbox-core` as a placeholder project name. Naming is out of scope.
