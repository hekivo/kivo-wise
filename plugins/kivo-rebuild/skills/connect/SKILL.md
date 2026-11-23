---
name: connect
description: Use when sources for a site survey need connecting or checking (Search Console, GA4, Tag Manager, PageSpeed and CrUX, Cloudflare, Playwright, Bing Webmaster Tools, RD Station, Merchant Center), or when the new site's GA4, Tag Manager, Search Console or staging access must be set up - tests read access, guides the human-only steps and plans setup behind an approval. For surveying the site use site-survey.
license: MIT
compatibility: Node 20+. Optional - gcloud (service account impersonation), op (1Password references), gh, Playwright in the project. Google sources need the Token Creator role on the service account.
---

# Connect sources

Tests read access to each source, records the result in `.rebuild/connections.json`, and walks the person through the steps only a human can do. It can also plan and apply the setup of the new site's GA4 property, Tag Manager workspace, Search Console property and staging access token, but only after the person approves the exact plan.

## When to use

- Before a survey, to see which sources answer.
- A read test failed and the person needs the exact screen to fix it.
- The new site needs a GA4 property, a Tag Manager workspace, a verified Search Console property or a staging access token.
- Not for crawling or checking URLs (`site-survey`).

## Inputs required

1. `.rebuild/config.json` with the ids the sources need (Search Console property, GA4 property id, Tag Manager account and container ids, Cloudflare zone id). The `rebuild` skill writes it; if it is missing, write it first.
2. The kivo-rebuild plugin root (two levels above this skill's folder; in a project copy of the skills, the hidden `.kivo-rebuild/` folder beside the skill folders).
3. For Google sources: a service account in `gsc.service_account`, `ga4.service_account`, `gtm.service_account` or `setup.service_account` (each falls back as the code does, see the references), and the Token Creator role for the person on it. Without a service account the person's own `gcloud` login is used, which Google often rejects for these APIs because the token lacks their scopes.
4. For Cloudflare and PageSpeed keys: an env file with `op://` references, run under `op run`. Never export a value in the shell.

## Procedure

1. List the MCP servers connected in this session for these sources (Search Console, GA4, Tag Manager). For each, run its read test through the MCP tool (one row, last 7 days), report it, and pass the ids to the script as `--mcp=gsc,ga4`.
2. Run `node <root>/scripts/connect.mjs --project=. [--mcp=<ids>] [--only=<ids>]`. Source ids are `gsc`, `ga4`, `gtm`, `cloudflare`, `pagespeed`; Playwright and the manual sources (Bing, RD Station, Merchant Center) are recorded too. Cloudflare and PageSpeed need the key in the environment: `op run --env-file=<file with op:// references> -- node <root>/scripts/connect.mjs --project=. --only=cloudflare,pagespeed`.
3. For each `FAIL`, open `references/<source>.md` and walk the person through the human step it names (exact screen), then run again with `--only=<source>`. `--only` replaces only the results of the sources it tested; the others keep their last result in `connections.json`. The script exits 1 while any configured source fails.
4. **Google tokens.** With a service account, the script mints the token through the IAM Credentials API (`generateAccessToken`) with explicit scopes, authenticated by `gcloud auth print-access-token` of the operator. Read tests ask for read-only scopes. Setup asks for write scopes. No scope allows publishing a Tag Manager container (`tagmanager.publish` is never requested).
5. **Setup (only when the person asks for it).** Hand the survey to the `setup-planner` agent. It writes `.rebuild/runs/<id>/setup-input.json` (create the folder as `<YYYY-MM-DD>-<slug>` when no survey run exists yet; the scripts pick the latest run). An action param may be `{"$from": "A1.field"}`, resolved when the plan is applied from an earlier action's result (the property from `createProperty` for `createWebStream`, the workspace from `createWorkspace` for `createVersion`, the token from `verificationToken` for `createTxtRecord`). Never guess an id that an earlier action creates.
6. Run `node <root>/scripts/setup-plan.mjs --project=.`. It rejects an unknown operation, missing params, and a `$from` that names a later or unknown action. Show `setup-plan.md` with its hash and **stop**. Do not apply in this turn.
7. In a later message, only with the person's explicit approval of that hash: `op run --env-file=<file> -- node <root>/scripts/setup-apply.mjs --project=. --approved=<hash>`. A plan edited after approval is refused. On a failure the script prints the undo lines for what was already applied; the same command resumes and skips applied actions.
8. Never publish a Tag Manager version. Tell the person to review and publish it in Tag Manager > Versions.

## Verification

- `connections.json` has one row per source and `validate.mjs` passes.
- Every source marked ok shows the identity that was used (`mcp`, a service account or `gcloud user`).
- Before approval, `git status` and the remote services are unchanged. After apply, every action in `setup-plan.json` is `applied` or the failure is reported with its undo lines.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `generateAccessToken HTTP 403 for <service account>` | The operator lacks `roles/iam.serviceAccountTokenCreator` on it, or the IAM Service Account Credentials API is off in its project | Grant the role (or ask the owner), `gcloud auth login`, run again |
| `HTTP 403` from Search Console, GA4 or Tag Manager | The service account is not a user of the property or container | Follow the human step in the source's reference |
| `CLOUDFLARE_API_TOKEN not set` | The script ran outside `op run` | Run it under `op run --env-file=<file>` |
| PageSpeed `HTTP 429` | Anonymous quota exhausted | Set `PAGESPEED_API_KEY` through `op run` |
| `approved hash ... does not match` or `plan changed after approval` | The plan was edited or re-planned after the person approved | Show the new `setup-plan.md` and ask again |
| `$from ... must name an earlier action` | The planner referenced a later or unknown action | Reorder the actions or fix the reference, then re-plan |
| `service token ... was created but not stored` | 1Password refused the item after Cloudflare created the token | Delete the token named in the error in Cloudflare Zero Trust, fix `op` access, re-run |
| An MCP source is not listed | The server is not connected in this session | Fall back to the API path, then to a CSV export |

## Escalation

Setup writes to remote services and needs the person's approval of the plan hash in a separate message. Ask before creating anything in a Google, Cloudflare or 1Password account the person did not name. Never publish a Tag Manager container, never create a service account key, and never print a secret value.
