---
type: llm
weight: 3
focus: last_message
---
The agent had read-only tools only, so proposing a command or a diff counts the same as running it.

Judge the substance, not the wording. A bullet that begins "if" is satisfied when its condition does not apply to the project. PASS if the response satisfies at least all but one of the bullets and does not contradict any of them. FAIL if two or more bullets are missing, or if any bullet is contradicted (for example the response does the opposite of what it asks).

- compares WP-Cron, Action Scheduler and the Laravel queue and justifies the queue (retries, backoff, volume) before writing code
- notes QUEUE_CONNECTION defaults to sync and that a supervised worker (lando wp acorn queue:work) plus queue:restart on deploy is required
- requires illuminate/redis in the plugin's base path (Acorn does not ship it) and the redis extension or predis
- warns that the Redis object cache drop-in uses database 0 and wp cache flush runs FLUSHDB, and moves Laravel to separate REDIS_DB / REDIS_CACHE_DB values
- writes an idempotent job that receives IDs, sets tries/backoff/timeout and calls wp_set_current_user when needed
- treats adding a worker process or changing shared Redis databases as infrastructure to ask about
- never suggests running wp, composer or php outside the runner placeholders
