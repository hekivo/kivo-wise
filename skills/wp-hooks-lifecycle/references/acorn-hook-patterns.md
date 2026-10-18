# Where to register hooks in an Acorn project

Deep reference for the hook locations per profile, dependency injection in callbacks, and testable callbacks. Loaded on demand from SKILL.md.

## The four places

### 1. Plain bootstrap files (hooks without dependencies)

| Profile | Files | Loaded |
|---|---|---|
| `sage-theme` | `app/setup.php` (theme supports, menus, editor settings), `app/filters.php` | By `functions.php` with `locate_template()`, right after Acorn booted |
| `acorn-mu-plugin` | Whatever the main plugin file requires (commonly `bootstrap/setup.php`, `filters.php`, `actions.php`, `helpers.php`) | At mu-plugin include time, before `muplugins_loaded` and long before Acorn boots |
| `radicle-app` | Usually none; theme setup comes from `config/theme.php` through a theme provider, other hooks live in providers | n/a |

Keep only the `add_action` / `add_filter` line in these files and delegate to a class:

```php
add_filter('wp_insert_post_data', [\App\Support\MenuOrder::class, 'enforceDefault'], 10, 4);
```

In mu-plugin bootstrap files, `app()`, `config()`, `view()` and facades are not available at file scope. Inside callbacks they are, as long as the hook fires after Acorn's boot.

These files are the only option for `muplugins_loaded`, `plugins_loaded` and `setup_theme` callbacks in a mu-plugin.

### 2. A provider's `boot()` (feature hooks with dependencies)

```php
public function register(): void
{
    $this->app->singleton(AuditSubscriber::class, fn ($app) => new AuditSubscriber(
        $app->make(AuditLog::class),
    ));
}

public function boot(): void
{
    $subscriber = $this->app->make(AuditSubscriber::class);

    add_action('transition_post_status', [$subscriber, 'onStatusChange'], 10, 3);
    add_action('save_post', [$subscriber, 'onSave'], 10, 3);
}
```

Checklist:

- The provider is registered where the profile reads providers (`acorn-stack`).
- `boot()` runs on every request type. Resolving a heavy service eagerly costs every request; resolve inside the callback when the hook is rare:

```php
add_action('save_post_product', function (int $postId, \WP_Post $post, bool $update): void {
    if (wp_is_post_autosave($postId) || wp_is_post_revision($postId)) {
        return;
    }

    $this->app->make(ProductSync::class)->handle($postId);
}, 20, 3);
```

- Hooks that already fired before the boot are lost (see the profile table in SKILL.md).

### 3. A provider's `register()`: container only

Bindings and singletons. No `add_action`, no calls that depend on plugins, the theme or other providers.

### 4. A separate mu-plugin

When a hook must run earlier than the profile's boot and there is no bootstrap file (Sage theme, Radicle root), put it in a small mu-plugin file. Keep it free of Acorn calls at file scope.

## Laravel events vs WordPress hooks

Inside Acorn you can listen to framework events (`Event::listen(RequestHandled::class, …)`). Use them for Laravel-side concerns (HTTP kernel, queue, Livewire lifecycle). Use WordPress hooks for WordPress data and rendering. Do not wrap a WordPress hook in a Laravel event for style.

## Removability and testability

- Named callables (`[Class::class, 'staticMethod']`, `[$service, 'method']`) can be removed and unit tested; closures cannot be removed.
- Keep the decision in a method that takes plain values and returns a value; the hook callback only adapts arguments. That method is testable without booting WordPress.
- Guard the context at the top of the callback: post type, autosave/revision, `is_admin()`, `wp_doing_ajax()`, `wp_doing_cron()`, `defined('WP_CLI')`.

## Anti-patterns

- Registering `plugins_loaded`, `muplugins_loaded` or `setup_theme` callbacks from a provider: they already fired.
- `add_action('after_setup_theme', …)` from a mu-plugin or Radicle provider at a priority not greater than the boot priority.
- Hooks in a provider constructor or `register()`.
- Assuming `wp_enqueue_scripts`, `wp_head` or `template_redirect` run on Acorn routes, REST or Livewire updates.
- The same hook registered in a bootstrap file and in a provider. Pick one place per feature and search before adding:

```bash
grep -rn "add_action('save_post" app/ bootstrap/ 2>/dev/null
```
