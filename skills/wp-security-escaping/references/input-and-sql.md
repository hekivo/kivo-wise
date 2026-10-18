# Input, nonces, SQL, uploads and secrets

Deep reference for sanitising input, request verification, queries, uploads and secrets. Loaded on demand from SKILL.md.

## Sanitisers by type

| Input | Function |
|---|---|
| Single-line text | `sanitize_text_field()` |
| Multi-line text | `sanitize_textarea_field()` |
| Email | `sanitize_email()` + `is_email()` to validate |
| Integer ID | `absint()` |
| Slug / key | `sanitize_key()`, `sanitize_title()` |
| URL to store | `esc_url_raw()` (alias of `sanitize_url()`) |
| File name | `sanitize_file_name()` |
| Rich HTML | `wp_kses_post()`, or `wp_kses($html, $allowed)` with an explicit allow-list |
| Enum | `in_array($value, $allowed, true)` |

Superglobals: `sanitize_text_field(wp_unslash($_POST['field'] ?? ''))`. Read explicit keys; never pass `$_POST` whole to a model or `update_*_meta()`.

## Request verification

```php
// Form posted to admin-post.php
add_action('admin_post_app_save_settings', function (): void {
    check_admin_referer('app_save_settings', '_app_nonce'); // dies on failure
    if (! current_user_can('manage_options')) {
        wp_die(esc_html__('Not allowed.', 'textdomain'), 403);
    }
    $title = sanitize_text_field(wp_unslash($_POST['title'] ?? ''));
    // ...
});
```

```blade
<form method="post" action="{!! esc_url(admin_url('admin-post.php')) !!}">
  {!! wp_nonce_field('app_save_settings', '_app_nonce', true, false) !!}
  <input type="hidden" name="action" value="app_save_settings">
</form>
```

- AJAX: `check_ajax_referer('app_action', 'nonce')` then a capability check; reply with `wp_send_json_success()` / `wp_send_json_error()`.
- REST with cookie auth: send the `wp_rest` nonce as `X-WP-Nonce` (or `_wpnonce`). Without it, core treats the request as unauthenticated even if cookies are present.
- REST routes always declare a `permission_callback`.
- Acorn `web` routes: the default `web` middleware group in Acorn does not include the CSRF middleware, so `@csrf` alone protects nothing. Verify a WordPress nonce in the controller, or append the CSRF middleware through `withMiddleware()` in the boot configuration.

## SQL

```php
global $wpdb;
$rows = $wpdb->get_results($wpdb->prepare(
    "SELECT ID FROM {$wpdb->posts} WHERE post_type = %s AND post_title LIKE %s LIMIT %d",
    $type,
    '%' . $wpdb->esc_like($term) . '%',
    $limit
));
// identifiers (WordPress 6.2+): $wpdb->prepare('SELECT %i FROM %i', $column, $table)
```

Query builder / Eloquent: bindings everywhere (`whereRaw('meta_value = ?', [$value])`, `DB::select('… = ?', [$value])`). Prefer `WP_Query` / `get_posts()` when they express the query.

## Uploads

- Use `media_handle_upload()` / `wp_handle_upload()`; they run `wp_check_filetype_and_ext()` against the allowed MIME list.
- Restrict types server-side (`upload_mimes` filter or an explicit allow-list), never trust the client extension.
- Livewire uploads: validate with rules (`file|mimes:…|max:…`) in the component, then hand the file to WordPress media functions.

## Secrets

- Keep secrets in the environment: a git-ignored `.env` (Bedrock-based `sage-theme` and `radicle-app` read it at the project root) or the host's secret store. Never commit them, never print them in logs or command output.
- In Acorn, read `env()` only inside `config/*.php` and use `config('services.x.key')` elsewhere (with cached config, `env()` outside config files returns `null`).
- A leaked key is rotated, not just removed from the repo.
