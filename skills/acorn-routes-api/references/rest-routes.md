# WordPress REST routes from an Acorn provider

Deep reference for registering `register_rest_route()` endpoints from a service provider, the pattern Radicle uses for its API and the right choice for editor-facing endpoints. Loaded on demand from SKILL.md. For the full REST API (schemas, controllers extending `WP_REST_Controller`, discovery, batch) see the `wp-rest-api` skill.

## Registration from a provider

```php
namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

class ApiServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        add_action('rest_api_init', function (): void {
            register_rest_route('acme/v1', '/quotes', [
                'methods' => 'POST',
                'callback' => [$this, 'storeQuote'],
                'permission_callback' => fn () => current_user_can('edit_posts'),
                'args' => [
                    'title' => [
                        'type' => 'string',
                        'required' => true,
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                    'amount' => [
                        'type' => 'number',
                        'minimum' => 0,
                    ],
                ],
            ]);
        });
    }

    public function storeQuote(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $id = wp_insert_post([
            'post_type' => 'quote',
            'post_title' => $request->get_param('title'),
            'post_status' => 'draft',
        ], true);

        if (is_wp_error($id)) {
            return $id;   // WP_Error data may carry ['status' => 500]
        }

        return new WP_REST_Response(['id' => $id], 201);
    }
}
```

Register the provider where the profile expects it: `withProviders()` in the theme or plugin boot, or `composer.json` `extra.acorn.providers` on Radicle.

Resolve services inside the callback (`app(QuoteService::class)`) rather than at registration time, so nothing heavy runs on every request.

## Rules

- `register_rest_route()` must run on `rest_api_init`; earlier calls trigger `_doing_it_wrong`.
- `permission_callback` is required since WordPress 5.5. Public reads use `'__return_true'`, with a comment explaining why.
- Namespace with a vendor and version (`acme/v1`). Breaking changes go to `v2`.
- An arg with a `type` and no `sanitize_callback` defaults to `rest_parse_request_arg`, which validates against the schema and sanitizes before the callback (`class-wp-rest-request.php`). Invalid input returns 400 `rest_invalid_param`.
- Return `WP_REST_Response` or `WP_Error`; arrays are wrapped automatically.

## Authentication

| Client | Mechanism |
|---|---|
| Logged-in browser (theme JS, block editor) | Auth cookie plus `X-WP-Nonce: wp_create_nonce('wp_rest')`. Without the nonce, `rest_cookie_check_errors` sets the current user to 0. `@wordpress/api-fetch` sends it when configured with `apiFetch.createNonceMiddleware`; the editor does it for you. |
| Server or script | Application passwords over HTTPS (Basic auth), validated by `wp_validate_application_password` on `determine_current_user`. |
| Anonymous public read | `permission_callback => '__return_true'`; add rate limiting at the edge or in the callback. |

## Caching and performance

- REST responses are not page-cached by WordPress. Cache expensive reads with the object cache or Laravel cache and invalidate on the content hooks that change them.
- Send `Cache-Control` deliberately with `$response->header('Cache-Control', 'public, max-age=60')` only for anonymous, non-personalised data.

## Testing

`rest_do_request(new WP_REST_Request('POST', '/acme/v1/quotes'))` inside `{{runner.wp}} eval` exercises the route without HTTP; for unit tests keep the callback logic in a service that can be tested without WordPress.
