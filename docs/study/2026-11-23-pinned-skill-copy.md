# Implementation notes — self-sufficient project copy of the skills (2026-11-23)

Fixes reported by a wp-kit study (generated projects commit a pinned copy of the skills in
`.claude/skills/`, made by `scripts/sync-project-skills.mjs`, for cloud sessions that do not add
plugin marketplaces). Times are local (UTC-03:00).

## Timeline

| Event | Time |
|---|---|
| Worktree from `origin/main` fc7abad | 2026-11-23 20:10 |
| Local suite green (409 tests, validators, mirror checks) | 20:31 |
| First push and pull request | 20:35 |
| Merged | not recordable inside its own pull request; reported with the next one |

## What changed

1. **Scripts at the plugin root.** `roots-triage` and `roots-onboarding` run
   `scripts/detect-roots-project.mjs` and `scripts/inventory-project.mjs` from the plugin root; the copy
   had none. The copy now carries them in a hidden `.kivo-wise/` folder beside the skill folders, with
   the same relative paths, so "the plugin root" of a copied skill is that folder. The wrapper tries the
   copy layout first (it only exists in a copy), then the plugin layout. A hidden folder without
   `SKILL.md` is not a skill for any loader, and wp-kit's `--prefer-plugin` lists only folders with a
   `SKILL.md`, so it is not hidden by mistake.
2. **`--plugin-root`.** kivo-creator and kivo-rebuild skills also run `<plugin>/scripts/*.mjs`, which read
   `schemas/` two levels up, so those plugins copy `scripts/` and `schemas/` to `.<plugin>/`. Sharing a
   target needed one manifest per plugin (`GENERATED.<plugin>.md`; kivo-wise keeps `GENERATED.md`):
   with one manifest, the second plugin's sync would have found the first plugin's listed files as stale
   extras and deleted them. A skill folder already listed by another plugin's manifest is refused.
3. **Deterministic manifest.** The run date is gone; the manifest records the source commit and the
   plugin's own release tag (`<plugin>-v*`, picked from `git tag --points-at HEAD`: a release commit can
   carry the tags of several packages).

## CI

- Local: every CI step green before the push.

## Impediments

- None blocking. The Codex mirror (`plugins/kivo-wise/`) copies `skills/` and `hooks/` only, so its
  `roots-triage` wrapper finds no detector either; left for a separate change (reported).

## Improvements found

- A plugin could declare its runtime paths in its manifest instead of the `RUNTIME` table in the sync
  script.
