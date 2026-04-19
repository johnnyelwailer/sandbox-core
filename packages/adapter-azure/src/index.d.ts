import type { CreateSandboxRequest, Sandbox, SandboxBackend, SandboxContext, SandboxLookup } from "@sandbox-core/core";
export interface AzureBackendOptions {
    environmentName?: string;
    region?: string;
    resourceGroup?: string;
}
export declare class AzureBackend implements SandboxBackend {
    readonly options: AzureBackendOptions;
    readonly advertisedCapabilities: readonly ["artifacts", "browser", "durability", "ports"];
    readonly displayName = "Azure";
    readonly id = "azure";
    constructor(options?: AzureBackendOptions);
    create(_request: CreateSandboxRequest, _context?: SandboxContext): Promise<Sandbox>;
    get(_lookup: SandboxLookup, _context?: SandboxContext): Promise<Sandbox | null>;
}
export declare function createAzureBackend(options?: AzureBackendOptions): AzureBackend;
//# sourceMappingURL=index.d.ts.map