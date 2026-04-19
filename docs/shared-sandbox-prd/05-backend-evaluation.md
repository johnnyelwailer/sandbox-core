# Backend Evaluation

## Summary recommendation

Use:

- Azure-hosted backend as the fastest path to a usable hosted implementation
- OpenSandbox or an equivalent non-Azure backend early to prove the abstraction
- local Docker as the baseline developer backend

Do not let the Azure backend define the core contract.

## Evaluation criteria

- speed to first production use
- portability
- isolation model
- support for long-running disposable sessions
- browser/computer-use friendliness
- secrets handling options
- local developer experience
- future path to stronger isolation

## Candidate: Azure Container Apps sessions

Strengths:

- strong fastest-path candidate for a hosted backend
- fits existing Azure usage and credits
- managed operational surface
- good match for ephemeral or bounded session-oriented workloads

Weaknesses:

- Azure-specific semantics and operational model
- risk of core API drift toward Azure concepts if used as the reference contract
- may not be the cleanest portability proof across local Docker and Kubernetes-style backends

Verdict:

- strong adapter candidate
- poor choice for defining the portable core abstraction

## Candidate: Azure Container Apps jobs

Strengths:

- useful for scheduled or job-style execution
- fits Azure-first operational path

Weaknesses:

- more job-oriented than interactive sandbox-oriented
- weaker fit for reusable session semantics and streaming command surfaces

Verdict:

- useful secondary Azure execution primitive
- not the ideal conceptual center of the shared foundation

## Candidate: OpenSandbox

Strengths:

- closest match to the desired portability story
- works across Docker and Kubernetes-style infrastructure
- already oriented around sandbox lifecycle, execution, and isolation concerns
- better architectural proof that the abstraction is real

Weaknesses:

- more integration work than simply binding to one cloud-native managed service
- potentially less turnkey than Azure for the first hosted path

Verdict:

- strongest portability-proof backend
- should be implemented early, even if not the very first production backend

## Candidate: Modal Sandboxes

Strengths:

- polished hosted developer experience
- strong sandbox model

Weaknesses:

- managed-vendor dependency
- not aligned with the desire to keep a portable open core

Verdict:

- useful market reference
- not recommended as the primary foundation

## Candidate: E2B

Strengths:

- strong DX for AI-oriented hosted sandboxes
- validates that this problem category is real

Weaknesses:

- managed-product dependency
- portability constraints relative to self-owned runtime backends

Verdict:

- useful comparator
- not recommended as the core shared substrate

## Browser/computer-use landscape

Recommendation:

- standardize browser capability at the contract layer
- likely use a Playwright-shaped session endpoint as the first standard
- keep Browserbase, Steel, or similar vendors as optional adapters later

Rationale:

- Playwright is the most practical common denominator across local and hosted environments
- higher-level AI/browser stacks should sit above the shared foundation, not inside it

## Recommended backend order

### V1 baseline

- `adapter-local-docker`
- `adapter-azure`

### V1 portability proof

- `adapter-opensandbox`

### Later

- stronger-isolation backend
- richer browser-specific backend adapters

## Decision

Recommendation:

- use Azure for speed
- use OpenSandbox to keep yourselves honest
- use Docker locally

This gives you one practical path and one architectural check at the same time.
