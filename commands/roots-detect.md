---
description: Run the Roots project detector and, with --write, save the detected profile to .roots-stack.json
argument-hint: "[--write] [--path=<project>]"
disable-model-invocation: true
allowed-tools: Bash(node:*), Read, Write
---
# /roots-detect

Runs the detector and shows the full result. With `--write` it saves the detected profile to `.roots-stack.json` at the project root so later sessions skip guessing. Arguments: `$ARGUMENTS`.

## Steps

1. Run `node scripts/detect-roots-project.mjs` (plugin root) with `--path=<project>` if one was given. Read the JSON.
2. Show: `layout`, each entry of `apps` (`kind`, `path`, `namespace`, `boot`, `providers.source`, `blocks`, `postTypes`), which one is `active`, `runtime.runner`, and every `warnings` entry.
3. Without `--write`: stop here and say that `--write` would save `{ profile, app, runner }`.
4. With `--write`:
   - If `flag` is already present, show it next to the detection. If they differ, ask before overwriting. If they match, say nothing changes.
   - Otherwise write `.roots-stack.json` at the project root with exactly these keys, taken from the active app and the runtime:

     ```json
     { "profile": "<sage-theme | acorn-mu-plugin | radicle-app>", "app": "<apps[active].path>", "runner": "<lando | ddev | none>" }
     ```

     Map detector kinds to profiles: `sage-theme` and `acorn-theme` -> `sage-theme`; `acorn-mu-plugin` and `acorn-plugin` -> `acorn-mu-plugin`; `radicle-app` -> `radicle-app`. For `acorn-unknown`, do not guess: ask which profile applies.
   - Add `"corpus": [...]` only if the user gives corpus roots.
   - When overwriting, keep keys other tools added (for example kivo-creator's `"creator": { "blocks": ... }`).
   - Do not stage, commit or push the file; tell the user it is a new file in the working tree.

## Rules

Only `.roots-stack.json` is ever written. If the detector reports `apps: []`, write nothing and explain. No host `wp`, `composer`, `php`, `yarn` or `npm`.
