---
name: legacy-features
description: Use when the features of a legacy WordPress site must be listed before they can be audited against the new project - splits the legacy code and options into areas, dispatches one read-only agent per area, merges their fragments into one validated feature list, and seeds it from a kivo-kion inventory when one exists. For classifying each feature use parity-audit.
license: MIT
compatibility: Node 20+. Read access to the legacy code and, optionally, a local clone of its database (SELECT only). kivo-kion is optional.
---

# Legacy features

Writes `features.json`: one item per behavior the legacy site gives to visitors, editors or integrations, with its source and evidence.

## When to use

- After the first review stop of `rebuild`, or whenever the person asks what the old site does.
- Not for judging whether the new project has the feature (`parity-audit`).

## Inputs required

1. `legacy` in the config: the path to the legacy code (read only).
2. A run folder.
3. Optional: a local database clone name and how to query it read only.
4. `references/wordpress-areas.md` for the areas and what to look for in each.
5. The kivo-rebuild plugin root (two levels above this skill's folder).

## Procedure

1. With a kivo-kion store in the project (`.kion/inventory.json`), run `node <root>/scripts/kion-bridge.mjs seed --project=.` first. It writes `fragments/features/kion.json` from the kion items that are not marked `remove`, with ids built from the names.
2. Split the legacy into areas using `references/wordpress-areas.md`. Name each area in lowercase kebab case (`checkout`, `theme-options`).
3. Dispatch one `legacy-area-inventory` agent per area, in parallel. Give each the legacy path, the area name, the checklist section for the area, the output file `.rebuild/runs/<id>/fragments/features/<area>.json`, the database access if any, and the ids already seeded for that area so it does not repeat them.
4. Merge: `node <root>/scripts/merge.mjs --project=. --kind=features`. It validates every fragment on its own, names the file that fails, and writes `features.json`.
5. Duplicate ids make the merge fail and list both files. Keep one item, delete the other from its fragment, and merge again.
6. Show the number of features per area, and the areas with none (a likely miss).

## Verification

- `merge.mjs` prints `features: N items from M fragments` and `validate.mjs` passes.
- Every item has a `source` the person can open and an `evidence` line.
- The legacy code and the database are untouched (`git status` in the legacy folder is clean).

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `duplicate F-... in a.json and b.json` | Two agents or the kion seed listed the same feature | Delete one item, merge again |
| `a.json: $.items[0].id: does not match ^F-[a-z0-9-]+$` | The id has capitals, spaces or no `F-` prefix | Use `F-` plus lowercase letters, digits and hyphens |
| `a.json: $.items[0].foo: not allowed` | The agent added a field the schema does not define | Remove the field; the item keys are `id`, `area`, `name`, `source`, `behaviour`, `evidence`, `data` |
| `kion inventory does not fit the features schema` | A kion item lacks a field the schema requires, or its id is not `INV-` plus digits | Fix the kion item, or skip the seed |
| An area returns no items | The agent looked in the wrong path | Check the area's checklist and the legacy path, run that agent again |
| `no fragments in ...` | The agents have not written their files | Check the output paths in the prompts |

## Escalation

The legacy code and its database are read only: SELECT on a local clone, never on a production database. Ask before connecting to any database the person did not name. Agents write `<redacted>` for values that look like keys or tokens.
