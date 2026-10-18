# Block style variants and editor/front-end parity

Deep reference for `$styles`, `is-style-*` selectors and keeping the editor preview identical to the front end. Loaded on demand from SKILL.md.

## Declaring variants

```php
public $styles = ['light', 'dark'];                                   // names; first is default

public $styles = [                                                    // explicit labels / default
    ['name' => 'light', 'label' => 'Light'],
    ['name' => 'dark', 'label' => 'Dark', 'isDefault' => true],
];
```

The editor's Styles panel adds `is-style-{name}` to the block's `className`. ACF Composer exposes the active name as `$block->style` and includes the class in `$attributes` on the front end.

## Where the class lands

| Context | Element carrying `is-style-*` |
|---|---|
| Front end | The element of your view that prints `{{ $attributes }}` |
| Editor preview | WordPress's block wrapper, an **ancestor** of your markup (`$attributes` is empty in preview) |

Two valid markup patterns, and the selector each needs:

| View pattern | CSS that works in both places |
|---|---|
| Root element prints `$attributes` (single root, recommended) | `.is-style-dark &, &.is-style-dark { … }` nested in the root selector |
| Outer wrapper prints `$attributes` and an inner element is the styling root | `.is-style-dark .inner-root { … }` (the class is an ancestor in both places) |

```css
.pricing-teaser {
  --surface: var(--color-surface);
  --heading: var(--color-fg);

  .is-style-dark &,        /* editor: class on an ancestor */
  &.is-style-dark {        /* front end: class on the root */
    --surface: var(--color-surface-inverse);
    --heading: var(--color-fg-inverse);
  }
}
```

`&.is-style-dark &` means "a root inside a root that has the class"; it does not cover the editor.

Variants should only switch CSS custom properties; the rest of the stylesheet reads the variables. Use `$block->style` in Blade only for structural differences (an extra element, a different partial).

## Variant or field?

| Need | Use |
|---|---|
| One visual theme switch (light, dark, brand) | `$styles` |
| Two independent axes (layout and colour) | ACF select fields turned into classes in the view |
| Different fields per mode | ACF conditional logic on a field you own (it cannot read the Styles panel) |
| Completely different markup | Another block |

## Parity rules

| Aspect | Editor preview | Front end |
|---|---|---|
| `$block->preview` | `true` | `false` |
| `$attributes` | Empty; WordPress's wrapper has the support classes and spacing | Full classes, inline style, anchor `id` |
| Theme JS | Usually not loaded in the editor iframe | Loaded |
| Field values | Empty until filled; `$example` shows in the inserter and preview | Stored values only |

1. Style selectors must match both places (above).
2. Content must be visible without JS. Do not hide content until a script or custom element upgrades it; scope any "hidden until ready" rule to `:defined` or to a class the script adds.
3. Custom elements default to `display: inline`; give the root `display: block` so margins and backgrounds behave the same.
4. Optional parts: wrap them in conditionals; show editor-only hints with `@if ($block->preview)`, never on the front end.
5. Keep one root that prints `$attributes`. Avoid the stub's `@unless ($block->preview) <div {{ $attributes }}>` wrapper juggling unless the project already uses it consistently.
6. Preview data must never reach the published page: fall back to `$example` only when `$block->preview` is true.

## Drift checklist

| Symptom | Likely cause | Fix |
|---|---|---|
| Variant correct on front end, wrong in editor | Only `&.is-style-x` | Add `.is-style-x &` |
| Variant correct in editor, wrong on front end | View root does not print `$attributes` | Print `{{ $attributes }}` on the root |
| Blank block in the editor | Content hidden until JS runs | Rule 2 |
| Spacing differs | Spacing from supports applied to different elements | Structural spacing in block CSS; supports only for editor-adjustable margins |
| Sample text on the live page | Unconditional fallback to `$example` | Check `$block->preview` first |
| Unstyled in editor | Block CSS not enqueued for the editor | Load it in the editor the way the project does (`enqueue_block_assets`, editor stylesheet, or `block.json` `editorStyle`) |
