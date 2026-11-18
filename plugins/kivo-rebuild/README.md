# kivo-rebuild

Rebuild an existing WordPress site on the Roots stack without losing what the live site does. kivo-rebuild connects
the search and measurement sources, surveys the live site into a URL inventory with a proposed decision per URL,
groups URLs by the template that renders them, inventories the legacy features and classifies each one against the
new project.

```
connect ─▶ crawl ─▶ signals ─▶ inventory ─▶ templates ─▶ (review) ─▶ features ─▶ parity ─▶ (gaps) ─▶ board
```

Requires the [kivo-wise](../../README.md) plugin and Node.js 20+. `gcloud`, `gh`, `op` (1Password CLI) and Playwright
in the project are optional; each unlocks the sources that need it.

## Install

```bash
claude plugin marketplace add hekivo/kivo-wise
claude plugin install kivo-rebuild@kivo-wise   # installs kivo-wise too
```

Or, inside Claude Code:

```
/plugin install kivo-rebuild --marketplace hekivo/kivo-wise
```

## Use

```
/kivo-rebuild:rebuild https://www.example.test --legacy=./legacy --staging=https://staging.example.test
/kivo-rebuild:rebuild --run=2026-01-02-acme
/kivo-rebuild:connect
```

`rebuild` writes `.rebuild/config.json`, connects the sources, crawls the sitemap, checks the live and staging hosts,
joins the search signals, proposes a decision per URL and maps the template groups. It then **stops** for the person
to review the inventory. After the person continues, it inventories the legacy features, audits parity and stops
again at the P0 and P1 gaps. Pass `--run=<id>` (the folder name under `.rebuild/runs/`) to resume.

`connect` tests read access to each source and records the result in `.rebuild/connections.json`. When a permission
is missing it names the exact screen to fix; it never works around one.

### Setting up the new site

`connect.mjs` only reads. Setup of the new site's GA4 property, Tag Manager workspace, Search Console property and
staging access token runs in four steps, with a stop for approval between the plan and the apply:

1. The `setup-planner` agent writes `.rebuild/runs/<id>/setup-input.json`.
2. `node scripts/setup-plan.mjs --project=.` validates the actions and writes `setup-plan.json` and
   `setup-plan.md` with a hash.
3. The person reads `setup-plan.md` and approves the hash in a later message.
4. `node scripts/setup-apply.mjs --project=. --approved=<hash>` applies one action at a time, records each result,
   stops at the first failure and prints the undo steps for what was already applied. A plan edited after approval
   is refused. Run it again with the same hash to resume: applied actions are skipped.

**References between actions.** A param may be `{"$from": "A1.field"}`. The value is read from the result of an
earlier action when the plan is applied: the property from `createProperty` for `createWebStream`, the workspace from
`createWorkspace` for `createVersion`, the verification token from `verificationToken` for `createTxtRecord`. The plan
hash covers the reference, not the value. `setup-plan.mjs` rejects a reference to a later or unknown action, so the
planner never has to guess an id.

**Tag Manager is never published.** There is no publish operation, and no scope the plugin requests allows one
(`tagmanager.publish` is never requested). Setup ends at a version; a person reviews it and publishes it in Tag
Manager > Versions.

## Skills

| Skill | Purpose |
|---|---|
| `rebuild` | The command: route, resume with `--run=`, chain the steps, stop twice for the person |
| `connect` | Test read access per source, guide the human-only steps, plan and apply new-site setup behind an approval |
| `site-survey` | Crawl the sitemap index, check the live and staging hosts, detect an access gate |
| `search-signals` | Search Console and GA4 metrics per path, from the API or a CSV export |
| `url-inventory` | Apply the decision rules, keep overrides, propose redirects |
| `template-map` | Group URLs by page type and template of the new project, sample each group |
| `legacy-features` | Inventory plugins, MU plugins, theme, options, tags outside the tag manager and integrations |
| `parity-audit` | Classify every legacy feature against the new project, with a priority and an owner |
| `review-board` | Build the review board, import the marks, file issues after a dry run |

## Agents

| Agent | Model | Purpose |
|---|---|---|
| `legacy-area-inventory` | sonnet | Read one area of the legacy code and write `features.json` fragments |
| `parity-auditor` | opus | Compare legacy and new behaviour, classify and prioritise |
| `template-sampler` | haiku | Pick representative URLs per template group |
| `setup-planner` | opus | Build the setup plan input from the survey; never applies and never plans a publish |

Agents write only their own output file; `merge.mjs` validates and merges the fragments.

## Scripts

Dependency-free Node ESM in `scripts/`. Each takes `--project=.` and, where it works on a run, `--run=<id>`
(default: the latest run).

| Script | Does |
|---|---|
| `crawl-sitemap.mjs` | Walk the sitemap index, record failing children, write `urls.json` |
| `check-http.mjs` | Resumable HTTP check of live or staging; stops on an access gate or a high error rate |
| `connect.mjs` | Detect tools and test read access per source (`--only=`, `--mcp=`) |
| `gsc.mjs`, `ga4.mjs` | Search signals from the API or a CSV (English or Portuguese headers) |
| `build-inventory.mjs` | Apply the decision rules and join signals |
| `map-templates.mjs` | Template groups from inventory types and paths |
| `merge.mjs` | Validate and merge agent fragments |
| `kion-bridge.mjs` | Seed features from kion and turn gaps into kion questions (dry run first) |
| `board.mjs` | `build` the review board, `import` the marks |
| `issues.mjs` | Draft template issues; `--apply --repo=<owner/name>` files them through `gh` |
| `setup-plan.mjs`, `setup-apply.mjs` | Hashed setup plan and stepwise apply |
| `export.mjs` | Write the versioned deliverables to a path the person names |
| `validate.mjs` | Check every `.rebuild` file against its schema |

Shared code is in `scripts/lib/`: `state.mjs` (atomic, validated writes), `http.mjs`, `rules.mjs`,
`credentials.mjs`, `paths.mjs`, `csv.mjs`, `schema.mjs`, and `providers/` for GSC, GA4, Tag Manager, Cloudflare and
PageSpeed.

## Data

Everything is written under `.rebuild/` in the target project (add it to `.gitignore`). Schemas are in
`schemas/*.schema.json`; `validate.mjs` runs before every stop, and scripts write only through `lib/state.mjs`.

| File | Content |
|---|---|
| `config.json` | Live and staging URLs, ids of the sources, rule overrides, template map (identifiers and references only) |
| `connections.json` | Per source: path used, identity, test time, result, error |
| `runs/<date>-<slug>/urls.json` | Path, origin (sitemap, search or both), type, lastmod, live and staging status, location, title, h1, canonical, robots |
| `runs/…/signals.json` | Per path: clicks, impressions, position, GA4 sessions and conversions, with the period and source of each metric |
| `runs/…/inventory.json` | URL row plus signals, `proposed`, `reason`, `rule_id`, `final`, `decided_by`, `target` |
| `runs/…/templates.json` | Group, template file, blocks, URL count, samples, priority (sum of clicks) |
| `runs/…/features.json` | Id, area, source (file and line, option, plugin), behaviour, evidence, legacy data counts |
| `runs/…/parity.json` | Feature id, class, priority, location in the new project, suggested owner, note |
| `runs/…/setup-plan.json`, `.md` | Actions, provider, resource, change, undo, hash |
| `runs/…/board/` | The generated board and the imported marks |

Parity classes: `done`, `partial`, `missing-planned`, `missing-not-planned`, `dropped` (by a recorded decision) and
`data-only` (the code exists, the data was not imported).

Redirect targets on the live or staging host are stored as paths; targets on a foreign host stay absolute. Re-mapping
templates keeps each group's `status`, `note` and `issue`.

Scripts write only under `.rebuild/`, with two exceptions: `export.mjs` writes the paths the person names (never inside
`.rebuild/`), and `setup-apply.mjs` calls the remote APIs after approval. The live site and the legacy code are read
only.

## Credentials

- Never read, print or store a secret value. Credentials come from `op://` references run through `op run`, from
  service-account impersonation, or from a tool's own store (`gh`, `gcloud`).
- Never create a service-account key.
- `config.json` and `connections.json` hold identifiers and references only: property ids, container ids, `op://`
  paths and service-account e-mails.

**Google tokens.** With a service account (`gsc.service_account`, `ga4.service_account`, `gtm.service_account` or
`setup.service_account`), `credentials.mjs` exports `googleToken(serviceAccount, scopes)`. It mints the token through
the IAM Credentials API `generateAccessToken` with explicit scopes, authenticated by the operator's own
`gcloud auth print-access-token`. A token from `--impersonate-service-account` carries only the `cloud-platform` scope,
which Search Console, Analytics and Tag Manager reject. `GOOGLE_SCOPES` has two sets:

| Set | Used by | Scopes |
|---|---|---|
| `read` | Read tests and signals | `webmasters.readonly`, `analytics.readonly`, `tagmanager.readonly` |
| `write` | Setup apply | `webmasters`, `siteverification`, `analytics.edit`, `tagmanager.edit.containers`, `tagmanager.edit.containerversions` |

The operator needs `roles/iam.serviceAccountTokenCreator` on the service account, and the IAM Service Account
Credentials API enabled in its project:

```bash
gcloud services enable iamcredentials.googleapis.com --project=acme-proj
gcloud iam service-accounts add-iam-policy-binding reader@acme-proj.iam.example.test \
  --member=user:operator@example.test --role=roles/iam.serviceAccountTokenCreator
```

No scope allows publishing a Tag Manager container.

**Cloudflare Access service token.** Cloudflare shows the client secret once. `createAccessServiceToken` keeps it in
memory and sends it to 1Password on the standard input of `op item create --vault <vault> -`, as a JSON item
template. The secret never appears in a command line, a file, a log, the plan or the result. If 1Password refuses the
item after Cloudflare created the token, the error names the orphaned client id so the person can delete it in
Cloudflare Zero Trust. Afterwards, set `staging_access.headers_ref` to `op://<vault>/<name>` so the survey sends the
headers to staging.

**Cloudflare and PageSpeed keys** are read from the environment, which `op run --env-file=<file with op:// references>`
fills. Never export a value in the shell.

## Development

```bash
node --test test/rebuild/*.test.mjs
node scripts/validate-skills.mjs --root plugins/kivo-rebuild
node scripts/build-rebuild-eval.mjs && claude plugin eval .rebuild-eval/kivo-rebuild --scaffold --allow-tools Bash Write Edit
```

`test/rebuild/agnostic.test.mjs` fails when a name from `~/.config/kion/forbidden-names.txt` appears in the plugin or
its fixtures (it is skipped on machines without that file). This repository is public: fixtures use `example.test`,
`acme` and `Acme Store`, and e-mail addresses use a reserved domain.

Evals run on a staged copy because a declared plugin dependency does not load inside the eval sandbox; see
`scripts/build-rebuild-eval.mjs`.

## License

MIT. See [LICENSE](LICENSE).
