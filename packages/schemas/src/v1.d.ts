export declare const schemaVersion = "v1";
export declare const createSandboxRequestSchema: {
    readonly $id: "sandbox-core/v1/CreateSandboxRequest";
    readonly type: "object";
    readonly additionalProperties: false;
    readonly required: readonly ["environment"];
    readonly properties: {
        readonly backend: {
            readonly type: "string";
        };
        readonly environment: {
            readonly oneOf: readonly [{
                readonly type: "object";
                readonly additionalProperties: false;
                readonly required: readonly ["kind", "template"];
                readonly properties: {
                    readonly kind: {
                        readonly const: "template";
                    };
                    readonly template: {
                        readonly type: "string";
                    };
                    readonly version: {
                        readonly type: "string";
                    };
                    readonly config: {
                        readonly type: "object";
                    };
                };
            }, {
                readonly type: "object";
                readonly additionalProperties: false;
                readonly required: readonly ["kind", "image"];
                readonly properties: {
                    readonly kind: {
                        readonly const: "container";
                    };
                    readonly image: {
                        readonly type: "string";
                    };
                    readonly command: {
                        readonly type: "array";
                        readonly items: {
                            readonly type: "string";
                        };
                    };
                    readonly env: {
                        readonly type: "object";
                        readonly additionalProperties: {
                            readonly type: "string";
                        };
                    };
                    readonly workingDirectory: {
                        readonly type: "string";
                    };
                };
            }];
        };
        readonly labels: {
            readonly type: "object";
            readonly additionalProperties: {
                readonly type: "string";
            };
        };
        readonly metadata: {
            readonly type: "object";
        };
        readonly requestedCapabilities: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
        };
        readonly secrets: {
            readonly type: "array";
            readonly items: {
                readonly type: "object";
                readonly additionalProperties: false;
                readonly required: readonly ["name"];
                readonly properties: {
                    readonly key: {
                        readonly type: "string";
                    };
                    readonly name: {
                        readonly type: "string";
                    };
                    readonly source: {
                        readonly type: "string";
                    };
                    readonly version: {
                        readonly type: "string";
                    };
                };
            };
        };
    };
};
export declare const execRequestSchema: {
    readonly $id: "sandbox-core/v1/ExecRequest";
    readonly type: "object";
    readonly additionalProperties: false;
    readonly required: readonly ["command"];
    readonly properties: {
        readonly args: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
        };
        readonly command: {
            readonly type: "string";
        };
        readonly cwd: {
            readonly type: "string";
        };
        readonly env: {
            readonly type: "object";
            readonly additionalProperties: {
                readonly type: "string";
            };
        };
        readonly stdin: {
            readonly type: "string";
        };
        readonly timeoutMs: {
            readonly type: "number";
        };
    };
};
export declare const sandboxEventSchema: {
    readonly $id: "sandbox-core/v1/SandboxEvent";
    readonly oneOf: readonly [{
        readonly type: "object";
        readonly additionalProperties: false;
        readonly required: readonly ["at", "data", "type"];
        readonly properties: {
            readonly at: {
                readonly type: "string";
            };
            readonly data: {
                readonly type: "string";
            };
            readonly type: {
                readonly enum: readonly ["stdout", "stderr"];
            };
        };
    }, {
        readonly type: "object";
        readonly additionalProperties: false;
        readonly required: readonly ["at", "status", "type"];
        readonly properties: {
            readonly at: {
                readonly type: "string";
            };
            readonly message: {
                readonly type: "string";
            };
            readonly status: {
                readonly type: "string";
            };
            readonly type: {
                readonly const: "status";
            };
        };
    }, {
        readonly type: "object";
        readonly additionalProperties: false;
        readonly required: readonly ["at", "exitCode", "type"];
        readonly properties: {
            readonly at: {
                readonly type: "string";
            };
            readonly exitCode: {
                readonly type: "number";
            };
            readonly type: {
                readonly const: "exit";
            };
        };
    }, {
        readonly type: "object";
        readonly additionalProperties: false;
        readonly required: readonly ["at", "message", "type"];
        readonly properties: {
            readonly at: {
                readonly type: "string";
            };
            readonly code: {
                readonly type: "string";
            };
            readonly message: {
                readonly type: "string";
            };
            readonly retriable: {
                readonly type: "boolean";
            };
            readonly type: {
                readonly const: "error";
            };
        };
    }];
};
//# sourceMappingURL=v1.d.ts.map