> Historical document from superpowers-sage 2.x. It describes features that were removed or replaced in kivo-wise 3.0 and is kept for reference only.

# Plugin Expansion — Onda 4 Implementation Plan (scoped)

> **Status:** Scoped scaffolding. Expand to full TDD when Onda 3 closes.

**Goal:** Add three specialized subagents that operate in isolated context to offload heavy analysis from the main session.

**Architecture:** Each subagent is a markdown file in `agents/` with trigger-rich description, declared tools, and a clear operational checklist. Subagents are invoked via the Task tool by the main agent when the user's task matches.

**Tech Stack:** Markdown, YAML frontmatter, standard agent tool allowlist pattern.

**Source spec:** `docs/superpowers/specs/2026-04-18-plugin-expansion-design.md`
**Prerequisite:** Onda 2 done for `4.1` (migration agent references refactored Acorn skills); Onda 1 done for `4.3` (livewire-debugger references refactored livewire skill).

---

## Microplan scope

| ID | Agent | Purpose | Tools |
|---|---|---|---|
| 4.1 | `agents/acorn-migration.md` | Analyze procedural legacy WP plugin code, propose incremental migration to Acorn (Service Providers, Facades, Eloquent) | Read, Grep, Glob, Bash |
| 4.2 | `agents/tailwind-v4-auditor.md` | Scan project for Tailwind v3 legacy syntax, generate migration plan to `@theme`/`@utility` | Read, Grep, Glob |
| 4.3 | `agents/livewire-debugger.md` | Diagnose components that fail to mount/update: component + view + Alpine bindings + network | Read, Grep, Bash |

## Quality bar

**B**. Each agent ships with:
- Trigger-rich YAML description (audited per 2.5 standards).
- Operational checklist in the body (explicit steps).
- Tool allowlist minimally scoped.
- One manual eval scenario per agent documented in `agents/__evals__/<agent>.md`.

## Dependencies

- 4.1 references skills refactored in Onda 1 + 2 (acorn-routes, acorn-eloquent, acorn-middleware).
- 4.3 references `acorn-livewire` refactor from 1.3.
- 4.2 is independent and can run first.

## Success criteria

- Each agent invokable via Task tool with a fixture prompt and returns structured output.
- No agent loads more than its stated references (verify via trace of Read calls during eval).
- Cross-platform: Cursor and Claude Code both can invoke each agent.

## Handoff note

Expand each microplan here with agent-body checklists + eval scenarios when Onda 3 closes.
