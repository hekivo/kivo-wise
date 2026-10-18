# Skills

Skills are folders under `skills/<name>/` with a `SKILL.md`. Claude loads one when its description matches the request; `roots-router` picks the right one from the profile and the intent. Every skill has the same sections (Overview, When to use, Steps, Checks, Common mistakes, References) and stays under 500 lines.

## Roots stack skills

| Skill | Use it for |
|---|---|
| `roots-router` | Choosing the skill for a request from the profile and the intent |
| `roots-triage` | Running the detector and writing `.roots-stack.json` |
| `roots-onboarding` | A read-only map of an unfamiliar project |
| `roots-debugging` | Triage of a broken page, Acorn boot, Blade, ACF, Livewire or asset problem |
| `roots-reviewing` | A convention audit of a diff with a fixed report |
| `lando-wp` | Lando command semantics: `lando wp`, rebuild, env files, WSL2 issues |
| `docs-brain` | Looking up official documentation in a versioned corpus |
| `acorn-stack` | Providers, composers, Blade components, config, boot per profile |
| `acorn-scaffolding` | New blocks, post types, field groups, providers, commands |
| `acf-native` | ACF validation, save flow and admin JS through native hooks |
| `acorn-livewire` | Livewire 4 components inside Acorn |
| `acorn-routes-api` | Acorn routes, controllers and REST endpoints |
| `acorn-background` | Cron, queues, scheduling, Redis, cache and logging |
| `acorn-data` | Eloquent models, migrations and custom tables |
| `wp-hooks-lifecycle` | Hook timing and where hooks are registered |
| `wp-security-escaping` | Escaping, sanitizing, nonces and capabilities |
| `tailwind-vite-assets` | Tailwind 4, Vite and the front-end build per profile |
| `testing-wp` | PHPUnit, Pest and Playwright |
| `wp-composer-plugins` | Plugins, mu-plugins and themes through Composer |
| `wp-abilities-mcp` | The Abilities API and MCP for AI agents |
| `wp-performance` | Profiling and object cache, on top of the official skill |
| `wp-phpstan` | PHPStan setup for Acorn projects, on top of the official skill |

## Third-party skills

`third-party/` holds copies of official WordPress agent skills (`wp-rest-api`, `wp-abilities-api`, `wp-performance`, `wp-phpstan`). They are GPL-2.0-or-later and load next to `skills/` through the manifest. The plugin skills of the same topic are thin wrappers that add the runner and profile notes. See `third-party/UPSTREAM.md`.

## Skills in other tools

Tools that do not load Claude Code plugins can read the skills from the repository. Run `node scripts/sync-project-skills.mjs --to .agents/skills` from the project; see the README.
