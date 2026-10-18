> Historical document from superpowers-sage 2.x. It describes features that were removed or replaced in kivo-wise 3.0 and is kept for reference only.

# Plugin Expansion — Onda 3 Implementation Plan (scoped)

> **Status:** Scoped scaffolding. Expand to full TDD when Onda 2 closes.

**Goal:** Deliver new deterministic capabilities on top of the refactored skill base — slash commands, skill-activation hook, quality-gate Stop hook, and protected-paths PreToolUse hook.

**Architecture:** Move soft-instruction behaviors from markdown to shell-script hooks and command files. Each hook is a small bash script that reads stdin JSON from the harness, produces either stdout context injection or a structured block decision, and stays cross-platform (Claude Code + VS Code + Cursor via `sync-cursor-hooks.mjs`).

**Tech Stack:** Bash, Node for JSON parsing where sensible, `jq`, existing `hooks.json` / `cursor-hooks.json` structure.

**Source spec:** `docs/superpowers/specs/2026-04-18-plugin-expansion-design.md`
**Prerequisite:** Onda 1 done (for `CLAUDE.md` referenced by commands). Onda 2 done preferred (commands leverage refactored skills).

---

## Microplan scope

| ID | Target | Key files |
|---|---|---|
| 3.1 | Slash commands | `commands/sage-status.md`, `commands/acf-register.md`, `commands/livewire-new.md` |
| 3.2 | Hook `UserPromptSubmit` (skill activation by keyword) | `hooks/user-prompt-activate.sh`, update `hooks/hooks.json` + `cursor-hooks.json` |
| 3.3 | Hook `Stop` quality gate | Refactor `hooks/post-stop.sh` to run `lando phpcs` / `lando lint`; env flag `SUPERPOWERS_SAGE_QUALITY_GATE=strict|warn|off` |
| 3.4 | Hook `PreToolUse` protected paths | `hooks/pre-write-protected.sh`, matcher `Write|Edit`, blocks `.env`, `wp-config.php`, `bedrock/config/environments/`, `trellis/group_vars/*/vault.yml` |

## Quality bar

**C** across all microplans (runtime/infra). Each hook ships with:
- Unit test in `scripts/test-hooks.mjs` (added as part of this wave).
- Integration test: fixture stdin JSON → expected stdout/exit code.
- Cross-platform smoke in Cursor.

## Dependencies

- 3.1 depends on 1.1 (`CLAUDE.md` referenced by `sage-status`).
- 3.2, 3.3, 3.4 are independent of each other and can run in parallel after Onda 2.
- All three new hooks require `sync-cursor-hooks.mjs` update in the same PR.

## Success criteria

- `/sage-status` reports Lando health + stack versions + active plan + design tools detected, all in ≤ 20 linhas of output.
- `/acf-register` produces a field-group scaffold via `lando acorn acf:field` and writes the PHP file.
- `/livewire-new` invokes the refactored `acorn-livewire/scripts/create-component.sh`.
- `UserPromptSubmit` hook reduces `/onboarding` preamble tokens by additional 15–25% when a single-skill keyword matches.
- `Stop` quality gate blocks completion with structured JSON `{"decision": "block", "reason": "..."}` when PHPCS has errors, and warns (no block) when `SUPERPOWERS_SAGE_QUALITY_GATE=warn`.
- `PreToolUse` hook produces stderr message + exit 2 for every protected path fixture.

## Handoff note

After Onda 2, expand each microplan here to full TDD with test fixtures in `scripts/__fixtures__/hooks/`.
