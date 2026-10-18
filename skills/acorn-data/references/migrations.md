# Migrations under Acorn

Deep reference for writing, running and deploying migrations. Loaded on demand from SKILL.md.

## Where they live

`database/migrations` under the Acorn base path (theme, mu-plugin or project root). `{{runner.acorn}} make:migration create_x_table` writes a timestamped file there.

## Writing

```php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('form_submissions', function (Blueprint $table) {   // unprefixed
            $table->id();
            $table->string('idempotency_key', 64)->unique();
            $table->string('form', 32)->index();
            $table->string('email');
            $table->json('payload');
            $table->string('status', 16)->default('pending')->index();
            $table->unsignedBigInteger('post_id')->nullable()->index();      // WordPress IDs are BIGINT UNSIGNED
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('form_submissions');
    }
};
```

- Unprefixed names in `Schema::create`, `Schema::table`, `hasTable` and foreign keys; `prefix_indexes` is on, so index names are prefixed too.
- No foreign key constraints to WordPress core tables: WordPress deletes rows without knowing about them. Index the column and clean up on the matching hook (`deleted_post`, `delete_user`).
- `json` needs MySQL 5.7.8+ or MariaDB 10.2.7+; check the production server.
- Changing an existing table: a new migration with `Schema::table(...)`; never edit a migration that already ran anywhere shared.
- Never alter WordPress core tables in a migration.

## Running

| Command | Use |
|---|---|
| `{{runner.acorn}} migrate` | run pending migrations (`--force` when `app.env` is `production`) |
| `{{runner.acorn}} migrate:status` | ran / pending list |
| `{{runner.acorn}} migrate:rollback --step=1` | undo the last batch (development) |
| `{{runner.acorn}} migrate:install` | create the `migrations` table if missing |
| `{{runner.acorn}} migrate:fresh`, `migrate:refresh`, `migrate:reset`, `db:wipe` | destructive; local throwaway databases only |

`app.env` comes from `WP_ENV`, defaulting to `production`. On projects that never define `WP_ENV`, every environment is `production` to Laravel, so `migrate` needs `--force` even locally.

Do not run migrations from a web request or a WordPress activation hook in production; they belong to the release.

## Deploying

The Roots guidance: after `{{runner.acorn}} optimize`, run `{{runner.acorn}} migrate --force`. Make it one step of the release:

1. New code and dependencies in place, caches rebuilt.
2. `{{runner.acorn}} migrate --force` from **one** place: a release job, an init container, or a deploy hook on one server. If every container runs it at start, two can race; Laravel takes no lock by default (`migrate --isolated` uses a cache lock and needs a shared cache store such as Redis).
3. Traffic switches to the new code.

Expand and contract: while the old and new release both run, the schema must work for both. Add columns as nullable first, backfill, then tighten in a later release. Rename by adding the new column and dropping the old one later.

## Queue and cache tables

The database queue and cache drivers need their tables, generated as migrations: `{{runner.acorn}} make:queue-table` (alias `queue:table`), `make:queue-failed-table`, `make:queue-batches-table`. See `acorn-background`.
