# Symptom to cause to fix

Deep reference for common failures. Loaded on demand from `SKILL.md`. Commands use the runner placeholders.

## 500 or white screen

1. Read the last 50 lines of the Acorn log and `debug.log` first.
2. `{{runner.acorn}} list`: if it fails, the boot is broken. Typical causes:
   - `vendor/` missing or from another branch for that Acorn base path (run Composer install with the right `--working-dir`).
   - A provider named in the provider list or `extra.acorn.providers` does not exist (typo, wrong namespace, class not autoloaded).
   - `storage/` not writable by the web user (views cannot compile, logs cannot be written).
   - PHP version below the package requirement after a dependency update.
3. If `list` works but the page fails, reproduce with the URL and read the stack trace. Errors in Blade show the compiled file path; the last line of that file names the source view.

## Blade shows old or wrong output

- `{{runner.acorn}} view:clear`, reload. If still old, restart PHP (OPcache) and check that you edited the file the template hierarchy actually loads (a plugin or child theme may shadow it).
- Double-escaped output (`&amp;` visible): a value is escaped twice, for example `{{ esc_url($x) }}` inside `{{ }}`. Blade's `{{ }}` already escapes; use raw output only for values that are already safe markup.
- Raw `{{ }}` printed on screen: the file is not compiled as Blade; the name must end in `.blade.php` and be resolved by the view finder.
- A template overrides another one unexpectedly: print the resolved path with `{{runner.wp}} eval 'echo view()->exists("name") ? view("name")->getPath() : "missing";'` (replace `name`).

## Class, namespace and autoload

- `Class "App\\X" not found` after adding a file: the namespace must map to the folder in that Acorn application's `composer.json` `autoload.psr-4`, and the class name must match the file name. Run `{{runner.composer}} dump-autoload` with the working directory of that application (theme, plugin or root).
- Works in CLI, fails in the browser (or the reverse): different PHP pools or users; compare `{{runner.wp}} eval 'echo PHP_VERSION;'` with the page's PHP version.

## Routes

- A route defined in the routes file returns the WordPress 404: Acorn checks its router while WordPress is parsing the request (it hooks `do_parse_request`) and lets unmatched requests fall through to WordPress, so a 404 means the route did not match. Check `route:list` (path, HTTP method, trailing slash, language prefix), the route cache (`route:clear`) and that the routes file is registered by the boot code. `rewrite flush` does not affect Acorn routes.
- A new custom post type or rewrite 404s: `{{runner.wp}} rewrite flush`.

## ACF (profiles with ACF only; `radicle-app` has none by default)

- Block or field group missing: class in the folder the provider scans, correct base class, non-empty block name, valid location rule. Then `{{runner.acorn}} acf:clear` and `{{runner.acorn}} acf:cache`, and `{{runner.cache}}`.
- "Block type already registered": two sources register the same name (class plus a JSON file, or a stale generated metadata file after a branch switch). Clear the ACF Composer cache and remove the duplicate.
- A select shows unexpected choices: another plugin or theme hooks `acf/load_field` for the same field name; rename the field.
- Values saved but not read: field key vs name confusion; check with `{{runner.wp}} eval 'var_dump(get_field("name", <post id>));'`.

## Livewire (profiles with Livewire only)

- Component does not mount: the layout must print the Livewire assets, and the component class must be discoverable under the configured namespace.
- Update request fails: 419 (token or page expired) usually means stale cached HTML or a changed key; 404 means the update route is not registered or a rewrite is intercepting it (`route:list`, `rewrite flush`); 500 means read the log.
- Errors only on cached pages: the cached HTML contains an older component snapshot than the deployed code. Compare headers before debugging the component.

## Assets

- 404 on built files: the manifest is missing or the URL base is wrong for this profile; see `tailwind-vite-assets`.
- Page requests files from a dev-server host: a stale `public/hot` (see `cache-layers.md`).
- Styles apply in the browser but not in the block editor: the editor stylesheet is a separate entry and must be enqueued for the editor.

## Redis and the object cache

- Confirm which backend is active: `{{runner.wp}} cache type`.
- Connection errors: the service name must be the host used in the environment (`WP_REDIS_HOST` or equivalent); check the service with the runner's service tooling (Lando: see `lando-wp`).
- A "disable" flag read as truthy: some plugins treat any non-empty string, including `"false"`, as true. Leave the variable empty to keep the cache on.
- Data wrong after a deploy or restart: the cache lives in Redis, not in the code; flush locally, ask the user for remote environments.

## Local works, remote is stale

1. `curl -sI <url>` and read the age and cache-status headers.
2. Compare the asset hash in the HTML with the manifest on the server.
3. If the HTML is old, the edge or page cache holds it; the fix is a purge by its owner.
4. If the HTML is new but behaviour old, suspect OPcache or the object cache.

## Tests fail but the site works

- Unit suites that do not boot WordPress fail on a missing WordPress function: add a guarded stub to the test bootstrap instead of loading WordPress. See `testing-wp`.
