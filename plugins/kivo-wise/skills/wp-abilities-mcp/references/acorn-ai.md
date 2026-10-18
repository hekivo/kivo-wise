# roots/acorn-ai abilities

Deep reference for writing abilities with roots/acorn-ai and for registering them without it. Loaded on demand from SKILL.md.

Checked against `roots/acorn-ai` 0.1.2 (requires PHP 8.4+, WordPress 6.9+, `laravel/ai`). Re-read `vendor/roots/acorn-ai/src/` in the installed version before relying on a detail.

## Install and publish

```
{{runner.composer}} require roots/acorn-ai          # in the composer.json that owns Acorn (see the SKILL profile table)
{{runner.acorn}} vendor:publish --provider="Roots\AcornAi\AcornAiServiceProvider" --tag=ai-wordpress-config
{{runner.acorn}} vendor:publish --provider="Laravel\Ai\AiServiceProvider" --tag=ai-config   # only if you call LLM providers
```

- `config/ai-wordpress.php` holds `abilities` (class list). `config/ai.php` (from `laravel/ai`) holds provider keys read from the environment; the provider copies configured keys into `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY` env vars when they are not already set.
- Keys live in the environment (`.env` ignored by git or the host's secret store). Do not write a key into a file for the user; show the variable name to set.
- `AcornAiServiceProvider` is listed in the package's `extra.acorn.providers`, so Acorn package discovery loads it. If discovery is disabled for it, add it to the provider list yourself.

## Class shape

```php
<?php

namespace App\Ai\Abilities;

use App\Projects\ProjectQuery;
use Roots\AcornAi\Abilities\Ability;

final class ListProjectsAbility extends Ability
{
    public function __construct(private ProjectQuery $projects) {}   // container injection

    public function name(): string { return 'my-site/list-projects'; }  // default would be "app/list-projects"
    public function label(): string { return __('List projects', 'my-site'); }
    public function description(): string
    {
        return 'Lists published projects with id, title and URL. Use it to find a project before reading or editing it.';
    }
    public function category(): ?string { return 'my-site'; }             // REQUIRED in practice, see traps

    public function permission(): bool|\WP_Error { return current_user_can('read'); }

    public function inputSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'per_page' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 50, 'default' => 10],
            ],
            'additionalProperties' => false,
        ];
    }

    public function outputSchema(): array
    {
        return ['type' => 'array', 'items' => ['type' => 'object']];
    }

    public function meta(): array
    {
        return [
            'annotations'  => ['readonly' => true, 'destructive' => false, 'idempotent' => true],
            'show_in_rest' => true,
            'mcp'          => ['public' => true],
        ];
    }

    public function execute(array $input): mixed
    {
        return $this->projects->published((int) ($input['per_page'] ?? 10)); // plain arrays, not WP_Post objects
    }
}
```

Generate the skeleton with `{{runner.acorn}} make:ability ListProjects` (namespace `<root>\Ai\Abilities`, class suffix `Ability`), then list it:

```php
// config/ai-wordpress.php
'abilities' => [
    \App\Ai\Abilities\ListProjectsAbility::class,
],
```

Register the category from a provider:

```php
// In a provider boot()
add_action('wp_abilities_api_categories_init', fn () => wp_register_ability_category('my-site', [
    'label' => __('My site', 'my-site'),
    'description' => __('Abilities provided by this site.', 'my-site'),
]));
```

## Traps

| Trap | Detail | Fix |
|---|---|---|
| `category()` defaults to `null` | The provider drops `null` args, and core refuses an ability without a registered category | Override `category()`; register the category on `wp_abilities_api_categories_init` |
| No `inputSchema()` | Core passes `$input` to the callback only when the input schema is non-empty; the provider's wrapper is `fn (array $input)`, so the call throws and comes back as `ability_callback_exception` | Return an object schema, even with empty `properties` |
| Default `name()` | Built from the first namespace segment, lowercased, plus the kebab class name (`App\…\CreatePostAbility` → `app/create-post`) | Override with a project prefix that will not collide |
| Default `permission()` | `is_user_logged_in()`: any subscriber can run it | Use the specific capability |
| Returning objects | `WP_Post`, models or resources do not serialise cleanly for clients | Map to arrays; describe them in `outputSchema()` |
| `ability:list` errors | Some versions read `WP_Ability` public properties instead of `get_name()` / `get_label()` / `get_category()` | Use `{{runner.wp}} eval` over `wp_get_abilities()`, or update/patch the package |

## Registering without acorn-ai

```php
// In a provider boot()
public function boot(): void
{
    add_action('wp_abilities_api_categories_init', fn () => wp_register_ability_category('my-site', [
        'label' => 'My site',
        'description' => 'Abilities provided by this site.',
    ]));

    add_action('wp_abilities_api_init', function (): void {
        wp_register_ability('my-site/list-projects', [
            'label'               => __('List projects', 'my-site'),
            'description'         => 'Lists published projects with id, title and URL.',
            'category'            => 'my-site',
            'input_schema'        => ['type' => 'object', 'properties' => [], 'additionalProperties' => false],
            'output_schema'       => ['type' => 'array'],
            'execute_callback'    => fn (array $input = []) => app(\App\Projects\ProjectQuery::class)->published(),
            'permission_callback' => fn () => current_user_can('read'),
            'meta'                => [
                'annotations'  => ['readonly' => true],
                'show_in_rest' => true,
                'mcp'          => ['public' => true],
            ],
        ]);
    });
}
```

## Useful core hooks (WordPress 7.1)

| Hook | Use |
|---|---|
| `wp_register_ability_args` (filter) | adjust another plugin's ability args at registration |
| `wp_unregister_ability()` on `wp_abilities_api_init` priority > 10 | remove an ability another plugin registered (for example ACF's write abilities) |
| `wp_pre_execute_ability` (filter, 7.1) | short-circuit: cache, rate limit, maintenance |
| `wp_ability_validate_input` (filter, 7.1) | extra validation beyond JSON Schema |
| `wp_ability_invoked` (action, 7.1) | audit logging of every call |
