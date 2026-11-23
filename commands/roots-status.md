---
description: Show the detected Roots profile, app path, namespace, stack versions and runner commands for the current project
allowed-tools: Bash(node:*), Read
---
# /roots-status

Reports what the plugin detected about this project: layout, profile, app path, namespace, versions, runner and warnings. Read-only.

## What it runs

1. The detector, in text form, from the plugin root:
   `node scripts/detect-roots-project.mjs --format=text`
   Add `--path=$ARGUMENTS` when the user passed a project path.
2. If more detail is needed (full runner table, services, misplaced env file), run the same script with the default `--format=json` and read `apps`, `active`, `runtime` and `warnings`.
3. Run the runner's health command only if the runner is `lando`, `compose` or `ddev`, trimmed to service name and status: Lando `lando info`; Compose `docker compose ps` from the project root (columns service and status, including the health state); DDEV: its status command.

## Output format (at most 20 lines)

```
### Project
Layout: <layout>   Profile: <kind> at <path>   Namespace: <ns>
Flag file: <.roots-stack.json contents or "none">

### Versions
WordPress <x> | PHP <x> | Acorn <x> | ACF Composer / Livewire / Poet <x or "absent">

### Runner
<lando | compose | ddev | none>: wp=<cmd> acorn=<cmd> composer=<cmd> node=<cmd> test=<cmd> cache=<cmd>
Services: <name: up/down>

### Warnings
<detector warnings, or "none">
```

## Instructions

If a value is missing in the JSON, print `unknown` instead of guessing. If the detector reports no Acorn app, say the project is plain WordPress and stop. Never run `wp`, `composer`, `php`, `yarn` or `npm` on the host; use the runner commands the detector printed.
