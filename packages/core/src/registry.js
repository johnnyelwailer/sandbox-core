"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SandboxRegistry = void 0;
const errors_1 = require("./errors");
class SandboxRegistry {
    backends = new Map();
    defaultBackendId;
    selectBackend;
    constructor(options = {}) {
        this.defaultBackendId = options.defaultBackendId;
        this.selectBackend = options.selectBackend;
    }
    register(backend) {
        this.backends.set(backend.id, backend);
        return this;
    }
    listBackends() {
        return [...this.backends.values()];
    }
    getBackend(id) {
        return this.backends.get(id) ?? null;
    }
    async create(request, context = {}) {
        const backend = this.resolveCreateBackend(request);
        return backend.create(request, context);
    }
    async get(lookup, context = {}) {
        if (lookup.backend !== undefined) {
            const backend = this.backends.get(lookup.backend);
            if (backend === undefined) {
                throw new errors_1.SandboxError({
                    code: "backend_not_found",
                    message: `Sandbox backend '${lookup.backend}' is not registered.`,
                    details: { backend: lookup.backend }
                });
            }
            return backend.get(lookup, context);
        }
        for (const backend of this.backends.values()) {
            const sandbox = await backend.get(lookup, context);
            if (sandbox !== null) {
                return sandbox;
            }
        }
        return null;
    }
    resolveCreateBackend(request) {
        const requestedBackend = request.backend;
        if (requestedBackend !== undefined) {
            const backend = this.backends.get(requestedBackend);
            if (backend === undefined) {
                throw new errors_1.SandboxError({
                    code: "backend_not_found",
                    message: `Sandbox backend '${requestedBackend}' is not registered.`,
                    details: { backend: requestedBackend }
                });
            }
            return backend;
        }
        if (this.selectBackend !== undefined) {
            const selectedId = this.selectBackend(request, this.backends);
            const selectedBackend = this.backends.get(selectedId);
            if (selectedBackend === undefined) {
                throw new errors_1.SandboxError({
                    code: "backend_not_found",
                    message: `Selected sandbox backend '${selectedId}' is not registered.`,
                    details: { backend: selectedId }
                });
            }
            return selectedBackend;
        }
        if (this.defaultBackendId !== undefined) {
            const defaultBackend = this.backends.get(this.defaultBackendId);
            if (defaultBackend === undefined) {
                throw new errors_1.SandboxError({
                    code: "backend_not_found",
                    message: `Default sandbox backend '${this.defaultBackendId}' is not registered.`,
                    details: { backend: this.defaultBackendId }
                });
            }
            return defaultBackend;
        }
        throw new errors_1.SandboxError({
            code: "invalid_request",
            message: "No sandbox backend was specified or configured.",
            details: { reason: "missing_backend_selection" }
        });
    }
}
exports.SandboxRegistry = SandboxRegistry;
//# sourceMappingURL=registry.js.map