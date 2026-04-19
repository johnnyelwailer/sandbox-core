"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SandboxClient = void 0;
exports.createSandboxClient = createSandboxClient;
const core_1 = require("@sandbox-core/core");
__exportStar(require("@sandbox-core/core"), exports);
__exportStar(require("@sandbox-core/schemas"), exports);
class SandboxClient {
    registry;
    constructor(options = {}) {
        this.registry = new core_1.SandboxRegistry(options);
    }
    register(backend) {
        this.registry.register(backend);
        return this;
    }
    listBackends() {
        return this.registry.listBackends();
    }
    async create(request, context = {}) {
        return this.registry.create(request, context);
    }
    async get(lookup, context = {}) {
        return this.registry.get(lookup, context);
    }
}
exports.SandboxClient = SandboxClient;
function createSandboxClient(options = {}) {
    return new SandboxClient(options);
}
//# sourceMappingURL=index.js.map