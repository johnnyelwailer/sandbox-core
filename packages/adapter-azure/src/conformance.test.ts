import { registerSandboxConformanceSuite } from "@sandbox-core/conformance";

import { createAzureBackend } from "./index";
import type { AzureCommandRequest, AzureCommandResult } from "./azure-runner";

function createRunner() {
  return async (request: AzureCommandRequest): Promise<AzureCommandResult> => {
    if (request.args[0] === "container" && request.args[1] === "create") {
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: "{}",
        timedOut: false
      };
    }

    if (request.args[0] === "container" && request.args[1] === "show") {
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: JSON.stringify({
          instanceView: {
            state: "Running"
          }
        }),
        timedOut: false
      };
    }

    if (request.args[0] === "container" && request.args[1] === "exec") {
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: "ok\n__SC_EXIT_CODE__=0\n",
        timedOut: false
      };
    }

    if (request.args[0] === "container" && request.args[1] === "delete") {
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: "",
        timedOut: false
      };
    }

    return {
      exitCode: 0,
      signal: null,
      stderr: "",
      stdout: "",
      timedOut: false
    };
  };
}

registerSandboxConformanceSuite({
  createSandbox: async () => {
    const backend = createAzureBackend({
      idGenerator: () => "conformance",
      resourceGroup: "rg-test",
      runner: createRunner()
    });
    return backend.create({
      environment: {
        image: "mcr.microsoft.com/azurelinux/base/core:3.0",
        kind: "container"
      }
    });
  },
  execRequest: {
    args: ["ok"],
    command: "echo"
  },
  name: "azure",
  secretResolution: {
    createWithResolver: async () => {
      const backend = createAzureBackend({
        idGenerator: () => "conformance-secret-ok",
        resourceGroup: "rg-test",
        runner: createRunner()
      });
      return backend.create(
        {
          environment: {
            image: "mcr.microsoft.com/azurelinux/base/core:3.0",
            kind: "container"
          },
          secrets: [{ name: "API_KEY", source: "test" }]
        },
        {
          resolveSecret: async (secretRef) => ({
            name: secretRef.name,
            value: "azure-secret"
          })
        }
      );
    },
    createWithoutResolver: async () => {
      const backend = createAzureBackend({
        idGenerator: () => "conformance-secret-missing",
        resourceGroup: "rg-test",
        runner: createRunner()
      });
      return backend.create({
        environment: {
          image: "mcr.microsoft.com/azurelinux/base/core:3.0",
          kind: "container"
        },
        secrets: [{ name: "MISSING_SECRET" }]
      });
    }
  },
  supportsExec: true,
  supportsUploadDownload: false
});
