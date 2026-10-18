# Alpine and Livewire 4

Deep reference for Alpine alongside Livewire components, `$wire`, inline scripts and cache-safe hydration. Loaded on demand from SKILL.md.

## Where Alpine comes from

- On a page that loads the Livewire script, **Alpine comes from Livewire's bundle** (`window.Alpine`). Do not import or start a second copy there.
- If the project also ships `alpinejs` for pages without Livewire, guard the entry point:

```js
import Alpine from 'alpinejs';

if (window.Alpine) {
  window.Alpine.data('pricingToggle', pricingToggle);
} else {
  window.Alpine = Alpine;
  Alpine.data('pricingToggle', pricingToggle);
  Alpine.start();
}
```

- On Livewire pages, register Alpine components inside `alpine:init`:

```js
document.addEventListener('alpine:init', () => {
  window.Alpine.data('signupIdentity', signupIdentity);
});
```

If two entry points can register the same component on one page, guard against double registration with a window flag.

## Inline component scripts

`@script … @endscript` in a component view runs when the component initializes and gives you `$wire`. Keep anything long in a module built by Vite (see `tailwind-vite-assets`) so it is linted and bundled.

## `$wire`

| Use | Example |
|---|---|
| Read a public property | `$wire.stepId` |
| Call an action (returns a Promise) | `await $wire.finalize(password, tracking)` |
| Set a property (queues a request) | `$wire.category = 'it'` |
| Two-way bind Alpine state | `x-data="{ open: $wire.entangle('showModal') }"` |
| Root element | `$wire.$el` |

**Batch writes.** Each `$wire.prop = value` is its own request, and concurrent requests can resolve out of order and overwrite each other's DOM. Send one action with all values instead: `$wire.applyIdentity(email, industry, size)`.

**Secrets stay in Alpine.** Pass them as action arguments on the request that needs them. Never bind them to a public property: the snapshot is plaintext in the DOM.

## Cache-safe hydration

When the page HTML is cached (page cache plugin, reverse proxy, CDN), the first render is identical for every visitor:

1. Render neutral defaults. Pre-render lookup data into the page with `@js(...)` if JS needs it.
2. Resolve per-visitor state in the browser (URL parameters, referrer, a JSON endpoint).
3. Apply it with one Livewire action or one event: `Livewire.dispatch('origin-updated', { origin })`.

Do not read `$_GET` or cookies in `mount()` for anything that varies per visitor on a cached page.

## `wire:ignore`

Put `wire:ignore` (or `wire:ignore.self`) on elements owned by Alpine or a third party (captcha widgets, phone inputs with country pickers, animation containers). Otherwise the next morph overwrites their DOM.

## Livewire JS hooks

Register them after `livewire:init`:

```js
document.addEventListener('livewire:init', () => {
  window.Livewire.hook('morph', ({ el, toEl }) => { /* before a DOM patch */ });
  window.Livewire.hook('commit', ({ component, respond }) => {
    respond(() => { /* after the response, before paint */ });
  });
  window.Livewire.hook('component.init', ({ component }) => { /* once per component */ });
});
```

## Styling

Tailwind 4 scans source files, so dynamic class names (`text-{{ $color }}-500`) are invisible to it. Use full class names or a ternary.
