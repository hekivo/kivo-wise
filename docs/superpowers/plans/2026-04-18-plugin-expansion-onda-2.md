> Historical document from superpowers-sage 2.x. It describes features that were removed or replaced in kivo-wise 3.0 and is kept for reference only.

# Plugin Expansion — Onda 2 Implementation Plan (scoped)

> **Status:** Scoped scaffolding. Full TDD breakdown is generated when Onda 1 closes (see completion criteria in `2026-04-18-plugin-expansion-onda-1.md`).

**Goal:** Apply progressive-disclosure pattern (references/scripts/assets) to the 27 skills not covered by Onda 1, audit all 34 YAML descriptions for trigger-richness, and upgrade `validate-skills.mjs` to enforce the structure.

**Architecture:** Same pattern established by Onda 1, generalized to lower-priority skills. Shared templates (`templates/skill-references/`, `templates/skill-scripts/`) centralize boilerplate to avoid divergence across skills.

**Tech Stack:** Markdown, bash, Node (`.mjs`), templates.

**Source spec:** `docs/superpowers/specs/2026-04-18-plugin-expansion-design.md`
**Prerequisite:** Onda 1 done + `onda-1-validation.md` published.

---

## Microplan scope

| ID | Target | Outputs |
|---|---|---|
| 2.1 | `acorn-commands`, `acorn-redis`, `acorn-logging` | `references/`, `scripts/`, `assets/` per skill |
| 2.2 | `wp-cli-ops`, `wp-hooks-lifecycle`, `wp-phpstan`, `wp-rest-api`, `wp-security`, `wp-capabilities`, `wp-block-native` | Same |
| 2.3 | `building`, `architecting`, `architecture-discovery`, `plan-generator`, `designing`, `verifying`, `reviewing`, `debugging`, `modeling`, `onboarding`, `install-plugin`, `migrating` | References focused; scripts only where truly deterministic (workflow skills are orchestrators) |
| 2.4 | `sageing`, `sage-lando`, `sage-design-system`, `block-refactoring` | References + scripts where applicable |
| 2.5 | YAML trigger-richness audit (all 34 skills) | Report in `docs/superpowers/plans/onda-2-yaml-audit.md` + per-skill rewrites |
| 2.6 | `templates/skill-references/` | Shared boilerplate for `references/*.md` structure |
| 2.7 | `templates/skill-scripts/` | Shared Lando-wrapper script boilerplate |
| 2.8 | `validate-skills.mjs` extension | Check 500L limit (already warn, now error for known-family skills) + require `references/` for skills ≥ 300 linhas |

## Quality bar

**B** across all microplans in this wave. No runtime/infra, all markdown + small scripts.

## Dependencies

- Prereq: 1.6 (validation + measurement baseline exists).
- 2.6 and 2.7 are independent and can run first (they unblock template adoption in 2.1–2.4).
- 2.8 depends on 2.6, 2.7 (validator references the templates).
- 2.5 (YAML audit) runs alongside the family refactors and concludes with the report.

## Success criteria (when expanded to full TDD)

- All 27 remaining skills have at least `references/` populated.
- Shared templates adopted by ≥ 80% of refactored skills.
- YAML descriptions audit report published with before/after diffs.
- `validate-skills.mjs` enforces the structural rules.
- Additional 10–15% token reduction on session-padrão (cumulative with Onda 1).

## Handoff note

When Onda 1 completes, run: "Expand the Onda 2 plan file from scoped to full TDD format, following the pattern established in Onda 1." The subagent should produce microplan-by-microplan task breakdowns mirroring 1.2–1.5 granularity.
