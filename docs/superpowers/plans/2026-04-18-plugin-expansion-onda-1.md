> Historical document from superpowers-sage 2.x. It describes features that were removed or replaced in kivo-wise 3.0 and is kept for reference only.

# Plugin Expansion — Onda 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Foundational layer — plugin-level `CLAUDE.md` + refactor of the 7 skills with `SKILL.md > 500 linhas` to progressive-disclosure structure, ending in cross-wave validation and token measurement.

**Architecture:** Each oversized `SKILL.md` is split into a lean operational overview (< 500 linhas) plus topic-focused `references/*.md` files that Claude reads on demand. Determinism boilerplate moves to `scripts/` (Lando-wrapped) and reusable code stubs move to `assets/`. Each refactor preserves public contract (skill name, description trigger-richness, user-invocable flag).

**Tech Stack:** Markdown, bash scripts (Lando-wrapped), Node validation scripts (`.mjs`), existing `scripts/validate-skills.mjs`.

**Source spec:** `docs/superpowers/specs/2026-04-18-plugin-expansion-design.md`
**Master index:** `2026-04-18-plugin-expansion-index.md`

---

## Microplan 1.1 — `CLAUDE.md` plugin-level

**Goal:** Install universal Roots/Bedrock/Lando/Tailwind v4 rules at plugin root so Claude enforces them in every session without spending tokens on them per-skill.

**Files:**
- Create: `CLAUDE.md` (plugin root)
- Modify: `README.md` (add brief note under "How it works")
- Test: manual via `scripts/validate-skills.mjs` (must not regress)

**Quality bar:** B (markdown content, no runtime impact). `depends_on: []`. Unblocks 1.2–1.5 and 3.1.

### Task 1.1.1 — Write `CLAUDE.md` root rules

- [ ] **Step 1: Verify no existing `CLAUDE.md` at plugin root**

Run: `ls CLAUDE.md 2>&1 || echo "no existing CLAUDE.md"`
Expected: "no existing CLAUDE.md" or empty.

- [ ] **Step 2: Create `CLAUDE.md`**

```markdown
# Superpowers Sage — Universal Rules

Rules applied in every session where this plugin is active. These take
precedence over skill-local guidance unless a skill explicitly overrides.

## Environment

- All `wp`, `composer`, `artisan`, `yarn`, `npm` commands run via `lando <cmd>`.
  Never invoke these binaries directly on the host.
- Sage projects use Bedrock. Custom code lives in `web/app/`, never in `web/wp/`.
- The plugin itself is designed to work across Claude Code, VS Code Copilot,
  and Cursor. When adding hooks, update both `hooks/hooks.json` and
  `hooks/cursor-hooks.json` via `scripts/sync-cursor-hooks.mjs`.

## Protected files (never edit directly)

- `.env`, `wp-config.php` — managed by Bedrock/Trellis Vault. Suggest
  `ansible-vault edit` or Bedrock `.env` pattern instead.
- `bedrock/config/environments/*.php` — environment-specific config.
- `trellis/group_vars/*/vault.yml` — secrets.

If Claude needs to modify these, it MUST ask the user first with a concrete
alternative path.

## Tailwind v4

- `tailwind.config.js` does NOT exist in this stack. Use `@theme` directives
  inside `resources/css/app.css`.
- Prefer utility composition over `@apply`. `@apply` is allowed only for
  truly reusable component primitives.
- Source of truth for design tokens is the `@theme` block in `app.css`.

## Routing & content

- HTTP routes go through Acorn Routes (`routes/web.php`), not
  `register_rest_route()` directly.
- Custom post types go through Poet (`config/poet.php`), not
  `register_post_type()`.
- Fields and blocks go through ACF Composer classes, not the ACF GUI.

## Interactive UI

- Interactive components use Livewire. Avoid custom JS for anything Livewire
  can model.
- Static UI uses Blade components, not shortcodes.

## Background work

- Scheduled/recurring work goes through Action Scheduler or Laravel queue
  jobs, never raw WP-Cron scripts.

## When in doubt

- Query the WordPress MCP Adapter (if available) via `discover-abilities`
  and `execute-ability` before generating code that references post types,
  routes, fields, or Livewire components. See `skills/sageing/references/mcp-query-patterns.md`.
- If the AI stack is not installed, ask the user instead of guessing.
```

Save to `CLAUDE.md` at plugin root.

- [ ] **Step 3: Validate file exists and is readable**

Run: `wc -l CLAUDE.md && head -1 CLAUDE.md`
Expected: ~60 lines, first line `# Superpowers Sage — Universal Rules`.

- [ ] **Step 4: Run skills validator to confirm no regression**

Run: `node scripts/validate-skills.mjs`
Expected: exits 0, no new errors.

- [ ] **Step 5: Update `README.md` with a one-sentence note**

Add under existing "Getting Started" section (before the command table):

```markdown
> **Plugin-level rules** live in [`CLAUDE.md`](CLAUDE.md) at the plugin
> root — universal Roots/Bedrock/Lando/Tailwind v4 constraints that
> apply to every session.
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "feat(plugin): add root CLAUDE.md with universal Roots stack rules (1.1)"
```

---

## Microplan 1.2 — Refactor `acorn-middleware` (817 L)

**Goal:** Reduce `skills/acorn-middleware/SKILL.md` to under 450 linhas by extracting deep topics to `references/`. Add `scripts/` and `assets/` where determinism wins.

**Files:**
- Modify: `skills/acorn-middleware/SKILL.md` (817 → ≤ 450 linhas)
- Create: `skills/acorn-middleware/references/jwt-auth.md`
- Create: `skills/acorn-middleware/references/custom-guards.md`
- Create: `skills/acorn-middleware/references/request-filtering.md`
- Create: `skills/acorn-middleware/references/troubleshooting.md`
- Create: `skills/acorn-middleware/scripts/create-middleware.sh`
- Create: `skills/acorn-middleware/assets/middleware-auth.php.tpl`
- Create: `skills/acorn-middleware/assets/middleware-filter.php.tpl`
- Test: `scripts/validate-skills.mjs`

**Quality bar:** B. `depends_on: [1.1]`.

### Task 1.2.1 — Read and map content

- [ ] **Step 1: Read current SKILL.md and list H2/H3 sections**

Run: `grep -n '^##' skills/acorn-middleware/SKILL.md`

Produce a table mapping each section to one of: `keep in SKILL.md`, `move to references/<name>.md`, or `delete (redundant)`.

- [ ] **Step 2: Identify code blocks longer than ~15 linhas**

Run: `awk '/^```/{flag=!flag;if(flag)start=NR; else print start"-"NR": "(NR-start-1)" lines"}' skills/acorn-middleware/SKILL.md | sort -t: -k2 -n -r | head -20`

Each long block is a candidate to: (a) move into `references/` if it illustrates deep usage, or (b) move into `assets/<name>.php.tpl` if it is boilerplate the user will customize.

### Task 1.2.2 — Extract references

- [ ] **Step 1: Create `references/jwt-auth.md`**

Move the full JWT authentication section (including middleware class example, guard config, `.env` vars, token issuance flow) from `SKILL.md` to this file.

File structure:

```markdown
# JWT Authentication

Deep reference for JWT-based middleware in Acorn. Loaded on demand from
`skills/acorn-middleware/SKILL.md`.

## Setup
<moved content>

## Middleware class
<moved content>

## Guard configuration
<moved content>

## Token issuance and refresh
<moved content>

## Testing
<moved content>
```

- [ ] **Step 2: Create `references/custom-guards.md`**

Move the "Custom Guards" section (Laravel Auth guard contract, how to register, how Acorn resolves).

- [ ] **Step 3: Create `references/request-filtering.md`**

Move the "Request filtering" / "middleware groups" / "route middleware" content.

- [ ] **Step 4: Create `references/troubleshooting.md`**

Move "Common errors" and debug tips.

- [ ] **Step 5: Verify each reference is self-contained**

Each file should make sense read in isolation. Add a one-sentence intro at the top describing when to load it.

### Task 1.2.3 — Extract assets

- [ ] **Step 1: Create `assets/middleware-auth.php.tpl`**

Boilerplate for a new auth middleware, with placeholder tokens like `{{CLASS_NAME}}`, `{{GUARD_NAME}}`.

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class {{CLASS_NAME}}
{
    public function handle(Request $request, Closure $next)
    {
        if (! auth('{{GUARD_NAME}}')->check()) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        return $next($request);
    }
}
```

- [ ] **Step 2: Create `assets/middleware-filter.php.tpl`**

Boilerplate for a non-auth request filter middleware (e.g. throttle, header check).

### Task 1.2.4 — Extract scripts

- [ ] **Step 1: Create `scripts/create-middleware.sh`**

```bash
#!/usr/bin/env bash
# Create a new Acorn middleware via Lando + stub from asset template.
# Usage: create-middleware.sh <Name> [--type=auth|filter]

set -euo pipefail

NAME="${1:?usage: create-middleware.sh <Name> [--type=auth|filter]}"
TYPE="filter"
for arg in "$@"; do
    case "$arg" in
        --type=*) TYPE="${arg#*=}" ;;
    esac
done

if ! command -v lando >/dev/null 2>&1; then
    echo "lando not found on PATH" >&2
    exit 1
fi

lando acorn make:middleware "$NAME"
echo "Created middleware: app/Http/Middleware/${NAME}.php"
echo "Next: register in app/Providers/RouteServiceProvider.php"
```

- [ ] **Step 2: Make executable**

Run: `chmod +x skills/acorn-middleware/scripts/create-middleware.sh`

### Task 1.2.5 — Slim `SKILL.md`

- [ ] **Step 1: Rewrite `SKILL.md` to under 450 linhas**

Keep:
- YAML frontmatter (review description for trigger-richness).
- One-paragraph "When to use" intro.
- Quick-start snippet (≤ 20 linhas).
- Links to `references/*.md` with one-sentence descriptions of each.
- Link to `scripts/create-middleware.sh` with a usage example.
- Link to `assets/*.tpl` listing.
- "Critical rules" section (5–8 short bullets).

Remove the long-form content that moved to `references/`.

- [ ] **Step 2: Verify line count**

Run: `wc -l skills/acorn-middleware/SKILL.md`
Expected: ≤ 450.

- [ ] **Step 3: Run validator**

Run: `node scripts/validate-skills.mjs`
Expected: exit 0.

- [ ] **Step 4: Smoke test in a Claude Code session**

Open a fresh session in a Sage project. Prompt: "Create an auth middleware that validates JWT tokens." Confirm Claude loads `references/jwt-auth.md` (not every reference in the skill).

- [ ] **Step 5: Commit**

```bash
git add skills/acorn-middleware/
git commit -m "refactor(acorn-middleware): split 817L SKILL into references/scripts/assets (1.2)"
```

---

## Microplan 1.3 — Refactor `acorn-queues` + `acorn-livewire`

**Goal:** Same pattern as 1.2, applied to both skills.

**Files:**
- Modify: `skills/acorn-queues/SKILL.md` (745 → ≤ 450)
- Modify: `skills/acorn-livewire/SKILL.md` (744 → ≤ 450)
- Create: `skills/acorn-queues/references/{action-scheduler,laravel-queue,redis-driver,job-patterns,troubleshooting}.md`
- Create: `skills/acorn-queues/scripts/{create-job.sh,run-worker.sh}`
- Create: `skills/acorn-queues/assets/{job-simple.php.tpl,job-batched.php.tpl}`
- Create: `skills/acorn-livewire/references/{sage-integration,state-patterns,alpine-interop,file-uploads,common-errors}.md`
- Create: `skills/acorn-livewire/scripts/{create-component.sh,check-versions.sh}`
- Create: `skills/acorn-livewire/assets/{component.php.tpl,view.blade.php.tpl}`
- Test: `scripts/validate-skills.mjs`

**Quality bar:** B. `depends_on: [1.1]`. Parallelizable with 1.2, 1.4, 1.5.

### Task 1.3.1 — `acorn-queues` refactor

- [ ] **Step 1: Map current SKILL.md sections**

Run: `grep -n '^##' skills/acorn-queues/SKILL.md`

Target split:
- `references/action-scheduler.md` — Action Scheduler setup + common recipes.
- `references/laravel-queue.md` — Laravel queue via Acorn (drivers, connection config).
- `references/redis-driver.md` — Redis-backed queue (Lando Redis service, failover).
- `references/job-patterns.md` — Idempotency, chunking, retries, unique jobs.
- `references/troubleshooting.md` — Failed jobs table, `queue:work` debug.

- [ ] **Step 2: Extract references** following 1.2.2 pattern for each of the 5 files.

- [ ] **Step 3: Create `scripts/create-job.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
NAME="${1:?usage: create-job.sh <JobName>}"
lando acorn make:job "$NAME"
echo "Created: app/Jobs/${NAME}.php"
```

- [ ] **Step 4: Create `scripts/run-worker.sh`**

```bash
#!/usr/bin/env bash
# Runs the Acorn queue worker via Lando.
set -euo pipefail
QUEUE="${1:-default}"
lando acorn queue:work --queue="$QUEUE" --tries=3 --backoff=60
```

- [ ] **Step 5: Create `assets/job-simple.php.tpl`** — boilerplate job class with `handle()` only.
- [ ] **Step 6: Create `assets/job-batched.php.tpl`** — boilerplate using Laravel Batches.

- [ ] **Step 7: Slim `SKILL.md` to ≤ 450 linhas** per 1.2.5 pattern.

- [ ] **Step 8: Verify `wc -l skills/acorn-queues/SKILL.md` ≤ 450.**

- [ ] **Step 9: Commit**

```bash
git add skills/acorn-queues/
git commit -m "refactor(acorn-queues): split 745L SKILL into references/scripts/assets (1.3)"
```

### Task 1.3.2 — `acorn-livewire` refactor

- [ ] **Step 1: Map current SKILL.md sections**

Target split:
- `references/sage-integration.md` — Acorn boot, `@livewireStyles`/`@livewireScripts` directives, Blade integration.
- `references/state-patterns.md` — `wire:model`, `.live`, `.blur`, computed properties, lifecycle hooks.
- `references/alpine-interop.md` — `$wire.entangle`, Tailwind v4 coordination, shared state.
- `references/file-uploads.md` — `WithFileUploads` trait, Lando storage paths, S3 driver.
- `references/common-errors.md` — "Unable to find component", hydration errors, 419 CSRF.

- [ ] **Step 2: Extract references.**

- [ ] **Step 3: Create `scripts/create-component.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
NAME="${1:?usage: create-component.sh <ComponentName>}"
lando acorn make:livewire "$NAME"
echo "Created: app/Livewire/${NAME}.php + resources/views/livewire/$(echo "$NAME" | sed 's/[A-Z]/-&/g' | tr '[:upper:]' '[:lower:]' | sed 's/^-//').blade.php"
```

- [ ] **Step 4: Create `scripts/check-versions.sh`**

```bash
#!/usr/bin/env bash
# Prints installed Livewire + Acorn + PHP + Node versions.
set -euo pipefail
lando composer show livewire/livewire --format=json 2>/dev/null | jq -r '.versions[0]' | sed 's/^/Livewire: /'
lando composer show roots/acorn --format=json 2>/dev/null | jq -r '.versions[0]' | sed 's/^/Acorn: /'
lando php -r 'echo "PHP: " . PHP_VERSION . "\n";'
lando ssh -c "node --version" | sed 's/^/Node: /'
```

- [ ] **Step 5: Create `assets/component.php.tpl`** + `assets/view.blade.php.tpl` for standard component boilerplate.

- [ ] **Step 6: Slim `SKILL.md` to ≤ 450 linhas**.

- [ ] **Step 7: Verify line count + validator**

Run: `wc -l skills/acorn-livewire/SKILL.md && node scripts/validate-skills.mjs`

- [ ] **Step 8: Commit**

```bash
git add skills/acorn-livewire/
git commit -m "refactor(acorn-livewire): split 744L SKILL into references/scripts/assets (1.3)"
```

---

## Microplan 1.4 — Refactor `acorn-routes` + `acorn-eloquent`

**Goal:** Same pattern, applied to routing and ORM skills.

**Files:**
- Modify: `skills/acorn-routes/SKILL.md` (672 → ≤ 450)
- Modify: `skills/acorn-eloquent/SKILL.md` (597 → ≤ 450)
- Create: `skills/acorn-routes/references/{controllers,route-model-binding,middleware-groups,api-endpoints,troubleshooting}.md`
- Create: `skills/acorn-routes/scripts/create-controller.sh`
- Create: `skills/acorn-routes/assets/{controller-resource.php.tpl,controller-api.php.tpl}`
- Create: `skills/acorn-eloquent/references/{models,migrations,relationships,factories,query-scopes,wp-tables,troubleshooting}.md`
- Create: `skills/acorn-eloquent/scripts/{create-model.sh,run-migration.sh}`
- Create: `skills/acorn-eloquent/assets/{model-custom-table.php.tpl,model-wp-mirror.php.tpl}`
- Test: `scripts/validate-skills.mjs`

**Quality bar:** B. `depends_on: [1.1]`. Parallelizable with 1.2, 1.3, 1.5.

### Task 1.4.1 — `acorn-routes` refactor

- [ ] **Step 1: Map sections and plan split.** Target references: controllers, route-model-binding, middleware-groups, api-endpoints, troubleshooting.
- [ ] **Step 2: Extract references.**
- [ ] **Step 3: Create `scripts/create-controller.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
NAME="${1:?usage: create-controller.sh <Name> [--resource|--api]}"
FLAGS=""
[[ "${2:-}" == "--resource" ]] && FLAGS="--resource"
[[ "${2:-}" == "--api" ]] && FLAGS="--api"
lando acorn make:controller "$NAME" $FLAGS
echo "Created: app/Http/Controllers/${NAME}.php"
```

- [ ] **Step 4: Create assets** (`controller-resource.php.tpl`, `controller-api.php.tpl`).
- [ ] **Step 5: Slim `SKILL.md` to ≤ 450 linhas.**
- [ ] **Step 6: Verify + commit.**

```bash
git add skills/acorn-routes/
git commit -m "refactor(acorn-routes): split 672L SKILL into references/scripts/assets (1.4)"
```

### Task 1.4.2 — `acorn-eloquent` refactor

- [ ] **Step 1: Map sections.** Target references: models, migrations, relationships, factories, query-scopes, wp-tables (integrating with WP's `wp_posts`/`wp_postmeta`), troubleshooting.
- [ ] **Step 2: Extract references.**
- [ ] **Step 3: Create `scripts/create-model.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
NAME="${1:?usage: create-model.sh <Name> [--migration]}"
FLAGS=""
[[ "${2:-}" == "--migration" ]] && FLAGS="--migration"
lando acorn make:model "$NAME" $FLAGS
echo "Created: app/Models/${NAME}.php"
```

- [ ] **Step 4: Create `scripts/run-migration.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
lando acorn migrate "${@:---step}"
```

- [ ] **Step 5: Create assets** (`model-custom-table.php.tpl` for isolated tables, `model-wp-mirror.php.tpl` for models mirroring `wp_*`).
- [ ] **Step 6: Slim `SKILL.md` to ≤ 450.**
- [ ] **Step 7: Verify + commit.**

```bash
git add skills/acorn-eloquent/
git commit -m "refactor(acorn-eloquent): split 597L SKILL into references/scripts/assets (1.4)"
```

---

## Microplan 1.5 — Refactor `block-scaffolding` + `wp-performance`

**Goal:** Same pattern, applied to the last two oversized skills.

**Files:**
- Modify: `skills/block-scaffolding/SKILL.md` (547 → ≤ 450)
- Modify: `skills/wp-performance/SKILL.md` (505 → ≤ 450)
- Create: `skills/block-scaffolding/references/{acf-composer-registration,block-json,inner-blocks,variants,edit-preview-parity}.md`
- Create: `skills/block-scaffolding/scripts/create-block.sh`
- Create: `skills/block-scaffolding/assets/{block-atomic.php.tpl,block-container.php.tpl,block-view.blade.php.tpl}`
- Create: `skills/wp-performance/references/{query-monitor,profiling,caching,n-plus-one,autoload,core-web-vitals}.md`
- Create: `skills/wp-performance/scripts/{query-monitor-dump.sh,autoload-audit.sh}`
- Test: `scripts/validate-skills.mjs`

**Quality bar:** B. `depends_on: [1.1]`. Parallelizable with 1.2, 1.3, 1.4.

### Task 1.5.1 — `block-scaffolding` refactor

- [ ] **Step 1: Map sections.** Target references: acf-composer-registration, block-json, inner-blocks, variants, edit-preview-parity.
- [ ] **Step 2: Extract references.**
- [ ] **Step 3: Create `scripts/create-block.sh`**

```bash
#!/usr/bin/env bash
# Create a new ACF Composer block via Lando.
set -euo pipefail
NAME="${1:?usage: create-block.sh <BlockName>}"
lando acorn acf:block "$NAME"
echo "Created: app/Blocks/${NAME}.php + resources/views/blocks/$(echo "$NAME" | sed 's/[A-Z]/-&/g' | tr '[:upper:]' '[:lower:]' | sed 's/^-//').blade.php"
```

- [ ] **Step 4: Create assets** (atomic block, container block with InnerBlocks, Blade view stub).
- [ ] **Step 5: Slim `SKILL.md` to ≤ 450.**
- [ ] **Step 6: Verify + commit.**

```bash
git add skills/block-scaffolding/
git commit -m "refactor(block-scaffolding): split 547L SKILL into references/scripts/assets (1.5)"
```

### Task 1.5.2 — `wp-performance` refactor

- [ ] **Step 1: Map sections.** Target references: query-monitor, profiling, caching, n-plus-one, autoload, core-web-vitals.
- [ ] **Step 2: Extract references.**
- [ ] **Step 3: Create `scripts/query-monitor-dump.sh`**

```bash
#!/usr/bin/env bash
# Dump Query Monitor JSON for the homepage (requires QM installed + enabled).
set -euo pipefail
URL="${1:-http://$(basename "$(pwd)").lndo.site}"
lando ssh -c "curl -s -H 'Cookie: wordpress_logged_in=admin' '$URL?qm-dump=1' | jq '.'"
```

- [ ] **Step 4: Create `scripts/autoload-audit.sh`**

```bash
#!/usr/bin/env bash
# Lists autoload=yes options larger than 1KB.
set -euo pipefail
lando wp db query "SELECT option_name, LENGTH(option_value) AS size FROM wp_options WHERE autoload='yes' ORDER BY size DESC LIMIT 20"
```

- [ ] **Step 5: Slim `SKILL.md` to ≤ 450.**
- [ ] **Step 6: Verify + commit.**

```bash
git add skills/wp-performance/
git commit -m "refactor(wp-performance): split 505L SKILL into references/scripts/assets (1.5)"
```

---

## Microplan 1.6 — Cross-wave validation + token measurement

**Goal:** Prove the refactors didn't break anything and measure the token reduction.

**Files:**
- Modify: `scripts/validate-skills.mjs` (add 500-line soft limit warning)
- Create: `docs/superpowers/plans/onda-1-validation.md` (measurement report)
- Test: manual cross-platform smoke + token comparison

**Quality bar:** C. `depends_on: [1.2, 1.3, 1.4, 1.5]`.

### Task 1.6.1 — Extend validator with 500-line check

- [ ] **Step 1: Read `scripts/validate-skills.mjs`**

Run: `node scripts/validate-skills.mjs --help 2>&1 || cat scripts/validate-skills.mjs | head -40`

Understand current structure (entry point, glob pattern, validations).

- [ ] **Step 2: Add a soft warning for `SKILL.md > 500 linhas`**

Add a validator function (inline in the same file to avoid over-splitting) that, for each `SKILL.md`:
- Reads line count.
- If `> 500`, prints `warn: skills/<name>/SKILL.md has <N> linhas (>500 target)`.
- Does NOT fail the run (soft limit — we want the signal, not the block).

- [ ] **Step 3: Run on current tree**

Run: `node scripts/validate-skills.mjs`
Expected: zero warnings about `> 500` linhas (Onda 1 closed the gap).

- [ ] **Step 4: Add a test case in `scripts/__fixtures__/`**

Create a fixture skill with a `SKILL.md` of 501 linhas and assert the warning fires in `scripts/test-validate-skills.mjs`.

- [ ] **Step 5: Run test suite**

Run: `node scripts/test-validate-skills.mjs`
Expected: all tests pass, including the new 500-line warning case.

- [ ] **Step 6: Commit**

```bash
git add scripts/validate-skills.mjs scripts/test-validate-skills.mjs scripts/__fixtures__/
git commit -m "feat(validate-skills): warn on SKILL.md >500 linhas (1.6)"
```

### Task 1.6.2 — Cross-platform smoke

- [ ] **Step 1: Claude Code smoke**

Open a fresh Claude Code session in a Sage project. Run `/onboarding`. Then prompt: "Create a new Livewire component called `ContactForm` with an email field." Observe:
- `acorn-livewire` skill activates.
- Claude calls the new `scripts/create-component.sh` (not manual stubs).
- No errors, no missing references.

- [ ] **Step 2: Cursor smoke (if Cursor configured)**

Same prompt in Cursor. Verify skill activation works with the `/livewire` prefix.

- [ ] **Step 3: Record results in `docs/superpowers/plans/onda-1-validation.md`**

```markdown
# Onda 1 — Validation Report

## Cross-platform smoke
- Claude Code: PASS / FAIL — <notes>
- Cursor: PASS / FAIL / N/A — <notes>

## Validator
- `validate-skills.mjs` warnings: <count>
- `test-validate-skills.mjs`: PASS / FAIL
```

### Task 1.6.3 — Token measurement (session-padrão)

- [ ] **Step 1: Define baseline scenario**

Session-padrão:
1. Open reference Sage project.
2. Run `/onboarding`.
3. Run `/building` on a simple component (e.g., `hero` block) until Claude produces the first code diff.
4. Capture total input tokens at that point.

- [ ] **Step 2: Measure BEFORE (pre-Onda-1 baseline)**

Checkout the commit immediately before 1.1 (`git log --oneline | head -10` to find it). Re-run the session-padrão scenario. Record tokens in `onda-1-validation.md`:

```markdown
## Token measurement

| Metric | Before Onda 1 | After Onda 1 | Δ |
|---|---|---|---|
| `/onboarding` preamble input tokens | <N> | <N> | <%> |
| `/building` first-diff input tokens | <N> | <N> | <%> |
```

- [ ] **Step 3: Measure AFTER (post-Onda-1)**

Checkout main (current). Re-run. Record numbers.

- [ ] **Step 4: Document findings**

If reduction ≥ 30% on `/onboarding`: success criterion met for Onda 1. If not, add a "known gaps" bullet for Onda 2 to address.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/onda-1-validation.md
git commit -m "docs(onda-1): validation report + token measurement (1.6)"
```

### Task 1.6.4 — Update master index

- [ ] **Step 1: Mark Onda 1 as done in index**

Edit `docs/superpowers/plans/2026-04-18-plugin-expansion-index.md`:
- Change Onda 1 row status to `Done`.
- Add a link to `onda-1-validation.md`.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-04-18-plugin-expansion-index.md
git commit -m "docs(index): mark Onda 1 done, link validation report (1.6)"
```

---

## Onda 1 completion criteria

- [ ] `CLAUDE.md` exists at plugin root with universal Roots rules.
- [ ] All 7 oversized skills now have `SKILL.md ≤ 450 linhas`.
- [ ] Each refactored skill has `references/`, `scripts/`, `assets/` populated per its plan.
- [ ] `validate-skills.mjs` warns on future `>500 linhas` regressions and passes with zero warnings today.
- [ ] Cross-platform smoke test documented.
- [ ] Token measurement captured with ≥ 30% reduction target reported (pass or miss).
- [ ] `CHANGELOG.md` reflects Onda 1 via release-please commits.

When all boxes are checked, Onda 2 becomes unblocked. Proceed to expand `2026-04-18-plugin-expansion-onda-2.md` from scoped scaffolding to full TDD plan.
