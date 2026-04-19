import type { CreateSandboxRequest, Sandbox, SandboxBackend, SandboxContext, SandboxLookup } from "./types";
export type BackendSelector = (request: CreateSandboxRequest, backends: ReadonlyMap<string, SandboxBackend>) => string;
export interface SandboxRegistryOptions {
    defaultBackendId?: string;
    selectBackend?: BackendSelector;
}
export declare class SandboxRegistry {
    private readonly backends;
    private readonly defaultBackendId?;
    private readonly selectBackend?;
    constructor(options?: SandboxRegistryOptions);
    register(backend: SandboxBackend): this;
    listBackends(): SandboxBackend[];
    getBackend(id: string): SandboxBackend | null;
    create(request: CreateSandboxRequest, context?: SandboxContext): Promise<Sandbox>;
    get(lookup: SandboxLookup, context?: SandboxContext): Promise<Sandbox | null>;
    private resolveCreateBackend;
}
//# sourceMappingURL=registry.d.ts.map