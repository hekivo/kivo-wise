# The Landofile

Loader note: open this page from `lando-wp` step 1 or 5 when reading or changing `.lando.yml` and its companions.

## Top-level keys

`name` (required), `recipe`, `config` (recipe options), `services`, `tooling`, `events`, `proxy`, `env_file`, `excludes`, `compose`, `plugins`, `pluginDirs`. There is no `version:` key; services carry `api: 3` (default) or `api: 4` (experimental, out of scope). Any change needs `lando rebuild`.

## Load order

```yaml
preLandoFiles: [.lando.base.yml, .lando.dist.yml, .lando.upstream.yml]  # loaded before
landoFile: .lando.yml
postLandoFiles: [.lando.local.yml]                                      # loaded after; gitignore it
```

The last file wins. Team settings go in `.lando.yml`; personal overrides (extra mounts, ports) in `.lando.local.yml`.

## `env_file`

- A **top-level** list of `KEY=VALUE` files relative to the project root, injected into every service through Docker Compose `env_file`.
- No `${VAR}` interpolation. Variables exist only inside containers (`getenv()` in PHP).
- Changing a listed file requires `lando rebuild`.
- Nested under `config:` it is **silently dropped**: the recipe only forwards `proxy`, `services` and `tooling`, and the app reads the root key.
- `.lando.env` is not a Lando convention; a project that has one lists it under `env_file:` itself.
- Roots projects usually load `.env` in PHP (phpdotenv) from `wp-config.php` or the Bedrock/Radicle bootstrap. Those variables reach PHP without Lando, but tooling commands do not see them.

## `excludes`

Directories (`vendor`, `node_modules`) not bind-mounted from the host but synced into the container for speed. Every operation that changes files inside them must run in the container (`lando composer`, `{{runner.node}}`). `"!vendor/pkg"` un-excludes one path.

## Tooling

```yaml
tooling:
  mycommand:
    service: appserver          # required unless cmd is a list of {service: cmd}; ":opt" = dynamic
    description: Runs something
    dir: /app/path              # absolute container path; default = container dir mapped from host cwd
    cmd: mycommand              # or [cmd1, cmd2] or [{appserver: cmd}, {node: cmd}]
    user: root
    env: { KEY: value }
    options: { name: { passthrough: true, alias: [n], describe: "..." } }
    level: app                  # required when options are interactive
  push: disabled                # disables an inherited tooling command
```

Without `dir:`, `cd web && lando ssh -c pwd` prints `/app/web`: the command runs where you are. With `dir:`, it always runs there.

## Build steps and events

- `build_as_root` / `build` run **once** before boot (as root / as you); `run_as_root` / `run` once after boot. They re-run only on `lando rebuild`, or on every start while they keep failing.
- Events run **every time**: `pre-start`, `post-start`, `pre-stop`, `post-stop`, `pre-rebuild`, `post-rebuild`, `pre-destroy`, `post-destroy`, `pre-init`, `post-init`, `ready`, and `pre-<tool>` / `post-<tool>` for every tooling command (e.g. `post-db-import`).
- Each line is its own subshell, run as you (no sudo). Prefer the `- appserver: cmd` form.
- Dependency installs placed in `pre-start` make every `lando start` slow and network-bound.

## Containers, mounts, environment

- Project at `/app`, `$HOME` at `/user`, `~/.lando` at `/lando`.
- Every service gets `LANDO=ON`, `LANDO_APP_NAME`, `LANDO_APP_ROOT`, `LANDO_MOUNT=/app`, `LANDO_WEBROOT=/app/{{webroot}}`, `LANDO_HOST_IP=host.lando.internal`, `LANDO_DOMAIN=lndo.site`, `LANDO_CA_CERT` and `LANDO_INFO` (the JSON of `lando info`; inside the app use `internal_connection`).
- Services resolve as `<service>.<app>.internal` and by plain service name; the host is `host.lando.internal` (3.22+).

## Proxy

- Default URL `https://{{name}}.lndo.site`, attached to `{{web_service}}`. Each service exposing 80/443 also gets a random `localhost:<port>` URL.
- Extra routes: `proxy: { appserver: ["api.{{name}}.lndo.site", "*.{{name}}.lndo.site"] }`; quote wildcards; only one left-most wildcard gets an automatic certificate.
- Ports 80/443 with fallbacks 8000, 8080, 8888, 8008 / 444, 4433, 4444, 4443, bound to 127.0.0.1.

## Global configuration

`~/.lando/config.yml` (or `LANDO_*` environment variables): `proxy: 'OFF'`, `bindAddress`, `domain`, `networkLimit`, `logLevelConsole`. Apply with `lando poweroff`, then start. Per-app plugin pinning: `plugins: { "@lando/wordpress": <path or version> }`.

<!-- sources: report 08 §1.6, §1.8, §1.9, §2.4 (tooling schema) — https://docs.lando.dev/landofile/ · https://docs.lando.dev/config/env.html · https://docs.lando.dev/landofile/tooling.html · https://docs.lando.dev/landofile/events.html · https://docs.lando.dev/services/lando-3.html · https://docs.lando.dev/landofile/proxy.html · https://docs.lando.dev/config/networking.html · https://docs.lando.dev/config/global.html · https://docs.lando.dev/config/performance.html -->
