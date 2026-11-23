# Detector output, field by field

Loader note: open this page from `roots-triage` step 3 when a field of the JSON needs more than the one-line meaning given in the skill. The authoritative shape is `triage.schema.json` next to this file.

## Top level

| Field | Type | Meaning | What to do with it |
|---|---|---|---|
| `tool.name`, `tool.version` | string | Always `detect-roots-project` plus the plugin version | Quote the version when reporting a wrong classification |
| `root` | string | Absolute project root (`--path=` or the working directory) | Every relative path below hangs off it |
| `layout` | enum | `radicle`, `bedrock`, `composer-wordpress`, `plain-wordpress`, `unknown` (first match wins) | Decides where core lives and which files are protected |
| `coreDir` | string or null | Core directory relative to root (`wp`, `web/wp`, `public/wp`, `.`) | Never edit inside it; it is the local source for native WordPress behaviour |
| `apps[]` | array | Every Acorn application found (depth 4) | See the next table |
| `active` | integer or null | Index of the app routing uses | Flag app, else the app containing the working directory, else mu-plugin over theme |
| `site.versions` | map | Root `composer.lock` versions (`roots/wordpress`, ACF Pro, ...) | Pin docs lookups to these versions |
| `site.wpCli.path`, `site.wpCli.docroot` | string or null | `path:` and `server.docroot` from `wp-cli.yml` | Where WP-CLI expects core; run WP-CLI from the root so the file applies |
| `runtime.runner` | enum | `lando`, `compose`, `ddev`, `none` | Which wrapper every command goes through; the flag runner overrides detection when its environment exists |
| `runtime.lando` | object or null | Merged Landofile facts and derived runners | Feeds `lando-wp`; filled whenever a Landofile exists, even when the runner is `compose`; see below |
| `runtime.compose` | object or null | Root Compose file facts; `null` without a root Compose file | Feeds `compose-wp`; see below |
| `runtime.session` | object | `kind` and `dockerCli`; always present | Where the session runs; see below |
| `runtime.runners` | map | `wp`, `acorn`, `composer`, `node`, `test`, `lint`, `cache`, `build`, `dev`, `login`, `logs` (null when absent) | The only commands to suggest |
| `flag` | object or null | `.roots-stack.json` (or `composer.json` `extra.roots-stack`) | Wins over heuristics; compare with `apps` for drift |
| `warnings[]` | strings | Red flags worth acting on | Each one maps to a row in the skill's warnings table |
| `notes[]` | strings | Absent files, parse fallbacks, skipped directories | Explain a `null`; not a problem by themselves |
| `truncated` | boolean | The bounded walk stopped early (depth 4, 5,000 files) | An app may be missing; narrow with `--path=` or write the flag file |

## `apps[]` entries

| Field | Values | Meaning |
|---|---|---|
| `kind` | `sage-theme`, `acorn-theme`, `acorn-mu-plugin`, `acorn-plugin`, `radicle-app`, `acorn-unknown` | The profile. `sage-theme` = theme header plus Sage's view provider or `app('sage.view')`; `acorn-mu-plugin` = under `mu-plugins/`, `Plugin Name:` header, explicit base path; `radicle-app` = layout `radicle`, root `composer.json` with `extra.acorn.providers`, boot file under `public/content/mu-plugins/` |
| `path` | relative path | App directory (`.` for Radicle) |
| `namespace` | string or null | PSR-4 prefix from the app's `composer.json` (`App\`, `AcmeCore\`, ...) |
| `basePathHint` | `ACORN_BASEPATH`, `configure-arg`, `withPaths`, `theme-inferred`, `root`, null | How Acorn learns the base path. `theme-inferred` on a plugin app is the classic misconfiguration |
| `boot.file`, `boot.hook`, `boot.priority` | strings / null | Which file boots Acorn and on which action (`after_setup_theme` for mu-plugins; null hook = include time, as in a theme's `functions.php`) |
| `providers.source`, `providers.file` | `configurator`, `config/app.php`, `composer-extra`, `functions.php` | Where the provider list is declared; tells scaffolding where to register a new provider |
| `blocks` | `acf-composer`, `native`, `none` | Block mechanism in use |
| `postTypes` | `poet`, `classes`, `acorn-post-types`, `none` | CPT mechanism in use |
| `versions` | map | App `composer.lock`: `roots/acorn`, `livewire/livewire`, `log1x/acf-composer`, `log1x/poet`, `roots/acorn-post-types`, ... |

## `runtime.lando`

| Field | Meaning |
|---|---|
| `name` | App name; URL `https://<name>.lndo.site`, containers `<name>_<service>_1` |
| `recipe` | Only `wordpress` guarantees the recipe tooling (`wp`, `composer`, `php`, `db-import`, `db-export`, `mysql`) |
| `webroot` | `config.webroot`, default `.`; docroot `/app/<webroot>` |
| `php`, `via`, `database`, `xdebug` | Recipe options as written; `via: nginx` adds the `appserver_nginx` service |
| `webService` | `appserver` or `appserver_nginx`: the service that owns the proxy URL and the web logs |
| `envFile[]` | Top-level `env_file` entries, the only ones Lando injects |
| `misplacedEnvFile` | `env_file` found under `config:`; Lando ignores it there |
| `services` | Name, type, ports and image of every declared service (plus the recipe's implicit ones when the detector adds them) |
| `tooling` | Every custom tooling command: `service`, `cmd`, `dir` |
| `events[]` | Event names with commands; `pre-start` installs or builds make `lando start` slow and network-bound |
| `runners` | Derived commands: `wp`, `acorn`, `composer`, `node`, `test`, `lint`, `cache`, `logs` (only the ones that exist) |

## `runtime.compose`

| Field | Meaning |
|---|---|
| `files` | The root Compose file Compose would use (`compose.yaml`, `compose.yml`, `docker-compose.yaml`, `docker-compose.yml`, first match) and every override it merges (`compose.override.yaml`, `compose.override.yml`, `docker-compose.override.yml`). `COMPOSE_FILE` is noted, not followed |
| `contract` | `{ "name": "kivo-wp", "version": <n> }` from the top-level `x-kivo-wp:` block map, or `null`. Version 1 fixes the service names (`app` holds `php` and `web`, `db`, `cache`, `node`, `proxy`, `mail`); a higher version is noted and read from images |
| `devcontainer` | `.devcontainer/devcontainer.json` when it exists, else `null` |
| `services` | Role to service name: `php`, `web`, `database`, `cache`, `node`, `proxy`, `mail` (null when no service holds the role). Without a contract the roles come from `image:` only; a Dockerfile-built service is matched only by a contract name |
| `bin` | Sorted names of the `bin/` scripts that are executable and source `_lib.sh`, call `docker compose` or call another `bin/` script |
| `parseErrors` | One entry per Compose file the YAML subset parser could not read |

Runners for `compose`: `bin/wp`, `bin/wp acorn` (or `bin/acorn`), `bin/composer`, and `node`, `test`, `lint`, `cache`, `build`, `dev`, `login` from the same candidate names as the Lando tooling (`bin/npm`, `bin/test`, `bin/mago`, `bin/flush`, …); `logs` is `bin/logs`, else `docker compose logs -f <web> <php>`. Without `bin/wp`: `docker compose exec -T <php service> wp …` for `wp`, `acorn` and `composer`, the rest `null`.

## `runtime.session`

| Field | Meaning |
|---|---|
| `kind` | First match: `cloud` (the documented remote-session variable of cloud agent sessions is `true`), `codespaces` (`CODESPACES=true`), `devcontainer` (`KIVO_WP_CONTEXT=devcontainer` or `REMOTE_CONTAINERS=true`), else `local` |
| `dockerCli` | An executable named `docker` exists in a `PATH` directory (directory scan, no process) |

## `flag`

`{ "file": ".roots-stack.json" | "composer.json", "profile": "sage-theme" | "acorn-mu-plugin" | "radicle-app", "app": "<relative path>", "runner": "lando" | "compose" | "ddev" | "none", "corpus": ["..."] }`. An unknown `runner` is ignored (set to `null`) with a warning; a valid one overrides detection only when its environment exists. The `corpus` list is optional and names docs corpus roots in precedence order.
