# ACF 6.8 abilities

Deep reference listing the abilities ACF registers and how to control them. Loaded on demand from SKILL.md.

Checked in ACF Pro 6.8.10 (`src/AI/Abilities/`). Confirm in the installed version with `rg -n "register_ability\(" <plugins dir>/advanced-custom-fields-pro/src/AI/Abilities` before relying on a name.

## Switching it on

- Setting `enable_acf_ai` (default `false`): `add_filter('acf/settings/enable_acf_ai', '__return_true');`. ACF builds its abilities on `acf/init` only when the setting is on and the Abilities API exists.
- ACF registers two categories on `wp_abilities_api_categories_init` and its abilities on `wp_abilities_api_init` (priority 10).
- Every ACF ability gets `meta.mcp.public => true` unless it sets otherwise, so with the MCP Adapter loaded they all show in `discover-abilities`.
- The schema output (GEO) is a separate setting (`enable_schema`); it is not needed for abilities.

## Names

| Ability | Category | Kind | Permission |
|---|---|---|---|
| `acf/field-groups` | `acf-field-management` | read | ACF `capability` setting (default `manage_options`) |
| `acf/register-field-group` | `acf-field-management` | write | same |
| `acf/custom-post-types` | `acf-field-management` | read | same |
| `acf/register-custom-post-type` | `acf-field-management` | write | same |
| `acf/custom-taxonomies` | `acf-field-management` | read | same |
| `acf/register-custom-taxonomy` | `acf-field-management` | write | same |
| `acf/<slug>s` | `wordpress-content-discovery` | list items of an ACF post type / taxonomy | `read` |
| `acf/create-<slug>` | `wordpress-content-discovery` | create | the object type's capabilities |
| `acf/view-<slug>` | `wordpress-content-discovery` | read one | `read` |
| `acf/update-<slug>` | `wordpress-content-discovery` | update | the object type's capabilities |
| `acf/delete-<slug>` | `wordpress-content-discovery` | delete | the object type's capabilities |

- `<slug>` is the post type or taxonomy name lowercased with `_` turned into `-`.
- Per-item abilities exist only for post types and taxonomies **registered through ACF itself** (ACF UI or ACF JSON), active, with `allow_ai_access` on and `show_in_rest` true. Post types registered in code (`register_post_type()`, CPT classes, Poet, `roots/acorn-post-types`) get none.
- Field values appear in those abilities only for field groups with `allow_ai_access` and `show_in_rest`.
- ACF adds a REST filter that parses JSON in the `input` query parameter for `GET`/`DELETE` runs of `acf/*` abilities.

## Keeping it read-only when structure lives in code

If field groups, post types and taxonomies are defined in code (ACF Composer, Poet, `acorn-post-types`), the `register-*` abilities would create database copies that drift from the repository. Remove them after ACF registers them:

```php
// In a provider boot()
add_filter('acf/settings/enable_acf_ai', '__return_true');

add_action('wp_abilities_api_init', function (): void {
    foreach (['acf/register-field-group', 'acf/register-custom-post-type', 'acf/register-custom-taxonomy'] as $name) {
        if (wp_has_ability($name)) {
            wp_unregister_ability($name);
        }
    }
}, 20);
```

Opt field groups in one by one with `allow_ai_access` (and an `ai_description`) in their definition, and keep `show_in_rest` on for those groups.
