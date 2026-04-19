import { writeFile } from "node:fs/promises";

import { registerSandboxConformanceSuite } from "@sandbox-core/conformance";

import { createLocalDockerBackend } from "./index";
import type { DockerCommandRequest, DockerCommandResult } from "./docker-runner";

function createRunner() {
  return async (request: DockerCommandRequest): Promise<DockerCommandResult> => {
    if (request.args[0] === "run") {
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: request.args.includes("-p") ? "browser-id\n" : "container-id\n",
        timedOut: false
      };
    }

    if (request.args[0] === "port") {
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: "0.0.0.0:49153\n",
        timedOut: false
      };
    }

    if (request.args[0] === "exec") {
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: "ok\n",
        timedOut: false
      };
    }

    if (request.args[0] === "cp") {
      const destination = request.args[2];
      if (destination !== undefined && !destination.includes(":")) {
        await writeFile(destination, "docker-conformance");
      }
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: "",
        timedOut: false
      };
    }

    if (request.args[0] === "inspect") {
      return {
        exitCode: 0,
        signal: null,
        stderr: "",
        stdout: "running\n",
        timedOut: false
      };
    }

    if (request.args[0] === "rm") {
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
    const backend = createLocalDockerBackend({
      browser: {
        enable: true
      },
      idGenerator: () => "conformance",
      runner: createRunner()
    });
    return backend.create({
      environment: {
        image: "alpine:3.20",
        kind: "container"
      }
    });
  },
  execRequest: {
    args: ["ok"],
    command: "echo"
  },
  name: "local-docker",
  supportsBrowser: true,
  supportsExec: true,
  supportsUploadDownload: true,
  uploadDownloadCase: {
    content: "docker-conformance",
    destinationPath: "/tmp/conformance.txt",
    sourcePath: "/tmp/conformance.txt"
  }
});
