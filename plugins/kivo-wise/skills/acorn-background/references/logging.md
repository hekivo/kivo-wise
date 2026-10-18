# Logging under Acorn

Deep reference for Laravel log channels, file locations per profile and container logging. Loaded on demand from SKILL.md.

## Defaults (Acorn 6.2 `config/logging.php`)

- `default` = `LOG_CHANNEL` or `stack`.
- `stack` → channels from `LOG_STACK` (default `single`).
- `single` and `daily` write `storage_path('logs/laravel.log')`; `daily` keeps `LOG_DAILY_DAYS` (14).
- Also defined: `stderr` (Monolog `StreamHandler` on `php://stderr`), `syslog`, `errorlog`, `slack`, `papertrail`, `null`, `emergency`.
- Level from `LOG_LEVEL` (default `debug`).

Storage path per profile: the base path's `storage/` when it exists (theme, mu-plugin or project root), otherwise Acorn's zero-config fallback `wp-content/cache/acorn/` (it creates `logs/` there). So the file is `…/storage/logs/laravel.log` or `wp-content/cache/acorn/logs/laravel.log`.

The WordPress `debug.log` (`WP_DEBUG_LOG`) is separate and keeps PHP notices and `error_log()` output.

## Writing logs

```php
use Illuminate\Support\Facades\Log;

Log::info('Lead synced', ['lead_id' => $id, 'crm_id' => $crmId]);
Log::warning('CRM rate limit close', ['remaining' => $remaining]);
Log::channel('integrations')->error('CRM push failed', ['lead_id' => $id, 'status' => $status]);
```

- Message is a constant string; variables go in the context array (searchable, no interpolation).
- No secrets, tokens or full personal data. Log IDs and hashes.
- `logger('message', [...])` is the helper form; it works in Blade too.

## Adding a channel

A project `config/logging.php` only needs what it adds or changes; its `channels` array merges with Acorn's defaults.

```php
return [
    'channels' => [
        'integrations' => [
            'driver' => 'daily',
            'path' => storage_path('logs/integrations.log'),
            'level' => env('LOG_LEVEL', 'info'),
            'days' => 14,
        ],
    ],
];
```

Publish Acorn's full config only if you want to edit everything: `{{runner.acorn}} vendor:publish --tag=acorn-configs` (publishes all Acorn config files; keep only the ones you change).

## Containers and hosted platforms

- Set `LOG_CHANNEL=stderr`, or `LOG_STACK=single,stderr` to keep both. The platform's log collector then picks up Laravel logs with the PHP-FPM output.
- `LOG_STDERR_FORMATTER=Monolog\Formatter\JsonFormatter` for structured logs.
- Locally on Lando, stderr output shows in the app server's logs (`lando logs -s <web service>`; see `lando-wp`).

## Exceptions

Report extra context or route exceptions through `->withExceptions(function ($exceptions) { $exceptions->report(fn (\Throwable $e) => …); })` on the builder. Acorn's error page shows only when `app.debug` is true (`WP_DEBUG` and `WP_DEBUG_DISPLAY` both on); otherwise errors go to the log.

## Troubleshooting

| Symptom | Check |
|---|---|
| No `laravel.log` anywhere | `LOG_CHANNEL` may be `stderr` or `errorlog`; storage not writable; look in `wp-content/cache/acorn/logs/` |
| Logs only in one container | file channel on a multi-instance deploy; switch to `stderr` |
| `Log [x] is not defined` | channel name missing from `config/logging.php` |
| Huge log file | `single` never rotates; use `daily` or ship to stderr |
