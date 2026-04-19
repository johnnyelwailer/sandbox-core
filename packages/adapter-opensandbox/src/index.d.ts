import type { CreateSandboxRequest, Sandbox, SandboxBackend, SandboxContext, SandboxLookup } from "@sandbox-core/core";
export interface OpenSandboxBackendOptions {
    apiBaseUrl?: string;
    namespace?: string;
}
export declare class OpenSandboxBackend implements SandboxBackend {
    readonly options: OpenSandboxBackendOptions;
    readonly advertisedCapabilities: readonly ["artifacts", "browser", "durability", "ports"];
    readonly displayName = "OpenSandbox";
    readonly id = "opensandbox";
    constructor(options?: OpenSandboxBackendOptions);
    create(_request: CreateSandboxRequest, _context?: SandboxContext): Promise<Sandbox>;
    get(_lookup: SandboxLookup, _context?: SandboxContext): Promise<Sandbox | null>;
}
export declare function createOpenSandboxBackend(options?: OpenSandboxBackendOptions): OpenSandboxBackend;
//# sourceMappingURL=index.d.ts.map