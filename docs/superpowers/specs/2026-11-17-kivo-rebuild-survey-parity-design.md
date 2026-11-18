# kivo-rebuild — slice 1: connect, survey and parity (design)

**Status:** draft for owner review · **Date:** 2026-11-17 · **Plugin:** `plugins/kivo-rebuild/` (third plugin of the
kivo-wise marketplace, hand-authored like kivo-creator)

## 1. Purpose

kivo-rebuild packages the process of rebuilding an existing WordPress site (a live site plus its legacy code) as a
structured Roots project. It covers what happens **after** the rebuild is decided and **around** the build:
surveying the live site, finding what the legacy does that the new project does not, connecting and configuring the
measurement and edge tools, proving the result (visual, performance, load), importing data and cutting over.

The process was first done by hand on a pilot rebuild. That run showed where it fails without tooling: features
found late (a home slider, P0 checkout gaps, tracking tags outside the tag manager), URL decisions made without
search data, and numbers (Core Web Vitals, server cost) gathered ad hoc. Each phase becomes a reproducible step with
typed outputs and explicit stop points.

### Family boundaries

| Plugin | Role | kivo-rebuild uses it for |
|---|---|---|
| kivo-wise | Stack detection, runner (Lando), Roots skills | `.roots-stack.json`, runner commands, theme/template paths |
| kivo-kion | Discovery, decisions, spec, plan (stack-agnostic) | Seeds legacy features from `.kion/` inventory; sends unowned gaps as questions |
| kivo-creator | Design (Figma/HTML) to blocks | Out of scope here; a later slice may hand page sections to it |
| kivo-wisdom | Versioned docs corpus | Provider docs referenced by the `connect` references when present |

kivo-rebuild does not record decisions or write specs and plans; kion does. Without kion it works on its own and
writes its findings to its own files.

### Slices

1. **Connect, survey and parity** (this document).
2. Proof: live vs new visual comparison, performance and Core Web Vitals, integration load simulation with a cost
   translation.
3. Import and cutover: staged idempotent importer patterns, delta, staging seed, cutover runbook, go-live
   configuration (publishing the tag manager version, repointing feeds).

Each slice has its own spec, plan and release.

## 2. Requirements (owner, 2026-11-17)

- Role: execution after the plan, WordPress specific; kion keeps discovery and decisions.
- Home: kivo-wise marketplace, `plugins/kivo-rebuild/`.
- First slice: live-site survey and parity audit.
- Review surface: project files are the source of truth; a generated board, published as an Artifact with shared
  storage when the session supports it; confirmed problems become GitHub issues.
- Connect step: help configure the tools the work needs, through MCP where available. Sources: Search Console, GA4,
  Tag Manager, PageSpeed/CrUX, Cloudflare, Playwright, Bing Webmaster Tools, RD Station, Merchant Center.
- The connect step also **configures the new site's tools** (not read-only), behind a plan → approval → apply gate.

## 3. Flow

```
/kivo-rebuild:rebuild <live-url> [--legacy=<path>] [--staging=<url>]   (or --run=.rebuild/runs/<id>)

0. connect     .rebuild/connections.json        sources reachable, by which path, last test
1. config      .rebuild/config.json             origins, property and container ids, rules overrides
2. crawl       urls.json                        sitemap + live HTTP (+ staging HTTP)
3. signals     signals.json                     Search Console + GA4 per path
4. inventory   inventory.json                   rule-based decision per URL
5. templates   templates.json                   URL -> page type -> template file, samples
   ── STOP: inventory review ──
6. features    features.json                    legacy feature inventory (agents per area)
7. parity      parity.json                      feature x new project classification
   ── STOP: P0/P1 gaps to the owner ──
8. review      board/ + issues                  board, published or local; issues after a dry run

/kivo-rebuild:connect [--check] [--setup]       runs on its own at any time
```

Every step runs alone and resumes with `--run=`. Steps 2–5 are deterministic scripts; steps 6–7 are agents that
write JSON checked against a schema. The live site and the legacy code are read only. The plugin writes only under
`.rebuild/` (gitignored) except for deliverables the owner asks to version (`rebuild export`, §6).

## 4. Components

### 4.1 Skills

| Skill | Does | Stops at |
|---|---|---|
| `rebuild` | The command: routes, resumes `--run=`, chains the steps | Each stop in §3 |
| `connect` | Detects session capabilities, tests and guides read connections; `--setup` plans new-site configuration | Setup plan, for approval |
| `site-survey` | Sitemap crawl, live and staging HTTP, builds `urls.json` | — |
| `search-signals` | Search Console and GA4 metrics per path | — |
| `url-inventory` | Applies decision rules, overrides and approved redirects | Inventory review |
| `template-map` | URL → page type → template of the new project, samples per group | — |
| `legacy-features` | Legacy feature inventory: plugins, MU plugins, theme, options, tags outside the tag manager, integrations; seeds from kion when present | — |
| `parity-audit` | Classifies every feature against the new project | P0/P1 gaps |
| `review-board` | Builds the board, publishes it when possible, imports marks, exports issues | Issue dry run |

Skills follow the kivo-creator layout: `SKILL.md` with frontmatter (`name`, `description`, `license`,
`compatibility`), sections When to use / Inputs required / Procedure / Verification / Failure modes / Escalation;
the command skill has `disable-model-invocation: true`.

### 4.2 References (loaded on demand)

- `skills/connect/references/<provider>.md`, one per provider (`gsc`, `ga4`, `gtm`, `pagespeed-crux`, `cloudflare`,
  `playwright`, `bing-webmaster`, `rd-station`, `merchant-center`). Each lists: prerequisites, the paths in order of
  preference (MCP → API with delegated credential → manual export), the minimal read test, the human-only steps
  with the exact screen, and for providers with setup actions the actions, their API calls and how to undo them.
- `skills/url-inventory/references/decision-rules.md`: rule table (id, condition, decision, reason) with defaults
  and how to override them in `config.json`.
- `skills/legacy-features/references/wordpress-areas.md`: checklist of places features hide (theme mods with
  scripts, banner CPTs, ACF options, checkout fields, shipping zones, MU plugin guards, cron hooks, outbound HTTP,
  shortcodes and builder blocks placed through options).
- `skills/parity-audit/references/classes.md`: classes, P0–P3 priority rules, suggested owner per gap.

### 4.3 Agents (model in frontmatter)

| Agent | Model | Why |
|---|---|---|
| `legacy-area-inventory` | sonnet | Broad parallel reading per area; writes `features.json` fragments |
| `parity-auditor` | opus | Judgment: compare legacy and new behaviour, classify, prioritise |
| `template-sampler` | haiku | Cheap: pick representative URLs per template group |
| `setup-planner` | opus | Builds the setup plan from the survey; never applies |

Agents write only their own output file; the skill merges and validates.

### 4.4 Scripts (dependency-free Node ESM, `scripts/`)

`crawl-sitemap.mjs`, `check-http.mjs` (streaming, resumable), `gsc.mjs`, `ga4.mjs`, `build-inventory.mjs`,
`map-templates.mjs`, `validate.mjs`, `board.mjs` (build / import), `issues.mjs`, `setup-plan.mjs`,
`setup-apply.mjs`, `export.mjs`; shared code in `scripts/lib/` (`state.mjs` atomic writes with `schema_version` and
`run_id`, `http.mjs`, `rules.mjs`, `credentials.mjs`).

## 5. Connect

### 5.1 Read connections

1. Detect what the session has: MCP servers connected, `gcloud`, `gh`, `op`, Playwright in the project.
2. For each source pick the strongest path available: MCP → API with a delegated credential → manual export (CSV).
3. Run the minimal read test (e.g. one Search Console row for the last 7 days) and record the result in
   `.rebuild/connections.json` (`source`, `path`, `identity`, `tested_at`, `ok`, `error`).
4. When a permission is missing, say exactly what the person must do and where (e.g. add the service account as a
   user of the Search Console property), then re-test. Never work around a missing permission.

`connect --check` re-tests every recorded connection.

### 5.2 Credentials

- Never read, print or store a secret value. Credentials come from `op://` references run through `op run`,
  service-account impersonation (`gcloud auth print-access-token --impersonate-service-account`), or the tool's own
  store (`gh`, `gcloud`).
- Never create a service account key.
- `config.json` and `connections.json` hold identifiers and references only (property ids, container ids,
  `op://` paths, service account emails).

### 5.3 New-site setup (`connect --setup`)

First set of actions:

1. **GA4:** create the property and the web data stream; recreate the live site's conversions with the same names.
2. **Tag Manager:** create a workspace in the container (or a new container), add tags derived from the survey of
   the live site; leave a version ready to publish. **Never publishes.**
3. **Search Console:** domain property verification through a DNS TXT record (Cloudflare when the zone is there);
   submit the new sitemap.
4. **Cloudflare Access:** service token for the staging hostname, reference stored in 1Password.

Gate: `setup-plan.mjs` writes `setup-plan.json` and `setup-plan.md` (action, provider, resource, change, undo) with a
hash. The person approves in a later message. `setup-apply.mjs` refuses a plan whose hash changed, applies one action
at a time, records each result, stops at the first failure and prints the undo steps for the actions already
applied. Writes to Bing Webmaster Tools, RD Station and Merchant Center are out of scope for this slice (read only).

## 6. Data

`.rebuild/` (gitignored): `config.json`, `connections.json`, `runs/<date>-<slug>/`:

| File | Content |
|---|---|
| `urls.json` | path, origin (sitemap / search / both), type, lastmod, live status, staging status, location, title, h1, canonical, robots |
| `signals.json` | path, clicks, impressions, position, GA4 sessions and conversions; period and source of each metric |
| `inventory.json` | url row + signals + `proposed`, `reason`, `rule_id`, `final`, `decided_by`, `target`; changes only between runs |
| `templates.json` | group → template file, blocks, URL count, samples, priority (sum of clicks) |
| `features.json` | id, area, source (file:line, option, plugin), behaviour, evidence, legacy data counts |
| `parity.json` | feature id, class, priority, location in the new project (file / commit), suggested owner, note |
| `setup-plan.json` / `.md` | actions, provider, resource, undo, hash |
| `board/` | generated board, imported marks |

Schemas in `schemas/*.schema.json`; `validate.mjs` runs before every stop; scripts write only through
`lib/state.mjs`.

Parity classes: `done`, `partial`, `missing-planned`, `missing-not-planned`, `dropped` (by a recorded decision),
`data-only` (code exists, data not imported).

Versioned deliverables on request (`rebuild export`): `docs/seo/url-inventory.csv`, `docs/seo/redirects.csv`
(approved redirects only), `docs/project/parity-audit-<date>.md`. Always generated from JSON, never parsed back.

## 7. Review

1. `board.mjs build` produces a self-contained HTML board from `inventory.json`, `templates.json` and `parity.json`
   (tabs: How to review, Templates, URLs, Parity, Queue). It opens locally without a server.
2. When the session has the Artifact tool, `review-board` publishes it with the `db` capability (collections
   `decisions`, `templates`, `parity`); reviewer marks live in the artifact database.
3. `board.mjs import` reads the marks back (artifact database export or a JSON downloaded from the local board) and
   applies `final`, `decided_by` and notes. It records only changes; a disagreement with an earlier decision becomes
   a conflict for the owner.
4. `issues.mjs` creates one issue per confirmed problem (labels `frontend-review`, `template:<group>`) after a dry run
   the person approves; the issue number goes back to the board row.
5. The owner decides grey-zone URLs; the reviewer proposes; `decided_by` records who.

### kion integration (when `.kion/` exists)

- `features.json` is seeded from kion inventory items.
- `missing-not-planned` P0/P1 gaps become `kion add question` entries.
- Features covered by a kion decision are marked `dropped` with the reference.

## 8. Errors

- **Network:** `check-http` keeps a maximum concurrency (default 4), halves it after consecutive 429/5xx, stops when
  the error rate passes 10 %, and resumes from the last row; failed rows are retried on the next run.
- **Protected staging:** access headers come only from an `op://` reference or Terraform outputs read in process. A
  run of 530/403 responses stops with a diagnosis instead of writing thousands of false rows.
- **Missing source:** without Search Console or GA4 the inventory still runs with `signals: null`; rules that need a
  signal propose `review` instead of deciding; the report names the missing source.
- **Invalid schema:** no stop is shown while `validate.mjs` fails; the skill prints the field and the reason.
- **Setup:** see §5.3.

## 9. Testing

`node --test test/rebuild/`, no dependencies.

- Decision rules: case tables (blog tags with and without clicks, changed after import, test pages, already 404 on
  the live site, query strings).
- Fixtures: nested sitemaps, sitemaps with and without lastmod, mocked Search Console / GA4 / Tag Manager /
  Cloudflare responses, a minimal legacy database dump (theme mods, banner CPT, options).
- Schema validation of every example; board build → import round trip; setup plan determinism (same input, same
  plan, same hash).
- Client-name scan: the plugin contains no client name (reuses kion's forbidden list,
  `~/.config/kion/forbidden-names.txt`, when present).

Evals (`claude plugin eval`, kivo-creator format):

1. `survey-stops-at-inventory` — stops at the inventory review; no writes outside `.rebuild/`.
2. `connect-never-prints-secret` — with an `op://` source, no secret value in the output.
3. `connect-guides-missing-permission` — service account not on the property → guides the human step.
4. `setup-requires-approval` — plan written, nothing applied in the same turn.
5. `parity-finds-hidden-tags` — theme mods fixture with a gtag snippet and an external loader → both flagged.
6. `parity-finds-empty-slider` — banner CPT in legacy, empty block in the new project → `data-only` P1.
7. `inventory-without-signals` — no Search Console → signal rules become `review`.

## 10. Done criteria for slice 1

- Unit tests and evals pass; skill validation (`scripts/validate-skills.mjs --root plugins/kivo-rebuild`) passes;
  manifests aligned (`scripts/sync-codex-manifests.mjs`).
- Pilot run, read only, on the pilot rebuild, in a workspace outside this repository, reproduces: the URL inventory
  with the same proposed decisions as the hand-made one (or every difference explained), the top 10 gaps of the
  hand-made gap audit, and the detection of the two tracking tags placed outside the tag manager.
- No client name anywhere in the plugin, its tests, fixtures or evals.

## 11. Out of scope (later slices)

Visual and performance comparison, integration load simulation, importer patterns, cutover runbook, publishing a tag
manager version, write actions for Bing Webmaster Tools, RD Station and Merchant Center.
