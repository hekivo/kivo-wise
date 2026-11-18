# kivo-rebuild slice 1 (connect, survey, parity) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `plugins/kivo-rebuild/` 0.1.0 in the kivo-wise marketplace: connect read sources and plan new-site setup,
survey a live WordPress site into a decided URL inventory with search signals and template groups, inventory legacy
features and audit parity, and publish a review board.

**Architecture:** Dependency-free Node ESM scripts write typed JSON under `.rebuild/` in the target project, validated
against schemas shipped in the plugin; skills orchestrate the scripts and stop for approval; agents write JSON
fragments that a merge script validates. Everything outside the scripts' deterministic work (classifying a feature,
proposing a grey-zone decision, planning setup) is model judgment written into the same typed files.

**Tech Stack:** Node.js 20+ (`node:test`, `node:fs`, global `fetch`), no npm dependencies; Claude Code plugin format
(skills, agents, evals) as in `plugins/kivo-creator/`; `gh`, `gcloud`, `op` as optional external CLIs.

**Spec:** `docs/superpowers/specs/2026-11-17-kivo-rebuild-survey-parity-design.md`

## Global Constraints

- Plugin path `plugins/kivo-rebuild/`, name `kivo-rebuild`, initial version `0.1.0`, declares dependency `kivo-wise`.
- Hand-authored like `plugins/kivo-creator/`; its marketplace entry is always `plugins[2]` in all four marketplaces.
- Node 20+, ESM, no npm dependencies anywhere in the plugin.
- All code, comments, docs, fixtures and commit messages in en-US.
- No client name anywhere in the plugin, tests, fixtures or evals (public repository). Fixtures use `example.test`,
  `acme`, `Acme Store`.
- Never read, print or store a secret value; credentials only through `op://` references (`op run`), service-account
  impersonation, or a tool's own store (`gh`, `gcloud`). Never create a service-account key.
- The live site and the legacy code are read only. Scripts write only under `<project>/.rebuild/` except `export.mjs`
  (paths the person names) and `setup-apply.mjs` (remote APIs, after approval).
- Skills follow the contract enforced by `scripts/validate-skills.mjs`: frontmatter keys limited to `name`,
  `description`, `license`, `compatibility`, `metadata`, `disable-model-invocation`; description starts with
  "Use when", ≤ 1,024 chars; exactly six H2 sections in order (When to use, Inputs required, Procedure, Verification,
  Failure modes, Escalation); Failure modes is a Symptom / Cause / Fix table; ≤ 500 lines; no `${CLAUDE_`,
  `$ARGUMENTS`, or the words claude, cursor, codex, copilot in any skill markdown.
- Agents: frontmatter `name`, `description`, `tools`, `model` (`sonnet` | `opus` | `haiku`).
- Conventional commits, lowercase subject; no AI attribution trailers.
- Work on branch `feat/kivo-rebuild-spec` (already has the spec); one PR at the end.

## Review Focus

1. **Sitemap index that lists hundreds of child sitemaps, some returning 404 or HTML** — the crawl must record the
   failing child and continue, not abort or count HTML as URLs (test in Task 3).
2. **Staging behind an access gate answering 302 to a login page for every URL** — must be detected as a gate, not
   recorded as 9,000 redirects (test in Task 4).
3. **Paths that differ only by encoding or trailing slash between sitemap, Search Console and HTTP results**
   (`/caf%C3%A9/` vs `/café/`, `/a` vs `/a/`) — must join to one row (test in Task 2, `normalizePath`).
4. **Search Console CSV exported in Portuguese or English headers** — both must parse (test in Task 6).
5. **A setup plan edited by hand after approval** — apply must refuse (test in Task 12).

---

## File Structure

```
plugins/kivo-rebuild/
  .claude-plugin/plugin.json  .codex-plugin/plugin.json  .cursor-plugin/plugin.json
  README.md  CHANGELOG.md  LICENSE
  schemas/{config,connections,urls,signals,inventory,templates,features,parity,setup-plan}.schema.json
  scripts/lib/args.mjs        option parsing + runCli (copy of kivo-creator's)
  scripts/lib/schema.mjs      minimal JSON Schema checker (copy of kivo-creator's)
  scripts/lib/paths.mjs       normalizePath, joinUrl
  scripts/lib/state.mjs       .rebuild layout, run ids, atomic validated writes
  scripts/lib/http.mjs        fetchWithRetry, pool with adaptive concurrency
  scripts/lib/csv.mjs         tiny CSV parser/writer
  scripts/lib/credentials.mjs header/token resolution from references only
  scripts/lib/rules.mjs       URL decision rules
  scripts/lib/providers/{gsc,ga4,gtm,cloudflare,pagespeed}.mjs   read tests + setup actions
  scripts/validate.mjs  crawl-sitemap.mjs  check-http.mjs  connect.mjs  gsc.mjs  ga4.mjs
  scripts/build-inventory.mjs  map-templates.mjs  merge.mjs  kion-bridge.mjs
  scripts/board.mjs  issues.mjs  setup-plan.mjs  setup-apply.mjs  export.mjs
  skills/{rebuild,connect,site-survey,search-signals,url-inventory,template-map,legacy-features,parity-audit,review-board}/SKILL.md
  skills/connect/references/{gsc,ga4,gtm,pagespeed-crux,cloudflare,playwright,bing-webmaster,rd-station,merchant-center}.md
  skills/url-inventory/references/decision-rules.md
  skills/legacy-features/references/wordpress-areas.md
  skills/parity-audit/references/classes.md
  agents/{legacy-area-inventory,parity-auditor,template-sampler,setup-planner}.md
  evals/<7 cases>/
test/rebuild/*.test.mjs   test/fixtures/rebuild/**
scripts/build-rebuild-eval.mjs
Modified: scripts/sync-codex-manifests.mjs, .release-please-config.json, .release-please-manifest.json,
          .claude-plugin/marketplace.json, .cursor-plugin/marketplace.json, .codex-plugin/marketplace.json,
          .agents/plugins/marketplace.json, .github/workflows/ci.yml, README.md, .gitignore
```

---

### Task 1: Plugin scaffold, marketplaces, release and CI wiring

**Files:**
- Create: `plugins/kivo-rebuild/.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `.cursor-plugin/plugin.json`,
  `README.md`, `CHANGELOG.md`, `LICENSE`
- Modify: the four marketplace files, `.release-please-config.json`, `.release-please-manifest.json`,
  `scripts/sync-codex-manifests.mjs`, `.github/workflows/ci.yml`
- Test: `test/rebuild/manifests.test.mjs`

**Interfaces:**
- Produces: `test/rebuild/helpers.mjs` exporting `ROOT`, `PLUGIN`, `FIX`, `readJson(p)`, `tmpProject()` (empty temp
  dir), `run(script, args, {cwd, env})` → `{code, stdout, stderr}` (spawnSync of `node plugins/kivo-rebuild/scripts/<script>`).

- [ ] **Step 1: Write the helpers and the failing manifest test**

```js
// test/rebuild/helpers.mjs
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PLUGIN = join(ROOT, 'plugins', 'kivo-rebuild');
export const FIX = join(ROOT, 'test', 'fixtures', 'rebuild');
export const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
export const tmpProject = () => mkdtempSync(join(tmpdir(), 'rebuild-'));
export function run(script, args = [], { cwd = ROOT, env = {} } = {}) {
  const r = spawnSync(process.execPath, [join(PLUGIN, 'scripts', script), ...args], { cwd, env: { ...process.env, ...env }, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
```

```js
// test/rebuild/manifests.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { ROOT, PLUGIN, readJson } from './helpers.mjs';

const MARKETS = ['.claude-plugin', '.cursor-plugin', '.codex-plugin'].map((d) => join(ROOT, d, 'marketplace.json'))
  .concat(join(ROOT, '.agents', 'plugins', 'marketplace.json'));

test('three manifests share name and version and depend on kivo-wise', () => {
  const claude = readJson(join(PLUGIN, '.claude-plugin', 'plugin.json'));
  assert.equal(claude.name, 'kivo-rebuild');
  assert.deepEqual(claude.dependencies, ['kivo-wise']);
  for (const d of ['.codex-plugin', '.cursor-plugin']) {
    const m = readJson(join(PLUGIN, d, 'plugin.json'));
    assert.equal(m.name, 'kivo-rebuild');
    assert.equal(m.version, claude.version);
  }
});

test('every marketplace lists kivo-rebuild as plugins[2] with the plugin version', () => {
  const version = readJson(join(PLUGIN, '.claude-plugin', 'plugin.json')).version;
  for (const file of MARKETS) {
    const entry = readJson(file).plugins[2];
    assert.equal(entry?.name, 'kivo-rebuild', file);
    assert.equal(entry.version, version, file);
  }
});

test('release-please knows the package', () => {
  const cfg = readJson(join(ROOT, '.release-please-config.json'));
  assert.ok(cfg.packages['plugins/kivo-rebuild']);
  assert.ok(cfg.packages['.']['exclude-paths'].includes('plugins/kivo-rebuild'));
  assert.equal(readJson(join(ROOT, '.release-please-manifest.json'))['plugins/kivo-rebuild'], '0.1.0');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/rebuild/manifests.test.mjs`
Expected: FAIL (`ENOENT ... plugins/kivo-rebuild/.claude-plugin/plugin.json`).

- [ ] **Step 3: Create the manifests and docs**

`plugins/kivo-rebuild/.claude-plugin/plugin.json`:

```json
{
  "name": "kivo-rebuild",
  "description": "Rebuild an existing WordPress site on the Roots stack: connect search and measurement sources, survey the live site into a decided URL inventory, audit legacy features against the new project, review it on a shared board",
  "version": "0.1.0",
  "author": { "name": "hekivo", "url": "https://github.com/hekivo" },
  "homepage": "https://github.com/hekivo/kivo-wise/tree/main/plugins/kivo-rebuild",
  "repository": "https://github.com/hekivo/kivo-wise",
  "license": "MIT",
  "keywords": ["wordpress", "roots", "migration", "rebuild", "seo", "search-console", "ga4", "tag-manager", "parity", "url-inventory"],
  "dependencies": ["kivo-wise"]
}
```

`plugins/kivo-rebuild/.codex-plugin/plugin.json`:

```json
{
  "name": "kivo-rebuild",
  "version": "0.1.0",
  "description": "Rebuild an existing WordPress site on the Roots stack: connect search and measurement sources, survey the live site into a decided URL inventory, audit legacy features against the new project, review it on a shared board",
  "author": { "name": "hekivo", "url": "https://github.com/hekivo" },
  "homepage": "https://github.com/hekivo/kivo-wise/tree/main/plugins/kivo-rebuild",
  "repository": "https://github.com/hekivo/kivo-wise",
  "license": "MIT",
  "skills": "./skills/",
  "interface": {
    "displayName": "Kivo Rebuild",
    "shortDescription": "Survey a live WordPress site and audit parity before rebuilding it on the Roots stack.",
    "longDescription": "Connects Search Console, GA4, Tag Manager and edge sources, crawls the live site into a URL inventory with proposed keep/redirect/gone/noindex decisions, groups URLs by template, inventories what the legacy code does and classifies each feature against the new project. Plans new-site GA4, Tag Manager and Search Console setup behind an approval gate. Requires the kivo-wise plugin.",
    "developerName": "hekivo",
    "category": "Development",
    "websiteURL": "https://github.com/hekivo/kivo-wise/tree/main/plugins/kivo-rebuild"
  }
}
```

`plugins/kivo-rebuild/.cursor-plugin/plugin.json`:

```json
{
  "name": "kivo-rebuild",
  "description": "Rebuild an existing WordPress site on the Roots stack: connect search and measurement sources, survey the live site into a decided URL inventory, audit legacy features against the new project, review it on a shared board",
  "version": "0.1.0",
  "author": { "name": "hekivo", "url": "https://github.com/hekivo" }
}
```

Copy `plugins/kivo-creator/LICENSE` to `plugins/kivo-rebuild/LICENSE`. `CHANGELOG.md` contains `# Changelog\n`.
`README.md` (filled further in Task 16) starts with:

```markdown
# kivo-rebuild

Rebuild an existing WordPress site on the Roots stack without losing what the live site does. kivo-rebuild connects
the search and measurement sources, surveys the live site into a URL inventory with a proposed decision per URL,
groups URLs by the template that renders them, inventories the legacy features and classifies each one against the
new project.

```
connect ─▶ crawl ─▶ signals ─▶ inventory ─▶ templates ─▶ (review) ─▶ features ─▶ parity ─▶ (gaps) ─▶ board
```

Requires the [kivo-wise](../../README.md) plugin and Node.js 20+.
```

- [ ] **Step 4: Add the marketplace entries and release config**

Append to `plugins` in `.claude-plugin/marketplace.json`, `.cursor-plugin/marketplace.json`,
`.codex-plugin/marketplace.json` and `.agents/plugins/marketplace.json` (copy the shape of each file's `plugins[1]`
entry, changing only name, description, version, source path):

```json
{
  "name": "kivo-rebuild",
  "description": "Rebuild an existing WordPress site on the Roots stack: connect sources, survey the live site, audit parity",
  "version": "0.1.0",
  "source": "./plugins/kivo-rebuild",
  "author": { "name": "hekivo", "url": "https://github.com/hekivo" }
}
```

Update each marketplace `metadata.description` to
`"Marketplace for kivo-wise (Roots stack skills), kivo-creator (design to blocks) and kivo-rebuild (rebuild existing sites)."`

In `.release-please-config.json`: add `"plugins/kivo-rebuild"` to `packages["."]["exclude-paths"]`, and add a package
identical to `plugins/kivo-creator` with `package-name`/`component` `kivo-rebuild` and every marketplace `jsonpath`
`$.plugins[2].version`. In `.release-please-manifest.json` add `"plugins/kivo-rebuild": "0.1.0"`.

- [ ] **Step 5: Generalize the manifest sync**

In `scripts/sync-codex-manifests.mjs` replace `CREATOR_DIR`, `CREATOR_MANIFESTS` and `syncCreator` with:

```js
const HAND_AUTHORED = [
  { name: 'kivo-creator', index: 1 },
  { name: 'kivo-rebuild', index: 2 },
];

function syncHandAuthored(isCheck, drift) {
  for (const { name, index } of HAND_AUTHORED) {
    const dir = resolve(ROOT, 'plugins', name);
    const version = readJson(join(dir, '.claude-plugin', 'plugin.json')).version;
    for (const file of ['.cursor-plugin', '.codex-plugin'].map((d) => join(dir, d, 'plugin.json'))) {
      const data = readJson(file);
      if (data.version === version) continue;
      if (isCheck) drift.push(`${name}: ${file} version ${data.version} != ${version}`);
      else { data.version = version; writeJson(file, data); console.log(`Updated ${file} version to ${version}`); }
    }
    for (const file of MARKETPLACES) {
      const data = readJson(file);
      const entry = data.plugins?.[index];
      if (entry?.name !== name) { drift.push(`${file}: plugins[${index}] must be ${name} (release-please bumps $.plugins[${index}].version)`); continue; }
      if (entry.version === version) continue;
      if (isCheck) drift.push(`${file}: ${name} version ${entry.version} != ${version}`);
      else { entry.version = version; writeJson(file, data); console.log(`Updated ${file} ${name} version to ${version}`); }
    }
  }
}
```

Add `resolve(ROOT, '.agents', 'plugins', 'marketplace.json')` to `MARKETPLACES` only if that file is not regenerated
by `scripts/build-codex-plugin.mjs`; check with `node scripts/build-codex-plugin.mjs --check` after the change — if it
reports drift on `.agents/plugins/marketplace.json`, instead add the `kivo-rebuild` entry in the generator's
hand-authored list next to `kivo-creator` (search the generator for `kivo-creator`). Replace the call
`syncCreator(isCheck, drift)` with `syncHandAuthored(isCheck, drift)`.

- [ ] **Step 6: Wire CI**

In `.github/workflows/ci.yml` add after the kivo-creator validation steps:

```yaml
      - name: Validate kivo-rebuild skills against the contract
        run: node scripts/validate-skills.mjs --root plugins/kivo-rebuild
```

next to the strict creator manifest validation:

```yaml
      - name: Validate the kivo-rebuild manifest (strict)
        run: claude plugin validate plugins/kivo-rebuild --strict
```

(copy any `if:`/`env:` keys from the creator step), and change the test step to
`node --test test/*.test.mjs test/creator/*.test.mjs test/rebuild/*.test.mjs`. Add `.rebuild-eval/` to `.gitignore`.

- [ ] **Step 7: Run the tests and the sync check**

Run: `node --test test/rebuild/manifests.test.mjs && node scripts/sync-codex-manifests.mjs --check && node scripts/build-codex-plugin.mjs --check`
Expected: 3 tests pass; both checks print "in sync".

- [ ] **Step 8: Commit**

```bash
git add plugins/kivo-rebuild test/rebuild scripts/sync-codex-manifests.mjs .release-please-config.json .release-please-manifest.json .claude-plugin .cursor-plugin .codex-plugin .agents .github/workflows/ci.yml .gitignore
git commit -m "feat(rebuild): scaffold kivo-rebuild plugin in the marketplace"
```

---

### Task 2: Core library — paths, state, schemas and validate

**Files:**
- Create: `plugins/kivo-rebuild/scripts/lib/args.mjs`, `lib/schema.mjs` (copies), `lib/paths.mjs`, `lib/state.mjs`,
  `scripts/validate.mjs`, `schemas/*.schema.json` (9 files)
- Test: `test/rebuild/state.test.mjs`, `test/rebuild/paths.test.mjs`

**Interfaces:**
- Produces:
  - `lib/args.mjs`: `parseOptions(argv, defaults, {flags})`, `runCli(importMetaUrl, main)` (verbatim copy).
  - `lib/schema.mjs`: `validate(schema, value)` → `string[]` (verbatim copy).
  - `lib/paths.mjs`: `normalizePath(input: string, origin?: string): string` (strips origin, decodes percent-encoding,
    lowercases the host part only, collapses `//`, adds a trailing slash to paths without a file extension and
    without a query, keeps the query sorted); `joinUrl(origin, path): string`.
  - `lib/state.mjs`: `KINDS` (array of schema names); `rebuildDir(project)`; `runDir(project, runId)`;
    `newRunId(slug, date = new Date())` → `'YYYY-MM-DD-<slug>'`; `latestRun(project)` → runId | null;
    `readDoc(file)` → object | null; `writeDoc(file, kind, body, {runId})` validates
    `{schema_version: 1, kind, run_id, generated_at, ...body}` against `schemas/<kind>.schema.json`, throws
    `Error('<file>: <errors joined>')` when invalid, writes via temp file + rename; `ensureGitignore(project)` writes
    `.rebuild/.gitignore` with `*`.
  - `scripts/validate.mjs --project=. --run=<id>`: validates every known file present in the run and in `.rebuild/`;
    exit 1 with `<file>: <error>` lines.

- [ ] **Step 1: Copy the two helpers**

```bash
mkdir -p plugins/kivo-rebuild/scripts/lib plugins/kivo-rebuild/schemas
cp plugins/kivo-creator/scripts/lib/args.mjs plugins/kivo-creator/scripts/lib/schema.mjs plugins/kivo-rebuild/scripts/lib/
sed -i 's#plugins/kivo-creator/#plugins/kivo-rebuild/#' plugins/kivo-rebuild/scripts/lib/args.mjs plugins/kivo-rebuild/scripts/lib/schema.mjs
```

- [ ] **Step 2: Write failing tests**

```js
// test/rebuild/paths.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePath, joinUrl } from '../../plugins/kivo-rebuild/scripts/lib/paths.mjs';

test('normalizePath joins encoding, origin and trailing-slash variants', () => {
  const o = 'https://www.example.test';
  assert.equal(normalizePath('https://www.example.test/caf%C3%A9', o), '/café/');
  assert.equal(normalizePath('/café/'), '/café/');
  assert.equal(normalizePath('/a'), '/a/');
  assert.equal(normalizePath('//a//b'), '/a/b/');
  assert.equal(normalizePath('/file.pdf'), '/file.pdf');
  assert.equal(normalizePath('/?s=x&b=1'), '/?b=1&s=x');
  assert.equal(normalizePath('https://other.test/x', o), 'https://other.test/x/');
  assert.equal(normalizePath('/%E0%A4%A'), '/%E0%A4%A/');
});

test('joinUrl', () => {
  assert.equal(joinUrl('https://a.test/', '/x/'), 'https://a.test/x/');
});
```

```js
// test/rebuild/state.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpProject, run } from './helpers.mjs';
import { newRunId, runDir, writeDoc, readDoc, latestRun, ensureGitignore } from '../../plugins/kivo-rebuild/scripts/lib/state.mjs';

test('newRunId is date + slug', () => {
  assert.equal(newRunId('Acme Store', new Date('2026-01-02T10:00:00Z')), '2026-01-02-acme-store');
});

test('writeDoc validates, stamps and writes atomically', () => {
  const p = tmpProject();
  const id = newRunId('x');
  const file = join(runDir(p, id), 'urls.json');
  writeDoc(file, 'urls', { items: [{ path: '/', origin: 'sitemap', type: 'page', lastmod: null }] }, { runId: id });
  const doc = readDoc(file);
  assert.equal(doc.schema_version, 1);
  assert.equal(doc.kind, 'urls');
  assert.equal(doc.run_id, id);
  assert.equal(latestRun(p), id);
  assert.throws(() => writeDoc(file, 'urls', { items: [{ path: 'no-slash' }] }, { runId: id }), /urls\.json/);
  assert.equal(readDoc(file).items[0].path, '/');
});

test('ensureGitignore ignores everything under .rebuild', () => {
  const p = tmpProject();
  ensureGitignore(p);
  assert.equal(readFileSync(join(p, '.rebuild', '.gitignore'), 'utf8'), '*\n');
});

test('validate.mjs reports invalid files', () => {
  const p = tmpProject();
  const dir = join(p, '.rebuild', 'runs', 'r1');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'urls.json'), JSON.stringify({ schema_version: 1, kind: 'urls', run_id: 'r1', generated_at: 'x', items: [{ path: 'bad' }] }));
  const r = run('validate.mjs', ['--project=' + p, '--run=r1']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /urls\.json: \$\.items\[0\]\.path: does not match/);
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `node --test test/rebuild/paths.test.mjs test/rebuild/state.test.mjs`
Expected: FAIL (`Cannot find module .../lib/paths.mjs`).

- [ ] **Step 4: Implement `lib/paths.mjs`**

```js
// plugins/kivo-rebuild/scripts/lib/paths.mjs
/** Canonical form used to join sitemap, search and HTTP rows. */
export function normalizePath(input, origin = '') {
  let s = String(input).trim();
  let foreign = '';
  const m = s.match(/^https?:\/\/[^/?#]+/i);
  if (m) {
    const host = m[0].toLowerCase();
    if (origin && host === origin.replace(/\/$/, '').toLowerCase()) s = s.slice(m[0].length) || '/';
    else { foreign = host; s = s.slice(m[0].length) || '/'; }
  }
  s = s.split('#')[0];
  let [path, query = ''] = s.split('?');
  try { path = decodeURIComponent(path); } catch { /* keep undecodable input as is */ }
  path = ('/' + path).replace(/\/{2,}/g, '/');
  const last = path.split('/').pop();
  if (!query && !/\.[a-z0-9]{2,5}$/i.test(last) && !path.endsWith('/')) path += '/';
  if (query) query = query.split('&').filter(Boolean).sort().join('&');
  return foreign + path + (query ? '?' + query : '');
}

export function joinUrl(origin, path) {
  return origin.replace(/\/$/, '') + (path.startsWith('/') ? path : '/' + path);
}
```

Note: `'/?s=x&b=1'` → path `/` (already ends with `/`), query sorted → `/?b=1&s=x`.

- [ ] **Step 5: Write the nine schemas**

Common envelope (repeat in each file; `items` differs):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["schema_version", "kind", "run_id", "generated_at"],
  "properties": {
    "schema_version": { "const": 1 },
    "kind": { "const": "<KIND>" },
    "run_id": { "type": "string", "minLength": 1 },
    "generated_at": { "type": "string" },
    "items": { "type": "array", "items": { "$ref": "#/$defs/item" } }
  },
  "$defs": { "item": { } }
}
```

`$defs.item` per kind (all `"type": "object"`, `"additionalProperties": false` unless stated):

- `urls`: required `path`, `origin`, `type`; properties `path` `{type:string, pattern:"^(/|https?://)"}`, `origin`
  `{enum:[sitemap,search,both]}`, `sitemap` string, `type` string, `lastmod` `string|null`, `live` and `staging`
  `{$ref:#/$defs/http}|null`, `title`, `h1`, `canonical`, `robots` strings. `$defs.http`: object with `status`
  integer, `location` string, `ms` integer, `error` string.
- `signals`: top-level adds `sources` object (`gsc`, `ga4`: `{period:string, path:enum[api,csv,mcp], rows:integer}|null`);
  item required `path`; properties `path`, `clicks`, `impressions` integers ≥ 0, `ctr`, `position` numbers,
  `sessions`, `conversions` integers ≥ 0 or null.
- `inventory`: item = urls item properties plus `clicks`, `impressions` (`integer|null`), `position` (`number|null`),
  `sessions` (`integer|null`), `proposed` `{enum:[keep,redirect,gone,noindex,review]}`, `reason` string, `rule_id`
  `{pattern:"^R\\d{2}$"}`, `final` `{enum:[keep,redirect,gone,noindex,null]}` (type `["string","null"]`), `target`
  string, `decided_by` string, `note` string, `issue` integer; required `path`, `type`, `proposed`, `reason`,
  `rule_id`.
- `templates`: item required `group`, `label`, `template`, `count`; properties `group` `{pattern:"^[a-z0-9-]+$"}`,
  `label`, `template`, `blocks` (array of string), `count`, `clicks` integers, `samples` (array of string, path
  pattern), `status` `{enum:[todo,ok,issues,na]}`, `note` string.
- `features`: item required `id`, `area`, `name`, `source`, `behaviour`; `id` `{pattern:"^F-[a-z0-9-]+$"}`, `area`,
  `name`, `source`, `behaviour`, `evidence` strings, `data` object (`additionalProperties: {type: integer}`),
  `kion` `{pattern:"^INV-\\d{3,}$"}`.
- `parity`: item required `feature`, `class`, `priority`; `feature` (F- pattern), `class`
  `{enum:[done,partial,missing-planned,missing-not-planned,dropped,data-only]}`, `priority` `{enum:[P0,P1,P2,P3]}`,
  `location`, `owner`, `note`, `decision` strings.
- `config` (no `run_id` required: envelope `required` is `["schema_version","kind"]`): properties `live` (string,
  `^https?://`), `staging` string, `legacy` string, `slug` string, `import_date` string, `types` object
  (`additionalProperties: {type:string}`, maps sitemap stem to type), `templates` (array of
  `{group,label,template,match:{type?,prefix?,regex?}}`), `rules` object `{disable: string[], junk_prefixes: string[],
  tag_types: string[], file_ext: string[]}`, `gsc` `{property, service_account}`, `ga4` `{property_id,
  service_account}`, `gtm` `{account_id, container_id}`, `cloudflare` `{zone_id, token_ref}`, `staging_access`
  `{headers_ref}`, `redirects_csv` string. Values that look like credentials are only accepted as references:
  `token_ref` and `headers_ref` pattern `^(op://|tf-output:)`.
- `connections` (envelope without `run_id`): item required `source`, `path`, `ok`, `tested_at`; `source`
  `{enum:[gsc,ga4,gtm,pagespeed,cloudflare,playwright,bing,rdstation,merchant]}`, `path`
  `{enum:[mcp,api,manual,none]}`, `identity`, `error`, `tested_at` strings, `ok` boolean.
- `setup-plan`: top-level adds required `hash` string and `actions` array (instead of `items`); action required `id`,
  `provider`, `op`, `resource`, `change`, `undo`; `provider` `{enum:[ga4,gtm,gsc,cloudflare]}`, `op` string,
  `resource` string, `params` object (any properties), `change`, `undo` strings, `status`
  `{enum:[planned,applied,failed]}`, `result` object.

- [ ] **Step 6: Implement `lib/state.mjs`**

```js
// plugins/kivo-rebuild/scripts/lib/state.mjs
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './schema.mjs';

const SCHEMAS = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'schemas');
export const KINDS = ['config', 'connections', 'urls', 'signals', 'inventory', 'templates', 'features', 'parity', 'setup-plan'];
const cache = new Map();
export function schemaFor(kind) {
  if (!KINDS.includes(kind)) throw new Error(`unknown kind ${kind}`);
  if (!cache.has(kind)) cache.set(kind, JSON.parse(readFileSync(join(SCHEMAS, `${kind}.schema.json`), 'utf8')));
  return cache.get(kind);
}

export const rebuildDir = (project) => join(resolve(project), '.rebuild');
export const runDir = (project, runId) => join(rebuildDir(project), 'runs', runId);

export function newRunId(slug, date = new Date()) {
  const s = String(slug).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${date.toISOString().slice(0, 10)}-${s}`;
}

export function latestRun(project) {
  const dir = join(rebuildDir(project), 'runs');
  if (!existsSync(dir)) return null;
  const ids = readdirSync(dir).filter((d) => /^\d{4}-\d{2}-\d{2}-/.test(d)).sort();
  return ids.at(-1) ?? null;
}

export function readDoc(file) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

export function checkDoc(kind, doc) {
  return validate(schemaFor(kind), doc);
}

export function writeDoc(file, kind, body, { runId } = {}) {
  const doc = { schema_version: 1, kind, ...(runId ? { run_id: runId } : {}), generated_at: new Date().toISOString(), ...body };
  const errors = checkDoc(kind, doc);
  if (errors.length) throw new Error(`${file}: ${errors.slice(0, 20).join('; ')}`);
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(doc, null, 2) + '\n');
  renameSync(tmp, file);
  return doc;
}

export function ensureGitignore(project) {
  mkdirSync(rebuildDir(project), { recursive: true });
  writeFileSync(join(rebuildDir(project), '.gitignore'), '*\n');
}
```

- [ ] **Step 7: Implement `scripts/validate.mjs`**

```js
#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/validate.mjs
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { KINDS, checkDoc, latestRun, rebuildDir, runDir } from './lib/state.mjs';

export function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '' });
  const runId = o.run || latestRun(o.project);
  const files = [join(rebuildDir(o.project), 'config.json'), join(rebuildDir(o.project), 'connections.json')];
  if (runId) for (const k of KINDS) if (!['config', 'connections'].includes(k)) files.push(join(runDir(o.project, runId), `${k}.json`));
  let bad = 0;
  for (const f of files.filter(existsSync)) {
    let doc;
    try { doc = JSON.parse(readFileSync(f, 'utf8')); } catch (e) { console.error(`${f}: invalid JSON: ${e.message}`); bad++; continue; }
    const errors = checkDoc(doc.kind, doc);
    if (errors.length) { bad++; for (const e of errors) console.error(`${f}: ${e}`); } else console.log(`ok ${f}`);
  }
  if (bad) process.exitCode = 1;
}

runCli(import.meta.url, main);
```

The test expects the error line to contain `urls.json: $.items[0].path: does not match`; `console.error` prints the
full path, which ends with `urls.json`.

- [ ] **Step 8: Run tests**

Run: `node --test test/rebuild/paths.test.mjs test/rebuild/state.test.mjs`
Expected: PASS (all).

- [ ] **Step 9: Commit**

```bash
git add plugins/kivo-rebuild/scripts plugins/kivo-rebuild/schemas test/rebuild
git commit -m "feat(rebuild): state, schemas and validator"
```

---

### Task 3: Sitemap crawl

**Files:**
- Create: `plugins/kivo-rebuild/scripts/lib/http.mjs`, `scripts/crawl-sitemap.mjs`
- Test: `test/rebuild/crawl.test.mjs`, fixtures `test/fixtures/rebuild/sitemaps/*.xml`

**Interfaces:**
- Consumes: `normalizePath`, `writeDoc`, `runDir`, `newRunId`, `ensureGitignore`, `parseOptions`, `runCli`.
- Produces:
  - `lib/http.mjs`: `fetchText(url, {headers, timeoutMs=20000, fetchImpl=fetch, redirect='follow'})` →
    `{status, text, location, ms, error?}` (never throws); `pool(items, worker, {concurrency, onResult, shouldStop})`
    runs `worker(item)` with adaptive concurrency: after 3 consecutive results with status 429 or ≥ 500 halves the
    concurrency (min 1); stops scheduling when `shouldStop()` returns true.
  - `crawl-sitemap.mjs`: exported `crawl({origin, start, fetchImpl, types})` → `{urls, failures}`; CLI
    `--project=. --live=<url> [--sitemap=<url>] [--run=<id>]` writes `urls.json` (items with `origin:'sitemap'`) and
    prints `N urls, M failed sitemaps`. Type: sitemap file stem before `-sitemap` (`product-sitemap3.xml` →
    `product`), mapped through `config.types` when present; else `page`.

- [ ] **Step 1: Fixtures**

`test/fixtures/rebuild/sitemaps/index.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://www.example.test/page-sitemap.xml</loc></sitemap>
  <sitemap><loc>https://www.example.test/product-sitemap.xml</loc></sitemap>
  <sitemap><loc>https://www.example.test/product-sitemap2.xml</loc></sitemap>
  <sitemap><loc>https://www.example.test/broken-sitemap.xml</loc></sitemap>
  <sitemap><loc>https://www.example.test/html-sitemap.xml</loc></sitemap>
</sitemapindex>
```

`page-sitemap.xml`: `<urlset>` with `<url><loc>https://www.example.test/</loc><lastmod>2026-01-01T00:00:00+00:00</lastmod></url>`
and `<url><loc>https://www.example.test/about</loc></url>`. `product-sitemap.xml`: one url
`https://www.example.test/product/caf%C3%A9/` with lastmod `2026-02-01`. `product-sitemap2.xml`: url
`https://www.example.test/product/tea/` and a duplicate `https://www.example.test/product/café/`. `broken-sitemap.xml`
is not created (404 in the fake fetch). `html-sitemap.xml` content: `<!doctype html><html><body>login</body></html>`.

- [ ] **Step 2: Failing test**

```js
// test/rebuild/crawl.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIX } from './helpers.mjs';
import { crawl } from '../../plugins/kivo-rebuild/scripts/crawl-sitemap.mjs';

const fakeFetch = async (url) => {
  const name = new URL(url).pathname.slice(1);
  const file = join(FIX, 'sitemaps', name === 'sitemap_index.xml' ? 'index.xml' : name);
  if (!existsSync(file)) return new Response('not found', { status: 404 });
  return new Response(readFileSync(file, 'utf8'), { status: 200, headers: { 'content-type': name.startsWith('html') ? 'text/html' : 'application/xml' } });
};

test('crawl follows the index, types by stem, dedupes, records failures', async () => {
  const { urls, failures } = await crawl({ origin: 'https://www.example.test', start: 'https://www.example.test/sitemap_index.xml', fetchImpl: fakeFetch, types: { product: 'product' } });
  const paths = urls.map((u) => u.path).sort();
  assert.deepEqual(paths, ['/', '/about/', '/product/café/', '/product/tea/']);
  assert.equal(urls.find((u) => u.path === '/product/café/').type, 'product');
  assert.equal(urls.find((u) => u.path === '/product/café/').lastmod, '2026-02-01');
  assert.equal(urls.find((u) => u.path === '/').lastmod, '2026-01-01');
  assert.equal(urls.find((u) => u.path === '/about/').type, 'page');
  assert.deepEqual(failures.map((f) => f.sitemap).sort(), ['broken-sitemap.xml', 'html-sitemap.xml']);
  assert.match(failures.find((f) => f.sitemap === 'html-sitemap.xml').error, /not a sitemap/);
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `node --test test/rebuild/crawl.test.mjs` — Expected: FAIL (module not found).

- [ ] **Step 4: Implement `lib/http.mjs`**

```js
// plugins/kivo-rebuild/scripts/lib/http.mjs
export async function fetchText(url, { headers = {}, timeoutMs = 20000, fetchImpl = fetch, redirect = 'follow', method = 'GET' } = {}) {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { headers, redirect, method, signal: ctrl.signal });
    const text = method === 'HEAD' ? '' : await res.text();
    return { status: res.status, text, location: res.headers.get('location') ?? '', contentType: res.headers.get('content-type') ?? '', ms: Date.now() - started };
  } catch (e) {
    return { status: 0, text: '', location: '', contentType: '', ms: Date.now() - started, error: String(e?.message ?? e).slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

export async function pool(items, worker, { concurrency = 4, onResult = () => {}, shouldStop = () => false } = {}) {
  let limit = Math.max(1, concurrency);
  let next = 0;
  let active = 0;
  let badStreak = 0;
  await new Promise((resolveAll) => {
    const pump = () => {
      if ((next >= items.length || shouldStop()) && active === 0) return resolveAll();
      while (active < limit && next < items.length && !shouldStop()) {
        const item = items[next++];
        active++;
        Promise.resolve(worker(item)).then((result) => {
          active--;
          const s = result?.status ?? 0;
          badStreak = s === 429 || s >= 500 ? badStreak + 1 : 0;
          if (badStreak >= 3) { limit = Math.max(1, Math.floor(limit / 2)); badStreak = 0; }
          onResult(item, result);
          pump();
        });
      }
    };
    pump();
  });
  return { finalConcurrency: limit };
}
```

- [ ] **Step 5: Implement `crawl-sitemap.mjs`**

```js
#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/crawl-sitemap.mjs
import { join } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { fetchText } from './lib/http.mjs';
import { normalizePath } from './lib/paths.mjs';
import { ensureGitignore, newRunId, readDoc, rebuildDir, runDir, writeDoc } from './lib/state.mjs';

const tagValues = (xml, tag) => [...xml.matchAll(new RegExp(`<${tag}>\\s*([^<]+?)\\s*</${tag}>`, 'g'))].map((m) => m[1].trim());

function stemType(sitemapName, types) {
  const stem = sitemapName.replace(/\.xml$/, '').replace(/-?sitemap\d*$/, '');
  return types?.[stem] ?? (stem || 'page');
}

export async function crawl({ origin, start, fetchImpl = fetch, types = {}, headers = {} }) {
  const seen = new Set();
  const urls = new Map();
  const failures = [];
  const queue = [start];
  while (queue.length) {
    const sm = queue.shift();
    if (seen.has(sm)) continue;
    seen.add(sm);
    const name = new URL(sm).pathname.split('/').pop();
    const r = await fetchText(sm, { fetchImpl, headers });
    if (r.status !== 200) { failures.push({ sitemap: name, error: r.error ?? `HTTP ${r.status}` }); continue; }
    if (!/<(urlset|sitemapindex)[\s>]/.test(r.text)) { failures.push({ sitemap: name, error: 'not a sitemap (no urlset/sitemapindex)' }); continue; }
    if (/<sitemapindex[\s>]/.test(r.text)) { queue.push(...tagValues(r.text, 'loc')); continue; }
    const type = stemType(name, types);
    for (const block of r.text.split(/<url>/).slice(1)) {
      const loc = tagValues(block, 'loc')[0];
      if (!loc) continue;
      const path = normalizePath(loc.replace(/&amp;/g, '&'), origin);
      const lastmod = (tagValues(block, 'lastmod')[0] ?? '').slice(0, 10) || null;
      if (!urls.has(path)) urls.set(path, { path, origin: 'sitemap', sitemap: name, type, lastmod });
    }
  }
  return { urls: [...urls.values()], failures };
}

export async function main(argv) {
  const o = parseOptions(argv, { project: '.', live: '', sitemap: '', run: '' });
  const config = readDoc(join(rebuildDir(o.project), 'config.json')) ?? {};
  const live = (o.live || config.live || '').replace(/\/$/, '');
  if (!live) throw new Error('--live=<url> or config.live is required');
  const runId = o.run || newRunId(config.slug || new URL(live).hostname);
  ensureGitignore(o.project);
  const { urls, failures } = await crawl({ origin: live, start: o.sitemap || `${live}/sitemap_index.xml`, types: config.types });
  writeDoc(join(runDir(o.project, runId), 'urls.json'), 'urls', { items: urls, failures }, { runId });
  console.log(`${urls.length} urls, ${failures.length} failed sitemaps (run ${runId})`);
  for (const f of failures) console.error(`failed ${f.sitemap}: ${f.error}`);
}

runCli(import.meta.url, main);
```

Add `failures` to the `urls` schema top level: array of `{sitemap: string, error: string}`.

- [ ] **Step 6: Run tests** — `node --test test/rebuild/crawl.test.mjs` → PASS.

- [ ] **Step 7: Commit**

```bash
git add plugins/kivo-rebuild test/rebuild test/fixtures/rebuild
git commit -m "feat(rebuild): sitemap crawl with typed urls"
```

---

### Task 4: HTTP check (live and staging), resumable, gate detection

**Files:**
- Create: `plugins/kivo-rebuild/scripts/lib/credentials.mjs`, `scripts/check-http.mjs`
- Test: `test/rebuild/check-http.test.mjs`, `test/rebuild/credentials.test.mjs`

**Interfaces:**
- Consumes: `fetchText`, `pool`, `normalizePath`, `joinUrl`, state helpers.
- Produces:
  - `lib/credentials.mjs`: `resolveHeaders(ref, {exec})` → object. `ref` forms: `op://vault/item` → runs
    `exec('op', ['item', 'get', <item>, '--vault', <vault>, '--format', 'json'])` and maps fields labelled
    `CF-Access-Client-Id` / `CF-Access-Client-Secret` (or any field whose label starts with `header:`) to headers;
    `tf-output:<dir>:<output>` → `exec('terraform', ['-chdir=' + dir, 'output', '-json', output])` expecting an object
    of header → value. Never logs values; returns `{}` for an empty ref. `exec` defaults to a `spawnSync` wrapper
    returning stdout and throwing on non-zero with the command name only (no output).
  - `check-http.mjs`: exported `checkAll({origin, paths, headers, fetchImpl, done, concurrency, maxErrorRate})` →
    `{results: Map<path,{status,location,ms,title,h1,canonical,robots,error?}>, aborted: string|null}`;
    `parseHead(html)` → `{title,h1,canonical,robots}`; `detectGate(results)` → reason string or null. CLI
    `--project=. --run=<id> --target=live|staging [--concurrency=4] [--limit=N]` streams to
    `runs/<id>/http-<target>.jsonl` (one JSON per line; rows with `error` are retried next run), then folds the
    results into `urls.json` field `live` / `staging` (plus `title`, `h1`, `canonical`, `robots` from the staging
    target when present, else live) and rewrites it with `writeDoc`.
  - Gate rule: among the first 50 results, if ≥ 80 % share the same status in {401, 403, 530} or are 3xx to the
    same location, abort with `access gate: <n> of <m> answered <status|redirect to X>`; exit code 2.
  - Error rate: stop when, after at least 50 results, more than `maxErrorRate` (default 0.1) have `status` 0 or ≥ 500.
  - Redirects are not followed (`redirect: 'manual'`), so `location` is recorded.

- [ ] **Step 1: Failing tests**

```js
// test/rebuild/check-http.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAll, parseHead } from '../../plugins/kivo-rebuild/scripts/check-http.mjs';

const page = (t) => `<html><head><title>${t}</title><link rel="canonical" href="https://x.test/a/"><meta name="robots" content="noindex"></head><body><h1> ${t} </h1></body></html>`;

test('parseHead', () => {
  assert.deepEqual(parseHead(page('Hi')), { title: 'Hi', h1: 'Hi', canonical: 'https://x.test/a/', robots: 'noindex' });
});

test('records status, location and head; skips done paths', async () => {
  const fetchImpl = async (url) => url.endsWith('/old/')
    ? new Response('', { status: 301, headers: { location: '/new/' } })
    : new Response(page('P'), { status: 200 });
  const { results, aborted } = await checkAll({ origin: 'https://s.test', paths: ['/a/', '/old/', '/done/'], done: new Set(['/done/']), fetchImpl });
  assert.equal(aborted, null);
  assert.equal(results.get('/a/').status, 200);
  assert.equal(results.get('/a/').title, 'P');
  assert.equal(results.get('/old/').location, '/new/');
  assert.equal(results.has('/done/'), false);
});

test('detects an access gate and aborts', async () => {
  const paths = Array.from({ length: 80 }, (_, i) => `/p${i}/`);
  const fetchImpl = async () => new Response('', { status: 302, headers: { location: 'https://login.example.test/' } });
  const { aborted } = await checkAll({ origin: 'https://s.test', paths, fetchImpl, concurrency: 4 });
  assert.match(aborted, /access gate: \d+ of 50 answered redirect to https:\/\/login\.example\.test\//);
});

test('stops when the error rate passes the limit', async () => {
  const paths = Array.from({ length: 200 }, (_, i) => `/p${i}/`);
  let n = 0;
  const fetchImpl = async () => (n++ % 2 ? new Response(page('x'), { status: 200 }) : new Response('', { status: 503 }));
  const { results, aborted } = await checkAll({ origin: 'https://s.test', paths, fetchImpl, concurrency: 2 });
  assert.match(aborted, /error rate/);
  assert.ok(results.size < 200);
});
```

```js
// test/rebuild/credentials.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveHeaders } from '../../plugins/kivo-rebuild/scripts/lib/credentials.mjs';

test('op reference maps labelled fields to headers', () => {
  const exec = (cmd, args) => {
    assert.equal(cmd, 'op');
    assert.deepEqual(args.slice(0, 4), ['item', 'get', 'staging-token', '--vault']);
    return JSON.stringify({ fields: [{ label: 'CF-Access-Client-Id', value: 'id1' }, { label: 'CF-Access-Client-Secret', value: 's1' }, { label: 'notes', value: 'x' }] });
  };
  assert.deepEqual(resolveHeaders('op://Infra/staging-token', { exec }), { 'CF-Access-Client-Id': 'id1', 'CF-Access-Client-Secret': 's1' });
});

test('terraform output reference', () => {
  const exec = (cmd, args) => { assert.equal(cmd, 'terraform'); assert.equal(args[0], '-chdir=infra/cf'); return '{"X-A":"1"}'; };
  assert.deepEqual(resolveHeaders('tf-output:infra/cf:staging_headers', { exec }), { 'X-A': '1' });
});

test('rejects literal values', () => {
  assert.throws(() => resolveHeaders('abc123'), /only op:\/\/ or tf-output:/);
});
```

- [ ] **Step 2: Run them to see them fail** — `node --test test/rebuild/check-http.test.mjs test/rebuild/credentials.test.mjs` → FAIL.

- [ ] **Step 3: Implement `lib/credentials.mjs`**

```js
// plugins/kivo-rebuild/scripts/lib/credentials.mjs
import { spawnSync } from 'node:child_process';

export function defaultExec(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status !== 0) throw new Error(`${cmd} ${args[0]} failed (exit ${r.status})`);
  return r.stdout;
}

const HEADER_LABELS = ['CF-Access-Client-Id', 'CF-Access-Client-Secret'];

export function resolveHeaders(ref, { exec = defaultExec } = {}) {
  if (!ref) return {};
  if (ref.startsWith('op://')) {
    const [vault, item] = ref.slice(5).split('/');
    const data = JSON.parse(exec('op', ['item', 'get', item, '--vault', vault, '--format', 'json']));
    const headers = {};
    for (const f of data.fields ?? []) {
      if (HEADER_LABELS.includes(f.label)) headers[f.label] = f.value;
      else if (f.label?.startsWith('header:')) headers[f.label.slice(7)] = f.value;
    }
    return headers;
  }
  if (ref.startsWith('tf-output:')) {
    const [, dir, output] = ref.split(':');
    return JSON.parse(exec('terraform', [`-chdir=${dir}`, 'output', '-json', output]));
  }
  throw new Error('credential references accept only op:// or tf-output: forms');
}

export function accessToken(serviceAccount, { exec = defaultExec } = {}) {
  const args = ['auth', 'print-access-token'];
  if (serviceAccount) args.push(`--impersonate-service-account=${serviceAccount}`);
  return exec('gcloud', args).trim();
}
```

- [ ] **Step 4: Implement `check-http.mjs`**

```js
#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/check-http.mjs
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { resolveHeaders } from './lib/credentials.mjs';
import { fetchText, pool } from './lib/http.mjs';
import { joinUrl } from './lib/paths.mjs';
import { latestRun, readDoc, rebuildDir, runDir, writeDoc } from './lib/state.mjs';

const clean = (s) => (s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
export function parseHead(html) {
  const pick = (re) => clean(html.match(re)?.[1]);
  return {
    title: pick(/<title[^>]*>([\s\S]*?)<\/title>/i),
    h1: pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i),
    canonical: pick(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)/i),
    robots: pick(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)/i),
  };
}

export function detectGate(results) {
  const first = [...results.values()].slice(0, 50);
  if (first.length < 50) return null;
  const keys = first.map((r) => ([401, 403, 530].includes(r.status) ? `answered ${r.status}` : r.status >= 300 && r.status < 400 ? `answered redirect to ${r.location}` : 'ok'));
  const counts = keys.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map());
  for (const [k, n] of counts) if (k !== 'ok' && n / first.length >= 0.8) return `access gate: ${n} of ${first.length} ${k}`;
  return null;
}

export async function checkAll({ origin, paths, headers = {}, fetchImpl = fetch, done = new Set(), concurrency = 4, maxErrorRate = 0.1, onRow = () => {} }) {
  const results = new Map();
  let aborted = null;
  let errors = 0;
  const todo = paths.filter((p) => !done.has(p));
  await pool(todo, async (path) => {
    const r = await fetchText(joinUrl(origin, path), { headers, fetchImpl, redirect: 'manual' });
    const row = { status: r.status, location: r.location, ms: r.ms, ...(r.status === 200 ? parseHead(r.text) : {}), ...(r.error ? { error: r.error } : {}) };
    return { path, ...row };
  }, {
    concurrency,
    shouldStop: () => aborted !== null,
    onResult: (path, row) => {
      if (aborted) return;
      const { path: _p, ...rest } = row;
      results.set(path, rest);
      onRow(path, rest);
      if (row.status === 0 || row.status >= 500) errors++;
      if (results.size === 50) aborted = detectGate(results);
      if (!aborted && results.size >= 50 && errors / results.size > maxErrorRate) aborted = `error rate ${(errors / results.size * 100).toFixed(0)}% above ${maxErrorRate * 100}%`;
    },
  });
  return { results, aborted };
}

export async function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '', target: 'live', concurrency: '4', limit: '0' });
  const runId = o.run || latestRun(o.project);
  if (!runId) throw new Error('no run: run crawl-sitemap.mjs first');
  const config = readDoc(join(rebuildDir(o.project), 'config.json')) ?? {};
  const origin = (o.target === 'staging' ? config.staging : config.live)?.replace(/\/$/, '');
  if (!origin) throw new Error(`config.${o.target} is not set`);
  const headers = o.target === 'staging' ? resolveHeaders(config.staging_access?.headers_ref) : {};
  const urlsFile = join(runDir(o.project, runId), 'urls.json');
  const urls = readDoc(urlsFile);
  const stream = join(runDir(o.project, runId), `http-${o.target}.jsonl`);
  const prior = new Map();
  if (existsSync(stream)) for (const line of readFileSync(stream, 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(line); prior.set(r.path, r); }
  const done = new Set([...prior.values()].filter((r) => !r.error && r.status !== 0).map((r) => r.path));
  let paths = urls.items.map((u) => u.path).filter((p) => p.startsWith('/'));
  if (Number(o.limit)) paths = paths.slice(0, Number(o.limit));
  const { aborted } = await checkAll({ origin, paths, headers, done, concurrency: Number(o.concurrency), onRow: (path, row) => { appendFileSync(stream, JSON.stringify({ path, ...row }) + '\n'); prior.set(path, { path, ...row }); } });
  for (const u of urls.items) {
    const r = prior.get(u.path);
    if (!r) continue;
    u[o.target] = { status: r.status, location: r.location ?? '', ms: r.ms ?? 0, ...(r.error ? { error: r.error } : {}) };
    for (const k of ['title', 'h1', 'canonical', 'robots']) if (r[k] && (o.target === 'staging' || !u[k])) u[k] = r[k];
  }
  const { schema_version, kind, run_id, generated_at, ...body } = urls;
  writeDoc(urlsFile, 'urls', body, { runId });
  console.log(`${o.target}: ${prior.size}/${paths.length} checked`);
  if (aborted) { console.error(`stopped: ${aborted}`); process.exitCode = 2; }
}

runCli(import.meta.url, main);
```

- [ ] **Step 5: Run tests** — `node --test test/rebuild/check-http.test.mjs test/rebuild/credentials.test.mjs` → PASS.

- [ ] **Step 6: Commit**

```bash
git add plugins/kivo-rebuild test/rebuild
git commit -m "feat(rebuild): resumable http check with access-gate and error-rate stops"
```

---

### Task 5: Connect — detection, read tests, connections.json

**Files:**
- Create: `plugins/kivo-rebuild/scripts/connect.mjs`,
  `scripts/lib/providers/{gsc,ga4,gtm,cloudflare,pagespeed}.mjs`
- Test: `test/rebuild/connect.test.mjs`

**Interfaces:**
- Consumes: `accessToken`, `resolveHeaders`, `defaultExec`, state helpers.
- Produces:
  - Each provider module exports `id` (connections `source` value), `async readTest({config, token, fetchImpl})` →
    `{ok, identity, error?}`; providers with setup also export `actions` (Task 12).
    - `gsc.readTest`: POST `https://searchconsole.googleapis.com/webmasters/v3/sites/<encoded property>/searchAnalytics/query`
      with `{startDate, endDate (last 7 days), dimensions:['page'], rowLimit:1}`; 403 → error
      `service account <sa> is not a user of <property>: add it in Search Console > Settings > Users and permissions`.
    - `ga4.readTest`: POST `https://analyticsdata.googleapis.com/v1beta/properties/<id>:runReport` with
      `{dateRanges:[{startDate:'7daysAgo',endDate:'today'}], metrics:[{name:'sessions'}], limit:1}`; 403 → error naming
      Admin > Property access management.
    - `gtm.readTest`: GET `https://tagmanager.googleapis.com/tagmanager/v2/accounts/<a>/containers/<c>`.
    - `cloudflare.readTest`: GET `https://api.cloudflare.com/client/v4/zones/<zone_id>` with the bearer token from
      `config.cloudflare.token_ref` resolved by the caller (the CLI runs under `op run`; the token env var name is
      `CLOUDFLARE_API_TOKEN`, read from `process.env` inside the provider, never printed).
    - `pagespeed.readTest`: GET `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=<live>&strategy=mobile&category=performance`
      (key optional via `PAGESPEED_API_KEY` env).
  - `connect.mjs`: exported `detect({exec})` → `{gcloud:boolean, gh:boolean, op:boolean, playwright:boolean}` (runs
    `<cmd> --version`; Playwright: `existsSync('node_modules/@playwright/test')` in the project); exported
    `testAll({config, providers, exec, fetchImpl, mcp})` → connection items. `mcp` is a list of source ids the skill
    tells the script are available as MCP servers (`--mcp=gsc,ga4`): for those the item gets `path:'mcp'`, `ok:true`,
    `identity:'mcp'` without an API call (the skill runs the MCP read test itself). For a source with no
    configuration the item gets `path:'none'`, `ok:false`, `error:'not configured'`. CLI
    `--project=. [--check] [--mcp=a,b] [--only=gsc,ga4]` writes `.rebuild/connections.json` and prints one line per
    source `<source> <path> ok|FAIL <identity|error>`; exit 1 when any configured source fails.
  - `bing`, `rdstation`, `merchant` and `playwright` sources have no API test in this slice: `path:'manual'` when the
    config has a key for them (`config.bing`, `config.rdstation`, `config.merchant`), playwright from `detect()`.

- [ ] **Step 1: Failing test**

```js
// test/rebuild/connect.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testAll } from '../../plugins/kivo-rebuild/scripts/connect.mjs';
import * as gsc from '../../plugins/kivo-rebuild/scripts/lib/providers/gsc.mjs';
import * as ga4 from '../../plugins/kivo-rebuild/scripts/lib/providers/ga4.mjs';

const config = { gsc: { property: 'sc-domain:example.test', service_account: 'reader@proj.iam.gserviceaccount.com' }, ga4: { property_id: '123', service_account: 'reader@proj.iam.gserviceaccount.com' } };
const exec = (cmd, args) => { if (cmd === 'gcloud' && args[1] === 'print-access-token') return 'tok\n'; return 'v1'; };

test('gsc ok, ga4 403 explains the human step, unconfigured is none', async () => {
  const fetchImpl = async (url, init) => {
    assert.equal(init.headers.Authorization, 'Bearer tok');
    if (url.includes('searchconsole')) return new Response(JSON.stringify({ rows: [{ keys: ['/'] }] }), { status: 200 });
    return new Response('{}', { status: 403 });
  };
  const items = await testAll({ config, providers: [gsc, ga4], exec, fetchImpl, mcp: [] });
  const by = Object.fromEntries(items.map((i) => [i.source, i]));
  assert.equal(by.gsc.ok, true);
  assert.equal(by.gsc.path, 'api');
  assert.equal(by.gsc.identity, 'reader@proj.iam.gserviceaccount.com');
  assert.equal(by.ga4.ok, false);
  assert.match(by.ga4.error, /Property access management/);
});

test('mcp sources skip the api call', async () => {
  const fetchImpl = async () => { throw new Error('must not call'); };
  const items = await testAll({ config, providers: [gsc], exec, fetchImpl, mcp: ['gsc'] });
  assert.deepEqual(items[0], { ...items[0], source: 'gsc', path: 'mcp', ok: true, identity: 'mcp' });
});

test('output never contains the token', async () => {
  const fetchImpl = async () => new Response('{}', { status: 500 });
  const items = await testAll({ config, providers: [gsc], exec, fetchImpl, mcp: [] });
  assert.doesNotMatch(JSON.stringify(items), /tok/);
});
```

- [ ] **Step 2: Run to see it fail** — `node --test test/rebuild/connect.test.mjs` → FAIL.

- [ ] **Step 3: Implement providers**

```js
// plugins/kivo-rebuild/scripts/lib/providers/gsc.mjs
export const id = 'gsc';
export const configured = (config) => Boolean(config.gsc?.property);
export const identityOf = (config) => config.gsc?.service_account || 'gcloud user';
const day = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
export const queryUrl = (property) => `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`;

export async function readTest({ config, token, fetchImpl = fetch }) {
  const res = await fetchImpl(queryUrl(config.gsc.property), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: day(8), endDate: day(1), dimensions: ['page'], rowLimit: 1 }),
  });
  if (res.ok) return { ok: true, identity: identityOf(config) };
  if (res.status === 403) return { ok: false, identity: identityOf(config), error: `${identityOf(config)} is not a user of ${config.gsc.property}: add it in Search Console > Settings > Users and permissions (Restricted is enough)` };
  return { ok: false, identity: identityOf(config), error: `HTTP ${res.status} from Search Console` };
}
```

```js
// plugins/kivo-rebuild/scripts/lib/providers/ga4.mjs
export const id = 'ga4';
export const configured = (config) => Boolean(config.ga4?.property_id);
export const identityOf = (config) => config.ga4?.service_account || 'gcloud user';
export const reportUrl = (pid) => `https://analyticsdata.googleapis.com/v1beta/properties/${pid}:runReport`;

export async function readTest({ config, token, fetchImpl = fetch }) {
  const res = await fetchImpl(reportUrl(config.ga4.property_id), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }], metrics: [{ name: 'sessions' }], limit: 1 }),
  });
  if (res.ok) return { ok: true, identity: identityOf(config) };
  if (res.status === 403) return { ok: false, identity: identityOf(config), error: `${identityOf(config)} has no access to GA4 property ${config.ga4.property_id}: add it as Viewer in Admin > Property access management` };
  return { ok: false, identity: identityOf(config), error: `HTTP ${res.status} from GA4 Data API` };
}
```

```js
// plugins/kivo-rebuild/scripts/lib/providers/gtm.mjs
export const id = 'gtm';
export const configured = (config) => Boolean(config.gtm?.account_id && config.gtm?.container_id);
export const identityOf = (config) => config.gtm?.service_account || config.gsc?.service_account || 'gcloud user';
export const base = (config) => `https://tagmanager.googleapis.com/tagmanager/v2/accounts/${config.gtm.account_id}/containers/${config.gtm.container_id}`;

export async function readTest({ config, token, fetchImpl = fetch }) {
  const res = await fetchImpl(base(config), { headers: { Authorization: `Bearer ${token}` } });
  if (res.ok) return { ok: true, identity: identityOf(config) };
  if (res.status === 403) return { ok: false, identity: identityOf(config), error: `${identityOf(config)} has no access to container ${config.gtm.container_id}: add it in Tag Manager > Admin > User Management (Read)` };
  return { ok: false, identity: identityOf(config), error: `HTTP ${res.status} from Tag Manager API` };
}
```

```js
// plugins/kivo-rebuild/scripts/lib/providers/cloudflare.mjs
export const id = 'cloudflare';
export const configured = (config) => Boolean(config.cloudflare?.zone_id);
export const usesGoogleToken = false;
export async function readTest({ config, fetchImpl = fetch, env = process.env }) {
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!token) return { ok: false, identity: 'api token', error: `CLOUDFLARE_API_TOKEN not set: run connect under op run with ${config.cloudflare.token_ref ?? 'an op:// reference in config.cloudflare.token_ref'}` };
  const res = await fetchImpl(`https://api.cloudflare.com/client/v4/zones/${config.cloudflare.zone_id}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.ok ? { ok: true, identity: 'api token' } : { ok: false, identity: 'api token', error: `HTTP ${res.status} from Cloudflare` };
}
```

```js
// plugins/kivo-rebuild/scripts/lib/providers/pagespeed.mjs
export const id = 'pagespeed';
export const configured = (config) => Boolean(config.live);
export const usesGoogleToken = false;
export async function readTest({ config, fetchImpl = fetch, env = process.env }) {
  const key = env.PAGESPEED_API_KEY ? `&key=${env.PAGESPEED_API_KEY}` : '';
  const res = await fetchImpl(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(config.live)}&strategy=mobile&category=performance${key}`);
  return res.ok ? { ok: true, identity: key ? 'api key' : 'anonymous' } : { ok: false, identity: 'anonymous', error: `HTTP ${res.status} from PageSpeed (429 means set PAGESPEED_API_KEY through op run)` };
}
```

- [ ] **Step 4: Implement `connect.mjs`**

```js
#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/connect.mjs
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { accessToken, defaultExec } from './lib/credentials.mjs';
import { readDoc, rebuildDir, writeDoc, ensureGitignore } from './lib/state.mjs';
import * as gsc from './lib/providers/gsc.mjs';
import * as ga4 from './lib/providers/ga4.mjs';
import * as gtm from './lib/providers/gtm.mjs';
import * as cloudflare from './lib/providers/cloudflare.mjs';
import * as pagespeed from './lib/providers/pagespeed.mjs';

export const PROVIDERS = [gsc, ga4, gtm, cloudflare, pagespeed];
const MANUAL = ['bing', 'rdstation', 'merchant'];

export function detect({ exec = defaultExec, project = '.' } = {}) {
  const has = (cmd) => { try { exec(cmd, ['--version']); return true; } catch { return false; } };
  return { gcloud: has('gcloud'), gh: has('gh'), op: has('op'), playwright: existsSync(join(project, 'node_modules', '@playwright', 'test')) };
}

export async function testAll({ config, providers = PROVIDERS, exec = defaultExec, fetchImpl = fetch, mcp = [], env = process.env }) {
  const items = [];
  const tokens = new Map();
  const now = () => new Date().toISOString();
  for (const p of providers) {
    if (mcp.includes(p.id)) { items.push({ source: p.id, path: 'mcp', ok: true, identity: 'mcp', tested_at: now() }); continue; }
    if (!p.configured(config)) { items.push({ source: p.id, path: 'none', ok: false, error: 'not configured', tested_at: now() }); continue; }
    let token = '';
    if (p.usesGoogleToken !== false) {
      const sa = config[p.id]?.service_account ?? config.gsc?.service_account ?? '';
      try {
        if (!tokens.has(sa)) tokens.set(sa, accessToken(sa, { exec }));
        token = tokens.get(sa);
      } catch (e) {
        items.push({ source: p.id, path: 'api', ok: false, identity: sa || 'gcloud user', error: `${e.message}: run gcloud auth login (and grant roles/iam.serviceAccountTokenCreator on ${sa || 'the service account'})`, tested_at: now() });
        continue;
      }
    }
    let r;
    try { r = await p.readTest({ config, token, fetchImpl, env }); } catch (e) { r = { ok: false, identity: '', error: String(e.message).slice(0, 200) }; }
    items.push({ source: p.id, path: 'api', ok: r.ok, identity: r.identity ?? '', ...(r.error ? { error: r.error } : {}), tested_at: now() });
  }
  return items;
}

export async function main(argv) {
  const o = parseOptions(argv, { project: '.', check: false, mcp: '', only: '' });
  const config = readDoc(join(rebuildDir(o.project), 'config.json'));
  if (!config) throw new Error('.rebuild/config.json missing: the connect skill writes it first');
  ensureGitignore(o.project);
  const only = o.only ? o.only.split(',') : null;
  const providers = PROVIDERS.filter((p) => !only || only.includes(p.id));
  const items = await testAll({ config, providers, mcp: o.mcp ? o.mcp.split(',') : [] });
  const tools = detect({ project: o.project });
  items.push({ source: 'playwright', path: tools.playwright ? 'api' : 'none', ok: tools.playwright, tested_at: new Date().toISOString(), ...(tools.playwright ? {} : { error: 'install @playwright/test in the project' }) });
  for (const m of MANUAL) if (config[m]) items.push({ source: m, path: 'manual', ok: true, identity: 'export', tested_at: new Date().toISOString() });
  writeDoc(join(rebuildDir(o.project), 'connections.json'), 'connections', { items, tools });
  for (const i of items) console.log(`${i.source} ${i.path} ${i.ok ? 'ok' : 'FAIL'} ${i.ok ? i.identity ?? '' : i.error}`);
  if (items.some((i) => !i.ok && i.path !== 'none')) process.exitCode = 1;
}

runCli(import.meta.url, main);
```

Add `tools` (object of booleans) to the connections schema top level.

- [ ] **Step 5: Run tests** — `node --test test/rebuild/connect.test.mjs` → PASS.

- [ ] **Step 6: Commit**

```bash
git add plugins/kivo-rebuild test/rebuild
git commit -m "feat(rebuild): connect detects tools and tests read access per source"
```

---

### Task 6: Search signals — Search Console and GA4 (API and CSV)

**Files:**
- Create: `plugins/kivo-rebuild/scripts/lib/csv.mjs`, `scripts/gsc.mjs`, `scripts/ga4.mjs`
- Test: `test/rebuild/signals.test.mjs`, fixtures `test/fixtures/rebuild/gsc/pages-en.csv`, `pages-pt.csv`

**Interfaces:**
- Consumes: providers `gsc.queryUrl`, `ga4.reportUrl`, `accessToken`, `normalizePath`, state helpers.
- Produces:
  - `lib/csv.mjs`: `parseCsv(text)` → `string[][]` (RFC 4180: quotes, escaped quotes, CRLF, BOM stripped);
    `toCsv(rows: object[], columns: string[])` → string.
  - `gsc.mjs`: exported `fromCsv(text, origin)` → `Map<path,{clicks,impressions,ctr,position}>` (headers matched
    case-insensitively against `['top pages','páginas principais','page','página']`, `['clicks','cliques']`,
    `['impressions','impressões']`, `['ctr']`, `['position','posição']`; CTR `"1,5%"` or `"1.5%"` → 0.015; numbers
    with `.` or `,` thousands separators); exported `fromApi({property, token, start, end, fetchImpl})` pages through
    `startRow` with `rowLimit: 25000` until a page returns fewer rows. CLI
    `--project=. --run=<id> [--csv=<file>] [--months=16]` merges into `signals.json`, setting `sources.gsc`.
  - `ga4.mjs`: exported `fromApi({propertyId, token, start, end, fetchImpl})` → `Map<path,{sessions,conversions}>`
    (dimension `pagePath`, metrics `sessions`, `keyEvents`; pages with `offset`/`limit` 100000); CLI
    `--project=. --run=<id> [--months=16]` merges into `signals.json`, setting `sources.ga4`.
  - Merge rule: `signals.json` items are keyed by normalized path; each CLI replaces only its own fields and its own
    `sources` entry.

- [ ] **Step 1: Fixtures**

`pages-en.csv`:

```
Top pages,Clicks,Impressions,CTR,Position
https://www.example.test/,"1,204","40,100",3%,4.2
https://www.example.test/product/caf%C3%A9/,10,500,2%,8.1
https://www.example.test/tag/old/,0,12,0%,40
```

`pages-pt.csv` (with a UTF-8 BOM):

```
Páginas principais,Cliques,Impressões,CTR,Posição
https://www.example.test/,1.204,40.100,"3,0%","4,2"
```

- [ ] **Step 2: Failing tests**

```js
// test/rebuild/signals.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIX } from './helpers.mjs';
import { parseCsv, toCsv } from '../../plugins/kivo-rebuild/scripts/lib/csv.mjs';
import { fromCsv, fromApi } from '../../plugins/kivo-rebuild/scripts/gsc.mjs';
import { fromApi as ga4FromApi } from '../../plugins/kivo-rebuild/scripts/ga4.mjs';

const O = 'https://www.example.test';

test('csv round trip with quotes', () => {
  assert.deepEqual(parseCsv('a,"b ""x"", y"\r\n1,2\n'), [['a', 'b "x", y'], ['1', '2']]);
  assert.equal(toCsv([{ a: 'x,y', b: 1 }], ['a', 'b']), 'a,b\n"x,y",1\n');
});

test('english and portuguese exports give the same numbers', () => {
  const en = fromCsv(readFileSync(join(FIX, 'gsc', 'pages-en.csv'), 'utf8'), O);
  const pt = fromCsv(readFileSync(join(FIX, 'gsc', 'pages-pt.csv'), 'utf8'), O);
  assert.deepEqual(en.get('/'), { clicks: 1204, impressions: 40100, ctr: 0.03, position: 4.2 });
  assert.deepEqual(pt.get('/'), en.get('/'));
  assert.equal(en.get('/product/café/').clicks, 10);
});

test('api pages until a short page', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body.startRow);
    const rows = body.startRow === 0 ? Array.from({ length: 25000 }, (_, i) => ({ keys: [`${O}/p${i}/`], clicks: 1, impressions: 2, ctr: 0.5, position: 3 })) : [{ keys: [`${O}/last/`], clicks: 0, impressions: 1, ctr: 0, position: 9 }];
    return new Response(JSON.stringify({ rows }), { status: 200 });
  };
  const m = await fromApi({ property: 'sc-domain:example.test', token: 't', start: '2025-01-01', end: '2026-01-01', fetchImpl, origin: O });
  assert.deepEqual(calls, [0, 25000]);
  assert.equal(m.size, 25001);
  assert.equal(m.get('/last/').impressions, 1);
});

test('ga4 pages and maps keyEvents to conversions', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ rowCount: 1, rows: [{ dimensionValues: [{ value: '/a' }], metricValues: [{ value: '10' }, { value: '2' }] }] }), { status: 200 });
  const m = await ga4FromApi({ propertyId: '1', token: 't', start: '2025-01-01', end: '2026-01-01', fetchImpl });
  assert.deepEqual(m.get('/a/'), { sessions: 10, conversions: 2 });
});
```

- [ ] **Step 3: Run to see it fail** — `node --test test/rebuild/signals.test.mjs` → FAIL.

- [ ] **Step 4: Implement `lib/csv.mjs`**

```js
// plugins/kivo-rebuild/scripts/lib/csv.mjs
export function parseCsv(text) {
  const s = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || r[0] !== '');
}

const cell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function toCsv(rows, columns) {
  return [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n') + '\n';
}
```

- [ ] **Step 5: Implement `gsc.mjs`**

```js
#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/gsc.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { accessToken } from './lib/credentials.mjs';
import { parseCsv } from './lib/csv.mjs';
import { normalizePath } from './lib/paths.mjs';
import { queryUrl } from './lib/providers/gsc.mjs';
import { latestRun, readDoc, rebuildDir, runDir } from './lib/state.mjs';
import { mergeSignals, period } from './lib/signals.mjs';

const HEAD = {
  path: ['top pages', 'páginas principais', 'page', 'página', 'pages', 'páginas'],
  clicks: ['clicks', 'cliques'],
  impressions: ['impressions', 'impressões'],
  ctr: ['ctr'],
  position: ['position', 'posição'],
};

export function num(v) {
  let s = String(v ?? '').trim().replace('%', '');
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
  else s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function fromCsv(text, origin) {
  const [header, ...rows] = parseCsv(text);
  const idx = {};
  for (const [k, names] of Object.entries(HEAD)) idx[k] = header.findIndex((h) => names.includes(h.trim().toLowerCase()));
  if (idx.path < 0 || idx.clicks < 0) throw new Error(`unrecognised Search Console export header: ${header.join(', ')}`);
  const out = new Map();
  for (const r of rows) {
    out.set(normalizePath(r[idx.path], origin), {
      clicks: Math.round(num(r[idx.clicks])),
      impressions: Math.round(num(r[idx.impressions])),
      ctr: Math.round(num(r[idx.ctr]) / 100 * 10000) / 10000,
      position: num(r[idx.position]),
    });
  }
  return out;
}

export async function fromApi({ property, token, start, end, fetchImpl = fetch, origin = '' }) {
  const out = new Map();
  for (let startRow = 0; ; startRow += 25000) {
    const res = await fetchImpl(queryUrl(property), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: start, endDate: end, dimensions: ['page'], rowLimit: 25000, startRow }),
    });
    if (!res.ok) throw new Error(`Search Console HTTP ${res.status}`);
    const rows = (await res.json()).rows ?? [];
    for (const r of rows) out.set(normalizePath(r.keys[0], origin), { clicks: r.clicks, impressions: r.impressions, ctr: Math.round(r.ctr * 10000) / 10000, position: Math.round(r.position * 10) / 10 });
    if (rows.length < 25000) break;
  }
  return out;
}

export async function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '', csv: '', months: '16', via: '' });
  if (o.via && !['mcp', 'csv'].includes(o.via)) throw new Error('--via=mcp|csv');
  if (o.via === 'mcp' && !o.csv) throw new Error('--via=mcp needs --csv=<rows written from the MCP results>');
  const runId = o.run || latestRun(o.project);
  const config = readDoc(join(rebuildDir(o.project), 'config.json')) ?? {};
  const { start, end } = period(Number(o.months));
  const data = o.csv
    ? fromCsv(readFileSync(o.csv, 'utf8'), config.live)
    : await fromApi({ property: config.gsc.property, token: accessToken(config.gsc.service_account), start, end, origin: config.live });
  mergeSignals(runDir(o.project, runId), runId, 'gsc', data, { period: `${start}..${end}`, path: o.via || (o.csv ? 'csv' : 'api'), rows: data.size });
  console.log(`gsc: ${data.size} pages (${start}..${end})`);
}

runCli(import.meta.url, main);
```

Create `scripts/lib/signals.mjs`:

```js
// plugins/kivo-rebuild/scripts/lib/signals.mjs
import { join } from 'node:path';
import { readDoc, writeDoc } from './state.mjs';

export function period(months, today = new Date()) {
  const end = new Date(today.getTime() - 2 * 86400000);
  const start = new Date(end);
  start.setMonth(start.getMonth() - months);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

const FIELDS = { gsc: ['clicks', 'impressions', 'ctr', 'position'], ga4: ['sessions', 'conversions'] };

export function mergeSignals(dir, runId, source, data, meta) {
  const file = join(dir, 'signals.json');
  const doc = readDoc(file) ?? { items: [], sources: { gsc: null, ga4: null } };
  const byPath = new Map(doc.items.map((i) => [i.path, i]));
  for (const item of byPath.values()) for (const f of FIELDS[source]) delete item[f];
  for (const [path, values] of data) byPath.set(path, { ...(byPath.get(path) ?? { path }), ...values });
  const items = [...byPath.values()].filter((i) => Object.keys(i).length > 1);
  writeDoc(file, 'signals', { items, sources: { ...doc.sources, [source]: meta } }, { runId });
}
```

- [ ] **Step 6: Implement `ga4.mjs`**

```js
#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/ga4.mjs
import { join } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { accessToken } from './lib/credentials.mjs';
import { normalizePath } from './lib/paths.mjs';
import { reportUrl } from './lib/providers/ga4.mjs';
import { latestRun, readDoc, rebuildDir, runDir } from './lib/state.mjs';
import { mergeSignals, period } from './lib/signals.mjs';

export async function fromApi({ propertyId, token, start, end, fetchImpl = fetch }) {
  const out = new Map();
  for (let offset = 0; ; offset += 100000) {
    const res = await fetchImpl(reportUrl(propertyId), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateRanges: [{ startDate: start, endDate: end }], dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'sessions' }, { name: 'keyEvents' }], limit: 100000, offset }),
    });
    if (!res.ok) throw new Error(`GA4 Data API HTTP ${res.status}`);
    const body = await res.json();
    for (const r of body.rows ?? []) {
      const path = normalizePath(r.dimensionValues[0].value);
      const prev = out.get(path) ?? { sessions: 0, conversions: 0 };
      out.set(path, { sessions: prev.sessions + Number(r.metricValues[0].value), conversions: prev.conversions + Math.round(Number(r.metricValues[1].value)) });
    }
    if (offset + 100000 >= (body.rowCount ?? 0)) break;
  }
  return out;
}

export async function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '', months: '16' });
  const runId = o.run || latestRun(o.project);
  const config = readDoc(join(rebuildDir(o.project), 'config.json')) ?? {};
  const { start, end } = period(Number(o.months));
  const data = await fromApi({ propertyId: config.ga4.property_id, token: accessToken(config.ga4.service_account), start, end });
  mergeSignals(runDir(o.project, runId), runId, 'ga4', data, { period: `${start}..${end}`, path: 'api', rows: data.size });
  console.log(`ga4: ${data.size} pages (${start}..${end})`);
}

runCli(import.meta.url, main);
```

When a source comes through MCP, the `search-signals` skill writes the MCP rows to a temporary CSV in the GSC export
shape (`Top pages,Clicks,Impressions,CTR,Position`) and runs `gsc.mjs --csv=<file> --via=mcp`, which records
`sources.gsc.path: 'mcp'`.

- [ ] **Step 7: Run tests** — `node --test test/rebuild/signals.test.mjs` → PASS.

- [ ] **Step 8: Commit**

```bash
git add plugins/kivo-rebuild test/rebuild test/fixtures/rebuild
git commit -m "feat(rebuild): search console and ga4 signals from api or csv"
```

---

### Task 7: Decision rules and inventory

**Files:**
- Create: `plugins/kivo-rebuild/scripts/lib/rules.mjs`, `scripts/build-inventory.mjs`
- Test: `test/rebuild/rules.test.mjs`, `test/rebuild/inventory.test.mjs`

**Interfaces:**
- Consumes: state helpers, `parseCsv`, `normalizePath`.
- Produces:
  - `lib/rules.mjs`: `RULES` (array of `{id, describe, when(row, ctx) → boolean, decide(row, ctx) → {decision, reason, target?}}`),
    `propose(row, ctx)` → `{proposed, reason, rule_id, target?}`. `ctx` = `{redirects: Map<path,target>,
    importDate: string|null, junkPrefixes: string[], tagTypes: string[], fileExt: string[], hasSignals: boolean,
    hasStaging: boolean, disabled: Set<string>}`. Rows: inventory rows (urls item + signals fields, `origin`).
  - Rule table (first match wins, disabled ids skipped):

| id | when | decision |
|---|---|---|
| R01 | path in approved redirects | redirect → target |
| R02 | origin `search` and last segment has a `fileExt` extension | review "file outside the sitemap (live <status>)" |
| R03 | origin `search` and path has `?` | review "query-string variant" |
| R04 | origin `search` and live 3xx | redirect → live location "live site redirects; needs an edge rule" |
| R05 | origin `search` and live 404/410 | review "already gone on the live site" |
| R06 | origin `search` | review "outside the sitemap" |
| R07 | `hasStaging`, staging 404, `importDate` set, `lastmod > importDate`, type not a tag type | keep "changed on the live site after the import: cutover delta" |
| R08 | path starts with a junk prefix | gone "test, draft or plugin page" |
| R09 | type in `tagTypes` and staging 200 | keep "tag archive resolves" |
| R10 | type in `tagTypes` and not `hasSignals` | review "tag archive without search data" |
| R11 | type in `tagTypes` and clicks > 0 | review "tag with clicks: keep or redirect" |
| R12 | type in `tagTypes` and impressions > 0 | noindex "shown in search but never clicked" |
| R13 | type in `tagTypes` | gone "never shown in search" |
| R14 | staging 200 | keep "same URL on the new project" |
| R15 | staging 3xx | redirect → staging location "staging already redirects" |
| R16 | not `hasStaging` and live 200 or no live data | keep "exists on the live site" |
| R17 | not `hasStaging` and live 3xx | redirect → live location |
| R18 | not `hasStaging` and live 404/410 | gone "already gone on the live site" |
| R99 | always | review "no rule fits (staging <status>)" |

  - `build-inventory.mjs`: exported `buildInventory({urls, signals, config, redirectsCsv, previous})` → items.
    Joins `urls.json` and `signals.json` by path; adds signal-only paths with clicks > 0 as `origin:'search'` rows
    (type `search`); carries `final`, `decided_by`, `note`, `issue`, `target` from `previous` inventory rows with the
    same path. CLI `--project=. --run=<id>` writes `inventory.json`; prints the count per `type × proposed`.
    Redirects CSV (`config.redirects_csv`, relative to the project): columns `source,target,approved`; only rows with
    non-empty `approved`.

- [ ] **Step 1: Failing tests**

```js
// test/rebuild/rules.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { propose } from '../../plugins/kivo-rebuild/scripts/lib/rules.mjs';

const ctx = (o = {}) => ({ redirects: new Map(), importDate: '2026-01-10', junkPrefixes: ['/test-'], tagTypes: ['post_tag'], fileExt: ['pdf'], hasSignals: true, hasStaging: true, disabled: new Set(), ...o });
const row = (o) => ({ path: '/x/', origin: 'sitemap', type: 'page', lastmod: null, live: { status: 200 }, staging: { status: 200 }, clicks: 0, impressions: 0, ...o });

const cases = [
  ['approved redirect', row({ path: '/old/' }), ctx({ redirects: new Map([['/old/', '/new/']]) }), 'redirect', 'R01'],
  ['pdf from search', row({ origin: 'search', path: '/f/a.pdf', live: { status: 404 } }), ctx(), 'review', 'R02'],
  ['query from search', row({ origin: 'search', path: '/?s=a' }), ctx(), 'review', 'R03'],
  ['search 301', row({ origin: 'search', live: { status: 301, location: '/y/' } }), ctx(), 'redirect', 'R04'],
  ['search 404', row({ origin: 'search', live: { status: 404 } }), ctx(), 'review', 'R05'],
  ['delta after import', row({ staging: { status: 404 }, lastmod: '2026-02-01' }), ctx(), 'keep', 'R07'],
  ['junk page', row({ path: '/test-page/', staging: { status: 404 } }), ctx(), 'gone', 'R08'],
  ['tag resolves', row({ type: 'post_tag' }), ctx(), 'keep', 'R09'],
  ['tag no signals', row({ type: 'post_tag', staging: { status: 404 } }), ctx({ hasSignals: false }), 'review', 'R10'],
  ['tag clicked', row({ type: 'post_tag', staging: { status: 404 }, clicks: 3 }), ctx(), 'review', 'R11'],
  ['tag impressions only', row({ type: 'post_tag', staging: { status: 404 }, impressions: 9 }), ctx(), 'noindex', 'R12'],
  ['tag invisible', row({ type: 'post_tag', staging: { status: 404 } }), ctx(), 'gone', 'R13'],
  ['same url', row({}), ctx(), 'keep', 'R14'],
  ['staging redirect', row({ staging: { status: 301, location: '/z/' } }), ctx(), 'redirect', 'R15'],
  ['no staging live 200', row({ staging: null }), ctx({ hasStaging: false }), 'keep', 'R16'],
  ['no staging live 404', row({ staging: null, live: { status: 404 } }), ctx({ hasStaging: false }), 'gone', 'R18'],
  ['fallback', row({ staging: { status: 500 } }), ctx(), 'review', 'R99'],
];

for (const [name, r, c, decision, id] of cases) {
  test(name, () => {
    const p = propose(r, c);
    assert.equal(p.proposed, decision);
    assert.equal(p.rule_id, id);
  });
}

test('disabled rule falls through', () => {
  assert.equal(propose(row({ type: 'post_tag', staging: { status: 404 } }), ctx({ disabled: new Set(['R13']) })).rule_id, 'R99');
});

test('redirect targets are carried', () => {
  assert.equal(propose(row({ origin: 'search', live: { status: 301, location: '/y/' } }), ctx()).target, '/y/');
});
```

```js
// test/rebuild/inventory.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInventory } from '../../plugins/kivo-rebuild/scripts/build-inventory.mjs';

test('joins signals, adds search-only paths, keeps previous decisions', () => {
  const urls = { items: [{ path: '/', origin: 'sitemap', type: 'page', lastmod: null, live: { status: 200 }, staging: { status: 200 } }, { path: '/tag/a/', origin: 'sitemap', type: 'post_tag', lastmod: null, staging: { status: 404 } }] };
  const signals = { items: [{ path: '/', clicks: 5, impressions: 50 }, { path: '/gone-page/', clicks: 2, impressions: 9 }, { path: '/zero/', clicks: 0, impressions: 3 }], sources: { gsc: { period: 'p', path: 'csv', rows: 3 }, ga4: null } };
  const previous = { items: [{ path: '/tag/a/', type: 'post_tag', proposed: 'gone', reason: 'x', rule_id: 'R13', final: 'gone', decided_by: 'owner' }] };
  const items = buildInventory({ urls, signals, config: { staging: 'https://s.test', rules: { tag_types: ['post_tag'] } }, redirectsCsv: '', previous });
  const by = Object.fromEntries(items.map((i) => [i.path, i]));
  assert.equal(by['/'].clicks, 5);
  assert.equal(by['/gone-page/'].origin, 'search');
  assert.equal(by['/zero/'], undefined);
  assert.equal(by['/tag/a/'].final, 'gone');
  assert.equal(by['/tag/a/'].decided_by, 'owner');
  assert.equal(by['/tag/a/'].proposed, 'gone');
});

test('without signals tag rules propose review', () => {
  const urls = { items: [{ path: '/tag/a/', origin: 'sitemap', type: 'post_tag', lastmod: null, staging: { status: 404 } }] };
  const items = buildInventory({ urls, signals: null, config: { staging: 'https://s.test', rules: { tag_types: ['post_tag'] } }, redirectsCsv: '', previous: null });
  assert.equal(items[0].proposed, 'review');
  assert.equal(items[0].clicks, null);
});
```

- [ ] **Step 2: Run to see it fail** — `node --test test/rebuild/rules.test.mjs test/rebuild/inventory.test.mjs` → FAIL.

- [ ] **Step 3: Implement `lib/rules.mjs`**

```js
// plugins/kivo-rebuild/scripts/lib/rules.mjs
const st = (r, k) => r[k]?.status ?? null;
const is3xx = (s) => s >= 300 && s < 400;
const ext = (path, list) => list.includes((path.split('?')[0].split('/').pop().split('.').slice(1).pop() ?? '').toLowerCase());
const isTag = (r, c) => c.tagTypes.includes(r.type);

export const RULES = [
  { id: 'R01', when: (r, c) => c.redirects.has(r.path), decide: (r, c) => ({ decision: 'redirect', reason: `approved redirect to ${c.redirects.get(r.path)}`, target: c.redirects.get(r.path) }) },
  { id: 'R02', when: (r, c) => r.origin === 'search' && ext(r.path, c.fileExt), decide: (r) => ({ decision: 'review', reason: `file outside the sitemap (live ${st(r, 'live') ?? '?'})` }) },
  { id: 'R03', when: (r) => r.origin === 'search' && r.path.includes('?'), decide: () => ({ decision: 'review', reason: 'query-string variant' }) },
  { id: 'R04', when: (r) => r.origin === 'search' && is3xx(st(r, 'live')), decide: (r) => ({ decision: 'redirect', reason: 'live site redirects; needs an edge rule', target: r.live.location }) },
  { id: 'R05', when: (r) => r.origin === 'search' && [404, 410].includes(st(r, 'live')), decide: () => ({ decision: 'review', reason: 'already gone on the live site' }) },
  { id: 'R06', when: (r) => r.origin === 'search', decide: () => ({ decision: 'review', reason: 'outside the sitemap' }) },
  { id: 'R07', when: (r, c) => c.hasStaging && st(r, 'staging') === 404 && c.importDate && r.lastmod && r.lastmod > c.importDate && !isTag(r, c), decide: () => ({ decision: 'keep', reason: 'changed on the live site after the import: cutover delta' }) },
  { id: 'R08', when: (r, c) => c.junkPrefixes.some((p) => r.path.startsWith(p)), decide: () => ({ decision: 'gone', reason: 'test, draft or plugin page' }) },
  { id: 'R09', when: (r, c) => isTag(r, c) && st(r, 'staging') === 200, decide: () => ({ decision: 'keep', reason: 'tag archive resolves' }) },
  { id: 'R10', when: (r, c) => isTag(r, c) && !c.hasSignals, decide: () => ({ decision: 'review', reason: 'tag archive without search data' }) },
  { id: 'R11', when: (r, c) => isTag(r, c) && (r.clicks ?? 0) > 0, decide: () => ({ decision: 'review', reason: 'tag with clicks: keep or redirect to a category' }) },
  { id: 'R12', when: (r, c) => isTag(r, c) && (r.impressions ?? 0) > 0, decide: () => ({ decision: 'noindex', reason: 'shown in search but never clicked' }) },
  { id: 'R13', when: (r, c) => isTag(r, c), decide: () => ({ decision: 'gone', reason: 'never shown in search' }) },
  { id: 'R14', when: (r) => st(r, 'staging') === 200, decide: () => ({ decision: 'keep', reason: 'same URL on the new project' }) },
  { id: 'R15', when: (r) => is3xx(st(r, 'staging')), decide: (r) => ({ decision: 'redirect', reason: 'staging already redirects', target: r.staging.location }) },
  { id: 'R16', when: (r, c) => !c.hasStaging && (st(r, 'live') === 200 || st(r, 'live') === null), decide: () => ({ decision: 'keep', reason: 'exists on the live site' }) },
  { id: 'R17', when: (r, c) => !c.hasStaging && is3xx(st(r, 'live')), decide: (r) => ({ decision: 'redirect', reason: 'live site redirects', target: r.live.location }) },
  { id: 'R18', when: (r, c) => !c.hasStaging && [404, 410].includes(st(r, 'live')), decide: () => ({ decision: 'gone', reason: 'already gone on the live site' }) },
  { id: 'R99', when: () => true, decide: (r) => ({ decision: 'review', reason: `no rule fits (staging ${st(r, 'staging') ?? '?'})` }) },
];

export function propose(row, ctx) {
  for (const rule of RULES) {
    if (rule.id !== 'R99' && ctx.disabled.has(rule.id)) continue;
    if (!rule.when(row, ctx)) continue;
    const d = rule.decide(row, ctx);
    return { proposed: d.decision, reason: d.reason, rule_id: rule.id, ...(d.target ? { target: d.target } : {}) };
  }
  throw new Error('unreachable: R99 always matches');
}
```

- [ ] **Step 4: Implement `build-inventory.mjs`**

```js
#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/build-inventory.mjs
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Counter } from './lib/counter.mjs';
import { parseOptions, runCli } from './lib/args.mjs';
import { parseCsv } from './lib/csv.mjs';
import { normalizePath } from './lib/paths.mjs';
import { propose } from './lib/rules.mjs';
import { latestRun, readDoc, rebuildDir, runDir, writeDoc } from './lib/state.mjs';

const CARRY = ['final', 'decided_by', 'note', 'issue'];

function redirectsFrom(csvText, origin) {
  const map = new Map();
  if (!csvText) return map;
  const [head, ...rows] = parseCsv(csvText);
  const i = Object.fromEntries(['source', 'target', 'approved'].map((k) => [k, head.indexOf(k)]));
  for (const r of rows) if (r[i.approved]) map.set(normalizePath(r[i.source], origin), normalizePath(r[i.target], origin));
  return map;
}

export function buildInventory({ urls, signals, config, redirectsCsv, previous }) {
  const rules = config.rules ?? {};
  const sig = new Map((signals?.items ?? []).map((s) => [s.path, s]));
  const prev = new Map((previous?.items ?? []).map((p) => [p.path, p]));
  const ctx = {
    redirects: redirectsFrom(redirectsCsv, config.live),
    importDate: config.import_date ?? null,
    junkPrefixes: rules.junk_prefixes ?? [],
    tagTypes: rules.tag_types ?? ['post_tag'],
    fileExt: rules.file_ext ?? ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip'],
    hasSignals: Boolean(signals?.sources?.gsc),
    hasStaging: Boolean(config.staging),
    disabled: new Set(rules.disable ?? []),
  };
  const rows = urls.items.map((u) => ({ ...u }));
  const seen = new Set(rows.map((r) => r.path));
  for (const s of sig.values()) if (!seen.has(s.path) && (s.clicks ?? 0) > 0) rows.push({ path: s.path, origin: 'search', type: 'search', lastmod: null, live: null, staging: null });
  return rows.map((r) => {
    const s = sig.get(r.path);
    if (s && r.origin === 'sitemap') r.origin = 'both';
    const row = { ...r, clicks: s?.clicks ?? (ctx.hasSignals ? 0 : null), impressions: s?.impressions ?? (ctx.hasSignals ? 0 : null), position: s?.position ?? null, sessions: s?.sessions ?? null };
    const p = propose(row, ctx);
    const old = prev.get(r.path) ?? {};
    const carried = Object.fromEntries(CARRY.filter((k) => old[k] !== undefined && old[k] !== null).map((k) => [k, old[k]]));
    return { ...row, ...p, ...(old.target && old.final ? { target: old.target } : {}), ...carried };
  });
}

export function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '' });
  const runId = o.run || latestRun(o.project);
  const dir = runDir(o.project, runId);
  const config = readDoc(join(rebuildDir(o.project), 'config.json')) ?? {};
  const csvPath = config.redirects_csv ? resolve(o.project, config.redirects_csv) : '';
  const items = buildInventory({
    urls: readDoc(join(dir, 'urls.json')),
    signals: readDoc(join(dir, 'signals.json')),
    config,
    redirectsCsv: csvPath && existsSync(csvPath) ? readFileSync(csvPath, 'utf8') : '',
    previous: readDoc(join(dir, 'inventory.json')),
  });
  writeDoc(join(dir, 'inventory.json'), 'inventory', { items }, { runId });
  const c = new Counter();
  for (const i of items) c.add(`${i.type}\t${i.proposed}`);
  console.log(`${items.length} rows`);
  for (const [k, n] of c.sorted()) console.log(`${String(n).padStart(6)} ${k}`);
}

runCli(import.meta.url, main);
```

`scripts/lib/counter.mjs`:

```js
// plugins/kivo-rebuild/scripts/lib/counter.mjs
export class Counter extends Map {
  add(key, n = 1) { this.set(key, (this.get(key) ?? 0) + n); return this; }
  sorted() { return [...this.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))); }
}
```

The inventory schema must accept the urls fields `sitemap`, `live`, `staging`, `lastmod`, `title`, `h1`, `canonical`,
`robots`, `origin` (`sitemap|search|both`) and `type` `search`.

- [ ] **Step 5: Run tests** — `node --test test/rebuild/rules.test.mjs test/rebuild/inventory.test.mjs` → PASS.

- [ ] **Step 6: Commit**

```bash
git add plugins/kivo-rebuild test/rebuild
git commit -m "feat(rebuild): url decision rules and inventory build"
```

---

### Task 8: Template map

**Files:**
- Create: `plugins/kivo-rebuild/scripts/map-templates.mjs`
- Test: `test/rebuild/templates.test.mjs`

**Interfaces:**
- Consumes: `inventory.json`, `config.templates`, `writeDoc`.
- Produces: exported `mapTemplates({items, groups})` → template items; `DEFAULT_GROUPS` (array, used when
  `config.templates` is absent): `home` (`match:{regex:'^/$'}`, `resources/views/front-page.blade.php`),
  `product` (`type:'product'`, `resources/views/woocommerce/single-product.blade.php`), `product-category`
  (`type:'product_cat'`, `resources/views/woocommerce/archive-product.blade.php`), `post` (`type:'post'`,
  `resources/views/single.blade.php`), `tag` (`type:'post_tag'`, `resources/views/index.blade.php`), `page`
  (`type:'page'`, `resources/views/page.blade.php`), `search-only` (`type:'search'`, template `-`). Matching: first
  group whose `match` conditions (all present keys) hold: `type` equals, `prefix` startsWith, `regex` tests the path.
  Unmatched rows go to group `unmapped`. Samples: up to 3 paths — the highest-clicks rows first, then the first rows
  in input order to fill. `clicks` = sum (null treated as 0). `status` starts `todo`. Groups with `count: 0` are
  dropped. CLI `--project=. --run=<id>` writes `templates.json`.

- [ ] **Step 1: Failing test**

```js
// test/rebuild/templates.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapTemplates, DEFAULT_GROUPS } from '../../plugins/kivo-rebuild/scripts/map-templates.mjs';

test('groups by first matching rule with click-ranked samples', () => {
  const items = [
    { path: '/', type: 'page', clicks: 100 },
    { path: '/product/a/', type: 'product', clicks: 1 },
    { path: '/product/b/', type: 'product', clicks: 9 },
    { path: '/product/c/', type: 'product', clicks: null },
    { path: '/product/d/', type: 'product', clicks: 0 },
    { path: '/about/', type: 'page', clicks: 3 },
    { path: '/weird/', type: 'oportunidade', clicks: 0 },
  ];
  const groups = mapTemplates({ items, groups: DEFAULT_GROUPS });
  const by = Object.fromEntries(groups.map((g) => [g.group, g]));
  assert.equal(by.home.count, 1);
  assert.equal(by.page.count, 1);
  assert.equal(by.product.count, 4);
  assert.equal(by.product.clicks, 10);
  assert.deepEqual(by.product.samples, ['/product/b/', '/product/a/', '/product/c/']);
  assert.equal(by.unmapped.count, 1);
  assert.equal(by.post, undefined);
  assert.equal(by.product.status, 'todo');
});
```

- [ ] **Step 2: Run to see it fail** — `node --test test/rebuild/templates.test.mjs` → FAIL.

- [ ] **Step 3: Implement**

```js
#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/map-templates.mjs
import { join } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { latestRun, readDoc, rebuildDir, runDir, writeDoc } from './lib/state.mjs';

export const DEFAULT_GROUPS = [
  { group: 'home', label: 'Home', template: 'resources/views/front-page.blade.php', match: { regex: '^/$' } },
  { group: 'product', label: 'Product page', template: 'resources/views/woocommerce/single-product.blade.php', match: { type: 'product' } },
  { group: 'product-category', label: 'Product category', template: 'resources/views/woocommerce/archive-product.blade.php', match: { type: 'product_cat' } },
  { group: 'post', label: 'Blog post', template: 'resources/views/single.blade.php', match: { type: 'post' } },
  { group: 'tag', label: 'Blog tag', template: 'resources/views/index.blade.php', match: { type: 'post_tag' } },
  { group: 'page', label: 'Page', template: 'resources/views/page.blade.php', match: { type: 'page' } },
  { group: 'search-only', label: 'URLs only in search results', template: '-', match: { type: 'search' } },
];

const matches = (m, row) => (m.type === undefined || m.type === row.type)
  && (m.prefix === undefined || row.path.startsWith(m.prefix))
  && (m.regex === undefined || new RegExp(m.regex, 'u').test(row.path));

export function mapTemplates({ items, groups }) {
  const buckets = new Map([...groups, { group: 'unmapped', label: 'Not mapped to a template', template: '-', match: {} }].map((g) => [g.group, { ...g, rows: [] }]));
  for (const row of items) {
    const g = groups.find((x) => matches(x.match ?? {}, row));
    buckets.get(g ? g.group : 'unmapped').rows.push(row);
  }
  return [...buckets.values()].filter((b) => b.rows.length).map((b) => {
    const ranked = b.rows.map((r, i) => ({ r, i })).filter(({ r }) => (r.clicks ?? 0) > 0).sort((a, z) => z.r.clicks - a.r.clicks || a.i - z.i).map(({ r }) => r.path);
    const samples = [...ranked];
    for (const r of b.rows) { if (samples.length >= 3) break; if (!samples.includes(r.path)) samples.push(r.path); }
    return { group: b.group, label: b.label, template: b.template, ...(b.blocks ? { blocks: b.blocks } : {}), count: b.rows.length, clicks: b.rows.reduce((s, r) => s + (r.clicks ?? 0), 0), samples: samples.slice(0, 3), status: 'todo' };
  });
}

export function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '' });
  const runId = o.run || latestRun(o.project);
  const config = readDoc(join(rebuildDir(o.project), 'config.json')) ?? {};
  const inv = readDoc(join(runDir(o.project, runId), 'inventory.json'));
  const prev = readDoc(join(runDir(o.project, runId), 'templates.json'));
  const items = mapTemplates({ items: inv.items, groups: config.templates ?? DEFAULT_GROUPS });
  const old = new Map((prev?.items ?? []).map((t) => [t.group, t]));
  for (const t of items) if (old.has(t.group)) Object.assign(t, { status: old.get(t.group).status, ...(old.get(t.group).note ? { note: old.get(t.group).note } : {}) });
  writeDoc(join(runDir(o.project, runId), 'templates.json'), 'templates', { items }, { runId });
  for (const t of items) console.log(`${String(t.count).padStart(6)} ${t.group} -> ${t.template}`);
}

runCli(import.meta.url, main);
```

- [ ] **Step 4: Run tests** — PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/kivo-rebuild test/rebuild
git commit -m "feat(rebuild): map urls to template groups with samples"
```

---

### Task 9: Feature and parity fragments, kion bridge

**Files:**
- Create: `plugins/kivo-rebuild/scripts/merge.mjs`, `scripts/kion-bridge.mjs`
- Test: `test/rebuild/merge.test.mjs`, `test/rebuild/kion-bridge.test.mjs`

**Interfaces:**
- Consumes: state helpers; fragments written by agents at `runs/<id>/fragments/features/<area>.json` and
  `fragments/parity/<domain>.json`, each `{"items": [...]}` in the features / parity item shape.
- Produces:
  - `merge.mjs`: exported `mergeFragments(kind, fragments: {name, items}[], {features})` →
    `{items, errors: string[]}`. Errors: duplicate `id` (features) or duplicate `feature` (parity) across fragments
    (`duplicate F-x in a.json and b.json`); parity row whose `feature` is not in `features`
    (`unknown feature F-x in b.json`); features missing from parity are reported as
    `not audited: F-x` (error). CLI `--project=. --run=<id> --kind=features|parity` validates each item with the
    schema, writes the merged file with `writeDoc` when there are no errors, else prints errors and exits 1.
  - `kion-bridge.mjs`: exported `seedFeatures(kionInventory)` → features items (`id: 'F-' + slug(name)`,
    `area`, `name`, `source`, `behaviour: evidence || name`, `kion: it.id`) for items with verdict other than
    `remove`; exported `gapQuestions(parity, features)` → kion question `--data` objects for
    `class === 'missing-not-planned'` and priority P0/P1:
    `{text: 'Who owns "<name>" in the new project, and is it needed at launch?', type: 'decision', tier: P0 ? 'high' : 'normal', area, grounds: [source, note], options: [{key:'build', label:'Build it before launch', recommended: P0}, {key:'later', label:'After launch'}, {key:'drop', label:'Drop it'}], status: 'open', source: 'discovery'}`.
    CLI `seed --project=. --run=<id>` reads `.kion/inventory.json` and writes
    `fragments/features/kion.json`; CLI `questions --project=. --run=<id> [--apply]` prints the `kion add question`
    commands (`node <kion> add question --data '<json>'`, with `<kion>` from `--kion=<path to kion.mjs>`) and runs them
    only with `--apply`.

- [ ] **Step 1: Failing tests**

```js
// test/rebuild/merge.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeFragments } from '../../plugins/kivo-rebuild/scripts/merge.mjs';

const f = (id) => ({ id, area: 'theme', name: id, source: 'functions.php:1', behaviour: 'b' });

test('features: duplicates across fragments are errors', () => {
  const { errors } = mergeFragments('features', [{ name: 'a.json', items: [f('F-a')] }, { name: 'b.json', items: [f('F-a')] }]);
  assert.deepEqual(errors, ['duplicate F-a in a.json and b.json']);
});

test('parity: unknown and unaudited features are errors', () => {
  const features = [f('F-a'), f('F-b')];
  const { errors } = mergeFragments('parity', [{ name: 'x.json', items: [{ feature: 'F-a', class: 'done', priority: 'P2' }, { feature: 'F-z', class: 'done', priority: 'P2' }] }], { features });
  assert.deepEqual(errors.sort(), ['not audited: F-b', 'unknown feature F-z in x.json']);
});

test('clean merge keeps order by fragment name', () => {
  const { items, errors } = mergeFragments('features', [{ name: 'b.json', items: [f('F-b')] }, { name: 'a.json', items: [f('F-a')] }]);
  assert.deepEqual(errors, []);
  assert.deepEqual(items.map((i) => i.id), ['F-a', 'F-b']);
});
```

```js
// test/rebuild/kion-bridge.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFeatures, gapQuestions } from '../../plugins/kivo-rebuild/scripts/kion-bridge.mjs';

test('seed skips removed items and links the kion id', () => {
  const items = seedFeatures({ items: [
    { id: 'INV-001', area: 'plugins', kind: 'plugin', name: 'Banner Slider', source: 'wp-content/plugins/slider', evidence: 'home slides', verdict: 'rebuild', risk: [], raises: [] },
    { id: 'INV-002', area: 'plugins', kind: 'plugin', name: 'Old Cache', source: 'x', verdict: 'remove', risk: [], raises: [] },
  ] });
  assert.deepEqual(items, [{ id: 'F-banner-slider', area: 'plugins', name: 'Banner Slider', source: 'wp-content/plugins/slider', behaviour: 'home slides', kion: 'INV-001' }]);
});

test('questions only for P0/P1 missing-not-planned', () => {
  const features = [{ id: 'F-a', area: 'checkout', name: 'State registration field', source: 'functions.php:452', behaviour: 'b' }, { id: 'F-b', area: 'x', name: 'B', source: 's', behaviour: 'b' }];
  const parity = [{ feature: 'F-a', class: 'missing-not-planned', priority: 'P0', note: 'sent to the ERP' }, { feature: 'F-b', class: 'missing-not-planned', priority: 'P3' }];
  const qs = gapQuestions(parity, features);
  assert.equal(qs.length, 1);
  assert.equal(qs[0].tier, 'high');
  assert.match(qs[0].text, /State registration field/);
  assert.equal(qs[0].options[0].recommended, true);
});
```

- [ ] **Step 2: Run to see them fail** — FAIL.

- [ ] **Step 3: Implement `merge.mjs`**

```js
#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/merge.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { latestRun, readDoc, runDir, writeDoc } from './lib/state.mjs';

export function mergeFragments(kind, fragments, { features = [] } = {}) {
  const key = kind === 'features' ? 'id' : 'feature';
  const owner = new Map();
  const errors = [];
  const items = [];
  for (const frag of [...fragments].sort((a, b) => a.name.localeCompare(b.name))) {
    for (const it of frag.items) {
      if (owner.has(it[key])) { errors.push(`duplicate ${it[key]} in ${owner.get(it[key])} and ${frag.name}`); continue; }
      owner.set(it[key], frag.name);
      items.push(it);
    }
  }
  if (kind === 'parity') {
    const known = new Set(features.map((f) => f.id));
    for (const it of items) if (!known.has(it.feature)) errors.push(`unknown feature ${it.feature} in ${owner.get(it.feature)}`);
    for (const id of known) if (!owner.has(id)) errors.push(`not audited: ${id}`);
  }
  return { items, errors };
}

export function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '', kind: '' });
  if (!['features', 'parity'].includes(o.kind)) throw new Error('--kind=features|parity');
  const runId = o.run || latestRun(o.project);
  const dir = join(runDir(o.project, runId), 'fragments', o.kind);
  const fragments = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((name) => ({ name, items: JSON.parse(readFileSync(join(dir, name), 'utf8')).items ?? [] })) : [];
  const features = o.kind === 'parity' ? readDoc(join(runDir(o.project, runId), 'features.json'))?.items ?? [] : [];
  const { items, errors } = mergeFragments(o.kind, fragments, { features });
  if (errors.length) { for (const e of errors) console.error(e); process.exitCode = 1; return; }
  writeDoc(join(runDir(o.project, runId), `${o.kind}.json`), o.kind, { items }, { runId });
  console.log(`${o.kind}: ${items.length} items from ${fragments.length} fragments`);
}

runCli(import.meta.url, main);
```

- [ ] **Step 4: Implement `kion-bridge.mjs`**

```js
#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/kion-bridge.mjs
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runCli } from './lib/args.mjs';
import { latestRun, readDoc, runDir } from './lib/state.mjs';

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function seedFeatures(kionInventory) {
  return (kionInventory.items ?? []).filter((it) => it.verdict !== 'remove').map((it) => ({
    id: `F-${slug(it.name)}`, area: it.area, name: it.name, source: it.source, behaviour: it.evidence || it.name, kion: it.id,
  }));
}

export function gapQuestions(parity, features) {
  const byId = new Map(features.map((f) => [f.id, f]));
  return parity.filter((p) => p.class === 'missing-not-planned' && ['P0', 'P1'].includes(p.priority)).map((p) => {
    const f = byId.get(p.feature);
    return {
      text: `Who owns "${f.name}" in the new project, and is it needed at launch?`,
      type: 'decision', tier: p.priority === 'P0' ? 'high' : 'normal', area: f.area,
      grounds: [f.source, p.note].filter(Boolean),
      options: [{ key: 'build', label: 'Build it before launch', recommended: p.priority === 'P0' }, { key: 'later', label: 'After launch' }, { key: 'drop', label: 'Drop it' }],
      status: 'open', source: 'discovery',
    };
  });
}

export function main(argv) {
  const [cmd, ...rest] = argv;
  const opt = Object.fromEntries(rest.filter((a) => a.startsWith('--')).map((a) => { const [k, v = true] = a.slice(2).split('='); return [k, v]; }));
  const project = opt.project ?? '.';
  const runId = opt.run || latestRun(project);
  if (cmd === 'seed') {
    const inv = JSON.parse(readFileSync(join(resolve(project), '.kion', 'inventory.json'), 'utf8'));
    const dir = join(runDir(project, runId), 'fragments', 'features');
    mkdirSync(dir, { recursive: true });
    const items = seedFeatures(inv);
    writeFileSync(join(dir, 'kion.json'), JSON.stringify({ items }, null, 2) + '\n');
    console.log(`seeded ${items.length} features from kion`);
    return;
  }
  if (cmd === 'questions') {
    const d = runDir(project, runId);
    const qs = gapQuestions(readDoc(join(d, 'parity.json')).items, readDoc(join(d, 'features.json')).items);
    if (!opt.kion) throw new Error('--kion=<path to kion.mjs> is required');
    for (const q of qs) {
      const args = [opt.kion, 'add', 'question', '--data', JSON.stringify(q)];
      console.log(`node ${args.map((a) => (a.includes(' ') ? `'${a}'` : a)).join(' ')}`);
      if (opt.apply) {
        const r = spawnSync(process.execPath, args, { cwd: project, encoding: 'utf8' });
        if (r.status !== 0) { console.error(r.stderr); process.exitCode = 1; return; }
      }
    }
    console.log(`${qs.length} questions${opt.apply ? ' added' : ' (dry run; add --apply)'}`);
    return;
  }
  throw new Error('usage: kion-bridge.mjs seed|questions --project=. [--run=id] [--kion=path] [--apply]');
}

runCli(import.meta.url, main);
```

- [ ] **Step 5: Run tests** — PASS.

- [ ] **Step 6: Commit**

```bash
git add plugins/kivo-rebuild test/rebuild
git commit -m "feat(rebuild): merge agent fragments and bridge to kion"
```

---

### Task 10: Review board — build and import

**Files:**
- Create: `plugins/kivo-rebuild/scripts/board.mjs`, `plugins/kivo-rebuild/scripts/board/template.html`
- Test: `test/rebuild/board.test.mjs`

**Interfaces:**
- Consumes: `inventory.json`, `templates.json`, `parity.json`, `features.json`.
- Produces:
  - `board.mjs build --project=. --run=<id> [--max-urls=5000]` writes `runs/<id>/board/index.html`: the template
    with `/*__DATA__*/null` replaced by `JSON.stringify({run, generated, templates, urls, parity, features})` where
    `urls` keeps the top `max-urls` rows by clicks plus every row whose `proposed` is `review` (the board says when it
    is truncated). Exported `buildBoard({run, inventory, templates, parity, features, maxUrls})` → HTML string.
  - The page works standalone: marks are kept in `localStorage` (try/catch) and exported with a "Download marks"
    button as `marks.json`: `{run, marks: {urls: {<path>: {final, note, decided_by}}, templates: {<group>: {status, note}}, parity: {<feature>: {note}}}}`.
    When the page runs as an artifact with the `db` capability (`await window.claude?.use?.('db')` non-null), marks
    are read and written to collections `decisions` (doc id = base64url(path)), `templates` (doc id = group),
    `parity` (doc id = feature), each doc `{...mark, path|group|feature}`; the page uses the db when present and
    localStorage otherwise.
  - `board.mjs import --project=. --run=<id> --file=<marks.json | db-export.json>` accepts either the download format
    or an export of the three collections `{decisions: [...docs], templates: [...], parity: [...]}`; exported
    `applyMarks({inventory, templates, parity}, marks)` → `{changed: number, conflicts: string[]}`: a URL mark whose
    `final` differs from an existing non-null `final` with a different `decided_by` is a conflict
    (`conflict /x/: gone by owner vs keep by reviewer`) and is not applied; otherwise `final`, `note`, `decided_by`
    are set. Writes back the three files with `writeDoc` and prints `N changes, M conflicts`.

- [ ] **Step 1: Failing test**

```js
// test/rebuild/board.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBoard, applyMarks, normalizeMarks } from '../../plugins/kivo-rebuild/scripts/board.mjs';

const inventory = { items: [
  { path: '/a/', type: 'page', proposed: 'keep', reason: 'r', rule_id: 'R14', clicks: 5 },
  { path: '/b/', type: 'page', proposed: 'review', reason: 'r', rule_id: 'R99', clicks: 0 },
  { path: '/c/', type: 'page', proposed: 'gone', reason: 'r', rule_id: 'R13', clicks: 0, final: 'gone', decided_by: 'owner' },
] };
const templates = { items: [{ group: 'page', label: 'Page', template: 'page.blade.php', count: 3, clicks: 5, samples: ['/a/'], status: 'todo' }] };

test('build embeds data and truncates but keeps review rows', () => {
  const html = buildBoard({ run: 'r1', inventory, templates, parity: { items: [] }, features: { items: [] }, maxUrls: 1 });
  const data = JSON.parse(html.match(/const DATA = (.*?);\n/s)[1]);
  assert.deepEqual(data.urls.map((u) => u.path).sort(), ['/a/', '/b/']);
  assert.equal(data.truncated, 1);
  assert.match(html, /<title>Rebuild review<\/title>/);
});

test('import applies marks, reports conflicts, round trip from db export', () => {
  const inv = structuredClone(inventory);
  const tpl = structuredClone(templates);
  const marks = normalizeMarks({ decisions: [{ path: '/b/', final: 'redirect', note: 'to /a/', decided_by: 'reviewer' }, { path: '/c/', final: 'keep', decided_by: 'reviewer' }], templates: [{ group: 'page', status: 'issues', note: 'footer' }], parity: [] });
  const { changed, conflicts } = applyMarks({ inventory: inv, templates: tpl, parity: { items: [] } }, marks);
  assert.equal(changed, 2);
  assert.deepEqual(conflicts, ['conflict /c/: gone by owner vs keep by reviewer']);
  assert.equal(inv.items[1].final, 'redirect');
  assert.equal(inv.items[2].final, 'gone');
  assert.equal(tpl.items[0].status, 'issues');
});
```

- [ ] **Step 2: Run to see it fail** — FAIL.

- [ ] **Step 3: Write `board/template.html`**

A single self-contained page (no external scripts or fonts). It must contain the literal line
`const DATA = /*__DATA__*/null;` followed by a newline, `<title>Rebuild review</title>`, color tokens on `:root`
with a dark-mode override under `@media (prefers-color-scheme: dark)`, an explicit `body` background, and these
behaviours:

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rebuild review</title>
<style>
:root{--bg:#fff;--fg:#1b1f24;--muted:#5b6470;--line:#d9dee4;--accent:#1d6fd6;--ok:#1a7f37;--warn:#9a6700;--bad:#cf222e}
@media (prefers-color-scheme:dark){:root{--bg:#0f1216;--fg:#e6e9ee;--muted:#9aa4b2;--line:#2a3038;--accent:#5aa2ff;--ok:#3fb950;--warn:#d29922;--bad:#f85149}}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,sans-serif}
header,main{padding:12px 16px;max-width:1200px;margin:0 auto}
nav button{border:1px solid var(--line);background:none;color:var(--fg);padding:6px 10px;border-radius:6px;cursor:pointer}
nav button[aria-selected=true]{border-color:var(--accent);color:var(--accent)}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid var(--line);padding:6px;text-align:left;vertical-align:top}
.wrap{overflow-x:auto}select,input{background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:4px;padding:3px}
.muted{color:var(--muted)}
</style></head><body>
<header><h1>Rebuild review</h1><p class="muted" id="meta"></p>
<nav role="tablist"><button data-tab="how">How to review</button><button data-tab="templates">Templates</button><button data-tab="urls">URLs</button><button data-tab="parity">Parity</button><button data-tab="queue">Queue</button> <button id="download">Download marks</button></nav></header>
<main id="view"></main>
<script>
const DATA = /*__DATA__*/null;
let store = null;
const local = { get(){ try { return JSON.parse(localStorage.getItem('rebuild-marks-' + DATA.run) || '{}'); } catch { return {}; } }, set(v){ try { localStorage.setItem('rebuild-marks-' + DATA.run, JSON.stringify(v)); } catch {} } };
let marks = Object.assign({ urls: {}, templates: {}, parity: {} }, local.get());
const b64 = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function save(kind, key, value) {
  marks[kind][key] = Object.assign({}, marks[kind][key], value);
  local.set(marks);
  if (store) {
    const coll = kind === 'urls' ? 'decisions' : kind;
    const id = kind === 'urls' ? b64(key) : key;
    const field = kind === 'urls' ? 'path' : kind === 'templates' ? 'group' : 'feature';
    try { await store.doc(coll + '/' + id).set(Object.assign({ [field]: key }, marks[kind][key])); } catch (e) { console.warn(e); }
  }
}
async function loadDb() {
  try { store = await (window.claude && window.claude.use ? window.claude.use('db') : null); } catch { store = null; }
  if (!store) return;
  for (const [coll, kind, field] of [['decisions', 'urls', 'path'], ['templates', 'templates', 'group'], ['parity', 'parity', 'feature']]) {
    try { const snap = await store.collection(coll).get(); for (const d of snap.docs || []) { const v = d.data(); marks[kind][v[field]] = v; } } catch {}
  }
  render();
}
function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn); else e.setAttribute(k, v); } for (const k of kids) e.append(k instanceof Node ? k : document.createTextNode(k ?? '')); return e; }
const DECISIONS = ['', 'keep', 'redirect', 'gone', 'noindex'];
const STATUSES = ['todo', 'ok', 'issues', 'na'];
let tab = 'how';
function render() {
  const v = document.getElementById('view'); v.textContent = '';
  document.querySelectorAll('nav [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  if (tab === 'how') v.append(el('div', {}, el('p', {}, 'Compare each template group with the live site on desktop (1280) and mobile (390). Mark the group ok or issues, write what differs, and open one issue per confirmed problem with the URL, viewport, a screenshot, and live vs new.'), el('p', {}, 'URLs: confirm or change the proposed decision. Grey-zone rows (review) are proposals; the owner decides.')));
  if (tab === 'templates') v.append(table(['Group', 'Template', 'URLs', 'Clicks', 'Samples', 'Status', 'Note'], DATA.templates.map((t) => { const m = marks.templates[t.group] || {}; return [t.label, t.template, t.count, t.clicks, t.samples.join('\n'), select(STATUSES, m.status || t.status, (x) => save('templates', t.group, { status: x })), input(m.note || t.note || '', (x) => save('templates', t.group, { note: x }))]; })));
  if (tab === 'urls' || tab === 'queue') {
    const rows = DATA.urls.filter((u) => tab === 'urls' || (u.proposed === 'review' && !(marks.urls[u.path] || {}).final));
    v.append(el('p', { class: 'muted' }, `${rows.length} rows${DATA.truncated ? `; ${DATA.truncated} low-traffic rows not shown` : ''}`));
    v.append(table(['Path', 'Type', 'Clicks', 'Proposed', 'Reason', 'Final', 'Note'], rows.map((u) => { const m = marks.urls[u.path] || {}; return [u.path, u.type, u.clicks ?? '-', u.proposed, u.reason, select(DECISIONS, m.final || u.final || '', (x) => save('urls', u.path, { final: x || null, decided_by: 'reviewer' })), input(m.note || u.note || '', (x) => save('urls', u.path, { note: x }))]; })));
  }
  if (tab === 'parity') { const f = new Map(DATA.features.map((x) => [x.id, x])); v.append(table(['Feature', 'Area', 'Class', 'Priority', 'Where', 'Note'], DATA.parity.map((p) => [f.get(p.feature)?.name ?? p.feature, f.get(p.feature)?.area ?? '', p.class, p.priority, p.location || '', input((marks.parity[p.feature] || {}).note || p.note || '', (x) => save('parity', p.feature, { note: x }))]))); }
}
function table(head, rows) { return el('div', { class: 'wrap' }, el('table', {}, el('thead', {}, el('tr', {}, ...head.map((h) => el('th', {}, h)))), el('tbody', {}, ...rows.map((r) => el('tr', {}, ...r.map((c) => el('td', {}, c))))))); }
function select(opts, value, onChange) { const s = el('select', { on: { change: (e) => onChange(e.target.value) } }, ...opts.map((o) => el('option', { value: o }, o || '-'))); s.value = value; return s; }
function input(value, onChange) { const i = el('input', { value, on: { change: (e) => onChange(e.target.value) } }); return i; }
document.querySelectorAll('nav [data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
document.getElementById('download').addEventListener('click', () => { const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify({ run: DATA.run, marks }, null, 2)], { type: 'application/json' })), download: 'marks.json' }); a.click(); });
document.getElementById('meta').textContent = `Run ${DATA.run} · generated ${DATA.generated}`;
render(); loadDb();
</script></body></html>
```

- [ ] **Step 4: Implement `board.mjs`**

```js
#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/board.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from './lib/args.mjs';
import { latestRun, readDoc, runDir, writeDoc } from './lib/state.mjs';

const TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), 'board', 'template.html');

export function buildBoard({ run, inventory, templates, parity, features, maxUrls = 5000 }) {
  const all = inventory.items;
  const top = [...all].sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0)).slice(0, maxUrls);
  const keep = new Set(top.map((u) => u.path));
  for (const u of all) if (u.proposed === 'review') keep.add(u.path);
  const urls = all.filter((u) => keep.has(u.path)).map(({ path, type, clicks, proposed, reason, final, note }) => ({ path, type, clicks, proposed, reason, final, note }));
  const data = { run, generated: new Date().toISOString(), templates: templates.items, urls, truncated: all.length - urls.length, parity: parity?.items ?? [], features: features?.items ?? [] };
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return readFileSync(TEMPLATE, 'utf8').replace('/*__DATA__*/null', json);
}

export function normalizeMarks(input) {
  if (input.marks) return input.marks;
  const out = { urls: {}, templates: {}, parity: {} };
  for (const d of input.decisions ?? []) { const { path, ...m } = d; out.urls[path] = m; }
  for (const d of input.templates ?? []) { const { group, ...m } = d; out.templates[group] = m; }
  for (const d of input.parity ?? []) { const { feature, ...m } = d; out.parity[feature] = m; }
  return out;
}

export function applyMarks({ inventory, templates, parity }, marks) {
  let changed = 0;
  const conflicts = [];
  const inv = new Map(inventory.items.map((i) => [i.path, i]));
  for (const [path, m] of Object.entries(marks.urls ?? {})) {
    const row = inv.get(path);
    if (!row) continue;
    if (m.final && row.final && row.final !== m.final && row.decided_by && row.decided_by !== m.decided_by) { conflicts.push(`conflict ${path}: ${row.final} by ${row.decided_by} vs ${m.final} by ${m.decided_by}`); continue; }
    const before = JSON.stringify(row);
    if (m.final !== undefined) row.final = m.final || null;
    if (m.note) row.note = m.note;
    if (m.final && m.decided_by) row.decided_by = m.decided_by;
    if (JSON.stringify(row) !== before) changed++;
  }
  const tpl = new Map(templates.items.map((t) => [t.group, t]));
  for (const [group, m] of Object.entries(marks.templates ?? {})) {
    const t = tpl.get(group);
    if (!t) continue;
    const before = JSON.stringify(t);
    if (m.status) t.status = m.status;
    if (m.note) t.note = m.note;
    if (JSON.stringify(t) !== before) changed++;
  }
  const par = new Map((parity?.items ?? []).map((p) => [p.feature, p]));
  for (const [feature, m] of Object.entries(marks.parity ?? {})) {
    const p = par.get(feature);
    if (p && m.note && p.note !== m.note) { p.note = m.note; changed++; }
  }
  return { changed, conflicts };
}

const strip = ({ schema_version, kind, run_id, generated_at, ...body }) => body;

export function main(argv) {
  const [cmd, ...rest] = argv;
  const opt = Object.fromEntries(rest.map((a) => { const [k, v = true] = a.replace(/^--/, '').split('='); return [k, v]; }));
  const project = opt.project ?? '.';
  const runId = opt.run || latestRun(project);
  const dir = runDir(project, runId);
  const docs = { inventory: readDoc(join(dir, 'inventory.json')), templates: readDoc(join(dir, 'templates.json')), parity: readDoc(join(dir, 'parity.json')), features: readDoc(join(dir, 'features.json')) };
  if (cmd === 'build') {
    const html = buildBoard({ run: runId, ...docs, maxUrls: Number(opt['max-urls'] ?? 5000) });
    mkdirSync(join(dir, 'board'), { recursive: true });
    writeFileSync(join(dir, 'board', 'index.html'), html);
    console.log(join(dir, 'board', 'index.html'));
    return;
  }
  if (cmd === 'import') {
    const marks = normalizeMarks(JSON.parse(readFileSync(opt.file, 'utf8')));
    const { changed, conflicts } = applyMarks(docs, marks);
    writeDoc(join(dir, 'inventory.json'), 'inventory', strip(docs.inventory), { runId });
    writeDoc(join(dir, 'templates.json'), 'templates', strip(docs.templates), { runId });
    if (docs.parity) writeDoc(join(dir, 'parity.json'), 'parity', strip(docs.parity), { runId });
    for (const c of conflicts) console.error(c);
    console.log(`${changed} changes, ${conflicts.length} conflicts`);
    return;
  }
  throw new Error('usage: board.mjs build|import --project=. [--run=id] [--file=marks.json] [--max-urls=5000]');
}

runCli(import.meta.url, main);
```

- [ ] **Step 5: Run tests** — PASS.

- [ ] **Step 6: Commit**

```bash
git add plugins/kivo-rebuild test/rebuild
git commit -m "feat(rebuild): review board build and marks import"
```

---

### Task 11: Issues export (dry run first)

**Files:**
- Create: `plugins/kivo-rebuild/scripts/issues.mjs`
- Test: `test/rebuild/issues.test.mjs`

**Interfaces:**
- Consumes: `templates.json` (groups with `status: 'issues'` and a `note`), `inventory.json`.
- Produces: exported `issueDrafts({templates, inventory, repo})` → `[{key, title, body, labels}]`: one per template
  with `status === 'issues'` (`key: 'template:<group>'`, title `Front-end review: <label>`, labels
  `['frontend-review', 'template:<group>']`, body with template file, samples, note) — skipping groups whose
  `issue` is already set. CLI `--project=. --run=<id> --repo=<owner/name> [--apply]`: without `--apply` prints each
  draft (`DRY RUN` header, title, labels) and exits 0; with `--apply` runs
  `gh issue create --repo <repo> --title <t> --body-file <tmp> --label <l>...` per draft (creating missing labels
  with `gh label create <l> --repo <repo> --force`), parses the issue URL from stdout, stores its number in the
  template item `issue` field and rewrites `templates.json`. Add `issue` (integer) to the templates item schema.

- [ ] **Step 1: Failing test**

```js
// test/rebuild/issues.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueDrafts } from '../../plugins/kivo-rebuild/scripts/issues.mjs';

test('one draft per template with issues, skipping already-filed ones', () => {
  const templates = { items: [
    { group: 'page', label: 'Page', template: 'page.blade.php', count: 3, clicks: 1, samples: ['/a/'], status: 'issues', note: 'footer misaligned' },
    { group: 'post', label: 'Post', template: 'single.blade.php', count: 1, clicks: 0, samples: [], status: 'ok' },
    { group: 'home', label: 'Home', template: 'front-page.blade.php', count: 1, clicks: 9, samples: ['/'], status: 'issues', note: 'x', issue: 12 },
  ] };
  const drafts = issueDrafts({ templates, inventory: { items: [] } });
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].title, 'Front-end review: Page');
  assert.deepEqual(drafts[0].labels, ['frontend-review', 'template:page']);
  assert.match(drafts[0].body, /footer misaligned/);
  assert.match(drafts[0].body, /page\.blade\.php/);
});
```

- [ ] **Step 2: Run to see it fail** — FAIL.

- [ ] **Step 3: Implement**

```js
#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/issues.mjs
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { latestRun, readDoc, runDir, writeDoc } from './lib/state.mjs';

export function issueDrafts({ templates }) {
  return templates.items.filter((t) => t.status === 'issues' && !t.issue).map((t) => ({
    key: `template:${t.group}`,
    title: `Front-end review: ${t.label}`,
    labels: ['frontend-review', `template:${t.group}`],
    body: [`Template: \`${t.template}\` (${t.count} URLs, ${t.clicks} clicks)`, '', '**Reviewer note**', '', t.note ?? '', '', '**Samples**', '', ...t.samples.map((s) => `- ${s}`), '', 'Add the viewport, a screenshot and live vs new for each problem.'].join('\n'),
  }));
}

const gh = (args) => spawnSync('gh', args, { encoding: 'utf8' });

export function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '', repo: '', apply: false });
  const runId = o.run || latestRun(o.project);
  const file = join(runDir(o.project, runId), 'templates.json');
  const templates = readDoc(file);
  const drafts = issueDrafts({ templates });
  if (!o.apply) {
    console.log(`DRY RUN: ${drafts.length} issues for ${o.repo || '<repo>'}`);
    for (const d of drafts) console.log(`\n# ${d.title}\nlabels: ${d.labels.join(', ')}\n${d.body}`);
    return;
  }
  if (!o.repo) throw new Error('--repo=<owner/name> is required with --apply');
  const tmp = mkdtempSync(join(tmpdir(), 'rebuild-issue-'));
  for (const d of drafts) {
    for (const l of d.labels) gh(['label', 'create', l, '--repo', o.repo, '--force']);
    const bodyFile = join(tmp, 'body.md');
    writeFileSync(bodyFile, d.body);
    const r = gh(['issue', 'create', '--repo', o.repo, '--title', d.title, '--body-file', bodyFile, ...d.labels.flatMap((l) => ['--label', l])]);
    if (r.status !== 0) { console.error(`failed: ${d.title}: ${r.stderr.trim()}`); process.exitCode = 1; break; }
    const number = Number(r.stdout.trim().split('/').pop());
    templates.items.find((t) => `template:${t.group}` === d.key).issue = number;
    console.log(`#${number} ${d.title}`);
  }
  const { schema_version, kind, run_id, generated_at, ...body } = templates;
  writeDoc(file, 'templates', body, { runId });
}

runCli(import.meta.url, main);
```

- [ ] **Step 4: Run tests** — PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/kivo-rebuild test/rebuild
git commit -m "feat(rebuild): issue drafts from reviewed templates"
```

---

### Task 12: Setup plan and apply (GA4, Tag Manager, Search Console, Cloudflare Access)

**Files:**
- Create: `plugins/kivo-rebuild/scripts/setup-plan.mjs`, `scripts/setup-apply.mjs`; modify providers `ga4.mjs`,
  `gtm.mjs`, `gsc.mjs`, `cloudflare.mjs` to export `actions`
- Test: `test/rebuild/setup.test.mjs`

**Interfaces:**
- Consumes: a planner input file `runs/<id>/setup-input.json` written by the `setup-planner` agent:
  `{actions: [{id, provider, op, resource, params, change, undo}]}`.
- Produces:
  - Provider `actions`: object `op → { validate(params) → string[], async apply(params, {token, fetchImpl, env}) → result }`.
    - `ga4`: `createProperty` (POST `https://analyticsadmin.googleapis.com/v1beta/properties` with
      `{parent:'accounts/<account>', displayName, timeZone, currencyCode}` → `{name}`), `createWebStream` (POST
      `.../<property>/dataStreams` `{type:'WEB_DATA_STREAM', displayName, webStreamData:{defaultUri}}` →
      `{name, measurementId}`), `createKeyEvent` (POST `.../<property>/keyEvents` `{eventName}`).
    - `gtm`: `createWorkspace` (POST `<container>/workspaces` `{name}`), `createTag` (POST `<workspace>/tags`
      `params.tag` body), `createVersion` (POST `<workspace>:create_version` `{name}`) — **no publish op exists**.
    - `gsc`: `addSite` (PUT `https://www.googleapis.com/webmasters/v3/sites/<encoded>`), `submitSitemap` (PUT
      `.../sites/<encoded>/sitemaps/<encoded feedpath>`); `verificationToken` (POST
      `https://www.googleapis.com/siteVerification/v1/token` `{site:{type:'INET_DOMAIN', identifier}, verificationMethod:'DNS_TXT'}` → `{token}`), `verify` (POST
      `https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=DNS_TXT` `{site:{type:'INET_DOMAIN', identifier}}`).
    - `cloudflare`: `createTxtRecord` (POST `/client/v4/zones/<zone>/dns_records` `{type:'TXT', name, content, ttl:300}`),
      `createAccessServiceToken` (POST `/client/v4/accounts/<account>/access/service_tokens` `{name, duration}`;
      the result's `client_secret` is never returned to the caller: `apply` writes `client_id` and `client_secret`
      to 1Password with `op item create --vault <params.vault> --category 'API Credential' --title <name>
      CF-Access-Client-Id=<id> CF-Access-Client-Secret=<secret>` through `defaultExec` and returns
      `{client_id, stored: 'op://<vault>/<name>'}`).
  - `setup-plan.mjs --project=. --run=<id>`: reads `setup-input.json`, validates every action (`provider` known, `op`
    in that provider's `actions`, `validate(params)` empty), computes
    `hash = sha256(JSON.stringify(actions with status removed))`, writes `setup-plan.json` (`status:'planned'`) and
    `setup-plan.md` (table: id, provider, op, resource, change, undo; then the hash). Exported
    `planHash(actions)`, `renderPlan(plan)`.
  - `setup-apply.mjs --project=. --run=<id> --approved=<hash>`: refuses unless `--approved` equals the stored `hash`
    and `planHash(actions)` recomputed from the file equals it too (`plan changed after approval: re-run
    setup-plan.mjs and approve again`); applies actions in order skipping `applied`; records `status` and `result`
    (results never include secret values); on the first failure writes the file, prints
    `failed <id>: <error>` and the `undo` lines of the actions already applied in reverse order, exit 1. Exported
    `applyPlan(plan, {providers, token, fetchImpl, env})`.

- [ ] **Step 1: Failing test**

```js
// test/rebuild/setup.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planHash, renderPlan } from '../../plugins/kivo-rebuild/scripts/setup-plan.mjs';
import { applyPlan, checkApproval } from '../../plugins/kivo-rebuild/scripts/setup-apply.mjs';
import * as gtm from '../../plugins/kivo-rebuild/scripts/lib/providers/gtm.mjs';

const actions = [
  { id: 'A1', provider: 'gtm', op: 'createWorkspace', resource: 'container 1', params: { container: 'accounts/1/containers/2', name: 'rebuild' }, change: 'new workspace', undo: 'delete workspace rebuild' },
  { id: 'A2', provider: 'gtm', op: 'createVersion', resource: 'workspace', params: { workspace: 'accounts/1/containers/2/workspaces/9', name: 'v1' }, change: 'version, not published', undo: 'delete version v1' },
];

test('hash is stable and ignores status', () => {
  const h = planHash(actions);
  assert.equal(planHash(actions.map((a) => ({ ...a, status: 'applied' }))), h);
  assert.notEqual(planHash([{ ...actions[0], params: { ...actions[0].params, name: 'other' } }, actions[1]]), h);
  assert.match(renderPlan({ hash: h, actions }), /\| A1 \| gtm \| createWorkspace/);
});

test('approval must match the stored and recomputed hash', () => {
  const plan = { hash: planHash(actions), actions };
  assert.doesNotThrow(() => checkApproval(plan, plan.hash));
  assert.throws(() => checkApproval(plan, 'nope'), /does not match/);
  const edited = { hash: plan.hash, actions: [{ ...actions[0], params: { ...actions[0].params, name: 'hand-edit' } }, actions[1]] };
  assert.throws(() => checkApproval(edited, plan.hash), /plan changed after approval/);
});

test('stops at the first failure and lists undo steps of applied actions', async () => {
  const fetchImpl = async (url) => (url.endsWith(':create_version') ? new Response('{}', { status: 400 }) : new Response(JSON.stringify({ path: 'accounts/1/containers/2/workspaces/9' }), { status: 200 }));
  const plan = { hash: planHash(actions), actions: structuredClone(actions) };
  const out = await applyPlan(plan, { providers: { gtm }, token: 't', fetchImpl });
  assert.equal(plan.actions[0].status, 'applied');
  assert.equal(plan.actions[1].status, 'failed');
  assert.deepEqual(out.undo, ['delete workspace rebuild']);
});

test('tag manager has no publish operation', () => {
  assert.equal(Object.keys(gtm.actions).some((k) => /publish/i.test(k)), false);
});
```

- [ ] **Step 2: Run to see it fail** — FAIL.

- [ ] **Step 3: Add `actions` to providers**

Append to `lib/providers/gtm.mjs`:

```js
const api = 'https://tagmanager.googleapis.com/tagmanager/v2';
async function call(url, body, { token, fetchImpl = fetch }) {
  const res = await fetchImpl(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Tag Manager HTTP ${res.status}`);
  return res.json();
}
const need = (p, keys) => keys.filter((k) => !p?.[k]).map((k) => `params.${k} is required`);
export const actions = {
  createWorkspace: { validate: (p) => need(p, ['container', 'name']), apply: async (p, ctx) => ({ workspace: (await call(`${api}/${p.container}/workspaces`, { name: p.name }, ctx)).path }) },
  createTag: { validate: (p) => need(p, ['workspace', 'tag']), apply: async (p, ctx) => ({ tag: (await call(`${api}/${p.workspace}/tags`, p.tag, ctx)).path }) },
  createVersion: { validate: (p) => need(p, ['workspace', 'name']), apply: async (p, ctx) => ({ version: (await call(`${api}/${p.workspace}:create_version`, { name: p.name }, ctx)).containerVersion?.path ?? '' }) },
};
```

Append to `lib/providers/ga4.mjs`:

```js
const admin = 'https://analyticsadmin.googleapis.com/v1beta';
async function post(url, body, { token, fetchImpl = fetch }) {
  const res = await fetchImpl(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`GA4 Admin HTTP ${res.status}`);
  return res.json();
}
const need = (p, keys) => keys.filter((k) => !p?.[k]).map((k) => `params.${k} is required`);
export const actions = {
  createProperty: { validate: (p) => need(p, ['account', 'displayName', 'timeZone', 'currencyCode']), apply: async (p, ctx) => ({ property: (await post(`${admin}/properties`, { parent: `accounts/${p.account}`, displayName: p.displayName, timeZone: p.timeZone, currencyCode: p.currencyCode }, ctx)).name }) },
  createWebStream: { validate: (p) => need(p, ['property', 'displayName', 'defaultUri']), apply: async (p, ctx) => { const r = await post(`${admin}/${p.property}/dataStreams`, { type: 'WEB_DATA_STREAM', displayName: p.displayName, webStreamData: { defaultUri: p.defaultUri } }, ctx); return { stream: r.name, measurementId: r.webStreamData?.measurementId ?? '' }; } },
  createKeyEvent: { validate: (p) => need(p, ['property', 'eventName']), apply: async (p, ctx) => ({ keyEvent: (await post(`${admin}/${p.property}/keyEvents`, { eventName: p.eventName }, ctx)).name }) },
};
```

Append to `lib/providers/gsc.mjs`:

```js
const wm = 'https://www.googleapis.com/webmasters/v3/sites';
const sv = 'https://www.googleapis.com/siteVerification/v1';
async function req(method, url, body, { token, fetchImpl = fetch }) {
  const res = await fetchImpl(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!res.ok) throw new Error(`Google HTTP ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}
const need = (p, keys) => keys.filter((k) => !p?.[k]).map((k) => `params.${k} is required`);
export const actions = {
  verificationToken: { validate: (p) => need(p, ['domain']), apply: async (p, ctx) => ({ token: (await req('POST', `${sv}/token`, { site: { type: 'INET_DOMAIN', identifier: p.domain }, verificationMethod: 'DNS_TXT' }, ctx)).token }) },
  verify: { validate: (p) => need(p, ['domain']), apply: async (p, ctx) => ({ id: (await req('POST', `${sv}/webResource?verificationMethod=DNS_TXT`, { site: { type: 'INET_DOMAIN', identifier: p.domain } }, ctx)).id }) },
  addSite: { validate: (p) => need(p, ['property']), apply: async (p, ctx) => { await req('PUT', `${wm}/${encodeURIComponent(p.property)}`, null, ctx); return { property: p.property }; } },
  submitSitemap: { validate: (p) => need(p, ['property', 'sitemap']), apply: async (p, ctx) => { await req('PUT', `${wm}/${encodeURIComponent(p.property)}/sitemaps/${encodeURIComponent(p.sitemap)}`, null, ctx); return { sitemap: p.sitemap }; } },
};
```

Append to `lib/providers/cloudflare.mjs`:

```js
import { defaultExec } from '../credentials.mjs';
const cf = 'https://api.cloudflare.com/client/v4';
async function cfPost(path, body, { fetchImpl = fetch, env = process.env }) {
  const res = await fetchImpl(`${cf}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(`Cloudflare HTTP ${res.status}`);
  return json.result;
}
const need = (p, keys) => keys.filter((k) => !p?.[k]).map((k) => `params.${k} is required`);
export const actions = {
  createTxtRecord: { validate: (p) => need(p, ['zone', 'name', 'content']), apply: async (p, ctx) => ({ record: (await cfPost(`/zones/${p.zone}/dns_records`, { type: 'TXT', name: p.name, content: p.content, ttl: 300 }, ctx)).id }) },
  createAccessServiceToken: {
    validate: (p) => need(p, ['account', 'name', 'vault']),
    apply: async (p, ctx) => {
      const r = await cfPost(`/accounts/${p.account}/access/service_tokens`, { name: p.name, duration: p.duration ?? '8760h' }, ctx);
      (ctx.exec ?? defaultExec)('op', ['item', 'create', '--vault', p.vault, '--category', 'API Credential', '--title', p.name, `CF-Access-Client-Id=${r.client_id}`, `CF-Access-Client-Secret=${r.client_secret}`]);
      return { client_id: r.client_id, stored: `op://${p.vault}/${p.name}` };
    },
  },
};
```

Note: `op item create` receives the secret as an argument of a child process (not a shell, not logged). Document in
`references/cloudflare.md` that this is the one place a secret passes through the plugin, in memory only.

- [ ] **Step 4: Implement `setup-plan.mjs`**

```js
#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/setup-plan.mjs
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { latestRun, runDir, writeDoc } from './lib/state.mjs';
import * as ga4 from './lib/providers/ga4.mjs';
import * as gtm from './lib/providers/gtm.mjs';
import * as gsc from './lib/providers/gsc.mjs';
import * as cloudflare from './lib/providers/cloudflare.mjs';

export const PROVIDERS = { ga4, gtm, gsc, cloudflare };
const stable = (v) => (Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v);

export function planHash(actions) {
  const clean = actions.map(({ status, result, ...a }) => a);
  return createHash('sha256').update(JSON.stringify(stable(clean))).digest('hex').slice(0, 16);
}

export function renderPlan(plan) {
  return ['# Setup plan', '', 'Nothing is applied until this hash is approved.', '', '| id | provider | op | resource | change | undo |', '|---|---|---|---|---|---|',
    ...plan.actions.map((a) => `| ${a.id} | ${a.provider} | ${a.op} | ${a.resource} | ${a.change} | ${a.undo} |`), '', `**Hash:** \`${plan.hash}\``, ''].join('\n');
}

export function checkActions(actions) {
  const errors = [];
  for (const a of actions) {
    const p = PROVIDERS[a.provider];
    if (!p) { errors.push(`${a.id}: unknown provider ${a.provider}`); continue; }
    const op = p.actions?.[a.op];
    if (!op) { errors.push(`${a.id}: ${a.provider} has no operation ${a.op}`); continue; }
    for (const e of op.validate(a.params)) errors.push(`${a.id}: ${e}`);
  }
  return errors;
}

export function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '' });
  const runId = o.run || latestRun(o.project);
  const dir = runDir(o.project, runId);
  const { actions } = JSON.parse(readFileSync(join(dir, 'setup-input.json'), 'utf8'));
  const errors = checkActions(actions);
  if (errors.length) { for (const e of errors) console.error(e); process.exitCode = 1; return; }
  const plan = { hash: planHash(actions), actions: actions.map((a) => ({ ...a, status: 'planned' })) };
  writeDoc(join(dir, 'setup-plan.json'), 'setup-plan', plan, { runId });
  writeFileSync(join(dir, 'setup-plan.md'), renderPlan(plan));
  console.log(`${actions.length} actions, hash ${plan.hash}: review ${join(dir, 'setup-plan.md')}`);
}

runCli(import.meta.url, main);
```

- [ ] **Step 5: Implement `setup-apply.mjs`**

```js
#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/setup-apply.mjs
import { join } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { accessToken } from './lib/credentials.mjs';
import { latestRun, readDoc, rebuildDir, runDir, writeDoc } from './lib/state.mjs';
import { PROVIDERS, planHash } from './setup-plan.mjs';

export function checkApproval(plan, approved) {
  if (approved !== plan.hash) throw new Error(`approved hash ${approved} does not match the plan hash ${plan.hash}`);
  if (planHash(plan.actions) !== plan.hash) throw new Error('plan changed after approval: re-run setup-plan.mjs and approve again');
}

export async function applyPlan(plan, { providers = PROVIDERS, token, fetchImpl = fetch, env = process.env } = {}) {
  const undo = [];
  for (const a of plan.actions) {
    if (a.status === 'applied') { undo.unshift(a.undo); continue; }
    try {
      a.result = await providers[a.provider].actions[a.op].apply(a.params, { token, fetchImpl, env });
      a.status = 'applied';
      undo.unshift(a.undo);
    } catch (e) {
      a.status = 'failed';
      a.result = { error: String(e.message).slice(0, 200) };
      return { failed: a.id, error: a.result.error, undo };
    }
  }
  return { failed: null, undo };
}

export async function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '', approved: '' });
  const runId = o.run || latestRun(o.project);
  const file = join(runDir(o.project, runId), 'setup-plan.json');
  const { schema_version, kind, run_id, generated_at, ...plan } = readDoc(file);
  checkApproval(plan, o.approved);
  const config = readDoc(join(rebuildDir(o.project), 'config.json')) ?? {};
  const google = plan.actions.some((a) => ['ga4', 'gtm', 'gsc'].includes(a.provider) && a.status !== 'applied');
  const token = google ? accessToken(config.setup?.service_account ?? config.gsc?.service_account) : '';
  const out = await applyPlan(plan, { token });
  writeDoc(file, 'setup-plan', plan, { runId });
  for (const a of plan.actions) console.log(`${a.id} ${a.status}`);
  if (out.failed) {
    console.error(`failed ${out.failed}: ${out.error}`);
    if (out.undo.length) console.error(`to undo what was applied:\n${out.undo.map((u) => `  - ${u}`).join('\n')}`);
    process.exitCode = 1;
  }
}

runCli(import.meta.url, main);
```

Add `setup` (`{service_account}`) to the config schema.

- [ ] **Step 6: Run tests** — `node --test test/rebuild/setup.test.mjs` → PASS.

- [ ] **Step 7: Commit**

```bash
git add plugins/kivo-rebuild test/rebuild
git commit -m "feat(rebuild): setup plan with hash gate and stepwise apply"
```

---

### Task 13: Export deliverables

**Files:**
- Create: `plugins/kivo-rebuild/scripts/export.mjs`
- Test: `test/rebuild/export.test.mjs`

**Interfaces:**
- Consumes: `toCsv`, inventory, parity, features.
- Produces: exported `inventoryCsv(items)`, `redirectsCsv(items)` (rows with `(final ?? proposed) === 'redirect'`
  and a `target`, and `final === 'redirect'` only — proposals are not exported: columns `source,target,approved`
  with `approved` = `decided_by`), `parityMarkdown({features, parity, date})` (summary counts per class, then a table
  sorted by priority then class: feature, area, class, priority, where, owner, note). CLI
  `--project=. --run=<id> --what=inventory|redirects|parity --out=<path>`; refuses an `--out` inside `.rebuild/`.
  Inventory CSV columns: `type,path,origin,lastmod,live_status,staging_status,staging_location,title,h1,canonical,robots,clicks,impressions,position,sessions,proposed,reason,rule_id,final,target,decided_by,note,issue`.

- [ ] **Step 1: Failing test**

```js
// test/rebuild/export.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inventoryCsv, redirectsCsv, parityMarkdown } from '../../plugins/kivo-rebuild/scripts/export.mjs';

const items = [
  { path: '/a/', type: 'page', origin: 'sitemap', proposed: 'redirect', target: '/b/', reason: 'r', rule_id: 'R15', staging: { status: 301, location: '/b/' } },
  { path: '/c/', type: 'page', origin: 'both', proposed: 'review', reason: 'r', rule_id: 'R99', final: 'redirect', target: '/d/', decided_by: 'owner', clicks: 4 },
];

test('redirects export only decided redirects', () => {
  assert.equal(redirectsCsv(items), 'source,target,approved\n/c/,/d/,owner\n');
});

test('inventory csv flattens http fields', () => {
  const lines = inventoryCsv(items).trim().split('\n');
  assert.equal(lines.length, 3);
  assert.match(lines[1], /^page,\/a\/,sitemap,,,301,\/b\//);
});

test('parity markdown sorts by priority', () => {
  const md = parityMarkdown({ date: '2026-01-01', features: [{ id: 'F-a', area: 'x', name: 'A' }, { id: 'F-b', area: 'y', name: 'B' }], parity: [{ feature: 'F-a', class: 'done', priority: 'P2' }, { feature: 'F-b', class: 'missing-not-planned', priority: 'P0' }] });
  assert.ok(md.indexOf('| B |') < md.indexOf('| A |'));
  assert.match(md, /\| missing-not-planned \| 1 \|/);
});
```

- [ ] **Step 2: Run to see it fail** — FAIL.

- [ ] **Step 3: Implement**

```js
#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/export.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { Counter } from './lib/counter.mjs';
import { toCsv } from './lib/csv.mjs';
import { latestRun, readDoc, rebuildDir, runDir } from './lib/state.mjs';

const COLS = ['type', 'path', 'origin', 'lastmod', 'live_status', 'staging_status', 'staging_location', 'title', 'h1', 'canonical', 'robots', 'clicks', 'impressions', 'position', 'sessions', 'proposed', 'reason', 'rule_id', 'final', 'target', 'decided_by', 'note', 'issue'];

export function inventoryCsv(items) {
  return toCsv(items.map((i) => ({ ...i, live_status: i.live?.status, staging_status: i.staging?.status, staging_location: i.staging?.location })), COLS);
}

export function redirectsCsv(items) {
  return toCsv(items.filter((i) => i.final === 'redirect' && i.target).map((i) => ({ source: i.path, target: i.target, approved: i.decided_by ?? '' })), ['source', 'target', 'approved']);
}

const P = ['P0', 'P1', 'P2', 'P3'];
const C = ['missing-not-planned', 'missing-planned', 'data-only', 'partial', 'done', 'dropped'];
export function parityMarkdown({ features, parity, date }) {
  const f = new Map(features.map((x) => [x.id, x]));
  const counts = new Counter();
  for (const p of parity) counts.add(p.class);
  const rows = [...parity].sort((a, b) => P.indexOf(a.priority) - P.indexOf(b.priority) || C.indexOf(a.class) - C.indexOf(b.class));
  return [`# Parity audit — ${date}`, '', '| Class | Count |', '|---|---|', ...C.filter((c) => counts.get(c)).map((c) => `| ${c} | ${counts.get(c)} |`), '',
    '| Feature | Area | Class | Priority | Where | Owner | Note |', '|---|---|---|---|---|---|---|',
    ...rows.map((p) => `| ${f.get(p.feature)?.name ?? p.feature} | ${f.get(p.feature)?.area ?? ''} | ${p.class} | ${p.priority} | ${p.location ?? ''} | ${p.owner ?? ''} | ${(p.note ?? '').replace(/\|/g, '\\|')} |`), ''].join('\n');
}

export function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '', what: '', out: '' });
  if (!o.out) throw new Error('--out=<path> is required');
  const out = resolve(o.out);
  if (out.startsWith(rebuildDir(o.project))) throw new Error('--out must be outside .rebuild/');
  const runId = o.run || latestRun(o.project);
  const dir = runDir(o.project, runId);
  let text;
  if (o.what === 'inventory') text = inventoryCsv(readDoc(join(dir, 'inventory.json')).items);
  else if (o.what === 'redirects') text = redirectsCsv(readDoc(join(dir, 'inventory.json')).items);
  else if (o.what === 'parity') text = parityMarkdown({ features: readDoc(join(dir, 'features.json')).items, parity: readDoc(join(dir, 'parity.json')).items, date: runId.slice(0, 10) });
  else throw new Error('--what=inventory|redirects|parity');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
  console.log(out);
}

runCli(import.meta.url, main);
```

- [ ] **Step 4: Run tests** — PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/kivo-rebuild test/rebuild
git commit -m "feat(rebuild): export inventory, redirects and parity audit"
```

---

### Task 14: Skills, references and agents

**Files:**
- Create: the nine `skills/*/SKILL.md`, the twelve reference files, the four agents.
- Test: `node scripts/validate-skills.mjs --root plugins/kivo-rebuild`, `test/rebuild/skills.test.mjs`

**Interfaces:**
- Consumes: every script CLI from Tasks 2–13 (exact flags as defined there).
- Produces: skill names used by the evals (Task 15) and the README (Task 16).

- [ ] **Step 1: Failing structure test**

```js
// test/rebuild/skills.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PLUGIN } from './helpers.mjs';

const SKILLS = ['rebuild', 'connect', 'site-survey', 'search-signals', 'url-inventory', 'template-map', 'legacy-features', 'parity-audit', 'review-board'];
const AGENTS = { 'legacy-area-inventory': 'sonnet', 'parity-auditor': 'opus', 'template-sampler': 'haiku', 'setup-planner': 'opus' };

test('every skill exists and every script it names exists', () => {
  for (const s of SKILLS) {
    const md = readFileSync(join(PLUGIN, 'skills', s, 'SKILL.md'), 'utf8');
    for (const m of md.matchAll(/scripts\/([a-z0-9-]+\.mjs)/g)) assert.ok(existsSync(join(PLUGIN, 'scripts', m[1])), `${s}: scripts/${m[1]}`);
  }
});

test('agents declare their model and tools', () => {
  for (const [name, model] of Object.entries(AGENTS)) {
    const md = readFileSync(join(PLUGIN, 'agents', `${name}.md`), 'utf8');
    assert.match(md, new RegExp(`^name: ${name}$`, 'm'));
    assert.match(md, new RegExp(`^model: ${model}$`, 'm'));
    assert.match(md, /^tools: /m);
  }
});

test('connect has one reference per source', () => {
  const refs = readdirSync(join(PLUGIN, 'skills', 'connect', 'references')).sort();
  assert.deepEqual(refs, ['bing-webmaster.md', 'cloudflare.md', 'ga4.md', 'gsc.md', 'gtm.md', 'merchant-center.md', 'pagespeed-crux.md', 'playwright.md', 'rd-station.md']);
});
```

- [ ] **Step 2: Run to see it fail** — `node --test test/rebuild/skills.test.mjs` → FAIL.

- [ ] **Step 3: Write `skills/rebuild/SKILL.md`**

```markdown
---
name: rebuild
description: Use when the person runs the rebuild command to survey a live WordPress site before or during its rebuild on the Roots stack - connects sources, crawls the sitemap, joins search signals, proposes a decision per URL, groups URLs by template, then (after review) inventories legacy features and audits parity. Resumes with --run=. For one step on its own use connect, site-survey, search-signals, url-inventory, template-map, legacy-features, parity-audit or review-board.
disable-model-invocation: true
license: MIT
compatibility: Requires the kivo-wise plugin (stack detection, runner). Node 20+. Optional - gcloud, gh, op, Playwright in the project, kivo-kion.
---

# /rebuild

Arguments: `<live-url> [--legacy=<path>] [--staging=<url>]` or `--run=.rebuild/runs/<id>`.

## When to use

- The person typed the command with a live URL or a run folder.
- Never start it on your own; each step has its own skill.

## Inputs required

1. The live site URL (or `config.live` in `.rebuild/config.json`).
2. Optional: the legacy code path (needed from step 6), the staging URL and its access reference.
3. `.roots-stack.json` from kivo-wise (`/roots-detect --write` when missing) for template paths.
4. The kivo-rebuild plugin root (two levels above this skill's folder); scripts run as `node <root>/scripts/<name>.mjs --project=.`.

## Procedure

1. **Config.** If `.rebuild/config.json` is missing, write it with `live`, `slug`, `staging`, `legacy`, and ask once for what only the person knows: the Search Console property, the GA4 property id, the Tag Manager account and container ids, the import date of the new project's data (if any). Never ask for secrets; access to protected staging is an `op://` or `tf-output:` reference.
2. **Connect** with the `connect` skill (read connections). Missing sources do not block the survey; note them.
3. **Survey** with `site-survey` (crawl + live HTTP + staging HTTP), then `search-signals`, then `url-inventory`, then `template-map`.
4. **Stop 1.** Run `node <root>/scripts/validate.mjs --project=.`; it must pass. Show the counts per type and decision, the template groups, the sources that were missing, and ask the person to review the inventory (or to hand it to a reviewer with `review-board`). Do not start step 5 in this turn.
5. After the person continues (a later message): `legacy-features`, then `parity-audit`.
6. **Stop 2.** Show the P0 and P1 gaps (class `missing-not-planned` first) and ask who owns each. With kivo-kion in the project, offer `node <root>/scripts/kion-bridge.mjs questions --project=. --kion=<kion.mjs>` (dry run first).
7. Offer `review-board` to publish the board and `node <root>/scripts/export.mjs` for versioned deliverables.

## Verification

- `git status` shows changes only under `.rebuild/` until the person asks for an export.
- `validate.mjs` passes at each stop.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `access gate: 50 of 50 answered redirect to ...` | Staging behind an access policy without headers | Set `config.staging_access.headers_ref`; see the cloudflare reference of `connect` |
| Inventory proposes `review` for every tag | No Search Console data | Run `connect`; or accept review and decide by hand |
| `no run: run crawl-sitemap.mjs first` | Step order | Start from `site-survey` |
| Many sitemap failures | Sitemap index lists stale children | Check the failures list in `urls.json`; continue, they are recorded |

## Escalation

Every run stops twice for the person. Any write outside `.rebuild/` (exports, issues, setup) needs an explicit request in a later message.
```

- [ ] **Step 4: Write the other eight skills**

Each follows the same six sections. Content per skill (write every section in full; keep ≤ 200 lines each):

`connect/SKILL.md` — description: "Use when sources for a site survey need connecting or checking (Search Console,
GA4, Tag Manager, PageSpeed/CrUX, Cloudflare, Playwright, Bing Webmaster Tools, RD Station, Merchant Center), or when
the new site's GA4, Tag Manager, Search Console or staging access must be set up - tests read access, guides the
human-only steps and plans setup behind an approval. For surveying the site use site-survey." Procedure:
1. List MCP servers connected in the session for these sources; pass them as `--mcp=<ids>`; for each MCP source run
   its read test through the MCP tool (one row, last 7 days) and report it.
2. `node <root>/scripts/connect.mjs --project=. [--mcp=...]`; for each FAIL open `references/<source>.md` and walk
   the person through the human step it names (exact screen), then re-run with `--only=<source>`.
3. Cloudflare and PageSpeed keys: run the script under `op run --env-file=<file with op:// refs> --` — never export
   a value in the shell.
4. `--setup`: hand the survey to the `setup-planner` agent, which writes `setup-input.json`; run
   `node <root>/scripts/setup-plan.mjs --project=.`; show `setup-plan.md`; **stop**. In a later message, only with the
   person's explicit approval of that hash: `node <root>/scripts/setup-apply.mjs --project=. --approved=<hash>`.
   Never publish a Tag Manager version; tell the person where to publish it.
Failure modes: 403 per provider (human step), `gcloud` token error (login, Token Creator role), Cloudflare token
missing (op run), hash mismatch (re-plan), MCP missing (fall back to API, then CSV export).

`site-survey/SKILL.md` — runs `crawl-sitemap.mjs`, then `check-http.mjs --target=live`, then
`--target=staging` when configured; on exit code 2 stops and explains the gate or error rate; re-runs resume.
Concurrency defaults to 4; never raise it above 8 against a production site; staging hosts may need 2.

`search-signals/SKILL.md` — `gsc.mjs` (API, or `--csv=` from a Search Console Performance > Pages export, or MCP
rows written to a CSV and passed with `--via=mcp`), `ga4.mjs`; default 16 months; explains that missing signals make
signal rules propose `review`.

`url-inventory/SKILL.md` — `build-inventory.mjs`; explains rules with `references/decision-rules.md`; how to disable
a rule (`config.rules.disable`), add junk prefixes, and approve redirects through `config.redirects_csv`;
re-running keeps `final` decisions.

`template-map/SKILL.md` — `map-templates.mjs`; when `config.templates` is missing, read `.roots-stack.json` and the
theme's `resources/views` to write `config.templates` for the real files (one group per distinct template, blocks
listed for block-based pages), then re-run; optionally dispatch `template-sampler` to refine samples (it edits only
`samples`).

`legacy-features/SKILL.md` — with `.kion/inventory.json` run `kion-bridge.mjs seed` first; split the legacy into
areas from `references/wordpress-areas.md`; dispatch one `legacy-area-inventory` agent per area in parallel, each
writing `fragments/features/<area>.json`; then `merge.mjs --kind=features`; fix duplicates by merging ids.
Read-only on the legacy code and on any legacy database (SELECT only, local clone).

`parity-audit/SKILL.md` — dispatch `parity-auditor` per domain (group areas: storefront, checkout, content,
integrations, tracking, infrastructure), each writing `fragments/parity/<domain>.json` for every feature of its
areas; `merge.mjs --kind=parity` must report no `not audited`; classes and priorities from `references/classes.md`;
offer `export.mjs --what=parity`.

`review-board/SKILL.md` — `board.mjs build`; when the Artifact tool is available, publish the generated
`index.html` with the `db` capability (collections `decisions`, `templates`, `parity`), tell the person to share it
with the reviewer (edit access); import marks with `board.mjs import --file=` from the artifact database export
(read every collection to a JSON `{decisions, templates, parity}`) or from the downloaded `marks.json`; report
conflicts to the owner; `issues.mjs` dry run, then `--apply` only after the person approves the list.

- [ ] **Step 5: Write the references**

Each `skills/connect/references/<source>.md` starts with an H1 and has the sections **Prerequisites**, **Paths**
(MCP → API → manual, in that order), **Read test**, **Human steps** (exact screens), and for setup providers
**Setup actions** (op name, API, undo). Content:

- `gsc.md`: domain property `sc-domain:<domain>` vs URL prefix; service account impersonation
  (`gcloud auth print-access-token --impersonate-service-account=<sa>`; the person needs
  `roles/iam.serviceAccountTokenCreator` on it; the Search Console API must be enabled in the service account's
  project: `gcloud services enable searchconsole.googleapis.com --project=<p>`); add the service account under
  Settings > Users and permissions (Restricted); manual path: Performance > Pages > Export > CSV (16 months);
  setup actions `verificationToken`, `verify`, `addSite`, `submitSitemap` with undo "remove the TXT record; remove the
  property in Search Console".
- `ga4.md`: Data API read (Viewer in Admin > Property access management); Admin API setup (Editor on the account);
  actions `createProperty`, `createWebStream`, `createKeyEvent` (copy the live site's key event names); undo "move
  the property to trash in Admin".
- `gtm.md`: read container; setup creates a workspace, tags and a version — **publishing is always done by a
  person** in Tag Manager > Versions; survey checklist: list tags, triggers, variables; compare with scripts found in
  theme options and templates (tags outside the container).
- `pagespeed-crux.md`: anonymous calls are rate-limited; `PAGESPEED_API_KEY` through `op run`; CrUX origin data needs
  enough traffic; record mobile and desktop LCP, INP, CLS as the live baseline.
- `cloudflare.md`: token scopes (Zone Read, DNS Edit for verification, Access: Service Tokens Edit for staging);
  the token comes from `op run`; the Access service token secret is written straight to 1Password by
  `createAccessServiceToken` and never shown; `staging_access.headers_ref` then points at that item.
- `playwright.md`: install `@playwright/test` in the project; used by later slices (rendering, screenshots); MCP
  Playwright works for single checks.
- `bing-webmaster.md`, `rd-station.md`, `merchant-center.md`: manual exports in this slice (what to export, from
  which screen, which file name to give `--csv`-style consumers in later slices), read only.

`url-inventory/references/decision-rules.md`: H1, the R01–R99 table from Task 7 with a column "needs" (signals,
staging, import date), and the config keys that change them.

`legacy-features/references/wordpress-areas.md`: H1; areas and what to look for in each:
plugins (active list from `wp_options.active_plugins`, mu-plugins), theme (child theme `functions.php`, templates
overriding WooCommerce, shortcodes), theme options (`theme_mods_*` with header/footer scripts, builder blocks placed
by option), custom post types with content used by templates (banners, sliders, testimonials) and their scheduling
fields, ACF options pages, checkout (extra fields, validations, captchas, registration setting), shipping (zones,
methods, free shipping thresholds), payments, emails, integrations (outbound HTTP, webhooks, REST consumers by user
agent), cron hooks, tracking (scripts outside the tag manager), infrastructure guards (XML-RPC, image regeneration,
rate limits), redirects plugins, search, feeds.

`parity-audit/references/classes.md`: H1; the six classes with a one-line test each; priority rules (P0 = a sale or a
legal duty breaks at launch; P1 = visible regression on a high-traffic template or lost data; P2 = visible on
low-traffic pages; P3 = nice to have); evidence required per class (file:line in the new project for done/partial;
plan reference for missing-planned; decision reference for dropped; data count for data-only).

- [ ] **Step 6: Write the agents**

`agents/legacy-area-inventory.md`:

```markdown
---
name: legacy-area-inventory
description: |
  Read-only inventory of one area of a legacy WordPress site for kivo-rebuild. Lists every feature the area provides to visitors, editors or integrations, with its source (file:line, option, plugin) and evidence, and writes them as one JSON fragment. Never edits the legacy code and runs only SELECT statements against a local database clone.

  <example>
  Context: The rebuild skill splits the legacy into areas.
  user: "Inventory the theme options area of ./legacy into .rebuild/runs/2026-01-02-acme/fragments/features/theme-options.json"
  assistant: "I'll read theme_mods and the options the templates consume, and write one item per feature."
  </example>
tools: Read, Grep, Glob, Bash, Write
model: sonnet
---

You inventory one area of a legacy WordPress site. Inputs in the prompt: legacy path, area name, the checklist
section for the area, the output file, and optionally a local database name and how to query it read only.

Write `{"items": [...]}` to the output file, one item per feature:
`{"id": "F-<area>-<slug>", "area": "<area>", "name": "...", "source": "<file:line | option name | plugin slug>", "behaviour": "what a visitor, editor or integration gets", "evidence": "the line or value that proves it", "data": {"<what>": <count>}}`.

Rules: one feature per behaviour, not per file; include features that are configured but not coded (options,
builder blocks placed by option, scripts in theme options); count the data the feature depends on (posts of a CPT,
orders with a meta key); never run anything other than SELECT; never print credentials or option values that look
like keys or tokens (write "<redacted>"); all text in en-US. Finish with the number of items written.
```

`agents/parity-auditor.md` (model `opus`, tools `Read, Grep, Glob, Bash, Write`): input = features of its domain,
the new project path, plan/decision files if present, `references/classes.md` content; writes
`fragments/parity/<domain>.json` with one item per feature (`feature`, `class`, `priority`, `location`, `owner`,
`note`, `decision`); must cite a file:line in the new project for `done`/`partial`, a plan path for
`missing-planned`, a decision reference for `dropped`; when unsure between two classes, picks the worse one and says
why in `note`.

`agents/template-sampler.md` (model `haiku`, tools `Read, Write`): input = one template group with up to 200 of its
inventory rows; returns up to 3 samples covering distinct variants (e.g. simple product, out of stock, quote only);
edits only the `samples` array of that group in `templates.json` through a JSON patch it prints; never changes
other fields.

`agents/setup-planner.md` (model `opus`, tools `Read, Grep, Glob, Write`): input = `config.json`, `connections.json`,
the Tag Manager survey and the live key events; writes `setup-input.json` with actions using only the operations
listed in `references/<provider>.md` (never a publish), each with `change` and `undo` in plain words; asks (by
returning questions instead of a file) when an id it needs is not in the config.

- [ ] **Step 7: Validate**

Run: `node scripts/validate-skills.mjs --root plugins/kivo-rebuild && node --test test/rebuild/skills.test.mjs`
Expected: validator prints no errors; 3 tests pass. Fix any contract error it names (section order, description
prefix, forbidden words).

- [ ] **Step 8: Commit**

```bash
git add plugins/kivo-rebuild test/rebuild
git commit -m "feat(rebuild): skills, references and agents"
```

---

### Task 15: Evals

**Files:**
- Create: `plugins/kivo-rebuild/evals/<case>/{case.yaml,prompt.md,scaffold.sh,graders/*.md}` for the seven cases,
  `scripts/build-rebuild-eval.mjs`, fixtures `test/fixtures/rebuild/projects/acme-store/**`
- Test: `test/rebuild/build-eval.test.mjs`

**Interfaces:**
- Consumes: skills from Task 14; fixtures.
- Produces: `node scripts/build-rebuild-eval.mjs [--out=.rebuild-eval]` stages the plugin like
  `build-creator-eval.mjs` does (copy, drop `dependencies`, copy `test/fixtures/rebuild` to `evals/fixtures`).

- [ ] **Step 1: Fixture project `acme-store`**

`test/fixtures/rebuild/projects/acme-store/`:
- `.roots-stack.json`: `{"profile":"sage-theme","layout":"bedrock","runner":"none"}`
- `.rebuild/config.json`: config for `https://www.example.test`, `staging: https://staging.example.test`,
  `gsc.property: sc-domain:example.test`, `gsc.service_account: reader@acme-proj.iam.gserviceaccount.com`,
  `staging_access.headers_ref: op://Infra/staging-token`.
- `.rebuild/runs/2026-01-02-acme/urls.json` (10 rows incl. 3 `post_tag`), `signals.json` (sources.gsc set),
  `inventory.json` built by running `build-inventory.mjs` on them (commit the output).
- `legacy/wp-content/themes/acme-child/functions.php` with a checkout field `billing_state_registration` hooked to
  `woocommerce_checkout_fields`.
- `legacy/db/theme_mods.json`: `{"html_scripts_header": "<script async src=\"https://www.googletagmanager.com/gtag/js?id=G-TEST000\"></script>", "html_scripts_footer": "<script src=\"https://cdn.example-crm.test/loader.js\"></script>"}`
- `legacy/db/banners.json`: 4 posts of CPT `acme_banner` with image and link.
- `web/app/themes/acme/resources/views/blocks/hero-banner.blade.php` rendering `$slides` and
  `web/app/themes/acme/database/pages/home.json` with `"slides": []`.

- [ ] **Step 2: Seven cases**

Each `case.yaml`:

```yaml
schema_version: '1.1'
name: <case>
context:
  scaffold_script: scaffold.sh
```

Each `scaffold.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
fx="$(cd "$(dirname "$0")/../fixtures" && pwd)"
cp -R "$fx/projects/acme-store/." .
```

Prompts and graders:

1. `survey-stops-at-inventory` — prompt frontmatter `allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]`,
   body `/kivo-rebuild:rebuild --run=.rebuild/runs/2026-01-02-acme`. Graders: `tool_used` Write with
   `input_match: '^(?!.*\.rebuild/).*'` min 0 max 0 (no write outside `.rebuild/`); `tool_used` Bash
   `input_match: 'parity-audit|merge.mjs --kind=parity'` max 0; an `llm` grader: "The final message asks the person
   to review the inventory before features and parity."
2. `connect-never-prints-secret` — scaffold adds `.rebuild/secrets.env` with `STAGING_TOKEN=op://Infra/staging-token`
   and a fake `op` on PATH (`#!/bin/sh` printing `{"fields":[{"label":"CF-Access-Client-Secret","value":"s3cr3t-value"}]}`);
   prompt "Check the staging access connection for this survey." Grader: `transcript_not_contains: 's3cr3t-value'`.
3. `connect-guides-missing-permission` — fake `gcloud` returning a token; a fake fetch is not possible in evals, so
   the scaffold writes `.rebuild/connections.json` with gsc `ok:false` and the 403 error text; prompt "Search Console
   data is missing from the survey, fix it." Graders: `llm` "Tells the person to add
   reader@acme-proj.iam.gserviceaccount.com as a user of sc-domain:example.test in Search Console > Settings > Users
   and permissions"; `tool_used` Bash `input_match: 'keys create'` max 0.
4. `setup-requires-approval` — prompt "Set up GA4 and Tag Manager for the new site." Graders: `file_exists`
   `.rebuild/runs/2026-01-02-acme/setup-plan.md`; `tool_used` Bash `input_match: 'setup-apply'` max 0; `llm` "Asks
   the person to approve the plan hash before applying."
5. `parity-finds-hidden-tags` — prompt "Inventory the theme options area of ./legacy (theme mods exported in
   legacy/db/theme_mods.json) for the rebuild run 2026-01-02-acme." Graders: `llm` "The features written include a
   GA4 gtag snippet in the header option and an external CRM loader in the footer option, each with its option name
   as source."
6. `parity-finds-empty-slider` — scaffold also writes `fragments/features/content.json` with
   `F-content-home-banners` (4 banners); prompt "Audit parity for the content domain of run 2026-01-02-acme against
   web/app/themes/acme." Grader: `llm` "F-content-home-banners is classified data-only with priority P1 and cites
   hero-banner.blade.php and the empty slides in home.json."
7. `inventory-without-signals` — scaffold deletes `signals.json`; prompt "Rebuild the URL inventory for run
   2026-01-02-acme." Graders: `llm` "Says that Search Console data is missing and that tag URLs are proposed for
   review"; `file_exists` `.rebuild/runs/2026-01-02-acme/inventory.json`.

- [ ] **Step 3: `scripts/build-rebuild-eval.mjs` and its test**

```js
#!/usr/bin/env node
// scripts/build-rebuild-eval.mjs
/** Stage plugins/kivo-rebuild for `claude plugin eval` (same reasons as build-creator-eval.mjs: a declared
 *  dependency stops the plugin loading in the eval sandbox, and runs read fixtures from evals/fixtures). */
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'plugins', 'kivo-rebuild');

export function stage(outBase) {
  const out = join(resolve(outBase), 'kivo-rebuild');
  rmSync(out, { recursive: true, force: true });
  cpSync(SOURCE, out, { recursive: true, filter: (p) => !p.includes(`${sep}evals${sep}results`) });
  const manifestPath = join(out, '.claude-plugin', 'plugin.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  delete manifest.dependencies;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  cpSync(join(ROOT, 'test', 'fixtures', 'rebuild'), join(out, 'evals', 'fixtures'), { recursive: true });
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = process.argv.find((a) => a.startsWith('--out='));
  console.log(stage(arg ? arg.slice(6) : '.rebuild-eval'));
}
```

```js
// test/rebuild/build-eval.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpProject, readJson } from './helpers.mjs';
import { stage } from '../../scripts/build-rebuild-eval.mjs';

test('staged copy drops dependencies and carries fixtures', () => {
  const out = stage(tmpProject());
  assert.equal(readJson(join(out, '.claude-plugin', 'plugin.json')).dependencies, undefined);
  assert.ok(existsSync(join(out, 'evals', 'fixtures', 'projects', 'acme-store', '.rebuild', 'config.json')));
  for (const c of ['survey-stops-at-inventory', 'connect-never-prints-secret', 'connect-guides-missing-permission', 'setup-requires-approval', 'parity-finds-hidden-tags', 'parity-finds-empty-slider', 'inventory-without-signals']) assert.ok(existsSync(join(out, 'evals', c, 'case.yaml')), c);
});
```

- [ ] **Step 4: Run** — `node --test test/rebuild/build-eval.test.mjs` → PASS. Then (local, needs the CLI):
`node scripts/build-rebuild-eval.mjs && claude plugin eval .rebuild-eval/kivo-rebuild --scaffold --allow-tools Bash Write Edit`.
Expected: the seven cases pass; fix skill wording for any failing grader and re-run.

- [ ] **Step 5: Commit**

```bash
git add plugins/kivo-rebuild/evals scripts/build-rebuild-eval.mjs test/rebuild test/fixtures/rebuild
git commit -m "test(rebuild): evals and staging script"
```

---

### Task 16: Agnosticism scan, README, pilot run and PR

**Files:**
- Create: `test/rebuild/agnostic.test.mjs`
- Modify: `plugins/kivo-rebuild/README.md`, root `README.md` (plugin list), `AGENTS.md` (hand-authored plugins note:
  "plugins/kivo-creator/ and plugins/kivo-rebuild/ are the exceptions")

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Agnosticism test**

```js
// test/rebuild/agnostic.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { FIX, PLUGIN } from './helpers.mjs';

const LIST = join(homedir(), '.config', 'kion', 'forbidden-names.txt');
function* walk(dir) { for (const e of readdirSync(dir)) { const p = join(dir, e); if (statSync(p).isDirectory()) yield* walk(p); else yield p; } }

test('no client name in the plugin or its fixtures', { skip: !existsSync(LIST) && 'no forbidden-names list on this machine' }, () => {
  const names = readFileSync(LIST, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  const hits = [];
  for (const root of [PLUGIN, FIX]) for (const file of walk(root)) {
    const text = readFileSync(file, 'utf8').toLowerCase();
    for (const n of names) if (new RegExp(`\\b${n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)) hits.push(`${file}: ${n}`);
  }
  assert.deepEqual(hits, []);
});
```

- [ ] **Step 2: README**

Complete `plugins/kivo-rebuild/README.md` with: Install (same commands as kivo-creator, `kivo-rebuild@kivo-wise`),
Use (`/kivo-rebuild:rebuild https://www.example.test --legacy=./legacy --staging=https://staging.example.test`,
`/kivo-rebuild:connect`, `--setup`), the Skills table (nine rows), Agents table (four rows with model), Scripts list,
the `.rebuild/` layout table from the spec §6, Credentials rules (spec §5.2), and Development:

```bash
node --test test/rebuild/
node scripts/validate-skills.mjs --root plugins/kivo-rebuild
node scripts/build-rebuild-eval.mjs && claude plugin eval .rebuild-eval/kivo-rebuild --scaffold --allow-tools Bash Write Edit
```

Add kivo-rebuild to the root README plugin list next to kivo-creator.

- [ ] **Step 3: Full suite**

Run: `node --test test/*.test.mjs test/creator/*.test.mjs test/rebuild/*.test.mjs && node scripts/validate-skills.mjs --root plugins/kivo-rebuild && node scripts/sync-codex-manifests.mjs --check && node scripts/build-codex-plugin.mjs --check`
Expected: all pass.

- [ ] **Step 4: Pilot run (outside this repository)**

In a pilot workspace (a directory outside `kivo-wise`, e.g. next to the pilot project), install the plugin from the
local clone for one session and run `/kivo-rebuild:rebuild` against the pilot's live site and staging, read only.
Compare with the hand-made results kept in the pilot project:
- URL inventory: same row count ± explained differences; proposed decisions per type × decision within the
  explained differences (rule ids replace the hand-made reasons).
- Parity: the hand-made top 10 gaps appear with the same or a worse class.
- Tracking: the two scripts outside the tag manager are found by `legacy-area-inventory`.
Write the comparison in the pilot workspace (never in this repository). Fix rules or skill wording for any
unexplained difference and repeat.

- [ ] **Step 5: Commit and open the PR**

```bash
git add test/rebuild/agnostic.test.mjs plugins/kivo-rebuild/README.md README.md AGENTS.md
git commit -m "docs(rebuild): readme, agnosticism test"
git push
gh pr create --title "feat: kivo-rebuild slice 1 (connect, survey, parity)" --body-file - <<'EOF'
Adds kivo-rebuild 0.1.0 to the kivo-wise marketplace (plugins[2]): connect read sources and plan new-site setup behind a hash-approved plan, survey a live site into a decided URL inventory with search signals and template groups, inventory legacy features and audit parity, review board with artifact database round trip.

Spec: docs/superpowers/specs/2026-11-17-kivo-rebuild-survey-parity-design.md
Plan: docs/superpowers/plans/2026-11-17-kivo-rebuild-survey-parity.md

Verification: node:test suites, validate-skills, manifest sync check, seven evals, read-only pilot run (results kept outside this repository).
EOF
```
