# InnerBlocks in ACF Composer blocks

Deep reference for container blocks (blocks that hold other blocks). Loaded on demand from SKILL.md.

## Requirements

1. `'jsx' => true` in `$supports`.
2. A self-closing `<InnerBlocks … />` tag in the Blade view.

`allowedBlocks`, `template`, `templateLock` and `orientation` are **attributes of the tag**, not class properties. ACF Composer only adds `$template` (default children), `$parent` / `$ancestor` (where a child may be inserted) and `$uses_context` / `$provides_context`.

## View

```blade
<section {{ $attributes->merge(['class' => 'feature-grid']) }}>
  <InnerBlocks
    template="{{ $block->template }}"
    allowedBlocks="{{ wp_json_encode(['acf/feature-card', 'core/image']) }}"
    templateLock="false"
  />
</section>
```

- ACF Composer's own stub prints `template="{{ $block->template }}"`; the double-quoted attribute with `{{ }}` encodes the JSON quotes as `&quot;`, which the browser decodes. A raw echo inside single quotes (`allowedBlocks='{!! wp_json_encode([...]) !!}'`) also works. Do not mix a raw echo with double quotes.
- In the editor the tag becomes the nested block editor. On the front end (and when an ACF block renders inside another ACF block) ACF Pro replaces the placeholder with the rendered children using a regex that requires the `/>` ending. A `class` or `className` attribute on the tag becomes the wrapper's class. You do not echo `$content` yourself.

## Default children: `$template` format

`$block->template` is the JSON ACF Composer builds from `$template` in `render()`. It accepts:

```php
// Map form: block name => attributes (each block name once)
public $template = [
    'core/heading' => ['placeholder' => 'Section title'],
    'core/paragraph' => ['placeholder' => 'Intro text'],
];

// List of single-entry maps: repeat the same block
public $template = [
    ['acf/feature-card' => []],
    ['acf/feature-card' => []],
    ['acf/feature-card' => []],
];

// Nesting: an innerBlocks key inside the attributes
public $template = [
    'core/group' => ['layout' => ['type' => 'flex'], 'innerBlocks' => [
        'core/heading' => ['level' => 3],
    ]],
];
```

Not valid: the editor's positional form `[['core/heading', [...]]]`. ACF Composer reads the first array key as the block name, so a positional entry produces a block named `0`.

## Locking

| `templateLock` | Editors can |
|---|---|
| `false` | Add, remove and reorder freely |
| `insert` | Edit and reorder, not add or remove |
| `all` | Edit content of existing children only |
| `contentOnly` | Edit content only; no structural changes or settings |

## Child-only blocks

`public $parent = ['acf/feature-grid'];` keeps a block out of the main inserter and allows it only as a direct child; `$ancestor` allows any depth.

## Sharing data parent → child

Children render independently and cannot read the parent's fields. Either:

- block context: parent `public $provides_context = ['acme/grid-style' => 'className'];`, child `public $uses_context = ['acme/grid-style'];`, then `$block->context['acme/grid-style'] ?? null` in the child, or
- CSS custom properties set on the parent root and read by the children (enough when the child only needs a look).

## Checks

- Only the allowed blocks appear in the container's inserter.
- Front-end HTML has the children inside the wrapper and no literal `<InnerBlocks` text.
- Each child's CSS loads on the front end (nested blocks count for `has_block()`).
