export type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | {
    [key: string]: JsonValue;
};
export type SandboxCapabilityName = "artifacts" | "browser" | "durability" | "networkPolicy" | "ports" | (string & {});
export type SandboxErrorCode = "backend_not_found" | "backend_unavailable" | "capability_not_supported" | "execution_failed" | "file_transfer_failed" | "invalid_request" | "not_implemented" | "reconnect_not_supported" | "secret_resolution_failed" | "timeout";
export type SandboxStatus = "creating" | "failed" | "ready" | "running" | "terminating" | "terminated";
export interface SecretRef {
    name: string;
    source?: string;
    key?: string;
    version?: string;
}
export interface ResolvedSecret {
    name: string;
    value: string;
    redactionHint?: string;
}
export interface TemplateEnvironmentSpec {
    kind: "template";
    template: string;
    version?: string;
    config?: Record<string, JsonValue>;
}
export interface ContainerEnvironmentSpec {
    kind: "container";
    image: string;
    command?: string[];
    env?: Record<string, string>;
    workingDirectory?: string;
}
export type EnvironmentSpec = ContainerEnvironmentSpec | TemplateEnvironmentSpec;
export interface SandboxCapabilityDescriptor {
    name: SandboxCapabilityName;
    metadata?: Record<string, JsonValue>;
}
export interface CreateSandboxRequest {
    backend?: string;
    environment: EnvironmentSpec;
    labels?: Record<string, string>;
    metadata?: Record<string, JsonValue>;
    requestedCapabilities?: SandboxCapabilityName[];
    secrets?: SecretRef[];
}
export interface SandboxLookup {
    id: string;
    backend?: string;
}
export interface ExecRequest {
    command: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    stdin?: string;
    timeoutMs?: number;
}
export interface UploadRequest {
    destinationPath: string;
    content: string | Uint8Array;
    makeParents?: boolean;
    mode?: string;
}
export interface DownloadRequest {
    sourcePath: string;
}
export interface PortBinding {
    containerPort: number;
    hostPort?: number;
    protocol?: "tcp" | "udp";
}
export interface SandboxArtifactDescriptor {
    id: string;
    label?: string;
    mediaType?: string;
    sizeBytes?: number;
    metadata?: Record<string, JsonValue>;
}
export interface BrowserSessionRequest {
    headless?: boolean;
    viewport?: {
        height: number;
        width: number;
    };
}
export interface BrowserSession {
    protocol: "playwright" | (string & {});
    endpoint: string;
    liveViewUrl?: string;
    metadata?: Record<string, JsonValue>;
}
export interface BrowserCapability {
    acquireSession(request?: BrowserSessionRequest): Promise<BrowserSession>;
}
export interface ArtifactCapability {
    getArtifact(id: string): Promise<Uint8Array>;
    listArtifacts(): Promise<SandboxArtifactDescriptor[]>;
}
export interface DurabilityCapability {
    inspectDurability(): Promise<SandboxDurability>;
}
export interface NetworkPolicyCapability {
    getPolicy(): Promise<Record<string, JsonValue>>;
}
export interface PortsCapability {
    listPorts(): Promise<PortBinding[]>;
}
export interface SandboxCapabilityMap {
    artifacts: ArtifactCapability;
    browser: BrowserCapability;
    durability: DurabilityCapability;
    networkPolicy: NetworkPolicyCapability;
    ports: PortsCapability;
}
export interface SandboxDurability {
    browserState: boolean;
    filesystemState: boolean;
    processState: boolean;
    reconnectable: boolean;
}
export interface SandboxInfo {
    backend: string;
    capabilities: SandboxCapabilityDescriptor[];
    createdAt: string;
    durability: SandboxDurability;
    id: string;
    labels?: Record<string, string>;
    metadata?: Record<string, JsonValue>;
    status: SandboxStatus;
    updatedAt?: string;
}
export type SandboxEvent = {
    at: string;
    data: string;
    type: "stderr" | "stdout";
} | {
    at: string;
    message?: string;
    status: SandboxStatus;
    type: "status";
} | {
    at: string;
    exitCode: number;
    type: "exit";
} | {
    at: string;
    detail?: string;
    type: "heartbeat";
} | {
    at: string;
    code: SandboxErrorCode | (string & {});
    message: string;
    retriable?: boolean;
    type: "error";
};
export interface Sandbox {
    readonly backend: string;
    readonly capabilities: SandboxCapabilityDescriptor[];
    readonly id: string;
    download(request: DownloadRequest): Promise<Uint8Array>;
    exec(request: ExecRequest): AsyncIterable<SandboxEvent>;
    getCapability<Name extends keyof SandboxCapabilityMap>(name: Name): Promise<SandboxCapabilityMap[Name] | null>;
    inspect(): Promise<SandboxInfo>;
    terminate(): Promise<void>;
    upload(request: UploadRequest): Promise<void>;
}
export interface SandboxContext {
    resolveSecret?: (ref: SecretRef) => Promise<ResolvedSecret | null>;
}
export interface SandboxBackend {
    readonly advertisedCapabilities: SandboxCapabilityName[];
    readonly displayName: string;
    readonly id: string;
    create(request: CreateSandboxRequest, context?: SandboxContext): Promise<Sandbox>;
    get(lookup: SandboxLookup, context?: SandboxContext): Promise<Sandbox | null>;
}
//# sourceMappingURL=types.d.ts.map