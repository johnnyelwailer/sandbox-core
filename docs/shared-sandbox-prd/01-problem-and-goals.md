# Problem And Goals

## Context

`aloop` and `biwak` are different products, but they both need the same underlying primitive:

- create an isolated environment
- run agent-driven work inside it
- stream activity
- move files in and out
- optionally expose browser/computer-use access
- do this locally or on hosted infrastructure without rewriting the product

Today, the risk is that each product builds its own runtime assumptions:

- one product bakes in a local-Docker worldview
- one product bakes in an Azure-hosted worldview
- browser support becomes vendor-specific
- secrets and isolation get solved twice, differently
- portability becomes expensive retrofitting instead of a design property

## Problem statement

Create a shared open source sandbox foundation that abstracts the effective hosting technology behind a common API, while remaining narrow enough that `aloop` and `biwak` can keep their own orchestration, scheduling, workflow, and product semantics.

## Product thesis

The correct shared layer is not "agent platform" and not "hosted sessions product".

The correct shared layer is:

- a portable sandbox contract
- a small library-oriented runtime surface
- a capability model for optional features
- pluggable backend adapters

Everything above that line remains product-specific.

## Goals

### Primary goals

- Define one portable sandbox contract consumed by both products.
- Support at minimum local Docker and Azure-hosted execution.
- Prove portability early with a second non-Azure backend.
- Keep the core library generic enough for coding agents and browser/computer-use workloads.
- Make secrets, isolation boundaries, and streaming part of the design from day one.
- Keep backend-specific assumptions out of the core package.

### Secondary goals

- Be TypeScript-first without making the public model TypeScript-specific.
- Be friendly to future .NET consumers.
- Keep the library open source and useful outside the current two products.
- Preserve a path toward stronger isolation and resumability later.

## Non-goals

- Not a scheduler.
- Not a workflow engine.
- Not a worktree/git abstraction.
- Not a secret-management product.
- Not a browser automation framework.
- Not a SaaS control plane.
- Not a multi-tenant platform in v1.

## Design principles

### 1. Core stays narrow

If a feature is really product policy, it does not belong in core.

### 2. Portability is proven, not asserted

The abstraction is only real if at least two materially different backends exist.

### 3. Capabilities over leakage

Optional features such as browser access, ports, artifacts, and persistence should be expressed as capabilities, not assumed in every backend.

### 4. Consumer owns policy

The foundation resolves primitives. The consuming product decides when and why to use them.

### 5. Backend-specific power is allowed, but contained

Azure-specific features are acceptable inside an Azure adapter package. They are not acceptable in core contracts.
