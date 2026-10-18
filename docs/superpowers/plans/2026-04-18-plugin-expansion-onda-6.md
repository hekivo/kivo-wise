> Historical document from superpowers-sage 2.x. It describes features that were removed or replaced in kivo-wise 3.0 and is kept for reference only.

# Onda 6 — Hardening from field feedback

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the plugin based on real-world usage feedback across two groups: (A) block-refactoring and acorn-migration hardening; (B) sage-reviewer new checks and gotchas corpus expansion.

**Architecture:** Five microplans targeting four existing files and adding two new reference files. No new skills or agents — all changes are improvements to existing ones. Changes are independent and can be executed in any order within each group, but 6.2 should follow 6.1 (both touch block-refactoring SKILL.md).

**Tech Stack:** Markdown (skill/agent format), PHP code patterns for migration templates, bash for validation commands.

**Source:** Real-world usage feedback from `interioresdecora.com.br` project, three feedback files dated 2026-04-18 and 2026-04-19.

---

## Task 6.1 — `block-refactoring` Phase 0b: shared component inventory

**Files:**
- Modify: `skills/block-refactoring/SKILL.md` — insert Phase 0b between Phase 0 and Phase 1

**Context:** When the block-refactoring skill generates recommendations to use shared components (G9), it currently does not know which components actually exist in the project. Adding a component inventory step before analysis allows G9 to surface concrete, actionable matches rather than generic suggestions.

- [ ] **Step 1: Write the failing test (validate-skills check)**

Run to confirm current line count:
```bash
node scripts/validate-skills.mjs --skill block-refactoring
```
Expected: passes (SKILL.md is within 500L). Note the current line count.

- [ ] **Step 2: Read SKILL.md to find the insertion point**

In `skills/block-refactoring/SKILL.md`, Phase 0 ends with:
```
Read all present files.
```
Phase 1 begins immediately after with:
```
### Phase 1 — Classify current pattern version
```

- [ ] **Step 3: Insert Phase 0b between Phase 0 and Phase 1**

Add the following section between "Read all present files." and "### Phase 1":

```markdown
### Phase 0b — Shared component inventory

Glob `resources/views/components/*.blade.php` in the target project (if a path is known, otherwise skip this step).

Build a component inventory table:

| Component slug | File | Likely use |
|---|---|---|
| `section-header` | `section-header.blade.php` | `<x-eyebrow>` + `<h2>` pairing |
| `button` | `button.blade.php` | `<a>` or `<button>` with utility classes |
| `card` | `card.blade.php` | Repeated card structure |

Keep this table in context — G9 in Axis 4 will reference it to report concrete component names instead of generic suggestions.

If `resources/views/components/` does not exist or is empty, note "No shared components found" and proceed.
```

- [ ] **Step 4: Verify line count stays ≤ 500**

```bash
(Get-Content skills/block-refactoring/SKILL.md).Count
```
Expected: ≤ 500. If over limit, shorten Phase 0b to a single-sentence pointer and move the table pattern to `references/evolution-axes.md`.

- [ ] **Step 5: Update G9 text to reference Phase 0b inventory**

In G9 section, replace:
```
Each instance where a shared component exists but is not used: flag as IMPROVEMENT.
```
With:
```
Each instance where a component from the Phase 0b inventory exists but is not used: flag as IMPROVEMENT, naming the component (e.g., "use `<x-section-header>` instead of inline `<x-eyebrow>` + `<h2>`").
```

- [ ] **Step 6: Run validate-skills to confirm it still passes**

```bash
node scripts/validate-skills.mjs --skill block-refactoring
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add skills/block-refactoring/SKILL.md
git commit -m "feat(block-refactoring): add Phase 0b shared component inventory before gap checks"
```

---

## Task 6.2 — `block-refactoring` G7 → CRITICAL + Decision Log + localization reference

**Files:**
- Modify: `skills/block-refactoring/SKILL.md` — promote G7 to CRITICAL
- Modify: `skills/block-refactoring/references/report-format.md` — add Decision Log section
- Create: `skills/block-refactoring/references/localization.md` — localization cycle reference

**Context:** Feedback revealed hardcoded strings surviving multiple review passes because G7 was phrased as a soft "proposal". Promoting it to CRITICAL ensures it is treated with the same urgency as arbitrary values. The Decision Log addresses the problem of deferred changes being silently dropped between sessions.

- [ ] **Step 1: Write the failing test**

```bash
grep -n "propose wrapping" skills/block-refactoring/SKILL.md
```
Expected: finds the current soft phrasing in G7. This is what we're fixing.

- [ ] **Step 2: Promote G7 to CRITICAL**

In `skills/block-refactoring/SKILL.md`, find G7:
```markdown
#### G7. Missing `--localize` strings

Look for static user-facing strings in the view not wrapped in `__()` / `esc_html__()`.
If they exist, propose wrapping them.
```

Replace with:
```markdown
#### G7. Missing localization — CRITICAL

Grep the view for any user-facing string literals not wrapped in a localization function:

```bash
grep -n '"[A-Z][a-z]\|"[A-Z][A-Z]' resources/views/blocks/{slug}.blade.php
```

Also check for Portuguese/Spanish strings (mixed-language G8 overlap):
```bash
grep -n '"[A-Z][a-zãáâàéêíóôõúçñ]' resources/views/blocks/{slug}.blade.php
```

Every unlocalized string is **CRITICAL** — same severity as arbitrary Tailwind values.

**Fix:** Replace bare strings with localization calls:
```blade
{{-- Before --}}
<span>Saiba mais</span>

{{-- After --}}
<span>{{ esc_html__('Saiba mais', 'sage') }}</span>
```

If the project uses a non-`sage` text domain, check `functions.php` or `ThemeServiceProvider::boot()` for the registered domain. See `references/localization.md` for the full localization cycle.
```

- [ ] **Step 3: Create `skills/block-refactoring/references/localization.md`**

Create the file with this content:

```markdown
Deep reference for block localization. Loaded on demand from `skills/block-refactoring/SKILL.md`.

# Block Localization

Full cycle for making block strings translatable in a Sage/Acorn theme.

## Text Domain Registration

In `ThemeServiceProvider::boot()` — use `load_textdomain()` directly, NOT `load_theme_textdomain()`:

```php
public function boot(): void
{
    parent::boot();

    // load_theme_textdomain() returns true but silently fails in Acorn WP 6.9 boot context.
    // Use load_textdomain() with explicit path instead.
    load_textdomain(
        'sage',
        get_template_directory() . '/resources/lang/' . get_locale() . '.mo'
    );
}
```

## PHP Localization Functions

| Context | Function | Example |
|---|---|---|
| Plain string | `__('text', 'sage')` | `$label = __('Read more', 'sage')` |
| Escaped for HTML output | `esc_html__('text', 'sage')` | `echo esc_html__('Title', 'sage')` |
| With substitutions | `sprintf(__('Hello %s', 'sage'), $name)` | inline |
| In Blade (echo) | `{{ esc_html__('text', 'sage') }}` | `<span>{{ esc_html__('View', 'sage') }}</span>` |

Always use `esc_html__()` for string literals directly echoed into HTML attributes or text nodes. Use `__()` only when the string will be further processed (e.g., passed to a function that escapes it).

## Blade Shorthand

In Blade views, localize strings via the echo shorthand:

```blade
{{-- ✅ Correct --}}
<span>{{ esc_html__('Learn more', 'sage') }}</span>
<button aria-label="{{ esc_attr__('Close menu', 'sage') }}">...</button>

{{-- ❌ Wrong — bare string --}}
<span>Learn more</span>
```

## Generating the POT File

Run once to create or update the translation catalog:

```bash
lando wp i18n make-pot . resources/lang/sage.pot --domain=sage --exclude=vendor,node_modules
```

This scans all PHP and Blade files for `__()`, `esc_html__()`, and similar calls and produces a `.pot` template file translators can use with Poedit or Loco Translate.

## wp_localize_script (for JS)

To pass PHP strings to JavaScript:

```php
// In ThemeServiceProvider::boot()
add_action('wp_enqueue_scripts', function () {
    wp_localize_script('theme', 'themeStrings', [
        'readMore'  => esc_html__('Read more', 'sage'),
        'closeMenu' => esc_html__('Close menu', 'sage'),
    ]);
}, 20);
```

In JS: `window.themeStrings.readMore`.

Alternatively, use `wp_set_script_translations()` with a JSON file if the project uses the WP Scripts package (Gutenberg toolchain).

## Common Mistakes

| Mistake | Fix |
|---|---|
| `load_theme_textdomain()` silently fails in Acorn boot context | Use `load_textdomain($domain, $path, $locale)` directly |
| POT file not regenerated after adding strings | Run `wp i18n make-pot` before submitting to translation |
| Using `__()` directly in HTML output | Use `esc_html__()` to prevent XSS |
| Text domain mismatch | Check domain in `load_textdomain()` matches `__()` calls — typos produce silent failures |
```

- [ ] **Step 4: Add Decision Log to `references/report-format.md`**

In `skills/block-refactoring/references/report-format.md`, after the `### Suggested action` line inside the report template, add:

```markdown
### Decision Log

| Proposal | Status | Reason if deferred |
|---|---|---|
| {proposal from Phase 6} | Applied / Deferred | {reason} |
```

Also update "Apply gap fixes (G1–G11 as approved)" in the Phase 7 section — already done in the earlier G9/G10/G11 update.

- [ ] **Step 5: Verify line counts**

```bash
(Get-Content skills/block-refactoring/SKILL.md).Count
(Get-Content skills/block-refactoring/references/localization.md).Count
```
Expected: SKILL.md ≤ 500, localization.md no hard limit.

- [ ] **Step 6: Run validate-skills**

```bash
node scripts/validate-skills.mjs --skill block-refactoring
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add skills/block-refactoring/SKILL.md skills/block-refactoring/references/
git commit -m "feat(block-refactoring): G7 → CRITICAL, add Decision Log to report, add localization reference"
```

---

## Task 6.3 — `acorn-migration` — two-level key migration + second pass + WP-CLI positional args

**Files:**
- Modify: `agents/acorn-migration.md` — add Phase 4 for ACF data migration scripts

**Context:** When migrating ACF field group names (e.g. renaming the group from `hero` to `hero_section`), the migration must update three things: (1) the field meta keys themselves (e.g. `hero_title` → `hero_section_title`), (2) the row-level repeater keys (e.g. `hero_0_item` → `hero_section_0_item`), and (3) the `_field` reference meta values that store the field key string (`field_hero_title` → `field_hero_section_title`). Missing any of these causes ACF to silently return empty values. Also: `wp eval-file script.php --dry-run` fails because `--dry-run` is an unknown parameter to `wp eval-file` — use positional args instead.

- [ ] **Step 1: Write a failing test (manual)**

Check the current agent for ACF migration guidance:
```bash
grep -n "two-level\|repeater.*key\|_field.*reference\|positional\|dry.run\|str_contains" agents/acorn-migration.md
```
Expected: no matches — this is what we're adding.

- [ ] **Step 2: Add Phase 4 — ACF data migration scripts**

In `agents/acorn-migration.md`, after the Phase 3 section, add:

```markdown
### Phase 4 — ACF Field Data Migration Scripts

When renaming an ACF field group (e.g., from `hero` to `hero_section`), ACF stores data in three layers of `wp_postmeta`. All three must be updated or `get_field()` silently returns empty values.

#### The three layers

| Layer | Meta key pattern | Example |
|---|---|---|
| Field-level | `{group_prefix}_{field_name}` | `hero_title` → `hero_section_title` |
| Row-level (repeater) | `{group_prefix}_{N}_{field_name}` | `hero_0_item` → `hero_section_0_item` |
| `_field` references | Value: `field_{group_prefix}_{field_name}` | `field_hero_title` → `field_hero_section_title` |

Layer 1 and 2 are handled by a single regex-style rename of meta keys starting with `{old_prefix}_`. Layer 3 requires a separate pass that rewrites meta **values** matching `field_{old_prefix}_*`.

#### Migration script template

Generate this script as `scripts/migrate-acf-{old}-to-{new}.php`:

```php
<?php
/**
 * ACF field group rename migration.
 * Usage: wp eval-file scripts/migrate-acf-hero-to-hero-section.php dry-run
 * Usage: wp eval-file scripts/migrate-acf-hero-to-hero-section.php
 *
 * Note: wp eval-file does NOT support --flag syntax. Pass arguments positionally.
 * $args is available in eval-file context — it contains positional args as an array.
 */

// Idempotency: check if $args is set (wp eval-file provides it)
$dry_run = isset($args) && in_array('dry-run', (array) $args, true);

$old_prefix = 'hero';
$new_prefix = 'hero_section';

global $wpdb;
$changed = 0;

echo "ACF migration: {$old_prefix} → {$new_prefix}" . ($dry_run ? " [DRY RUN]" : "") . "\n\n";

// PASS 1 — rename field meta keys (field-level AND row-level repeater keys)
// Covers: hero_title, hero_0_item, hero_1_item, etc.
$rows = $wpdb->get_results(
    $wpdb->prepare(
        "SELECT meta_id, meta_key, post_id FROM {$wpdb->postmeta}
         WHERE meta_key LIKE %s AND meta_key NOT LIKE %s",
        $old_prefix . '_%',
        '\_%'       // exclude _field reference keys (handled in pass 2)
    ),
    ARRAY_A
);

foreach ($rows as $row) {
    // Idempotency guard — skip if already migrated
    if (!str_contains($row['meta_key'], $old_prefix . '_')) {
        continue;
    }
    $new_key = preg_replace(
        '/^' . preg_quote($old_prefix, '/') . '_/',
        $new_prefix . '_',
        $row['meta_key']
    );
    if (!$dry_run) {
        $wpdb->update(
            $wpdb->postmeta,
            ['meta_key' => $new_key],
            ['meta_id'  => $row['meta_id']],
            ['%s'],
            ['%d']
        );
    }
    echo "[post {$row['post_id']}] KEY  {$row['meta_key']} → {$new_key}\n";
    $changed++;
}

// PASS 2 — rename _field reference values
// These are meta_value entries that store the ACF field key string.
$ref_rows = $wpdb->get_results(
    $wpdb->prepare(
        "SELECT meta_id, meta_value, post_id FROM {$wpdb->postmeta}
         WHERE meta_value LIKE %s",
        'field_' . $old_prefix . '_%'
    ),
    ARRAY_A
);

foreach ($ref_rows as $row) {
    $new_val = str_replace(
        'field_' . $old_prefix . '_',
        'field_' . $new_prefix . '_',
        $row['meta_value']
    );
    if (!$dry_run) {
        $wpdb->update(
            $wpdb->postmeta,
            ['meta_value' => $new_val],
            ['meta_id'    => $row['meta_id']],
            ['%s'],
            ['%d']
        );
    }
    echo "[post {$row['post_id']}] REF  {$row['meta_value']} → {$new_val}\n";
    $changed++;
}

echo "\nTotal: {$changed} change(s)" . ($dry_run ? " (dry run — nothing written)" : " applied") . "\n";
```

#### How to run

```bash
# Dry run first — always
lando wp eval-file scripts/migrate-acf-hero-to-hero-section.php dry-run

# Review output, then apply
lando wp eval-file scripts/migrate-acf-hero-to-hero-section.php
```

**Important:** `wp eval-file` does NOT accept `--flag` style arguments. Use positional arguments and read them from `$args` inside the script.

#### Checklist before running

- [ ] Take a database snapshot: `lando wp db export backup-$(date +%Y%m%d).sql`
- [ ] Run dry-run and review all printed changes
- [ ] Verify the new field group name exists in the ACF PHP registration (`config/poet.php` or the Block class)
- [ ] After apply: clear WP object cache (`lando wp cache flush`) and verify `get_field()` returns expected values
```

- [ ] **Step 3: Verify the agent file is well-formed**

```bash
head -10 agents/acorn-migration.md
grep -c "###" agents/acorn-migration.md
```
Expected: YAML frontmatter intact, Phase headings count is now one more than before.

- [ ] **Step 4: Commit**

```bash
git add agents/acorn-migration.md
git commit -m "feat(acorn-migration): add Phase 4 — ACF two-level key migration + second pass + positional args"
```

---

## Task 6.4 — `sage-reviewer` — R-css-vars / R-component-reuse / R-nl2br

**Files:**
- Modify: `agents/sage-reviewer.md` — add three checks to the Convention Checklist

**Context:** The `sage-reviewer` agent currently audits service providers, ACF patterns, Blade templates, and frontend conventions, but misses three block-specific code smells identified in field feedback: conditional color logic in views (should be CSS vars), inline Blade code where shared components exist, and `nl2br()` misuse on single-line text fields.

- [ ] **Step 1: Write the failing test**

```bash
grep -n "css-var\|component-reuse\|nl2br\|R-css\|R-comp\|R-nl" agents/sage-reviewer.md
```
Expected: no matches — these checks don't exist yet.

- [ ] **Step 2: Add R-css-vars check to the Frontend section**

In `agents/sage-reviewer.md`, after the "ZERO arbitrary values" check in the Frontend section, add:

```markdown
- **R-css-vars — CSS variable cascade:** Grep for `match($tone)` returning Tailwind color classes, or hardcoded color utilities (`text-gray-*`, `bg-brand-*`, `text-white`) directly on `<h2>`, `<p>`, `<span>` elements. Colors must come from `--block-*` CSS custom properties, not from conditional PHP logic or hardcoded utilities in the view. Each match is **Critical**. Grep: `match\(\$` and `class=".*text-(gray|brand|white)` in `resources/views/blocks/`.
```

- [ ] **Step 3: Add Block UI Patterns section with R-component-reuse and R-nl2br**

After the Content Architecture section, add:

```markdown
### Block UI Patterns

- **R-component-reuse — Inline vs shared component:** Grep for `<x-eyebrow` and `<h2` appearing in the same block view without `<x-section-header>`. Also grep for `<a` elements carrying button utilities (`btn-`, `rounded-`, `px-[0-9]`, `py-[0-9]`, `font-`) without `<x-button>`. Each instance where a shared component exists but is not used: **Improvement**. Reference: `block-refactoring` G9.

- **R-nl2br — nl2br on single-line field:** Grep for `nl2br(esc_html(` in block views. For each match, trace the variable back to its ACF field definition (`app/Blocks/*.php`). If the field uses `addText()` (single-line input), `nl2br()` is a no-op and misleading — remove it or change the field to `addTextarea()`. Flag as **Improvement**.
```

- [ ] **Step 4: Verify the agent file is well-formed**

```bash
head -10 agents/sage-reviewer.md
wc -l agents/sage-reviewer.md
```
Expected: YAML frontmatter intact.

- [ ] **Step 5: Commit**

```bash
git add agents/sage-reviewer.md
git commit -m "feat(sage-reviewer): add R-css-vars, R-component-reuse, R-nl2br convention checks"
```

---

## Task 6.5 — Gotchas corpus: `load_textdomain` + `getName`/`getDescription`/`getStyles` i18n

**Files:**
- Modify: `skills/sage-lando/references/service-providers.md` — add `load_textdomain` gotcha
- Modify: `skills/sage-lando/references/acf-composer.md` — add `getName`/`getDescription`/`getStyles` override gotcha

**Context:** `load_theme_textdomain()` silently fails in Acorn's `boot()` context in WP 6.9 (returns `true` but does not register the domain). This caused translation-silent failures that were only caught after `.pot` file generation produced an empty catalog. The ACF Composer `getName()`/`getDescription()`/`getStyles()` override pattern is needed for i18n in block metadata but is not documented anywhere in the plugin.

- [ ] **Step 1: Write the failing tests**

```bash
grep -n "load_theme_textdomain\|getName\|getDescription\|getStyles" \
  skills/sage-lando/references/service-providers.md \
  skills/sage-lando/references/acf-composer.md
```
Expected: no matches for load_theme_textdomain; no matches for getName/getDescription in the Gotchas section.

- [ ] **Step 2: Add `load_textdomain` gotcha to `service-providers.md`**

At the end of `skills/sage-lando/references/service-providers.md`, append:

```markdown
## Gotcha — `load_theme_textdomain()` Silently Fails in Acorn boot()

In WP 6.9+, calling `load_theme_textdomain()` inside `ThemeServiceProvider::boot()` returns `true` but does **not** actually register the text domain. Strings remain untranslated with no warning or error.

**Symptom:** `__('text', 'sage')` returns the original string unchanged even though `.mo` files exist.

**Root cause:** `load_theme_textdomain()` internally calls `get_template_directory()` which in Acorn's boot context resolves before WordPress's theme setup is complete.

**Fix:** Use `load_textdomain()` with an explicit path:

```php
public function boot(): void
{
    parent::boot();

    load_textdomain(
        'sage',
        get_template_directory() . '/resources/lang/' . get_locale() . '.mo'
    );
}
```

**Sanity check:**
```bash
lando wp eval "echo load_textdomain('sage', get_template_directory() . '/resources/lang/pt_BR.mo') ? 'OK' : 'FAIL';"
```
```

- [ ] **Step 3: Add `getName`/`getDescription`/`getStyles` gotcha to `acf-composer.md`**

In `skills/sage-lando/references/acf-composer.md`, after the `### $styles format changed in WP 6.x` gotcha, add:

```markdown
### Localizing Block Metadata — `getName()` / `getDescription()` / `getStyles()`

`$name` and `$description` are class properties evaluated at class-load time — they cannot contain localization calls like `__()` because the text domain may not be registered yet. To produce translatable block metadata, override the getter methods instead:

```php
class HeroSection extends Block
{
    public $name = 'Hero Section';  // Fallback (English) — still required
    public $description = 'Full-width hero with background and CTA.';

    public function getName(): string
    {
        return __('Hero Section', 'sage');
    }

    public function getDescription(): string
    {
        return __('Full-width hero with background and CTA.', 'sage');
    }

    public function getStyles(): array
    {
        return [
            ['label' => __('Light', 'sage'), 'name' => 'light', 'isDefault' => true],
            ['label' => __('Dark', 'sage'),  'name' => 'dark'],
        ];
    }
}
```

**When to use:** any project where block names or style labels must appear translated in the Gutenberg block inserter or the editor sidebar.

**Why `$styles` needs override too:** The `$styles` array is echoed into the block inserter UI — style labels appear in the "Styles" panel. If the project has a Spanish or Portuguese admin locale, style labels like "Light" / "Dark" should be translated.
```

- [ ] **Step 4: Verify both files are well-formed**

```bash
head -5 skills/sage-lando/references/service-providers.md
head -5 skills/sage-lando/references/acf-composer.md
```
Expected: frontmatter preserved (first line is "Deep reference for...").

- [ ] **Step 5: Run validate-skills for affected skills**

```bash
node scripts/validate-skills.mjs --skill sage-lando
node scripts/validate-skills.mjs --skill block-refactoring
```
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add skills/sage-lando/references/service-providers.md \
        skills/sage-lando/references/acf-composer.md
git commit -m "feat(sage-lando): add load_textdomain gotcha and ACF getName/getDescription/getStyles i18n pattern"
```

---

## Post-wave validation

After all 5 tasks are committed:

- [ ] Run full validate-skills suite:
  ```bash
  node scripts/validate-skills.mjs
  ```
  Expected: all skills PASS.

- [ ] Verify no SKILL.md exceeds 500 lines:
  ```bash
  node scripts/validate-skills.mjs --check line-count
  ```

- [ ] Update index status once all tasks are complete:
  In `docs/superpowers/plans/2026-04-18-plugin-expansion-index.md`, update Onda 6 row from `Ready (full TDD)` to `Done`.
