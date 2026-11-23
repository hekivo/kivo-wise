---
name: parity-audit
description: Use when every legacy feature must be classified against the new project - dispatches one auditor per domain, each citing file and line in the new project as evidence, merges the results into a validated parity list, and surfaces the gaps by priority with owners. For listing the legacy features first use legacy-features.
license: MIT
compatibility: Node 20+. Read access to the new project's code and to any plan or decision files. kivo-kion is optional for turning gaps into questions.
---

# Parity audit

Writes `parity.json`: for each feature in `features.json`, a class (`done`, `partial`, `missing-planned`, `missing-not-planned`, `dropped`, `data-only`), a priority (`P0` to `P3`), where it lives in the new project, an owner and a note.

## When to use

- After `legacy-features` produced `features.json`.
- The new project changed and the audit must be redone for some domains.
- Not for listing legacy features (`legacy-features`).

## Inputs required

1. `features.json` for the run.
2. The new project's path (the project root) and, when present, its plan and decision files.
3. `references/classes.md`: the classes, the priority rules and the evidence each class needs.
4. The kivo-rebuild plugin root (two levels above this skill's folder; in a project copy of the skills, the hidden `.kivo-rebuild/` folder beside the skill folders).

## Procedure

1. Group the feature areas into domains: storefront, checkout, content, integrations, tracking, infrastructure. Every area belongs to exactly one domain.
2. Dispatch one `parity-auditor` agent per domain, in parallel. Give each the features of its areas, the project path, the plan and decision files, and the content of `references/classes.md`. Each writes `.rebuild/runs/<id>/fragments/parity/<domain>.json` with one item per feature of its areas.
3. Merge: `node <root>/scripts/merge.mjs --project=. --kind=parity`. It must not report `not audited`, `unknown feature` or `duplicate`. Fix by sending the missing features back to the auditor of that domain.
4. Check a sample of `done` items yourself: open the cited `file:line` and confirm it does what the legacy feature did. Reclassify as `partial` what does not.
5. **Stop.** Show the gaps: `missing-not-planned` first, then `partial`, ordered P0 to P3, with the owner field. Ask the person who owns each P0 and P1.
6. With kivo-kion in the project, offer `node <root>/scripts/kion-bridge.mjs questions --project=. --kion=<path to kion.mjs>` (dry run lists the questions; `--apply` only after the person agrees; texts already in the kion store are skipped).
7. Offer the markdown report: `node <root>/scripts/export.mjs --project=. --what=parity --out=<path outside .rebuild>`.

## Verification

- `merge.mjs` prints `parity: N items from M fragments` where N equals the number of features.
- Every `done` and `partial` item has a `location` with a file and line in the new project.
- Every `missing-planned` item names the plan reference, and every `dropped` item names the decision.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `not audited: F-...` | An auditor skipped a feature | Send that feature to the auditor of its domain |
| `unknown feature F-... in x.json` | The auditor invented or mistyped an id | Correct the id against `features.json` |
| `duplicate F-... in a.json and b.json` | Two domains claimed the same area | Remove it from one fragment |
| `$.items[0].class: "..." not in [...]` | A class outside the six | Use the names in `references/classes.md` |
| Many `partial` with no note | The auditor was unsure and did not say why | Ask for the reason; when unsure the rule is to pick the worse class and explain |
| `parity.json and features.json are required` | The bridge ran before both merges | Merge features, then parity |

## Escalation

Priorities P0 and P1 need a named owner from the person before the audit is called finished. Ask before marking a feature `dropped`: only a recorded decision supports it.
