# Implementation notes — component 03, compose-wp skill and runner routing (2026-11-23)

Phase 1, batch C; sub-plan `docs/plans/2026-11-22-compose-runner/phase-1/03.md`. Times are local
(UTC-03:00). This note also closes the timeline of component 02 and of phase 1.

## Timeline

| Event | Time |
|---|---|
| Component 01 (#60): merge commit created by the queue / pull request marked merged | 00:35:35 / 00:35:53 |
| Component 02 (#61) enqueued | 2026-11-23 00:43:31 |
| Component 02: merge group checks passed, merge commit 4981526 / pull request marked merged | 00:43:30 (commit) / 00:44:22 |
| Branch opened (worktree from `origin/main` 4981526) | 2026-11-23 00:44:53 |
| First push | 2026-11-23 00:53:00 |
| Pull request opened | see the pull request; the merge time is in the final report of the phase |

Per component, branch open to merge:

| Component | Branch opened | Pull request opened | Merged | Total |
|---|---|---|---|---|
| 01 Compose detection and runner map | 00:22:52 | 00:32:17 | 00:35:53 | 13 min |
| 02 Session context and hook guards | 00:36:28 | 00:41:36 | 00:44:22 | 8 min |

## CI

- Component 01: no failure on the pull request (two green runs, the second after the `merge_group`
  commit). Queue merge within seconds: no check was required yet.
- Component 02: no failure on the pull request. First merge through the queue with required checks:
  the `merge_group` run passed and the queue merged about one minute after the enqueue.
- Component 03: local runs green before the push (403 tests, every validator, the Codex mirror check,
  and the offline keyword half of the routing review: the three Compose prompts route to `compose-wp`,
  no Lando prompt changed).

## Decisions taken inside the spec

- The `bin/setup` place flags are written as contract 1 names them (`--cloud`, `--ci`, none elsewhere),
  with the instruction to prefer `bin/setup --help` when it differs, as S-5 asks until wp-kit fixes them.
- Container paths are written as `<mount>`, read from `volumes:` and `working_dir:` in `compose.yaml`:
  the spec does not fix the mount target of the `app` service, so the skill does not invent one.
- The runner-neutral acorn grader accepts the Lando and Compose spellings (D-020); the Compose eval adds
  a separate "no Lando verbs" grader because the fixture is a Compose project.
- The cloud session signal is described in skill markdown without the variable name, because the name
  contains an AI tool name and skill markdown must not name one.

## Impediments

1. **The skills line of every session-start golden changes with a new route.** Planned (the reason 03
   follows 02); the diff touches only that line, and the pinned length of the `sage-compose` context
   moves from 1,073 to 1,085 characters.
2. **"lando-wp is unchanged" is hard to test as content.** A first test that rejected any "compose" in
   `lando-wp` failed on the word "composer". The test now rejects Compose-specific tokens only, and the
   pull request shows the empty diff of `skills/lando-wp/`.
3. **The release pull request reports no checks.** It is opened with the workflow token, so its checks
   do not start until a person triggers an event on it; with required checks on `main` this has to be
   done before it can be queued.

## Improvements found

- A validator rule for "no Lando verbs in a Compose skill's lifecycle table" generalises: a per-skill
  denylist in the frontmatter `metadata` would let the validator enforce runner purity.
- The routing review could take the runner as state (as it takes the profile), so prompts with shared
  terms (Xdebug, database import) are graded per runner.
- release-please could run with an App token, so its pull request runs the required checks on its own.
