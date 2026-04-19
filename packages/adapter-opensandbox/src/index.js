"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenSandboxBackend = void 0;
exports.createOpenSandboxBackend = createOpenSandboxBackend;
const core_1 = require("@sandbox-core/core");
class OpenSandboxBackend {
    options;
    advertisedCapabilities = ["artifacts", "browser", "durability", "ports"];
    displayName = "OpenSandbox";
    id = "opensandbox";
    constructor(options = {}) {
        this.options = options;
    }
    async create(_request, _context = {}) {
        throw core_1.SandboxError.notImplemented("OpenSandbox backend execution is not implemented yet.", { backend: this.id });
    }
    async get(_lookup, _context = {}) {
        throw core_1.SandboxError.notImplemented("OpenSandbox backend lookup is not implemented yet.", { backend: this.id });
    }
}
exports.OpenSandboxBackend = OpenSandboxBackend;
function createOpenSandboxBackend(options = {}) {
    return new OpenSandboxBackend(options);
}
//# sourceMappingURL=index.js.map