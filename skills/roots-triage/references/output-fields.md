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
| `runtime.runner` | enum | `lando`, `ddev`, `none` | Which wrapper every command goes through |
| `runtime.lando` | object or null | Merged Landofile facts and derived runners | Feeds `lando-wp`; see below |
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

## `flag`

`{ "file": ".roots-stack.json" | "composer.json", "profile": "sage-theme" | "acorn-mu-plugin" | "radicle-app", "app": "<relative path>", "runner": "lando" | "ddev" | "none", "corpus": ["..."] }`. The `corpus` list is optional and names docs corpus roots in precedence order.
