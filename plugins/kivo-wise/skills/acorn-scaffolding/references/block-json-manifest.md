# block.json and the ACF Composer manifest

Deep reference for how ACF Composer 3.4.6 generates and uses `block.json`. Loaded on demand from SKILL.md.

## Do not hand-write block.json for ACF Composer blocks

The class is the source of truth. `{{runner.acorn}} acf:cache` (alias `acf:optimize`, also run by `{{runner.acorn}} optimize`) writes:

- `<storage>/framework/cache/acf-composer/manifest.php`: every field group array, keyed by class
- `<storage>/framework/cache/acf-composer/blocks/{slug}/block.json`: one per block (`name`, `title`, `category`, `icon`, `keywords`, normalised `styles`, camelCased `supports`, `example`, `usesContext`, `providesContext`, `apiVersion`, and an `acf` key with the render template and post types)

`acf:cache --manifest` writes only the manifest, without block JSON. `{{runner.acorn}} acf:clear` (also run by `optimize:clear`) deletes both.

## The trap

| While this exists | WordPress uses | So these edits are ignored |
|---|---|---|
| `blocks/{slug}/block.json` | `register_block_type($jsonPath)` | `$styles`, `$supports`, `$post_types`, `$parent`, `$ancestor`, `$example`, `$icon`, `$name`, `$category`, `$keywords` |
| `manifest.php` entry for the class | The cached field group | Anything in `fields()` |

`with()`, the Blade view and protected helper methods run at render time from the class, so they are never stale (compiled Blade aside).

After editing a block class, switching branches, or deploying: rebuild with `acf:cache` (or `optimize` / `{{runner.cache}}`). Inspect what WordPress actually registered:

```bash
{{runner.wp}} eval 'echo storage_path("framework/cache/acf-composer/blocks/pricing-teaser/block.json"), PHP_EOL;'
{{runner.wp}} eval 'print_r(WP_Block_Type_Registry::get_instance()->get_registered("acf/pricing-teaser")->styles);'
```

## Changing registration arguments

Prefer class properties. When a property is not enough, use a filter and write down why:

| Filter | Fires on | Source |
|---|---|---|
| `register_block_type_args` | Every registration path (JSON and array) | `wp-includes/class-wp-block-type.php` |
| `block_type_metadata` / `block_type_metadata_settings` | Only the `block.json` path (`register_block_type_from_metadata()`) | `wp-includes/blocks.php` |
| `acf/register_block_type_args` | Only ACF Composer's array path (no JSON cached) | `log1x/acf-composer` `src/Block.php` |

Since production normally runs with the manifest built, `register_block_type_args` is the one that always applies. Register it in a provider `boot()`.

## Upstream ideas that do not apply

| Idea | Reality in ACF Composer 3.4.6 |
|---|---|
| Put `block.json` next to the class and it is picked up | Only the generated file under the manifest folder is read |
| `$styles` must be `['name' => …]` arrays, plain strings are ignored | Plain strings are normalised to `name`/`label`/`isDefault` |
| `config/acf.php` `manifest` moves the cache | The manifest path comes from `storage_path('framework/cache')`; the class reads a different config key |

## Native blocks are different

Native blocks (see `native-blocks.md`) may ship a real `block.json` in the source tree and register it with `register_block_type(__DIR__ . '/…')`. There the file is hand-written and is the source of truth.
