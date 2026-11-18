---
name: url-inventory
description: Use when the surveyed URLs and their search signals must become a decided inventory - applies the decision rules to propose keep, redirect, gone, noindex or review per URL, carries earlier human decisions over a re-run, and explains each proposal by its rule. For grouping URLs by template use template-map.
license: MIT
compatibility: Node 20+. Reads the run's urls.json and signals.json and the project's config.
---

# URL inventory

Writes `inventory.json`: one row per URL with the live and staging answers, the search signals, a proposed decision with its reason and rule id, and the person's final decision once made.

## When to use

- After the crawl, the HTTP checks and the search signals.
- A rule needs tuning (junk prefixes, tag types, disabled rule) and the proposals must be rebuilt.
- Not for the template grouping (`template-map`) and not for the review itself (`review-board`).

## Inputs required

1. A run with `urls.json`; `signals.json` when available (without it, every URL keeps `clicks` null).
2. Optional config keys: `import_date` (the date of the data import into the new project, used by rule R07), `rules.disable` (rule ids), `rules.junk_prefixes`, `rules.tag_types` (default `post_tag`), `rules.file_ext`, `redirects_csv`.
3. `references/decision-rules.md` for the rule table.
4. The kivo-rebuild plugin root (two levels above this skill's folder).

## Procedure

1. Run `node <root>/scripts/build-inventory.mjs --project=.`. It prints the row count and the count per type and proposed decision.
2. Explain the result with the rules in `references/decision-rules.md`. The first matching rule wins, so a row's `rule_id` says why. R99 (`review`, no rule fits) is the fallback and cannot be disabled.
3. To change behavior, edit the config and re-run:
   - `rules.disable: ["R12"]` skips a rule. Add `rules.junk_prefixes` (`["/test", "/draft"]`) for R08.
   - Approved redirects: a CSV at `redirects_csv` with the columns `source,target,approved`. Only rows with a non-empty `approved` count (rule R01). A missing column is an error, not a silent skip.
4. Redirect targets on the live or staging host are stored as paths (`/new-page/`); a foreign host stays absolute (`https://other.example.test/page`).
5. Re-running keeps what a person decided: `final`, `decided_by`, `note` and `issue`, and the `target` of a row with a `final`. The proposals are recomputed.
6. Proposals are not decisions. Never write `final` yourself. The person sets it through `review-board` or by editing the row, and `export.mjs --what=redirects` exports only rows with `final: redirect`.
7. Show the counts per decision and the largest `review` groups by type, so the person knows where attention is needed.

## Verification

- `node <root>/scripts/validate.mjs --project=.` passes.
- No row has `final` set unless a person set it (compare with the previous `inventory.json` before re-running).
- Every row has a `rule_id` and a `reason`.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `redirects csv needs the columns source, target, approved` | The CSV header differs | Rename the columns; the check is by name, case-insensitive |
| Almost every row is `review` with `no rule fits (staging ?)` | Staging is configured but was not checked | Run the staging check in `site-survey` |
| Tag archives are all `review` | No Search Console data | Run `search-signals`, or decide by hand |
| A redirect target keeps the full live host | The target is on a different host than `live` or `staging` | Expected; only own-host targets become paths |
| A search-only URL and its decision are missing after re-running | Its clicks are now 0 in the signals, and search-only rows are added only with clicks above 0 | Pull the signals for the same period again |

## Escalation

Decisions belong to the person. Ask before disabling a rule that would change many rows, and before treating any `review` row as decided.
