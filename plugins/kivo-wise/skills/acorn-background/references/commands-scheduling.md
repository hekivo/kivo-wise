# Console commands and scheduling under Acorn

Deep reference for Acorn commands (run through WP-CLI as `acorn <name>`) and the Laravel scheduler. Loaded on demand from SKILL.md.

## Acorn command or WP-CLI command?

| Use | Pick |
|---|---|
| Only WordPress APIs, should appear under `wp <name>` | native `WP_CLI::add_command()` (registered on `cli_init` or when `WP_CLI` is defined) |
| Needs container services, Eloquent, Laravel console output, or the scheduler | Acorn command |

## Creating

```bash
{{runner.acorn}} make:command ImportLeads    # app/Console/Commands/ImportLeads.php
```

```php
namespace App\Console\Commands;   // your namespace

use Illuminate\Console\Command;

class ImportLeads extends Command
{
    protected $signature = 'leads:import
        {source : csv or api}
        {--limit=100 : Max records}
        {--dry-run : Report without writing}';

    protected $description = 'Import leads from a CSV file or the CRM API';

    public function handle(LeadImporter $importer): int
    {
        $result = $importer->run($this->argument('source'), (int) $this->option('limit'), (bool) $this->option('dry-run'));

        $this->components->info("Imported {$result->created}, skipped {$result->skipped}");

        return self::SUCCESS;
    }
}
```

Run with `{{runner.acorn}} leads:import csv --limit=10 --dry-run`; help with `{{runner.acorn}} help leads:import`.

## Registration

- Classes under `app/Console/Commands` of the base path are loaded automatically (the console kernel loads `app_path('Console/Commands')`). The class namespace must match the base path's `composer.json` PSR-4 mapping for `app/`.
- Closure commands in `routes/console.php` at the base path (`Artisan::command('leads:count', fn () => …)`).
- Other locations: `->withCommands([ImportLeads::class, base_path('src/Commands')])` on the builder, or `$this->commands([...])` in a provider's `boot()`.
- Options pass through WP-CLI: `{{runner.acorn}} leads:import csv --no-interaction` reaches the command as `--no-interaction`.

## Output and interaction

`$this->components->info|warn|error()`, `$this->table($headers, $rows)`, `$this->withProgressBar($items, fn ($i) => …)`, `$this->confirm()` (skip prompts in automation with `--no-interaction`). Return `self::SUCCESS` / `self::FAILURE`; WP-CLI exits with that status.

## Scheduling

Define tasks in `routes/console.php`:

```php
use Illuminate\Support\Facades\Schedule;

Schedule::command('leads:import api --limit=500')->hourly()->withoutOverlapping();
Schedule::command('queue:prune-failed --hours=168')->daily();
Schedule::job(new \App\Jobs\RebuildSitemap)->dailyAt('03:00')->onOneServer();
```

Or on the builder: `->withSchedule(function (\Illuminate\Console\Scheduling\Schedule $schedule) { … })`.

Run the scheduler every minute:

- System cron on the server: `* * * * * cd <wordpress root> && <wp-cli binary> acorn schedule:run >> /dev/null 2>&1`. Locally the equivalent is `{{runner.acorn}} schedule:run`.
- Or a long-running process: `{{runner.acorn}} schedule:work`.

Inspect with `{{runner.acorn}} schedule:list`, run one with `{{runner.acorn}} schedule:test`.

- `withoutOverlapping()` and `onOneServer()` use cache locks; with several servers the cache store must be shared (Redis or database). `schedule:clear-cache` removes stale mutexes.
- Heavy tasks should dispatch a job instead of doing the work inside `schedule:run`.
- Timezone: tasks use `app.timezone` (Acorn default `UTC`) unless `->timezone()` is set; WordPress's own timezone setting is separate.

## Testing commands

Keep logic in a service and unit-test the service. For the command itself, `$this->artisan('leads:import csv')->assertExitCode(0)` works when the project's test case boots Acorn; otherwise run it through `{{runner.acorn}}` against a test database.
