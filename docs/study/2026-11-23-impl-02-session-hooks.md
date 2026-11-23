# Implementation notes — component 02, Compose session context and hook guards (2026-11-23)

Phase 1, batch B; sub-plan `docs/plans/2026-11-22-compose-runner/phase-1/02.md`. Times are local
(UTC-03:00).

## Timeline

| Event | Time |
|---|---|
| Component 01 (#60) enqueued in the merge queue | 2026-11-23 00:35:34 |
| Component 01 merged (a82bf13) | 2026-11-23 00:35:35 |
| `main` ruleset: required status checks added (`Skill contract and plugin manifest`, `Tests`, `Verify derived files`) | 2026-11-23 00:36 |
| Branch opened (worktree from `origin/main` a82bf13) | 2026-11-23 00:36:28 |
| First push | 2026-11-23 00:40:24 |
| Pull request opened (#61) | 2026-11-23 00:41:36 |
| Merged | recorded in the component 03 notes |

Component 01 took 13 minutes from branch to merge: about 8 minutes of implementation and local checks,
one minute for the pull request, 3 minutes of CI and one minute in the queue.

## CI

Component 01: no CI failure. The first run passed in about 25 seconds per job; a second run followed the
`merge_group` commit. The queue merged within a second of the enqueue because no check was required yet.

Component 02: local runs green before the push (392 tests and every validator); CI failures on this pull
request, if any, are listed in the component 03 notes.

## Decisions taken inside the spec

- Outside a local session a corpus root counts only when it exists on disk; inside a local session the
  configured roots are printed as before, existing or not, so the Lando goldens stay byte-identical.
- `~/` in a corpus root expands to the home directory and a relative root resolves from the project
  directory, the way `docs-brain` reads `.docs-brain.json`.
- A cache entry without `sessionKind` (written by an older hook) is dropped once, instead of being
  trusted as `local`.

## Impediments

1. **Hook modules cannot be imported by tests.** `session-start.mjs` and `protect-files.mjs` run the
   hook at import time (top-level `await runHook`), so their functions are tested by spawning the hook.
   The new helpers that tests call directly (`currentSessionKind`, `readCache`, `writeCache`,
   `isGitignored`) live in `hooks/lib.mjs`.
2. **The golden runner disables the cache.** Every golden runs with `KIVO_WISE_NO_CACHE=1`, so the cache
   case is a spawned test in a temporary project with a detector that counts its runs, not a golden.
3. **The required checks must also run in the merge queue.** Adding them to the ruleset after component
   01 only works because component 01 added the `merge_group` trigger to `ci.yml`.

## Improvements found

- Moving the hook bodies behind an `import.meta.url` guard (as the detector does) would let tests import
  `buildContext()` and pin context lengths without spawning a process.
- The golden runner could accept a `cache: true` marker per case, so cache behaviour becomes a golden.
