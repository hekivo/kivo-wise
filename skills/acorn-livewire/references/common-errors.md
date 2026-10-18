# Common Livewire 4 errors under Acorn

Deep reference: symptom, cause and fix for Livewire failures in Acorn apps. Loaded on demand from SKILL.md.

Start with the cache check: many "new bugs" right after a deploy are stale HTML.

## 0. Is the page stale?

```bash
curl -sI https://<site>/<path> | grep -iE 'cache|age|x-cache'
curl -sI "https://<site>/<path>?nocache=$(date +%s)" | grep -iE 'cache|age|x-cache'
```

If the cached copy is old and the cache-busted URL works, the code is fine. Deploys do not purge every cache layer (page cache plugin, reverse proxy, CDN). Ask for a purge; do not change code to work around it.

## `RangeError: Maximum call stack size exceeded` in `dataSet`

- **Cause:** cached HTML carries a snapshot whose public-property **order or set** no longer matches the deployed class. Livewire 4's client diff reports a root-level change and `dataSet('')` recurses. Moving properties into a trait reorders them.
- **Fix:** purge the cached pages. When you change the property shape of a component on a cached page:
  - Avoid reordering or moving public properties without a reason; adding is less risky than reordering but still changes the snapshot.
  - Plan the purge as part of the release.
  - Use a **release token**: a component can define `public static function releaseToken(): string { return 'v2'; }`, and `config('livewire.release_token')` works app-wide (vendor default `'a'`). A stale snapshot then fails with HTTP 419 and the client shows "This page has expired. Would you like to refresh the page?" instead of crashing. The reload still gets stale HTML until the purge. Source: `src/Features/SupportReleaseTokens/`.

## 404 on the script or on `POST …/update`

- **Testing with curl:** the update route carries `RequireLivewireHeaders`, which aborts with 404 when the `X-Livewire` header is missing. Test from the browser.
- **Endpoint hash changed:** the `/livewire-<hash>` prefix is the first 8 hex characters of `sha256(app.key . 'livewire-endpoint')`. If `APP_KEY` differs between instances or changed in a deploy, cached pages and other instances point to another hash. Compare `{{runner.acorn}} route:list --path=livewire` with the rendered `data-update-uri` and script `src`.
- **Path prefix:** Acorn calls `URL::forceRootUrl(home_url())` at boot. A multilingual plugin that adds a language segment to `home_url()` (or a subdirectory install) can produce `/xx/livewire-…` URLs that match no route. Pin the root URL to `get_option('home')` in a provider that runs after Livewire's, or re-register the routes with `Livewire::setUpdateRoute()` / `setScriptRoute()`, and never build Livewire URLs with `home_url()`.
- **Stale assets:** a cached page referencing old hashed bundles gets 404s for the theme or plugin assets too (same root cause as section 0).
- There is no literal `/livewire/update` path in v4.

## 419 "This page has expired"

Acorn's default `web` middleware group has `PreventRequestForgery` commented out, so no CSRF token is checked on the update route unless the project added it back. In Livewire 4.3.5 a 419 comes from:

- **Release-token mismatch** (stale snapshot after a token bump, or the class was renamed or removed while cached pages still reference it).
- **Corrupt snapshot checksum** (`CorruptComponentPayloadException`): the snapshot was edited client-side, or the `app.key` that signed it differs from the one verifying it.
- **Locked property write** (`CannotUpdateLockedPropertyException`).
- **Type error** while setting a typed property (often scanners posting wrong types).

With `app.debug` on, the last three render a full error instead. Fix by reloading a fresh copy or aligning `APP_KEY`; do not touch session lifetime. If the project added `ValidateCsrfToken` to the `web` or `wordpress` group, a missing or expired token is a fifth cause.

## "Unable to find component"

- The class must sit under `config('livewire.class_namespace')` in the matching folder. The name is the kebab-case class path: `SignupWizard` → `signup-wizard`, `Forms\Contact` → `forms.contact`.
- A new class is not picked up: dump the autoloader in the Acorn base path (`{{runner.composer}} dump-autoload`), then `{{runner.cache}}`.
- Created with `make:livewire` without `--class`: you got a single-file component in `resources/views/components/⚡…`. Delete it and regenerate with `--class`.

## Language or site context lost after the first interaction

- **Cause:** the update request has no language prefix or query argument, so a multilingual plugin falls back to its default language.
- **Fix:** capture the language at render (`#[Locked]` property or a `mount()` argument from the Blade view) and switch to it in `booted()` (or before any language-dependent query) with the plugin's own API.

## A field change does not reach the server

- In v4, `wire:model.blur` / `.change` / `.enter` only change when the **client** value syncs; no request is sent. Use `.live.blur` or call an action. See `state-patterns.md`.
- The property must be `public` and exist on the component.
- The property is `#[Locked]`: a client update throws. Use an action that validates the input.

## Hydration and payload errors

- A public property holds a `WP_Post`, `WP_Term`, closure or service: store the ID and resolve the object in a `#[Computed]` method or `render()`.
- `PayloadTooLargeException`, `MaxNestingDepthExceededException`, `TooManyCallsException`: the request exceeded `payload.max_size` (1 MB), `max_nesting_depth` (10), `max_calls` (50) or `max_components` (200). Send less data.

## Multiple root elements

With `app.debug` on, Livewire throws `MultipleRootElementsDetectedException` at mount. Without it, the component misbehaves silently. Wrap the view in one element.

## Two Alpine instances

Symptoms: `x-data` initializes twice, `$wire` undefined in some components. Cause: a script imported and started `alpinejs` on a page that also loads Livewire. Use the `window.Alpine` guard (`alpine-interop.md`).

## A nested component's `wire:init` never runs

A child added by a parent morph may not fire `wire:init`. Load the data in `mount()`, or trigger it from the parent action.

## Where to look

- The Acorn log (`storage/logs/` in the base path, or `wp-content/cache/acorn/logs/` without a `storage/` folder) and the WordPress `debug.log` when `WP_DEBUG_LOG` is on. See `acorn-background` for logging channels.
- Browser Network tab → the `update` request's response. With `app.debug` on, errors render in Livewire's modal.
