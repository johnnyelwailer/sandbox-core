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
  supportsExec: true,
  supportsUploadDownload: true,
  uploadDownloadCase: {
    content: "memory-conformance",
    destinationPath: "/tmp/conformance.txt",
    sourcePath: "/tmp/conformance.txt"
  }
});
