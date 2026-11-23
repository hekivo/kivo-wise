---
name: roots-triage
description: Use when you need to know what kind of project the working directory is (Sage theme, Acorn mu-plugin, Radicle, Bedrock, plain WordPress) or which runner it uses (Lando, Docker Compose bin/ scripts, DDEV), when the session context is missing or contradicts the files, when there is no .roots-stack.json, or when a detector warning (ACORN_BASEPATH, misplaced env_file, Landofile still present, no bin/ scripts, docker CLI not found, truncated scan, flag drift) needs explaining. Runs scripts/detect-roots-project.mjs and writes .roots-stack.json. For choosing a skill after triage use roots-router; for Lando commands use lando-wp; for Compose commands use compose-wp.
license: MIT
compatibility: Filesystem agent with bash and node 20+; the detector is read-only and never runs project commands.
---

# Roots triage

Deterministic classification of a Roots-stack project: run the detector, read its JSON, act on the warnings, pin the result in a flag file.

## When to use

- No session context names a profile, or the context disagrees with the files in front of you.
- The request needs facts the detector owns: layout, core directory, Acorn apps and their namespaces, package versions, runner commands, Lando tooling names, Compose services and `bin/` scripts, the session kind.
- A warning from the detector needs explaining or fixing.
- A project should stop relying on heuristics: write `.roots-stack.json`.
- Not for: deciding which skill handles the request (that is `roots-router`), or running the runner itself (`lando-wp` for Lando, `compose-wp` for Docker Compose).

## Inputs required

- The project root (defaults to the working directory; pass `--path=<dir>` otherwise).
- Read access to `composer.json`, `composer.lock`, `.lando.yml` and companions (`.lando.base.yml`, `.lando.dist.yml`, `.lando.upstream.yml`, `.lando.local.yml`), the root Compose file and its override (`compose.yaml`, `compose.override.yaml`, …), `bin/`, `.devcontainer/devcontainer.json`, `wp-cli.yml`, `.roots-stack.json`, theme `style.css` and plugin headers.
- The plugin root: the directory that contains `skills/` and `scripts/`. Nothing else; no network, no containers. The detector reads the session kind from environment signals and looks for `docker` on `PATH` by listing directories; it never starts a process.

## Procedure

1. **Run the detector from the plugin root.**

   ```bash
   node scripts/detect-roots-project.mjs --path=/abs/path/to/project            # JSON (default)
   node scripts/detect-roots-project.mjs --path=/abs/path/to/project --format=text  # compact table
   ```

   Without `--path=` the working directory is the project root. The same file name exists inside this skill folder (`scripts/detect-roots-project.mjs`) as a wrapper that forwards to the plugin-root copy, so the relative path works from either place. The script exits 0 always; absence becomes `null` plus an entry in `notes`.

2. **Read the top level first:** `layout`, `coreDir`, `apps.length`, `active`, `runtime.runner`, `flag`, `warnings`, `truncated`. The shape is fixed by [references/triage.schema.json](references/triage.schema.json); the meaning of every field is in [references/output-fields.md](references/output-fields.md).

   | Field | Read it as |
   |---|---|
   | `layout` | `radicle` / `bedrock` / `composer-wordpress` / `plain-wordpress` / `unknown` - where core and content live |
   | `coreDir` | the local WordPress source; never edit it, always read it to verify native behaviour |
   | `apps[active].kind` | the profile: `sage-theme`, `acorn-mu-plugin`, `radicle-app` (or `acorn-theme`, `acorn-plugin`, `acorn-unknown`) |
   | `apps[active].path`, `.namespace`, `.basePathHint`, `.boot`, `.providers`, `.blocks`, `.postTypes`, `.versions` | where the code is, how it boots, which mechanisms are in use, which versions to document against |
   | `site.versions`, `site.wpCli` | site-wide versions (`roots/wordpress`, ACF Pro) and where WP-CLI expects core |
   | `runtime.runner` | `lando`, `compose`, `ddev` or `none`: which runner every command goes through. Order: the flag (when its environment exists), a root Compose file, the Landofile chain, DDEV, `none` |
   | `runtime.runners` | the only commands you may suggest: `wp`, `acorn`, `composer`, `node`, `test`, `lint`, `cache`, `logs` (on Compose they are `bin/…` paths, run from the project root) |
   | `runtime.compose` | `null`, or the Compose facts: `files`, `contract` (`kivo-wp` version or `null`), `devcontainer`, `services` (role to service name), `bin` (scripts that passed the signature check), `parseErrors` |
   | `runtime.session` | `kind` (`local`, `cloud`, `codespaces`, `devcontainer`) and `dockerCli` (an executable `docker` on `PATH`) |
   | `flag` | the committed decision; when present it overrides `apps` for routing, and its `runner` overrides detection when that environment exists |

3. **Act on each warning.** Warnings are plain sentences; match them by what they mention.

   | Warning mentions | Meaning | Action |
   |---|---|---|
   | an Acorn app without `ACORN_BASEPATH` while a theme has `composer.json` | Acorn may infer the theme as base path, so the plugin's `config/`, views and storage resolve to the wrong directory | Define `ACORN_BASEPATH` or pass the path to `Application::configure()` in the plugin's boot file; re-run the detector |
   | `env_file` under `config:` / `misplacedEnvFile` | Lando only injects the top-level `env_file` list; nested, it is dropped silently | Move `env_file` to the top level of `.lando.yml` and rebuild, or confirm PHP loads `.env` itself (then the variables exist for PHP but not for tooling) |
   | flag vs detected app (drift) | `.roots-stack.json` names a profile or path the heuristics no longer find | Fix the flag (or the project); until then the flag still wins |
   | two apps booting, or a second app with `wordpress: true` routing | Double boot: two Acorn applications fight for hooks and request routing | Keep one booted app, or make the second one a library |
   | `tailwind.config.js` next to Tailwind 4 | Stale v3 configuration; v4 reads `@theme` from CSS | Remove or migrate the file into CSS |
   | Blade views outside the theme with an older `roots/acorn` | Template resolution for non-theme views needs a newer Acorn on recent WordPress | Upgrade `roots/acorn` in the app's `composer.json` |
   | `truncated` | The walk hit depth 4 or 5,000 files | Narrow with `--path=` to the app, or write the flag file so the walk is not needed |
   | `runner: none` (`No Lando configuration found …`) | No Lando, Compose or DDEV environment found | Commands run on the host; say so explicitly and prefer the project's documented wrapper |
   | `Landofile still present; runner compose chosen` | A root Compose file and a Landofile both exist; Compose wins | Expected during a move to Compose; pin `"runner": "lando"` in `.roots-stack.json` to stay on Lando for now, or delete the Landofile chain once the team has switched |
   | `compose: no bin/ scripts; commands use docker compose exec <service>` | A root Compose file without an executable `bin/wp` that passes the signature check | Commands are `docker compose exec -T <php service> …`; generate the `bin/` scripts with wp-kit, or check their executable bit |
   | `bin/ scripts found but no Compose file; runner none` | `bin/` scripts exist but there is no root Compose file | Restore `compose.yaml`, or ignore when `bin/` holds something else |
   | `docker CLI not found` | Runner `compose` but no `docker` on `PATH`: often an editor attached to the app container | Reopen the project in the workspace container, or install Docker; `compose-wp` covers the places |
   | `runner "<x>" is not one of lando, compose, ddev, none` | The flag's `runner` value is unknown; it is ignored | Fix the value in `.roots-stack.json` |
   | `runner "<x>" set but no <x> environment found; using <detected>` | The flag names a runner whose files are absent, so it cannot produce commands | Fix the flag, or add that environment; the detected runner is used meanwhile |
   | `layout: unknown` and no apps | Not a Roots project, or the signals live deeper than the walk | Ask the user; do not guess a profile |

4. **Pin the result.** When the classification is right, propose committing `.roots-stack.json` at the project root:

   ```json
   { "profile": "acorn-mu-plugin", "app": "wp-content/mu-plugins/<plugin>", "runner": "lando", "corpus": ["~/hekivo/kivo-wisdom/corpus"] }
   ```

   `profile` is one of `sage-theme`, `acorn-mu-plugin`, `radicle-app`; `app` is relative to the root (`.` for Radicle); `runner` is `lando`, `compose`, `ddev` or `none`; `corpus` is optional. The `runner` is an override with two guards: an unknown value is ignored with a warning, and a runner whose environment is absent (for example `compose` without a Compose file) keeps the detected runner with a warning. The drift warning stays whenever the flag and detection differ. The same keys are accepted under `extra.roots-stack` in the root `composer.json`. The flag wins over heuristics, and the detector keeps computing `apps` so it can warn about drift. Writing the file is the user's decision: show the content and the reason.

5. **Hand back to routing.** Report profile, app path, namespace, runners and open warnings in one line, then continue with `roots-router`.

## Verification

- The command exits 0 and prints one JSON document that has every required top-level key of `references/triage.schema.json` (`tool`, `root`, `layout`, `coreDir`, `apps`, `active`, `site`, `runtime`, `flag`, `warnings`, `notes`, `truncated`).
- `apps[active].kind` is one of the three routed profiles, or you asked the user which it should be.
- `flag`, when present, agrees with `apps[active]` (no drift warning).
- `truncated` is `false`, or you explained why it is acceptable.
- `--format=text` prints the compact line that matches what the session context shows.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `detector not found` JSON from the wrapper | The skill wrapper could not find `scripts/detect-roots-project.mjs` at the plugin root | Run the command from the plugin root; check the plugin installation is complete |
| `apps` is empty on a Roots project | The app sits deeper than depth 4, or its `composer.json` does not require `roots/acorn` | Run with `--path=` pointing at the app, or write `.roots-stack.json` |
| Wrong `active` app (theme chosen over the mu-plugin) | The working directory is inside the theme and no flag exists | Write the flag file; the flag overrides the "contains cwd" rule |
| `runtime.lando` is `null` although `.lando.yml` exists | The YAML subset parser gave up (see `notes`) | Simplify the construct it names, or read the Landofile by hand for that session |
| `coreDir` is `null` on `composer-wordpress` | `extra.wordpress-install-dir` missing and no `wp-includes/version.php` found | Read `wp-cli.yml` `path:`; set `wordpress-install-dir` in the root `composer.json` |
| Classification flips between runs | `.lando.local.yml` or an untracked flag file differs between machines | Commit `.roots-stack.json`; keep personal overrides out of it |
| `runtime.compose.bin` is empty although `bin/wp` exists | The script lost its executable bit, or it neither sources `_lib.sh`, calls `docker compose` nor calls another `bin/` script (see `notes`) | `chmod +x bin/*` (and `git update-index --chmod=+x`), or regenerate the scripts with wp-kit |
| `runtime.compose.parseErrors` or notes about skipped aliases | The YAML subset parser cannot read a construct; anchors are read, merge keys and aliases are skipped | Keep `x-kivo-wp`, service names and `image:` free of aliases; read the file by hand for the rest |
| Script throws or prints a stack trace | Contract violation (it must never throw) | Report the input tree and the message; fall back to reading the files by hand |

## Escalation

- A field or warning you cannot interpret: read `references/output-fields.md`; if it is still unclear, the detector's `notes` name the file it read.
- The detector contradicts the project's own documentation: the project documentation wins for this session; file the discrepancy with the project maintainers and, if the detector is wrong, with the plugin.
- Classification needs human knowledge (brand-new layout, custom boot): ask one question - theme, must-use plugin or repository root? - and pin the answer in `.roots-stack.json`.
