# The Compose file

Loader note: open this page from `compose-wp` step 1 when you need to read or change `compose.yaml`, the override, env files or profiles.

## Files Compose reads

- The project file at the root, the first that exists of `compose.yaml`, `compose.yml`, `docker-compose.yaml`, `docker-compose.yml`. kivo-wp projects use `compose.yaml`, and it is the only stack: there is no second Compose file under `.devcontainer/`.
- The override, merged on top: `compose.override.yaml` (or `compose.override.yml`, `docker-compose.override.yml`). In kivo-wp projects it is personal and gitignored. Compose merges maps key by key, appends some lists (`ports`, `volumes` by target) and replaces scalars, so an override changes one value without copying the service.
- `COMPOSE_FILE` in the environment replaces that default list. The kivo-wise detector does not follow it and says so in a note; if the project sets it, read the files it names by hand.
- `docker compose config` prints the merged result. Run it to check a change; it also prints interpolated environment values, so never paste its output when it contains secrets.

## Services of the kivo-wp contract

Contracts 1 and 2 share the service names; contract 2 has no `proxy` service.

| Service | Role | Notes |
|---|---|---|
| `app` | PHP-FPM and nginx in one image, with WP-CLI and Composer | target of `bin/wp`, `bin/composer`, `bin/php`; the `php` and `web` roles of the triage JSON |
| `db` | MySQL 8.4 | `DB_HOST=db`; the data lives in a named volume |
| `cache` | Valkey | object cache; `WORDPRESS_REDIS_HOST=cache` |
| `node` | npm and the Vite dev server | target of `bin/npm`, `bin/node`, `bin/dev`, `bin/build` |
| `proxy` | contract 1 only: Caddy, TLS for `*.localhost` | see `tls-and-hosts.md` |
| `mail` | Mailpit | catches outgoing mail; web UI at `https://mail.<project>.localhost` (contract 1) or `https://mail-<host>.<domain>` (contract 2) |

On contract 2, TLS belongs to the global router `kivo-wp-router`, which is not in the file:

- `app`, `node` and `mail` carry generated `traefik.*` labels (host rule, entrypoint, the container port) and join the external network `kivo-wp`, declared at the top level as `networks: kivo-wp: external: true`. The detector reports it as `runtime.compose.router` and notes when the network is not declared.
- `app`, `node` and `mail` also carry `extra_hosts` entries that map the site, `mail-` and `vite-` names to `host-gateway`.
- Inside the project, those services are reached through aliases on the default network (for example `smtp`), not by service name.
- Do not add `ports:` for 80 or 443 and do not edit the labels by hand: the host comes from `KIVO_WP_HOST` and `KIVO_WP_DOMAIN` in `.env`, and the router owns the ports. A `proxy` service left in a contract 2 file is not the router; the detector ignores it with a note.

Without the contract, roles come from images (`php`, `nginx`, `mysql`, `redis`, …); a service built from a `Dockerfile` with a non-contract name has no inferable role, and the detector leaves it out with a note.

## Environment and env files

- `environment:` sets values in the service; `env_file:` loads a file into the service. Both apply on the next `docker compose up -d`, which recreates the service. `docker compose restart` does **not** re-read them.
- `.env` next to `compose.yaml` is read by Compose for variable interpolation in the file itself (`${WORDPRESS_DB_PASSWORD}`); it is not injected into containers unless a service lists it under `env_file:`.
- Secrets never go into `compose.yaml` or the override. Keep them in the files the project gitignores, or in the place the project documents.

## Profiles, include and extends

- A service with `profiles: [tools]` starts only with `docker compose --profile tools up -d`. Check `profiles:` before concluding a service is missing.
- `include:` pulls services from other files and `extends:` copies a service definition. The detector does not follow either (a note says so); read the target files by hand.

## The `x-kivo-wp` contract marker

The project declares its `bin/` contract with a top-level extension field written as a block map:

```yaml
x-kivo-wp:
  contract: 2
```

Version 1 is wp-kit 6.0 (per-project proxy), version 2 is wp-kit 6.1 and later (global router). Compose ignores `x-` keys. The detector reads this block map only: a flow map (`x-kivo-wp: { contract: 1 }`) is not read and the contract counts as absent. A known version fixes the service and script names; a higher version produces a note and the detector falls back to reading what exists.

Anchors are common in Compose files (`x-env: &env` plus `<<: *env`). The detector reads the block under an anchor and skips merge keys and aliases with a note, without resolving them. Keep `x-kivo-wp`, service names and `image:` keys free of aliases so detection stays exact.

## Editing rules

- Team settings in `compose.yaml`, personal ones in the override. The kivo-wise hooks deny edits to a gitignored override; propose the change to the user.
- After an edit: `docker compose config --quiet` (syntax), then `docker compose up -d`.

Sources: https://docs.docker.com/compose/intro/compose-application-model/ · https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/ · https://docs.docker.com/compose/how-tos/environment-variables/ · https://docs.docker.com/compose/how-tos/profiles/ · https://docs.docker.com/reference/compose-file/extension/
