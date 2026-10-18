# Save flow: where each hook fires

Deep reference for the classic and block editor save sequences. Loaded on demand from SKILL.md.

## Block editor (post types with `show_in_rest`)

1. The user clicks **Publish** or **Update**.
2. ACF's wrapper around `core/editor` `savePost` runs **only if the target status is `publish` or `future`**: it posts the form to `admin-ajax.php?action=acf/validate_save_post`, which applies field settings (`required`, `maxlength`, rows) and every `acf/validate_value*` filter. Errors block the save and show on the fields. Drafts, autosave and preview skip this step.
3. **REST request** `POST /wp/v2/<rest_base>/<id>` with title, content, status: `rest_pre_insert_{post_type}`, `wp_insert_post_data`, `transition_post_status` and `save_post` fire here **with the old ACF meta**.
4. **Meta-box request** `POST post.php?meta-box-loader=1` with `$_POST['acf']`: WordPress calls `edit_post()` → `wp_update_post()` (so `wp_insert_post_data` fires again, still before ACF saves), then ACF saves on `save_post` priority 10 and fires `acf/save_post`.

Consequence: a rule that needs the new field values belongs in `acf/validate_value` (to block) or `acf/save_post` priority > 10 (to react). A server guard on `wp_insert_post_data` must skip the meta-box request (it carries `$_POST['acf']` and is judged by ACF) and the REST request that precedes it.

## Classic editor / plain `post.php` form

One request: `wp_insert_post_data` → row saved → `save_post` → ACF saves → `acf/save_post`. ACF validates over AJAX before submit, except for **Save Draft** (`#save-post`) and preview, which it ignores.

## No form at all

Quick edit, bulk edit, WP-CLI, REST without meta boxes, `wp_update_post()` in code: ACF validation and `acf/save_post` do not run. Only WordPress hooks apply; read the stored meta.

## Request-scoped caches

A static or memoised value computed early in the request (a list of linked posts, a lookup map) can be stale for the second item of a bulk edit. Do not memoise state that the same request can change.
