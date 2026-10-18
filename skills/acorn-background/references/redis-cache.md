# Redis and caching under Acorn

Deep reference for Laravel's Redis connections, the Laravel cache, and how both coexist with the WordPress object cache. Loaded on demand from SKILL.md.

## Two cache layers, one Redis server

| Layer | API | Backed by | Flushed by |
|---|---|---|---|
| WordPress object cache | `wp_cache_*`, transients (stored there when a persistent drop-in exists), core query caches | `wp-content/object-cache.php` drop-in (for example Redis Object Cache) | `{{runner.wp}} cache flush`, plugin admin button, many deploy scripts |
| Laravel cache | `Cache::`, `cache()`, rate limiter, locks, `queue:restart` signal | the store in `config/cache.php` (`file` by default under `storage/framework/cache/data`) | `{{runner.acorn}} cache:clear` |

They do not see each other's keys. Clearing one never clears the other.

## Installing Redis for Acorn

1. `{{runner.composer}} require illuminate/redis` in the Acorn base path. Acorn does not require it; `Illuminate\Redis\RedisServiceProvider` is in the default provider list but is skipped while the class does not exist. The Roots Redis guide also registers the provider explicitly; do that if your project's `config/app.php` defines its own `providers` list.
2. The PHP `redis` extension (client `phpredis`, Acorn's default `REDIS_CLIENT`), or `{{runner.composer}} require predis/predis` with `REDIS_CLIENT=predis`.
3. Connection settings from the environment: `REDIS_HOST` (inside Lando, the Redis service name from `.lando.yml`, not `127.0.0.1`), `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_CACHE_DB`, `REDIS_PREFIX`.

## Pick databases that WordPress does not flush

| Consumer | Default database | Source |
|---|---|---|
| Redis Object Cache drop-in | 0 (`WP_REDIS_DATABASE`) | plugin `object-cache.php` |
| Acorn `redis.default` (queues, sessions, locks by default) | 0 (`REDIS_DB`) | Acorn `config/database.php` |
| Acorn `redis.cache` (cache store) | 1 (`REDIS_CACHE_DB`) | Acorn `config/database.php` |

The drop-in's `flush()` runs `FLUSHDB` on its database unless `WP_REDIS_SELECTIVE_FLUSH` is on with a `WP_REDIS_PREFIX`. With defaults, every `{{runner.wp}} cache flush` deletes Laravel's queued jobs, sessions and locks. Fix by moving Laravel off database 0:

```dotenv
REDIS_DB=2
REDIS_CACHE_DB=3
```

or by enabling selective flush with a prefix on the WordPress side. Change shared environments only with the user's agreement.

Some platforms inject `REDIS_PORT` as a URL-like value (container service links, for example `tcp://10.0.0.5:6379`); phpredis then fails to connect. If that happens, read the port from a differently named variable in the project's `config/database.php`.

## Using the Laravel cache

```php
use Illuminate\Support\Facades\Cache;

$plans = Cache::remember('pricing:plans:v2', now()->addMinutes(30), fn () => $client->plans());

Cache::forget('pricing:plans:v2');

Cache::lock('import:leads', 300)->get(function () {
    // only one process at a time
});
```

- Use the `redis` store (`CACHE_STORE=redis`) when there is more than one web instance or a worker; `file` is per server.
- Tags (`Cache::tags([...])`) work on Redis and memcached stores, not on `file` or `database`.
- Invalidate on the WordPress hook that changes the source (`save_post_{type}`, `edited_term`, `updated_option`).
- Cache plain arrays and scalars; never `WP_Query` objects, closures or connections.

## Laravel cache or transients?

| Situation | Choose |
|---|---|
| Plugins or core must read the value, or the site has no Redis | transients / `wp_cache_*` |
| You need locks, atomic counters, tags, or a store that survives `{{runner.wp}} cache flush` | Laravel cache on its own Redis database |
| Values shared with queue workers or the scheduler | Laravel cache (same store everywhere) |

## Direct Redis

`Redis::connection()->…` (or `app('redis')`) for pipelines, Lua or pub/sub. Prefer the cache API for get/set.

## Inspecting

- Ping from PHP: `{{runner.wp}} eval 'var_dump(app("redis")->connection()->ping());'`.
- From the CLI, use the project's Redis tooling if `.lando.yml` defines one (check that its `service` exists), for example `<redis tooling> -n 2 INFO keyspace`. Never run `KEYS *` or `FLUSHALL` against a shared server.
