# Pest with WordPress booted (Radicle layout)

Deep reference for integration tests on `radicle-app`. Loaded on demand from `SKILL.md`. Describes the pattern in general terms; follow the project's own `tests/Pest.php`.

## What the setup does

The Radicle layout ships Pest. The test bootstrap (`tests/Pest.php`) loads the environment file with Dotenv, marks the environment as testing, requires WordPress's config and settings so the whole CMS is loaded in the test process, then boots Acorn the same way the project's boot mu-plugin does (an `Application::configure()` call followed by `boot()`). Tests then run with hooks, the container, the view system and the database all live.

Run with `{{runner.test}}`, which resolves to the project's Pest binary or script (`composer test` in the project scripts is the equivalent; both go through the runner).

## Consequences

| Fact | What it means for you |
|---|---|
| WordPress is loaded in the same process | You can call `get_option`, `wp_insert_post`, `do_action` directly and assert on results |
| The database is whatever the environment file points to | On a development machine that is your development database. Do not truncate, reset or seed globally |
| Boot cost is paid once per run | Keep tests grouped; avoid per-test boots |
| Global state persists across tests | Reset options, transients and hooks you touch; remove posts and terms you create |
| Environment variable `testing` is set early | Use it to switch the bootstrap to safer settings (mail transport, external HTTP) |

## Writing tests

- Prefer Pest's `it('does something', function () { ... })` with small arrange-act-assert bodies.
- Create data in the test (`wp_insert_post`, factories if the project defines them) and delete it in `afterEach` or at the end. Assert on your own records, not on counts of everything.
- External HTTP: block or fake it. WordPress has `pre_http_request` for short-circuiting `wp_remote_*`; Laravel's HTTP client has `Http::fake()`.
- Mail, queues and cache: fake them (`Mail::fake()`, `Queue::fake()`) or use array drivers set in the testing environment.
- Rendering: render a Blade view with `view('name', $data)->render()` and assert on the string; no browser needed.
- Smoke test: a request to the home URL that expects a 200 is a useful first test; make it respect the TLS settings of the environment.

## Safety checklist before running a new integration test

1. Which database is configured? Print the name from the environment (not the credentials).
2. Does the test create anything outside its own records? If yes, stop and redesign.
3. Does it call an external service? If yes, fake it.
4. Is it safe to run twice in a row? It must be.

## Static analysis and formatting

The layout uses Mago for formatting and linting (scripts named `format`, `format:fix`, `lint` in `composer.json`) and Pint where Laravel conventions apply. Run the project's own scripts through `{{runner.composer}} run <script>` before reporting done. This skill does not replace them.
