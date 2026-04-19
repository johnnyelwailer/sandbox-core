"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureBackend = void 0;
exports.createAzureBackend = createAzureBackend;
const core_1 = require("@sandbox-core/core");
class AzureBackend {
    options;
    advertisedCapabilities = ["artifacts", "browser", "durability", "ports"];
    displayName = "Azure";
    id = "azure";
    constructor(options = {}) {
        this.options = options;
    }
    async create(_request, _context = {}) {
        throw core_1.SandboxError.notImplemented("Azure backend execution is not implemented yet.", { backend: this.id });
    }
    async get(_lookup, _context = {}) {
        throw core_1.SandboxError.notImplemented("Azure backend lookup is not implemented yet.", { backend: this.id });
    }
}
exports.AzureBackend = AzureBackend;
function createAzureBackend(options = {}) {
    return new AzureBackend(options);
}
//# sourceMappingURL=index.js.map