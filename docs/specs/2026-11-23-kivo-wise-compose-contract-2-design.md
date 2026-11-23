# kivo-wise: kivo-wp Compose contract 2 (global router) — design

Status: **approved** behaviour. The owner approved the router and the contract bump in wp-kit on
2026-11-23 (wp-kit spec `docs/specs/2026-11-23-wp-kit-router-design.md`, sections S-9 to S-16; decision
wp-kit D-057, question Q-056 `contract-2`). Section S-14 of that spec lists what kivo-wise has to learn
before wp-kit 6.1.0 is released; this document turns those requests into kivo-wise changes. It extends
`docs/specs/2026-11-22-kivo-wise-compose-runner-design.md` (cited as "runner spec S-n") and changes
nothing it decided for contract 1.

wp-kit decisions are cited as "wp-kit D-0NN". kion keeps one spec per project (`.kion/spec.json` still
points at the runner spec); this short design is recorded as Markdown only, like the plan next to it.

## C2-1 Overview

What contract 2 changes in a generated project (wp-kit S-9 to S-13):

- The per-project Caddy `proxy` service, the `HTTPS_PORT`/`HTTP_PORT` keys and the free-port search
  leave the stack. One global Traefik router per machine, container `kivo-wp-router`, owns 80 and 443
  and discovers projects through Docker labels (wp-kit D-034). It is not a service of the project.
- Routed services (`app`, `node`, `mail`) join the external Docker network `kivo-wp`; `db` and `cache`
  stay on the project network (wp-kit D-037). Inside a project, services on `kivo-wp` are reached through
  project aliases (for example `smtp`), never by service name.
- Host names are flat under one wildcard and never carry a port: `https://<host>.<domain>` (site),
  `https://mail-<host>.<domain>` (Mailpit), `https://vite-<host>.<domain>` (Vite HMR). `KIVO_WP_HOST`
  (default: the project name) and `KIVO_WP_DOMAIN` (default `kivowp.dev`) live in `.env` (wp-kit D-042,
  D-043). `KIVO_WP_DOMAIN=localhost` stays available for copies that must not depend on that domain
  (wp-kit D-044).
- Certificates: a real wildcard certificate that `bin/setup` reads from the team vault, or a
  machine-local CA that `bin/setup` creates; `bin/trust-cert` only matters for the local CA
  (wp-kit D-044, D-050). Containers reach their own site by name through `extra_hosts` with
  `host-gateway` (wp-kit D-038).
- `bin/router` (`status`, `restart`, `stop`, `logs`) manages the router; `bin/setup` and `bin/up` start
  it when missing (wp-kit D-040). When Lando's proxy or another process holds 80 or 443, `bin/setup`
  stops and names the fix (`lando poweroff`), it never moves to another port (wp-kit D-041). A resolver
  that drops loopback answers gets an explanation and the `/etc/hosts` line (wp-kit D-054). A second
  checkout on the same host is refused with a `KIVO_WP_HOST` suggestion (wp-kit D-043).
- Places: cloud sessions and CI run the router too, with `/etc/hosts` lines that `bin/setup --cloud` or
  `--ci` write and the local CA; Codespaces runs no router and publishes `app` 8080, `node` 5173 and
  `mail` 8025 to the forwarder (wp-kit D-055); a local devcontainer runs the router inside the workspace
  container and forwards 443 and 80 (wp-kit D-056).
- The marker becomes `x-kivo-wp:` / `contract: 2` (wp-kit D-057). Everything else in the contract stays
  (wp-kit S-14): the block map, the service names `app`, `db`, `cache`, `node`, `mail`, alias-free
  `image:` keys, every `bin/` script sourcing `_lib.sh` (the new `bin/router` too), `-T` on non-TTY
  stdin, `KIVO_WP_CONTEXT`, and the `--ci`/`--cloud`/`--quick` flags.

Today kivo-wise reads contract 2 as an unknown version: it notes `unknown kivo-wp contract 2`, falls
back to image roles, and the app service (built from a Dockerfile, image `kivo-wp/app`) gets no `php`
role. The compose skills describe Caddy, `*.localhost` and the free-port search only.

Goal (requirement, wp-kit D-057): kivo-wise reads contract 1 and contract 2 correctly side by side; 6.0
projects on contract 1 see no change except one new session context line.

Out of scope: the router itself, the certificate job, `wp-kit migrate router` (wp-kit owns them); Lando
projects (no router for Lando, wp-kit D-059).

## C2-2 Detection

- `KIVO_WP_CONTRACT` gains version 2: `app` → `php`, `web`; `db` → `database`; `cache` → `cache`;
  `node` → `node`; `mail` → `mail`. There is no proxy role: `services.proxy` is `null` on contract 2.
- A service named `proxy` in a contract 2 file is not the router and gets no role; the detector notes
  `compose: contract 2 has no proxy service; "proxy" is ignored (the router is the external
  kivo-wp-router)`, so a half-migrated file is visible.
- `runtime.compose` gains `router` (always present, `null` unless contract 2), so the schema keeps
  `additionalProperties: false`:

  ```json
  "router": { "container": "kivo-wp-router", "network": "kivo-wp", "networkDeclared": true }
  ```

  `container` and `network` are fixed by the contract (wp-kit D-034, D-037). `networkDeclared` is true
  when the merged Compose files declare a top-level network `kivo-wp`; when false the detector adds the
  note `compose: contract 2 but no kivo-wp network declared; routed services cannot reach the router`.
  The detector still runs no process: whether the router container is running is a question for
  `bin/router status`, not for the detector.
- Contract 1 output is unchanged (`router: null`, `services.proxy: "proxy"`). An unknown higher version
  keeps the existing note and the image fallback.
- The detector never reads `.env`, so it reports neither `KIVO_WP_HOST` nor `KIVO_WP_DOMAIN`: the site
  URL keeps coming from `bin/info` (runner spec S-3).

## C2-3 Session context

The session context gains one line for Compose projects that declare a known contract, after the
runner line:

- contract 1: `compose: kivo-wp contract 1 · TLS by the proxy service (Caddy, *.localhost); the site URL and its port come from bin/info`
- contract 2: `compose: kivo-wp contract 2 · TLS by the global router kivo-wp-router (network kivo-wp, no proxy service); the site URL https://<host>.<domain> has no port and comes from bin/info`

No line without a contract or on another runner. The line costs about 150 characters of the 1,500
character budget; the skills line stays the one that shrinks.

## C2-4 Skills and references

| File | Change |
|---|---|
| `compose-wp` `SKILL.md` | description and When to use name both host schemes; Inputs read `runtime.compose.router`; step 1 names the contract 2 services (no `proxy`); verification without `-k` on either contract, `bin/trust-cert` only for Caddy's CA (contract 1) or the local CA (contract 2); failure rows split by contract: contract 1 keeps "`bin/setup` picks a free port", contract 2 gets Lando's proxy on 80/443 (`lando poweroff`), DNS rebinding, two checkouts on one host, router not running |
| `compose-wp` `tls-and-hosts.md` | two sections: contract 1 (Caddy, `*.localhost`, port from `bin/info`) and contract 2 (router, flat names, wildcard certificate or local CA, `bin/router`, `extra_hosts`, DNS rebinding, `KIVO_WP_DOMAIN`) |
| `compose-wp` `compose-file.md` | services table per contract; the `kivo-wp` network and the alias rule; labels are generated, not hand-edited; the marker example for both versions |
| `compose-wp` `bin-scripts.md` | contract 2 adds `bin/router`; `bin/trust-cert` only for the local CA; `bin/dev` serves through the proxy (1) or the router (2); `bin/info` has no port on contract 2 |
| `compose-wp` `failure-modes.md` | rows per contract as in the skill, plus router-specific rows (another process on 80/443, resolver drops loopback answers, host already routed, router older than the project) |
| `compose-wp` `wsl2.md`, `devcontainer-and-cloud.md` | Windows trust and reach per contract; router per place (cloud and CI with `/etc/hosts` and the local CA, Codespaces without router, devcontainer with the router inside) |
| `testing-wp` `playwright.md` (and the headed-run line of `SKILL.md`) | Compose base URL from `bin/info`: `https://<host>.<domain>` with no port on contract 2, `https://<project>.localhost[:port]` on contract 1, the forwarded URL in Codespaces; with `extra_hosts` in `compose.yaml`, browsers in containers need no host mapping; keep a `--host-resolver-rules` mapping the project already has |
| `tailwind-vite-assets` `dev-server.md` | Compose HMR: contract 1 through Caddy at `vite.<project>.localhost`; contract 2 through the router at `vite-<host>.<domain>` on 443 (`clientPort: 443`), no `HTTPS_PORT`; Codespaces uses the forwarded Vite port |
| `roots-triage` `output-fields.md`, `triage.schema.json` | `router` field, contract 2 service names, the two notes |
| `roots-router` `decision-tree.md`, `keywords.json` | the `*.kivowp.dev` certificate and `bin/router` route to `compose-wp` |
| `docs/guide/skills.md` | `compose-wp` row names both host schemes |

Skill markdown keeps naming no AI tool (validator rule); cloud sessions stay "cloud agent sessions".

## C2-5 Tests

- Fixture `compose-router`: a contract 2 `compose.yaml` (no `proxy`, the `kivo-wp` external network,
  labels, `extra_hosts`) with the same `bin/` scripts plus `bin/router`.
- Detector tests: contract 2 roles (`php`/`web` on `app`, `proxy` null), `router` filled, no unknown
  contract note; a leftover `proxy` service is ignored with the note; a missing network gives
  `networkDeclared: false` and its note; contract 1 output unchanged (`router: null`).
- Session-start golden `sage-compose-router` and the new `compose:` line in `sage-compose`.
- `compose-wp` skill test: both contracts are described; the free-port row is tied to contract 1.
- Router prompt review: a contract 2 certificate prompt routes to `compose-wp`.

## C2-6 Release

Additive and minor (runner spec D-018): `runtime.compose.router` is new, nothing is removed. It must be
released before wp-kit 6.1.0 (wp-kit D-057). release-please proposes the version; the owner authorises
the release.
