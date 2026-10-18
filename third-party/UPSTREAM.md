# Third-party skills

The folders in this directory are copies of official skills from the WordPress project. They are licensed **GPL-2.0-or-later** (full text in [LICENSE](LICENSE)), unlike the rest of this plugin (MIT). They are kept as separate folders so the licence boundary stays clear. The plugin manifest loads them next to `skills/`.

| | |
| --- | --- |
| Source | https://github.com/WordPress/agent-skills (`sourceType: github`) |
| Reference clone | commit `55cd0f7` (2026) |
| Used by | `skills/wp-performance`, `skills/wp-phpstan` (thin wrappers), `skills/acorn-routes-api`, `skills/wp-abilities-mcp` (link here) |

## Skills and hashes

`computedHash` values come from the `skills-lock.json` of the project that installed them with the skills CLI.

| Folder | skillPath | computedHash |
| --- | --- | --- |
| `wp-rest-api` | `skills/wp-rest-api/SKILL.md` | `c52f53b0ba5e171fe8f0967a21ffa51a2466a1ebe0dccb65c3adc91545b45ae9` |
| `wp-performance` | `skills/wp-performance/SKILL.md` | `a38ef25bae1223aa3fb13e120add1ed63984f9032e9d990f4483b4e235f2baa3` |
| `wp-phpstan` | `skills/wp-phpstan/SKILL.md` | `19c1808bafda2f5b929b0fa899a5d3ff138d8fdf79e332056cca28fc358a4d82` |
| `wp-abilities-api` | `skills/wp-abilities-api/SKILL.md` | `2d665cca2211a87ddde2d37eadd95395f06b9bc48d02b1ea18c0a616d5c84d19` |

Because of the local patches below, the hash of these folders no longer matches the lock values.

## Local patches (the only differences from upstream)

1. `wp-rest-api/SKILL.md` line 32: the triage step calls `node scripts/detect-roots-project.mjs` (plugin root) instead of the upstream `wp-project-triage` script, which is not shipped here.
2. `wp-performance/SKILL.md` line 45: script path is `third-party/wp-performance/scripts/perf_inspect.mjs`; line 46 added: a note that `WP_RUNNER="lando wp"` wraps WP-CLI.
3. `wp-performance/scripts/perf_inspect.mjs` line 32: `WP_RUNNER` environment variable (split on spaces, prepended to every WP-CLI call, default `wp`) instead of a hard-coded `wp`.
4. `wp-phpstan/SKILL.md` line 28: script path is `third-party/wp-phpstan/scripts/phpstan_inspect.mjs`.

`wp-abilities-api` is unmodified.

## Updating

Re-copy the folder from a fresh clone of the source, re-apply the four patches above, and update the hash in this file.

## Loading

`wp-rest-api` and `wp-abilities-api` load as skills from this folder (`"skills": ["./third-party/"]` in `.claude-plugin/plugin.json`). `wp-performance` and `wp-phpstan` keep the official text as `SKILL.upstream.md` so they do not collide with the kivo-wise wrapper skills of the same name in `skills/`; the wrappers point here for the full procedure and run the official scripts from `third-party/<skill>/scripts/`.
