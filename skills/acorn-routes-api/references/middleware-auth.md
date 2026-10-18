# Middleware and authentication for Acorn routes

Deep reference for middleware registration, the default groups, and auth patterns that fit WordPress. Loaded on demand from SKILL.md.

## What Acorn configures by default

| Layer | Contents (Acorn 6.2 `Roots\Acorn\Configuration\Middleware`) |
|---|---|
| Global | `TrustProxies`, `HandleCors`, `ValidatePostSize`, `ConvertEmptyStringsToNull` (`TrustHosts` only when enabled) |
| `web` | `AddQueuedCookiesToResponse`, `StartSession` (Acorn's subclass), `ShareErrorsFromSession`, `SubstituteBindings`. `EncryptCookies` and `PreventRequestForgery` are commented out |
| `api` | `SubstituteBindings`; `throttle:<limiter>` only after `throttleApi()`; Sanctum's stateful middleware only after `statefulApi()` |
| `wordpress` | same list as `web` |
| Aliases | `auth.session`, `cache.headers`, `precognitive`, `signed`, `throttle` (Redis variant when enabled). No `auth`, `auth.basic`, `can`, `guest`, `password.confirm`, `verified` |

So: no CSRF protection, no Laravel guard-based auth, out of the box. Middleware only runs for Acorn routes (and, with `wordpress: true`, the catch-all). It never runs for `/wp-json`, wp-admin or the login page.

## Registering middleware

There is no `app/Http/Kernel.php` to edit by default. Configure through the builder:

```php
use Illuminate\Foundation\Configuration\Middleware;

Application::configure()
    ->withProviders([/* ... */])
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'capability' => \App\Http\Middleware\RequireCapability::class,
        ]);
        $middleware->web(append: [\App\Http\Middleware\AddSecurityHeaders::class]);
        $middleware->validateCsrfTokens(except: ['hooks/*']);   // opt-in CSRF; see below
    })
    ->withRouting(web: base_path('routes/web.php'))
    ->boot();
```

Or apply classes directly on routes: `->middleware(RequireCapability::class.':edit_posts')`.

A full custom kernel (extend `Roots\Acorn\Http\Kernel`, rebind `Illuminate\Contracts\Http\Kernel` before `boot()`) is possible but rarely needed; the Roots docs describe it.

## Pattern: WordPress capability check

```php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireCapability
{
    public function handle(Request $request, Closure $next, string $capability = 'manage_options'): Response
    {
        if (! is_user_logged_in()) {
            return response()->json(['message' => 'Authentication required'], 401);
        }

        if (! current_user_can($capability)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return $next($request);
    }
}
```

The current user resolves lazily from the WordPress auth cookie (`determine_current_user` filter), so this works on Acorn routes without calling `wp_set_current_user()`.

## Pattern: CSRF for cookie-authenticated writes

Cookie auth without a token means any site can make the user's browser POST to your route. Choose one:

- **WordPress nonce** (works with the REST-style front end): print `wp_create_nonce('my_action')` into the page, send it as a header, check `wp_verify_nonce($request->header('X-My-Nonce'), 'my_action')` in middleware, 403 on failure.
- **Laravel CSRF**: enable it with `$middleware->validateCsrfTokens()` (or add `ValidateCsrfToken` to the `web` group), render `@csrf` / the `XSRF-TOKEN` cookie. Note this also applies to Livewire's update route, which sits in the `web` group.

Cached pages embed whatever token was rendered for the first visitor; for cached pages fetch the token after load or use a non-cookie scheme.

## Pattern: server-to-server (webhooks, integrations)

- Shared secret header or HMAC signature, compared with `hash_equals()`. Reject before parsing the body.
- Read secrets from `config()` (a `config/services.php` entry fed by the environment), not `env()` in classes: `env()` returns null once config is cached.
- Exempt the path from CSRF if you enabled it.
- Rate limit: `->middleware('throttle:30,1')`. `throttle` uses the default cache store; with the file store, limits are per server, so use Redis when there is more than one instance (`acorn-background`).

## Pattern: bearer tokens (JWT)

Only when a non-browser client needs tokens and application passwords on REST do not fit:

1. `{{runner.composer}} require firebase/php-jwt` in the base path.
2. A service that issues (`JWT::encode`) and verifies (`JWT::decode($token, new Key($secret, 'HS256'))`) tokens; secret and TTL from `config()`.
3. Middleware reads `$request->bearerToken()`, decodes, rejects with 401 on any exception, then `wp_set_current_user($payload->sub)` so capability checks work downstream.
4. Short access-token TTL, a separate refresh flow, strict `throttle` on the login route.

Ask the user before introducing token auth: application passwords on a REST route are the native alternative (`wp-includes/user.php`, `wp_validate_application_password` on `determine_current_user`).

## CORS

`HandleCors` is global and reads `config/cors.php` (Acorn ships a default; publish the configs with `{{runner.acorn}} vendor:publish --tag=acorn-configs` to edit). Set `paths` to your API prefix, list explicit `allowed_origins`, and answer `OPTIONS` preflights.

## Ordering

Authentication before authorization before business middleware. Return JSON errors with the right status (401 unauthenticated, 403 unauthorized, 419 only for CSRF, 422 validation, 429 throttled).
