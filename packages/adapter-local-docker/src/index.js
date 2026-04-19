"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalDockerBackend = void 0;
exports.createLocalDockerBackend = createLocalDockerBackend;
const core_1 = require("@sandbox-core/core");
class LocalDockerBackend {
    options;
    advertisedCapabilities = ["artifacts", "browser", "durability", "ports"];
    displayName = "Local Docker";
    id = "local-docker";
    constructor(options = {}) {
        this.options = options;
    }
    async create(_request, _context = {}) {
        throw core_1.SandboxError.notImplemented("Local Docker backend execution is not implemented yet.", { backend: this.id });
    }
    async get(_lookup, _context = {}) {
        throw core_1.SandboxError.notImplemented("Local Docker backend lookup is not implemented yet.", { backend: this.id });
    }
}
exports.LocalDockerBackend = LocalDockerBackend;
function createLocalDockerBackend(options = {}) {
    return new LocalDockerBackend(options);
}
//# sourceMappingURL=index.js.map