# Custom post types and taxonomies per profile

Deep reference for registering CPTs and taxonomies through the project's registry. Loaded on demand from SKILL.md.

All three registries below call Extended CPTs (`register_extended_post_type()` / `register_extended_taxonomy()`), so the arguments are WordPress's `register_post_type()` / `register_taxonomy()` arguments plus Extended CPTs keys (`admin_cols`, `admin_filters`, `archive`, `site_filters`, `site_sortables`, `quick_edit`, `meta_box`, `exclusive`…). Check the installed `johnbillion/extended-cpts` version for the exact list.

## Poet (`log1x/poet`, common on `sage-theme` and `acorn-mu-plugin`)

- Reads `config/poet.php` (publish it; Poet does not merge a default config). Registers on `init` at priority 4 (`poet.hookPriority`).
- Keys: `post`, `taxonomy`, `block`, `block_category`, `block_pattern`, `block_pattern_category`, `palette`, `admin_menu`.

```php
// config/poet.php
return [
    'post' => [
        'case-study' => [
            'enter_title_here' => 'Customer name',
            'menu_icon' => 'dashicons-portfolio',
            'supports' => ['title', 'editor', 'thumbnail', 'revisions'],
            'show_in_rest' => true,
            'has_archive' => true,
            'labels' => ['singular' => 'Case study', 'plural' => 'Case studies'],
        ],
    ],
    'taxonomy' => [
        'industry' => [
            'links' => ['case-study'],        // post types this taxonomy attaches to
            'meta_box' => 'radio',
            'labels' => ['singular' => 'Industry', 'plural' => 'Industries'],
        ],
    ],
];
```

- A plain string entry (`'post' => ['book']`) registers with defaults; `false` as the value unregisters an existing type.
- Some mu-plugins build these arrays from classes (one class per CPT with `getSlug()` / `getArgs()`, collected into `config/poet.php` by a helper). If the project does that, add a class with the project's generator or stub instead of editing the array.

## `roots/acorn-post-types` (`radicle-app`)

- Provider auto-discovered through the package's `extra.acorn.providers`; merges its default config under `post-types`. Publish to edit: `{{runner.acorn}} vendor:publish --provider="Roots\AcornPostTypes\AcornPostTypesServiceProvider"`.
- Registers on `init` at priority 100.
- Keys: `post_types` and `taxonomies`. Each entry's `names` array (`singular`, `plural`, `slug`) is passed as Extended CPTs names; a taxonomy's `post_types` array lists the post types it attaches to.

```php
// config/post-types.php
return [
    'post_types' => [
        'case-study' => [
            'menu_icon' => 'dashicons-portfolio',
            'supports' => ['title', 'editor', 'thumbnail', 'revisions'],
            'show_in_rest' => true,
            'names' => ['singular' => 'Case study', 'plural' => 'Case studies', 'slug' => 'case-studies'],
        ],
    ],
    'taxonomies' => [
        'industry' => [
            'post_types' => ['case-study'],
            'meta_box' => 'radio',
            'names' => ['singular' => 'Industry', 'plural' => 'Industries'],
        ],
    ],
];
```

## No registry installed

Register in a provider: `add_action('init', fn () => register_extended_post_type(...))` if Extended CPTs is installed, otherwise `register_post_type()`. Keep one provider for all content types.

## Priorities matter

Poet (4) and acorn-post-types (100) register on `init` at different priorities. Code that checks `post_type_exists()` or registers rewrite rules on `init` must run at a higher priority than the registry.

## After adding or changing a type

1. `{{runner.acorn}} optimize:clear && {{runner.acorn}} optimize` (the config file is cached by `optimize`).
2. `{{runner.wp}} rewrite flush`.
3. Templates: `single-{slug}` / `archive-{slug}` Blade views where the profile resolves WordPress templates (see `acorn-stack`).
4. Fields: an ACF field group with `setLocation('post_type', '==', 'case-study')` (see `acf-fields.md`) or `register_post_meta()` on profiles without ACF.

Changing the slug or rewrite of an existing type breaks URLs, stored relationships and menu items: escalate.
