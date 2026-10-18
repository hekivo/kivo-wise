# Capabilities and roles

Deep reference for roles, custom capabilities, CPT capability mapping and authorisation in Acorn. Loaded on demand from SKILL.md.

## Model

- **Roles** are named sets of capabilities (administrator, editor, author, contributor, subscriber), stored in the `wp_user_roles` option.
- **Primitive capabilities** are granular (`edit_posts`, `edit_others_posts`, `publish_posts`, `manage_options`, `upload_files`).
- **Meta capabilities** depend on an object (`edit_post`, `delete_post`, `read_post`); `map_meta_cap()` resolves them to primitives using ownership and status. Always pass the object ID: `current_user_can('edit_post', $post_id)`.

## Custom post type capabilities

```php
// Same args whether the CPT is registered with register_post_type(), a CPT class,
// Poet (config/poet.php) or roots/acorn-post-types (config/post-types.php).
'capability_type' => ['project', 'projects'],
'map_meta_cap'    => true,
```

- `map_meta_cap` defaults to `true` only when `capability_type` is `post` or `page` and no explicit `capabilities` are given. With a custom `capability_type`, set it to `true` or meta checks such as `current_user_can('edit_project', $id)` never map and return false.
- Grant the generated primitives (`edit_projects`, `edit_others_projects`, `publish_projects`, `delete_projects`, `read_private_projects`, …) to roles; administrators do not receive them automatically.

## Granting capabilities once

Role changes are written to the database. Run them once (plugin activation, a versioned upgrade routine, or an Acorn console command), not on every request.

```php
// In a console command or behind an option-stored version check
$role = get_role('editor');
foreach (['edit_projects', 'edit_others_projects', 'publish_projects', 'delete_projects'] as $cap) {
    $role?->add_cap($cap);
}

add_role('project_manager', 'Project Manager', [
    'read' => true,
    'edit_projects' => true,
    'publish_projects' => true,
]);
```

`remove_role()` does not strip capabilities that were granted to users directly; clean those explicitly. On multisite, super admins pass every check unless the capability is explicitly denied (`do_not_allow`).

## Custom mapping

Only when the default mapping cannot express the rule:

```php
add_filter('map_meta_cap', function (array $caps, string $cap, int $userId, array $args): array {
    if ($cap === 'approve_project' && isset($args[0])) {
        $post = get_post($args[0]);
        return $post && (int) $post->post_author !== $userId ? ['edit_others_projects'] : ['do_not_allow'];
    }
    return $caps;
}, 10, 4);
```

## Where to check

| Surface | Check |
|---|---|
| REST route | `permission_callback => fn (WP_REST_Request $r) => current_user_can('edit_post', (int) $r['id'])` |
| admin-post / AJAX | nonce, then `current_user_can()` |
| Acorn controller | a middleware that maps to `current_user_can()`, or a Gate (below) |
| Livewire action | `current_user_can()` inside every action method; never trust public properties |
| Abilities API | `permission_callback` of the ability (wp-abilities-mcp) |
| ACF field visibility | `acf/prepare_field` returning `false` for users without the capability (acf-native) |

## Gates on top of WordPress capabilities

```php
// In a provider boot()
use Illuminate\Support\Facades\Gate;

Gate::define('update-project', fn ($user, \WP_Post $project) => current_user_can('edit_post', $project->ID));
```

A Gate is a readable wrapper; the source of truth stays the WordPress capability. When a route authenticates with a token instead of cookies, set the WordPress user (`wp_set_current_user($id)`) before any capability check, or every check fails.

## Verification

```
{{runner.wp}} role list
{{runner.wp}} cap list editor
{{runner.wp}} user create test-editor editor@example.test --role=editor
{{runner.wp}} eval 'wp_set_current_user(get_user_by("login","test-editor")->ID); var_dump(current_user_can("edit_projects"));'
```

If Query Monitor is installed, its capability checks panel shows every check made during a request.
