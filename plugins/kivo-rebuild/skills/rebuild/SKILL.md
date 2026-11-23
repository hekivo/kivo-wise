---
name: rebuild
description: Use when the person runs the rebuild command to survey a live WordPress site before or during its rebuild on the Roots stack - connects sources, crawls the sitemap, joins search signals, proposes a decision per URL, groups URLs by template, then (after review) inventories legacy features and audits parity. Resumes with --run=. For one step on its own use connect, site-survey, search-signals, url-inventory, template-map, legacy-features, parity-audit or review-board.
disable-model-invocation: true
license: MIT
compatibility: Requires the kivo-wise plugin (stack detection, runner). Node 20+. Optional - gcloud, gh, op, Playwright in the project, kivo-kion.
---

# /rebuild

Arguments: `<live-url> [--legacy=<path>] [--staging=<url>]` or `--run=<run id>` (the folder name under `.rebuild/runs/`, for example `2026-01-02-acme`).

## When to use

- The person typed the command with a live URL or a run id.
- Never start it on your own; each step has its own skill.

## Inputs required

1. The live site URL (or `live` in `.rebuild/config.json`).
2. Optional: the legacy code path (needed from step 5), the staging URL and its access reference.
3. `.roots-stack.json` from kivo-wise (`/roots-detect --write` when missing) for template paths.
4. The kivo-rebuild plugin root (two levels above this skill's folder; in a project copy of the skills, the hidden `.kivo-rebuild/` folder beside the skill folders). Scripts run as `node <root>/scripts/<name>.mjs --project=.` and take the run id in `--run=<id>`; without it they use the latest run.

## Procedure

1. **Config.** If `.rebuild/config.json` is missing, write it with `"schema_version": 1`, `"kind": "config"`, `live`, `slug`, `staging`, `legacy`, and ask once for what only the person knows: the Search Console property, the GA4 property id, the Tag Manager account and container ids, the service account that reads them (if one is used), and the import date of the new project's data (if any). Never ask for secrets. Access to protected staging is an `op://` or `tf-output:` reference in `staging_access.headers_ref`.
2. **Connect** with the `connect` skill (read connections). Missing sources do not block the survey; note them.
3. **Survey** with `site-survey` (sitemap crawl, live HTTP, staging HTTP), then `search-signals`, then `url-inventory`, then `template-map`.
4. **Stop 1.** Run `node <root>/scripts/validate.mjs --project=.`; it must pass. Show the counts per type and decision, the template groups, the sources that were missing, and ask the person to review the inventory (or to hand it to a reviewer with `review-board`). Do not start step 5 in this turn.
5. After the person continues (a later message): `legacy-features`, then `parity-audit`.
6. **Stop 2.** Show the P0 and P1 gaps (class `missing-not-planned` first) and ask who owns each. With kivo-kion in the project, offer `node <root>/scripts/kion-bridge.mjs questions --project=. --kion=<path to kion.mjs>` (dry run first; `--apply` only after the person agrees).
7. Offer `review-board` to publish the board and `node <root>/scripts/export.mjs` for versioned deliverables.

## Verification

- `git status` shows changes only under `.rebuild/` until the person asks for an export.
- `validate.mjs` passes at each stop.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `access gate: 50 of 50 answered redirect to ...` | Staging behind an access policy without headers | Set `staging_access.headers_ref` in the config; see the cloudflare reference of `connect` |
| Inventory proposes `review` for every tag | No Search Console data | Run `connect`; or accept review and decide by hand |
| `no run: run crawl-sitemap.mjs first` | Step order | Start from `site-survey` |
| Many sitemap failures | Sitemap index lists stale children | Check the `failures` list in `urls.json`; the crawl continues past them and records each |
| `urls.json not found` although the run exists | `--run=` was given a folder path, but the scripts expect the run id | Pass the folder name only, such as `2026-01-02-acme` |

## Escalation

Every run stops twice for the person. Any write outside `.rebuild/` (exports, issues, setup) needs an explicit request in a later message.
