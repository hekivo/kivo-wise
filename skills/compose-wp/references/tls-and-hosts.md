# TLS and host names

Loader note: open this page from `compose-wp` step 6 or the verification section when a browser or `curl` rejects the certificate, or a host name does not resolve.

## Hosts

The `proxy` service (Caddy) terminates TLS for:

| URL | Goes to |
|---|---|
| `https://<project>.localhost` | the site (`app`) |
| `https://vite.<project>.localhost` | the Vite dev server in `node` |
| `https://mail.<project>.localhost` | the Mailpit web UI |

`*.localhost` resolves to the loopback address without a hosts entry in current browsers and in most resolvers. When a command-line tool does not resolve it, use `curl --resolve <project>.localhost:443:127.0.0.1 …`. When `bin/setup` had to pick another HTTPS port because 443 was taken, the URLs carry that port; `bin/info` prints the real ones.

## Certificates

- Caddy issues the certificates from its own local CA (`tls internal`). Nothing is trusted until that CA is imported.
- `bin/trust-cert` exports Caddy's root CA to a file and prints the trust command for the current OS. Run it once per machine (and again after the proxy volume is deleted, which creates a new CA).
- Linux: the printed command adds the file to the system store; browsers with their own store (Firefox) need the CA imported there or enterprise roots enabled.
- Windows browsers with the project in WSL2: see `wsl2.md`.
- `curl -I https://<project>.localhost` must pass without `-k`. `-k` is a diagnostic only: it tells "certificate not trusted" apart from "site down", and it hides the failure the check exists to catch.

Sources: https://caddyserver.com/docs/caddyfile/directives/tls · https://caddyserver.com/docs/automatic-https#local-https · https://docs.docker.com/compose/how-tos/networking/
