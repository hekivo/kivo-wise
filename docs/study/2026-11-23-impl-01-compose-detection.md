# Implementation notes — component 01, Compose detection and runner map (2026-11-23)

Phase 1, batch A of `docs/plans/2026-11-22-compose-runner/plan.md`; sub-plan `phase-1/01.md`. One agent
session implemented it from a fresh worktree of `origin/main`. Times are local (UTC-03:00).

## Timeline

| Event | Time |
|---|---|
| Branch opened (worktree from `origin/main` a62287e) | 2026-11-23 00:22:52 |
| First push | 2026-11-23 00:31:06 |
| Pull request opened (#60) | 2026-11-23 00:32:17 |
| Merged | recorded in the component 02 notes (a pull request cannot record its own merge) |

## CI

Local runs before the push, all green: `node --test test/*.test.mjs test/creator/*.test.mjs
test/rebuild/*.test.mjs` (376 tests), `scripts/test-validate-skills.mjs`, `scripts/validate-skills.mjs`,
`scripts/build-codex-plugin.mjs --check`, `scripts/sync-cursor-hooks.mjs --check`,
`scripts/sync-codex-manifests.mjs --check`. CI failures on the pull request and their fixes are listed in
the component 02 notes.

## Decisions taken inside the spec

These follow from the spec text and are not new decisions; they are listed so a reviewer can check them.

- `bin/_lib.sh` is the library the scripts source, not a command: it is skipped by the `bin/` scan
  without a note, which is what makes the S-2 example list nine names.
- `runtime.compose.services` always carries the seven role keys, `null` when no service holds the role,
  so the schema can keep `additionalProperties: false` on it.
- With a known contract, a role is filled only when its contract service exists in the file.
- "nginx/httpd/caddy → web or proxy": nginx and httpd (and fpm-nginx images) take `web` first in file
  order; a web server left once `web` is taken (caddy first) becomes `proxy`.
- Without `bin/wp`, other `bin/` scripts do not change the runner map: the `docker compose exec -T`
  forms and the "no bin/ scripts" warning apply, because S-2 makes `bin/wp` the runner signal.
- An anchored scalar (`key: &name value`) keeps its value; the spec only names the anchor-only case.
- `include:` and service `extends:` are read as plain keys and produce a "not followed" note.

## Impediments

1. **The regression baseline must be captured before the first edit.** The sub-plan asks for literals
   from `main`; they were captured into `test/fixtures/detector-baseline-main.json` before touching the
   detector. Capturing them after the change would have pinned the new behaviour instead.
2. **A fixture's own `.gitignore` hides the override it describes.** `compose-bin/.gitignore` lists
   `compose.override.yaml` (as a real project does), so the file had to be added with `git add -f`.
3. **Hook tests run with the developer's environment.** `detect()` now reads `process.env` by default,
   so the detector tests inject `opts.env` (an empty `PATH`, or a temporary directory holding a fake
   `docker`) to stay deterministic on machines with or without Docker.

4. **The merge queue cannot wait on checks that never run in it.** `ci.yml` listened to `push` and
   `pull_request` only. Once its checks become required on the `main` ruleset (owner rule, after this
   component), every queue entry would wait for checks that are never reported on the merge group. The
   workflow gains a `merge_group` trigger in this pull request so the next components can merge.
5. **The release pull request has no checks.** release-please opens it with the workflow token, and
   events caused by that token do not start workflows, so `chore: release main` (#58) reports no checks.
   With required checks it needs a person-triggered event (close and reopen, or a push) before it can be
   queued.

## Improvements found

- The sub-plan could state the `_lib.sh` rule and the shape of `services` (all keys, nullable); both
  were inferred from the S-2 example.
- A `--env` style CLI option (or documenting `opts.env`) would let `roots-status` show what the detector
  sees in another session kind without changing the environment.
