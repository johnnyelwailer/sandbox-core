import type { JsonValue, SandboxErrorCode } from "./types";
export interface SandboxErrorOptions {
    code: SandboxErrorCode;
    message: string;
    details?: Record<string, JsonValue>;
    cause?: unknown;
}
export declare class SandboxError extends Error {
    readonly code: SandboxErrorCode;
    readonly details?: Record<string, JsonValue>;
    constructor(options: SandboxErrorOptions);
    static notImplemented(message: string, details?: Record<string, JsonValue>): SandboxError;
}
//# sourceMappingURL=errors.d.ts.map