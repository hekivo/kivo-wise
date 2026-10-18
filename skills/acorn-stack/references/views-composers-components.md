# Blade views, View Composers and components under Acorn

Deep reference for rendering Blade in each profile. Loaded on demand from SKILL.md.

## Where views come from

- `config('view.paths')`; by default `resources/views` under the base path. A package or plugin can add a namespace with `$this->loadViewsFrom($path, 'name')` in a provider (`view('name::file')`).
- Compiled templates go to `config('view.compiled')`, by default `<storage>/framework/views/`.

| Profile | Who decides which Blade file renders a WordPress page |
|---|---|
| `sage-theme` | `SageServiceProvider` filters the template hierarchy and `template_include` (priority 100); `index.php` renders `view(app('sage.view'), app('sage.data'))` |
| `acorn-mu-plugin` | Nothing by default. Blade renders only where the plugin calls `view()` (blocks, shortcodes, routes, Livewire). To own full templates, the plugin hooks `template_include` / `{type}_template_hierarchy` in a provider and returns a file it renders through Blade |
| `radicle-app` | The project's theme provider maps WordPress templates to root `resources/views`; the theme folder only has `index.php` and `style.css` |

## View Composers

Acorn's `ViewServiceProvider::attachComposers()` registers:

1. every class listed in `config('view.composers')` (associative array), and
2. every non-abstract subclass of `Roots\Acorn\View\Composer` found recursively under `app/View/Composers/`, using `app()->getNamespace()` to build the class name.

No provider code is needed. A project may wrap this (for example to prefix a view namespace); look at the existing composers first.

```php
<?php

namespace App\View\Composers;   // or your project namespace

use Roots\Acorn\View\Composer;

class SingleCaseStudy extends Composer
{
    protected static $views = ['single-case-study'];

    public function with(): array
    {
        return ['metrics' => $this->metrics()];
    }

    protected function metrics(): array
    {
        return [];   // query and shape here; keep the view dumb
    }
}
```

Rules from `Roots\Acorn\View\Composer`:

- `views()` returns `static::$views`; when it is empty the view name is inferred from the class name after the first three namespace segments (`App\View\Composers\Partials\Header` → `partials/header`).
- Merge order is `with()`, then data already passed to the view, then `override()`. So `with()` never overwrites what the caller passed; `override()` always wins.
- With neither `with()` nor `override()`, public properties and public methods become view variables.
- Constructor injection works (the container builds composers).
- Wildcards work (`['partials.*']`); `'*'` attaches to every view, so keep such composers cheap.

## Blade components

| Kind | Files | Usage |
|---|---|---|
| Class component | `app/View/Components/ProductCard.php` + `resources/views/components/product-card.blade.php` | `<x-product-card :product="$p" />` |
| Anonymous component | `resources/views/components/form/field.blade.php` with `@props([...])` | `<x-form.field name="email" />` |
| Alias | `config('view.components')` associative array → `Blade::component()` | Only when the tag name must differ from the convention |

Prefer the convention over manual `Blade::component()` calls. Generate class components with `{{runner.acorn}} make:component Name` (`--view` for a view-only component).

```blade
@props(['title', 'href' => null])

<article {{ $attributes->merge(['class' => 'card']) }}>
  <h3>{{ $title }}</h3>
  {{ $slot }}
  @if ($href)
    <a href="{!! esc_url($href) !!}">{{ __('Read more', 'your-text-domain') }}</a>
  @endif
</article>
```

## Escaping (summary; full rules in `wp-security-escaping`)

- `{{ $x }}` escapes with `e()`. Do not nest WordPress escapers inside it: `{{ esc_url($u) }}` double-encodes `&` into `&#038;`.
- When WordPress should escape, echo raw: `{!! esc_url($u) !!}`, `{!! esc_attr($a) !!}`.
- `$attributes->merge()` escapes values; pass `false` as the second argument (`$attributes->merge([...], false)`) when the value already went through `esc_*()`.

## Directives

- Built-in Blade: `@php`, `@if`, `@foreach`, `@class`, `@props`, `@include`, `@once`, `@stack`/`@push`.
- `log1x/sage-directives`, when installed: `@query`, `@posts`, `@field`, `@hasfield`, `@sub`, `@shortcode`, `@notempty`, … Check `composer.json` before using them.
- Project directives: `config('view.directives')` (name → callable or class) or `Blade::directive()` in a provider `boot()`. Read the project's directive class before using one: they can shadow package directive names.

## Verify

```bash
{{runner.wp}} eval 'print_r(config("view.paths"));'
{{runner.acorn}} view:clear
{{runner.wp}} eval 'echo view("partials.header")->render();'   # renders outside a request; good for smoke tests
```
