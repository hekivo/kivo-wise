# Dev server and HMR through Lando or Docker Compose

Deep reference for the Vite dev server. Loaded on demand from `SKILL.md`. Container networking details are in the `lando-wp` skill (Lando) and the `compose-wp` skill (Docker Compose).

## How hot reload works

1. `{{runner.node}} run dev` starts Vite. `laravel-vite-plugin` writes the hot file (`public/hot`) containing the dev-server URL.
2. Acorn's `Vite` class treats an existing hot file as "running hot": `@vite` and `Vite::asset()` emit dev-server URLs instead of manifest URLs.
3. The browser loads JS/CSS from the dev server and opens a WebSocket for HMR to the host and port given in `server.hmr`.
4. On stop, the plugin deletes the hot file. A killed container leaves it behind (see the stale-hot-file row in `SKILL.md`).

## Settings that must agree

| Setting | Why |
|---|---|
| `server.host: '0.0.0.0'` | The server runs in a container; the host must be able to reach it |
| `server.port` + `strictPort: true` | A fixed port that the container publishes; fail instead of moving to another port |
| Published port in the landofile | The container must publish the same port to the host (the Node service or the PHP service, wherever Vite runs) |
| `server.hmr.host` and `server.hmr.port` | The address the BROWSER uses for the WebSocket. In the reference projects it is `localhost` and the published port |
| CORS | The page origin (`https://<app>.lndo.site`) differs from the dev server origin, and module scripts need CORS. `laravel-vite-plugin` allows localhost, the value of `APP_URL` in the Node environment, and `*.test` by default; a `.lndo.site` origin is allowed only if `APP_URL` is set to the site URL when Vite starts, or if you set `server.cors.origin` yourself |
| `base` in dev | Plugin configs use `/` for the dev server and the real URL path only for `build` |

The reference projects reach the dev server at `localhost:<port>` over plain HTTP from an HTTPS page; browsers treat `localhost` as a trustworthy origin for this. Putting the dev server behind a TLS hostname needs a proxy that terminates TLS for that port; Lando's proxy only routes the web ports, so do not set a `wss` protocol unless something terminates TLS.

## Docker Compose (kivo-wp)

Vite runs in the `node` service (`bin/dev`), with `server.host: '0.0.0.0'`, a fixed `server.port` and `strictPort: true` as above. The browser reaches it through TLS, so `server.hmr` names an HTTPS host. Which host depends on `runtime.compose.contract.version`; the URLs `bin/info` prints are the reference.

| Contract | Dev server URL the browser uses | `server.hmr` |
|---|---|---|
| 1 (per-project `proxy` service) | `https://vite.<project>.localhost`, plus the HTTPS port `bin/setup` chose when 443 was taken | `host: 'vite.<project>.localhost'`, `protocol: 'wss'`, `clientPort` = that HTTPS port |
| 2 (global router `kivo-wp-router`) | `https://vite-<host>.<domain>` (default domain `kivowp.dev`), no port | `host: 'vite-<host>.<domain>'`, `protocol: 'wss'`, `clientPort: 443`; `HTTPS_PORT` no longer exists |
| Codespaces (either) | the forwarded URL of the Vite port (5173) | that forwarded host with `clientPort: 443` |

- On contract 2 the router passes the WebSocket through; the `node` service carries the router labels for port 5173. Do not publish 5173 with `ports:` and do not point HMR at `localhost`.
- The page origin is the site URL (`https://<host>.<domain>` on contract 2), so set `APP_URL` for the Vite process to it, or list it in `server.cors.origin`.
- WSL2: the names resolve to `127.0.0.1`, which WSL forwards to Windows; certificate trust is in `compose-wp`.

## Where Node runs

| Profile | Typical placement |
|---|---|
| `sage-theme` | Node installed in the PHP service (tooling runs `npm`/`yarn` there) or a dedicated Node service |
| `acorn-mu-plugin` | Node installed in the PHP service; the dev server port is published by that service; a tooling command runs Vite from the plugin folder |
| `radicle-app` | A separate Node service (`build`); the dev server port is published by that service; the build step also runs there |

When Node is a separate service, files are shared through the mounted app folder, so the hot file written by Node is visible to PHP. Commands for Vite must run in the Node service, not in the PHP service.

## Choosing the port

Vite's default is 5173. If another Lando app on the same machine already publishes it, `strictPort` makes the second server fail. Choose a distinct port per project (for example 5174), set it in `vite.config.js`, in the landofile `ports`, and in `hmr.port`; then `lando rebuild` for the landofile change.

## Troubleshooting

| Symptom | Check |
|---|---|
| Browser console: WebSocket connection failed | `hmr.host`/`hmr.port` match the published port; the port is published (`lando info`); nothing else uses it |
| Console: blocked by CORS policy on the module script | Set `APP_URL` for the Node process to the Lando site URL, or list the origin in `server.cors.origin` |
| Assets load but never update | The file is not in `input`; or a polling watcher is needed on network file systems (set `server.watch.usePolling`) |
| Mixed content blocked | A non-localhost HTTP dev host on an HTTPS page; use `localhost` or terminate TLS |
| Dev server not reachable from Windows browser | WSL2 localhost forwarding; see `lando-wp` or `compose-wp` |
| Compose contract 2: HMR WebSocket fails with a port in the URL | A contract 1 setting (`HTTPS_PORT`, `vite.<project>.localhost`) is left in `vite.config.js` | `hmr.host` = `vite-<host>.<domain>`, `clientPort: 443`; restart `bin/dev` |
| Blade edits do not reload the page | `refresh: true` (or explicit globs) in the `laravel()` options |

## Production parity

Before reporting a front-end task done, stop the dev server, run `{{runner.node}} run build`, confirm the hot file is gone, and load the page once with built assets.
