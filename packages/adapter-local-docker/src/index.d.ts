import type { CreateSandboxRequest, Sandbox, SandboxBackend, SandboxContext, SandboxLookup } from "@sandbox-core/core";
export interface LocalDockerBackendOptions {
    defaultImage?: string;
    dockerBinary?: string;
}
export declare class LocalDockerBackend implements SandboxBackend {
    readonly options: LocalDockerBackendOptions;
    readonly advertisedCapabilities: readonly ["artifacts", "browser", "durability", "ports"];
    readonly displayName = "Local Docker";
    readonly id = "local-docker";
    constructor(options?: LocalDockerBackendOptions);
    create(_request: CreateSandboxRequest, _context?: SandboxContext): Promise<Sandbox>;
    get(_lookup: SandboxLookup, _context?: SandboxContext): Promise<Sandbox | null>;
}
export declare function createLocalDockerBackend(options?: LocalDockerBackendOptions): LocalDockerBackend;
//# sourceMappingURL=index.d.ts.map