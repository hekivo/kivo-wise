# Docker Compose on WSL2

Loader note: open this page from `compose-wp` step 6 when the project runs in a WSL2 distribution and the problem involves Docker, file speed, certificates or reaching the site from Windows.

## Docker

- Either Docker Desktop on Windows with WSL integration enabled for this distribution, or Docker Engine installed inside the distribution. `docker context ls` shows which one the shell talks to.
- "Cannot connect to the Docker daemon": Docker Desktop is not running, its WSL integration is off for this distribution, or the Engine service is stopped (`sudo systemctl start docker`).

## Filesystem

Keep the repository on the distribution's Linux filesystem (for example `~/projects/<project>`), never under `/mnt/c`. Bind mounts from `/mnt/c` are slow and break file watching for Vite.

## Certificates in Windows browsers

The CA that `bin/trust-cert` exports lives on the Linux side, so Windows browsers do not trust it yet.

1. Run `bin/trust-cert` in the distribution; note the file it writes.
2. From an elevated Windows prompt, import that file into the Windows Root store through the WSL path:

   ```
   certutil -addstore -f ROOT \\wsl.localhost\<distro>\home\<user>\<path to the exported file>
   ```

3. Firefox uses its own store: set `security.enterprise_roots.enabled` to `true` in `about:config`, or import the file in its certificate settings.
4. Restart the browser.

## Reaching the site from Windows

WSL forwards `localhost` ports to Windows, so `https://<project>.localhost` (with the port `bin/info` prints) opens in a Windows browser once the CA is trusted. If it does not, check that `localhostForwarding` is not disabled in `%UserProfile%\.wslconfig`, and restart WSL with `wsl --shutdown`.

Sources: https://docs.docker.com/desktop/features/wsl/ · https://learn.microsoft.com/windows/wsl/filesystems · https://learn.microsoft.com/windows/wsl/networking · https://learn.microsoft.com/windows-server/administration/windows-commands/certutil
