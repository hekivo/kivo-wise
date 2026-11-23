# Editor devcontainers and cloud agent sessions

Loader note: open this page from `compose-wp` step 2 when `runtime.session.kind` is not `local`, or when Docker, the network or a credential behaves differently from a developer machine.

The same `compose.yaml` and the same `bin/` scripts run in three places. What changes is where the shell runs and what the network lets through.

| `runtime.session.kind` | Where the shell runs | Docker |
|---|---|---|
| `local` | the developer's machine (or its WSL2 distribution) | Docker Desktop or Docker Engine |
| `devcontainer`, `codespaces` | the **workspace container** that the generated `.devcontainer/devcontainer.json` opens (a devcontainer base image with Docker-in-Docker) | the Docker daemon inside the workspace container |
| `cloud` | the virtual machine of a cloud agent session, with the repository cloned | Docker and `docker compose` on that machine |

In every place `bin/*` call `docker compose exec` the same way. If `docker` is not found, the shell is in the wrong container: the older template attached the editor to the PHP container (`.devcontainer/docker-compose.yml` with `app`, `web`, `db`, `redis`), where `docker compose exec` does not exist. The detector notes that layout and never uses it as the runner.

## Editor devcontainers

- The workspace container runs the project's `compose.yaml` itself; open the folder with the editor's "reopen in container" action, then follow `compose-wp` from step 2.
- The generated `devcontainer.json` sets `containerEnv.KIVO_WP_CONTEXT=devcontainer`, which is how the hooks and the detector recognise the place.
- The kivo-wise hooks need Node.js 20+ in the workspace container. Until the devcontainer adds the Node feature, the hooks stay silent and the skills still work from `roots-triage`.

## Cloud agent sessions

- **The stack starts per session.** The environment cache keeps pulled images and installed files but no running containers. Run `docker compose ps` first, then `bin/setup --cloud` (or `bin/up` when the setup already ran in this session).
- **Network allowlist.** The default allowlist of a cloud agent session covers GitHub, Docker Hub, `ghcr.io`, `mcr.microsoft.com`, `packagist.org`, `repo.packagist.org`, `registry.npmjs.org` and the Ubuntu archives. A kivo-wp project also needs:

  | Host | Why |
  |---|---|
  | `wpackagist.org` | WordPress plugins and themes through Composer |
  | `api.wordpress.org`, `downloads.wordpress.org` | WordPress core and translations |
  | `pkg-containers.githubusercontent.com` | image layers served for `ghcr.io` |
  | `connect.advancedcustomfields.com` | ACF Pro through Composer |
  | `developer.wordpress.org`, `roots.io`, `docs.docker.com`, `containers.dev` | official documentation when no corpus is available |

  Failure: an image pull or a package install stops with a proxy `403`. Fix: add the host above to the environment's allowlist; do not work around the proxy.
- **Secrets.** The only project secret a cloud agent session needs is the ACF Pro Composer credential. The session proxy attaches it as a network secret for `connect.advancedcustomfields.com`, so it never enters the machine, a file, an environment variable or the chat. Environment variables of a cloud environment are readable by every user of that environment: never suggest putting a token there, and never ask the user for a token value. `auth.json` stays denied by the hooks.
- **Data.** Cloud agent sessions and hosted devcontainers receive the repository and synthetic fixtures only (`bin/seed`, `bin/setup`). Never import a production dump there.
- **Docs.** The configured corpus is usually not checked out in these places; the session context then says `corpus: unavailable in this environment` and documentation comes from the official hosts above.

Sources: https://containers.dev/implementors/json_reference/ · https://containers.dev/features · https://github.com/devcontainers/features/tree/main/src/docker-in-docker · https://docs.docker.com/compose/
