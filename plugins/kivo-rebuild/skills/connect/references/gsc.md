# Search Console

Search Console supplies clicks, impressions and position per page, which the inventory rules use. It is also where the new site's property is created and verified.

## Prerequisites

- The property name as Search Console shows it: `sc-domain:example.test` for a domain property (all subdomains and protocols) or `https://www.example.test/` for a URL-prefix property. Put it in `gsc.property` in `.rebuild/config.json`.
- A service account in `gsc.service_account`, for example `reader@acme-proj.iam.example.test`. Its project needs the Search Console API and the IAM Service Account Credentials API enabled:

  ```bash
  gcloud services enable searchconsole.googleapis.com iamcredentials.googleapis.com --project=acme-proj
  ```

- The person running the survey has `gcloud auth login` done and the role `roles/iam.serviceAccountTokenCreator` on that service account:

  ```bash
  gcloud iam service-accounts add-iam-policy-binding reader@acme-proj.iam.example.test \
    --member=user:operator@example.test --role=roles/iam.serviceAccountTokenCreator
  ```

## How tokens work

With a service account, the plugin does not use `--impersonate-service-account` (that token only carries the `cloud-platform` scope, which the Search Console, Analytics and Tag Manager APIs reject). It calls the IAM Credentials API `generateAccessToken` for the service account with explicit scopes, authenticated by the operator's own `gcloud auth print-access-token`. No key file is ever created.

| Use | Scopes requested |
|---|---|
| Read tests and signals | `webmasters.readonly`, `analytics.readonly`, `tagmanager.readonly` |
| Setup (apply) | `webmasters`, `siteverification`, `analytics.edit`, `tagmanager.edit.containers`, `tagmanager.edit.containerversions` |

`tagmanager.publish` is never requested, so no step of this plugin can publish a Tag Manager container.

Without a service account the token is the operator's own `gcloud auth print-access-token`, which usually lacks these scopes. Use a service account.

Which service account is used: `connect.mjs` takes the source's own (`gsc.service_account`, `ga4.service_account`, `gtm.service_account`) and falls back to `gsc.service_account`. `gsc.mjs` reads `gsc.service_account`. `ga4.mjs` reads `ga4.service_account` and falls back to `gsc.service_account`. Setup reads `setup.service_account`, then `gsc.service_account`.

## Paths

1. **MCP.** When a Search Console MCP server is connected, query the pages dimension for 16 months through it, write the rows to a CSV (`Page, Clicks, Impressions, CTR, Position`, CTR as a percentage) and run `gsc.mjs --via=mcp --csv=<file>`. Pass `--mcp=gsc` to `connect.mjs` so the result is recorded.
2. **API.** `node <root>/scripts/gsc.mjs --project=.` pages through all rows (25,000 per request).
3. **Manual.** Search Console > Performance > Search results > Pages tab > Export > Download CSV, with the date range set to 16 months. The export holds at most 1,000 rows, so large sites lose the tail. Pass it with `--csv=<file>`. English and Portuguese headers both parse.

## Read test

One query, page dimension, one row, over the last seven days. It passes when Search Console answers 200.

## Human steps

- `HTTP 403` from the read test: Search Console > select the property > Settings > Users and permissions > Add user > the service account's e-mail > permission Restricted (read only is enough).
- `generateAccessToken HTTP 403`: the Token Creator role is missing; see Prerequisites.
- Property not listed: it belongs to another Google account; ask its owner to add the service account.

## Setup actions

These create and verify the property of the new site. They need the write scopes and the service account's verification as owner; the account that verifies becomes the owner, so a person who needs access verifies the property with their own account too (Search Console shows the DNS record to add).

| Operation | Params | Result | Undo |
|---|---|---|---|
| `verificationToken` | `domain` | `token` | nothing to undo |
| `verify` | `domain` | `id` | Search Console > Settings > Ownership verification > Remove |
| `addSite` | `property` | `property` | Search Console > Settings > Property settings > Remove property |
| `submitSitemap` | `property`, `sitemap` | `sitemap` | Search Console > Sitemaps > remove the sitemap |

A usual order, with Cloudflare supplying the DNS record: `A1 gsc verificationToken`, `A2 cloudflare createTxtRecord` with `content` set to `{"$from": "A1.token"}`, `A3 gsc verify`, `A4 gsc addSite`, `A5 gsc submitSitemap`. If `verify` fails right after the record is created (DNS has not propagated), run `setup-apply.mjs` again with the same approved hash: applied actions are skipped and `A3` is retried.

A param may be `{"$from": "A1.token"}`: the value is read from the result of an earlier action when the plan is applied. The plan hash covers the reference, not the value.
