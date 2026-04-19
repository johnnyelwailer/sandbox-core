import type { BackendSelector, CreateSandboxRequest, Sandbox, SandboxBackend, SandboxContext, SandboxLookup, SandboxRegistryOptions } from "@sandbox-core/core";
export * from "@sandbox-core/core";
export * from "@sandbox-core/schemas";
export interface SandboxClientOptions extends SandboxRegistryOptions {
}
export declare class SandboxClient {
    private readonly registry;
    constructor(options?: SandboxClientOptions);
    register(backend: SandboxBackend): this;
    listBackends(): SandboxBackend[];
    create(request: CreateSandboxRequest, context?: SandboxContext): Promise<Sandbox>;
    get(lookup: SandboxLookup, context?: SandboxContext): Promise<Sandbox | null>;
}
export declare function createSandboxClient(options?: SandboxClientOptions): SandboxClient;
export type { BackendSelector };
//# sourceMappingURL=index.d.ts.map