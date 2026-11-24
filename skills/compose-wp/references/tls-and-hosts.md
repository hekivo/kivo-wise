# TLS and host names

Loader note: open this page from `compose-wp` step 6 or the verification section when a browser or `curl` rejects the certificate, or a host name does not resolve.

Which half applies depends on the contract the project declares (`runtime.compose.contract.version`, also on the `compose:` line of the session context). Contract 1 is what wp-kit 6.0 generates; contract 2 is wp-kit 6.1 and later.

## Contract 1: the per-project proxy

### Hosts

The `proxy` service (Caddy) terminates TLS for:

| URL | Goes to |
|---|---|
| `https://<project>.localhost` | the site (`app`) |
| `https://vite.<project>.localhost` | the Vite dev server in `node` |
| `https://mail.<project>.localhost` | the Mailpit web UI |

`*.localhost` resolves to the loopback address without a hosts entry in current browsers and in most resolvers. When a command-line tool does not resolve it, use `curl --resolve <project>.localhost:443:127.0.0.1 …`. When `bin/setup` had to pick another HTTPS port because 443 was taken, the URLs carry that port; `bin/info` prints the real ones.

### Certificates

- Caddy issues the certificates from its own local CA (`tls internal`). Nothing is trusted until that CA is imported.
- `bin/trust-cert` exports Caddy's root CA to a file and prints the trust command for the current OS. Run it once per machine (and again after the proxy volume is deleted, which creates a new CA).

## Contract 2: the global router

### Router

- One router per machine, the container `kivo-wp-router` (Traefik), owns 80 and 443. It is not a service of `compose.yaml`: projects register through the labels wp-kit generates on `app`, `node` and `mail`, and those services join the external Docker network `kivo-wp`. `db` and `cache` stay on the project network.
- `bin/setup` and `bin/up` start the router when it is missing; a project that pins a newer router version replaces it, an older project keeps the running one. `bin/down` stops only the project.
- `bin/router status` lists the routed hosts (there is no dashboard), `bin/router logs` follows the router log, `bin/router restart` and `bin/router stop` act on the router for every project on the machine.
- The labels are generated: change the host name through `.env`, not by editing labels.

### Hosts

Names are flat under one wildcard and never carry a port:

| URL | Goes to |
|---|---|
| `https://<host>.<domain>` | the site (`app`) |
| `https://vite-<host>.<domain>` | the Vite dev server in `node` |
| `https://mail-<host>.<domain>` | the Mailpit web UI |

- `<host>` is `KIVO_WP_HOST` and `<domain>` is `KIVO_WP_DOMAIN`, both in `.env`; the defaults are the project name and `kivowp.dev`. A copy that must not depend on that domain sets `KIVO_WP_DOMAIN=localhost`. `bin/info` prints the real URLs; the detector never reads `.env`.
- `*.kivowp.dev` is public DNS pointing to `127.0.0.1`. Some resolvers drop public answers that point to loopback (DNS rebinding protection in home routers, dnsmasq, pfSense): `bin/setup` checks the answer and prints the fix (allow the domain on the resolver, or the exact `/etc/hosts` line). It writes `/etc/hosts` itself only in cloud agent sessions and CI.
- Containers reach their own site by the same name: `extra_hosts` maps the three names to `host-gateway`, so WP-Cron, Site Health, REST loopbacks and browser tests in a container go through the router with the browser's certificate.
- Two checkouts of the same project (for example worktrees) need different hosts: `bin/setup` refuses a host another running project already routes and suggests `KIVO_WP_HOST=<project>-<branch>`.
- Inside a project, services on `kivo-wp` are reached through project aliases on the default network (for example `smtp` for mail), never by service name: every project has an `app` and a `mail` on the shared network.

### Certificates

- `.dev` is on the browsers' HSTS preload list, so an untrusted certificate cannot be clicked through. Every place needs a trusted certificate.
- With access to the team's certificate item, `bin/setup` copies the real wildcard certificate for `*.kivowp.dev` into the router's state directory (outside the project); nothing needs to be trusted. `bin/up` never reads the vault and only warns when the local copy expires within 14 days; run `bin/setup` to refresh it.
- Without that access, and in cloud agent sessions and CI, `bin/setup` creates a machine-local CA once and signs the same three names. `bin/trust-cert` prints the trust commands for that CA; it is the only case where `bin/trust-cert` is needed.
- The certificate key never goes into the project, a Compose file, a log or a cloud agent session. Never ask for it and never print it.

## Both contracts

- Linux: the command `bin/trust-cert` prints adds the CA to the system store; browsers with their own store (Firefox) need it imported there or enterprise roots enabled.
- Windows browsers with the project in WSL2: see `wsl2.md`.
- `curl -I <site URL>` must pass without `-k`. `-k` is a diagnostic only: it tells "certificate not trusted" apart from "site down", and it hides the failure the check exists to catch.

Sources: https://caddyserver.com/docs/caddyfile/directives/tls · https://caddyserver.com/docs/automatic-https#local-https · https://doc.traefik.io/traefik/reference/install-configuration/providers/docker/ · https://doc.traefik.io/traefik/reference/routing-configuration/http/tls/tls-certificates/ · https://docs.docker.com/reference/cli/docker/container/run/ · https://docs.docker.com/compose/how-tos/networking/
