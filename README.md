# kivo-wise

A plugin for AI assistants working on WordPress sites built on the [Roots](https://roots.io) stack. It works out which kind of project it is in, gives the assistant a short factual summary at session start, and routes each request to one skill written for that profile. Project commands run through the project's runner (Lando); official documentation is read from a versioned corpus.

kivo-wise 3.0 is the successor of `superpowers-sage` (see [Upgrading](#upgrading-from-superpowers-sage-2x)).

## Profiles

The plugin detects the project layout and every Acorn app in it, then picks the active profile:

| Profile | What it is |
|---|---|
| `sage-theme` | A Sage theme with Acorn (blocks, Blade, composers inside the theme) |
| `acorn-mu-plugin` | Acorn running inside a must-use plugin, with themes as consumers |
| `radicle-app` | A Radicle project: Acorn at the site root, Bedrock layout |

Detection is done by `scripts/detect-roots-project.mjs`. It also finds the layout (`radicle`, `bedrock`, `composer-wordpress`, `plain-wordpress`), stack versions and the runner (Lando, DDEV or none). To pin the answer, write a `.roots-stack.json` flag at the project root with `/roots-detect --write`; the flag wins over the heuristics.

## Install

Requirements: Node.js 20+, and Lando 3.x for projects that use it.

Claude Code:

```bash
claude plugin marketplace add hekivo/kivo-wise
claude plugin install kivo-wise@kivo-wise
```

From a local clone, for one session:

```bash
claude --plugin-dir /path/to/kivo-wise
```

Other assistants are covered in [Cursor, Codex and Copilot](#cursor-codex-and-copilot).

## What loads

**Session context.** At session start a hook runs the detector and adds up to 1,500 characters: the profile and app path, namespace, stack versions (Acorn, Livewire, ACF Composer, Poet, WordPress), the runner commands, the reading order (project guidelines first, then native WordPress/ACF/Acorn behaviour, then custom code) and the skill routing table. Outside a Roots project it adds nothing.

**Hooks** (Node scripts, no model tokens):

| Event | Hook | Effect |
|---|---|---|
| SessionStart | `session-start.mjs` | Injects the detected context |
| UserPromptSubmit | `user-prompt-router.mjs` | Hints one skill when exactly one matches the prompt |
| PreToolUse (Write, Edit) | `protect-files.mjs` | Denies edits to `.env*`, `wp-config.php`, core, `vendor/`, uploads and build output; Radicle scaffolding is protected too |
| PreToolUse (Bash) | `pre-commit-attribution.mjs` | Reminds a "no AI attribution" rule from `AGENTS.md`/`CLAUDE.md` before `git commit` |
| PostToolUse (Write, Edit) | `post-edit-reminder.mjs` | Reminds the cache command after PHP or Blade changes |

**Skills** (name and purpose; the full descriptions are in each `SKILL.md`):

| Skill | Purpose |
|---|---|
| `roots-router` | Pick the skill for a request from profile and intent |
| `roots-triage` | Run the detector, explain its output, write `.roots-stack.json` |
| `roots-onboarding` | Read-only map of an unfamiliar project |
| `roots-debugging` | Triage a broken page, boot error or stale cache |
| `roots-reviewing` | Convention audit of a diff before the merge request |
| `lando-wp` | Lando command semantics and common failures |
| `docs-brain` | Look up official docs in a versioned corpus |
| `acorn-stack` | Providers, composers, Blade, config and boot per profile |
| `acorn-scaffolding` | New blocks, post types, field groups, providers, commands |
| `acf-native` | ACF validation, save flow and admin JS with native hooks |
| `acorn-livewire` | Livewire 4 components inside Acorn |
| `acorn-routes-api` | Acorn routes, controllers and REST endpoints |
| `acorn-background` | Cron, queues, scheduling, Redis, cache and logs |
| `acorn-data` | Eloquent models, migrations and custom tables |
| `wp-hooks-lifecycle` | Hook timing and placement |
| `wp-security-escaping` | Escaping, sanitizing, nonces and capabilities |
| `tailwind-vite-assets` | Tailwind 4 and Vite per profile |
| `testing-wp` | PHPUnit, Pest and Playwright |
| `wp-composer-plugins` | Plugins and themes through Composer |
| `wp-abilities-mcp` | Abilities API and MCP for AI agents |
| `wp-performance` | Profiling and object cache |
| `wp-phpstan` | PHPStan for Acorn projects |

`third-party/` holds copies of official WordPress agent skills (`wp-rest-api`, `wp-abilities-api`, `wp-performance`, `wp-phpstan`). The manifest loads them next to `skills/`. They are GPL-2.0-or-later; see `third-party/UPSTREAM.md`.

**Agents** (read-only): `acorn-reviewer`, `livewire-debugger`, `roots-architect`, `tailwind-v4-auditor`.

**Commands**: `/roots-detect [--write] [--path=<dir>]` and `/roots-status`.

The rules that apply to every session (Lando for all commands, protected files, Tailwind 4, Acorn routes and Poet, escaping by field type) are in [`AGENTS.md`](AGENTS.md).

## Docs brain

`packages/docs-brain` is a CLI that builds a grep-friendly markdown corpus of official documentation at the versions the project locks.

```bash
docs-brain resolve          # lock files -> documentation versions
docs-brain update           # fetch sources and write the corpus
docs-brain status --check   # project and upstream drift; exit 1 on drift
docs-brain search "query"   # search the corpus (rg when available)
```

The corpus lives in a separate private repository. Each project points to it in `.docs-brain.json`; the plugin ships no corpus. The `docs-brain` skill defines the lookup order and how to search.

## Cursor, Codex and Copilot

These assistants do not load Claude Code plugins, so copy the skills into the project:

```bash
node /path/to/kivo-wise/scripts/sync-project-skills.mjs --to .agents/skills
```

This copies every `skills/<name>/` folder and writes `.agents/skills/GENERATED.md` (plugin version, date, skill and file lists). Third-party GPL skills are skipped unless you pass `--include-gpl`. Run the same command with `--check` in CI to fail when the copy is stale; it prints the missing, changed and extra files. The script never deletes a file that `GENERATED.md` does not list.

Codex (CLI 0.137 or newer) can also install the plugin directly:

```bash
codex plugin marketplace add hekivo/kivo-wise
codex plugin add kivo-wise@kivo-wise
```

Codex does not load a plugin's own context file; it reads `AGENTS.md` from the project root. Append the plugin's rules to the project once: `curl -fsSL https://raw.githubusercontent.com/hekivo/kivo-wise/main/AGENTS.md >> AGENTS.md`.

`plugins/kivo-wise/` and `.agents/plugins/marketplace.json` are generated by `node scripts/build-codex-plugin.mjs`; do not edit them. Cursor hooks (`hooks/cursor-hooks.json`) are generated from `hooks/hooks.json` by `scripts/sync-cursor-hooks.mjs`.

## Development

```bash
node --test test/                       # detector, hooks, sync script
node scripts/validate-skills.mjs        # skill contract (add -q for a short run)
node scripts/test-validate-skills.mjs   # tests for the validator
node scripts/build-codex-plugin.mjs     # regenerate the Codex layout (--check in CI)
claude plugin validate . --strict       # manifest, skills, hooks, agents
cd packages/docs-brain && npm test      # docs-brain CLI
```

A skill must have `name` equal to its folder, a description that starts with "Use when", the six standard sections, and stay under 500 lines. The guide is a [Docsify site](docs/guide/INDEX.md); `docs/provenance.md` records where each skill's content came from.

## Upgrading from superpowers-sage 2.x

The plugin and repository were renamed to `kivo-wise` (`hekivo/kivo-wise`; GitHub redirects the old URL). Uninstall `superpowers-sage`, install `kivo-wise` with the commands above, and replace the `superpowers-sage:` prefix with `kivo-wise:` wherever you referenced a skill or agent.

Removed in 3.0, with no replacement unless noted:

- Bash hooks and `hooks/lib.sh` (rewritten in Node), and `scripts/detect-sage-project.mjs` (a deprecated shim remains; use `detect-roots-project.mjs`).
- Skills: `sageing` (now `roots-router`), `onboarding`, `architecture-discovery`, `architecting`, `plan-generator`, `building`, `reviewing`, `debugging`, `modeling`, `designing`, `verifying`, `sage-design-system`, `sage-block-architecting`, `block-scaffolding`, `block-refactoring`, `sage-forms`, `migrating`, `ai-setup`, `abilities-authoring`, `install-plugin`. Their consolidated successors are listed above (`roots-*`, `acorn-*`, `wp-*`).
- Agents: `design-extractor`, `pencil-extractor`, `visual-verifier`, `forms`, `acorn-migration`, `content-modeler`, `sage-architect`, `sage-debugger`, `sage-reviewer` (the last three became `roots-architect`, `livewire-debugger` and `acorn-reviewer`).
- Commands: `/acf-register`, `/livewire-new`, `/sage-status` (now `/roots-status`).
- Design-tool integrations (Paper, Figma, Stitch, Pencil).

See the [changelog](CHANGELOG.md) for the full list.

## License

MIT. The folders in `third-party/` are copies of official WordPress skills under GPL-2.0-or-later; see `third-party/LICENSE`.
