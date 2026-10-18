> Historical document from superpowers-sage 2.x. It describes features that were removed or replaced in kivo-wise 3.0 and is kept for reference only.

# Usage Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `docs/guide/` with 6 reference files + 3 workflow how-to guides, and slim `README.md` to an introduction + link hub that covers all features as of v2.9.0 + token-optimization.

**Architecture:** All detailed documentation moves from `README.md` into `docs/guide/`. The README retains only: plugin description, prerequisites, installation (all 5 platforms), design tool setup, compatibility matrix, and getting started. A new `## Documentation` section in the README links to the guide index.

**Tech Stack:** Markdown. No code changes. Verification is reading each file and confirming spec coverage.

**Spec:** `docs/superpowers/specs/2026-05-28-usage-guide-design.md`

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `docs/guide/INDEX.md` | Navigation hub, quick decision table, links |
| Create | `docs/guide/skills.md` | All 19 workflow skills + 17 reference skills + architectural preferences |
| Create | `docs/guide/agents.md` | All 11 agents with purpose, invocation, input/output |
| Create | `docs/guide/commands.md` | 3 slash commands with usage and output |
| Create | `docs/guide/hooks.md` | Hook behavior, keyword router (32 entries), diagnostics |
| Create | `docs/guide/token-efficiency.md` | Before/after, mechanism, contributor guidance |
| Create | `docs/guide/workflows/first-session.md` | First session step-by-step |
| Create | `docs/guide/workflows/implement-feature.md` | Plan-driven feature loop |
| Create | `docs/guide/workflows/scaffold-block.md` | Block lifecycle: scaffold → form → refactor |
| Modify | `README.md` | Remove moved sections, add `## Documentation` link hub |

---

### Task 1: `docs/guide/INDEX.md`

**Files:**
- Create: `docs/guide/INDEX.md`

- [ ] **Step 1: Create the file**

```bash
mkdir -p docs/guide/workflows
```

Write `docs/guide/INDEX.md` with this exact content:

```markdown
# Superpowers Sage — Usage Guide

This guide covers all features of the `superpowers-sage` plugin: workflow skills (invokable slash commands), reference skills (auto-loaded technical deep-dives), agents (isolated subagent specialists), slash commands, hooks (lifecycle automation), and token efficiency.

For installation and compatibility, see the [README](../../README.md).

---

## Quick Decision Table

| If you want to… | Run |
|---|---|
| Understand a new project | `/onboarding` |
| Discover + plan a new feature | `/architecture-discovery` → `/plan-generator` → `/building` |
| Set up design tokens and UI atoms | `/sage-design-system` |
| Implement from an existing plan | `/building` |
| Add a single new ACF block | `/block-scaffolding` |
| Evolve an existing block | `/block-refactoring` |
| Add a contact form to a block | `/block-scaffolding` (Phase 0c detects it) or `/sage-forms` |
| Extract design from Paper/Figma/Stitch/Pencil | `/designing` |
| Verify implementation matches design | `/verifying` |
| Review code before PR | `/reviewing` |
| Debug a Sage/Acorn/Lando issue | `/debugging` |
| Debug a Livewire component specifically | `/debugging` (routes to `livewire-debugger` agent) |
| Migrate data between fields or post types | `/migrating` |
| Model content: CPT vs ACF vs Options Page | `/modeling` |
| Set up AI/MCP tools | `/ai-setup` |
| Author a new MCP ability endpoint | `/abilities-authoring` |
| Install a WordPress plugin via Composer | `/install-plugin` |

---

## Reference

| File | What it covers |
|---|---|
| [skills.md](skills.md) | All 19 workflow skills · 17 reference skills · architectural preferences |
| [agents.md](agents.md) | All 11 agents — purpose, invocation, input, output |
| [commands.md](commands.md) | 3 slash commands: `/acf-register`, `/livewire-new`, `/sage-status` |
| [hooks.md](hooks.md) | Session-start, keyword router (32 entries), post-edit, diagnostics |
| [token-efficiency.md](token-efficiency.md) | How the plugin saves tokens — mechanism and contributor guidance |

## Practical Guides

| File | What it covers |
|---|---|
| [workflows/first-session.md](workflows/first-session.md) | What to do in the first session on a new project |
| [workflows/implement-feature.md](workflows/implement-feature.md) | Full plan-driven feature loop from discovery to PR |
| [workflows/scaffold-block.md](workflows/scaffold-block.md) | New block scaffold, form integration, block refactoring |
```

- [ ] **Step 2: Verify**

```bash
wc -l docs/guide/INDEX.md
# Expected: ~55 lines
grep -c "\[" docs/guide/INDEX.md
# Expected: ≥ 15 links
```

- [ ] **Step 3: Commit**

```bash
git add docs/guide/INDEX.md
git commit -m "docs(guide): add INDEX.md navigation hub"
```

---

### Task 2: `docs/guide/skills.md`

**Files:**
- Create: `docs/guide/skills.md`

- [ ] **Step 1: Create the file**

Write `docs/guide/skills.md` with this exact content:

````markdown
# Skills Reference

Skills are the core of the plugin. **Workflow skills** are user-invocable slash commands that guide you through activities. **Reference skills** are technical deep-dives loaded automatically when the keyword router detects relevant terms in your prompt, or explicitly when a workflow skill needs them.

---

## Workflow Skills

| Skill | Invoke with | When to use | Keyword router triggers |
|---|---|---|---|
| **onboarding** | `/onboarding` | First session on any project — analyze stack, packages, design tools, active plans | `project orientation`, `what exists in this project`, `first session` |
| **architecture-discovery** | `/architecture-discovery` | Deep architecture discovery with hard gates and section approvals | `map the codebase`, `discover the architecture` |
| **plan-generator** | `/plan-generator` | Convert an approved architecture spec into executable plan files | `generate the plan`, `write the plan` |
| **architecting** | `/architecting` | Alias — runs architecture-discovery then plan-generator in sequence | — |
| **modeling** | `/modeling` | Content architecture: classify static vs dynamic, recommend Poet/ACF/Options | — |
| **designing** | `/designing` | Design tool integration: Paper (preferred), Stitch, Figma, or local Pencil — routed by URL/path | `extract from figma`, `extract from pencil`, `paper.design url`, `pencil design` |
| **building** | `/building` | Plan-driven implementation with auto-verification after each component | `implement from the plan`, `build from the plan`, `execute the plan` |
| **block-scaffolding** | `/block-scaffolding` | Scaffold a new ACF block — 3 phases: design extraction, content modeling, form detection | `scaffold a block`, `new acf block` |
| **block-refactoring** | `/block-refactoring` | Evolve an existing block: fix drift, extend variants, v1→v2 migration | `refactor this block`, `block evolution`, `v1 to v2 migration` |
| **sage-design-system** | `/sage-design-system` | Bootstrap design tokens, kitchensink page, and global CSS variables | `design system tokens`, `kitchensink page`, `design system setup` |
| **verifying** | `/verifying` | Visual comparison: implementation screenshots vs design reference | `visual verification`, `compare to design`, `screenshot diff`, `design drift` |
| **reviewing** | `/reviewing` | Convention audit + design alignment check + pre-PR report | `review before pr`, `run a review`, `pre-pr review`, `convention audit` |
| **debugging** | `/debugging` | Sage-aware troubleshooting with cache, OPcache, and Livewire knowledge | `acorn boot error`, `blade rendering error`, `livewire mount fail`, `something is broken` |
| **migrating** | `/migrating` | Safe data migration scripts: post_content → ACF, field rename, post type migration | `post_content migration`, `acf field migration`, `data migration script` |
| **sage-forms** | `/sage-forms` | HTML Forms + Sage integration: `hf_get_form`, Blade form views, JS validation | `sage-html-forms`, `hf_get_form`, `html forms plugin` |
| **ai-setup** | `/ai-setup` | Install and configure AI/MCP tools: Acorn AI adapter, discover-abilities | `acorn ai`, `mcp adapter`, `discover-abilities`, `install mcp` |
| **abilities-authoring** | `/abilities-authoring` | Author new MCP ability endpoints via `make:ability` | `make:ability`, `execute-ability`, `acorn ability`, `mcp endpoint` |
| **install-plugin** | `/install-plugin` | Install WordPress plugins via Composer from `.zip` or `wp-packages.org` | — |
| **sageing** | `/sageing` | Meta skill — full architectural preferences and MCP query patterns | `which skill should i use`, `skill routing`, `full architectural preferences` |

> **Naming:** Skills use gerund form (`/building`, `/reviewing`) — the name describes the **activity**, not a shortcut.

---

## Reference Skills

Reference skills are **not** user-invocable. They are loaded by workflow skills and agents, or triggered by the keyword router when specific terms appear in your prompt. You can also invoke them explicitly if you know the name.

### Acorn Ecosystem

| Skill | Loaded when | Covers |
|---|---|---|
| `acorn-livewire` | `livewire component`, `wire:model`, `wire:click`, `make:livewire`, `livewire v3` | Livewire v3 component lifecycle, computed properties, Alpine.js integration, CSRF |
| `acorn-eloquent` | `eloquent model`, `model class`, `hasmany`, `belongsto`, `eloquent relationship` | Eloquent models in Acorn, scopes, eager loading, N+1 prevention |
| `acorn-queues` | `dispatch job`, `action scheduler`, `queue:work`, `queue job` | Action Scheduler, Laravel queues, job classes, failed job handling |
| `acorn-middleware` | `http middleware`, `acorn middleware`, `terminate()` | Middleware registration in Acorn, terminable middleware, kernel |
| `acorn-redis` | `redis cache`, `cache tags`, `cache driver`, `redis facade` | Redis cache driver, object cache drop-in, cache groups |
| `acorn-logging` | `log channel`, `monolog`, `logging config`, `log::error` | Monolog channels in Acorn, daily/stack drivers, custom handlers |
| `acorn-routes` | `acorn route`, `routes/web.php`, `register route` | Acorn Routes, named routes, route model binding |
| `acorn-commands` | — | Artisan commands in Acorn, `make:command`, scheduling |

### WordPress Core

| Skill | Loaded when | Covers |
|---|---|---|
| `wp-hooks-lifecycle` | `add_action`, `add_filter`, `hook priority`, `plugins_loaded`, `wptexturize`, `save_post hook` | Hook execution order, ServiceProvider boot() placement, Tailwind filter conflicts |
| `wp-rest-api` | `wp_rest_controller`, `rest endpoint`, `register_rest_route` | REST endpoint registration, authentication, permissions callbacks |
| `wp-capabilities` | `user capabilities`, `current_user_can`, `add_role`, `register_capability` | Roles, capabilities, multi-author setups, content restriction |
| `wp-security` | `sql injection`, `xss attack`, `nonce verification`, `sanitize_text_field`, `wp_kses`, `esc_html security` | Sanitize/escape/nonce/CSRF/capability checks, Bedrock secrets management |
| `wp-performance` | `transient cache`, `object cache`, `n+1 query`, `slow wp query`, `cache invalidation` | Query Monitor, N+1 patterns, autoloaded options, Redis, Core Web Vitals |
| `wp-cli-ops` | `wp eval`, `wp post list`, `wp option update`, `wp db query` | WP-CLI operations via Lando, bulk operations, database inspection |
| `wp-phpstan` | `phpcs`, `php codesniffer`, `phpstan`, `psalm`, `static analysis` | PHPStan levels, Psalm, PHPCS rules for WordPress/Sage projects |
| `wp-block-native` | `block.json`, `register_block_type`, `native block`, `wp:core`, `innerblocks` | Native Gutenberg blocks, `block.json` schema, InnerBlocks patterns |

### Theme + Tooling

| Skill | Loaded when | Covers |
|---|---|---|
| `sage-lando` | `lando start`, `lando stop`, `lando restart`, `lando ssh`, `lando info` | Lando services, recipes, debugging, custom services, port mapping |
| `sage-forms` | `sage-html-forms`, `hf_get_form`, `html forms plugin` | HTML Forms plugin + Blade bridge, form view routing, JS validation module, traps T1/T2/T3 |

---

## Architectural Preferences

The plugin enforces opinionated patterns for the Roots ecosystem. Workflow skills and agents will follow these by default.

| Scenario | Use | Avoid |
|---|---|---|
| Routes | Acorn Routes (`routes/web.php`) | `register_rest_route()` directly |
| Custom post types | Poet (`config/poet.php`) | `register_post_type()` |
| Fields and blocks | ACF Composer classes | ACF GUI |
| Background tasks | Action Scheduler / Laravel queue | Raw `wp-cron` scripts |
| Global config | ACF Options Pages | `wp_options` directly |
| Business logic | Service class or ServiceProvider | Fat controllers |
| Interactive UI | Livewire | Heavy custom JS |
| Static UI | Blade components | Shortcodes |
| Forms | HTML Forms plugin + sage-html-forms | CF7, Gravity Forms |
| Secrets | Bedrock `.env` | Hardcoded in PHP or version-controlled config |
````

- [ ] **Step 2: Verify**

```bash
grep -c "^|" docs/guide/skills.md
# Expected: ≥ 45 table rows
grep "block-scaffolding\|block-refactoring\|migrating\|sage-forms\|ai-setup\|abilities-authoring\|sage-design-system" docs/guide/skills.md | wc -l
# Expected: ≥ 7 (the skills that were missing from README)
```

- [ ] **Step 3: Commit**

```bash
git add docs/guide/skills.md
git commit -m "docs(guide): add skills.md — all 19 workflow + 17 reference skills"
```

---

### Task 3: `docs/guide/agents.md`

**Files:**
- Create: `docs/guide/agents.md`

- [ ] **Step 1: Create the file**

Write `docs/guide/agents.md` with this exact content:

```markdown
# Agents Reference

Agents are **isolated subagent specialists** — each runs in its own context with a focused set of tools and skills. They are invoked by workflow skills automatically, or you can name them explicitly in a prompt.

All agents are namespaced as `superpowers-sage:<name>`.

---

## Core Agents

These agents are invoked by the primary workflow skills.

| Agent | Invoked by | Purpose | Input | Output |
|---|---|---|---|---|
| `sage-architect` | `/architecture-discovery` | Analyze feature requirements against Sage/Acorn conventions, produce Architecture Decision Records | Feature description, existing codebase context | ADR + component list + content model outline |
| `sage-reviewer` | `/reviewing` | Audit code against Sage/Acorn conventions: providers, hooks, ACF patterns, Blade structure | Changed files or PR diff | Annotated review with pass/fail per convention |
| `sage-debugger` | `/debugging` | Systematic diagnostics for Sage/Acorn/Lando issues — checks logs, configs, cache, autoload, service status | Error message or symptom description | Root cause + fix steps |
| `content-modeler` | `/modeling` | Classify content as static ACF fields, dynamic CPT collections, global Options Pages, or relational with Poet config | Component descriptions from design or spec | Content model table + Poet configuration snippets |
| `visual-verifier` | `/verifying` | Compare implementation screenshots against design reference using Playwright MCP | Plan spec files + reference images | Visual match report: match / drift / missing elements |
| `pencil-extractor` | `/designing` (for `.pen` files) | Extract design specs from Pencil `.pen` files; three modes: PANORAMIC (global tokens), SURGICAL (per section), COMPONENT_MAP (library bridge) | `.pen` file path or `design/` folder | Structured spec files: typography, colors, spacing, SVGs |

---

## Specialist Agents

These agents handle specific domains and are routed to by workflow skills when the context matches, or can be invoked directly.

| Agent | Invoked by | Purpose | Input | Output |
|---|---|---|---|---|
| `design-extractor` | `/designing` (for Paper/Figma/Stitch) | Extract precise design specs from Paper, Figma, or Stitch MCPs, or local reference images; PANORAMIC or SURGICAL mode | Design URL (Paper/Figma/Stitch) or image path | Spec files: typography, colors, spacing, SVG exports, layout |
| `forms` | `/sage-forms` or directly | Audit existing HTML Forms integrations against `sage-forms` skill patterns and apply fixes; or scaffold new standalone forms. Covers traps T1 (pattern backslash escaping), T2 (type=tel Chrome bug), T3 (ValidityState non-enumerable) | Blade form view path or "scaffold new form" prompt | Fix diff behind a single approval gate, or new form scaffold |
| `livewire-debugger` | `/debugging` (for Livewire issues) | Diagnose Livewire components that fail to mount, update, or emit events. Checks: component class, Blade bindings, CSRF middleware, network responses (419/403/500), Alpine.js conflicts, Livewire v2→v3 API changes | Component name or error description | Root cause + specific fix for the Livewire failure |
| `acorn-migration` | `/building` (for legacy theme migration) | Analyze procedural WordPress theme code and produce a phased migration plan to Acorn/Sage architecture. Detects `register_post_type` → Poet, `add_action/add_filter` → ServiceProvider, `$wpdb` → Eloquent, WP_Query → Eloquent scopes | `functions.php` path or theme directory | Phased migration plan with file-by-file recommendations |
| `tailwind-v4-auditor` | `/reviewing` | Audit Sage/Tailwind v4 projects across 5 categories: v3→v4 syntax, arbitrary value tokenization, PHP color-prop resolution, CSS variable cascade coverage, WP core layer conflicts | Theme directory | Severity-ranked report + dark-mode readiness score |

---

## Invoking Agents Directly

In Claude Code, agents appear in the command palette as `superpowers-sage:<name>`. You can also reference them in a prompt:

```
Use the livewire-debugger agent to investigate why my SearchBar component won't mount.
```

```
Ask the tailwind-v4-auditor to review the theme and report CSS variable cascade issues.
```
```

- [ ] **Step 2: Verify**

```bash
grep -c "^|" docs/guide/agents.md
# Expected: ≥ 13 table rows (11 agents + 2 headers)
grep "design-extractor\|forms\|livewire-debugger\|acorn-migration\|tailwind-v4-auditor" docs/guide/agents.md | wc -l
# Expected: ≥ 5 (the agents missing from README)
```

- [ ] **Step 3: Commit**

```bash
git add docs/guide/agents.md
git commit -m "docs(guide): add agents.md — all 11 agents including 5 previously undocumented"
```

---

### Task 4: `docs/guide/commands.md`

**Files:**
- Create: `docs/guide/commands.md`

- [ ] **Step 1: Create the file**

Write `docs/guide/commands.md` with this exact content:

```markdown
# Slash Commands

Slash commands are **fixed-script utilities** — distinct from skills, which are interactive guidance. Commands run a defined sequence of steps without LLM reasoning about approach.

Three commands ship with the plugin. They appear in the `/` command palette in Claude Code.

---

## `/acf-register`

Scaffolds a new ACF field group as a PHP class via Acorn's scaffolding command.

**When to use:** You need to add a new field group to the project and want the correct Acorn-managed class skeleton without typing the command manually.

**What it does:**
1. Asks: `Field group name? (e.g. HeroFields, PageSettings)`
2. Runs: `lando acorn acf:field <FieldGroupName>`
3. Reports the file created: `app/Fields/<FieldGroupName>.php`
4. Offers to open the file for editing

**Requirements:**
- Acorn installed (`lando acorn` available)
- ACF Pro active in the project
- Run from the theme root: `web/app/themes/<theme-name>/`

**Note:** This generates a code-managed field group, not an ACF GUI group. After scaffolding, define fields inside the class's `register()` method. See `acorn-eloquent` skill for field group patterns.

---

## `/livewire-new`

Scaffolds a new Livewire component via the plugin's create-component script.

**When to use:** You need a new Livewire component and want the correct Sage file locations without looking them up.

**What it does:**
1. Asks: `Component name? (e.g. SearchBar, UserProfile)`
2. Runs: `bash skills/acorn-livewire/scripts/create-component.sh <ComponentName>`
3. Reports both files created:
   - PHP class: `app/Http/Livewire/<ComponentName>.php`
   - Blade view: `resources/views/livewire/<component-name>.blade.php`

**Requirements:**
- Livewire installed in the project
- Run from the project root (where `skills/acorn-livewire/scripts/` is accessible)

**Note:** After scaffolding, wire properties and events using the `acorn-livewire` skill patterns.

---

## `/sage-status`

Reports Lando health, stack versions, active plan, and design tools for the current project. Useful at the start of a session to confirm everything is running before diving into work.

**What it runs:**

| Check | Command |
|---|---|
| Lando containers | `lando info` |
| WordPress version | `lando wp core version` |
| PHP version | `lando php -r "echo PHP_VERSION;"` |
| Acorn version | `lando theme-composer show roots/acorn` |
| Node version | `lando node --version` |
| Active plan | First `docs/plans/*/plan.md` with `status: in-progress` |
| Design tools | `node scripts/detect-design-tools.mjs` |

**Example output:**

```
### Lando Status
appserver  running
database   running
cache      running

### Stack Versions
WordPress: 6.8.1
PHP:       8.3.6
Acorn:     4.2.0
Node:      20.11.0

### Active Plan
docs/plans/2026-05-28-contact-block/plan.md

### Design Tools
Paper: configured · Playwright: configured · Figma: not configured
```

If a command fails, the output shows `unavailable` for that entry rather than stopping.
```

- [ ] **Step 2: Verify**

```bash
grep "^## \`" docs/guide/commands.md | wc -l
# Expected: 3
grep "acf-register\|livewire-new\|sage-status" docs/guide/commands.md | wc -l
# Expected: ≥ 3
```

- [ ] **Step 3: Commit**

```bash
git add docs/guide/commands.md
git commit -m "docs(guide): add commands.md — acf-register, livewire-new, sage-status"
```

---

### Task 5: `docs/guide/hooks.md`

**Files:**
- Create: `docs/guide/hooks.md`

- [ ] **Step 1: Create the file**

Write `docs/guide/hooks.md` with this exact content:

````markdown
# Hooks

Hooks are shell scripts that run automatically at lifecycle events — they consume **zero LLM tokens** and require no prompt from you.

---

## SessionStart

**Script:** `hooks/session-start.sh`  
**Trigger:** Beginning of every session in a Sage project.

**What it injects:**

A compact routing table (~1,284 chars) that includes:
- The Lando runner rule (`all wp/composer/php/node/npm commands via lando <cmd>`)
- A quick cache/build reference (`lando flush` for PHP, `lando theme-build` for assets)
- A 15-row decision table mapping common tasks to skills

This replaced the previous behavior of injecting the full `sageing` SKILL.md (18,622 chars, 270 lines) on every session. See [token-efficiency.md](token-efficiency.md) for details.

**Side effects (zero-token, before injection):**
- Detects whether the current directory contains a Sage/Acorn project (exits silently if not)
- Detects configured design tools (Paper, Figma, Stitch, Playwright)
- Detects Lando availability and Livewire installation
- Includes the active plan path if one is `status: in-progress`

---

## UserPromptSubmit — Keyword Router

**Script:** `hooks/user-prompt-activate.sh`  
**Trigger:** Every user message.

**Logic:**
1. Lowercases the prompt
2. Scans against 32 keyword entries (each entry has `|`-separated aliases mapping to a skill name)
3. If **exactly 1** skill matches → injects an `additionalContext` hint pointing to that skill
4. If **0 or 2+** skills match → exits silently (avoids injecting the wrong skill when intent is ambiguous)

**Complete keyword map:**

| Skill | Triggers |
|---|---|
| `onboarding` | `/onboarding`, `project orientation`, `what exists in this project`, `first session`, `onboard to this` |
| `reviewing` | `/reviewing`, `sage-reviewer`, `run a review`, `review my block`, `pre-pr review`, `review before pr`, `convention audit` |
| `debugging` | `/debugging`, `lando logs show`, `acorn boot error`, `blade rendering error`, `livewire mount fail`, `debug this issue`, `something is broken` |
| `building` | `/building`, `implement from the plan`, `build from the plan`, `execute the plan`, `building skill`, `start building` |
| `architecture-discovery` | `/architecture-discovery`, `map the codebase`, `discover the architecture`, `architecture discovery` |
| `plan-generator` | `/plan-generator`, `generate the plan`, `write the plan`, `plan-generator skill` |
| `designing` | `/designing`, `extract from figma`, `extract from pencil`, `design to blade`, `paper.design url`, `pencil design` |
| `verifying` | `/verifying`, `visual verification`, `compare to design`, `screenshot diff`, `design drift` |
| `migrating` | `/migrating`, `post_content migration`, `acf field migration`, `data migration script` |
| `sage-design-system` | `/sage-design-system`, `design system tokens`, `kitchensink page`, `design system setup` |
| `block-scaffolding` | `/block-scaffolding`, `scaffold a block`, `new acf block`, `block-scaffolding skill` |
| `block-refactoring` | `/block-refactoring`, `refactor this block`, `block evolution`, `v1 to v2 migration`, `block refactor skill` |
| `sageing` | `/sageing`, `which skill should i use`, `skill routing`, `sage ecosystem`, `full architectural preferences` |
| `ai-setup` | `/ai-setup`, `acorn ai`, `mcp adapter`, `discover-abilities`, `install mcp` |
| `abilities-authoring` | `/abilities-authoring`, `make:ability`, `execute-ability`, `acorn ability`, `mcp endpoint`, `wp ability` |
| `acorn-livewire` | `livewire component`, `wire:model`, `wire:click`, `make:livewire`, `livewire v3` |
| `acorn-eloquent` | `eloquent model`, `model class`, `eloquent query`, `hasmany`, `belongsto`, `eloquent relationship` |
| `wp-block-native` | `block.json`, `register_block_type`, `native block`, `wp:core`, `innerblocks` |
| `sage-lando` | `lando start`, `lando stop`, `lando restart`, `lando ssh`, `lando info` |
| `acorn-queues` | `dispatch job`, `action scheduler`, `queue:work`, `queue job`, `horizon` |
| `acorn-middleware` | `http middleware`, `acorn middleware`, `terminate()` |
| `acorn-redis` | `redis cache`, `cache tags`, `cache driver`, `redis facade` |
| `acorn-logging` | `log channel`, `monolog`, `logging config`, `log::error`, `daily channel` |
| `acorn-routes` | `acorn route`, `routes/web.php`, `register route` |
| `wp-phpstan` | `phpcs`, `php codesniffer`, `phpstan`, `psalm`, `static analysis` |
| `wp-rest-api` | `wp_rest_controller`, `rest endpoint`, `register_rest_route` |
| `wp-capabilities` | `user capabilities`, `current_user_can`, `add_role`, `register_capability`, `wp roles` |
| `wp-security` | `sql injection`, `xss attack`, `nonce verification`, `sanitize_text_field`, `wp_kses`, `esc_html security` |
| `wp-performance` | `transient cache`, `object cache`, `n+1 query`, `slow wp query`, `cache invalidation` |
| `wp-hooks-lifecycle` | `add_action`, `add_filter`, `hook priority`, `plugins_loaded`, `wptexturize`, `save_post hook` |
| `wp-cli-ops` | `wp eval`, `wp post list`, `wp option update`, `wp db query` |
| `sage-forms` | `sage-html-forms`, `hf_get_form`, `html forms plugin`, `log1x/sage-html-forms` |

---

## Other Hooks

| Hook | Trigger | What it does |
|---|---|---|
| `post-edit` | After any file Write or Edit | `lando flush` for PHP files, `lando theme-build` for CSS/JS assets — zero-token cache invalidation |
| `post-compact` | Context window compression | Re-injects the active plan path and asset count so work can continue after compaction |
| `pre-commit` | Before `git commit` | Reminds to verify implementation visually against the design reference before committing |
| `post-subagent` | Subagent completes | Logs activity to the active plan's `logs/` directory |
| `post-stop` | Session ends | Logs session end to the active plan's `logs/` directory |

---

## Hook Sync Requirement

`hooks/hooks.json` (Claude Code / VS Code / Codex) and `hooks/cursor-hooks.json` (Cursor) must stay in sync. After modifying any hook entry:

```bash
node scripts/sync-cursor-hooks.mjs
```

CI enforces this — a diff between the two files fails the `manifest-sync` job.

---

## Diagnostics

### Quick check

```bash
bash scripts/doctor-hooks.sh
```

Verifies: Lando availability, Node, hook scripts executable, active plans, recent log entries.

### Debug logging

```bash
export SUPERPOWERS_SAGE_HOOK_DEBUG=1
export SUPERPOWERS_SAGE_HOOK_LOG=.superpowers-sage/hooks.log
```

Reproduce the action (edit a file, `git commit`, etc.), then:

```bash
tail -20 .superpowers-sage/hooks.log
```

Look for `HOOK_STATUS=skip` or `HOOK_STATUS=warn`.

### Common warnings

| Warning | Cause | Fix |
|---|---|---|
| `skip: lando CLI not found in PATH` | Lando not installed or not in PATH | Install Lando: `brew install lando` or [platform-specific](https://lando.dev) |
| `skip: .lando.yml not found` | Project is not Lando-based | `post-edit` only runs in Lando projects |
| `skip: file_path not found in payload` | Hook couldn't extract file path from event | Normal for non-file actions |
| `skip: no active plan found` | No plan with `status: in-progress` | Run `/architecture-discovery` → `/plan-generator`, or `/building` with an existing plan |
| `HOOK_STATUS=warn: theme-build failed` | Asset build error (Vite, Tailwind) | Run `lando theme-build` manually to see full error |
````

- [ ] **Step 2: Verify**

```bash
grep -c "^|" docs/guide/hooks.md
# Expected: ≥ 45 rows (32 keyword map + other hooks + warnings)
grep "UserPromptSubmit\|SessionStart\|post-edit\|post-compact\|pre-commit" docs/guide/hooks.md | wc -l
# Expected: ≥ 5
```

- [ ] **Step 3: Commit**

```bash
git add docs/guide/hooks.md
git commit -m "docs(guide): add hooks.md — session-start, keyword router (32 entries), diagnostics"
```

---

### Task 6: `docs/guide/token-efficiency.md`

**Files:**
- Create: `docs/guide/token-efficiency.md`

- [ ] **Step 1: Create the file**

Write `docs/guide/token-efficiency.md` with this exact content:

```markdown
# Token Efficiency

The plugin is designed to be productive without burning tokens on every session. This page explains how that works, and what contributors need to know to keep it that way.

---

## The Problem Before (pre-2026-05-28)

Every session start (`SessionStart` hook) read and injected the entire `skills/sageing/SKILL.md` file:

- **Size:** 18,622 characters, 270 lines
- **Tags:** Wrapped in `<EXTREMELY_IMPORTANT>` — guaranteed to land in the active context
- **Trigger:** Every session in every Sage project, regardless of what the user asked

Additionally, the `sageing` skill's description said *"read this first in any Sage/Acorn project session"*, which caused Claude to invoke it again via the Skill tool even after the hook had already injected it. Double-loading.

**Result:** ~18,622 chars consumed before the user typed a single character.

---

## The Solution (2026-05-28)

Three coordinated changes:

### 1. Compact routing table in SessionStart

`hooks/session-start.sh` now injects a 20-line compact routing table (~1,284 chars):
- Lando runner rule
- Cache/build quick reference
- 15-row task → skill decision table

**Reduction: 93%** (18,622 → 1,284 chars per session start).

### 2. Keyword router (UserPromptSubmit)

`hooks/user-prompt-activate.sh` scans each prompt against 32 keyword entries. When exactly 1 skill matches, it injects a short `additionalContext` hint — the skill loads **on demand only**, not on every session.

Skills that used to be speculatively loaded now only load when the prompt explicitly requests them or contains domain-specific terms.

### 3. Updated skill descriptions

All major skills now have `Invoke for:` and `Skip when:` lines in their description frontmatter. These give Claude enough signal to decide not to invoke a skill when the context doesn't match, counteracting the 1% threshold in the base `using-superpowers` skill.

---

## The 1% Threshold

The base `using-superpowers` skill contains:

> "If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill."

This is intentionally aggressive — it prevents skills from being silently skipped when they should apply. The downside: without `Invoke for:` / `Skip when:` guidance, Claude will invoke skills speculatively.

The `Invoke for:` / `Skip when:` pattern gives Claude enough signal to decide confidently — "this skill does not apply" — and skip it, even under the 1% rule.

---

## Contributor Guidance

When adding a new skill to the plugin:

**1. Write `Invoke for:` and `Skip when:` in the description frontmatter:**

```yaml
---
name: superpowers-sage:my-new-skill
description: >
  What the skill does — concise technical summary of its domain.
  Invoke for: the exact user phrases or situations that should trigger this skill.
  Skip when: situations where this skill does NOT apply, especially if they overlap with other skills.
user-invocable: true  # or false if reference-only
---
```

**2. If the skill is user-invocable, add it to the keyword router:**

In `hooks/user-prompt-activate.sh`, add an entry to `KEYWORD_MAP`:

```bash
"/my-new-skill|phrase that means this|another trigger phrase:my-new-skill"
```

Format: `keyword1|keyword2|...:skill-name` (skill-name matches the last segment of the `name:` frontmatter field).

**3. Run the hook sync:**

```bash
node scripts/sync-cursor-hooks.mjs
```

**4. Update `docs/guide/skills.md`** — add the skill to the workflow or reference table.

**5. Update `docs/guide/hooks.md`** — add the keyword entries to the keyword map table.

---

## Measurement

To estimate token cost of a session start, check the `COMPACT_GUIDE` variable length:

```bash
bash -c '
COMPACT_GUIDE="Runner: all wp/composer/php/node/npm commands via \`lando <cmd>\`. Never run on host."
echo "Chars: ${#COMPACT_GUIDE}"
'
```

The full session-start output (including project detection, design tool listing, and the compact guide) is typically 2,000–3,500 chars total depending on the project's active plans and detected tools.
```

- [ ] **Step 2: Verify**

```bash
grep "93%\|18,622\|1,284\|Invoke for\|Skip when\|1%" docs/guide/token-efficiency.md | wc -l
# Expected: ≥ 6 (all key facts present)
```

- [ ] **Step 3: Commit**

```bash
git add docs/guide/token-efficiency.md
git commit -m "docs(guide): add token-efficiency.md — mechanism, before/after, contributor guide"
```

---

### Task 7: `docs/guide/workflows/first-session.md`

**Files:**
- Create: `docs/guide/workflows/first-session.md`

- [ ] **Step 1: Create the file**

Write `docs/guide/workflows/first-session.md` with this exact content:

```markdown
# First Session on a New Project

This guide covers what to do when you open a Sage project in Claude Code for the first time. The goal: understand the project state and decide what to work on next — in under 10 minutes.

---

## Step 1 — Run `/onboarding`

```
/onboarding
```

The `onboarding` skill analyzes the project and outputs a structured report. It detects:

| What | How |
|---|---|
| Theme path and Acorn version | Reads `composer.json` in the theme |
| Installed packages | Scans `composer.json` and `package.json` |
| Design tools | Checks for Paper/Figma/Stitch/Playwright MCP configurations |
| Active plans | Finds `docs/plans/*/plan.md` files with `status: in-progress` |
| Livewire | Checks if `acorn-livewire` is in dependencies |
| Lando | Verifies `.lando.yml` exists and Lando is available |

---

## Step 2 — Read the Output

The report ends with a **Suggested next step** section. Common scenarios:

### Scenario A: Active plan found

```
Active plan: docs/plans/2026-05-15-contact-section/plan.md
Suggested: run /building to continue from Task 3 (ContactBlock)
```

→ Run `/building`. The skill reads the plan and picks up where it left off.

### Scenario B: No plan, project is partially built

```
No active plan found.
Theme: web/app/themes/sage — Acorn 4.2, Livewire installed
Design tools: Paper configured, Playwright configured
Suggested: run /architecture-discovery to map the codebase before starting new work
```

→ Run `/architecture-discovery`. This produces an approved architecture spec before any implementation starts.

### Scenario C: Fresh project, nothing built yet

```
No active plan found.
Theme: web/app/themes/sage — Acorn 4.2
Suggested: start with /sage-design-system to establish tokens, then /architecture-discovery
```

→ Run `/sage-design-system` first if the design tokens and kitchensink page aren't set up. Then proceed to planning.

### Scenario D: Design tools not configured

```
Design tools: none configured
Suggested: configure Paper or Figma MCP (see README Design Tools section) before running /designing
```

→ Configure the relevant MCP server first. See the [README](../../README.md) Design Tools section for install commands.

---

## Step 3 — Check `/sage-status` if Something Seems Off

If Lando containers aren't running or the stack versions look wrong:

```
/sage-status
```

This runs `lando info`, `lando wp core version`, PHP version, Acorn version, Node version, and prints active plan + design tool status — all in ≤ 20 lines.

---

## What Not to Do in a First Session

- **Don't run `/building` without a plan.** The `building` skill reads a plan file; without one it will ask you to create one first.
- **Don't run `/architecture-discovery` if an active plan already exists.** You'll create a second spec that conflicts with the in-progress plan.
- **Don't run `/designing` without a design tool configured.** The skill will detect the missing MCP and stop.
```

- [ ] **Step 2: Verify**

```bash
grep "Scenario\|Step" docs/guide/workflows/first-session.md | wc -l
# Expected: ≥ 7
```

- [ ] **Step 3: Commit**

```bash
git add docs/guide/workflows/first-session.md
git commit -m "docs(guide): add workflows/first-session.md"
```

---

### Task 8: `docs/guide/workflows/implement-feature.md`

**Files:**
- Create: `docs/guide/workflows/implement-feature.md`

- [ ] **Step 1: Create the file**

Write `docs/guide/workflows/implement-feature.md` with this exact content:

```markdown
# Implementing a Feature

This is the primary development loop: discovery → planning → building → review. Each phase has a hard gate — you don't skip to implementation until the previous phase is approved.

---

## The Loop

```
/architecture-discovery
       ↓ (approved spec)
/plan-generator
       ↓ (approved plan)
/building
       ↓ (each component verified)
/reviewing
       ↓ (convention audit passes)
   merge PR
```

---

## Phase 1 — `/architecture-discovery`

**Input:** Describe the feature in natural language. Be specific about what changes vs what stays the same.

```
/architecture-discovery
I need a filterable project portfolio section. It has a grid of project cards, 
a category filter (CPT taxonomy), and a "load more" button that fetches via Livewire.
```

The `sage-architect` agent analyzes the description against the existing codebase and produces an **Architecture Decision Record (ADR)** with:
- Chosen approach and alternatives considered
- Component list with file paths
- Content model (CPT vs ACF vs Options classification)
- Integration points (hooks, routes, Livewire)

**Hard gate:** You review each section of the ADR and approve it before proceeding. The skill will not invoke `/plan-generator` automatically.

---

## Phase 2 — `/plan-generator`

**Input:** The approved ADR from Phase 1 (automatically read from the spec file).

```
/plan-generator
```

Produces a plan directory at `docs/plans/YYYY-MM-DD-<feature>/`:

```
docs/plans/2026-05-28-portfolio-section/
  plan.md          ← status, strategy, component list
  architecture.md  ← the ADR
  content-model.md ← static vs dynamic classification
  assets/          ← design reference images (populated by /designing)
  components/      ← sub-plans per component
  logs/            ← auto-populated by hooks
```

Review `plan.md` before building. Check that:
- Task order is logical (dependencies respected)
- File paths are exact, not approximate
- No "TBD" or "similar to Task N" placeholders

---

## Phase 3 — `/building`

**Input:** The active plan (auto-detected by status: in-progress).

```
/building
```

The skill reads the plan and implements task by task. After each component:
1. Runs verification (`lando php artisan acorn` + `lando theme-build`)
2. Checks for visual drift if a design reference exists
3. Stops for your review before the next task

**If something breaks mid-build:**

Run `/debugging`:
```
/debugging
Getting a Blade syntax error on the portfolio-card component — 
Call to undefined method App\Blocks\PortfolioCard::withFields()
```

The `sage-debugger` agent will diagnose the issue and propose a fix without losing the build context.

**If visual drift is detected:**

Run `/verifying`:
```
/verifying
```

The `visual-verifier` agent captures screenshots via Playwright and compares against `assets/` images in the plan. It reports: match / drift / missing elements.

---

## Phase 4 — `/reviewing`

**Input:** The changed files (auto-detected from git diff, or you specify a path).

```
/reviewing
```

The `sage-reviewer` agent audits against Sage/Acorn conventions:
- ServiceProvider pattern (hooks in `boot()`, not `functions.php`)
- ACF Composer (no GUI-registered field groups)
- Poet for CPTs (no `register_post_type()`)
- Blade conventions (no PHP logic in templates)
- Security: nonces, capabilities, sanitization, escaping
- Tailwind v4: no `@apply` overuse, no arbitrary values that should be tokens

The review produces a pass/fail report per convention. Fix any failures before opening the PR.

---

## Decision Tree

```
Feature request received
        ↓
Is there already an active plan for this?
  YES → /building (read plan, continue)
  NO  →
        Is this a simple isolated change (single file, <2 hours)?
          YES → implement directly, then /reviewing
          NO  → /architecture-discovery → /plan-generator → /building → /reviewing
```

---

## Shortcuts for Simple Changes

For small changes that don't need a full ADR + plan:

```
/reviewing
Review the changes I just made to PortfolioCard.php before I commit.
```

```
/debugging
The `lando theme-build` output shows a Tailwind class not resolving — 
bg-portfolio-gradient undefined.
```

These work standalone — no active plan required.
```

- [ ] **Step 2: Verify**

```bash
grep "Phase\|Step\|hard gate\|↓" docs/guide/workflows/implement-feature.md | wc -l
# Expected: ≥ 10
```

- [ ] **Step 3: Commit**

```bash
git add docs/guide/workflows/implement-feature.md
git commit -m "docs(guide): add workflows/implement-feature.md — full plan-driven loop"
```

---

### Task 9: `docs/guide/workflows/scaffold-block.md`

**Files:**
- Create: `docs/guide/workflows/scaffold-block.md`

- [ ] **Step 1: Create the file**

Write `docs/guide/workflows/scaffold-block.md` with this exact content:

```markdown
# Block Workflows

This guide covers three block scenarios: scaffolding a new block, adding a contact form to a block, and refactoring an existing block.

---

## When to Use Which

| Situation | Skill |
|---|---|
| New block that doesn't exist yet | `/block-scaffolding` |
| Existing block needs new variants, fix drift, or new fields | `/block-refactoring` |
| You have a full feature plan and blocks are components of it | `/building` (auto-invokes `/block-scaffolding` per block) |
| Existing block needs a contact form added | `/block-scaffolding` (Phase 0c) or `/sage-forms` directly |
| Form in an existing block is broken or needs audit | `forms` agent directly |

---

## Scaffolding a New Block

```
/block-scaffolding
```

The skill runs in three phases, stopping for approval between each:

### Phase 0a — Design Reference Extraction

The skill asks which design tool is configured:
- **Paper/Figma/Stitch:** provide the URL — the `design-extractor` agent extracts typography, colors, spacing, and layout into spec files under `docs/plans/.../assets/`
- **Pencil:** provide the `.pen` file path — the `pencil-extractor` agent runs SURGICAL mode on the relevant section
- **No design tool:** provide a description and any screenshots — the skill proceeds with text spec only

Approval gate: confirm the extracted spec matches the design intent before continuing.

### Phase 0b — Content Modeling

The `content-modeler` agent classifies each field in the block:

| Classification | Implementation |
|---|---|
| Static field (text, image, color toggle) | ACF field in the block's Composer class |
| Repeatable items (card list, team members) | ACF Repeater or Flexible Content |
| Globally shared content (company name, social links) | ACF Options Page |
| Related content (related posts, project CPT) | Poet CPT + relationship field |

Approval gate: confirm the content model before the PHP class is generated.

### Phase 0c — Form Detection

The skill checks whether the block description or content model includes a contact/lead form. If detected:

1. Checks if `log1x/sage-html-forms` is installed (`lando theme-composer show log1x/sage-html-forms`)
2. If not installed → installs it: `lando composer require wpackagist-plugin/html-forms && lando theme-composer require log1x/sage-html-forms`
3. Scaffolds the HTML Forms plugin CPT entry, the Blade form view, and the JS validation module alongside the block

This is automatic — you don't need to run `/sage-forms` separately if you start with `/block-scaffolding`.

### Output

After all three phases:
- `app/Blocks/<BlockName>.php` — ACF Composer block class with all fields
- `resources/views/blocks/<block-slug>.blade.php` — block Blade view
- `resources/views/forms/<form-slug>.blade.php` — form view (Phase 0c only)
- `resources/js/blocks/<block-slug>.js` — block custom element JS (if interactive)
- `resources/js/modules/hf-validation.js` — validation module (Phase 0c, if not present)

---

## Adding a Form to an Existing Block

If a block already exists and you need to add a contact form:

```
/sage-forms
Add a contact form to the existing ContactSection block.
```

Or invoke the `forms` agent directly:

```
Use the forms agent to scaffold a contact form for the existing ContactSection block.
```

The `forms` agent:
1. Reads the existing block class and Blade view
2. Adds an `addPostObject` field scoped to the `html-form` CPT
3. Updates the block view to call `hf_get_form($form->ID)->get_html()`
4. Creates the Blade form view at `resources/views/forms/<form-slug>.blade.php`
5. Scaffolds the JS validation module if not present

### Form Integration Traps

Three documented bugs silently break forms in this stack. The `forms` agent checks for all three:

**T1 — `pattern` attribute backslash escaping**  
`$attributes->merge()` double-escapes backslashes; `patternMismatch` never fires.  
Fix: use a JS validator instead of a `pattern` attribute.

**T2 — `type="tel"` skips `patternMismatch` in Chrome**  
Use `type="text" inputmode="tel"` instead.

**T3 — `ValidityState` is non-enumerable**  
`{ ...field.validity }` and `Object.keys(validity)` return empty.  
Fix: access named properties directly — `validity.valueMissing`, `validity.patternMismatch`, etc.

---

## Refactoring an Existing Block

```
/block-refactoring
```

Use this when:
- A block was built with an older pattern and has accumulated drift vs the design
- You need to add new field variants (e.g., a new layout option)
- A v1 block needs to be upgraded to the v2 custom element architecture
- The block's Blade view has grown beyond its intended scope

The skill audits the existing block against current conventions and proposes a refactor plan. It will not rewrite the block — it stages the changes for your approval before writing any file.

**Do not use `/block-refactoring` for:**
- Adding a single new ACF field — do that directly in the Composer class
- Renaming a block — rename the PHP class, Blade view, and update any references manually
- Blocks that are already correct — run `/reviewing` to confirm, not `/block-refactoring`
```

- [ ] **Step 2: Verify**

```bash
grep "Phase\|T1\|T2\|T3\|trap\|Trap\|scaffolding\|refactoring" docs/guide/workflows/scaffold-block.md | wc -l
# Expected: ≥ 8
```

- [ ] **Step 3: Commit**

```bash
git add docs/guide/workflows/scaffold-block.md
git commit -m "docs(guide): add workflows/scaffold-block.md — scaffold, form integration, refactoring"
```

---

### Task 10: Slim `README.md`

**Files:**
- Modify: `README.md`

Context: The current README is 409 lines. Lines 1–233 cover description, prerequisites, installation (5 platforms), design tools, compatibility matrix, and getting started. Lines 234–408 cover the skill decision table, workflow skills, reference skills, agents, hooks, command discovery, plan system, and architectural preferences — all of which have been moved to `docs/guide/`.

- [ ] **Step 1: Read the current README**

```bash
wc -l README.md
# Should be 409 lines
```

- [ ] **Step 2: Replace everything after the Getting Started section**

The README currently ends the "Getting Started" section at line ~233 (after the `/onboarding` block and the plugin-level rules note). Replace everything from line 234 (the `### Which skill do I use?` header) through the end of the file (excluding `## License`) with the new `## Documentation` section.

Final README content from line 234 onward (replace the existing content from `### Which skill do I use?` through `## Architectural Preferences` with this, keeping `## License` at the end):

```markdown
## Documentation

Full usage guide in [`docs/guide/`](docs/guide/):

| File | What it covers |
|---|---|
| [INDEX.md](docs/guide/INDEX.md) | Quick decision table + links to all sections |
| [skills.md](docs/guide/skills.md) | All 19 workflow skills + 17 reference skills + architectural preferences |
| [agents.md](docs/guide/agents.md) | All 11 agents — purpose, invocation, input, output |
| [commands.md](docs/guide/commands.md) | 3 slash commands: `/acf-register`, `/livewire-new`, `/sage-status` |
| [hooks.md](docs/guide/hooks.md) | Session-start behavior, keyword router (32 entries), diagnostics |
| [token-efficiency.md](docs/guide/token-efficiency.md) | How the plugin saves tokens — mechanism and contributor guidance |

### Practical guides

| File | What it covers |
|---|---|
| [workflows/first-session.md](docs/guide/workflows/first-session.md) | What to do in the first session on a new project |
| [workflows/implement-feature.md](docs/guide/workflows/implement-feature.md) | Full plan-driven feature loop from discovery to PR |
| [workflows/scaffold-block.md](docs/guide/workflows/scaffold-block.md) | New block scaffold, form integration, block refactoring |

## License

MIT
```

To apply this change, find the exact line where `### Which skill do I use?` starts in README.md, and replace everything from that line through `## License\n\nMIT` with the content above.

- [ ] **Step 3: Verify the README**

```bash
wc -l README.md
# Expected: ≤ 260 lines (down from 409)
grep "docs/guide/INDEX.md\|docs/guide/skills.md\|docs/guide/agents.md" README.md | wc -l
# Expected: ≥ 3 (links to guide files present)
grep "Which skill do I use\|Workflow Skills\|Reference Skills\|Architectural Preferences" README.md | wc -l
# Expected: 0 (removed sections gone)
grep "Getting Started\|onboarding\|Prerequisites\|Installation" README.md | wc -l
# Expected: ≥ 4 (kept sections still present)
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: slim README to intro+install+links, move detail to docs/guide/"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `docs/guide/INDEX.md` with quick decision table | Task 1 |
| `docs/guide/skills.md` with all 19 workflow + 17 reference skills | Task 2 |
| `docs/guide/agents.md` with all 11 agents (including 5 missing from README) | Task 3 |
| `docs/guide/commands.md` with 3 commands | Task 4 |
| `docs/guide/hooks.md` with keyword router (32 entries) + diagnostics | Task 5 |
| `docs/guide/token-efficiency.md` with before/after + contributor guide | Task 6 |
| `docs/guide/workflows/first-session.md` | Task 7 |
| `docs/guide/workflows/implement-feature.md` | Task 8 |
| `docs/guide/workflows/scaffold-block.md` with traps T1/T2/T3 | Task 9 |
| `README.md` slimmed with `## Documentation` link section | Task 10 |

**Placeholder check:** No TBD, TODO, or "similar to Task N" in any task. All file content is complete.

**Consistency check:** File paths referenced in INDEX.md match the files created in Tasks 1–9. Skill names in skills.md match the keyword router entries in hooks.md. Agent names in agents.md match the actual filenames in `agents/`.
