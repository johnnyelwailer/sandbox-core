"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SandboxError = void 0;
class SandboxError extends Error {
    code;
    details;
    constructor(options) {
        super(options.message);
        this.name = "SandboxError";
        this.code = options.code;
        this.details = options.details;
        if (options.cause !== undefined) {
            this.cause = options.cause;
        }
    }
    static notImplemented(message, details) {
        return new SandboxError({
            code: "not_implemented",
            message,
            details
        });
    }
}
exports.SandboxError = SandboxError;
//# sourceMappingURL=errors.js.map