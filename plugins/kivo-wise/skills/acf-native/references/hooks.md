# ACF and WordPress hooks

Deep reference for ACF and WordPress hook signatures and timing. Loaded on demand from SKILL.md.

Checked against ACF Pro 6.8.10 and WordPress 7.1.3. Re-check the line numbers in the installed version before quoting them. `acf_add_filter_variations()` adds `/type=`, `/name=` and `/key=` variants of a hook; prefer `/key=` (unique, survives renames of other fields, and is not affected by other code that filters by name).

## Validation

```php
// includes/validation.php — runs inside acf/validate_save_post
// (AJAX before publish/future in the block editor, client-side submit in the classic editor)
add_filter('acf/validate_value/key=field_external_id', function ($valid, $value, array $field, string $input) {
    if ($valid !== true) {
        return $valid; // keep ACF's own result (required, maxlength, ...)
    }

    // phpcs:ignore WordPress.Security.NonceVerification -- ACF verified its nonce before validating
    $sibling = $_POST['acf']['field_external_source'] ?? '';

    return app(\App\Validation\ExternalIdRule::class)->check($value, $sibling) ?? true; // string = error on this field
}, 10, 4);
```

- Return `true` (valid), `false` (generic error) or a string (the message shown on the field).
- Order inside ACF: `/type=`, `/name=`, `/key=`, then the generic `acf/validate_value`.
- Repeater sub fields have their own keys; the repeater value arrives as rows keyed by sub field key.
- Form-level error: `add_action('acf/validate_save_post', fn () => acf_add_validation_error('', 'Message'))`.

## Field definition at runtime

| Hook | Signature | Fires | Use |
|---|---|---|---|
| `acf/load_field[/type=|/name=|/key=]` | `($field)` → `$field` | every time the field is loaded (admin and front end) | dynamic `choices`, defaults, instructions |
| `acf/prepare_field[/type=|/name=|/key=]` | `($field)` → `$field` or `false` | right before rendering in a form | hide (`false`), readonly per user or state |

`includes/acf-field-functions.php` (`acf_get_field` → `load_field`; `acf_prepare_field`).

## Values

| Hook | Signature | Source |
|---|---|---|
| `acf/load_value[/…]` | `($value, $post_id, $field)` | `includes/acf-value-functions.php` |
| `acf/update_value[/…]` | `($value, $post_id, $field, $original)` | same file |
| `acf/format_value[/…]` | `($value, $post_id, $field, $escape_html)` | same file; used by `get_field()` when formatting |

`get_field($selector, $post_id, false)` returns the raw value (no `format_value`). `get_field($selector, $post_id, true, true)` returns the formatted value escaped for HTML.

## Save

| Hook | When | Notes |
|---|---|---|
| `acf/save_post` | `acf_save_post()` in `includes/acf-form-functions.php`, after the form was posted | ACF stores values at priority 10 (`_acf_do_save_post`); < 10 sees only `$_POST['acf']`, > 10 sees stored values |
| `save_post` | after the row is written | ACF's own post form saves on `save_post` priority 10 (`includes/forms/form-post.php`) |
| `wp_insert_post_data` | every `wp_insert_post()` / `wp_update_post()` | also runs in the block editor REST request (old meta) and in the meta-box request (before ACF saves) |
| `transition_post_status` | status changes | same timing caveat |
| `rest_pre_insert_{post_type}` | REST create/update, before the insert | the place to reject REST-only saves without touching the ACF flow |

`acf_save_post()` filters `$_POST['acf']` through `wp_kses_post_deep()` for users without `unfiltered_html` before it fires `acf/save_post`.

## Admin assets

- `acf/input/admin_enqueue_scripts` fires only on screens that render ACF forms (`includes/assets.php`). Still check `get_current_screen()->post_type`.
- Declare `acf-input` as a script dependency; add `wp-data` / `wp-hooks` only when you use them.

## WordPress-only equivalents (no ACF, e.g. `radicle-app`)

| Need | Native WordPress mechanism |
|---|---|
| Typed, sanitised meta | `register_post_meta($type, $key, ['type' => …, 'single' => true, 'show_in_rest' => true, 'sanitize_callback' => …, 'auth_callback' => …])` |
| Reject an invalid REST save | `rest_pre_insert_{post_type}` returning `WP_Error` |
| Rule on every save path | `wp_insert_post_data` (filter) or `save_post_{post_type}` (react) |
| Editor-side field UI | block attributes and `@wordpress/data` in the block's JS |
