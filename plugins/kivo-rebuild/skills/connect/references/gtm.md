# Tag Manager

Tag Manager holds the tags the live site fires. The survey reads the container to know what tracking must exist on the new site, and setup can prepare a workspace and a version on the new container. A person always publishes.

## Prerequisites

- `gtm.account_id` and `gtm.container_id` in `.rebuild/config.json` (the numbers in the Tag Manager URL, `accounts/<account>/containers/<container>`).
- A service account (`gtm.service_account`, or the fallback described in `gsc.md`) and the Token Creator role for the operator on it. Token minting and scopes are in `gsc.md`.
- The Tag Manager API enabled in the service account's project: `gcloud services enable tagmanager.googleapis.com --project=acme-proj`.

## Paths

1. **MCP.** When a Tag Manager MCP server is connected, list the container's tags, triggers and variables through it. Pass `--mcp=gtm` to `connect.mjs`.
2. **API.** The read test calls the container endpoint. For the survey, read the container's tags, triggers and variables through the same API with the token the script mints.
3. **Manual.** Tag Manager > the container > Admin > Export Container, choose the live version, save the JSON. Read tags, triggers and variables from the file.

## Read test

A `GET` of the container (`accounts/<account>/containers/<container>`).

## Human steps

- `HTTP 403`: Tag Manager > Admin > User Management (container level) > Add > the service account's e-mail > permission Read. For setup, Edit on the new container.
- Publishing: Tag Manager > Workspace > Submit > Publish. The plugin never does this, on purpose.

## Survey checklist

- List every tag with its type, trigger and the vendor ids it carries (analytics, ads, pixels).
- List triggers and variables the tags depend on (data layer events, custom JavaScript).
- Compare with scripts found outside the container: header and footer scripts in theme options, scripts in templates, plugin-injected tags. Each tag outside the container is a parity item in the `tracking` domain.

## Setup actions

Setup uses the write scopes `tagmanager.edit.containers` and `tagmanager.edit.containerversions`. There is no publish operation.

| Operation | Params | Result | Undo |
|---|---|---|---|
| `createWorkspace` | `container` (`accounts/<a>/containers/<c>`), `name` | `workspace` (a path) | Workspaces > the workspace > Delete |
| `createTag` | `workspace`, `tag` (the API's tag body) | `tag` | Delete the tag in the workspace |
| `createVersion` | `workspace`, `name` | `version` | Versions > the version > Delete |

The plugin has no operation to create triggers, so a tag body must reference the id of a trigger that already exists in the container.

Later actions take the workspace from the action that created it:

```json
{ "id": "A2", "provider": "gtm", "op": "createVersion", "resource": "new container",
  "params": { "workspace": { "$from": "A1.workspace" }, "name": "Rebuild baseline" },
  "change": "Creates a version, not published", "undo": "Delete the version in Versions" }
```

The reference is resolved from the result of `A1` when the plan is applied. After apply, tell the person to review the version and publish it themselves.
