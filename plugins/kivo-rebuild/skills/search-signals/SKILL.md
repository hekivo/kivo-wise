---
name: search-signals
description: Use when search and traffic numbers must be joined to the surveyed URLs - reads Search Console clicks and impressions through the API, an MCP server or a CSV export (English or Portuguese headers), and GA4 sessions and key events through the API, over the last 16 months by default. For deciding what happens to each URL use url-inventory.
license: MIT
compatibility: Node 20+. API paths need gcloud and a service account with the Token Creator role. The CSV path needs only the exported file.
---

# Search signals

Writes `signals.json` for the run: per path, Search Console `clicks`, `impressions`, `ctr`, `position` and GA4 `sessions`, `conversions`. Paths are normalized (encoding, trailing slash) so the same page from the sitemap, from search and from HTTP checks joins to one row.

## When to use

- After the sitemap crawl, before building the inventory.
- Search Console or GA4 access is missing and the person has an export instead.
- Not for connecting or testing access (`connect`).

## Inputs required

1. A run (from `site-survey`).
2. One of: `gsc.property` in the config (`sc-domain:<domain>` or the URL prefix) with a readable service account; MCP rows saved to a CSV; or the person's Search Console export (Performance > Pages > Export > Download CSV, the Pages file, 16 months).
3. For GA4: `ga4.property_id` in the config.
4. The kivo-rebuild plugin root (two levels above this skill's folder; in a project copy of the skills, the hidden `.kivo-rebuild/` folder beside the skill folders).

## Procedure

1. Search Console, by the first path that works:
   - API: `node <root>/scripts/gsc.mjs --project=.` (`--months=16` by default).
   - MCP: query the pages dimension through the MCP tool, write the rows to a CSV with the headers `Page, Clicks, Impressions, CTR, Position` (CTR as a percentage such as `5.2%`, because the parser divides by 100), then `node <root>/scripts/gsc.mjs --project=. --via=mcp --csv=<file>`.
   - Export: `node <root>/scripts/gsc.mjs --project=. --csv=<export>`. Headers in English (`Top pages`, `Clicks`, `Impressions`, `CTR`, `Position`) and in Portuguese (`Páginas principais`, `Cliques`, `Impressões`, `CTR`, `Posição`) both parse, and counts such as `1,204` or `1.204` are read as 1204.
2. GA4, when configured: `node <root>/scripts/ga4.mjs --project=.`. A source that is missing is skipped, not faked.
3. Re-running one source replaces only that source's fields; the other source stays.
4. Tell the person which sources fed the numbers and the period. Without Search Console data the inventory rules propose `review` for tag archives instead of deciding from clicks.

## Verification

- The summary line `gsc: N pages (start..end)` or `ga4: N pages (...)` appears and N is above zero.
- `signals.json` has the `sources` entry with `path` (`api`, `csv` or `mcp`), the period and the row count.
- `node <root>/scripts/validate.mjs --project=.` passes.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `unrecognised Search Console export header` | The file is not the Pages export (for example Queries) | Export the Pages tab; the header must contain a page column and a clicks column |
| `config.gsc.property missing` | No property configured and no CSV | Set the property, or pass `--csv=` |
| `Search Console HTTP 403` | The service account is not a user of the property | See the gsc reference of `connect` |
| `generateAccessToken HTTP 403` | The Token Creator role is missing | See the gsc reference of `connect` |
| Fewer pages than expected | The export holds only the top 1,000 rows | Use the API or MCP path, which pages through all rows |
| `--via=mcp needs --csv=` | The MCP rows were not saved | Write the rows to a CSV first |

## Escalation

Ask before using a Google account other than the one named in the config. Never print a token or a service account key.
