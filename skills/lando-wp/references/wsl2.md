# Lando on WSL2

Loader note: open this page from `lando-wp` step 7 when the project runs inside a WSL2 distribution and the problem involves installation, certificates, file speed or Docker.

## Install

- Requirements: Windows 10/11 21H2+ with WSL2; 4 GB RAM and 25 GB disk minimum (16 GB and 100 GB preferred).
- Inside the distro: `/bin/bash -c "$(curl -fsSL https://get.lando.dev/setup-lando.sh)"` (installs to `~/.lando/bin`, symlink in `/usr/local/bin`).
- The PowerShell installer installs Lando on Windows only, not in WSL.
- `lando setup` on WSL installs **Docker Desktop on the Windows host**; on plain Linux it installs Docker Engine. With WSL interoperability disabled, WSL is treated as plain Linux.
- `which lando` should print `~/.lando/bin/lando`; a second install earlier in `PATH` wins otherwise.

## Docker

- Docker Desktop must be running with WSL integration enabled for this distro, or Docker Engine must run inside the distro (`sudo systemctl start docker`).
- `Cannot connect to the Docker daemon` / `ENOENT /var/run/docker.sock`: check `docker context ls` and `lando config --path engineConfig`.

## Filesystem

Keep the repository on the distro's ext4 filesystem (for example `~/projects`), never under `/mnt/c`. Upstream recommends running Lando inside a Linux distribution on WSL2 to avoid file-sharing slowness. Add `excludes: [vendor, node_modules]` for further speed.

## Certificates

- The CA is `~/.lando/certs/LandoCA.crt`; `lando setup` trusts it in the distro's system store.
- Windows browsers do not see it. From Windows (admin), trust the distro's file:

  ```
  certutil -addstore -f "ROOT" \\wsl.localhost\<distro>\home\<user>\.lando\certs\LandoCA.crt
  ```

- Inside Debian/Ubuntu: `sudo cp ~/.lando/certs/LandoCA.crt /usr/local/share/ca-certificates/ && sudo update-ca-certificates`.
- Firefox: set `security.enterprise_roots.enabled = true`.
- Still warning: `docker rm -f landoproxyhyperion5000gandalfedition_proxy_1 && lando rebuild -y`.
- SSL-decrypting corporate proxy (`unable to get local issuer certificate`): add the corporate CA to the distro and the containers; `NODE_EXTRA_CA_CERTS` for Node.

## DNS and hosts

`*.lndo.site` resolves to 127.0.0.1 through public DNS. Offline or behind DNS-rebinding protection, add `127.0.0.1 {{name}}.lndo.site` to the hosts file the browser uses: `C:\Windows\System32\Drivers\etc\hosts` for a Windows browser, `/etc/hosts` inside the distro.

## Xdebug from WSL

Set `XDEBUG_CONFIG: client_host=host.docker.internal discover_client_host=true` and `extra_hosts: ["host.docker.internal:host-gateway"]` on `appserver`; Lando also offers `host.lando.internal`.

<!-- sources: report 08 §1.2, §1.3, §1.6, §1.7, §2.7, §2.13 — https://docs.lando.dev/getting-started/requirements.html · https://docs.lando.dev/install/wsl.html · https://docs.lando.dev/install/windows.html · https://docs.lando.dev/cli/setup.html · https://docs.lando.dev/config/performance.html · https://docs.lando.dev/config/security.html · https://docs.lando.dev/help/dns-rebind.html · https://docs.lando.dev/help/updating.html · https://docs.lando.dev/plugins/php/config.html · https://github.com/lando/setup-lando -->
