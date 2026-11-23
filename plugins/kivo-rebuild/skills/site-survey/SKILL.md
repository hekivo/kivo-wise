---
name: site-survey
description: Use when a live WordPress site (and optionally its staging copy) must be surveyed into a list of URLs with their HTTP answers - crawls the sitemap index, records failing child sitemaps, checks every URL on the live and staging hosts with resumable runs, and stops on an access gate or a high error rate. For joining search data use search-signals.
license: MIT
compatibility: Node 20+, network access to the live site and, when set, the staging host. Staging access headers come from an op:// or tf-output reference.
---

# Site survey

Builds `urls.json` for a run: every URL the sitemap lists, then the status, redirect target, title, h1, canonical and robots of each on the live host and on staging.

## When to use

- A rebuild starts and the list of URLs is not known yet.
- A run was interrupted and must resume.
- Staging changed and its answers must be checked again.
- Not for search signals (`search-signals`) or for deciding what happens to each URL (`url-inventory`).

## Inputs required

1. `live` in `.rebuild/config.json` (or `--live=<url>`). `staging` when a staging copy exists.
2. For protected staging: `staging_access.headers_ref` as `op://<vault>/<item>` or `tf-output:<dir>:<output>`. The item holds `CF-Access-Client-Id` and `CF-Access-Client-Secret` fields, or fields labelled `header:<Name>`. Never ask for the values.
3. Optional `types` in the config to name sitemap types (`{"product": "product"}` maps `product-sitemap.xml`; the default is the file name stem).
4. The kivo-rebuild plugin root (two levels above this skill's folder; in a project copy of the skills, the hidden `.kivo-rebuild/` folder beside the skill folders).

## Procedure

1. Crawl: `node <root>/scripts/crawl-sitemap.mjs --project=.` (default start is `<live>/sitemap_index.xml`; pass `--sitemap=<url>` for another). It creates the run, writes `urls.json`, prints `N urls, M failed sitemaps (run <id>)` and lists each failing child with its error. A child that returns 404, an error page or HTML instead of a sitemap is recorded in `failures` and skipped; the rest is still counted.
2. Report the failures to the person. Do not retry them in a loop; a stale child in the index is normal and stays in the record.
3. Live check: `node <root>/scripts/check-http.mjs --project=. --target=live`. Redirects are not followed; the `Location` is recorded.
4. Staging check, when `staging` is set: `node <root>/scripts/check-http.mjs --project=. --target=staging`. The headers resolve through the reference at run time.
5. Exit code 2 means the check stopped on purpose, with the reason on stderr. Show it and stop; see Failure modes. Running the same command again resumes: rows that answered with a non-error status are kept, and rows that errored, answered 5xx or 429, or were held back at an abort are checked again.
6. Concurrency defaults to 4 (`--concurrency=`). Never raise it above 8 against a production site. A staging host may need 2. `--limit=<n>` checks the first n paths for a trial.

## Verification

- `node <root>/scripts/validate.mjs --project=.` passes.
- The summary line `live: X/Y checked` shows X equal to Y, or the stop reason was reported.
- `.rebuild/` is the only place that changed.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `stopped: access gate: 50 of 50 answered redirect to /login` | The host sits behind an access policy and every URL is sent to a login page | Set `staging_access.headers_ref` (see the cloudflare reference of `connect`) and run again; gate answers were not written, so nothing has to be cleaned |
| `stopped: access gate: ... answered 403` | A firewall or access rule blocks the client | Same fix; for the live site ask the owner to allow the survey's address |
| `stopped: error rate 23% above 10%` | The host is overloaded or rate-limits | Lower `--concurrency`, wait, run again; the checked rows are kept |
| `config.staging is not set` | No staging URL in the config | Set it, or skip the staging check |
| `failed <sitemap>: not a sitemap` | The child returned HTML | Nothing to fix here; it is recorded and skipped |
| `no run: run crawl-sitemap.mjs first` | The crawl has not run | Run step 1 |

## Escalation

The live site is read only. Ask before raising concurrency above 4 on production, before using any access header the person did not name, and before checking a host that is not in the config.
