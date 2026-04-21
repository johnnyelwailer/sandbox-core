# @sandbox-core/adapter-azure

Azure backend for `sandbox-core`.

Current behavior:

- create/get/inspect/terminate sandboxes using Azure Container Instances via `az` CLI
- run commands with streamed status/stdout/stderr/exit events
- upload and download files through base64 transport over `az container exec`
- optional secret resolution through `SandboxContext.resolveSecret`

Requirements:

- Azure CLI (`az`) installed and authenticated
- a target resource group (option or `AZURE_RESOURCE_GROUP`)

Tests:

- fast unit tests run through root `npm test`
- optional infrastructure test:
  - `npm run test:azure`
  - requires `RUN_AZURE_TESTS=1` (set by script), authenticated `az`, and `AZURE_RESOURCE_GROUP`
  - convenience command: `npm run test:azure:infra` (creates/deletes a temporary resource group automatically)
