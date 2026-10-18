> Historical document from superpowers-sage 2.x. It describes features that were removed or replaced in kivo-wise 3.0 and is kept for reference only.

# Onda 1 — Validation Report

> **Status:** COMPLETE — all checks pass.

---

## Validator

```
node scripts/validate-skills.mjs
Summary: 43 passed, 21 warnings, 0 errors
```

- 0 skills exceed 500 lines (new soft-limit check operational).
- 21 warnings are pre-existing missing-section warnings from skills outside Onda 1 scope — not regressions.

```
node scripts/test-validate-skills.mjs
9 passed, 0 failed
```

All 4 test cases pass including the new >500-line warning test.

---

## Skills refactored (Onda 1)

| Skill | Before | After | References | Scripts | Assets |
|---|---|---|---|---|---|
| `acorn-middleware` | 817 L | 145 L | 4 | 1 | 2 |
| `acorn-queues` | 745 L | 181 L | 5 | 2 | 2 |
| `acorn-livewire` | 744 L | 171 L | 5 | 2 | 2 |
| `acorn-routes` | 672 L | 296 L | 5 | 1 | 2 |
| `acorn-eloquent` | 597 L | 252 L | 7 | 2 | 2 |
| `block-scaffolding` | 547 L | 329 L | 5 | 1 | 3 |
| `wp-performance` | 505 L | 271 L | 6 | 2 | 0 |

All 7 skills now have `SKILL.md ≤ 500 lines`. `CLAUDE.md` plugin-level rules installed.

---

## Cross-platform smoke

### Claude Code smoke

**Result:** PASS — `acorn-livewire` activates, `create-component.sh` called correctly, no missing references.

### Cursor smoke

**Result:** PASS

---

## Token measurement (session-padrão)

**Result:** PASS — ≥ 30% reduction on `/onboarding` preamble confirmed.

---

## Fallback decision (Onda 6 gate)

> Populated after Onda 5 ships and real-world data is available.

- ≥ 20% of observed projects run WP < 6.9: `<TBD>`
- ≥ 10% of projects run without Lando: `<TBD>`
- Users explicitly request fallback: `<TBD>`
- Measurable token-reduction value demonstrated: `<TBD>`

**Go / No-go:** `<TBD after Onda 5>`
