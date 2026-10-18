> Historical document from superpowers-sage 2.x. It describes features that were removed or replaced in kivo-wise 3.0 and is kept for reference only.

# Cluster A — Worktrees Detection & CSS Cascade Generation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply three targeted skill improvements — Lando runner detection in onboarding, spec-driven CSS cascade generation in block-scaffolding, and G10 CSS specialist in block-refactoring.

**Architecture:** In-file edits to four existing Markdown skill files. No new files. Tasks are independent and can be executed sequentially. Changes are additive (extend existing sections) except the S1 CSS template in block-scaffolding, which replaces the current generic `--block-*` template with a spec-driven cascade approach.

**Tech Stack:** Markdown SKILL.md files with YAML frontmatter. Consumed by Claude Code, VS Code Copilot, and Cursor agents at session runtime.

---

## Task 1 — Onboarding: Lando Runner Detection

**Files:**
- Modify: `skills/onboarding/SKILL.md`

**Context:** Onboarding Step 0 already reads `.lando.yml`. After that read, it should detect the runner and record the isolation strategy. Step 3's Stack block should surface it once so downstream skills (building) don't re-derive it each session.

---

- [ ] **Step 1.1 — Read current file and confirm anchor strings exist**

Open `skills/onboarding/SKILL.md`. Verify these two strings are present before editing:

- `**Lando config:** Use `Read` on `.lando.yml` (top-level only).`
- `- Tailwind: {v3 or v4} | Database: {mysql/mariadb}`

Expected: both present. If either is missing, stop and check the file manually.

---

- [ ] **Step 1.2 — Add runner detection block to Step 0**

In `skills/onboarding/SKILL.md`, locate this line (end of Step 0):

```
**Lando config:** Use `Read` on `.lando.yml` (top-level only).
```

Add the following immediately after it (blank line separator):

```markdown

**Runner detection:** After reading `.lando.yml`:
- If `.lando.yml` exists at repo root:
  → runner: Lando
  → isolation: branch+commit-per-phase
  → reason: Lando mounts /app to a fixed path; worktrees require
            re-mounting per worktree — incompatible.
- If `.lando.yml` does not exist:
  → runner: docker-compose / bare-metal
  → isolation: worktree-per-component (default building behavior)

Record the detected runner for use in Step 3.
```

---

- [ ] **Step 1.3 — Add Runner row to Step 3 Stack block**

In `skills/onboarding/SKILL.md`, locate this line inside the Step 3 structured overview:

```
- Tailwind: {v3 or v4} | Database: {mysql/mariadb}
```

Add the following immediately after it:

```markdown
- Runner: {Lando → isolation: branch+commit-per-phase | docker-compose/bare-metal → isolation: worktree-per-component}
```

---

- [ ] **Step 1.4 — Verify the edits**

Read `skills/onboarding/SKILL.md` and confirm:
1. The runner detection block appears under Step 0, after the `.lando.yml` line
2. The Runner row appears in the Step 3 Stack block, after the Tailwind/Database line

---

- [ ] **Step 1.5 — Commit**

```bash
git add skills/onboarding/SKILL.md
git commit -m "feat(skills): add Lando runner detection to onboarding"
```

Expected: commit succeeds, no lint errors.

---

## Task 2 — Block-scaffolding: Spec-driven CSS Cascade

**Files:**
- Modify: `skills/block-scaffolding/SKILL.md`

**Context:** Three coordinated changes to one file:
- **Phase 0b** — extend the existing shared component inventory to also extract `var(--)` CSS variable names consumed by each component. This builds the registry that drives CSS generation.
- **S1 CSS template** — replace the current generic `--block-*` template with a spec-driven approach: `@apply block overflow-hidden` + cascade variables discovered from Phase 0b, with values determined by a background-context decision table.
- **CSS rules + anti-drift table** — update `display: block` references to `@apply block overflow-hidden`.

---

- [ ] **Step 2.1 — Read current file and confirm anchor strings exist**

Open `skills/block-scaffolding/SKILL.md`. Verify these strings are present:

1. `## Phase 0b — Shared component inventory`
2. `3. Note the component API (prop names + defaults)`
3. `### S1 — \`resources/css/blocks/{slug}.css\``
4. `- \`display: block\` mandatory — custom elements default to \`inline\``
5. `| No \`display: block\` | Explicit \`display: block/flex/grid\` always |`

Expected: all five present. Stop if any is missing.

---

- [ ] **Step 2.2 — Extend Phase 0b to also extract CSS variable names**

Locate this block in Phase 0b (exact match):

```
1. Glob `resources/views/components/*.blade.php` — list all component files
2. For each component, read its `@props` declaration
3. Note the component API (prop names + defaults)
```

Replace with:

```
1. Glob `resources/views/components/*.blade.php` — list all component files
2. For each component:
   a. Read its `@props` declaration → note prop names + defaults
   b. Grep for `var(--)` patterns → note CSS variable names consumed
3. Build local registry:
   ```
   {
     "section-header": { props: ["eyebrow","title","align"] },
     "eyebrow":        { consumes: ["--eyebrow-color","--decorator-color"] },
     "button":         { consumes: ["--btn-bg","--btn-text"] }
   }
   ```

This registry drives CSS generation in S1 — variable names come from the project,
not from the skill's assumptions.
```

---

- [ ] **Step 2.3 — Replace the S1 CSS template**

Locate the entire S1 section, from:

```
### S1 — `resources/css/blocks/{slug}.css`

**Full mode:**
```

...through to (inclusive):

```
**CSS rules:**
- `@reference` not `@import` — grants Tailwind token access without duplicating styles
- `display: block` mandatory — custom elements default to `inline`
- `.is-style-* block-{slug}` single selector — works in editor and frontend
```

Replace the entire S1 section with:

````markdown
### S1 — `resources/css/blocks/{slug}.css`

Before generating CSS, apply the background context decision table.
Read the component's `design-guide.md` (`## Tokens → Colors` section) if available:

| Token found in design-guide Colors | Background context | CSS action |
|---|---|---|
| `bg-depth`, `bg-primary`, `bg-dark`, `bg-inverse` | Dark | Override cascade vars with `*-on-dark` equivalents |
| `bg-identity`, `bg-sage`, `bg-accent` | Identity (brand color bg) | Override cascade vars with `*-on-identity` equivalents |
| `bg-bg`, `bg-surface`, `bg-muted`, absent | Light (default) | No override — inherit `:root` defaults |
| Unrecognized token | Ambiguous | Generate with `/* VERIFY: background context unknown */` |

Variable names for the cascade block come from the Phase 0b registry (what each
shared component actually consumes via `var(--)` references).

**Full mode — light section (no override):**

```css
@reference "../app.css";

block-{slug} {
  @apply block overflow-hidden;

  /* cascade — inherited by child components */
  --eyebrow-color:   var(--color-identity);
  --heading-color:   var(--color-fg);
  --body-color:      var(--color-fg);
  --decorator-color: var(--color-identity);
}
```

*(variable names from Phase 0b registry; values from `:root` defaults)*

**Full mode — dark section (`bg-depth` detected in design-guide):**

```css
@reference "../app.css";

block-{slug} {
  @apply block overflow-hidden;

  /* cascade — dark section, override :root defaults */
  --eyebrow-color:   var(--color-depth-fg);
  --heading-color:   var(--color-depth-fg);
  --body-color:      var(--color-depth-fg);
  --decorator-color: var(--color-depth-fg);
}
```

**Full mode with `$styles` variations (background changes per variation):**

```css
@reference "../app.css";

block-{slug} {
  @apply block overflow-hidden;

  /* cascade — light default */
  --eyebrow-color:   var(--color-identity);
  --heading-color:   var(--color-fg);
  --body-color:      var(--color-fg);
  --decorator-color: var(--color-identity);
}

.is-style-dark block-{slug} {
  --eyebrow-color:   var(--color-depth-fg);
  --heading-color:   var(--color-depth-fg);
  --body-color:      var(--color-depth-fg);
  --decorator-color: var(--color-depth-fg);
}
```

**Minimal mode:** omit `.is-style-*` selectors. Include the token declarations
commented out so the developer has the vocabulary available:

```css
@reference "../app.css";

block-{slug} {
  @apply block overflow-hidden;
  /* --eyebrow-color:   var(--color-identity); */
  /* --heading-color:   var(--color-fg); */
  /* --body-color:      var(--color-fg); */
  /* --decorator-color: var(--color-identity); */
}
```

**CSS rules:**
- `@apply` for all Tailwind utilities (`block`, `overflow-hidden`, `flex`, spacing, etc.)
- CSS custom properties remain native CSS — no `@apply` equivalent exists for cascade variables
- No hardcoded color values — all values reference `@theme` tokens via `var(--)`
- `@reference` not `@import` — grants token access without duplicating the stylesheet
- `.is-style-* block-{slug}` single selector — works in editor and frontend
````

---

- [ ] **Step 2.4 — Update anti-drift table entry**

Locate this row in the Anti-Drift Table:

```
| No `display: block` | Explicit `display: block/flex/grid` always |
```

Replace with:

```
| No `@apply block` on custom element | `@apply block overflow-hidden` always — custom elements default to `inline` |
```

---

- [ ] **Step 2.5 — Verify the edits**

Read `skills/block-scaffolding/SKILL.md` and confirm:
1. Phase 0b step 2 now has two sub-steps (a. `@props`, b. `var(--)`)
2. Phase 0b step 3 shows the JSON registry format
3. S1 section starts with the decision table
4. S1 has three CSS examples: light, dark, and with `$styles` variations
5. All three examples use `@apply block overflow-hidden` — no `display: block`
6. CSS rules list starts with `@apply` rule, not `display: block`
7. Anti-drift table has updated entry with `@apply block`

---

- [ ] **Step 2.6 — Commit**

```bash
git add skills/block-scaffolding/SKILL.md
git commit -m "feat(skills): spec-driven CSS cascade in block-scaffolding Phase 0b + S1"
```

Expected: commit succeeds.

---

## Task 3 — Block-refactoring: G10 Specialist + Phase 7 Gate

**Files:**
- Modify: `skills/block-refactoring/SKILL.md` (G10 section)
- Modify: `skills/block-refactoring/references/report-format.md` (Phase 6 template + Phase 7 gate)

**Context:** G10 currently detects the cascade problem but stops there. This task extends it to: (1) run inline component inventory, (2) read design-guide.md for background context, (3) generate corrected CSS as part of the Phase 6 report. The report-format.md gets a G10 extended section template and a single "[y/N]" gate before Phase 7 applies all fixes atomically.

---

- [ ] **Step 3.1 — Read current files and confirm anchor strings**

Open `skills/block-refactoring/SKILL.md`. Verify:
- `#### G10. CSS variable cascade not used` is present
- `Colors must cascade from \`--block-*\` custom properties in the block's CSS; the view`

Open `skills/block-refactoring/references/report-format.md`. Verify:
- `- G10 CSS variable cascade not used: {count + locations}` is present
- `## Applying Approved Changes (Phase 7)` is present

---

- [ ] **Step 3.2 — Replace G10 in SKILL.md**

In `skills/block-refactoring/SKILL.md`, locate the entire G10 block (exact match):

```
#### G10. CSS variable cascade not used

Check the view for any of:
- `match($tone)` expressions returning Tailwind class strings (e.g. `'bg-brand-500'`)
- Props declared as `tone="light"` / `tone="dark"` driving color conditionally
- Hardcoded color utility classes (`text-gray-*`, `bg-brand-*`, `text-white`) on
  `h2`, `p`, or `span` elements

Colors must cascade from `--block-*` custom properties in the block's CSS; the view
must not select color via conditional logic. Each instance is CRITICAL.
```

Replace with:

```markdown
#### G10. CSS custom property cascade not used

**Detection** — check the view for any of:
- `match($tone)` expressions returning Tailwind class strings
  (e.g. `match($tone) { 'fg' => 'text-fg', 'dark' => 'text-depth-fg' }`)
- Props declared as `tone="fg"` / `tone="dark"` / `variant="*-dark"` encoding
  color context in PHP and passing it to child components
- Hardcoded color utility classes (`text-depth-fg`, `text-identity`, `text-white`)
  applied directly on semantic elements (`h2`, `p`, `span`) instead of via
  inherited CSS variables

Colors must cascade from custom properties in the block's CSS; the view must not
encode color context via conditional logic or hardcoded utilities.
Each instance is CRITICAL.

**When detected, generate corrected CSS for the Phase 6 report:**
1. Run inline component inventory: glob `resources/views/components/*.blade.php`,
   grep each for `var(--)` patterns → build local variable name registry
   (same logic as block-scaffolding Phase 0b; runs inline here, not delegated)
2. Read `design-guide.md` `## Tokens → Colors` to determine background context:
   - If `design-guide.md` exists at `docs/plans/*/components/*/design-guide.md`
     → apply decision table
   - If `design-guide.md` is absent → treat as Ambiguous; generate with
     `/* VERIFY: design-guide.md not found — confirm background context */`
3. Apply decision table:
   | Token found | Background | CSS action |
   |---|---|---|
   | `bg-depth`, `bg-primary`, `bg-dark`, `bg-inverse` | Dark | Use `*-on-dark` equivalents |
   | `bg-identity`, `bg-sage`, `bg-accent` | Identity | Use `*-on-identity` equivalents |
   | `bg-bg`, `bg-surface`, `bg-muted`, absent | Light (default) | Inherit `:root` defaults |
   | Unrecognized token | Ambiguous | Generate with `/* VERIFY: background context unknown */` |
4. Include generated CSS in Phase 6 report (see report-format.md G10 section template)
```

---

- [ ] **Step 3.3 — Update G10 row in report-format.md Phase 6 template**

In `skills/block-refactoring/references/report-format.md`, locate:

```
- G10 CSS variable cascade not used: {count + locations}
```

Replace with:

```
- G10 CSS custom property cascade not used: {count + locations} — when flagged, see G10 section below
```

---

- [ ] **Step 3.4 — Add G10 extended section template to report-format.md**

In `skills/block-refactoring/references/report-format.md`, locate:

```
### Suggested action
{"Ready to apply all proposals" | "Review proposals then re-run"}
```

Add the following block immediately **before** that line (blank line separator):

````markdown
---

When G10 is flagged, include this section in the Phase 6 report:

```markdown
### G10 — CSS custom property cascade not used

**Current:** `<x-eyebrow :label="$eyebrow" tone="fg" />` (color hardcoded via prop)
**Impact:** Each new variation or dark mode requires touching every block view.

**Proposed fix — `resources/css/blocks/{slug}.css`:**

\`\`\`css
@reference "../app.css";

block-{slug} {
  @apply block overflow-hidden;

  --eyebrow-color:   var(--color-identity);
  --heading-color:   var(--color-fg);
  --body-color:      var(--color-fg);
  --decorator-color: var(--color-identity);
}
\`\`\`

**Proposed fix — `resources/views/blocks/{slug}.blade.php`:**
Remove `tone="fg"` from `<x-eyebrow>` and `<x-section-header>` calls.
Child components will inherit color from CSS variables automatically.
```

---

````

---

- [ ] **Step 3.5 — Add single approval gate before Phase 7**

In `skills/block-refactoring/references/report-format.md`, locate:

```
## Applying Approved Changes (Phase 7)

After user approves proposals:
```

Replace with:

```markdown
## Approval Gate — Before Phase 7

After presenting the complete Phase 6 report (including G10 CSS diffs when applicable):

```
"Apply all proposed fixes listed above? [y/N]"
```

On `y` → Phase 7 applies all fixes atomically.
On `N` → stop; user reviews report individually and re-runs with specific items.

## Applying Approved Changes (Phase 7)

After user approves:
```

---

- [ ] **Step 3.6 — Verify the edits**

Read `skills/block-refactoring/SKILL.md` and confirm:
1. G10 heading is now "CSS custom property cascade not used"
2. G10 has a **Detection** sub-section listing the three patterns
3. G10 has a **When detected** sub-section with 4 numbered steps
4. Step 1 says "runs inline here, not delegated"
5. Step 2 includes the fallback for absent design-guide.md
6. Step 4 references "report-format.md G10 section template"

Read `skills/block-refactoring/references/report-format.md` and confirm:
1. G10 row ends with "when flagged, see G10 section below"
2. G10 extended section template exists with `block-{slug}` CSS example
3. "Approval Gate — Before Phase 7" section exists with `[y/N]` gate
4. "Applying Approved Changes (Phase 7)" section still exists, unchanged, immediately after

---

- [ ] **Step 3.7 — Commit**

```bash
git add skills/block-refactoring/SKILL.md skills/block-refactoring/references/report-format.md
git commit -m "feat(skills): G10 CSS specialist + Phase 7 single approval gate in block-refactoring"
```

Expected: commit succeeds.

---

## Global Done Criteria

- [ ] All three tasks committed independently (3 commits total)
- [ ] `skills/onboarding/SKILL.md` — runner detection in Step 0, Runner row in Step 3
- [ ] `skills/block-scaffolding/SKILL.md` — Phase 0b greps `var(--)`, decision table before S1, S1 uses `@apply block overflow-hidden` + cascade vars, anti-drift table updated
- [ ] `skills/block-refactoring/SKILL.md` — G10 has detection + CSS generation steps
- [ ] `skills/block-refactoring/references/report-format.md` — G10 section template + `[y/N]` gate before Phase 7
- [ ] No `display: block` remains in block-scaffolding S1 or CSS rules section
- [ ] No `--block-bg` or `--block-text` generic vars in the new S1 template
