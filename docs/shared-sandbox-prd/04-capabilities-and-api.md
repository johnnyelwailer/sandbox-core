# Capabilities And API

## API style recommendation

Primary experience:

- library-first object model

Primary streaming pattern:

- `AsyncIterable`

Reason:

- natural fit for TypeScript
- maps cleanly to long-running exec and event streams
- keeps the first consumer experience compact

## Example conceptual API

```ts
type SandboxCapability =
  | "browser"
  | "ports"
  | "artifacts"
  | "durability";

type SandboxRef = {
  id: string;
  backend: string;
  capabilities: SandboxCapability[];
};

interface SandboxManager {
  create(request: CreateSandboxRequest): Promise<Sandbox>;
  get(ref: SandboxLookup): Promise<Sandbox | null>;
}

interface Sandbox {
  readonly id: string;
  readonly backend: string;
  readonly capabilities: SandboxCapability[];

  exec(request: ExecRequest): AsyncIterable<SandboxEvent>;
  upload(request: UploadRequest): Promise<void>;
  download(request: DownloadRequest): Promise<Uint8Array | ReadableStream>;
  terminate(request?: TerminateRequest): Promise<void>;
  inspect(): Promise<SandboxInfo>;
}
```

This is illustrative only. The public contract should be formalized in schemas, not just in TS types.

## Recommended core concepts

### `Sandbox`

Represents an isolated execution environment.

### `EnvironmentSpec`

Supports both:

- named profile reference
- explicit image/container spec

### `ExecRequest`

Should support:

- command
- args
- cwd
- env overrides
- secret refs
- stdin mode
- timeout

### `SandboxEvent`

Suggested event categories:

- `stdout`
- `stderr`
- `status`
- `exit`
- `error`
- `heartbeat`

### `SandboxInfo`

Should include:

- backend identity
- status
- declared capabilities
- lifecycle timestamps
- reconnectability hints
- backend-reported persistence properties

## Capability recommendations

### Browser capability

Not required in core v1, but the contract should be ready for:

```ts
interface BrowserCapability {
  acquireSession(request?: BrowserSessionRequest): Promise<BrowserSession>;
}
```

Where `BrowserSession` likely includes:

- protocol type
- connection endpoint
- optional live-view URL
- optional trace/video metadata

### Artifact capability

Recommended, not required in core v1.

Reason:

- products may manage many outputs themselves
- some backends will naturally support richer artifact handling
- forcing a full artifact model too early risks overdesign

Still, the PRD recommends leaving room for:

- publish named artifact
- list artifacts
- fetch artifact stream or URL

### Durability capability

Durability should be an advertised capability, not an assumption.

Examples:

- backend supports reconnect to existing sandbox
- backend preserves filesystem state
- backend preserves process state
- backend preserves browser state

Consumers can inspect and choose how much to depend on it.

## Error model

Core should define stable, portable error categories such as:

- unsupported capability
- invalid environment spec
- backend unavailable
- execution failed
- secret resolution failed
- timeout
- file transfer failed
- reconnect not supported

Avoid leaking vendor-specific SDK errors into the public contract.
