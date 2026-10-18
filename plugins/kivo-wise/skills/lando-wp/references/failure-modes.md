# Failure modes: Symptom, Cause, Fix

Loader note: open this page from `lando-wp` step 7 when the symptom is not in the short table of the skill.

| Symptom | Cause | Fix |
|---|---|---|
| `lando start` hangs on "Scanning to determine which services are ready", or URLs are red | Proxy cannot route; DNS rebinding protection; no internet | `nslookup {{name}}.lndo.site`; use `http://localhost:<port>` from `lando info`; hosts entry; allowlist `lndo.site` on the router; `lando restart` |
| URL is `localhost:8000`/`:8888` instead of port 80; "port is already allocated" | Another process holds 80/443 | `sudo lsof -n -i :80 \| grep LISTEN`; stop it, or accept fallback ports |
| Browser: certificate not trusted | Lando CA not in the store the browser uses (WSL CA invisible to Windows) | `certutil -addstore -f "ROOT" \\wsl.localhost\<distro>\home\<user>\.lando\certs\LandoCA.crt`; Firefox enterprise roots; `docker rm -f landoproxyhyperion5000gandalfedition_proxy_1 && lando rebuild -y` |
| Tooling fails with "No such service" | `service:` in the tooling entry names a service that does not exist | Fix the entry, or `lando ssh -s <real-service> -c <cmd>` |
| `lando <tool>` unknown after editing `tooling:` | Tooling-route cache | `lando --clear`, then `lando` |
| `wp: command not found`; WP-CLI build step fails and later steps are skipped | WP-CLI phar download from GitHub blocked | `HTTP_PROXY`/`HTTPS_PROXY` in an env file; or install a pinned phar in `build_as_root`; `lando rebuild -y` |
| `composer: command not found` | `composer_version: false` without an installer, or failed build steps | Check `build_as_root`; `lando rebuild -y`; read `lando logs -s appserver` |
| Build step fails on every start | Failed build steps re-run each start until they succeed | Read the error, fix it, `lando rebuild -y` |
| "This does not seem to be a WordPress installation" | Ran outside the reach of `wp-cli.yml`, or wrong `path` | Run from the root; `lando wp --path=/app/{{core_path}} ...` |
| WordPress: connection refused / access denied | `.env` uses `localhost` or wrong credentials | `DB_HOST=database`; credentials from `lando info` (`wordpress` by default) |
| Env var from an env file not visible in the container | `env_file` nested under `config:`, or file changed without rebuild | Move `env_file` to the top level; `lando rebuild -y`; or rely on PHP dotenv |
| `.env` edits not applied | OPcache or object cache | `{{runner.cache}}` or `lando wp cache flush`; `lando restart` for OPcache |
| `lando start` slow, runs installs and builds every time | Installs placed in `pre-start` events | Expected; run only the tooling you need, or move installs to build steps (project decision) |
| Port 5173/5174 "already allocated" | Another app publishes the same host port | Stop it, change `services.<svc>.ports`, or `lando poweroff` |
| Database will not start after changing `database:` or credentials | Data directory incompatible; credentials fixed at first start | `lando db-export` first, then `lando destroy -y && lando start` |
| `the input device is not a TTY` | Non-TTY shell (Git Bash minTTY) | Use the WSL terminal, PowerShell or `cmd.exe` |
| Xdebug never stops at breakpoints | Mode off, wrong `client_host`, IDE not listening | `xdebug: true` + rebuild; `XDEBUG_CONFIG` with `host.docker.internal` and `extra_hosts`; `?XDEBUG_SESSION_START=LANDO`; read `/tmp/xdebug.log` |
| Everything slow (pages, composer) | Repo on `/mnt/c`, or slow Docker file sharing | Move the repo to the WSL home; `excludes: [vendor, node_modules]` + rebuild |
| `Cannot connect to the Docker daemon` / `ENOENT /var/run/docker.sock` | Docker Desktop stopped, WSL integration off, or Docker Engine stopped | Start Docker and enable integration for the distro; `docker context ls`; `lando config --path engineConfig` |
| `Lando has detected you are at Docker's network limit` | More than 32 Docker networks | `lando poweroff`; `docker network prune`; or raise `networkLimit` |
| Permission errors in `~/.lando/config` or `~/.lando/scripts` after an update | Stale helper scripts | `lando poweroff && rm -rf ~/.lando/config ~/.lando/scripts && lando update` |
| IDE runner: `php_network_getaddresses: getaddrinfo failed` | IDE container not on the Lando network | Set its network to `<app>_default` |
| Nothing works, state is corrupt | Broken containers or cache | `lando rebuild -y`; last resort `lando poweroff && docker system prune -a --volumes && rm -rf ~/.lando/cache` (destroys all local databases; export first) |

<!-- sources: report 08 §2.13 and §5.5 — https://docs.lando.dev/help/dns-rebind.html · https://docs.lando.dev/landofile/proxy.html · https://docs.lando.dev/config/security.html · https://docs.lando.dev/help/proxy.html · https://docs.lando.dev/guides/lando-corporate-network-tips.html · https://docs.lando.dev/config/performance.html · https://docs.lando.dev/help/updating.html · https://docs.lando.dev/help/purging-containers.html · https://docs.lando.dev/plugins/php/config.html · https://docs.lando.dev/config/networking.html -->
