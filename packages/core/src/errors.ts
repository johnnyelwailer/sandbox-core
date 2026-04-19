import type { JsonValue, SandboxErrorCode } from "./types";

export interface SandboxErrorOptions {
  code: SandboxErrorCode;
  message: string;
  details?: Record<string, JsonValue>;
  cause?: unknown;
}

export class SandboxError extends Error {
  readonly code: SandboxErrorCode;
  readonly details?: Record<string, JsonValue>;

  constructor(options: SandboxErrorOptions) {
    super(options.message);
    this.name = "SandboxError";
    this.code = options.code;
    this.details = options.details;
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }

  static notImplemented(message: string, details?: Record<string, JsonValue>): SandboxError {
    return new SandboxError({
      code: "not_implemented",
      message,
      details
    });
  }
}
