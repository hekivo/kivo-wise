# Filter gotchas

Deep reference for core content filters and common filter mistakes. Loaded on demand from SKILL.md.

## `the_content` order (WordPress 7.1.3 defaults)

From `wp-includes/default-filters.php` and `wp-includes/class-wp-embed.php`:

| Priority | Callback |
|---|---|
| 8 | `apply_block_hooks_to_content_from_post_object`, `WP_Embed::run_shortcode`, `WP_Embed::autoembed` |
| 9 | `do_blocks` |
| 10 | `wptexturize`, `wpautop`, `shortcode_unautop`, `prepend_attachment`, `wp_replace_insecure_home_url` |
| 11 | `capital_P_dangit`, `do_shortcode` |
| 12 | `wp_filter_content_tags` (lazy loading, `srcset`) |
| 20 | `convert_smilies` |

- Below 9 you see raw block markup; at 12 or higher you see final HTML. Inject post-render content at ≥ 12.
- `the_content` never runs on Acorn routes, REST responses or Livewire updates; those render Blade directly.
- Block output (including ACF Composer and native blocks rendered with Blade) is produced at `do_blocks` (9), so it still passes through `wptexturize` and `wpautop` at 10.

## `wptexturize` and Tailwind arbitrary values

`wptexturize` turns straight quotes after digits into primes (`″`, `′`) and skips HTML tags, but a `>` inside an attribute value ends its tag detection early. A class such as `[&>p:last-child]:mb-0` makes it treat the rest of the attribute as text; the closing quote becomes `″`, the attribute never closes and swallows the following markup.

Order of preference:

1. Avoid `>` inside class attributes of markup that goes through `the_content` (use a named class or a child selector in CSS).
2. Scope a fix to the affected block or template.
3. Only then consider `add_filter('run_wptexturize', '__return_false')`, which changes editorial typography site-wide: agree on it first.

## `wpautop`

`wpautop` (10) wraps loose lines in `<p>`, which can produce `<p><div>…</div></p>` around non-block HTML. ACF text fields choose their own behaviour with the `new_lines` setting; that is a field option, not this filter. Do not remove the global filter to fix one field.

## kses

Content saved by users without `unfiltered_html` passes through `wp_kses_post`, which strips tags and attributes outside `$allowedposttags` (custom elements, `x-*` and `wire:*` attributes, many `data-*` patterns). Extend it narrowly with `wp_kses_allowed_html`, checking `$context`, and only for markup you control.

## `pre_get_posts`

Runs for every query: admin lists, REST, feeds, secondary queries. Guard with `! is_admin() && $query->is_main_query()` plus the specific conditional.

## URLs with language plugins

Language plugins often filter `home_url()` to add a language directory (`/de`). Laravel's `url()` helper builds on Acorn's root URL, which Acorn forces to `home_url()` at boot, so the directory can appear twice (`/de/de/...`). For the site root use `get_option('home')`, or switch language explicitly before building URLs.

## Generic mistakes

- **No `return` in a filter**: the value becomes `null` for every later callback.
- **Adding a callback to the hook that is running, at the same or a lower priority**: it does not run for this request (the running priority's list is copied).
- **Saving inside a save hook**: `wp_update_post()` inside `save_post` / `wp_insert_post_data` loops. Unhook, update, re-hook; better, modify `$data` in `wp_insert_post_data`.
- **Heavy work on every request**: `plugins_loaded` and `init` run on front, admin, REST, AJAX, cron and CLI. Check the context first and cache results (see `wp-performance`).
- **Closures you will need to remove**: use a named method.
- **Hooking by field name in shared ACF code**: another plugin or theme may target the same name; prefer `key=` variants of ACF filters (see `acf-native`).
