# Choosing a background mechanism

Deep reference for WP-Cron, Action Scheduler, the Laravel queue and the Laravel scheduler in an Acorn project. Loaded on demand from SKILL.md.

## The four options

| | WP-Cron | Action Scheduler | Laravel queue | Laravel scheduler |
|---|---|---|---|---|
| Ships with | WordPress core (`wp-includes/cron.php`) | WooCommerce, or the standalone `woocommerce/action-scheduler` package/plugin | Acorn (`illuminate/queue`) | Acorn (`illuminate/console` scheduling) |
| Storage | `cron` option (one autoloaded array) | its own tables | `jobs` table, Redis, SQS, … | none; tasks defined in code |
| Trigger | page loads (spawned on `shutdown` since WordPress 6.9), or system cron with `DISABLE_WP_CRON` | WP-Cron, plus async requests | a worker process (`queue:work`) | system cron running `schedule:run` each minute |
| Retries / backoff | none | failed actions recorded; retry by hand | `$tries`, `$backoff`, `failed()` | per task (`->onFailure()`); overlap control |
| Visibility | `{{runner.wp}} cron event list` | Tools → Scheduled Actions, WP-CLI `action-scheduler` commands | `queue:failed`, `queue:monitor`, logs | `schedule:list` |
| Good for | a few recurring hooks | many small deferred actions on hosts without workers | heavy, retryable, high-volume work | recurring Laravel commands |

## Rules of thumb

1. If WordPress core or an installed plugin already schedules the work, hook into it; do not duplicate.
2. No worker process possible (shared hosting): WP-Cron for a few recurring hooks, Action Scheduler when already installed and volume grows. Do not add WooCommerce for it.
3. A worker is possible and you need retries, backoff, timeouts, uniqueness or batches: Laravel queue.
4. Recurring Laravel commands: the Laravel scheduler, with one system cron entry. Keep WP-Cron for WordPress hooks.
5. Always: idempotent handlers, IDs not objects, explicit time limits, logs with context.

## WP-Cron essentials

```php
add_action('acme_nightly_cleanup', [CleanupService::class, 'run']);   // register the handler on every request (provider boot)

if (! wp_next_scheduled('acme_nightly_cleanup')) {                    // schedule once (activation, or guarded at init)
    wp_schedule_event(time(), 'daily', 'acme_nightly_cleanup');
}
```

- Handlers must be registered on every request, not only when scheduling.
- Low-traffic sites run events late. Production: `define('DISABLE_WP_CRON', true)` in the environment config and a system cron calling `{{runner.wp}} cron event run --due-now` every few minutes.
- Unschedule on deactivation (`wp_clear_scheduled_hook`).

## Action Scheduler essentials

Verify the API in the installed copy (`action-scheduler/functions.php`) before relying on a signature.

```php
as_enqueue_async_action('acme/sync_lead', ['lead_id' => 42], 'acme');
as_schedule_single_action(time() + 600, 'acme/sync_lead', ['lead_id' => 42], 'acme');

if (! as_has_scheduled_action('acme/cleanup', [], 'acme')) {
    as_schedule_recurring_action(time(), HOUR_IN_SECONDS, 'acme/cleanup', [], 'acme');
}

add_action('acme/sync_lead', fn (int $leadId) => app(LeadSync::class)->run($leadId));
```

Guard recurring schedules with `as_has_scheduled_action()`; duplicates stack silently.

## Bridging: process the Laravel queue without a daemon

If the queue is needed but no worker can run, a WP-Cron or Action Scheduler callback can drain it in short bursts:

```php
add_action('acme_drain_queue', function (): void {
    \Illuminate\Support\Facades\Artisan::call('queue:work', [
        '--stop-when-empty' => true,
        '--max-time' => 50,
        '--tries' => 3,
    ]);
});
```

It inherits WP-Cron's lateness and the PHP time limit of the request that triggered it. Treat it as a stopgap and say so.
