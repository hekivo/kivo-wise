# Eloquent models under Acorn

Deep reference for models over custom tables and WordPress tables, relationships, scopes and casts. Loaded on demand from SKILL.md.

## The prefix rule

The default `wordpress` connection carries `'prefix' => $wpdb->prefix`. Write every table name **without** the prefix: `'posts'`, `'postmeta'`, `'form_submissions'`. A model with `$table = 'wp_posts'` queries `wp_wp_posts`.

On multisite, `$wpdb->prefix` at boot is the current site's prefix (`wp_2_`), so per-site tables follow the site; global tables (`users`, `usermeta`) are then wrong unless you point those models at a connection with the base prefix. Ask before building multisite-aware models.

## Custom table model

```php
namespace App\Models;   // your namespace

use Illuminate\Database\Eloquent\Model;

class FormSubmission extends Model
{
    protected $table = 'form_submissions';   // optional when it equals the plural snake case

    protected $fillable = ['form', 'email', 'payload', 'status', 'sent_at'];

    protected $casts = [
        'payload' => 'array',
        'sent_at' => 'datetime',
    ];
}
```

- Keep `$fillable` explicit; never `$guarded = []` on data that comes from requests.
- `created_at` / `updated_at` exist only if the migration called `$table->timestamps()`.
- Dates are stored as written; WordPress stores local time in `post_date` and UTC in `post_date_gmt`. Pick one and say which.

## WordPress table models

| Table (unprefixed) | Primary key | Timestamps |
|---|---|---|
| `posts` | `ID` | none (`post_date`, `post_modified` are plain columns) |
| `postmeta` | `meta_id` | none |
| `users` | `ID` | none (`user_registered`) |
| `usermeta` | `umeta_id` | none |
| `terms` | `term_id` | none |
| `term_taxonomy` | `term_taxonomy_id` | none |
| `term_relationships` | composite (`object_id`, `term_taxonomy_id`) | none |
| `termmeta` | `meta_id` | none |
| `options` | `option_id` | none |
| `comments` | `comment_ID` | none |

```php
namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Post extends Model
{
    protected $table = 'posts';
    protected $primaryKey = 'ID';
    public $timestamps = false;

    protected $casts = [
        'post_date' => 'datetime',
        'post_modified' => 'datetime',
    ];

    public function meta(): HasMany
    {
        return $this->hasMany(PostMeta::class, 'post_id', 'ID');
    }

    public function scopePublished(Builder $query): void
    {
        $query->where('post_status', 'publish');
    }

    public function scopeOfType(Builder $query, string $type): void
    {
        $query->where('post_type', $type);
    }
}
```

Read-only by convention: create and update WordPress content through `wp_insert_post()`, `wp_update_post()`, `update_post_meta()`, `wp_set_object_terms()` so hooks, revisions and object-cache invalidation happen. If a model must never write, override `save()` / `delete()` to throw, or keep `$fillable` empty.

Meta values are strings (serialized for arrays). Use `maybe_unserialize()` in an accessor instead of a JSON cast.

## Relationships worth knowing

```php
// posts -> postmeta
$this->hasMany(PostMeta::class, 'post_id', 'ID');

// posts -> author
$this->belongsTo(User::class, 'post_author', 'ID');

// posts <-> terms through term_relationships and term_taxonomy
$this->belongsToMany(TermTaxonomy::class, 'term_relationships', 'object_id', 'term_taxonomy_id', 'ID', 'term_taxonomy_id');

// custom table -> post
$this->belongsTo(Post::class, 'post_id', 'ID');
```

Eager load (`Post::with('meta')->…`) to avoid N+1 queries; filter meta inside the eager load (`with(['meta' => fn ($q) => $q->whereIn('meta_key', [...])])`).

## Scopes

- Local scopes as above; chain them (`Post::ofType('quote')->published()->latest('post_date')->paginate(20)`).
- Global scopes in `booted()` (`static::addGlobalScope('type', fn ($q) => $q->where('post_type', 'quote'))`) for a model bound to one post type; remove with `withoutGlobalScope('type')`.
- Conditional filters with `->when($term, fn ($q) => $q->where(...))`.
- Raw SQL only with bindings (`whereRaw('meta_value > ?', [$min])`).

## Query builder without a model

`DB::table('form_submissions')->where('status', 'pending')->limit(50)->get()` uses the same connection and prefix. `DB::enableQueryLog()` / `DB::getQueryLog()` while debugging; remove before committing.

## Eloquent and caches

Eloquent talks to MySQL directly: no WordPress object cache, no `posts_*` filters, no multilingual or permission plugins filtering the query. When those matter (front-end listings that must respect visibility, translations or search plugins), prefer `WP_Query`.
