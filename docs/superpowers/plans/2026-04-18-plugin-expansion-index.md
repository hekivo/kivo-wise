> Historical document from superpowers-sage 2.x. It describes features that were removed or replaced in kivo-wise 3.0 and is kept for reference only.

# Plugin Expansion — Master Index

> **For agentic workers:** This is the orchestrator index. Execution plans live per-wave in `2026-04-18-plugin-expansion-onda-N.md`. Use superpowers:subagent-driven-development or superpowers:executing-plans per wave file. Track wave-level progress here.

**Goal:** Evolve `superpowers-sage` plugin across six sequential waves (~28 microplans) to reduce token baseline, increase determinism, and integrate with the official Roots/WP AI stack (Acorn AI + WP MCP Adapter).

**Architecture:** Three parallel axes — (1) skills optimization via progressive disclosure, (2) deterministic layer via hooks/commands/CLAUDE.md, (3) AI-native integration with Acorn AI + WP MCP Adapter.

**Tech Stack:** Claude Code plugin format, bash hooks, Node scripts (`.mjs`), Lando for WordPress runtime, Composer for Acorn AI installation, Laravel AI SDK, WordPress 6.9 Abilities API.

**Source spec:** `docs/superpowers/specs/2026-04-18-plugin-expansion-design.md`

---

## Wave execution status

| Wave | Plan file | Microplans | Status |
|---|---|---|---|
| 1 — Foundation + token savings | [onda-1](2026-04-18-plugin-expansion-onda-1.md) | 6 | Done — [validation](2026-04-18-onda-1-validation.md) |
| 2 — Progressive disclosure | [onda-2](2026-04-18-plugin-expansion-onda-2.md) | 8 | Done |
| 3 — New deterministic capabilities | [onda-3](2026-04-18-plugin-expansion-onda-3.md) | 6 | Done |
| 4 — Specialized subagents | [onda-4](2026-04-18-plugin-expansion-onda-4.md) | 4 | Done |
| 5 — AI-native integration | [onda-5](2026-04-18-plugin-expansion-onda-5.md) | 5 | Done |
| 6 — Hardening from field feedback | [onda-6](2026-04-18-plugin-expansion-onda-6.md) | 5 | Done |

---

## Full microplan index

### Onda 1 — Fundação + economia imediata de tokens

| ID | Title | Quality bar | Depends on |
|---|---|---|---|
| 1.1 | `CLAUDE.md` plugin-level | B | — |
| 1.2 | Refactor `acorn-middleware` (817 L) | B | 1.1 |
| 1.3 | Refactor `acorn-queues` (745 L) + `acorn-livewire` (744 L) | B | 1.1 |
| 1.4 | Refactor `acorn-routes` (672 L) + `acorn-eloquent` (597 L) | B | 1.1 |
| 1.5 | Refactor `block-scaffolding` (547 L) + `wp-performance` (505 L) | B | 1.1 |
| 1.6 | Cross-wave validation + token measurement | C | 1.2–1.5 |

### Onda 2 — Progressive disclosure geral

| ID | Title | Quality bar | Depends on |
|---|---|---|---|
| 2.1 | Acorn-\* restantes (`acorn-commands`, `acorn-redis`, `acorn-logging`) | B | 1.6 |
| 2.2 | WP-\* family (cli-ops, hooks-lifecycle, phpstan, rest-api, security, capabilities, block-native) | B | 1.6 |
| 2.3 | Workflow skills (building, architecting, discovery, plan-generator, designing, verifying, reviewing, debugging, modeling, onboarding, install-plugin, migrating) | B | 1.6 |
| 2.4 | Support skills (sageing, sage-lando, sage-design-system, block-refactoring) | B | 1.6 |
| 2.5 | YAML trigger-richness audit (all 34 skills) | B | 2.1–2.4 |
| 2.6 | Shared template `templates/skill-references/` | B | — |
| 2.7 | Shared template `templates/skill-scripts/` | B | — |
| 2.8 | `validate-skills.mjs` extension (500L limit + references presence check) | B | 2.6, 2.7 |

### Onda 3 — Capacidades novas determinísticas

| ID | Title | Quality bar | Depends on |
|---|---|---|---|
| 3.1 | Slash commands (`sage-status`, `acf-register`, `livewire-new`) | C | 1.1 |
| 3.2 | Hook `UserPromptSubmit` (skill activation) | C | — |
| 3.3 | Hook `Stop` quality gate (PHPCS/ESLint block) | C | — |
| 3.4 | Hook `PreToolUse` protected paths | C | — |

### Onda 4 — Subagents especializados

| ID | Title | Quality bar | Depends on |
|---|---|---|---|
| 4.1 | `agents/acorn-migration.md` | B | 2.x refactors |
| 4.2 | `agents/tailwind-v4-auditor.md` | B | — |
| 4.3 | `agents/livewire-debugger.md` | B | acorn-livewire refactor (1.3) |

### Onda 5 — AI-native integration

| ID | Title | Quality bar | Depends on |
|---|---|---|---|
| 5.1 | `scripts/detect-ai-readiness.mjs` | C | — |
| 5.2 | `/ai-setup` skill (guided install) | C | 5.1 |
| 5.3 | Template `.mcp.json` + generator | C | 5.1 |
| 5.4 | Skill `abilities-authoring` | C | 5.2 |
| 5.5 | Query-first integration in existing skills | B | 5.2, 5.3, 2.1–2.4 |

### Onda 6 — Hardening from field feedback

| ID | Title | Quality bar | Depends on |
|---|---|---|---|
| 6.1 | `block-refactoring` Phase 0b — shared component inventory | B | 2.4 |
| 6.2 | `block-refactoring` G7 → CRITICAL + Decision Log + localization reference | B | 6.1 |
| 6.3 | `acorn-migration` — two-level key migration + second pass + WP-CLI positional args | B | 4.1 |
| 6.4 | `sage-reviewer` — R-css-vars / R-component-reuse / R-nl2br checks | B | 4.x |
| 6.5 | Gotchas corpus — `load_textdomain`, `wptexturize`, ACF Composer gotchas | B | 2.x |

---

## Dependency graph

```
1.1 ──┬─▶ 1.2 ─┐
      ├─▶ 1.3 ─┤
      ├─▶ 1.4 ─┼─▶ 1.6 ─▶ 2.1–2.4 ─┬─▶ 2.5
      ├─▶ 1.5 ─┘                    ├─▶ 2.8 (needs 2.6, 2.7)
      └─▶ 3.1

2.6 ─┐
2.7 ─┴─▶ 2.8

3.2, 3.3, 3.4  (independent, no prereqs)

4.1 ◀── 2.x refactors
4.2  (independent)
4.3 ◀── 1.3 (livewire refactor)

5.1 ──┬─▶ 5.2 ──┬─▶ 5.4
      └─▶ 5.3 ──┴─▶ 5.5 ◀── 2.1–2.4

6.1 ◀── 2.4
6.2 ◀── 6.1
6.3 ◀── 4.1
6.4 ◀── 4.x
6.5 ◀── 2.x
```

---

## Quality gates between waves

Before moving to the next wave:

1. All microplans in current wave marked `status: done` in their headers.
2. `scripts/validate-skills.mjs` passes cleanly.
3. Cross-platform smoke test (Claude Code + Cursor; VS Code optional).
4. `CHANGELOG.md` updated via release-please flow.
5. For Onda 1 and 5 (which have quality bar C final step): token measurement captured and documented.

## How to consume this index

- Waves 1–5 are Done. Wave 6 is ready for execution (full TDD).
- Each wave file (`onda-N.md`) follows the full writing-plans TDD format.
- When a wave is expanded, update its row in the table above from `Scoped` to `Ready (full TDD)` and link the filled-in plan file.
