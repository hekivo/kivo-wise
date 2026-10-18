# Lando CLI semantics

Loader note: open this page from `lando-wp` step 5 when you need the exact effect of a Lando command on containers, build steps and data.

## Lifecycle

| Command | What it does | Data |
|---|---|---|
| `lando start` | First run builds containers and runs build steps; later runs only start. Pulls images for new services. Runs `pre-start`/`post-start` events every time. | kept |
| `lando stop` | Stops this app's containers. | kept |
| `lando restart` | Stop plus start, preserving container state. Does **not** re-run build steps; use `rebuild` after a Landofile change. | kept |
| `lando rebuild [-s svc ...] [-y]` | Rebuilds the app from scratch and re-runs build steps. Required after any `.lando.yml`, `.lando.local.yml` or `env_file` change. `-s appserver` rebuilds a subset. | database volume kept |
| `lando destroy [-y]` | Removes containers **and** database/index data, irretrievably. Files on disk untouched. Needed to change database credentials. | lost |
| `lando poweroff` | Stops **all** Lando containers of all apps and frees ports 80/443. Needed after global `~/.lando/config.yml` changes. | kept |
| `lando init` | Creates a Landofile (`--recipe`, `--webroot`, `--name`, `--source cwd|github|remote`). Upstream calls it poorly designed; edit the result by hand. | n/a |

## Inspection

| Command | Use |
|---|---|
| `lando info [--deep] [--format json\|table] [--service s] [--path p] [--filter k=v]` | URLs, service versions, `creds`, `internal_connection` (use inside the app), `external_connection` (use from the host). `--deep` is `docker inspect`. |
| `lando logs [-f] [-s svc ...] [-t]` | Wrapper around `docker logs`: stdout/stderr only. Files such as `debug.log` need `lando ssh -c "tail ..."`. |
| `lando list [--all] [--app name]` | Running containers. |
| `lando config [--path p] [--format json]` | Global configuration; `lando config --path plugins` shows plugin load paths. |
| `lando version [--all] [--plugin php]` | CLI and plugin versions. |

## Running commands

| Command | Notes |
|---|---|
| `lando <tooling>` | Recipe tooling (`wp`, `composer`, `php`, `db-import`, `db-export`, database CLI) plus every project tooling name. `lando <tooling> --help` works. |
| `lando ssh [-s svc] [-c cmd] [-u user]` | Deprecated (removed in Lando 4) but works on `api: 3` services. Default service `appserver`. |
| `lando exec <svc> [--user u] -- <cmd>` | The replacement; fine for one-off commands. |
| `lando --clear` | Clears the tooling-route cache. Routes are cached at the end of each invocation, so new tooling may be invisible until you run `lando --clear` or `lando list`. |

## Maintenance (3.21+ management commands)

| Command | Notes |
|---|---|
| `lando setup` | Installs Docker (Desktop on Windows/macOS, Engine on Linux), Docker Compose v2, the common plugins, the `landonet` network and the Lando Development CA. `--skip-common-plugins`, `--skip-install-ca`. |
| `lando update [-y]` | Updates core, CLI and plugins. Source-installed plugins block updates. Channel: `lando --channel stable\|edge\|none`. |
| `lando plugin-add <pkg[@ver]>`, `lando plugin-remove` | Plugins install to `~/.lando/plugins`. |

## Global flags and logs

- `--debug`, `-v` to `-vvvv`, `--help`.
- Logs: `~/.lando/logs/lando.log`, `lando-error.log`, `<app>.log`, `<app>-error.log`.
- A non-TTY shell (Git Bash minTTY) gives `the input device is not a TTY`; use a real terminal.

## Decision table

| Situation | Command |
|---|---|
| Changed Landofile, `env_file` contents, build steps, PHP extensions, `xdebug`, `webroot`, `via`, `php` | `lando rebuild -y` |
| Containers wedged, no config change | `lando restart` |
| Changed database credentials, type or major version; want an empty database | `lando destroy -y && lando start` |
| No Landofile yet | `lando init`, then edit |
| Tooling "not found" after editing `tooling:` | `lando --clear` |
| Global config change | `lando poweroff`, then `lando start` |
| Last resort, nothing works | `lando poweroff && docker system prune -a --volumes && rm -rf ~/.lando/cache` (destroys every local database: export first) |

<!-- sources: report 08 §1.4, §1.5, §1.9, §2.8 — https://docs.lando.dev/cli/ · https://docs.lando.dev/cli/start.html · https://docs.lando.dev/cli/restart.html · https://docs.lando.dev/cli/rebuild.html · https://docs.lando.dev/cli/destroy.html · https://docs.lando.dev/cli/poweroff.html · https://docs.lando.dev/cli/info.html · https://docs.lando.dev/cli/ssh.html · https://docs.lando.dev/cli/exec.html · https://docs.lando.dev/cli/logs.html · https://docs.lando.dev/cli/update.html · https://docs.lando.dev/cli/setup.html · https://docs.lando.dev/cli/init.html · https://docs.lando.dev/help/purging-containers.html -->
