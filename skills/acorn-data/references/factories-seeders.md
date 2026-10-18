# Factories and seeders under Acorn

Deep reference for test and demo data. Loaded on demand from SKILL.md.

## Seeders

```bash
{{runner.acorn}} make:seeder FormSubmissionSeeder     # database/seeders/FormSubmissionSeeder.php
{{runner.acorn}} db:seed --class=FormSubmissionSeeder
{{runner.acorn}} db:seed                              # runs DatabaseSeeder
```

- Seeders run inside WordPress (Acorn boots for WP-CLI), so they can call `wp_insert_post()`, `wp_insert_term()` and `update_post_meta()`. Use those for WordPress content and Eloquent for custom tables.
- Make seeders idempotent (`updateOrCreate`, existence checks) so running them twice is safe.
- `db:seed` in production needs `--force`; seed production only with the user's agreement.
- Autoloading: seeders are namespaced `Database\Seeders`; the base path's `composer.json` must map `Database\\Seeders\\` to `database/seeders/` (and `Database\\Factories\\` to `database/factories/` for factories). Add the mapping and dump autoload if missing.

## Factories

Acorn 6.2 registers no `make:factory` command and does not require `fakerphp/faker`. To use factories:

1. `{{runner.composer}} require --dev fakerphp/faker` in the base path.
2. Write the class by hand in `database/factories`:

```php
namespace Database\Factories;

use App\Models\FormSubmission;   // your namespace
use Illuminate\Database\Eloquent\Factories\Factory;

class FormSubmissionFactory extends Factory
{
    protected $model = FormSubmission::class;

    public function definition(): array
    {
        return [
            'idempotency_key' => fake()->uuid(),
            'form' => 'signup',
            'email' => fake()->safeEmail(),
            'payload' => ['plan' => fake()->randomElement(['free', 'pro'])],
            'status' => 'pending',
        ];
    }

    public function sent(): static
    {
        return $this->state(fn () => ['status' => 'sent']);
    }
}
```

3. `use HasFactory;` on the model. Factory names resolve as `Database\Factories\` + the model path after `<AppNamespace>\Models\` + `Factory`. If your models live elsewhere, put `#[UseFactory(FormSubmissionFactory::class)]` (`Illuminate\Database\Eloquent\Attributes\UseFactory`) on the model, or override `protected static function newFactory()`.

Usage: `FormSubmission::factory()->count(10)->sent()->create();`

## Do not fake WordPress content with Eloquent factories

Posts created through a factory skip hooks, caches and term counts. For WordPress content in tests use the WordPress test factories (`WP_UnitTestCase` / `$this->factory()->post`) when the project runs the WordPress test suite, or `wp_insert_post()` in a seeder.

## Test databases

Run database tests against a dedicated database or a transaction-wrapped connection, never the shared development database. The project's test runner (`{{runner.test}}`) decides how; see `testing-wp`.
