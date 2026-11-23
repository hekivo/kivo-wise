# kivo-wise: Docker Compose `bin/` runner support — design

Status: **approved** by the owner on 2026-11-22 (sections S-1 to S-8, recorded in `.kion/spec.json`).

The wp-kit Compose environment is the parallel wp-kit design (`docs/specs/2026-11-22-wp-kit-docker-design.md`
in wp-kit, with its own decisions, cited here as "wp-kit D-0NN"). Its owner named it **`kivo-wp`**
(wp-kit D-004).

## S-1 Overview

Hekivo projects are moving from Lando to the native Docker Compose environment `kivo-wp` that wp-kit
generates. Facts from the wp-kit design (Q-024, Q-023):

- one root `compose.yaml` is the only stack (wp-kit D-009) with the services `app` (PHP-FPM and nginx in
  one image, with WP-CLI and Composer), `db` (`mysql:8.4`), `cache` (Valkey), `proxy` (Caddy, TLS),
  `node` (npm and the Vite dev server) and `mail` (Mailpit); a personal `compose.override.yaml` that is
  gitignored;
- tooling scripts in `bin/` that all source `bin/_lib.sh` and run `docker compose exec` in the right
  service (with `-T` when stdin is not a TTY): `bin/wp`, `bin/composer`, `bin/npm`, `bin/node`,
  `bin/php`, `bin/test`, `bin/stan`, `bin/mago`, `bin/flush`, `bin/build`, `bin/dev`, `bin/logs`,
  `bin/info`, `bin/setup`, `bin/up`, `bin/down`, `bin/db`, `bin/db-import`, `bin/db-export`, `bin/seed`,
  `bin/e2e`, `bin/xdebug`, `bin/trust-cert`; Acorn runs as `bin/wp acorn`;
- `.devcontainer/devcontainer.json` that opens a **workspace container** (devcontainer base image with
  Docker-in-Docker) running the same `compose.yaml` (wp-kit D-022), so `bin/*` behave the same on a
  developer machine, in Codespaces and in a cloud agent session.

kivo-wise detects the runner from Lando (or DDEV) only (INV-001, INV-003). The session context line,
the triage JSON (`runtime.runner`, `runtime.runners`), the `lando-wp` skill and the `{{runner.*}}`
placeholders used by every topic skill all assume that.

Goal (requirement): support the Compose `bin/` runner **alongside** Lando with no regression for
projects that keep Lando. Lando enters maintenance mode (D-014, S-8).

What already works in our favour:

- 462 `{{runner.<key>}}` placeholders across skills and agents are runner-neutral. Skills never read
  the runner id; they copy commands from `runtime.runners`. A correct runner map fixes most skills.
- `hooks/lib.mjs:187` `runners()` and `hooks/post-edit-reminder.mjs:18` are already runner-neutral
  (INV-011, INV-012).
- kivo-creator already prefers the flag runner over detection
  (`plugins/kivo-creator/scripts/lib/stack.mjs:39`), which matches D-010.

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

Where wp-kit has to change for kivo-wise to work, this design proposes the correct contract to wp-kit
instead of adapting to whatever ships (D-005, D-012). Those requests are collected in S-3 "Requests to
wp-kit".

Delivery (D-001): pull requests with review; each pull request is a complete unit (owner rule: no
one-line pull requests). In Hekivo tooling repositories such as this one the agent may merge its own
pull request once every required check is green; this planning change is not merged. Release is a minor
version (D-018, S-8).

Out of scope: DDEV changes, Lando 4, generating the Compose environment (wp-kit owns that), production
and CI runners. The seeded data and environment decisions D-002 (clean database and staged importer),
D-003 (preserve legacy ids) and D-004 (local, staging and production pipeline) do not apply to a plugin
feature: kivo-wise has no database, no records and no deployed environment of its own.

## S-2 Detection

Signals, read in this order (D-009, D-010):

1. **`.roots-stack.json` `runner`** (or `composer.json#extra.roots-stack.runner`) is an **override**
   (D-010). Detection still runs on every signal below; the drift warning stays when the detected runner
   differs (`scripts/detect-roots-project.mjs:775`). Two guards:
   - the value must be one of `lando | compose | ddev | none`; any other value is ignored with
     `.roots-stack.json: runner "<x>" is not one of lando, compose, ddev, none` (closes INV-006);
   - a flag that names a runner whose files are absent (for example `compose` with no Compose file)
     cannot produce runner commands, so detection keeps its own result and warns
     `.roots-stack.json: runner "<x>" set but no <x> environment found; using <detected>`.
2. **Compose environment** (D-008, D-012): a Compose file at the project root, resolved the way Compose
   resolves it (`compose.yaml`, `compose.yml`, `docker-compose.yaml`, `docker-compose.yml`), **and** an
   executable `bin/wp` that passes the `bin/` signature check below. A root Compose file with no `bin/`
   scripts is still `compose`, with raw `docker compose exec` runners and a warning (S-3).
   A Compose file only under `.devcontainer/` is **not** a runner signal: wp-kit no longer generates one
   (wp-kit D-009), and the older wp-kit template that did (`.devcontainer/docker-compose.yml`, services
   `app`, `web`, `db`, `redis`) attaches the editor to the PHP container, where `docker compose exec`
   does not exist (Q-023). It produces the note `.devcontainer/<file>: editor-attached Compose stack; not
   used as the runner`.
3. **Landofile chain** (unchanged: `.lando.base.yml` … `.lando.local.yml`).
4. **DDEV** (`.ddev/config.yaml`, unchanged).
5. Otherwise `none`.

When 2 and 3 are both present and the flag does not say otherwise, Compose wins and the detector warns
`Landofile still present; runner compose chosen (set runner in .roots-stack.json to override)` (D-009).
`runtime.lando` is still filled from the Landofile in that case, so the Lando warnings below keep
showing during the transition.

The runner id is `compose` (D-008). The triage schema enum becomes `lando | compose | ddev | none`
(INV-007). `runtime` gains two blocks next to `runtime.lando`; both are always present (`null` when they
do not apply) so the schema's `additionalProperties: false` on `runtime`
(`skills/roots-triage/references/triage.schema.json:43`) keeps catching typos. `runtime.lando` stays
required and keeps its shape, so existing readers are unaffected (D-018).

```json
"compose": {
  "files": ["compose.yaml", "compose.override.yaml"],
  "contract": { "name": "kivo-wp", "version": 1 },
  "devcontainer": ".devcontainer/devcontainer.json",
  "services": { "php": "app", "web": "app", "database": "db", "cache": "cache", "node": "node", "proxy": "proxy", "mail": "mail" },
  "bin": ["build", "composer", "dev", "flush", "logs", "mago", "npm", "test", "wp"],
  "parseErrors": []
},
"session": { "kind": "local", "dockerCli": true }
```

`runtime.compose`:

- `files`: the Compose file and, when present, the override files Compose would merge
  (`compose.override.yaml`, `compose.override.yml`, `docker-compose.override.yml`). They are merged with
  the existing `deepMerge()` for reading services only. `COMPOSE_FILE` in the environment is reported in
  a note and not followed.
- `contract`: the wp-kit `bin/` contract the project declares (D-012), `null` when it declares none.
  **Proposal** (request to wp-kit): `compose.yaml` carries a top-level extension field written as a
  block map, `x-kivo-wp:` with `contract: 1` on the next line. Compose ignores `x-` keys. The existing
  YAML subset parser reads block maps but not flow maps (`{ contract: 1 }` comes back as one string), and
  it returns scalars as strings, so the detector reads the version with `Number()`. A known contract
  version fixes the service names and the script names; an unknown higher version produces a note and
  falls back to reading what exists.
- `services` maps roles to Compose service names. With a known contract the names come from the
  contract (`app` holds both `php` and `web`, because wp-kit serves PHP-FPM and nginx from one image).
  Without a contract the roles come from each service's `image` (`php`/`serversideup/php` → php,
  `*fpm-nginx*` → php and web, `nginx`/`httpd`/`caddy` → web or proxy, `mysql`/`mariadb` → database,
  `redis`/`valkey` → cache, `node` → node, `mailpit`/`mailhog` → mail). A service built from a
  `Dockerfile` has no image, so without a contract it is matched by name only when the name is one of
  the contract names, and otherwise left out with a note. Roles are never guessed from other names.
- `bin` lists the `bin/` scripts that pass the signature check: the file is executable and its first
  4 KB either source `_lib.sh` from their own directory, call `docker compose`/`docker-compose`, or call
  another `bin/` script. Anything else (for example a Composer `bin-dir` set to `bin`, which holds
  vendor binaries) is ignored with a note.
- The detector never runs `docker compose config` or any other process: hooks must stay fast and work
  without a running daemon. `extends`, `include` and profiles that the subset parser cannot read produce
  a parse note, never a crash.
- Anchors are common in Compose files (`x-env: &env` plus `<<: *env`), and today the subset parser
  throws on the first one ("unexpected indentation"), which loses the whole file. The parser learns two
  narrow rules: a value that is only an anchor (`&name`) is treated as empty, so the block below it is
  read; a merge key `<<: *name` and any `*alias` value are skipped with a note. Aliases are not resolved.
  Request to wp-kit: keep `x-kivo-wp`, service names and `image` keys free of aliases.

`runtime.session` (new, runner-independent; it feeds S-3 and S-6):

- `kind` is the first match of: `CLAUDE_CODE_REMOTE=true` → `cloud`; `CODESPACES=true` → `codespaces`;
  `KIVO_WP_CONTEXT=devcontainer` or `REMOTE_CONTAINERS=true` → `devcontainer`; otherwise `local` (Q-021).
  `CLAUDE_CODE_REMOTE` and `CODESPACES` are documented by their platforms. `REMOTE_CONTAINERS` is set
  only by one editor's Dev Containers extension and is undocumented, so **Proposal** (request to wp-kit):
  the generated `devcontainer.json` sets `containerEnv: { "KIVO_WP_CONTEXT": "devcontainer" }` as the
  reliable signal. Values are documented; cloud probe pending.
- `dockerCli` is true when an executable named `docker` is found on `PATH` (a directory scan, no process).
- `detect()` takes the environment as an option (`opts.env`, default `process.env`) so tests stay
  deterministic.

Warnings (new rows; Lando rows ship with D-019):

| Condition | Warning |
|---|---|
| Root Compose file, no `bin/` scripts | `compose: no bin/ scripts; commands use docker compose exec <php service>` |
| Landofile and Compose both present, no flag | `Landofile still present; runner compose chosen (set runner in .roots-stack.json to override)` (D-009) |
| `bin/` scripts present, no root Compose file | `bin/ scripts found but no Compose file; runner none` |
| Runner `compose` and `session.dockerCli` false | `docker CLI not found: bin/ scripts need Docker; open the project in the workspace container, not the app container` (Q-023) |
| Landofile `config:` key the wordpress recipe is known to ignore: `cache`, `extra_php_extensions` (and `env_file`, already warned) | `.lando.yml: config.<key> is ignored by the wordpress recipe; <fix>` where the fix for `cache` is "declare Redis as its own service" (D-019, INV-004). A denylist, not an allowlist: the builder also reads undocumented keys such as `build`, `build_root`, `run_root` and `composer` from `config` (`builders/wordpress.js` `getServices()`) |
| Landofile `config.database` is `mysql:8.4*` and `config.config.database` is not set | `.lando.yml: mysql:8.4 fails to start with recipes that still set expire_logs_days (removed in MySQL 8.4); use mysql:8.0 or set config.config.database to a copy of the recipe's mysql8.cnf with binlog_expire_logs_seconds` (D-019, Q-027) |

For the MySQL row the cause is confirmed (Q-027): the installed recipe's default database config
`~/.lando/config/wordpress/mysql8.cnf:51` (Lando v3.26.9) sets `expire_logs_days = 10`, which MySQL 8.4
rejects, so `mysqld` aborts. Upstream `lando/wordpress` main (6d07797, 2026-10-15) already uses
`binlog_expire_logs_seconds = 864000`. The detector reads that one file when it exists and skips the
warning when it no longer contains `expire_logs_days`, so the warning disappears after a Lando update.
`config.config.database` **replaces** the default file instead of being merged with it
(`builders/wordpress.js` `getServiceConfig()`), so an override must be a full copy. The recipe file is
looked up under `opts.landoConfigDir` (default `~/.lando/config`) so tests can point it at a fixture. The
warning covers the explicit `mysql:8.4` tag only: the bare `mysql:8` alias resolves to 8.4 in the
upstream recipe that already ships the fixed file, and there is no evidence of the alias paired with the
broken file.

Detection cache: the hooks cache the detector result for ten minutes in `<project>/.kivo-wise/context.json`
(`hooks/lib.mjs:103-110`). The result now depends on the environment (`runtime.session`), and the same
checkout can be opened on the host and in a devcontainer within that window, so the cache entry stores
`session.kind` and `readCache()` drops it when the current signals give a different kind.

## S-3 Runner map

`runtime.runners` keeps its keys (`wp, acorn, composer, node, test, lint, cache, build, dev, login,
logs`). For `compose` the commands are paths relative to the project root and run from it (D-013). The
candidate lists are the ones the Lando branch already uses (`scripts/detect-roots-project.mjs:636-642`),
moved into one shared constant and applied by `pickTool()` to the `bin/` names, so a script name means
the same thing on both runners:

| Key | Candidates (first match) | Result for a `kivo-wp` project |
|---|---|---|
| `wp` | `bin/wp` | `bin/wp` |
| `acorn` | `bin/acorn`, else `bin/wp acorn` when an Acorn app exists | `bin/wp acorn` |
| `composer` | `bin/composer` | `bin/composer` |
| `node` | `yarn`, `npm`, `pnpm`, `node` | `bin/npm` |
| `test` | `phpunit`, `pest`, `test` | `bin/test` |
| `lint` | `pint-check`, `pint`, `phpcs`, `mago`, `lint` | `bin/mago` |
| `cache` | `cache-clear`, `flush`, `cache` | `bin/flush` |
| `build` / `dev` | `build`, `*-build` / `dev`, `*-dev` | `bin/build` / `bin/dev` |
| `login` | `login` | `null` (wp-kit prints the login from `bin/info`) |
| `logs` | `bin/logs`, else `docker compose logs -f <web> <php>` (one name when both roles are the same service) | `bin/logs` |

Without `bin/` scripts (root Compose file only), `wp`, `acorn` and `composer` become
`docker compose exec -T <php service> wp …` and the others are `null`.

Session context (`hooks/session-start.mjs:63-115`, INV-008):

```
runner: compose · wp=bin/wp · acorn=bin/wp acorn · composer=bin/composer · node=bin/npm · test=bin/test · lint=bin/mago · cache=bin/flush · logs=bin/logs
commands: write every wp/acorn/composer/node/test command exactly as on the runner line (e.g. `bin/wp acorn optimize:clear`), from the project root, ...
```

- The `none` line changes from "no .lando.yml or .ddev" to "no Lando, Compose or DDEV environment".
- The commands rule adds "from the project root" only for `compose`, because a relative `bin/` path
  depends on the working directory (D-013).
- The 1,500-character budget (`MAX_CONTEXT_CHARS`) holds: the Compose runner line above is 150
  characters, shorter than the Lando line with the same keys. A hook test pins the full context length
  for the `sage-compose` golden.

`formatText()` (`scripts/detect-roots-project.mjs:821`) prints `compose <file> (contract kivo-wp v<n>)`
instead of `runner compose`, as it prints the Lando webroot today (INV-005).

Site URL: the detector never reads `.env` (it holds secrets; D-006), so it does not publish a site URL.
Skills get it at run time from `{{runner.wp}} option get home` or `bin/info`.

`.mcp.json` for the WordPress MCP adapter (INV-023): `command` is `bin/wp` with the adapter arguments.
That is safe on stdio only because the wp-kit scripts add `-T` when stdin is not a TTY (Q-024); without
`bin/` scripts the entry is `docker` with `compose exec -T <php> wp …`. The relative `bin/wp` resolves
against the directory the client starts the server in, so the reference tells the reader to verify with
the adapter handshake and to switch to an absolute path written at setup time when the client does not
start servers in the project root.

`protect-files` (INV-010): deny edits to the personal Compose override (`compose.override.yaml`,
`compose.override.yml`, `docker-compose.override.yml`) when the project's `.gitignore` lists it, with
the reason "the developer's unversioned Compose override; change compose.yaml instead", the same way
`.lando.local.yml` is denied (`hooks/protect-files.mjs:90`). The generated `bin/` scripts are not
denied: wp-kit regenerates them and teams patch them (D-012 makes wp-kit the owner of their contract,
not kivo-wise). **Proposal:** the `.gitignore` check is a literal line match after trimming a leading
`/` and skipping comments and `!` negations (no glob engine), which covers what wp-kit generates.

Requests to wp-kit (D-005, D-012), to raise in the wp-kit plan:

1. Declare the contract in `compose.yaml` as a block map `x-kivo-wp:` → `contract: <n>` and version it (Proposal,
   S-2).
2. Keep `-T` on non-TTY stdin in `bin/_lib.sh` (already in the wp-kit design) and make `bin/wp` usable
   as a stdio MCP command.
3. Set `containerEnv.KIVO_WP_CONTEXT=devcontainer` in `devcontainer.json` (Proposal, S-2).
4. Add the devcontainer Node.js feature (`ghcr.io/devcontainers/features/node`, default `lts`), because
   the base image has no Node.js and kivo-wise hooks need Node 20+ (Q-022).
5. Add the non-default hosts of S-6 to the generated cloud allowlist.
6. Add `.kivo-wise/` (the hook cache) to the generated `.gitignore`; today generated projects show it as
   an untracked folder.

## S-4 Skills affected

| Skill / file | Change | Inventory |
|---|---|---|
| `roots-triage` | runner enum, `runtime.compose` and `runtime.session` fields, flag override and its two guards (D-010), new warning rows, `runner: none` row wording | INV-015, INV-007 |
| `roots-router` | route "how do I run / restart / logs" to `lando-wp` when the runner is `lando` and to `compose-wp` when it is `compose` (D-011); keywords (`compose.yaml`, `docker compose`, `devcontainer`, `bin/wp`, `codespace`, `kivo-wp`); decision tree row | INV-016 |
| `roots-debugging` | OPcache fix becomes runner-neutral ("restart the PHP service: Lando `lando restart`, Compose `docker compose restart {{php_service}}`"); logs hand over to the runner skill | INV-017 |
| `testing-wp` | headed Playwright URL comes from the runner (`*.lndo.site`, or `https://<project>.localhost[:port]` from `bin/info`, or the Codespaces forwarded URL); test command from `{{runner.test}}`; wp-kit `bin/e2e` noted as the Playwright entry | INV-018 |
| `tailwind-vite-assets` | Compose HMR: Vite runs in the `node` service and is reached through Caddy at `https://vite.<project>.localhost` (wp-kit networking), so `server.hmr` uses that host on the HTTPS port with `server.host: 0.0.0.0` and `strictPort`; in Codespaces Caddy is bypassed and HMR uses the forwarded Vite port URL with `clientPort: 443`; WSL2 `localhost` forwarding; hand over to the runner skill | INV-020 |
| `acorn-background` refs | `REDIS_HOST` (`WORDPRESS_REDIS_HOST` in wp-kit) is the cache service name from `runtime.compose.services.cache` (`cache`) or the Lando service | INV-022 |
| `wp-abilities-mcp` ref | `.mcp.json` split for Compose (S-3) | INV-023 |
| `docs-brain` | Docker Compose manual and devcontainer specification as corpus sources, added in a separate kivo-wisdom change (D-017); `corpus: unavailable` behaviour (D-016, S-6) | INV-019 |
| ~16 topic skills + 4 agents | preamble: "On Lando they default to …" becomes "Defaults: Lando `lando wp …`; Compose `bin/wp …`"; the command-rule example stays `{{runner.acorn}} optimize:clear` filled from context. No new Lando-only content (D-014) | INV-021, INV-025 |
| `roots-status`, `roots-detect` commands | health command for `compose` (`docker compose ps`), flag enum with `compose` | INV-026 |
| `AGENTS.md` | environment rule: "All wp, composer, … commands run through the project runner from the session context (`lando <cmd>` or `bin/<cmd>` from the project root)" | INV-027 |
| kivo-creator `scripts/lib/stack.mjs:39` | read `detection.runtime.runner` first: the detector now applies the flag override with its guards, so reading `flag.runner` first would disagree with the detector when the flag names a missing environment | — |
| Manifests and README | "runs everything through Lando" becomes "through the project's runner (Docker Compose `bin/` scripts or Lando)"; add keywords `docker-compose`, `devcontainer` | INV-028, INV-029 |
| `lando-wp` references | D-019 fixes only: `wordpress-recipe.md:14` caveat for `mysql:8.4`, `failure-modes.md` rows for the ignored `config:` keys and the MySQL 8.4 start failure | INV-004 |

`acorn-*` command examples need no edit beyond the preamble: they use `{{runner.acorn}}`. After every
source edit, `scripts/build-codex-plugin.mjs` regenerates `plugins/kivo-wise/` (INV-035), and
`scripts/validate-skills.mjs` must stay green.

## S-5 New Compose skill

A sibling skill `compose-wp` next to an unchanged `lando-wp`; the router picks one of them from
`runtime.runner` (D-011). Same six-section contract, under 500 lines, references one hop away.

- **When to use:** running WP-CLI, Acorn, Composer and Node through `bin/`; start, stop and rebuild of
  the Compose stack; editing `compose.yaml` or the override; site not loading, TLS warnings, port
  clashes, logs. Not for Lando projects (`lando-wp`), production, or CI.
- **Inputs required:** `runtime.compose` fields as placeholders (`{{php_service}}`, `{{web_service}}`,
  `{{db_service}}`, `{{cache_service}}`, `{{node_service}}`), `{{runner.*}}`, `runtime.session.kind`;
  host facts (`docker version`, `docker compose version`, `docker context ls`, repository on the WSL
  filesystem). The site URL comes from `bin/info` (S-3).
- **Procedure:**
  1. Read `compose.yaml` and the override, then list services and the `bin/` scripts. `bin/` is the
     only supported entry point; with a known contract the skill trusts the wp-kit names.
  2. State: `docker compose ps`; first run `bin/setup` (idempotent: builds, starts with health checks,
     installs dependencies, seeds synthetic data); later runs `bin/up`. The setup flags per place
     (`--cloud` in a cloud session, `--ci` in CI) come from the contract version and are chosen from
     `runtime.session.kind`; until wp-kit fixes them they are written as the contract reference says.
  3. Commands from the project root through `bin/` (D-013). Work directories per profile (Sage theme
     folder, Acorn mu-plugin folder, Radicle root), same table as `lando-wp` with container paths.
  4. Lifecycle table: config or env change → `docker compose up -d` (recreates the changed services);
     Dockerfile or build args → `docker compose build <svc> && docker compose up -d`; wedged process →
     `docker compose restart <svc>`; empty database → `bin/down --volumes` (destroys volumes; export
     first with `bin/db-export`; ask). The table must not borrow Lando verbs.
  5. Database: `bin/db-import` / `bin/db-export`, `bin/db` for a client shell; `DB_HOST` is the service
     name (`db`), never `localhost`.
  6. Diagnose: `{{runner.logs}}`, `docker compose logs -f {{web_service}}`, `debug.log` inside the
     container, health checks (`docker compose ps` health column).
- **Verification:** `curl -I <site URL>` after `bin/trust-cert` (`-k` only as a diagnostic, because it
  hides the TLS failure the check is meant to catch), `bin/wp core is-installed`, `bin/wp option get siteurl`,
  `bin/wp acorn --version`, `bin/composer --version`, cache service ping.
- **Failure modes** (table seed): host port 443 or 80 already allocated (another stack or a Lando proxy;
  `bin/setup` picks a free port, read it from `bin/info`, wp-kit D-013); `bin/wp` "service is not
  running" (run `bin/up`); file ownership on files written by the container (UID/GID build args);
  slow I/O with the repository on `/mnt/c`; certificate not trusted in the Windows browser (Q-025);
  `docker` not found (shell is in the app container, not the workspace container; Q-023); daemon not
  reachable (Docker Desktop WSL integration off); database health check never passes; stdio MCP broken
  by a TTY (`-T`); image pull blocked by the cloud allowlist (S-6).
- **References:** `compose-file.md` (services, override, env files, profiles, the `x-kivo-wp` contract),
  `bin-scripts.md` (the wp-kit contract, D-012), `tls-and-hosts.md`, `wsl2.md`,
  `devcontainer-and-cloud.md` (S-6), `failure-modes.md`. Until the kivo-wisdom change of D-017 lands,
  the references cite docs.docker.com and containers.dev directly.

TLS and hosts (Q-025): the `proxy` service terminates TLS with Caddy `tls internal` (wp-kit D-012) for
`https://<project>.localhost`, `https://vite.<project>.localhost` and `https://mail.<project>.localhost`;
`*.localhost` resolves to loopback without a hosts entry. `bin/trust-cert` exports Caddy's root CA and
prints the trust command per OS.

WSL2 specifics (Q-025): the repository stays on the Linux filesystem; Docker Desktop with WSL integration
or Docker Engine inside the distro; Windows browsers need Caddy's root CA in the Windows Root store
(`certutil -addstore -f ROOT <file>` from an elevated prompt, reading the file exported by
`bin/trust-cert` through `\\wsl.localhost\<distro>\…`), and Firefox needs
`security.enterprise_roots.enabled`; WSL `localhost` forwarding makes the HTTPS port reachable from
Windows.

Skill text constraint: `scripts/validate-skills.mjs:66` rejects tool names in skill markdown, so the
skill says "cloud agent sessions" and "editor devcontainers", never a product name.

## S-6 Cloud sessions and Codespaces

Facts (Q-021, Q-022, Q-023, Q-026; the cloud values are documented, cloud probe pending):

- **Cloud agent sessions** run on a fresh Ubuntu 24.04 x86_64 VM with the repository cloned, Docker
  and `docker compose`, and Node.js 20, 21 and 22 (22 on `PATH`), so the hooks run (Q-022). The agent
  shell is on the VM, so `bin/*` call `docker compose exec` exactly as on a developer machine (Q-023).
  `CLAUDE_CODE_REMOTE=true` identifies them (Q-021).
- **Codespaces and editor devcontainers** open the wp-kit workspace container (wp-kit D-022), which has
  the Docker CLI; runners stay `bin/…`. The base image has no Node.js, so the hooks run only after
  wp-kit adds the Node feature (Q-022, S-3 request 4). Until then the hooks stay silent, as they do on
  any failure, and the skills still work from `roots-triage`.

Requirements:

- **Plugin availability.** wp-kit-generated projects commit the marketplace and enabled-plugin entries
  in the repository's agent settings (D-015). Survey Q-026 found that hosted cloud sessions do **not**
  add marketplaces declared in repository settings, while they do load committed skills, agents,
  commands, settings hooks and `.mcp.json`. D-015 therefore covers developer machines, Codespaces and
  devcontainers. wp-kit D-019 commits a pinned copy of the chosen skills for cloud sessions, which brings
  kivo-wise skills but not its hooks (session context, protect-files). How cloud sessions get the hooks
  is open (Q-028, **Proposal**: wp-kit's skill sync also copies the kivo-wise hook scripts and the
  detector, and registers them in the committed settings file).
- **Corpus** (D-016): when `runtime.session.kind` is not `local` and no configured corpus root exists
  on disk (or none is configured), the rules line reads `corpus: unavailable in this environment; web last: official
  documentation hosts` instead of `none configured`. The docs-brain skill lists the official hosts.
- **Secrets** (D-006): never in files and never printed. `auth.json` stays denied
  (`hooks/protect-files.mjs:88`). In cloud sessions the only project secret is the ACF Pro Composer
  credential, attached by the session proxy as a network secret for `connect.advancedcustomfields.com`
  (wp-kit D-014); it never enters the VM. Environment variables of a cloud environment are readable by
  every user, so the Compose skill never suggests putting a token there and never asks for a token value.
- **Data** (D-007): cloud agent sessions and Codespaces are on the approved list; they receive the
  repository and synthetic fixtures only (wp-kit D-002), never production data.
- **Network** (Q-026): the default cloud allowlist already covers GitHub, Docker Hub, ghcr.io,
  mcr.microsoft.com, packagist.org, repo.packagist.org, registry.npmjs.org and the Ubuntu archives. A
  wp-kit project also needs `wpackagist.org`, `api.wordpress.org`, `downloads.wordpress.org`,
  `pkg-containers.githubusercontent.com` (ghcr.io image layers), `connect.advancedcustomfields.com` (ACF
  Pro) and, for the corpus fallback, the documentation hosts (`developer.wordpress.org`, `roots.io`,
  `docs.docker.com`, `containers.dev`). `devcontainer-and-cloud.md` lists them and the failure "image
  pull or package install blocked by the allowlist" (proxy 403).
- **Stack lifecycle in cloud sessions:** the environment cache keeps pulled images and installed files
  but no running containers, so the stack starts per session (wp-kit's `SessionStart` setup). The Compose
  skill's first step checks `docker compose ps` before any `bin/` command.

The probe `dev/probes/environment-probe.sh` prints the identity signals (values only for the documented
non-secret ones, presence for the rest), Node.js and Docker versions, the project files and the HTTP
status of every host above. Running it once in a cloud session, a Codespace and a devcontainer closes the
"cloud probe pending" items.

## S-7 Tests and evals

Unit and hook tests (`node --test`, run in CI):

- New detector fixtures under `test/fixtures/projects/`: `compose-bin` (Sage + `compose.yaml` with
  `x-kivo-wp` + `bin/` scripts sourcing `_lib.sh`), `compose-no-bin`, `compose-no-contract` (image-based
  roles), `compose-and-lando` (precedence, D-009), `devcontainer-legacy` (Compose file only under
  `.devcontainer/`, not a runner), `composer-bin-dir` (a `bin/` of vendor binaries, not a runner),
  `flag-runner-override` and `flag-runner-missing-env` (D-010 and its guard), `lando-config-cache` and
  `lando-mysql-84` (warnings, D-019; the MySQL fixture points `opts.landoConfigDir` at a fixture copy of
  `mysql8.cnf` with and without `expire_logs_days`), `compose-anchors` (anchors and merge keys parsed
  with notes).
- `test/detect-roots-project.test.mjs`: runner map per fixture, `runtime.compose` and `runtime.session`
  shape against the updated `triage.schema.json`, `session.kind` from an injected environment for each
  signal, `bin/` signature check.
- Hook goldens: `test/hooks/session-start/sage-compose` (runner line, commands rule, context length),
  `session-start/cloud-no-corpus` (D-016 line), `protect-files/compose-override-deny` and
  `compose-override-tracked-allow`, `post-edit-reminder/compose-cache-command`; a `hooks/lib.mjs` cache
  test that a cached `local` detection is dropped when `CODESPACES=true`; the
  `sage-bedrock-no-runner` golden changes wording.
- `test/creator/stack.test.mjs`: kivo-creator reads `compose` runners and the flag override.
- `scripts/validate-skills.mjs` on the new skill; `scripts/build-codex-plugin.mjs --check` after
  regeneration.

Evals (D-020): graders become runner-neutral ("uses the runner's acorn command, for example
`lando wp acorn` or `bin/wp acorn`") instead of literal Lando strings. A representative subset gets a
Compose variant whose scaffold copies the `compose-bin` fixture: the new `compose-wp` skill,
`roots-debugging`, `testing-wp`, `acorn-stack`, `tailwind-vite-assets`. The rest stays on Lando with the
runner-neutral graders. Router prompts (`dev/jev-review/prompts.json`) gain Compose prompts that expect
`compose-wp`, and Lando prompts keep expecting `lando-wp`.

## S-8 Migration

For projects that keep Lando: nothing changes in detection, the runner line or `lando-wp`. Lando is in
maintenance mode (D-014): it stays detected and documented and gets fixes, but no new Lando-only content.
Removal is a later decision.

Lando fixes that ship in this same change (D-019):

- Detector warning and `wordpress-recipe.md` note for keys under `config:` that the recipe ignores
  (`cache:` among them): Redis or Valkey must be declared as its own service under `services:` with a
  tooling entry. The wp-kit Lando template has the `cache:` key (and also a separate cache service). Under
  the template backport rule a matching wp-kit fix is raised there; wp-kit keeps Lando only as a
  deprecated choice for one major (wp-kit D-008).
- `wordpress-recipe.md:14` lists `mysql:8.4` without a caveat. With the recipe bundled in Lando v3.26.9
  the server does not start because `mysql8.cnf` sets `expire_logs_days` (Q-027). Add the caveat, a
  failure-modes row and the detector warning (S-2); recommend `mysql:8.0`, a full copy of `mysql8.cnf`
  with `binlog_expire_logs_seconds = 864000` in `config.config.database`, or a Lando release with the
  fixed recipe.
- `docs/guide/troubleshooting.md` already records that Lando's mount breaks on Docker Engine 28+. That is
  a reason to move, and it goes in the migration note.

Moving a project from Lando to `kivo-wp` (guide page, not a skill):

1. Generate the Compose environment with wp-kit. Keep `.lando.yml` during the transition; Compose wins
   detection from then on (D-009).
2. Optionally pin `"runner": "compose"` (or `"lando"` to keep Lando for a while) in `.roots-stack.json`
   (D-010).
3. Move the database: `lando db-export` → `bin/db-import <file>` (`lando db-export` writes a gzip file;
   decompress it first unless the contract says `bin/db-import` accepts `.gz`).
4. Move env values: Lando-injected values (`LANDO_*`, `DB_HOST=database`) become the wp-kit keys
   (`WORDPRESS_DB_HOST=db`, `WORDPRESS_REDIS_HOST=cache`, `WORDPRESS_SITE_URL=https://<project>.localhost`).
5. Tooling parity: list `lando` tooling names and their `bin/` equivalents (cache flush, theme build,
   tests).
6. Delete the Landofile chain once the team has switched. The detector warning disappears.

Release: a minor version (D-018). The runner enum gains a value and `runtime` gains two blocks; nothing
is removed. kivo-creator and kivo-rebuild keep reading `runtime.runner` and `runtime.runners` unchanged.
