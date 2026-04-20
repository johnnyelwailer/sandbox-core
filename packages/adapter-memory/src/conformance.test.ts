import { registerSandboxConformanceSuite } from "@sandbox-core/conformance";

import { createMemoryBackend } from "./index";

registerSandboxConformanceSuite({
  createSandbox: async () => {
    const backend = createMemoryBackend();
    return backend.create({
      environment: {
        kind: "template",
        template: "default"
      }
    });
  },
  execRequest: {
    args: ["hello"],
    command: "echo"
  },
  name: "memory",
  secretResolution: {
    createWithResolver: async () => {
      const backend = createMemoryBackend();
      return backend.create(
        {
          environment: {
            kind: "template",
            template: "default"
          },
          secrets: [{ name: "API_KEY", source: "test" }]
        },
        {
          resolveSecret: async (secretRef) => ({
            name: secretRef.name,
            value: "memory-secret"
          })
        }
      );
    },
    createWithoutResolver: async () => {
      const backend = createMemoryBackend();
      return backend.create({
        environment: {
          kind: "template",
          template: "default"
        },
        secrets: [{ name: "MISSING_SECRET" }]
      });
    }
  },
  supportsExec: true,
  supportsUploadDownload: true,
  uploadDownloadCase: {
    content: "memory-conformance",
    destinationPath: "/tmp/conformance.txt",
    sourcePath: "/tmp/conformance.txt"
  }
});
