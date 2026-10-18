# Hook timing per stage and request type

Deep reference for what exists at each stage of a WordPress request and where Acorn sits in it. Loaded on demand from SKILL.md.

Source: `wp/wp-settings.php` (WordPress 7.1.3), `wp-includes/class-wp.php`, `wp-includes/default-filters.php`, and `vendor/roots/acorn/src/Roots/Acorn/Application/Concerns/Bootable.php`.

## Boot sequence with Acorn markers

```
wp-settings.php
├─ top-level mu-plugins, alphabetical (mu_plugin_loaded per file)
│   └─ a loader (e.g. bedrock-autoloader) includes subfolder mu-plugins here
│       └─ acorn-mu-plugin: main file requires vendor/autoload.php, defines ACORN_BASEPATH,
│          requires its bootstrap files (file scope runs now), add_action('after_setup_theme', boot, N)
│   └─ radicle-app: a committed mu-plugin adds add_action('after_setup_theme', boot)
├─ muplugins_loaded
├─ core taxonomies and post types
├─ active plugins (plugin_loaded per file)
├─ pluggable.php
├─ plugins_loaded
├─ sanitize_comment_cookies; $wp_the_query, $wp_rewrite, $wp, roles, locale
├─ setup_theme
├─ theme functions.php (child, then parent)
│   └─ sage-theme: Application::configure()->withProviders([...])->boot()  ← providers register + boot here
│      then app/setup.php and app/filters.php are loaded
├─ after_setup_theme
│   └─ acorn-mu-plugin / radicle-app: at priority N, Acorn boots ← providers register + boot here
├─ $wp->init()  (current user)
├─ init         (Poet registers at 4, acorn-post-types at 100, most provider hooks)
├─ wp_loaded
└─ request handling (below)
```

## What exists at each stage

| Stage | Available | Not yet |
|---|---|---|
| mu-plugin file scope | Core functions loaded before plugins (`add_action`, `get_option`, `is_admin`), `$wpdb`, object cache, Composer classes | Plugins, pluggable functions, current user, cookie constants, `$wp_rewrite`, theme, Acorn container and facades |
| `plugins_loaded` | All plugins, pluggable functions | Theme, Acorn (all profiles), CPTs registered on `init` |
| theme `functions.php` | Theme files; on `sage-theme` Acorn after the boot line | `init`-registered types, current user |
| `after_setup_theme` | Theme supports; Acorn on every profile once its boot callback ran | CPTs and taxonomies (registered on `init`), current user |
| `init` | Current user, rewrite object, CPTs registered at a lower priority than yours | Query vars, main query |
| `wp_loaded` | Everything registered | Request not parsed |
| `parse_request` | Query vars being parsed; REST and Acorn routes take over here | Main query |
| `template_redirect` | Main query and conditionals (`is_singular()`) | Output not started: last moment to redirect |
| `wp_head` | Enqueued assets printed (`wp_enqueue_scripts` runs at `wp_head` priority 1) | Body content |

## Per request type

**Front-end page rendered by WordPress:** full sequence → `parse_request` → `wp` → `template_redirect` → template include → `wp_head` (with `wp_enqueue_scripts`) → `the_content` per post/block → `wp_footer` → `shutdown`. With `withRouting(wordpress: true)` Acorn captures this output through its catch-all `wordpress` route and middleware, but the WordPress hooks still run.

**Acorn route:** full sequence through `wp_loaded`. Acorn adds a `do_parse_request` filter (priority 100, passing through `acorn/router/do_parse_request`) and a `parse_request` action that handles the matched route through the Laravel kernel, sends the response and exits. `wp`, `template_redirect`, `wp_enqueue_scripts`, `wp_head`, `the_content` and `wp_footer` never fire; `shutdown` does.

**Livewire update:** an Acorn route, plus: no language prefix in the URL, so language plugins resolve the default language unless the component switches it.

**REST (`/wp-json/…`):** full sequence → `parse_request` → `rest_api_loaded` → `rest_api_init` → callback → exit. The block editor's first save request is one of these.

**Admin (`wp-admin/…`):** `admin_init`, `current_screen`, `admin_enqueue_scripts`, `admin_head`, … The meta-box save `post.php?meta-box-loader=1` is an admin request: `edit_post()` → `wp_update_post()` → `save_post` → ACF saves → `acf/save_post`.

**AJAX (`admin-ajax.php`):** `admin_init` fires; `wp_ajax_{action}` / `wp_ajax_nopriv_{action}`.

**WP-CLI:** same load sequence; Acorn boots its console kernel at its normal boot point and registers the `acorn` command. No request hooks; `is_admin()` is false.

**Cron:** full load, then scheduled callbacks. No template hooks.

## Removing someone else's hook

Remove it after it was added and before it fires, with the same callable and priority:

| Added by | Remove on |
|---|---|
| A plugin at file load | `plugins_loaded` |
| The theme (`functions.php` or `after_setup_theme`) | `after_setup_theme` at a higher priority, or `init` |
| An Acorn provider `boot()` | Any hook after the boot (for example `init`), or in a provider registered after it |

```php
add_action('init', function (): void {
    remove_action('wp_head', 'wp_generator');
}, 20);
```

Closures cannot be removed. Object-method callbacks need the same instance (resolve it from the container if it is a singleton).

## Debugging timing

```php
did_action('init');           // 0 = not fired yet
doing_action('save_post');    // currently inside it?
current_action();             // name of the running hook
```

```bash
{{runner.wp}} eval 'global $wp_filter; print_r(array_map(fn ($p) => array_keys($p), $wp_filter["the_content"]->callbacks));'
```
