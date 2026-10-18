# ACF Composer field groups, partials and options pages

Deep reference for ACF Composer field groups, partials and options pages. Loaded on demand from SKILL.md.

Covers `acf:field`, `acf:partial` and `acf:options` classes (ACF Composer 3.4.6, builder from `stoutlogic/acf-builder`). ACF hooks, validation and save flow live in the `acf-native` skill.

## Generators

```bash
{{runner.acorn}} acf:field CaseStudyFields      # app/Fields/CaseStudyFields.php
{{runner.acorn}} acf:partial Link               # app/Fields/Partials/Link.php
{{runner.acorn}} acf:options SiteSettings       # app/Options/SiteSettings.php (--full / --localize variants)
{{runner.acorn}} acf:stubs                      # publish the stubs to <base>/stubs/acf-composer/ to customise them
```

`Name/Sub` creates subfolders. After creating or editing: `{{runner.acorn}} acf:cache` (field groups are served from the manifest while it exists).

## Field group on a post type or taxonomy

```php
<?php

namespace App\Fields;   // or your project namespace

use Log1x\AcfComposer\Builder;
use Log1x\AcfComposer\Field;

class CaseStudyFields extends Field
{
    public function fields(): array
    {
        $fields = Builder::make('case_study_fields');

        $fields->setLocation('post_type', '==', 'case-study');

        $fields
            ->addText('customer', ['required' => true])
            ->addUrl('website');

        return $fields->build();
    }
}
```

### Trap: `setLocation()` returns a `LocationBuilder`

```php
// Wrong: $fields becomes the LocationBuilder; build() returns only location rules
$fields = Builder::make('x_fields')->setLocation('post_type', '==', 'x');

// Right
$fields = Builder::make('x_fields');
$fields->setLocation('post_type', '==', 'x')->or('post_type', '==', 'y');
```

Chaining `->and()` / `->or()` after `setLocation()` is fine as long as the result is not assigned back to `$fields`.

## Partials

A partial is a reusable set of fields. Return the builder from `fields()` and include it with `addPartial()`:

```php
class Link extends \Log1x\AcfComposer\Partial
{
    public function fields(): \Log1x\AcfComposer\Builder
    {
        $fields = \Log1x\AcfComposer\Builder::make('link');
        $fields->addLink('link');

        return $fields;
    }
}

// in a field group or block
$fields->addPartial(Link::class);
```

Look for existing partials (title, description, link, media) before writing one.

## Builder cheat sheet

```php
$fields->addText('name', ['label' => 'Label', 'required' => true]);
$fields->addTextarea('name', ['rows' => 3]);
$fields->addWysiwyg('name', ['media_upload' => 0, 'toolbar' => 'basic']);
$fields->addSelect('name', ['choices' => ['a' => 'A', 'b' => 'B']]);
$fields->addTrueFalse('name', ['ui' => 1]);
$fields->addImage('name', ['return_format' => 'array']);
$fields->addPostObject('name', ['post_type' => ['case-study']]);
$fields->addRelationship('name', ['post_type' => ['post']]);
$fields->addTaxonomy('name', ['taxonomy' => 'industry']);
$fields->addTab('Content');
$fields->addRepeater('items', ['min' => 1])
        ->addText('title')
    ->endRepeater();
$fields->addGroup('cta')
        ->addLink('link')
    ->endGroup();
$fields->addTrueFalse('has_cta')
    ->addLink('cta_link')
        ->conditional('has_cta', '==', '1');
```

`config/acf.php` → `defaults` merges per-type defaults into every field (for example `trueFalse` → `ui => 1`); read it before repeating options. `{{runner.acorn}} acf:usage <type>` prints the options a field type accepts.

## Keys vs names

Read values by **name** (`get_field('customer')`, or the project's wrapper). ACF Composer generates keys as `field_<group>_<field>`. Raw block markup written by scripts or migrations should carry keys too; confirm them before writing markup:

```bash
{{runner.wp}} eval 'print_r(array_column(acf_get_fields("group_case_study_fields") ?: [], "key", "name"));'
```

## Duplicate keys

Two classes producing the same group key throw `Duplicate ACF field group key [...]` on `acf/init`. Give each group a unique `Builder::make()` name.
