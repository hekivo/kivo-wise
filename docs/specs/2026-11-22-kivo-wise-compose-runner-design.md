# kivo-wise: Docker Compose `bin/` runner support — design

Status: **draft**. No section is approved. Every choice that depends on an open owner question is
marked **Proposal** and cites the question id (`Q-0NN`) recorded in `.kion/questions.json`. Inventory
ids (`INV-0NN`) point at `.kion/inventory.json`, which lists every place that hardcodes Lando today.

## S-1 Overview

Hekivo projects are moving from Lando to a native Docker Compose development environment generated
by wp-kit (planned in a parallel effort). That environment ships:

- a Compose file with the PHP, web, database, cache and Node services;
- tooling scripts in `bin/` (`bin/wp`, `bin/composer`, `bin/npm`, and `bin/wp acorn` through WP-CLI)
  that run the binary inside the container;
- a devcontainer for VS Code, GitHub Codespaces and cloud agent sessions (Ubuntu 24.04 VM with Docker
  and `docker compose`, repository files only, a network allowlist, secrets only as proxy-injected
  network secrets).

kivo-wise detects the runner from Lando (or DDEV) only (INV-001, INV-003). The session context line,
the triage JSON (`runtime.runner`, `runtime.runners`), the `lando-wp` skill and the `{{runner.*}}`
placeholders used by every topic skill all assume that.

Goal: support the Compose `bin/` runner **alongside** Lando, with no regression for projects that keep
Lando.

What already works in our favour:

- 462 `{{runner.<key>}}` placeholders across skills and agents are runner-neutral. Skills never read
  the runner id; they copy commands from `runtime.runners`. A correct runner map fixes most skills.
- `hooks/lib.mjs:187` `runners()` and `hooks/post-edit-reminder.mjs:18` are already runner-neutral
  (INV-011, INV-012).

What does not work:

- Detection has no Compose branch. A project without a Landofile reports `runner: none` and the
  warning "commands would run on the host" (`scripts/detect-roots-project.mjs:649`).
- About 20 skill preambles say "On Lando they default to …" and use `lando wp acorn optimize:clear` as
  the example for the command rule (INV-021).
- Only `lando-wp` answers "how do I run this, restart that, read the logs" (INV-013, INV-016).
- Tests, golden hook outputs and eval graders use Lando strings literally (INV-030 to INV-033).

Scope count: 198 files mention Lando. 44 of them are the generated Codex mirror (`plugins/kivo-wise/`),
23 are historical records, 18 are validator fixtures and 9 are incidental (the docs-brain package, which
uses Lando as a corpus source, and third-party). The rest, about 104 hand-authored files, are in scope
for review. Fewer than half of those need more than a one-line change.

Out of scope: DDEV changes, Lando 4, generating the Compose environment (wp-kit owns that), production
and CI runners.

## S-2 Detection

Signals, read in this order:

1. **`.roots-stack.json` `runner`.** Today it only raises a drift warning
   (`scripts/detect-roots-project.mjs:775`). **Proposal (Q-010):** it becomes an override. Detection still
   runs, and the drift warning stays when the detected runner differs.
2. **Compose environment.** A Compose file at the project root (`compose.yaml`, `compose.yml`,
   `docker-compose.yaml`, `docker-compose.yml`, in that order, as Compose itself resolves them) or under
   `.devcontainer/`, **and** executable `bin/wp` (or another `bin/` script on the contract list, Q-012).
   A Compose file without `bin/` scripts is reported as `compose` with raw `docker compose exec` runners
   and a warning (**Proposal**, Q-013).
3. **Landofile chain** (unchanged: `.lando.base.yml` … `.lando.local.yml`).
4. **DDEV** (`.ddev/config.yaml`, unchanged).
5. Otherwise `none`.

**Proposal (Q-009):** when both 2 and 3 are present and there is no flag, Compose wins and the detector
warns `Landofile still present; runner compose chosen (set runner in .roots-stack.json to override)`.

**Proposal (Q-008):** the runner id is `compose`. The triage schema enum becomes
`lando | compose | ddev | none` (INV-007). A new `runtime.compose` block sits next to `runtime.lando`.
`runtime.lando` stays required (and `null` when there is no Lando), so existing readers are unaffected.

```json
"compose": {
  "files": ["compose.yaml"],
  "devcontainer": ".devcontainer/devcontainer.json",
  "services": { "php": "app", "web": "web", "database": "db", "cache": "redis", "node": null },
  "bin": ["wp", "composer", "npm", "flush", "logs"],
  "inContainer": false,
  "parseErrors": []
}
```

- `services` maps roles to Compose service names. Roles come from the image or build context (`php`,
  `nginx`/`httpd`, `mysql`/`mariadb`, `redis`/`valkey`, `node`) and from the contract, never from guessed
  names alone.
- `bin` lists the executable files in `bin/`. A script that holds neither `docker compose` nor a call to
  another `bin/` script is ignored and noted, so a Composer `bin-dir` set to `bin` does not pass for a
  runner.
- `inContainer` is true when the detector itself runs inside the app container. The signal is open
  (fact Q-021, Q-023). Inside the container the runners stay `bin/…`, because the scripts are expected
  to run the binary directly there (to be confirmed against wp-kit, Q-023).
- The Compose file is parsed with the existing YAML subset parser. Anchors, `extends`, `include` and
  profiles that it cannot read produce a note, never a crash. The detector does **not** shell out to
  `docker compose config`, because hooks must stay fast and work without a running daemon.

New warnings:

| Condition | Warning |
|---|---|
| Compose file, no `bin/` scripts | `compose: no bin/ scripts; commands use docker compose exec <php service>` |
| Landofile and Compose both present | as above (Q-009) |
| `bin/` scripts present, no Compose file | `bin/ scripts found but no Compose file; runner none` |
| Landofile `config.cache` (or any key the recipe ignores) | `.lando.yml: config.cache is ignored by the wordpress recipe; declare Redis as its own service` (Q-019) |
| Landofile `config.database: mysql:8.4` with the installed recipe | `.lando.yml: mysql:8.4 fails to start with this recipe (expire_logs_days was removed in MySQL 8.4); use mysql:8.0 or override the database config` (Q-019, fact Q-027) |

## S-3 Runner map

`runtime.runners` keeps its keys (`wp, acorn, composer, node, test, lint, cache, build, dev, login,
logs`). For `compose`:

| Key | From | Proposal (Q-013) |
|---|---|---|
| `wp` | `bin/wp` | `bin/wp` |
| `acorn` | `bin/acorn` if present, else `bin/wp acorn` when an Acorn app exists | `bin/wp acorn` |
| `composer` | `bin/composer` | `bin/composer` |
| `node` | first of `bin/npm`, `bin/yarn`, `bin/pnpm`, `bin/node` | `bin/npm` |
| `test` | first of `bin/phpunit`, `bin/pest`, `bin/test` | the script when present, else `null` |
| `lint` | first of `bin/pint`, `bin/phpcs`, `bin/lint` | same rule |
| `cache` | first of `bin/flush`, `bin/cache-clear`, `bin/cache` | same rule |
| `build` / `dev` | `bin/build`, `bin/dev` | same rule |
| `logs` | `bin/logs`, else `docker compose logs -f <web> <php>` | — |

The selection reuses `pickTool()` (`scripts/detect-roots-project.mjs:615`) over the `bin/` names, so
Lando and Compose share one candidate list.

Session context (`hooks/session-start.mjs:63-115`, INV-008):

```
runner: compose · wp=bin/wp · acorn=bin/wp acorn · composer=bin/composer · node=bin/npm · cache=bin/flush · logs=bin/logs
commands: write every wp/acorn/composer/node/test command exactly as on the runner line (e.g. `bin/wp acorn optimize:clear`), from the project root, ...
```

- The `none` line changes from "no .lando.yml or .ddev" to "no Lando, Compose or DDEV environment".
- The commands rule adds "from the project root" only for `compose`, because a relative `bin/` path
  depends on the working directory (Q-013).
- The 1,500-character budget (`MAX_CONTEXT_CHARS`) holds: `bin/wp` is shorter than `lando wp`.

`.mcp.json` for the WordPress MCP adapter (INV-023): `command` is `bin/wp` with the adapter arguments,
or `docker` with `compose exec -T <php> wp …` when there is no script. The `-T` matters: the adapter
speaks over stdio and a TTY corrupts it.

`protect-files` (INV-010): **Proposal (Q-012):** deny edits to the personal Compose override
(`compose.override.yaml` when it is gitignored), the same way `.lando.local.yml` is denied today. Do not
deny the generated `bin/` scripts, because wp-kit regenerates them and teams patch them.

## S-4 Skills affected

| Skill / file | Change | Inventory |
|---|---|---|
| `roots-triage` | runner enum, `runtime.compose` fields, new warning rows, `runner: none` row wording, flag `runner` values | INV-015, INV-007 |
| `roots-router` | route "how do I run / restart / logs" to `lando-wp` when the runner is `lando` and to the Compose skill when it is `compose`; keywords (`compose.yaml`, `docker compose`, `devcontainer`, `bin/wp`, `codespace`); decision tree row | INV-016 |
| `roots-debugging` | OPcache fix becomes runner-neutral ("restart the PHP service: Lando `lando restart`, Compose `docker compose restart <php>`"); logs hand over to the runner skill | INV-017 |
| `testing-wp` | headed Playwright URL comes from the runner (`*.lndo.site` or the Compose site URL); test command from `{{runner.test}}` | INV-018 |
| `tailwind-vite-assets` | HMR port publishing in Compose (`ports:` on the Node or PHP service), `0.0.0.0`, `strictPort`, WSL2 forwarding; hand over to the runner skill | INV-020 |
| `acorn-background` refs | `REDIS_HOST` is the cache service name from `runtime.compose.services.cache` or the Lando service | INV-022 |
| `wp-abilities-mcp` ref | `.mcp.json` split for Compose (S-3) | INV-023 |
| `docs-brain` | Docker Compose and devcontainer as corpus sources when added (Q-017); cloud behaviour (Q-016) | INV-019 |
| ~16 topic skills + 4 agents | preamble: "On Lando they default to …" becomes "Defaults: Lando `lando wp …`; Compose `bin/wp …`"; the command-rule example stays `{{runner.acorn}} optimize:clear` filled from context | INV-021, INV-025 |
| `roots-status`, `roots-detect` commands | health command for `compose` (`docker compose ps`), flag enum | INV-026 |
| `AGENTS.md` | environment rule: "All wp, composer, … commands run through the project runner from the session context (`lando <cmd>` or `bin/<cmd>`)" | INV-027 |
| Manifests and README | "runs everything through Lando" becomes "through the project's runner (Docker Compose `bin/` scripts or Lando)"; add keywords `docker-compose`, `devcontainer` | INV-028, INV-029 |

`acorn-*` command examples need no edit beyond the preamble: they use `{{runner.acorn}}`. After every
source edit, `scripts/build-codex-plugin.mjs` regenerates `plugins/kivo-wise/` (INV-035), and
`scripts/validate-skills.mjs` must stay green.

## S-5 New Compose skill

**Proposal (Q-011):** a sibling skill `compose-wp` next to `lando-wp`. The router picks one of them from
`runtime.runner`. Same six-section contract, under 500 lines, references one hop away. Proposed
outline:

- **When to use:** running WP-CLI, Acorn, Composer and Node through `bin/`; start/stop/rebuild of the
  Compose stack; editing the Compose file or the override; site not loading, TLS warnings, port clashes,
  logs. Not for Lando projects (`lando-wp`), production, or CI.
- **Inputs required:** `runtime.compose` fields as placeholders (`{{php_service}}`, `{{web_service}}`,
  `{{db_service}}`, `{{cache_service}}`, `{{site_url}}`), `{{runner.*}}`; host facts (`docker version`,
  `docker compose version`, `docker context ls`, repository on the WSL filesystem).
- **Procedure:**
  1. Read the Compose file and the override, then list services and the `bin/` scripts.
     `bin/` is the only supported entry point.
  2. State: `docker compose ps`; `docker compose up -d` (first run builds images).
  3. Commands from the project root through `bin/`. Work directories per profile (Sage theme folder,
     Acorn mu-plugin folder, Radicle root), same table as `lando-wp` with container paths.
  4. Lifecycle table: config or env change → `docker compose up -d` (recreates the changed services);
     Dockerfile or build args → `docker compose build <svc> && docker compose up -d`; wedged process →
     `docker compose restart <svc>`; empty database → `docker compose down -v` (destroys volumes; export
     first; ask). The table must not borrow Lando verbs.
  5. Database: import and export through `bin/wp db import/export` or the database client in the db
     service; `DB_HOST` is the service name, never `localhost`.
  6. Diagnose: `{{runner.logs}}`, `docker compose logs -f {{web_service}} {{php_service}}`, `debug.log`
     inside the container, healthchecks (`docker compose ps` health column).
- **Verification:** `curl -kI {{site_url}}`, `bin/wp core is-installed`, `bin/wp option get siteurl`,
  `bin/wp acorn --version`, `bin/composer --version`, cache service ping.
- **Failure modes** (table seed): port 80/443/3306 already allocated (another stack or a Lando proxy);
  `bin/wp` "service is not running"; file ownership (UID/GID mapping) on files written by the container;
  slow I/O with the repository on `/mnt/c`; certificate not trusted in the Windows browser (CA lives in
  WSL); `docker` not found in a devcontainer shell (already inside the container, Q-023); daemon not
  reachable (Docker Desktop WSL integration off); healthcheck never passes for the database; stdio MCP
  broken by a TTY (`-T`).
- **References:** `compose-file.md` (services, override, env files, profiles), `bin-scripts.md` (the
  wp-kit contract, Q-012), `tls-and-hosts.md` (Q-025), `wsl2.md`, `devcontainer-and-cloud.md` (S-6),
  `failure-modes.md`.

WSL2 specifics: the repository stays on the Linux filesystem; Docker Desktop with WSL integration or
Docker Engine inside the distro; the local CA must be trusted on the Windows side for Windows browsers
(Q-025); `localhost` forwarding for the Vite port.

Skill text constraint: `scripts/validate-skills.mjs` rejects tool names (claude, cursor, codex,
copilot) in skill markdown, so the skill says "cloud agent sessions" and "editor devcontainers", never a
product name.

## S-6 Cloud sessions and Codespaces

Facts to confirm before this section is final: Q-021 (environment signals), Q-022 (Node 20+ available for
the hooks), Q-023 (where the agent shell runs), Q-026 (allowlist and injected secrets).

- **Cloud agent sessions** (Ubuntu 24.04 VM, Docker available, repository files only):
  - The plugin loads only when the repository declares it. **Proposal (Q-015):** wp-kit-generated
    projects commit the marketplace and enabled-plugin entries in the repository's agent settings.
  - The agent shell runs on the VM, so `bin/` scripts call `docker compose exec`; same runners as local.
  - The corpus in the home directory is absent. **Proposal (Q-016):** the session line says
    `corpus: unavailable in this environment` and the rules line keeps "web last" pointing at allowlisted
    official hosts.
  - Secrets: never in files. `auth.json` stays denied (`hooks/protect-files.mjs:88`); private Composer
    access comes from `COMPOSER_AUTH` or a proxy-injected network secret. The Compose skill says so and
    never asks for a token value.
  - Network: first `docker compose up` pulls images and packages. Registries and package hosts must be
    allowlisted (Q-026). The skill lists the failure "image pull blocked by allowlist".
- **Codespaces and editor devcontainers:** the agent shell probably runs inside the app container
  (Q-023). The detector reports `inContainer: true`; runners stay `bin/…` when the scripts handle that
  case, otherwise the plain binaries (`wp`, `composer`, `npm`). `docker compose` commands in the skill
  are marked "host only".
- **Hooks:** hooks need Node.js 20+ (`README.md:21`). If the cloud VM or the devcontainer lacks it
  (Q-022), the hooks stay silent, as they do today on any failure, and the skills still work from
  `roots-triage`.

## S-7 Tests and evals

Unit and hook tests (`node --test`, run in CI):

- New detector fixtures under `test/fixtures/projects/`: `compose-bin` (Sage + Compose + `bin/`),
  `compose-no-bin`, `compose-and-lando` (precedence, Q-009), `compose-devcontainer-only` (Compose file
  under `.devcontainer/`), `flag-runner-override` (Q-010), `lando-cache-key` and `lando-mysql-84`
  (warnings, Q-019).
- `test/detect-roots-project.test.mjs`: runner map per fixture, `runtime.compose` shape against the
  updated `triage.schema.json`, `bin/` signature check (a Composer `bin-dir` of `bin` is not a runner).
- Hook goldens: `test/hooks/session-start/sage-compose` (runner line and commands rule),
  `protect-files/compose-override-deny`, `post-edit-reminder/compose-cache-command`; the
  `sage-bedrock-no-runner` golden changes wording.
- `test/creator/stack.test.mjs`: kivo-creator still reads `compose` runners.
- `scripts/validate-skills.mjs` on the new skill; `scripts/build-codex-plugin.mjs --check` after
  regeneration.

Evals (**Proposal, Q-020**): graders become runner-neutral ("uses the runner's acorn command, for
example `lando wp acorn` or `bin/wp acorn`") instead of literal Lando strings. A representative subset
gets a Compose variant whose scaffold copies a Compose fixture: the new `compose-wp` skill,
`roots-debugging`, `testing-wp`, `acorn-stack`, `tailwind-vite-assets`. Router prompts
(`dev/jev-review/prompts.json`) gain Compose prompts that expect `compose-wp`, and Lando prompts keep
expecting `lando-wp`.

## S-8 Migration

For projects that keep Lando: nothing changes in detection, the runner line or `lando-wp`.
**Proposal (Q-014):** Lando enters maintenance mode. It stays detected and documented and gets fixes, but
no new Lando-only content. Removal is a later decision.

Lando fixes that ship with this work (**Proposal, Q-019**):

- Detector warning and `wordpress-recipe.md` note: a `cache:` key under `config:` is ignored by the
  wordpress recipe, so Redis must be declared as its own service under `services:` with a tooling entry.
  The wp-kit Lando template has this key (and also a separate cache service). Under the template backport
  rule, a matching wp-kit fix is opened there.
- `wordpress-recipe.md:14` lists `mysql:8.4` without a caveat. With the installed recipe the server does
  not start: `expire_logs_days` was removed in MySQL 8.4 (fact Q-027 confirms which config file sets it).
  Add a failure-modes row and a detector warning; recommend `mysql:8.0`, or a database config override
  that uses `binlog_expire_logs_seconds`.
- `docs/guide/troubleshooting.md` already records that Lando's mount breaks on Docker Engine 28+. That is
  a reason to move, and it goes in the migration note.

Moving a project from Lando to Compose (guide page, not a skill):

1. Generate the Compose environment with wp-kit. Keep `.lando.yml` during the transition.
2. Optionally pin `"runner": "compose"` in `.roots-stack.json` (Q-010).
3. Move the database: `lando db-export` → `bin/wp db import`.
4. Move env values: Lando-injected variables (`LANDO_*`, `DB_HOST=database`) become the Compose service
   names in `.env`.
5. Tooling parity: list `lando` tooling names and their `bin/` equivalents (cache flush, theme build,
   tests).
6. Delete the Landofile chain once the team has switched. The detector warning disappears.

Release (**Proposal, Q-018**): a minor version. The runner enum gains a value and `runtime` gains a block.
Nothing is removed.
