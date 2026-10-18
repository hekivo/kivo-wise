# State patterns in Livewire 4

Deep reference for `wire:model`, attributes, lifecycle hooks, events and loading states. Loaded on demand from SKILL.md.

Facts were checked against Livewire 4.3.5 (`vendor/livewire/livewire/dist/livewire.js`, `src/Features/*`). After a Livewire upgrade, check them again in the app's own `vendor/`.

## `wire:model`: v4 modifier layering (breaking change from v3)

In v4, modifiers **before** `.live` control when the client-side value syncs. Modifiers **after** `.live` control when the network request fires. Without `.live` (or the legacy `.lazy`), nothing is sent until another action commits.

| Directive | Client value syncs | Request sent |
|---|---|---|
| `wire:model="x"` | on every input | no (travels with the next action) |
| `wire:model.blur="x"` | on blur | **no** |
| `wire:model.change="x"` | on change | no |
| `wire:model.enter="x"` | on Enter | no |
| `wire:model.live="x"` | on every input | yes; debounced 150 ms for text inputs and textareas, immediate for checkboxes, radios and selects |
| `wire:model.live.debounce.400ms="x"` | on every input | 400 ms after the last input |
| `wire:model.live.throttle.500ms="x"` | on every input | at most every 500 ms |
| `wire:model.live.blur="x"` | on every input | on blur, only if the component is dirty (this is what v3 `.blur` did) |
| `wire:model.blur.live="x"` | on blur | shortly after blur |
| `wire:model.lazy="x"` (legacy) | on every input | on change |

Other details from the same directive:

- v4 adds `.self` by default, so `wire:model` on a wrapper ignores input events bubbling from children. Add `.deep` to opt out.
- `.defer` is a v2 modifier and is ignored: `wire:model.defer` behaves like plain `wire:model`.
- File inputs are handled separately: `wire:model` on `type="file"` uploads immediately (see `file-uploads.md`).
- Binding to a property that does not exist logs `Livewire: [wire:model="x"] property does not exist on component`.

Default to plain `wire:model`. Every `.live` event is an HTTP request against an uncached endpoint.

## Attributes

| Attribute | Use |
|---|---|
| `#[Locked]` | Values set at mount that the client must not change. A client update throws (419 in production). |
| `#[Computed]` | Derived data, not serialized, memoized for the request. Read it in Blade as `$this->name`. |
| `#[Validate([...])]` | Rules next to the property; `$this->validate()` / `validateOnly()`. Alternatively `rules()` (+ `messages()`). Pick one style per class. |
| `#[On('event')]` | Listen to events dispatched from PHP or JS. |
| `#[Url]` | Mirror a property in the query string. On cached pages this multiplies cache keys; decide deliberately. |
| `#[Renderless]` | Action that does not re-render. |
| `#[Reactive]`, `#[Modelable]` | Parent to child data flow. |
| `#[Lazy]`, `#[Defer]` | Render after page load (placeholder first). |

Also present in 4.3.5 `src/Attributes`: `Authorize`, `Async`, `Isolate`, `Js`, `Json`, `Session`, `Title`, `Layout`, `Transition`.

## Lifecycle hooks (`SupportLifecycleHooks`)

First render: `boot` → `mount(...$params)` → `booted` → `rendering` / `rendered` → `dehydrate`.

Each update request: `boot` → `hydrate` (+ `hydrate{Prop}`) → `booted` → for each changed property `updating` / `updating{Prop}` → set → `updated` / `updated{Prop}` → actions → render → `dehydrate`.

Errors: `exception($e, $stopPropagation)`.

- `updating($property, $value)` / `updated($property, $value)` receive the full dotted path. `updated{Prop}($value, $key)` uses the StudlyCase name (`updatedWorkArea`).
- Trait hooks are suffixed with the trait basename: `mountHasFilters()`, `bootHasFilters()`, `bootedHasFilters()`, and the same for hydrate, dehydrate, updating and updated.
- `mount()` arguments resolve by name from the embed array. Class-typed arguments are injected from the Acorn container; action methods get the same injection.
- Use `booted()` for per-request context needed before any action: a multilingual plugin's current language, a switched blog, a feature flag.

## What persists between requests

- **Public properties only.** They form the snapshot, which is in the DOM and is sent on every request. Keep them scalar or arrays of scalars. Store IDs, not `WP_Post` / `WP_Term`, and resolve objects in a `#[Computed]` method or in `render()`.
- **Private and protected properties reset every request.** Useful for one-shot guards inside one request.
- **Snapshot shape matters for cached HTML.** Adding, removing or reordering public properties (moving them into a trait reorders them) breaks pages still served with the old snapshot. See `common-errors.md`.
- **Payload limits** (vendor defaults, `config/livewire.php` → `payload`): `max_size` 1 MB, `max_nesting_depth` 10, `max_calls` 50, `max_components` 200. Send flat data.

## Rendering control

- `$this->skipRender()` sends no HTML morph for this request. Unit tests call hooks outside a Livewire request, so guard it (for example check that the Livewire data store is bound in the container before calling it).
- `wire:key` on loop items and on subtrees that must be replaced instead of morphed (wizard steps). Pass `key()` as the third argument of `@livewire()` when the same component can be mounted with different inputs.

## Events

```php
$this->dispatch('lead-submitted', email: $this->email);   // browser and listeners

#[On('scheduler-booked')]
public function onSchedulerBooked(): void { /* ... */ }
```

From JS: `window.Livewire.dispatch('origin-updated', { origin })`. In a component's `@script` block: `$wire.on('step-completed', (e) => …)`. Globally: `Livewire.on(...)`. `emit()` is v2 and does not exist.

## Loading states

Always scope with `wire:target`; without it every request on the page toggles the state.

```blade
<button type="button" wire:click="nextStep" wire:loading.attr="disabled" wire:target="nextStep">Next</button>
<div wire:loading.class="opacity-50" wire:target="search,category">…</div>
```

## Tests

Two patterns work under Acorn:

- Instantiate the component class directly in a plain PHPUnit test, bind fakes in the container, call methods and hooks (`$c->updated('email')`), assert state. No WordPress boot needed if the class keeps WordPress calls behind injectable services.
- `Livewire::test(Component::class)` when the project's test bootstrap boots Acorn with Livewire registered.

Run either through `{{runner.test}}`.
