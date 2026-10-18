# Review checklists by area

Deep reference for the convention audit. Loaded on demand from `skills/roots-reviewing/SKILL.md`.

Run the `rg` commands from the app path (`apps[active].path`). Replace `app/` with the app's source folder when it differs. A hit is a lead, not a verdict: open the file before reporting.

## Service providers

- [ ] The theme provider (sage-theme only) extends `Roots\Acorn\Sage\SageServiceProvider`; every other provider extends `Illuminate\Support\ServiceProvider`.
- [ ] `register()` holds bindings only: no `add_action`, no `add_filter`, no reads of WordPress state.
- [ ] `boot()` holds hooks and initialisation.
- [ ] Dependencies arrive through the constructor or the container, not through global state.
- [ ] Every provider on disk is registered where the profile registers them (see the table in SKILL.md). Compare `providers.onDisk` and `providers.registered` from `node scripts/inventory-project.mjs --app <path>`.

```
rg -n "add_action|add_filter" app/Providers          # inside register() is a finding
rg -n "function register" -A12 app/Providers          # read the body
```

## Hooks placement

- [ ] Hooks live in a provider's `boot()` or a dedicated class the provider wires up, not scattered in random files.
- [ ] Hook priority and timing are justified when non-default (see `wp-hooks-lifecycle`): a hook on `init` registered after `init` fired never runs.
- [ ] Theme `setup` files hold only `after_setup_theme` essentials (sage-theme).

## Blade views

- [ ] Data arrives from a View Composer, a component class or the block's `with()`; no queries or business logic in the view.
- [ ] Output is escaped exactly once. `{{ }}` compiles to `e()` with double encoding on, so `{{ esc_url($u) }}` turns `&` into `&#038;` in the browser. When WordPress should escape, echo raw: `{!! esc_url($u) !!}`.
- [ ] Raw `{!! !!}` is used only with a WordPress escaper or trusted markup, never with request input.
- [ ] Layout inheritance and components are used instead of copied markup.

```
rg -n "\{\{\s*esc_(html|attr|url|textarea)" resources/views      # double escape
rg -n "\{!!" resources/views                                       # each needs a reason
rg -n "get_posts|WP_Query|\$wpdb" resources/views                  # queries in views
```

## Post types and taxonomies

- [ ] The project's one mechanism is used (Poet config, `config/post-types.php`, or classes). A second mechanism for the same job is a finding; `register_post_type()` called by hand is acceptable only when the project does that everywhere.
- [ ] Content that grows over time is a post type, not a hardcoded array; shared content uses an options page or option.
- [ ] `show_in_rest` and `rest_base` are set when the type is read through REST.

## ACF Composer (profiles with ACF)

Skip entirely on `radicle-app` unless `log1x/acf-composer` is installed (list it under "Not checked").

- [ ] Created with the generator (`{{runner.acorn}} acf:block <Name>`), not copied by hand.
- [ ] `fields()` returns a Builder `->build()` result; `with()` returns only what the view needs.
- [ ] Views use the variables from `with()`, not `get_field()` calls.
- [ ] Field keys are `field_<group>_<name>` built from names, so renames and regrouping change the key; do not rename fields of stored content without a migration.
- [ ] After changing a block class, the ACF Composer cache was cleared (`{{runner.cache}}`).

```
rg -n "get_field\(|the_field\(" resources/views
rg -n "acf_add_local_field_group" app          # native call duplicated by Builder
```

## Native blocks (radicle-app)

- [ ] Each block has a `block.json` with `name`, `apiVersion`, `render` or a render class, and declared `attributes`.
- [ ] The editor side and the Blade render agree on attribute names.
- [ ] Block assets are declared in `block.json` or enqueued by the project's loader, not by a global enqueue on every page.

## Routes and API

- [ ] Every `register_rest_route` has a `permission_callback` (use `__return_true` for public data, explicitly), argument schemas and sanitisation.
- [ ] Controllers are thin and delegate to services.
- [ ] Use the mechanism the project already uses for routes; do not add a second routing system. When an Acorn route serves JSON, authentication and nonce handling are explicit.
- [ ] Response shapes match the project's API contract document if one exists.

```
rg -n "register_rest_route" -A8 app | rg -v "permission_callback"     # leads for a missing callback
```

## Livewire (only if installed)

Apply the Livewire 4 rules of `acorn-livewire`: public properties are client-visible state, authorise every action, validate on the server, do not trust ids from the browser. A property used for secrets or models without a lock is Critical.

## Assets

- [ ] Vite entries referenced through the project's Vite helpers (`@vite()` / `Vite::asset()` in Sage-style views, or the project loader).
- [ ] Tailwind v4 is CSS-first: no `tailwind.config.js` theme, tokens in `@theme`; follow the project's scoping rule if Tailwind is scoped to a wrapper.
- [ ] No arbitrary-value classes where a token exists, when the project forbids them.
- [ ] Built output (`public/build`) is not edited by hand.

## Security

- [ ] State-changing handlers check a nonce and a capability (`wp_verify_nonce`, `current_user_can`).
- [ ] Input is sanitised on entry (`sanitize_text_field`, `absint`, schema `sanitize_callback`), output escaped on exit.
- [ ] SQL goes through `$wpdb->prepare` or the query builder, never string concatenation.
- [ ] No secret in code, config committed to the repo, or logs.

```
rg -n "\$_(GET|POST|REQUEST)\[" app                       # each needs sanitising
rg -n "\$wpdb->(query|get_results|get_var)\(" app         # each needs prepare()
```

## Language and process (project rules decide)

- [ ] Language of code, comments and docs follows the project rule (many projects require English only).
- [ ] Commit and branch rules are the project's; this review does not enforce a rule the project does not have.

## Tests

- [ ] New behaviour has a test in the project's suite; the test ran green through `{{runner.test}}`.
- [ ] Tests do not depend on production data or network.
