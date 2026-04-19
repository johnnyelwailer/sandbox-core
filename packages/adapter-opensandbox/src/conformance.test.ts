import { registerSandboxConformanceSuite } from "@sandbox-core/conformance";

import { createOpenSandboxBackend } from "./index";
import type {
  OpenSandboxRequest,
  OpenSandboxResponse
} from "./transport";

function createTransport() {
  const files = new Map<string, string>();
  let deleted = false;

  return async (request: OpenSandboxRequest): Promise<OpenSandboxResponse> => {
    if (request.method === "POST" && request.path === "/sandboxes") {
      return {
        body: {
          id: "opensb-conformance",
          status: "running"
        },
        status: 201
      };
    }

    if (request.method === "GET" && request.path === "/sandboxes/opensb-conformance") {
      if (deleted) {
        return {
          status: 404
        };
      }
      return {
        body: {
          id: "opensb-conformance",
          status: "running"
        },
        status: 200
      };
    }

    if (request.method === "POST" && request.path === "/sandboxes/opensb-conformance/exec") {
      return {
        body: {
          exitCode: 0,
          stderr: "",
          stdout: "ok"
        },
        status: 200
      };
    }

    if (request.method === "PUT" && request.path === "/sandboxes/opensb-conformance/files") {
      const path = request.query?.["path"] ?? "";
      const payload = request.body as { contentBase64?: string };
      files.set(path, payload.contentBase64 ?? "");
      return { status: 204 };
    }

    if (request.method === "GET" && request.path === "/sandboxes/opensb-conformance/files") {
      const path = request.query?.["path"] ?? "";
      return {
        body: {
          contentBase64: files.get(path) ?? ""
        },
        status: 200
      };
    }

    if (request.method === "DELETE" && request.path === "/sandboxes/opensb-conformance") {
      deleted = true;
      return {
        status: 204
      };
    }

    return {
      status: 404
    };
  };
}

registerSandboxConformanceSuite({
  createSandbox: async () => {
    const backend = createOpenSandboxBackend({
      transport: createTransport()
    });
    return backend.create({
      environment: {
        image: "ubuntu:24.04",
        kind: "container"
      }
    });
  },
  execRequest: {
    args: ["ok"],
    command: "echo"
  },
  name: "opensandbox",
  supportsExec: true,
  supportsUploadDownload: true,
  uploadDownloadCase: {
    content: "opensandbox-conformance",
    destinationPath: "/tmp/conformance.txt",
    sourcePath: "/tmp/conformance.txt"
  }
});
