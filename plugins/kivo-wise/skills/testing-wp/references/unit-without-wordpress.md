# Unit tests without booting WordPress

Deep reference for the mu-plugin-style unit suite. Loaded on demand from `SKILL.md`.

## Shape of the suite

- Config: `phpunit.xml.dist` in the Acorn base path with one test suite pointing at `tests/` (files named `*Test.php`) and `bootstrap="tests/bootstrap.php"`.
- Namespace: the test namespace mirrors `app/` (`Vendor\Tests\Blocks\ProfileCardsTest` tests `Vendor\Blocks\ProfileCards`).
- No WordPress, no Acorn boot. Fast, deterministic, runnable anywhere the PHP dependencies are installed.

## Bootstrap order (this matters)

1. Define constants the code reads at include time (plugin path, version).
2. Set environment values the code needs (a test signing key, for example).
3. Declare stubs for WordPress and framework helper functions, each guarded:

   ```php
   if (!function_exists('__')) {
       function __($text, $domain = '') { return $text; }
   }
   ```

   These go **before** the autoloader. Laravel's helper files define `__()`, `app()`, `response()` and others when they are autoloaded; if your guarded stub does not exist yet, the framework version wins and behaves differently (it needs a booted application).
4. `require_once <base path>/vendor/autoload.php`.
5. Optional shims: a bare container instance (`Container::setInstance(new Container())`) and, for model scopes, an in-memory SQLite connection through Eloquent's capsule so queries build without a real server.
6. Shared stub classes (`WP_Post`, `WP_Term`, `WP_Error`) with typed properties, so PHP 8.2+ does not complain about dynamic properties.

## Which stubs to write

Only what the code under test calls. Typical set: translation functions, `apply_filters` (returns its input), `get_option`/`update_option` (array-backed), `get_post_meta`, transients (array-backed), `sanitize_text_field`, `esc_html`, `wp_json_encode`, `is_admin`. Make stateful stubs read from a static array the test can reset in `setUp()`.

If you need more than a dozen stubs for one class, the class is doing too much WordPress work: extract the pure logic into a method or class and test that.

## Patterns

- **Pure helpers through reflection.** Blocks and providers often have constructors that need the framework. Build the object without the constructor and call the protected helper:

  ```php
  $subject = (new \ReflectionClass(ProfileCards::class))->newInstanceWithoutConstructor();
  $method = new \ReflectionMethod(ProfileCards::class, 'normalizeProfiles');
  $method->setAccessible(true);
  self::assertSame([], $method->invoke($subject, null));
  ```

- **Guard tests over templates.** A test can scan `resources/views` for a forbidden pattern (for example raw output of a function that already escapes) and fail the build. Cheap and effective for conventions.
- **Controllers and middleware.** Build a Laravel `Request`, call the method, assert on the `Response`. No HTTP server needed.
- **Data providers** for validation rules and normalisers.

## What not to unit test here

Hook timing, template resolution, rewrite rules, anything reading real posts or options through WordPress. Test those at the integration or browser level, or with a WP-CLI `eval` smoke script.

## Running

- Whole suite: `{{runner.test}}`.
- One class: `{{runner.test}} --filter ProfileCardsTest`.
- One method: `{{runner.test}} --filter 'testNormalizeProfiles'`.
- If the runner script hard-codes the configuration path, pass the config explicitly when you run PHPUnit by hand, for example `--configuration <base path>/phpunit.xml.dist`.
