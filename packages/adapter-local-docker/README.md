# @sandbox-core/adapter-local-docker

Local Docker backend for `sandbox-core`.

Current behavior:

- create/get/inspect/terminate sandboxes using Docker containers
- run commands with streamed status/stdout/stderr/exit events
- upload and download files with `docker cp`
- optional secret resolution through `SandboxContext.resolveSecret`

Notes:

- this adapter uses the local `docker` CLI
- durability is process-local plus reconnect by sandbox id
- browser/artifact capabilities are not implemented yet
