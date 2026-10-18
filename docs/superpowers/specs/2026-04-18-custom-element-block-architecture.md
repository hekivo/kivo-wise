> Historical document from superpowers-sage 2.x. It describes features that were removed or replaced in kivo-wise 3.0 and is kept for reference only.

# Custom Element Block Architecture

**Status:** Approved
**Date:** 2026-04-18
**Target release:** v2.0.0 (breaking change)

## Overview

Adopt the Custom Elements API as the foundation for every ACF Composer block generated
or refactored by the plugin. The block's HTML tag name becomes its single identity across
CSS, JS, and DOM — replacing the prior `.b-{slug}` class convention and the dual-selector
variation hack.

## Rationale

The current pattern uses `$attributes->merge()` directly on a `<section>` root, which
forces a dual selector (`&.is-style-*, .is-style-* &`) because `is-style-*` ends up on
different ancestors in frontend vs editor contexts. This is a workaround for not using
the official ACF Composer stub wrapper pattern.

Moving the stub wrapper into place AND adopting a custom element as the inner identity
eliminates the dual selector, simplifies CSS to a single selector, and unlocks a free JS
lifecycle via `connectedCallback()`.

## Decisions

| # | Decision | Value |
|---|---|---|
| D1 | Custom element tag prefix | `block-{slug}` |
| D2 | Custom element mandatory | Yes — even for blocks without JS behavior |
| D3 | Base class location | In the theme at `resources/js/core/BaseCustomElement.js` |
| D4 | Outer wrapper element | `<section>` (semantic landmark) with `@unless ($block->preview)` |
| D5 | Localization at scaffold | `--localize` flag is the default |
| D6 | Block controller fields | `$spacing`, `$supports`, `$styles` all declared |

## Architecture

### View pattern (canonical)

```blade
@unless ($block->preview)
  <section {{ $attributes }}>
@endunless

<block-{slug} class="flex flex-col">
  {{-- block content --}}
</block-{slug}>

@unless ($block->preview)
  </section>
@endunless
```

### Rendered HTML

**Frontend:**

```html
<section class="wp-block-acf-{slug} is-style-neutral has-padding-top">
  <block-{slug} class="flex flex-col">...</block-{slug}>
</section>
```

**Editor (Gutenberg):**

```html
<div class="wp-block [...] is-style-neutral">
  <block-{slug} class="flex flex-col">...</block-{slug}>
</div>
```

In both contexts, `is-style-*` lands on an ancestor of `block-{slug}`. A single CSS
selector covers both:

```css
block-{slug} {
  display: block;
  --block-bg: var(--color-surface);
  background: var(--block-bg);
}

.is-style-neutral block-{slug} {
  --block-bg: var(--color-surface-muted);
}

.is-style-dark block-{slug} {
  --block-bg: var(--color-surface-inverse);
}
```

### JS pattern (canonical)

`resources/js/blocks/{slug}.js`:

```js
import BaseCustomElement from '../core/BaseCustomElement.js';

export default class Block{PascalSlug} extends BaseCustomElement {
  static tagName = 'block-{slug}';

  init() {
    // Block behavior. Empty for static blocks.
  }
}

BaseCustomElement.register(Block{PascalSlug});
```

### Controller pattern (canonical)

`app/Blocks/{ClassName}.php`:

```php
public $name = '{Human Name}';
public $description = '{One-line description}';
public $category = '{project-category}';
public $icon = '{dashicons-name}';
public $keywords = ['{keyword1}', '{keyword2}'];

public $spacing = [
    'padding' => null,
    'margin'  => null,
];

public $supports = [
    'align'      => ['wide', 'full'],
    'color'      => ['background' => true, 'text' => true],
    'typography' => ['fontSize' => false],
];

public $styles = [
    ['label' => 'Light',   'name' => 'light',   'isDefault' => true],
    ['label' => 'Neutral', 'name' => 'neutral'],
    ['label' => 'Dark',    'name' => 'dark'],
];

public function assets(array $block): void
{
    // Intentionally empty — CSS/JS enqueued by ThemeServiceProvider::boot()
    // via has_block() at wp_enqueue_scripts priority 20.
}
```

### Enqueue pattern

`app/Providers/ThemeServiceProvider.php::boot()`:

```php
add_action('wp_enqueue_scripts', function () {
    $blocks = [
        'hero-section' => true,
        'faq'          => true,
        // ...
    ];

    foreach (array_keys($blocks) as $slug) {
        if (! has_block("acf/{$slug}")) {
            continue;
        }

        $cssAsset = \Roots\asset("css/blocks/{$slug}.css");
        if ($cssAsset->exists()) {
            wp_enqueue_style("block-{$slug}", $cssAsset->uri(), [], $cssAsset->version());
        }

        $jsAsset = \Roots\asset("js/blocks/{$slug}.js");
        if ($jsAsset->exists()) {
            wp_enqueue_script("block-{$slug}", $jsAsset->uri(), [], $jsAsset->version(), true);
        }
    }
}, 20);
```

### Scaffold command

```bash
lando acorn acf:block {ClassName} --localize
```

## Constraints

1. **Custom element tag name must contain a hyphen** — WHATWG spec. The `block-` prefix
   guarantees this always.
2. **Default `display` is `inline`** — every block CSS must set `display: block/flex/grid`.
3. **Editor interactivity requires explicit `enqueue_block_editor_assets`** — frontend
   footer enqueue alone does not upgrade custom elements inside the editor iframe.
4. **Content inside `<block-{slug}>` is light DOM** — NOT Shadow DOM. Standard selectors
   and cascade apply; no `:host` pseudo-class.
5. **Avoid double landmark** — if the custom element renders a `<section role="region">`
   internally, the outer `<section>` wrapper duplicates the landmark. Prefer neutral
   internal markup and let the outer `<section>` carry the landmark, or vice versa.

## Migration from v1.x

Existing blocks using `.b-{slug}` + dual selector continue to work. Migration is
opt-in via `/block-refactoring`, which detects the v1 pattern and proposes the upgrade:

1. Replace `<section {{ $attributes->merge(['class' => 'b-{slug}']) }}>` with the
   `@unless ($block->preview)` wrapper + `<block-{slug}>` inner.
2. Rewrite CSS selector from `.b-{slug}` to `block-{slug}` + simplify dual selector to
   single.
3. Add `resources/js/blocks/{slug}.js` stub (empty `init()`).
4. Ensure `BaseCustomElement.js` exists in the theme; create from plugin template if
   missing.
5. Update `ThemeServiceProvider::boot()` enqueue to include JS path.

## Non-goals

- Shadow DOM encapsulation — too invasive for WordPress editor integration
- Slotted content — not needed for ACF block data flow
- Reusable custom elements outside blocks — out of scope for this release
- Custom elements for non-block UI components (Button, Eyebrow) — those remain Blade
  components; custom element pattern is block-specific

## Acceptance

This spec is satisfied when:
- [ ] `/block-scaffolding` generates view, CSS, JS, controller following canonical patterns
- [ ] `/block-refactoring` detects v1 pattern and migrates to v2
- [ ] Plugin provides `BaseCustomElement.js` template copied into theme on first scaffold
- [ ] `sageing` workflow table references the updated skills
- [ ] Migration guide exists documenting v1 → v2 upgrade
