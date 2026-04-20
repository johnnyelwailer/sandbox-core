import assert from "node:assert/strict";
import test from "node:test";

import { SandboxError } from "@sandbox-core/core";
import type {
  BrowserSessionRequest,
  ExecRequest,
  Sandbox,
  SandboxStatus
} from "@sandbox-core/core";

export interface SecretResolutionConformanceCase {
  createWithResolver: () => Promise<Sandbox>;
  createWithoutResolver: () => Promise<unknown>;
}

export interface ConformanceSuiteOptions {
  createSandbox: () => Promise<Sandbox>;
  execRequest?: ExecRequest;
  name: string;
  postTerminateStatuses?: SandboxStatus[];
  secretResolution?: SecretResolutionConformanceCase;
  supportsBrowser?: boolean;
  supportsExec?: boolean;
  supportsUploadDownload?: boolean;
  uploadDownloadCase?: {
    content: string;
    destinationPath: string;
    sourcePath: string;
  };
}

export function registerSandboxConformanceSuite(options: ConformanceSuiteOptions): void {
  const postTerminateStatuses = options.postTerminateStatuses ?? ["terminated"];

  test(`${options.name}: inspect includes identity`, async () => {
    const sandbox = await options.createSandbox();
    assert.ok(sandbox.id.length > 0);
    const info = await sandbox.inspect();
    assert.equal(info.id, sandbox.id);
    assert.equal(info.backend, sandbox.backend);
  });

  test(`${options.name}: terminate updates status`, async () => {
    const sandbox = await options.createSandbox();
    await sandbox.terminate();
    const info = await sandbox.inspect();
    assert.ok(postTerminateStatuses.includes(info.status));
  });

  test(`${options.name}: exec contract`, async (context) => {
    if (options.supportsExec === false || options.execRequest === undefined) {
      context.skip("exec conformance disabled for this backend");
      return;
    }

    const sandbox = await options.createSandbox();
    const events = [];
    for await (const event of sandbox.exec(options.execRequest)) {
      events.push(event);
    }

    assert.ok(events.length >= 2);
    assert.equal(events[0]?.type, "status");
    assert.equal(events.at(-1)?.type, "exit");
  });

  test(`${options.name}: upload/download contract`, async (context) => {
    if (options.supportsUploadDownload === false || options.uploadDownloadCase === undefined) {
      context.skip("upload/download conformance disabled for this backend");
      return;
    }

    const sandbox = await options.createSandbox();
    await sandbox.upload({
      content: options.uploadDownloadCase.content,
      destinationPath: options.uploadDownloadCase.destinationPath
    });
    const downloaded = await sandbox.download({
      sourcePath: options.uploadDownloadCase.sourcePath
    });
    assert.equal(
      new TextDecoder().decode(downloaded),
      options.uploadDownloadCase.content
    );
  });

  test(`${options.name}: browser capability contract`, async (context) => {
    if (options.supportsBrowser !== true) {
      context.skip("browser capability not expected for this backend");
      return;
    }

    const sandbox = await options.createSandbox();
    const capability = await sandbox.getCapability("browser");
    assert.ok(capability !== null);

    const session = await capability.acquireSession({
      headless: true
    } satisfies BrowserSessionRequest);

    assert.equal(session.protocol, "playwright");
    assert.ok(session.endpoint.length > 0);
  });

  test(`${options.name}: secrets resolve with resolver`, async (context) => {
    const secretResolution = options.secretResolution;
    if (secretResolution === undefined) {
      context.skip("secret-resolution conformance disabled for this backend");
      return;
    }

    const sandbox = await secretResolution.createWithResolver();
    assert.ok(sandbox.id.length > 0);
    await sandbox.terminate();
  });

  test(`${options.name}: secrets require resolver`, async (context) => {
    const secretResolution = options.secretResolution;
    if (secretResolution === undefined) {
      context.skip("secret-resolution conformance disabled for this backend");
      return;
    }

    await assert.rejects(
      () => secretResolution.createWithoutResolver(),
      (error: unknown) =>
        error instanceof SandboxError && error.code === "secret_resolution_failed"
    );
  });
}
