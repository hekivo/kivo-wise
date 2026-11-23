# The bin/ scripts (kivo-wp contract)

Loader note: open this page from `compose-wp` steps 1 to 3 when you need to know which script exists, what it runs, or which flag `bin/setup` takes.

The contract is owned by wp-kit, which generates and versions it. kivo-wise reads it; it never redefines it. When a script behaves differently from this page, the project's `bin/<script> --help` and wp-kit's documentation win.

## Contract versions 1 and 2

Both versions have the scripts below; the differences are marked. Every script sources `bin/_lib.sh` from its own directory and runs `docker compose exec` in the right service, adding `-T` when stdin is not a terminal (pipes, CI, stdio MCP clients). Run them from the project root.

| Script | Runs | Notes |
|---|---|---|
| `bin/wp` | WP-CLI in `app` | Acorn is `bin/wp acorn <cmd>`; there is no separate `bin/acorn` in contract 1 |
| `bin/composer` | Composer in `app` | `--working-dir=<container path>` for a theme or plugin project |
| `bin/php` | PHP CLI in `app` | |
| `bin/npm`, `bin/node` | npm and Node in `node` | |
| `bin/build`, `bin/dev` | production build, Vite dev server | `bin/dev` serves through the `proxy` service (contract 1) or the global router at `vite-<host>.<domain>` (contract 2) |
| `bin/test` | the PHP test suite | |
| `bin/e2e` | the browser test suite | |
| `bin/stan`, `bin/mago` | static analysis, lint and format | `bin/mago` is the `lint` runner |
| `bin/flush` | object cache, Acorn caches, rewrites | the `cache` runner |
| `bin/logs` | `docker compose logs -f` for the services | the `logs` runner |
| `bin/info` | URLs, login; the chosen ports on contract 1 | the only source of the site URL; contract 2 URLs have no port |
| `bin/setup` | first run: build, start with health checks, install dependencies, seed synthetic data | idempotent; on contract 2 it also starts the router, installs the certificate and checks DNS |
| `bin/up`, `bin/down` | start and stop the stack | `bin/down --volumes` deletes the data volumes; on contract 2 `bin/up` starts the router when missing and `bin/down` leaves it running |
| `bin/router` | contract 2 only: `status`, `restart`, `stop`, `logs` of the global `kivo-wp-router` | `status` lists the routed hosts; `stop` affects every project on the machine |
| `bin/db`, `bin/db-import`, `bin/db-export` | database client shell, import, export | |
| `bin/seed` | synthetic data | never production data |
| `bin/xdebug` | Xdebug control in `app` | read `bin/xdebug --help` for its arguments |
| `bin/trust-cert` | contract 1: exports Caddy's root CA; contract 2: the machine-local CA; prints the trust command per OS | not needed on contract 2 with the team's wildcard certificate; see `tls-and-hosts.md` |

## Place flags of `bin/setup`

The setup flag per place comes from the contract version and is chosen from `runtime.session.kind`:

| `runtime.session.kind` | Command |
|---|---|
| `local`, `devcontainer`, `codespaces` | `bin/setup` |
| `cloud` (cloud agent session) | `bin/setup --cloud` |
| CI pipeline | `bin/setup --ci` |

These are the names contracts 1 and 2 document. If `bin/setup --help` lists different ones, use those and report the difference.

## How the detector recognises a script

A file in `bin/` counts when it is executable and its first 4 KB source `_lib.sh` from their own directory, call `docker compose` (or `docker-compose`), or call another `bin/` script. Anything else, such as Composer vendor binaries when `config.bin-dir` is `bin`, is ignored with a note. Without an executable `bin/wp`, the runner map falls back to `docker compose exec -T <php service> wp …`.

## MCP over stdio

`bin/wp` works as the `command` of a stdio MCP server because it adds `-T` on a pipe. A relative `bin/wp` resolves against the directory the client starts the server in: verify with the adapter handshake, and write an absolute path at setup time when the client does not start servers in the project root.

Sources: https://docs.docker.com/reference/cli/docker/compose/exec/ · https://docs.docker.com/reference/cli/docker/compose/logs/
