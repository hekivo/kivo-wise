# Hooks

Hooks are Node scripts (stdin JSON in, JSON out) that run on lifecycle events. They use no model tokens, never run project commands, and stay silent when the project is not a Roots stack. They are declared in `hooks/hooks.json`; `hooks/cursor-hooks.json` is generated from it by `scripts/sync-cursor-hooks.mjs`.

| Event | Script | What it does |
|---|---|---|
| SessionStart (`startup`, `resume`, `clear`, `compact`) | `session-start.mjs` | Runs the detector and injects a summary of at most 1,500 characters: profile, namespace, stack versions, runner commands, reading order, the command-writing rule (runner-prefixed commands, CI/deploy commands labelled separately), the routing table and detector warnings |
| UserPromptSubmit | `user-prompt-router.mjs` | Matches the prompt against `skills/roots-router/references/keywords.json`; when exactly one skill matches it injects a one-line hint; when several match and exactly one is listed in `_triage` (roots-debugging), that one is hinted with the others as follow-ups; otherwise nothing |
| PreToolUse on Write, Edit, MultiEdit, NotebookEdit | `protect-files.mjs` | Denies edits to secrets and managed folders and asks before touching a few profile files |
| PreToolUse on Bash | `pre-commit-attribution.mjs` | Before `git commit`, reminds the rule when `AGENTS.md` or `CLAUDE.md` forbids AI attribution; never blocks |
| PostToolUse on Write, Edit | `post-edit-reminder.mjs` | After a PHP or Blade change in the active app, reminds the project's cache command; never runs it |

## Protected files

Denied in every profile: `.env*` (except `.env.example`), `auth.json`, `.lando.local.yml`, `wp-config.php`, the WordPress core directory, `vendor/`, `node_modules/`, Composer-installed plugins and themes, `uploads/` and build output such as `public/build/`. Radicle adds its scaffolding files, and edits to `bedrock/environments/*.php` ask first. Paths outside the project are ignored.

## Debugging

Every hook appends to `.kivo-wise/hooks.log` in the project (override with `KIVO_WISE_HOOK_LOG=<path>`). To check that the hooks run and parse, run `scripts/doctor-hooks.sh` from the project. A hook that fails stays silent so it never blocks the session; look in the log first.
