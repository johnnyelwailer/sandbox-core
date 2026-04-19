import { spawn } from "node:child_process";

export interface AzureCommandRequest {
  args: string[];
  stdin?: string | Uint8Array;
  timeoutMs?: number;
}

export interface AzureCommandResult {
  exitCode: number;
  signal: NodeJS.Signals | null;
  stderr: string;
  stdout: string;
  timedOut: boolean;
}

export type AzureCommandRunner = (
  request: AzureCommandRequest
) => Promise<AzureCommandResult>;

export function createAzureCommandRunner(azBinary: string): AzureCommandRunner {
  return async (request: AzureCommandRequest): Promise<AzureCommandResult> =>
    new Promise((resolve, reject) => {
      const child = spawn(azBinary, request.args, {
        stdio: "pipe"
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let timeoutHandle: NodeJS.Timeout | undefined;

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });

      child.on("error", (error) => {
        if (timeoutHandle !== undefined) {
          clearTimeout(timeoutHandle);
        }
        reject(error);
      });

      child.on("close", (code, signal) => {
        if (timeoutHandle !== undefined) {
          clearTimeout(timeoutHandle);
        }
        resolve({
          exitCode: code ?? 1,
          signal,
          stderr,
          stdout,
          timedOut
        });
      });

      if (request.timeoutMs !== undefined && request.timeoutMs > 0) {
        timeoutHandle = setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, request.timeoutMs);
      }

      if (request.stdin !== undefined) {
        child.stdin.write(request.stdin);
      }
      child.stdin.end();
    });
}
