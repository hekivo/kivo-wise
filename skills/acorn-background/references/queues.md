# Laravel queues under Acorn

Deep reference for configuring connections, writing jobs and running workers. Loaded on demand from SKILL.md.

## Connections

Acorn's `config/queue.php` defaults: `default` = `QUEUE_CONNECTION` or `sync`; connections `sync`, `database` (table `jobs`), `beanstalkd`, `sqs`, `redis` (connection `default`, queue `default`, `retry_after` 90); failed jobs with driver `database-uuids`, table `failed_jobs`, on the `wordpress` connection; batches in `job_batches`.

A project `config/queue.php` overrides keys; its `connections` array merges with Acorn's.

| Driver | Needs | Notes |
|---|---|---|
| `sync` | nothing | runs inline; fine for tests and local debugging only |
| `database` | `jobs` and `failed_jobs` tables | `{{runner.acorn}} make:queue-table`, `make:queue-failed-table`, `migrate` |
| `redis` | `illuminate/redis`, the `redis` extension or `predis/predis`, a Redis database not flushed by WordPress | see `redis-cache.md` |

## Jobs

```bash
{{runner.acorn}} make:job SyncLead     # app/Jobs/SyncLead.php in the base path
```

```php
namespace App\Jobs;   // your namespace

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SyncLead implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 5;
    public array $backoff = [30, 120, 600];
    public int $timeout = 60;

    public function __construct(public readonly int $leadId) {}

    public function handle(LeadClient $client): void
    {
        $lead = Lead::find($this->leadId);
        if (! $lead || $lead->synced_at) {
            return;                                   // idempotent exit
        }

        $client->push($lead);
        $lead->forceFill(['synced_at' => now()])->save();
    }

    public function failed(\Throwable $e): void
    {
        Log::error('Lead sync failed', ['lead_id' => $this->leadId, 'error' => $e->getMessage()]);
    }
}
```

- Pass IDs and scalars; re-read state in `handle()`.
- `handle()` dependencies are injected from the container.
- WordPress functions work in jobs (the worker runs inside WP-CLI with WordPress loaded). There is no request user: call `wp_set_current_user($userId)` when capability checks or authored content are involved.
- `ShouldBeUnique` with `uniqueId()` prevents duplicates; it needs a lock-capable cache store shared by every dispatcher.
- Never put secrets or full personal data in the payload; store a reference.

## Dispatching

```php
SyncLead::dispatch($leadId);
SyncLead::dispatch($leadId)->delay(now()->addMinutes(5))->onQueue('crm');

add_action('acme/lead_created', fn (int $leadId) => SyncLead::dispatch($leadId));
```

Dispatch after the data is committed. Inside a transaction use `->afterCommit()`.

## Workers

```bash
{{runner.acorn}} queue:work --queue=crm,default --tries=3 --max-time=3600 --max-jobs=500
{{runner.acorn}} queue:work --once                 # one job, for debugging
{{runner.acorn}} queue:failed                      # list failures
{{runner.acorn}} queue:retry all                   # or an ID
{{runner.acorn}} queue:restart                     # after each deploy
```

- The worker is one long-lived WP-CLI process: WordPress globals, the in-memory object cache and static state persist across jobs. Bound its life with `--max-jobs` / `--max-time` and avoid relying on globals.
- Production: one supervised process per queue (supervisor, systemd, a container with restart policy). Scale by adding processes, not by raising `--sleep` tricks.
- `queue:restart` writes a timestamp to the cache; the worker and the deploy step must share the cache store (Redis or database), or workers never see it.
- Memory: `--memory=256` makes the worker exit and be restarted when it grows.

## Testing

- `Bus::fake()` / `Queue::fake()` in unit tests to assert dispatches.
- Call `(new SyncLead(42))->handle($fakeClient)` directly to test the job logic.
- `QUEUE_CONNECTION=sync` in the test environment runs jobs inline when an integration test needs the side effect.
