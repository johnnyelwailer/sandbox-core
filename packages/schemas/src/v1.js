"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sandboxEventSchema = exports.execRequestSchema = exports.createSandboxRequestSchema = exports.schemaVersion = void 0;
exports.schemaVersion = "v1";
exports.createSandboxRequestSchema = {
    $id: "sandbox-core/v1/CreateSandboxRequest",
    type: "object",
    additionalProperties: false,
    required: ["environment"],
    properties: {
        backend: { type: "string" },
        environment: {
            oneOf: [
                {
                    type: "object",
                    additionalProperties: false,
                    required: ["kind", "template"],
                    properties: {
                        kind: { const: "template" },
                        template: { type: "string" },
                        version: { type: "string" },
                        config: { type: "object" }
                    }
                },
                {
                    type: "object",
                    additionalProperties: false,
                    required: ["kind", "image"],
                    properties: {
                        kind: { const: "container" },
                        image: { type: "string" },
                        command: {
                            type: "array",
                            items: { type: "string" }
                        },
                        env: {
                            type: "object",
                            additionalProperties: { type: "string" }
                        },
                        workingDirectory: { type: "string" }
                    }
                }
            ]
        },
        labels: {
            type: "object",
            additionalProperties: { type: "string" }
        },
        metadata: {
            type: "object"
        },
        requestedCapabilities: {
            type: "array",
            items: { type: "string" }
        },
        secrets: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["name"],
                properties: {
                    key: { type: "string" },
                    name: { type: "string" },
                    source: { type: "string" },
                    version: { type: "string" }
                }
            }
        }
    }
};
exports.execRequestSchema = {
    $id: "sandbox-core/v1/ExecRequest",
    type: "object",
    additionalProperties: false,
    required: ["command"],
    properties: {
        args: {
            type: "array",
            items: { type: "string" }
        },
        command: { type: "string" },
        cwd: { type: "string" },
        env: {
            type: "object",
            additionalProperties: { type: "string" }
        },
        stdin: { type: "string" },
        timeoutMs: { type: "number" }
    }
};
exports.sandboxEventSchema = {
    $id: "sandbox-core/v1/SandboxEvent",
    oneOf: [
        {
            type: "object",
            additionalProperties: false,
            required: ["at", "data", "type"],
            properties: {
                at: { type: "string" },
                data: { type: "string" },
                type: {
                    enum: ["stdout", "stderr"]
                }
            }
        },
        {
            type: "object",
            additionalProperties: false,
            required: ["at", "status", "type"],
            properties: {
                at: { type: "string" },
                message: { type: "string" },
                status: { type: "string" },
                type: { const: "status" }
            }
        },
        {
            type: "object",
            additionalProperties: false,
            required: ["at", "exitCode", "type"],
            properties: {
                at: { type: "string" },
                exitCode: { type: "number" },
                type: { const: "exit" }
            }
        },
        {
            type: "object",
            additionalProperties: false,
            required: ["at", "message", "type"],
            properties: {
                at: { type: "string" },
                code: { type: "string" },
                message: { type: "string" },
                retriable: { type: "boolean" },
                type: { const: "error" }
            }
        }
    ]
};
//# sourceMappingURL=v1.js.map