> Historical document from superpowers-sage 2.x. It describes features that were removed or replaced in kivo-wise 3.0 and is kept for reference only.

# Feedback Cluster A — Worktrees Detection & CSS Cascade Spec-Driven Generation

**Date:** 2026-04-20
**Status:** approved
**Source:** feedback/2026-04-18-homepage-series-retrospective.md, feedback/2026-04-19-design-system-component-architecture.md, feedback/2026-04-20-block-refactoring-for-architects.md

---

## Scope

Two targeted improvements derived from real project feedback (interioresdecora.com.br):

1. **Onboarding — Lando runner detection**: surface the isolation strategy (branch+commit vs. worktree) once at session start, preventing building from re-explaining it every invocation.
2. **CSS cascade spec-driven generation**: block-scaffolding and block-refactoring generate CSS custom property cascade variables from the design spec instead of a static placeholder template. Block-refactoring becomes a specialist that proposes and applies these fixes atomically via Phase 6 report gate.

---

## Architecture Decisions

### AD-1 — Worktree decision belongs in onboarding, not building

The building skill already has correct worktree/Lando detection in step `d)`. The gap is that no upstream skill surfaces this, so each building session re-derives it at token cost.

**Decision:** Add Lando runner detection to onboarding Step 0. Building step `d)` acts as a silent confirmation only.

**Rejected alternative:** Writing to memory file. Memory can be absent in new sessions; a skill-level check is always reliable.

### AD-2 — CSS variable names discovered from project components, not hardcoded

CSS custom property names used in the cascade vary per project (e.g., `--eyebrow-color`, `--block-text`, `--heading-color`). Hardcoding names in the skill would create drift.

**Decision:** Phase 0b in block-scaffolding (already does shared component inventory) is extended to also extract `var(--)` references from component files. The skill uses discovered names — not assumed ones.

### AD-3 — Background context inferred from design-guide.md, not MCP

MCP tools are unavailable in subagents and may not be present in every session. The design-guide.md is always present when a plan exists.

**Decision:** Decision table reads the `## Tokens` section of the component's `design-guide.md` to infer background context. MCP data (if available from a prior step) can supplement but is not required.

### AD-4 — Single gate: Phase 6 report → approve → Phase 7 applies atomically

"Propose then apply" at the per-axis level would double token cost per block. The Phase 6 report already lists all proposed changes.

**Decision:** Phase 6 report includes the generated CSS. One gate ("apply these fixes?"). Phase 7 writes all CSS changes atomically. No per-axis gates.

---

## Change 1 — Onboarding: Lando runner detection

### File: `skills/onboarding/SKILL.md`

**Step 0 addition** — after reading `.lando.yml`, append:

```
Runner detection:
  if .lando.yml exists at repo root:
    → runner: Lando
    → isolation: branch+commit-per-phase
    → reason: Lando mounts /app to a fixed path; worktrees require
              re-mounting the container per worktree — incompatible.
  else:
    → runner: docker-compose / bare-metal
    → isolation: worktree-per-component (default building behavior)
```

**Step 3 addition** — in the `### Stack` block of the structured overview, add:

```
- Runner: Lando → isolation: branch+commit-per-phase
```

or

```
- Runner: docker-compose/bare-metal → isolation: worktree-per-component
```

**No change to building skill** — step `d)` already handles this correctly. Onboarding surfaces it once; building confirms silently.

---

## Change 2 — Block-scaffolding: CSS cascade spec-driven

### File: `skills/block-scaffolding/SKILL.md`

#### 2a — Phase 0b extension (shared component inventory)

Extend the existing Phase 0b step to also extract CSS custom properties consumed by shared components:

```
Phase 0b — Shared component inventory (extended)

1. Glob resources/views/components/*.blade.php
2. For each component:
   a. Read @props declaration → note prop names
   b. Grep for var(--*) patterns → note CSS variable names consumed
3. Build local registry:
   {
     "section-header": { props: ["eyebrow","title","align"] },
     "eyebrow":  { consumes: ["--eyebrow-color","--decorator-color"] },
     "button":   { consumes: ["--btn-bg","--btn-text"] }
   }

This registry drives CSS generation in S1 — variable names come from
the project, not from the skill's assumptions.
```

#### 2b — Background context decision table

Applied in Phase 1 S1 before generating CSS. Read the component's
`design-guide.md` (`## Tokens → Colors` section):

| Token found in design-guide Colors | Background context | CSS action |
|---|---|---|
| `bg-depth`, `bg-primary`, `bg-dark`, `bg-inverse` | Dark | Override cascade vars with `*-on-dark` / `*-inverse` equivalents |
| `bg-identity`, `bg-sage`, `bg-accent` | Identity (brand color bg) | Override cascade vars with `*-on-identity` equivalents |
| `bg-bg`, `bg-surface`, `bg-muted`, absent | Light (default) | No override — inherit `:root` defaults |
| Unrecognized token | Ambiguous | Generate commented with `/* VERIFY: background context unknown */` |

#### 2c — CSS template (S1) — spec-driven output

**Full mode — light section (no override needed):**

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

**Full mode — dark section (bg-depth detected in design-guide):**

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

**CSS rules enforced:**
- `@apply` for all Tailwind utilities (`block`, `overflow-hidden`, `flex`, spacing, etc.)
- CSS custom properties remain native CSS — no `@apply` equivalent exists for cascade variables
- No hardcoded color values — all values reference `@theme` tokens via `var(--)`
- `@reference` not `@import` — grants token access without duplicating the stylesheet

---

## Change 3 — Block-refactoring: CSS cascade specialist

### File: `skills/block-refactoring/SKILL.md`

#### 3a — G10 gap check (extended)

The existing G10 definition is extended to include the CSS that should be generated:

```
G10 — CSS custom property cascade not used

Detection:
  - Component calls with tone="*" or variant="*-dark" props that encode color context in PHP
  - class strings built in PHP via match($tone) → Tailwind class string
  - Hardcoded color utilities on semantic elements (text-depth-fg, text-identity, etc.)
    applied directly in the view instead of via inherited CSS variables

When detected:
  1. Inline component inventory: glob resources/views/components/*.blade.php,
     grep each for var(--*) patterns → build local variable name registry
     (same logic as block-scaffolding Phase 0b; runs inline here, not delegated)
  2. Read design-guide.md Tokens → Colors to determine background context:
     - If design-guide.md exists at docs/plans/*/components/*/ → use decision table
     - If design-guide.md is absent → treat as "Ambiguous"; generate with
       /* VERIFY: design-guide.md not found — confirm background context */
  3. Apply decision table (same as block-scaffolding Change 2b)
  4. Generate the corrected CSS as part of the Phase 6 report

Severity: SHOULD_FIX (CRITICAL for projects planning dark mode or multi-variation theming)
```

#### 3b — Phase 6 report: include generated CSS

The Phase 6 report template is extended. When G10 is flagged, the report section includes
the ready-to-apply CSS diff:

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

#### 3c — Single approval gate before Phase 7

After presenting the full Phase 6 report (including G10 CSS diffs):

```
"Apply all proposed fixes listed above? [y/N]"
```

On `y` → Phase 7 applies all fixes atomically:
1. Writes updated CSS files (G10 cascade variables)
2. Removes `tone` / color props from Blade views (G10 view cleanup)
3. Any other SHOULD_FIX items from the report
4. Runs `lando theme-build` to confirm no breakage
5. Presents diff for final review before commit

---

## Validation Strategy

- **Functional:** `lando theme-build` must exit 0 after CSS changes
- **Visual:** `is-style-*` variations render correctly (cascade vars resolve at each variation level)
- **Convention:** sage-reviewer R-css-vars check passes (no `tone=` props remaining)
- **Regression:** existing blocks unaffected (only modified block's CSS and views change)

## Suggested Implementation Sequencing

1. `skills/onboarding/SKILL.md` — Step 0 + Step 3 additions (smallest change, standalone)
2. `skills/block-scaffolding/SKILL.md` — Phase 0b extension + S1 template update
3. `skills/block-refactoring/SKILL.md` — G10 extension + Phase 6 report template + Phase 7 gate
