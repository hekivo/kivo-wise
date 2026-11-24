# Implementation notes — component 04, kivo-wp Compose contract 2 (2026-11-23)

Plan `docs/plans/2026-11-23-compose-contract-2/plan.md`; spec
`docs/specs/2026-11-23-kivo-wise-compose-contract-2-design.md`. Times are local (UTC-03:00).

## Timeline

| Event | Time |
|---|---|
| Pinned skill copy fixes (#64): enqueued / merged (530b1a4) | 20:34:22 / 20:35:32 |
| Plan pull request (#66) opened | 20:39 |
| Implementation worktree from `origin/main` 530b1a4 | 20:40 |
| Local suite green (419 tests, validators, mirror checks) | 20:44 |
| Plan pull request (#66): enqueued / merged (50ee0cc) | 20:45:19 / 20:46:12 |
| Rebased on 50ee0cc, pushed, pull request opened | 20:47 |
| Merged | not recordable inside its own pull request |

## CI

- #64 and #66: no failure; each merged through the queue about one minute after the enqueue.
- This pull request: local runs green, then the first CI run failed on the `compose-router` detector
  test: the fixture's `compose.override.yaml` is gitignored by the fixture's own `.gitignore` (it
  mirrors a real project), so `git add -A` left it out and CI saw only `compose.yaml`. Fixed with
  `git add -f`, as `compose-bin` does. Lesson: copying a fixture with ignored files needs `git status
  --ignored` before the commit.

## Decisions taken inside the spec

- The router report is `runtime.compose.router = { container, network, networkDeclared }`, filled from
  the contract (fixed names) plus one read of the top-level `networks:` map. Whether the router runs is
  left to `bin/router status`: the detector starts no process.
- `services.proxy` stays in the schema (required, `null` on contract 2), so readers of contract 1 output
  are unaffected; the only change on contract 1 is `router: null` and the new `compose:` session line.
- The contract 2 router prompt went into a user-prompt-router golden instead of
  `dev/jev-review/prompts.json`, which pins three prompts per skill.

## Impediments

1. **Goldens that embed the Compose detection.** The new session line changes three goldens
   (`sage-compose`, `cloud-no-corpus`, and the new `sage-compose-router`) and the pinned context length
   (1,085 to 1,207 characters). Planned; the diffs touch only that line.
2. **An existing test used contract 2 as "unknown".** It now uses contract 3 for the fallback path.
3. **Facts wp-kit has not measured yet** (Q-059 `extra_hosts` from containers, Q-060 cloud proxy and
   ports) are written as conditions in the skills ("when that works", "report instead of working
   around"), not as facts.

## Improvements found

- The YAML subset parser reads Traefik labels with backticks and `${VAR:-default}` inside quoted list
  items without change; a fixture now pins that.
- `testing-wp` and `tailwind-vite-assets` still have no Lando-versus-Compose split beyond these rows;
  runner plan phase 2 remains the place for it.
