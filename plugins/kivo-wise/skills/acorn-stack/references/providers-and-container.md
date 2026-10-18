# Service providers and the container

Deep reference for provider registration, lifecycle and bindings in Acorn. Loaded on demand from SKILL.md.

## Where Acorn reads providers

Acorn merges four sources at boot (`Application::registerConfiguredProviders()` plus the builder):

| Source | Typical profile | Notes |
|---|---|---|
| `withProviders([...])` on the boot chain | `sage-theme` (`functions.php`), `acorn-mu-plugin` (main file or a configurator class) | Order in the array is registration order |
| `config('app.providers')` | Any project that published `config/app.php` with a `providers` key | Acorn's shipped `config/app.php` builds the list from `ServiceProvider::defaultProviders()->merge([...])`. If your published file has no `providers` key, nothing is read from it |
| Package discovery: `extra.acorn.providers` (or `extra.laravel.providers`) | `radicle-app` lists its own providers in the root `composer.json`; any package (ACF Composer, Poet, acorn-post-types…) self-registers this way | Cached in `<storage>/framework/cache/packages.php`; rebuild with `{{runner.acorn}} package:discover` |
| A bootstrap providers file (`<bootstrap path>/providers.php`) | Rare in WordPress projects | Only used when it exists |

`Illuminate\` and `Roots\` providers from config are registered first, then discovered package providers, then the rest.

Pick **one** place per project and follow it. Before adding a provider, look at how the existing ones are registered:

```bash
{{runner.wp}} eval 'print_r(array_keys(app()->getLoadedProviders()));'
```

### Package providers that are not auto-discovered

If a package is required in a Composer project Acorn does not scan (see `boot-and-paths.md`), or it is listed in `dont-discover`, add its provider class to your list explicitly (for example `\Log1x\AcfComposer\Providers\AcfComposerServiceProvider::class` in `withProviders()`).

## Lifecycle

1. All providers run `register()` first: bind into the container only (`singleton`, `bind`, `instance`, `scoped`). Do not resolve other services or touch WordPress state that depends on plugins or the theme.
2. Then all providers run `boot()`: add WordPress hooks, register view composers, resolve services, read config.
3. Both happen inside the boot call, so their WordPress timing is the profile's boot timing (theme include time for Sage, `after_setup_theme` for mu-plugin and Radicle).

### Failures are swallowed

`Application::bootProvider()` and provider registration catch any `Throwable` and call `skipProvider()`:

- the error is wrapped in a `SkipProviderException` ("Skipping provider [X] because …") and passed to `report()` (your log channel)
- it is re-thrown after boot only for web requests in the `development`, `testing` or `local` environment
- elsewhere the provider is skipped and the site keeps running without it

So "my hooks never fire on staging" often means the provider threw. Search the log for `Skipping provider`.

## Base classes

| Need | Extend |
|---|---|
| Feature provider (any profile) | `Illuminate\Support\ServiceProvider` |
| The Sage theme's main provider | `Roots\Acorn\Sage\SageServiceProvider`: binds `sage`, `sage.finder` and filters `body_class`, `template_include` (100), `theme_templates`, `script_loader_tag`, every `{type}_template_hierarchy` |

`Roots\Acorn\ServiceProvider` is a `final` helper class (it only exposes `defaultProviders()`); do not try to extend it. Never extend `SageServiceProvider` outside the Sage theme profile: it would take over template resolution for the whole site.

## Shape

```php
<?php

namespace App\Providers;   // or your project namespace

use App\Services\ExampleSync;
use Illuminate\Support\ServiceProvider;

class ExampleServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(ExampleSync::class, fn () => new ExampleSync(
            baseUrl: (string) config('services.example.base_url'),
        ));
    }

    public function boot(): void
    {
        add_action('save_post_product', function (int $postId): void {
            if (wp_is_post_autosave($postId) || wp_is_post_revision($postId)) {
                return;
            }

            $this->app->make(ExampleSync::class)->syncProduct($postId);
        }, 20);
    }
}
```

- `boot()` runs on every request type (front, admin, REST, AJAX, cron, CLI). Resolve heavy services inside the callback, not eagerly in `boot()`.
- Secrets come from the environment through `config/*.php` → `env()`. Never hard-code them or write them to `.env` yourself.

## Bindings

| Method | Lifetime | Use for |
|---|---|---|
| `singleton()` | One instance per request | API clients, config-heavy services |
| `bind()` | New instance per resolve | Stateful processors |
| `instance()` | The exact object you pass | Pre-built objects |
| `scoped()` | Like singleton, reset between queue jobs | Services used inside queued jobs |

Constructor type hints auto-resolve in composers, components, controllers, commands, jobs and Livewire components. Bind explicitly only when the constructor takes scalars or config.

## Facades and helpers

`app()`, `config()`, `view()`, `Log`, `Cache`, `Route`, `Vite` work once Acorn has booted. They do **not** work at the file scope of a theme `functions.php` before the boot call, or of mu-plugin bootstrap files (Acorn boots later). Inside hook callbacks that fire after the boot, they are fine.

## Console commands

Commands in a project are registered from a provider: `$this->commands([ExampleCommand::class])` inside `boot()` when `$this->app->runningInConsole()`. Some projects keep a list in one provider; follow it. Confirm with `{{runner.acorn}} list`.
