# Config, storage and cache layers

Deep reference for Acorn config loading, publishing and every cache that can hide a change. Loaded on demand from SKILL.md.

## Config loading

- Acorn loads every PHP file in the config path (`<base>/config` when it exists) into the repository; keys are file names (`config/services.php` → `config('services.x')`).
- Acorn ships defaults for `app`, `assets`, `auth`, `broadcasting`, `cache`, `concurrency`, `cors`, `database`, `filesystems`, `hashing`, `logging`, `mail`, `queue`, `services`, `session` and `view`. Publish only the files you need to change.
- Some packages merge their own defaults with `mergeConfigFrom()` (ACF Composer under `acf`, acorn-post-types under `post-types`); others, like Poet, read only the published file (`config/poet.php` must exist). Publishing creates a copy in your config path that you then own.
- `env()` reads the closest `.env` above the base path plus the real environment. Use `env()` only inside `config/*.php`; read `config()` everywhere else, or values disappear once config is cached.

### Publishing

```bash
{{runner.acorn}} vendor:publish --tag=acorn          # Acorn's config files (Laravel-style layout)
{{runner.acorn}} acorn:init storage                  # create storage/ in the base path
{{runner.acorn}} vendor:publish --tag=acf-composer   # ACF Composer's config/acf.php
{{runner.acorn}} vendor:publish --provider="Log1x\Poet\PoetServiceProvider"   # by provider when the tag is the generic "config"
```

Radicle-style roots keep Bedrock's configuration in `bedrock/` precisely because Acorn owns `config/` at the project root.

## Storage

`storage_path()` resolves to `<base>/storage` if it exists, else `WP_CONTENT_DIR/cache/acorn`. It must be writable by PHP. On read-only container images, point it at a writable volume with `ACORN_STORAGE_PATH` (env or constant).

| Path under storage | Contents |
|---|---|
| `framework/cache/` | `config.php`, `routes-v7.php`, `services.php`, `packages.php`, the file cache store (`data/`), ACF Composer manifest (`acf-composer/`), other package caches |
| `framework/views/` | Compiled Blade |
| `framework/sessions/` | File sessions |
| `logs/` | Default log channel files |

## Cache layers and how to clear them

| Layer | What goes stale | Rebuild | Clear |
|---|---|---|---|
| Config cache | `config/*.php`, `.env` edits | `config:cache` (part of `optimize`) | `config:clear` |
| Route cache | `routes/*.php` edits | `route:cache` (part of `optimize`) | `route:clear` |
| Compiled views | Rarely stale (timestamps), but survive deploys with clock skew | `view:cache` | `view:clear` |
| Package and provider manifests | New or removed packages, `extra.acorn` edits | `package:discover` | delete `services.php` / `packages.php` |
| ACF Composer manifest | Field groups (`fields()`), block properties, generated `block.json` | `acf:cache` (alias `acf:optimize`; part of `optimize`) | `acf:clear` (part of `optimize:clear`) |
| Laravel cache store | `Cache::remember()` values | n/a | `cache:clear` (part of `optimize:clear`) |
| WordPress object cache | Options, transients, queries in Redis/Memcached | n/a | `{{runner.wp}} cache flush` |
| OPcache (PHP-FPM) | PHP files when `validate_timestamps` is off | n/a | restart PHP-FPM (CLI resets do not touch the FPM pool) |

All `{{runner.acorn}}` commands above. What the two umbrella commands run in Acorn 6.2:

- `optimize`: `config:cache`, `route:cache`, `view:cache`, then every package task registered with `optimizes()` (ACF Composer adds `acf:cache`).
- `optimize:clear`: `config:clear`, `cache:clear`, `clear-compiled`, `route:clear`, `view:clear`, then package clear tasks (ACF Composer adds `acf:clear`).

### The ACF Composer manifest trap

ACF Composer 3.4.6 writes `<storage>/framework/cache/acf-composer/manifest.php` (field definitions) and `blocks/<slug>/block.json` (one per block) on `acf:cache`.

- While the manifest exists, `Composer::getFields()` returns the **cached** definition: editing `fields()` changes nothing.
- While `block.json` exists, the block is registered from that file with `register_block_type($jsonPath)`: editing `$styles`, `$supports`, `$post_types`, `$parent`, `$example`, `$icon`, `$name` changes nothing.
- The manifest location is `storage_path('framework/cache')`: in 3.4.6 the class reads the config key `acf-composer.manifest`, while the published file is merged under `acf`, so the `manifest` entry in `config/acf.php` is not what moves it.
- After deploys or branch switches, rebuild (`acf:cache` or `optimize`) rather than only clearing. A project that boots fine without a manifest is the normal case; if yours returns 500 without it, rebuild first and investigate later.

### Recommended sequence after PHP changes

Use `{{runner.cache}}` if the project defines it. Otherwise:

```bash
{{runner.acorn}} optimize:clear
{{runner.acorn}} optimize
{{runner.wp}} cache flush        # only when options/transients/object cache are involved
```

On remote environments these are operations on shared infrastructure: tell the user what to run instead of running them.
