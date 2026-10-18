# The `wordpress` recipe

Loader note: open this page from `lando-wp` step 2 when you need what `recipe: wordpress` generates and what it does not.

## Recipe options (`config:`)

```yaml
recipe: wordpress
config:
  php: '7.4'            # builder default; set it explicitly (8.3 recommended, 8.5 to 5.3 supported)
  composer_version: '2.0.7'  # docs example; auto installs the latest 2.x for PHP >= 7.3; false disables it
  via: apache:2.4       # or nginx (adds the appserver_nginx service)
  webroot: .            # relative to /app; Bedrock uses web, Radicle uses public
  database: mysql:5.7   # or mysql:8.0|8.4, mariadb:10.6|10.11|11.4, postgres:14
  xdebug: false         # true = debug mode; or "debug,develop"
  config:               # file paths relative to the project root
    database: config/my.cnf
    php: config/php.ini
    server: config/server.conf
    vhosts: config/default.conf
```

Unknown keys under `config:` (for example `cache:`, `env_file:`, `extra_php_extensions:`) are ignored. `lando init --recipe wordpress` writes `php: '8.3'` and `database: mysql:8.0`.

The PHP images already include `bcmath, exif, gd, imagick, mysqli, pdo_mysql, redis, zip, apcu, OPcache, intl, soap, memcached` and Xdebug (off). Add others with `build_as_root` (`pecl install ...`, `docker-php-ext-enable ...`). Inside `appserver`, `PATH` starts with `/app/vendor/bin:/app/bin`, so project binaries win.

## Services generated

| Service | Type | Notes |
|---|---|---|
| `appserver` | `wordpress-php:<php>` | SSL on; owns the proxy URL when `via` is apache |
| `appserver_nginx` | `wordpress-nginx` | Only with `via: nginx`; owns the proxy URL; serves `/app/{{webroot}}` |
| `database` | `wordpress-mysql` / `-mariadb` / `-postgres` | `portforward: true`; credentials `wordpress`/`wordpress`/`wordpress`; passwordless `root`; changing credentials, type or version needs `lando destroy -y && lando start` |

So `{{web_service}}` is `appserver` with apache and `appserver_nginx` with nginx.

## Tooling generated

| Command | Service | Notes |
|---|---|---|
| `lando wp` | appserver | WP-CLI phar downloaded in a build step from GitHub; no `dir`, so it runs in the mapped cwd |
| `lando composer` | appserver | Installed by the PHP plugin |
| `lando php` | appserver | |
| `lando db-import <file>` | database | File must be inside the app dir; `.sql`, `.sql.gz`, `.zip`; wipes first unless `--no-wipe`; `--host` |
| `lando db-export [file]` | database | Default `DATABASE.TIMESTAMP.gz` in `/app`; `--stdout` |
| `lando mysql` / `lando mariadb` (10.4+) / `lando psql` | database | Root client |

**Not generated:** `yarn`, `npm`, `node`, `redis-cli`, `pull`, `push`, `acorn`. A project that has them defined them; Acorn works through `lando wp acorn` because Acorn registers itself as a WP-CLI command.

## How WP-CLI finds WordPress

Either `--path=<core dir>` or a `wp-cli.yml` / `wp-cli.local.yml` in the cwd or a parent with `path:` (and optionally `server.docroot`, `require`). Run `lando wp` from the project root and read `wp-cli.yml` to learn `{{core_path}}`.

## Database from the host and from PHP

- `lando info --service database --format json`: `creds`, `internal_connection` (`database:3306`), `external_connection` (`localhost:<random>`, changes on restart). Pin with `services.database.portforward: 3307` and rebuild.
- In `.env` / `wp-config.php`: `DB_HOST=database`, not `localhost`; `WP_HOME=https://{{name}}.lndo.site`. The upstream pattern: `if (getenv('LANDO')) { define('DB_HOST', 'database'); }`, or parse `LANDO_INFO`.

## Add-on services (declared under `services:`)

```yaml
services:
  cache: { type: redis:7.4, persist: true, portforward: true }
  node:  { type: node:24 }
tooling:
  redis-cli: { service: cache }
  yarn: { service: node }
```

The Redis host inside the app is the service name (`WP_REDIS_HOST={{redis_service}}`). Flush with `lando redis-cli FLUSHDB` or `lando wp cache flush`. Alternative Node pattern: install Node in `appserver` with `build_as_root` and route `yarn` to `appserver`.

## Xdebug

`xdebug: true` sets `XDEBUG_MODE=debug` and enables the extension as a build step, so toggling it requires `lando rebuild`. Override client settings through `services.appserver.overrides.environment.XDEBUG_CONFIG` (`client_host=...`) and, on Linux/WSL, `extra_hosts: ["host.docker.internal:host-gateway"]`. Trigger with `?XDEBUG_SESSION_START=LANDO`; log at `/tmp/xdebug.log`.

## Webroot in a subfolder

Default `webroot: .` serves `/app`. Bedrock: `web`. Radicle: `public`. A project that keeps the docroot at the root with core in a subfolder omits `webroot` and tells WP-CLI where core is through `wp-cli.yml`.

## Multisite

Not covered by the recipe docs. Subdomain multisite: `proxy: { {{web_service}}: ["*.{{name}}.lndo.site"] }` (quoted); `DOMAIN_CURRENT_SITE` must be the `.lndo.site` host.

<!-- sources: report 08 §2.1–§2.7, §2.9–§2.12, §2.14 — https://docs.lando.dev/plugins/wordpress/ · https://docs.lando.dev/plugins/wordpress/getting-started.html · https://docs.lando.dev/plugins/wordpress/config.html · https://docs.lando.dev/plugins/wordpress/tooling.html · https://docs.lando.dev/plugins/php/config.html · https://docs.lando.dev/plugins/php/extensions.html · https://docs.lando.dev/plugins/redis/config.html · https://docs.lando.dev/plugins/node/config.html · https://docs.lando.dev/guides/db-import.html · https://docs.lando.dev/guides/db-export.html · https://docs.lando.dev/guides/external-access.html · https://github.com/lando/wordpress -->
