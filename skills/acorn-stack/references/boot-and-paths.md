# Acorn boot and path resolution

Deep reference for how Acorn boots and resolves its directories per profile. Loaded on demand from SKILL.md.

Source of truth: `vendor/roots/acorn/src/Roots/Acorn/` in the Composer project that requires Acorn (theme, plugin or root). Facts below were checked against Acorn 6.2.0.

## The boot chain

```php
use Roots\Acorn\Application;

Application::configure()            // or configure('/absolute/base/path')
    ->withProviders([/* … */])
    ->withRouting(/* optional */)
    ->withPaths(/* optional */)
    ->boot();
```

- `Application::configure(?string $basePath)` uses the argument when it is a string, otherwise `ApplicationBuilder::inferBasePath()`. It then calls `withPaths()`, `withKernels()`, `withEvents()`, `withCommands()`, `withProviders()`, `withMiddleware()` and `withExceptions()` with defaults, so calling them again only adds or overrides.
- `boot()` calls `$app->bootAcorn($config)` **immediately**. Acorn adds no hook of its own; the timing is whatever hook (or file include) wraps the call.
- In a web request `bootAcorn()` bootstraps the HTTP kernel (config, providers `register()` then `boot()`), forces the root URL to `home_url()`, and wires routing (see below).
- Under WP-CLI it bootstraps the console kernel and registers the `acorn` WP-CLI command. That is why `{{runner.acorn}}` only exists after the booting theme or plugin has run its boot code.
- Under the standalone `vendor/bin/acorn` CLI it waits for `wp_loaded`. That CLI reads the closest `composer.json` and needs `extra.wordpress-install-dir` to find WordPress.

## When each profile boots

| Profile | Boot site | Timing |
|---|---|---|
| `sage-theme` | Theme `functions.php` | While `wp-settings.php` includes theme files: after `setup_theme`, before `after_setup_theme`. Providers `register()` and `boot()` run here, so a provider can hook `after_setup_theme` at any priority |
| `acorn-mu-plugin` | Main plugin file, `add_action('after_setup_theme', …)` | mu-plugins load before regular plugins and themes, so the boot must be deferred until the theme functions exist (`get_theme_file_path()` is used by path inference). The official docs use priority 0; projects often use 10 |
| `radicle-app` | A committed mu-plugin, `after_setup_theme` | Same class of timing as the mu-plugin profile; the base path constant is already defined by `bedrock/application.php` when WordPress loads its config |

Hooks registered from a provider's `boot()` on `after_setup_theme` only run if their priority is **higher** than the boot priority (same priority callbacks are not picked up by the running loop). See `wp-hooks-lifecycle`.

## Base path inference (`Configuration/Concerns/Paths.php`)

First match wins:

1. `$_ENV['APP_BASE_PATH']`
2. constant `ACORN_BASEPATH`
3. directory of `get_theme_file_path('composer.json')` if that file exists (child theme first, then parent)
4. directory of `get_theme_file_path('app')` if that folder exists
5. directory of the closest `composer.json` above Acorn's vendor folder
6. a fallback relative to Acorn's own source

Consequence for `acorn-mu-plugin`: without the constant (or an explicit `configure($path)`) and with an active theme that has a `composer.json` or `app/`, the **theme** becomes the base path. Providers still boot, but `app()->getNamespace()`, `resources/views`, `config/` and `storage/` all point at the theme. Define the constant in the main plugin file before booting:

```php
define('ACORN_BASEPATH', __DIR__);
```

## Per-directory resolution (`withPaths()` defaults)

For each of `app`, `config`, `storage`, `resources`, `public`, `lang`, `database`:

1. env `ACORN_<KEY>_PATH` (absolute, or relative to the base path)
2. constant `ACORN_<KEY>_PATH`
3. first **existing** directory among: the application's own accessor (`path()`, `configPath()`…), `base_path('<key>')`, `get_theme_file_path('<key>')`
4. fallback: `base_path('<key>')`; for `storage`, `WP_CONTENT_DIR/cache/acorn` with `framework/cache/data`, `framework/views`, `framework/sessions`, `logs` created on demand

The bootstrap path (where `services.php`, `packages.php`, `config.php`, `routes-v7.php` caches go) defaults to `<storage>/framework`, so the caches land in `<storage>/framework/cache/`.

Trap: step 3 includes the theme. An mu-plugin without its own `config/` or `resources/` folder silently reads the active theme's folder of that name. Create the folders in the plugin, or pass explicit paths to `withPaths(app: …, config: …, storage: …, resources: …, public: …)`.

`environmentPath()` is the directory of the closest `.env` walking up from the base path, so an mu-plugin normally reads the site root `.env`.

## Package discovery (which `composer.json` files are scanned)

Acorn builds the package manifest from these directories, keeping only those that contain both `composer.json` and `vendor/composer/installed.json`:

- the base path, the directory of the closest `composer.json` above `WP_CONTENT_DIR`, the template and stylesheet directories (filterable with `acorn/composer_paths`)
- the folder of every entry in the `active_plugins` option

mu-plugins are not in `active_plugins`; an mu-plugin's packages are discovered only because the base path points at it. Each scanned project contributes the `extra.acorn` (or `extra.laravel`) block of every installed package **and of its own root `composer.json`**. That is the mechanism a project-root app uses to list its own providers in `extra.acorn.providers`. `dont-discover` in either block excludes packages.

Rebuild after changing `composer.json`: `{{runner.acorn}} package:discover`.

## Routing hand-off (only when `withRouting()` is used)

- Matched Acorn routes are answered on WordPress's `parse_request` action and the request exits there; template hooks never run (details in `wp-hooks-lifecycle`).
- With `wordpress: true`, Acorn registers a catch-all route named `wordpress` that wraps normal WordPress page output in the `wordpress` middleware group.
- Paths under `admin_url()`, `wp_login_url()`, `wp_registration_url()`, `rest_url()` and any path ending in `.php` are never handled by Acorn.

## Blade views outside the theme folder

WordPress 7.1.2 added `_wp_is_template_path_allowed()` to `locate_template()`, which refuses template paths containing `..` that resolve outside the theme folders (`wp-includes/template.php`). Template loaders that walk out of the theme with relative paths (project-root views, some plugin view setups) can stop finding templates. The Roots forum reported a fix in Acorn 6.3.0; check your Acorn version and test with:

```bash
{{runner.wp}} eval 'echo get_query_template("index"), PHP_EOL;'
```
