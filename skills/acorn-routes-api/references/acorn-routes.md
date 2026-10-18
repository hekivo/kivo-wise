# Acorn routes, controllers and caching

Deep reference for Laravel routing inside Acorn: route files, controllers, binding, groups and the route cache. Loaded on demand from SKILL.md.

## How a request reaches an Acorn route

1. Acorn boots when the boot call runs (when the theme's `functions.php` loads on `sage-theme`; inside an `after_setup_theme` callback in the mu-plugin and Radicle boot files) and, for HTTP requests, captures the request and matches it against the router.
2. Paths under wp-admin, the login and registration pages, the REST prefix (`/wp-json`) and any path ending in `.php` are skipped: WordPress handles them.
3. A matched route (other than the `wordpress` catch-all) is dispatched on `parse_request`; Acorn sends the response and exits. `muplugins_loaded`, `plugins_loaded`, `after_setup_theme` and `init` have run; the main query, `template_redirect`, `wp_head`, `wp_footer` and SEO plugin output have not.
4. With `withRouting(wordpress: true)`, unmatched front-end requests match the `wordpress` catch-all, run the `wordpress` middleware group (a copy of `web`), and WordPress renders the page as usual.

Filter `acorn/router/do_parse_request` exists for projects that need to let WordPress parse the request anyway.

## Route files

```php
// routes/web.php (web group: queued cookies, session, shared errors, bindings)
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\QuoteController;

Route::view('/tools/welcome', 'tools.welcome')->name('tools.welcome');

Route::prefix('tools')->name('tools.')->group(function () {
    Route::get('/quote', [QuoteController::class, 'show'])->name('quote.show');
    Route::post('/quote', [QuoteController::class, 'store'])->name('quote.store');
});
```

```php
// routes/api.php (api group: SubstituteBindings, plus throttle when throttleApi() is on; no session)
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\LeadController;

Route::apiResource('leads', LeadController::class)->only(['index', 'store']);
```

`api` routes are prefixed with `apiPrefix` (default `api`). Projects often set a vendor-specific prefix such as `my-plugin/api/v1` so routes cannot collide with content.

Rules:

- Name every route (`->name()`) and build URLs with `route()`; never hard-code paths in Blade or JS.
- Prefix routes with a segment that cannot be a page slug.
- Closures are allowed and can be cached (Laravel serializes them), but controllers keep route files short and testable.

## Controllers

```bash
{{runner.acorn}} make:controller QuoteController
{{runner.acorn}} make:controller Api/LeadController --api      # index, store, show, update, destroy
{{runner.acorn}} make:controller ExportController --invokable
```

Generated under `app/Http/Controllers` in the base path, with the app's namespace.

```php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LeadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeadController extends Controller
{
    public function __construct(private LeadService $leads) {}

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'company' => ['nullable', 'string', 'max:120'],
        ]);

        return response()->json($this->leads->create($data), 201);
    }
}
```

- Constructor and method injection resolve from the Acorn container.
- `$request->validate()` throws `ValidationException`: JSON requests get 422 with `errors`; non-JSON requests are redirected back with errors in the session (needs the `web` group).
- WordPress functions are available (`get_posts`, `wp_insert_post`, `current_user_can`). Writes to WordPress content go through WordPress APIs so hooks fire.

## Route model binding

Implicit binding works for Eloquent models (`Route::get('/leads/{lead}', …)` with `Lead $lead`) because both groups include `SubstituteBindings`. Use `{lead:uuid}` for another column. For WordPress objects, bind explicitly in a provider:

```php
Route::bind('wpPost', fn (string $value) => get_post((int) $value) ?? abort(404));
```

## Responses

- JSON: `response()->json($data, $status)`. Include a stable error shape.
- Blade: `view('tools.quote', [...])` or `Route::view()`. The layout must call `wp_head()` / `wp_footer()` itself if the page needs WordPress assets; for virtual pages set `<title>` (`pre_get_document_title`), canonical and robots meta yourself.
- Redirects: `redirect()->route('tools.quote.show')`.
- Cache headers: the `cache.headers` alias (`SetCacheHeaders`) is available, for example `->middleware('cache.headers:public;max_age=300;etag')`.

## Route cache

- `{{runner.acorn}} route:cache` writes the cache under the app's bootstrap cache path; `route:clear` removes it; `optimize` and `optimize:clear` include them.
- With a cache present, edits to route files have no effect until it is cleared. Development: never cache routes. Deploy: cache after the code is in place, before traffic.
- Routes registered conditionally on WordPress state (options, active plugins) are frozen at cache time. Register such routes unconditionally and check the condition in middleware.

## Health route

`withRouting(health: '/up')` adds Laravel's health route. Useful for container probes; it does not prove WordPress renders, only that Acorn answers.

## Testing

- Middleware and controllers are plain classes: unit-test them with a constructed `Illuminate\Http\Request`.
- For HTTP-level checks, `curl` the local site through the runner's URL, or the project's end-to-end suite.
