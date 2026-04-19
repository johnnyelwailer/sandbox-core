# Requirements

## Functional requirements

### Core sandbox lifecycle

The foundation must support:

- create sandbox
- inspect sandbox metadata and status
- acquire capabilities
- execute commands
- stream command output
- read and write files
- list files or transfer files
- terminate sandbox

### Environment definition

The consuming product must be able to define environments through:

- named templates or profiles
- explicit container/image specs

Both forms are needed:

- profiles for reuse and consistency
- raw specs for advanced callers and backend-specific tuning

### Streaming

Streaming should be first-class in v1.

Primary model:

- `AsyncIterable`-style streams for command output and event streams

Reason:

- good fit for TypeScript
- maps cleanly to long-running commands
- easier to keep library-first than forcing a daemon protocol immediately

### Secrets

Secrets are a hard requirement, not a later enhancement.

V1 should support:

- opaque secret references in requests
- scoped environment injection into sandboxes
- log/output redaction hooks
- explicit separation between secret reference and resolved material

V1 should not require:

- first-class support for external secret manager vendors in core

### Browser/computer-use

Browser support matters, but it does not need to be in the first thin slice.

Requirement:

- the core contract must be designed so browser support can be added as an optional capability without breaking the model

Likely v1.1 capability:

- acquire browser session
- return connection endpoint and protocol metadata
- expose optional browser artifacts such as screenshots, traces, or video

### Files and artifacts

Artifacts should be recommended, not mandatory, in v1 core.

However, the core should support enough file movement that products are not forced to bypass the abstraction immediately.

Minimum expectation:

- upload file or directory content into sandbox
- download file or directory content from sandbox
- optional backend capability for named artifacts and metadata

### Backend selection

The system should support both:

- policy-driven backend selection by the host product
- explicit per-request override for debugging, rollout, or special workload routing

## Non-functional requirements

### Setup experience

Single-tenant setup must be tractable.

Implications:

- local mode cannot require Kubernetes
- hosted mode cannot require the consumer to adopt a full control plane
- the adapter model must not bury basic execution behind excessive infrastructure

### Behavioral parity

Local and hosted backends should aim for semantic parity:

- same core object model
- same capability discovery model
- same error model

They do not need implementation parity.

### Isolation

V1 isolation should be good enough for single-tenant agent workloads.

Acceptable initial posture:

- local Docker-based isolation
- hosted-container isolation

Design requirement:

- stronger isolation runtimes such as Firecracker/gVisor/Kata must be able to slot in later without changing the public core model

### Durability and persistence

Durability is important, but forcing one persistence model into core would overreach.

Requirement:

- core contract must represent durable handles and reconnectable metadata where supported
- backend adapters may differ in whether they support true durability, reuse, or reconnect
- consumers may plug in their own persistence/session registry layer

### Language strategy

The first implementation can be TypeScript-first.

The public contract should still be expressible as:

- language-agnostic schemas
- stable request/response/event shapes
- backend-independent error categories
