# Native blocks rendered with Blade

Deep reference for native blocks rendered with Blade. Loaded on demand from SKILL.md.

Native blocks are registered with WordPress's own `register_block_type()`, edited through a JSX editor script, and rendered on the server by a Blade view. This is the default on `radicle-app` and the fallback on any profile without ACF Composer.

## When this applies

- `radicle-app`: no ACF by default. The project usually ships a `make:block` console command and a provider that registers its blocks. Run `{{runner.acorn}} list | grep block` and copy the shape of an existing block before writing anything.
- Any profile where content must be editable as block attributes (no meta box, no ACF dependency).

## The three parts

| Part | Typical location | Job |
|---|---|---|
| Registration (PHP) | A provider's `boot()` hooking `init` (often a dedicated blocks provider), or a `block.json` registered with `register_block_type($dir)` | Declares name, attributes, supports and the `render_callback` |
| Server render (Blade) | `resources/views/blocks/{slug}.blade.php`, called from the render callback (often a small class per block with a `render()` method) | Builds the front-end markup from `$attributes` and `$content` |
| Editor UI (JSX) | An editor entry under `resources/js/` built by the project's Vite config | `registerBlockType()` with `edit` (and `save: () => null` or `<InnerBlocks.Content />` for dynamic blocks) |

Registration sketch (names are placeholders):

```php
add_action('init', function (): void {
    register_block_type('acme/pricing-teaser', [
        'api_version' => 3,
        'attributes' => [
            'title' => ['type' => 'string', 'default' => ''],
            'plans' => ['type' => 'array', 'default' => []],
        ],
        'supports' => ['anchor' => true, 'spacing' => ['margin' => true]],
        'render_callback' => fn (array $attributes, string $content) => view('blocks.pricing-teaser', [
            'attributes' => $attributes,
            'content' => $content,
            'wrapper' => get_block_wrapper_attributes(),
        ])->render(),
    ]);
});
```

Blade:

```blade
<section {!! $wrapper !!}>
  @if ($attributes['title'])
    <h2>{{ $attributes['title'] }}</h2>
  @endif
  {!! $content !!}
</section>
```

- `get_block_wrapper_attributes()` returns already-escaped attributes for block supports (classes including `is-style-*`, spacing, anchor). Echo it raw.
- `editor_script` / `editor_style` / `style` handles (or `editorScript`, `style`, `viewScript` in `block.json`) let WordPress load assets only where the block is used.
- Dynamic blocks (`render_callback`) save `null` from JSX and keep markup in Blade; parity between editor and front end is your responsibility (the editor shows the JSX `edit` view, or `ServerSideRender`).

## Native-first choices

| Need | Native mechanism |
|---|---|
| Editable fields | Block attributes with `RichText`, `InspectorControls`, `MediaUpload` |
| Data per post, not per block | `register_post_meta()` with `show_in_rest`, edited through the editor's meta APIs |
| Style variants | `styles` in registration or `register_block_style()` |
| Default children | `InnerBlocks` with `template` and `templateLock` in JSX |
| Restrict placement | `parent`, `ancestor`, `allowedBlocks` |

## Verify

```bash
{{runner.wp}} eval 'var_dump(WP_Block_Type_Registry::get_instance()->is_registered("acme/pricing-teaser"));'
{{runner.node}} run build      # or the project's build tooling
```

Then insert the block, save, reload the editor (attribute validation errors show as "This block contains unexpected or invalid content" when saved markup changed), and compare with the front end.
