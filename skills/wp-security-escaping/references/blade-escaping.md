# Escaping in Blade

Deep reference for escaping once in Blade views, components and block templates. Loaded on demand from SKILL.md.

## Why double escaping happens

- `{{ $x }}` compiles to `<?php echo e($x); ?>`. `e()` calls `htmlspecialchars($x, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8', true)`: the last argument (double encode) turns an existing `&amp;` into `&amp;amp;`.
- `esc_url()` in display context rewrites `&` to `&#038;`. `esc_html()` / `esc_attr()` use `_wp_specialchars()` with double encoding **off**, so they leave existing entities alone.
- Therefore `{{ esc_url($url) }}` prints `&amp;#038;`, which the browser shows as `&#038;` inside the URL. The query string breaks.
- `e()` returns `Htmlable` values (`HtmlString`, components, `$attributes`) untouched: wrap trusted, already-escaped HTML in `new \Illuminate\Support\HtmlString($html)` instead of reaching for `{!! !!}` in many places.

## Patterns

```blade
{{-- Blade escapes --}}
<h2>{{ $heading }}</h2>
<input value="{{ $query }}">

{{-- WordPress escapes: raw echo, exactly one escaper --}}
<a href="{!! esc_url($link) !!}">{!! esc_html(get_the_title($post)) !!}</a>
<img src="{!! esc_url($image['url']) !!}" alt="{!! esc_attr($image['alt']) !!}">

{{-- Rich HTML: filter, then raw echo --}}
<div class="prose">{!! wp_kses_post($body) !!}</div>

{{-- Data for scripts --}}
<script>window.appConfig = @json($config);</script>
```

Translation helpers follow the same rule: `{{ __('Read more', 'textdomain') }}` (Blade escapes) or `{!! esc_html__('Read more', 'textdomain') !!}` (WordPress escapes), never `{{ esc_html__() }}`.

## Components

```blade
@props(['href' => null])

@php($safeHref = $href ? esc_url((string) $href) : null)

{{-- esc_url() output is already HTML-safe: turn merge() escaping off for it --}}
<a {{ $attributes->merge($safeHref ? ['href' => $safeHref] : [], false) }}>{{ $slot }}</a>
```

- `$attributes->merge($defaults)` escapes the **defaults** with `e()` unless the second argument is `false`.
- Attributes the caller binds on the tag (`<x-link :href="$url" />`) and that are not declared props go into the bag already escaped with `e()` at compile time. Pass plain values there, not `esc_url()` output.
- Declared `@props` are plain PHP variables: escape them where you print them.

## ACF values in views

| Field | Print |
|---|---|
| Text, textarea (formatted) | `{{ get_field('subtitle') }}` or `{!! esc_html(get_field('subtitle')) !!}` if it may hold entities |
| WYSIWYG | `{!! get_field('body', null, true, true) !!}` (ACF escapes with its kses rules) or `{!! wp_kses_post(get_field('body')) !!}` |
| URL / link | `{!! esc_url($link['url']) !!}`, `{{ $link['title'] }}`, `target="{!! esc_attr($link['target'] ?: '_self') !!}"` |
| Image | `wp_get_attachment_image($id, 'large')` (core escapes) printed with `{!! !!}` |

`the_field()` escapes its own output since ACF 6.2.5 and logs removed unsafe HTML (`acf/removed_unsafe_html`); `get_field()` does not escape unless `$escape_html` is `true`.

## Guard test

A test that fails the build when a template wraps a WordPress escaper in `{{ }}`. Adapt the namespace, base class and views path to the profile (theme, plugin or project `resources/views`). With Pest, the same loop goes in an `it()` block.

```php
<?php

namespace Tests\View;

use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

final class BladeEscapeOnceTest extends TestCase
{
    private const VIEWS = __DIR__ . '/../../resources/views';

    public function test_no_wordpress_escaper_inside_blade_echo(): void
    {
        $offenders = [];
        $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(self::VIEWS));

        foreach ($files as $file) {
            if (! str_ends_with($file->getFilename(), '.blade.php')) {
                continue;
            }
            foreach (file($file->getPathname()) as $i => $line) {
                if (preg_match('/\{\{\s*esc_(url|attr|html|textarea|js)(__|_x)?\(/', $line) === 1) {
                    $offenders[] = $file->getPathname() . ':' . ($i + 1);
                }
            }
        }

        $this->assertSame([], $offenders, 'Escaped twice; use {!! esc_*() !!} or {{ $value }}:');
    }
}
```

Run it with `{{runner.test}}`.
