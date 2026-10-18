> Historical document from superpowers-sage 2.x. It describes features that were removed or replaced in kivo-wise 3.0 and is kept for reference only.

# Usage Guide Design

**Goal:** Produce a complete, practical usage guide for `superpowers-sage` as a `docs/guide/` directory, and slim the README down to an introduction + link hub. Covers all features present as of v2.9.0 plus the token-optimization changes made on 2026-05-28.

**Architecture:** README becomes a ≤ 150-line entry point (what it is, install, compatibility, links). `docs/guide/` holds six reference files and a `workflows/` subdirectory with three task-oriented how-to guides. No content is duplicated between files.

**Audience:** Developers using the plugin in their own Sage/Acorn/Lando projects. Assumes familiarity with Roots ecosystem basics; does not re-explain WordPress or Blade fundamentals.

**Language:** English (US).

---

## File Inventory

### README.md (modified — slim down)

Remove:
- "Which skill do I use?" decision table (moves to `docs/guide/skills.md`)
- Workflow Skills table (moves to `docs/guide/skills.md`)
- Reference Skills prose section (moves to `docs/guide/skills.md`)
- Agents table (moves to `docs/guide/agents.md`)
- Hooks table + diagnostics section (moves to `docs/guide/hooks.md`)
- Command Discovery table (moves to `docs/guide/commands.md`)
- Plan System section (moves to `docs/guide/skills.md` or `INDEX.md`)
- Architectural Preferences table (moves to `docs/guide/skills.md`)

Keep:
- Plugin description (first paragraph)
- Prerequisites table
- Installation (all 5 sections: Claude Code, VS Code, Cursor, Codex, Local/Generic)
- Design Tools + design tool routing table + Pencil conventions
- Compatibility Matrix
- Getting Started (`/onboarding` first step)

Add:
- `## Documentation` section pointing to `docs/guide/INDEX.md` with one-line descriptions per guide file

Target: ≤ 160 lines.

---

### `docs/guide/INDEX.md`

Content:
- One paragraph: what the plugin provides (skills, agents, hooks, commands)
- Quick-reference table: Component | Reference | Practical guide
- Compact decision tree (same as current README "Which skill do I use?") updated to include all missing skills
- Links to all 6 reference files + 3 workflow guides

---

### `docs/guide/skills.md`

Two sections:

**Workflow Skills** — table with columns: `Skill | Invoke with | When to use | Key triggers (keyword router)`.

All 19 user-invocable workflow skills, including the ones currently missing from README:
- `/onboarding`
- `/architecture-discovery`
- `/plan-generator`
- `/architecting` (alias)
- `/modeling`
- `/designing`
- `/building`
- `/block-scaffolding` ← missing from README
- `/block-refactoring` ← missing from README
- `/sage-design-system` ← missing from README
- `/verifying`
- `/reviewing`
- `/debugging`
- `/migrating` ← missing from README
- `/sage-forms` ← missing from README
- `/ai-setup` ← missing from README
- `/abilities-authoring` ← missing from README
- `/install-plugin`
- `/sageing` (meta — skill routing)

**Reference Skills** — table with columns: `Skill | Domain | Invoked when`. Grouped:
- Acorn ecosystem: `acorn-livewire`, `acorn-eloquent`, `acorn-queues`, `acorn-middleware`, `acorn-redis`, `acorn-logging`, `acorn-routes`, `acorn-commands`
- WordPress core: `wp-hooks-lifecycle`, `wp-rest-api`, `wp-capabilities`, `wp-security`, `wp-performance`, `wp-cli-ops`, `wp-phpstan`, `wp-block-native`
- Theme + tooling: `sage-lando`, `sage-forms`

**Architectural Preferences** — the existing table from README (preserved here, removed from README).

---

### `docs/guide/agents.md`

All 11 agents, two columns: core agents + specialist agents.

Table columns: `Agent | Invoked by | Purpose | Input | Output`.

**Core agents (6):**
- `sage-architect` — invoked by `/architecture-discovery`; produces Architecture Decision Records
- `sage-reviewer` — invoked by `/reviewing`; audits conventions
- `sage-debugger` — invoked by `/debugging`; systematic diagnostics
- `content-modeler` — invoked by `/modeling`; classifies content (static/CPT/Options/relational)
- `visual-verifier` — invoked by `/verifying`; compares screenshots to design reference
- `pencil-extractor` — invoked by `/designing` for `.pen` files

**Specialist agents (5) — currently missing from README:**
- `design-extractor` — invoked by `/designing` for Paper/Figma/Stitch; PANORAMIC + SURGICAL modes
- `forms` — invoked by `/sage-forms` or directly; audits + scaffolds HTML Forms integrations; covers traps T1/T2/T3
- `livewire-debugger` — invoked by `/debugging` for Livewire issues; diagnoses mount failures, 419 CSRF errors, Alpine conflicts
- `acorn-migration` — invoked by `/building` for legacy theme migration; produces phased migration plan
- `tailwind-v4-auditor` — invoked by `/reviewing`; audits Tailwind v4 syntax, CSS variable cascade, arbitrary values

---

### `docs/guide/commands.md`

What slash commands are (distinct from skills — they run a fixed script, not an interactive skill).

Three commands documented with: what it does, when to run it, example output.

- **`/acf-register`** — registers a new ACF field group class from a prompt; scaffolds the PHP class skeleton
- **`/livewire-new`** — creates a new Livewire component (PHP class + Blade view) with correct Sage paths
- **`/sage-status`** — prints a health summary: Lando status, Acorn boot, active plans, cache state

---

### `docs/guide/hooks.md`

**SessionStart hook:**
- What fires: `hooks/session-start.sh`
- What it injects: compact routing table (~1,284 chars) — not the full `sageing` skill
- Previous behavior: injected entire `sageing/SKILL.md` (18,622 chars) on every session — now replaced
- Side effects: health check, design tool detection, active plan injection

**UserPromptSubmit hook (keyword router):**
- What fires: `hooks/user-prompt-activate.sh`
- Logic: scans prompt for keywords from 32-entry map; if exactly 1 match → injects `additionalContext` hint pointing to that skill; if 0 or 2+ matches → silent
- Complete keyword-to-skill map (all 32 entries, grouped by category)
- Why silent on 2+ matches: avoids injecting the wrong skill when intent is ambiguous

**Other hooks (reference table):**
- `post-edit` — `lando flush` for PHP, `lando theme-build` for assets
- `post-compact` — re-injects active plan path after context compression
- `pre-commit` — visual verification reminder
- `post-subagent` — logs activity to plan directory
- `post-stop` — logs session end

**Sync requirement:** `hooks/hooks.json` and `hooks/cursor-hooks.json` must stay in sync via `scripts/sync-cursor-hooks.mjs`. The CI job enforces this.

**Diagnostics:** Keep the existing diagnostics section from README (doctor-hooks.sh, debug env vars, warning table) — just move it here.

---

### `docs/guide/token-efficiency.md`

**The problem before:** `session-start.sh` read and injected the entire `sageing/SKILL.md` (18,622 chars, 270 lines) as `<EXTREMELY_IMPORTANT>` context on every session start — regardless of what the user asked. Plus, the skill's description said "read this first in any session," causing Claude to invoke it again via the Skill tool.

**The solution (2026-05-28):**
1. `session-start.sh` now injects a 20-line compact routing table (~1,284 chars) — **93% reduction**
2. `user-prompt-activate.sh` keyword router covers 32 skill/keyword pairs — skills load on demand only when the prompt matches
3. Skill descriptions updated with `Invoke for:` / `Skip when:` to prevent over-activation

**How skill activation works:**
- Claude's `using-superpowers` base skill has a 1% threshold — if there's a 1% chance a skill applies, it must be invoked
- The `Invoke for:` / `Skip when:` pattern in each skill's description gives Claude enough signal to skip skills that don't apply
- The keyword router provides an early, cheap match before the LLM reasons about skill relevance

**For plugin contributors:** When adding a new skill, always write `Invoke for:` and `Skip when:` in its description frontmatter. Without these, the 1% rule causes the skill to be loaded speculatively in almost every session.

---

### `docs/guide/workflows/first-session.md`

Step-by-step: what to do in the very first session on a new Sage project.

1. Run `/onboarding` — what it outputs, what to look for
2. Read the output: stack detection, design tools, active plans, suggested next steps
3. If a plan exists: run `/building` directly
4. If no plan exists: decide between `/architecture-discovery` (full discovery) vs starting with `/modeling` (content-first)
5. Example: a real session transcript skeleton

---

### `docs/guide/workflows/implement-feature.md`

The full plan-driven development loop:

1. `/architecture-discovery` — what input to give, what sections to approve, what the ADR contains
2. `/plan-generator` — converts approved spec into plan files; what files it creates
3. Review the plan before building (what to check)
4. `/building` — how it executes tasks, when it stops for approval, what auto-verification does
5. Mid-build: `/debugging` if something breaks, `/verifying` if visual drift detected
6. `/reviewing` before PR — what it checks, what it produces
7. Decision tree: when to loop back vs proceed

---

### `docs/guide/workflows/scaffold-block.md`

Block lifecycle from new scaffold to evolved component:

1. **New block:** `/block-scaffolding` — three phases:
   - Phase 0a: design reference extraction (Paper/Figma/Stitch/Pencil)
   - Phase 0b: content modeling (ACF fields, CPT vs static)
   - Phase 0c: form detection (if block embeds a contact form → triggers `sage-forms` integration)
2. **Block with form:** how the `forms` agent integrates with the HTML Forms plugin; traps T1/T2/T3
3. **Evolving an existing block:** `/block-refactoring` — when to use it vs re-scaffolding
4. Decision table: `/block-scaffolding` vs `/block-refactoring` vs `/building`

---

## Self-Review Notes

- No content duplicated between README and guide files
- README keeps installation complete (all 5 platforms) — that content doesn't belong in the guide
- Agents table includes all 11 with accurate descriptions (5 were missing from README)
- Token efficiency file explains the mechanism clearly enough for contributors to maintain it
- All 3 workflow guides use concrete step-by-step structure, not just prose
- Placeholder check: no TBD/TODO items — all sections have defined content
- Scope: this is one docs update, not multiple sub-projects

---

## Implementation Plan

Write via `superpowers:writing-plans`.
