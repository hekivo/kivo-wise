# Failure modes: Symptom, Cause, Fix

Loader note: open this page from `compose-wp` step 6 when the symptom is not in the short table of the skill.

| Symptom | Cause | Fix |
|---|---|---|
| `bin/setup` or `bin/up`: "port is already allocated" for 443 or 80 | Another stack or a Lando proxy holds the host port | `bin/setup` picks a free port: read the chosen one from `bin/info`; or stop the other stack and run `bin/up` |
| `bin/wp`: service "app" is not running | The stack is stopped (a new cloud agent session, a reboot, `bin/down`) | `docker compose ps`, then `bin/up` (`bin/setup` on the first run) |
| Files written by the container belong to root or another user | The image user does not match the host UID/GID | Rebuild with the UID/GID build args the project defines: `docker compose build app && docker compose up -d` |
| Every request is slow, Vite does not see changes | Repository on `/mnt/c` in WSL2 | Move the repository to the Linux filesystem (`~/projects`); see `wsl2.md` |
| Certificate not trusted in the Windows browser | Caddy's root CA is only trusted on the Linux side | `bin/trust-cert`, then `certutil -addstore -f ROOT \\wsl.localhost\<distro>\…` from an elevated prompt; Firefox `security.enterprise_roots.enabled`; see `wsl2.md` |
| Certificate not trusted after recreating the stack | The proxy's data volume was deleted, so Caddy created a new CA | Run `bin/trust-cert` again and re-import |
| `docker: command not found` | The shell is in the app container (older editor template), not the workspace container or the host | Reopen in the workspace container from `.devcontainer/devcontainer.json`; see `devcontainer-and-cloud.md` |
| "Cannot connect to the Docker daemon" | Docker Desktop not running or its WSL integration off for this distribution; Engine service stopped | Start Docker Desktop and enable the integration, or `sudo systemctl start docker`; check `docker context ls` |
| `db` stays `starting` or `unhealthy`, `app` waits forever | Database health check never passes: a wrong password in the env file, a data volume from another MySQL major version, or a full disk | `docker compose logs db`; fix the value and `docker compose up -d`; for a major-version mismatch export, ask, then `bin/down --volumes` and `bin/setup` |
| "Error establishing a database connection" | `DB_HOST` is `localhost` or `127.0.0.1` | Use the service name: `DB_HOST=db` |
| Stdio MCP server hangs, or its output starts with control characters | A TTY was allocated on a pipe (`docker compose exec` without `-T`) | Use `bin/wp` (adds `-T` when stdin is not a terminal) or `docker compose exec -T app wp …` |
| Image pull or `composer install` fails with a proxy `403` in a cloud agent session | The host is not in the session's network allowlist | Add it to the allowlist; the hosts are listed in `devcontainer-and-cloud.md` |
| Change in `compose.yaml` or an env file has no effect | `docker compose restart` does not re-read the configuration | `docker compose up -d` |
| Change in the `Dockerfile` has no effect | `up -d` reuses the built image | `docker compose build <service> && docker compose up -d` |
| A service from the file is missing in `docker compose ps` | It belongs to a profile | `docker compose --profile <name> up -d` |
| `bin/composer` fails on ACF Pro with 401 or 403 | The Composer credential is missing in this place | Ask where the project provides it; never ask for the value or put it in a file or an environment variable; in a cloud agent session the proxy attaches it |
| OPcache keeps serving old PHP after a deploy-like change | PHP-FPM caches compiled files | `docker compose restart app` |

Sources: https://docs.docker.com/compose/how-tos/startup-order/ · https://docs.docker.com/reference/cli/docker/compose/up/ · https://docs.docker.com/reference/cli/docker/compose/exec/ · https://docs.docker.com/desktop/features/wsl/
