# Cache layers on a Roots and Acorn site

Deep reference for the layers that hold stale state. Loaded on demand from `SKILL.md`.

Clear from the cheapest and most local layer outward, and re-test after each step so you learn which layer held the stale state. All commands go through the runner.

| # | Layer | Holds | Where | Clear |
|---|---|---|---|---|
| 1 | Compiled Blade views | PHP compiled from `.blade.php` | `<acorn storage>/framework/views/` | `{{runner.acorn}} view:clear` (rebuild: `view:cache`) |
| 2 | Acorn bootstrap caches | merged config, route table, event map, package list, service list | `<acorn storage>/framework/cache/` (`config.php`, `routes-v7.php`, `packages.php`, `services.php`) or `.laravel/` | `config:clear`, `route:clear`, `event:clear`, `package:discover`; all at once with `optimize:clear`; rebuild with `optimize` |
| 3 | Package manifests | ACF Composer field manifest and generated block metadata, Blade Icons manifest | `<acorn storage>/framework/cache/acf-composer/`, `blade-icons.php` | `acf:clear` / `acf:cache`, `icons:clear` / `icons:cache` |
| 4 | Laravel cache store | anything stored with the `Cache` facade, sessions when configured to use it | store set by `CACHE_STORE` (default `file`; may be Redis) | `{{runner.acorn}} cache:clear` |
| 5 | WordPress object cache | options, posts, terms, menus, ACF values | in memory, or a drop-in (`wp-content/object-cache.php`) backed by Redis | `{{runner.wp}} cache flush`; backend: `{{runner.wp}} cache type` |
| 6 | Transients and options | cached API results, rewrite rules | database | delete the transient; `{{runner.wp}} rewrite flush` for rules |
| 7 | OPcache | compiled PHP | CLI and web server have separate pools | restart the PHP service (Lando: `lando restart`); a CLI call cannot clear the web pool |
| 8 | Page cache, CDN, edge | rendered HTML and static files | plugin, reverse proxy, CDN | purge by the owner of that layer, not from the repo |
| 9 | Browser | assets, service workers | client | hard reload, disable cache in dev tools |

## Which command rebuilds what

- `{{runner.acorn}} optimize` runs the framework caching tasks (config, events, routes, views) and every package that registered an optimize hook. `optimize:clear` is its inverse and runs each clear command plus the package clears.
- `optimize` bakes values into the config cache. On a development machine this hides later environment-file edits: clear it (`config:clear`) instead of wondering why a changed setting is ignored. Production images usually run `optimize` at build time.
- `cache:clear` empties the Laravel cache store only. It does not touch the WordPress object cache; `{{runner.wp}} cache flush` is a separate call.

## After switching branches

Run the cheap clears first, then reinstall dependencies if lockfiles differ:

1. `{{runner.cache}}` (the project's combined cache-clear).
2. If `composer.lock` changed: `{{runner.composer}} install` for the site and for the nested Acorn application if it has its own lock.
3. If the Node lockfile changed: reinstall with `{{runner.node}}` and rebuild assets (see `tailwind-vite-assets`).
4. Symptoms of skipping this: "block type already registered", missing blocks, `Class not found`, a route that exists in code returning 404.

## The `public/hot` file

`laravel-vite-plugin` writes `public/hot` while the dev server runs. Acorn treats "hot file exists" as "dev server is running" and prints dev-server URLs. If the server stopped without cleanup (killed container, crashed terminal), the file stays and every page asks for assets from a dead server. Delete the stale file or restart and stop the dev server cleanly. It is git-ignored; never commit it.

## Remote environments

Treat layers 5 to 8 as shared infrastructure. Report the symptom and the layer you suspect, name the command, and let the user (or the deploy owner) run it. Check headers (`age`, cache status) before reading code, because old HTML explains many "my change is not live" reports.
