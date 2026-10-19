# kivo-creator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship `kivo-creator`, a second plugin in this repository (`plugins/kivo-creator`, MIT) that turns an HTML page or a Figma frame into a WordPress page on the Roots stack by recognising existing blocks first, scaffolding only the gaps, and proving fidelity with a pixel diff (design phases 1 to 3 of `docs/plans/2026-10-19-kivo-creator-design.md`).

**Architecture:** A source is ingested into neutral, schema-validated section specs under `.creator/<run>/` in the target project. A deterministic compatibility filter plus the session model's judgment (written rubric, explicit `none`) produce a match plan that stops for approval. An adapter per target (`acorn-mu-plugin`, `sage-theme`, `radicle`) exposes the block catalog, serialises the page as block markup and scaffolds missing blocks in the target's conventions. `verify.mjs` screenshots the rendered page with the target project's own Playwright, diffs it against the reference with a dependency-free PNG decoder, checks the `exact` styles and lints for arbitrary values. Skills orchestrate; scripts do everything that can be tested.

**Tech Stack:** Node.js 20+ ESM with zero runtime dependencies (`node:zlib`, `node:fs`, `node:test`), JSON Schema (draft 2020-12 subset) with an in-repo validator, Playwright loaded from the target project's `node_modules`, the official Figma MCP server tools, ACF Composer / Acorn / Blade conventions from kivo-wise, release-please, `claude plugin validate` and `claude plugin eval`.

---

## Read this first

### What already exists (do not rebuild)

- Root plugin `kivo-wise` (manifests in `.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/`; skills in `skills/`; detector `scripts/detect-roots-project.mjs`; tests in `test/*.test.mjs` run by `node --test`).
- `plugins/kivo-wise/` and `.agents/plugins/marketplace.json` are **generated** by `scripts/build-codex-plugin.mjs`. Never edit them by hand. `plugins/kivo-creator/` is the first **hand-authored** plugin under `plugins/`; Task 2 teaches the build script and `AGENTS.md` about that.
- `scripts/validate-skills.mjs --root <dir>` validates the skill contract (frontmatter allow-list, `name` equal to folder, description starting with `Use when` and written as plain YAML with no `: ` or ` #`, exactly six H2 sections `When to use`, `Inputs required`, `Procedure`, `Verification`, `Failure modes`, `Escalation`, a Symptom / Cause / Fix table, at most 500 lines, no `${CLAUDE_*}`, no `$ARGUMENTS`, no assistant product names, script references written as `scripts/<name>.mjs`, no links into another skill's folder) and the manifests in that root.
- kivo-wise injects session context with runner placeholders (`{{runner.wp}}`, `{{runner.acorn}}`, `{{runner.node}}`, `{{runner.cache}}`). kivo-creator skills use the same placeholders and depend on kivo-wise for stack knowledge.

### Rules for every task

- Public repository: no client or employer names, no local paths, no text copied from licensed documentation (Radicle, ACF Pro, WPML, Tailwind UI). Fixtures use `acme` names and `acme.test` URLs.
- English everywhere. Conventional Commits. **No AI attribution** in commits (no `Co-Authored-By` for an assistant, no "Generated with").
- No runtime dependencies in `plugins/kivo-creator`. Playwright is resolved from the **target** project.
- Never invent a value: every slot and token carries `provenance: exact | inferred`; a value that is not in the source is left out.
- No arbitrary Tailwind values (`bg-[#fff]`, `p-[12px]`), no inline styles, no BEM in generated markup. Unmatched design values become token proposals.
- Run tests from the repository root. `node --test` prints a summary ending in `fail 0` when everything passes.

### Layout produced by this plan

```
plugins/kivo-creator/
  .claude-plugin/plugin.json   .cursor-plugin/plugin.json   .codex-plugin/plugin.json
  LICENSE  README.md  (CHANGELOG.md is written by release-please)
  schemas/section-spec.schema.json
  scripts/
    png.mjs  ingest-html.mjs  validate-spec.mjs  match.mjs  emit.mjs  verify.mjs
    figma-sections.mjs  figma-ref.mjs  code-connect.mjs
    lib/  args.mjs schema.mjs spec.mjs run.mjs stack.mjs segment.mjs collect.mjs playwright.mjs
          lint.mjs tokens.mjs style-check.mjs fidelity.mjs fill.mjs block-markup.mjs match.mjs
          context.mjs figma.mjs code-connect.mjs
    adapters/  index.mjs acorn-mu-plugin.mjs sage-theme.mjs radicle.mjs
               shared/ acf-composer.mjs native-block.mjs blade-view.mjs names.mjs
  skills/  creator html-ingest figma-ingest section-matching block-scaffolding-from-design visual-fidelity code-connect
  evals/   <cases>/ (staged for `claude plugin eval` by scripts/build-creator-eval.mjs at the repo root)
test/creator/*.test.mjs        test/fixtures/creator/{html,projects,runs,figma,golden}/
scripts/build-creator-eval.mjs (repo root, dev only)
```

### Decisions taken while turning the design into code

1. **Section segmentation (HTML):** content root is `<main>` (or `role=main`); otherwise the body after unwrapping single wrappers. `header`, `footer`, `nav` (and `banner`, `contentinfo`, `navigation` roles) outside `<main>` become `chrome` specs, recorded but skipped by matching. Content sections are the visible children of the root after unwrapping single-child wrappers (up to 4 levels); siblings shorter than 80 px are merged into the previous section (or dropped when empty). Kind is rule-based (form, details or two `?` headings = faq, `h1` = hero, blockquote = testimonial, a repeated sibling group of 3+ items = logos / stats / steps / features, iframe or video = media, at most 3 actions with at most one heading and two paragraphs = cta, otherwise text). Kind and layout are `inferred`; DOM text and computed styles are `exact`. The heuristic runs on a serialisable DOM snapshot, so it is unit-tested without a browser.
2. **PNG:** decoder supports 8-bit, non-interlaced PNGs of colour types 0, 2, 3, 4, 6 with all five filters (what Chromium and Figma export); anything else fails loudly. Encoder writes RGBA with filter 0 (diff images, test fixtures). CRC32 is implemented in the module (no reliance on `zlib.crc32`, which Node 20.x lacks before 20.15). Diff counts a pixel as different when any channel differs by more than 16; pixels outside the overlap of two differently sized images count as different and the report says the sizes differ.
3. **Marketplace source form:** Claude Code and Cursor entries use the relative string `"./plugins/kivo-creator"` (documented for git-hosted marketplaces; `..` is rejected). Codex entries use `{ "source": "local", "path": "./plugins/kivo-creator" }`, the shape `.agents/plugins/marketplace.json` already uses. kivo-creator is always `plugins[1]` so release-please can bump `$.plugins[1].version`; `sync-codex-manifests.mjs --check` enforces the index.
4. **Dependency on kivo-wise:** `"dependencies": ["kivo-wise"]` (bare name resolves in the same marketplace). Because a declared dependency stops the plugin loading inside the `claude plugin eval` sandbox, evals never run on `plugins/kivo-creator` directly: `scripts/build-creator-eval.mjs` stages a copy in `.creator-eval/` without `dependencies`, with fixtures, and with an `.mcp.json` that declares the official Figma server as `figma` (eval mocks only stand in for servers the plugin declares; a server with no mock files is not started, which is exactly the "MCP missing" case). The shipped plugin declares no MCP server.
5. **Figma references:** the MCP `get_screenshot` result reaches the model, not the disk, so pixel references come from `scripts/figma-ref.mjs` (Figma REST images API with `FIGMA_TOKEN` from the environment). Without a token, verify reports "no reference" for Figma sections and still runs the style check and lint.
6. **Emit never writes into the project.** `emit.mjs` writes the page markup and the scaffolded files under `.creator/<run>/`; the scaffolding skill first runs the project's generator (`{{runner.acorn}} acf:block …`), then copies the reviewed files over the stubs. This keeps "generate first, then edit" from kivo-wise and makes emit golden-testable.
7. **Match plan contract:** `match.mjs` writes `match-plan.json` with candidates (blocks that passed the compatibility filter, ranked by field coverage) and a provisional decision only where it is deterministic (Code Connect, chrome, nothing fits). The session model fills the remaining decisions with the rubric in `section-matching`; `match.mjs --check` refuses unresolved, unknown, below-threshold (0.6, unless `approvedBy: "person"`) or filter-violating decisions.
8. **Field keys for ACF block markup** are `field_<group>_<path joined by _>`, following the ACF Builder namespacing that kivo-wise's provenance verified (group name plus field name). Task 25 includes a native-first check against a real project before trusting the golden file.

### Commands used throughout

```bash
node --test test/creator/                         # kivo-creator unit tests
node scripts/validate-skills.mjs --root plugins/kivo-creator
claude plugin validate plugins/kivo-creator --strict
claude plugin validate . --strict                 # root marketplace, includes the relative entry
node scripts/sync-codex-manifests.mjs --check
node scripts/build-codex-plugin.mjs --check
```

---

# Phase 1: Core

### Task 1: Plugin skeleton and manifests

**Files:**
- Create: `plugins/kivo-creator/.claude-plugin/plugin.json`
- Create: `plugins/kivo-creator/.cursor-plugin/plugin.json`
- Create: `plugins/kivo-creator/.codex-plugin/plugin.json`
- Create: `plugins/kivo-creator/LICENSE` (copy of the root `LICENSE`)
- Create: `plugins/kivo-creator/README.md` (stub, completed in Task 33)
- Create: `test/creator/helpers.mjs`
- Test: `test/creator/manifests.test.mjs`
- Modify: `.gitignore`

**Step 1: Write the shared test helpers**

```js
// test/creator/helpers.mjs
import { mkdtempSync, cpSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PLUGIN = join(ROOT, 'plugins', 'kivo-creator');
export const FIX = join(ROOT, 'test', 'fixtures', 'creator');

export const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

export function tmpCopy(src) {
  const dir = mkdtempSync(join(tmpdir(), 'creator-'));
  cpSync(src, dir, { recursive: true });
  return dir;
}

let seq = 0;
/** Snapshot node as produced by scripts/lib/collect.mjs. */
export function n(tag, rect, children = [], extra = {}) {
  seq += 1;
  return {
    tag,
    path: `${tag}:nth-of-type(${seq})`,
    cls: [],
    visible: true,
    text: '',
    attrs: {},
    style: {},
    ...extra,
    rect,
    children,
  };
}
export const r = (y, h, x = 0, w = 1440) => ({ x, y, w, h });
```

**Step 2: Write the failing manifest test**

```js
// test/creator/manifests.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { PLUGIN, readJson } from './helpers.mjs';

const manifest = (dir) => readJson(join(PLUGIN, dir, 'plugin.json'));

test('the three kivo-creator manifests share name and version', () => {
  const claude = manifest('.claude-plugin');
  for (const dir of ['.cursor-plugin', '.codex-plugin']) {
    const m = manifest(dir);
    assert.equal(m.name, 'kivo-creator', dir);
    assert.equal(m.version, claude.version, dir);
    assert.ok(m.description, `${dir} has a description`);
  }
  assert.equal(claude.name, 'kivo-creator');
});

test('kivo-creator depends on kivo-wise from the same marketplace', () => {
  assert.deepEqual(manifest('.claude-plugin').dependencies, ['kivo-wise']);
});

test('the Codex manifest points at the skills folder', () => {
  const m = manifest('.codex-plugin');
  assert.equal(m.skills, './skills/');
  assert.equal(m.interface.displayName, 'Kivo Creator');
});
```

**Step 3: Run it to see it fail**

Run: `node --test test/creator/manifests.test.mjs`
Expected: FAIL with `ENOENT: no such file or directory, open '.../plugins/kivo-creator/.claude-plugin/plugin.json'`

**Step 4: Create the manifests**

`plugins/kivo-creator/.claude-plugin/plugin.json`:

```json
{
  "name": "kivo-creator",
  "description": "Figma and HTML to WordPress on the Roots stack: ingest a design into neutral section specs, match each section to an existing block, scaffold only the gaps and prove fidelity with a pixel diff",
  "version": "0.1.0",
  "author": {
    "name": "hekivo",
    "url": "https://github.com/hekivo"
  },
  "homepage": "https://github.com/hekivo/kivo-wise/tree/main/plugins/kivo-creator",
  "repository": "https://github.com/hekivo/kivo-wise",
  "license": "MIT",
  "keywords": [
    "wordpress",
    "roots",
    "acorn",
    "sage",
    "radicle",
    "acf",
    "blocks",
    "figma",
    "code-connect",
    "design-to-code",
    "visual-regression"
  ],
  "dependencies": [
    "kivo-wise"
  ]
}
```

`plugins/kivo-creator/.cursor-plugin/plugin.json`:

```json
{
  "name": "kivo-creator",
  "description": "Figma and HTML to WordPress on the Roots stack: ingest a design into neutral section specs, match each section to an existing block, scaffold only the gaps and prove fidelity with a pixel diff",
  "version": "0.1.0",
  "author": {
    "name": "hekivo",
    "url": "https://github.com/hekivo"
  }
}
```

`plugins/kivo-creator/.codex-plugin/plugin.json`:

```json
{
  "name": "kivo-creator",
  "version": "0.1.0",
  "description": "Figma and HTML to WordPress on the Roots stack: ingest a design into neutral section specs, match each section to an existing block, scaffold only the gaps and prove fidelity with a pixel diff",
  "author": {
    "name": "hekivo",
    "url": "https://github.com/hekivo"
  },
  "homepage": "https://github.com/hekivo/kivo-wise/tree/main/plugins/kivo-creator",
  "repository": "https://github.com/hekivo/kivo-wise",
  "license": "MIT",
  "skills": "./skills/",
  "interface": {
    "displayName": "Kivo Creator",
    "shortDescription": "Figma and HTML to WordPress blocks on the Roots stack, reusing existing blocks first.",
    "longDescription": "Ingests a Figma frame or an HTML page into neutral section specs, matches each section to a block the project already has, scaffolds only what is missing in the project's conventions and verifies the rendered page with a pixel diff, a style check and a lint for arbitrary values. Requires the kivo-wise plugin for stack detection.",
    "developerName": "hekivo",
    "category": "Development",
    "websiteURL": "https://github.com/hekivo/kivo-wise/tree/main/plugins/kivo-creator"
  }
}
```

Copy the license and write the README stub:

```bash
mkdir -p plugins/kivo-creator/skills
cp LICENSE plugins/kivo-creator/LICENSE
printf '# kivo-creator\n\nFigma and HTML to WordPress on the Roots stack. Documentation lands with the first release.\n' > plugins/kivo-creator/README.md
```

Append to the root `.gitignore`:

```
.creator/
.creator-eval/
```

**Step 5: Run the test and the validators**

Run: `node --test test/creator/manifests.test.mjs`
Expected: PASS (`pass 3`, `fail 0`)

Run: `claude plugin validate plugins/kivo-creator --strict`
Expected: last line `✔ Validation passed`. If the validator warns that the `kivo-wise` dependency cannot be resolved outside a marketplace, run it without `--strict`, note the warning text in the commit body, and rely on the marketplace validation in Task 2 (which resolves bare dependency names against the same marketplace).

**Step 6: Commit**

```bash
git add plugins/kivo-creator test/creator .gitignore
git commit -m "feat(kivo-creator): add the plugin skeleton and manifests"
```

---

### Task 2: Marketplace entries, Codex build and version sync

**Files:**
- Modify: `.claude-plugin/marketplace.json`, `.cursor-plugin/marketplace.json`, `.codex-plugin/marketplace.json`
- Modify: `scripts/build-codex-plugin.mjs` (marketplace builder)
- Regenerate: `.agents/plugins/marketplace.json`, `plugins/kivo-wise/AGENTS.md`
- Modify: `scripts/sync-codex-manifests.mjs`
- Modify: `AGENTS.md` (Environment section)
- Test: `test/creator/manifests.test.mjs`

**Step 1: Add the failing marketplace assertions**

Append to `test/creator/manifests.test.mjs`:

```js
import { ROOT } from './helpers.mjs';

const RELATIVE = './plugins/kivo-creator';
const MARKETPLACES = [
  ['.claude-plugin/marketplace.json', RELATIVE],
  ['.cursor-plugin/marketplace.json', RELATIVE],
  ['.codex-plugin/marketplace.json', { source: 'local', path: RELATIVE }],
  ['.agents/plugins/marketplace.json', { source: 'local', path: RELATIVE }],
];

test('every marketplace lists kivo-creator second, with the plugin version and a relative source', () => {
  const version = manifest('.claude-plugin').version;
  for (const [file, source] of MARKETPLACES) {
    const entry = readJson(join(ROOT, file)).plugins[1];
    assert.equal(entry?.name, 'kivo-creator', `${file} plugins[1]`);
    assert.equal(entry.version, version, `${file} version`);
    assert.deepEqual(entry.source, source, `${file} source`);
  }
});

test('kivo-wise stays the first entry of every marketplace', () => {
  for (const [file] of MARKETPLACES) assert.equal(readJson(join(ROOT, file)).plugins[0].name, 'kivo-wise', file);
});
```

**Step 2: Run it to see it fail**

Run: `node --test test/creator/manifests.test.mjs`
Expected: FAIL in `every marketplace lists kivo-creator second` with `.claude-plugin/marketplace.json plugins[1]` (actual `undefined`).

**Step 3: Add the entries**

In `.claude-plugin/marketplace.json`, append to `plugins` and update the marketplace description:

```json
    {
      "name": "kivo-creator",
      "description": "Figma and HTML to WordPress on the Roots stack: reuse existing blocks first, scaffold only the gaps, prove fidelity with a pixel diff",
      "version": "0.1.0",
      "source": "./plugins/kivo-creator",
      "author": {
        "name": "hekivo",
        "url": "https://github.com/hekivo"
      }
    }
```

and set `"metadata": { "description": "Marketplace for kivo-wise (Roots stack skills) and kivo-creator (design to blocks)." }`.

In `.cursor-plugin/marketplace.json` append the same entry (same `source` string). In `.codex-plugin/marketplace.json` append the same entry with `"source": { "source": "local", "path": "./plugins/kivo-creator" }`.

**Step 4: Teach the Codex build about hand-authored plugins**

In `scripts/build-codex-plugin.mjs`, after `const MIRROR = ['skills', 'hooks'];` add:

```js
// Hand-authored plugins that already live under plugins/<name>/ with real content.
// They are listed in the Codex marketplace but never generated, copied or deleted here.
const HAND_AUTHORED = ['kivo-creator'];
```

and in `buildArtifacts()`, right after the `marketplace` object literal (before `out[relative(ROOT, MARKETPLACE)] = …`), add:

```js
  for (const name of HAND_AUTHORED) {
    const m = readJson(resolve(ROOT, 'plugins', name, '.codex-plugin', 'plugin.json'));
    marketplace.plugins.push({
      name,
      version: m.version,
      source: { source: 'local', path: `./plugins/${name}` },
      policy: { installation: 'AVAILABLE' },
      category: m.interface?.category ?? 'Development',
    });
  }
```

`writeAll()` only removes `plugins/kivo-wise/` and `.agents/plugins/`, and `check()` only walks `plugins/kivo-wise/`, so the hand-authored folder is never touched.

**Step 5: Document the exception in `AGENTS.md`**

In the Environment bullet that describes the Codex layout, after the sentence ending "`--check`)." add:

```markdown
  `plugins/kivo-creator/` is the exception: a second, **hand-authored**
  plugin (edit it directly). Its three manifests and its entry in every
  marketplace (always `plugins[1]`) share one version, checked by
  `scripts/sync-codex-manifests.mjs` and bumped by release-please as the
  `kivo-creator` package.
```

Then regenerate: `node scripts/build-codex-plugin.mjs`
Expected: `Codex plugin gerado: <N> arquivos em plugins/kivo-wise/ + .agents/plugins/marketplace.json`

**Step 6: Extend the version sync check**

In `scripts/sync-codex-manifests.mjs` add `join` to the `node:path` import, then add above `function main()`:

```js
const CREATOR_DIR = resolve(ROOT, 'plugins', 'kivo-creator');
const CREATOR_MANIFESTS = ['.cursor-plugin', '.codex-plugin'].map((d) => join(CREATOR_DIR, d, 'plugin.json'));
const MARKETPLACES = [
  resolve(ROOT, '.claude-plugin', 'marketplace.json'),
  resolve(ROOT, '.cursor-plugin', 'marketplace.json'),
  resolve(ROOT, '.codex-plugin', 'marketplace.json'),
];

function syncCreator(isCheck, drift) {
  const version = readJson(join(CREATOR_DIR, '.claude-plugin', 'plugin.json')).version;
  for (const file of CREATOR_MANIFESTS) {
    const data = readJson(file);
    if (data.version === version) continue;
    if (isCheck) drift.push(`kivo-creator: ${file} version ${data.version} != ${version}`);
    else { data.version = version; writeJson(file, data); console.log(`Updated ${file} version to ${version}`); }
  }
  for (const file of MARKETPLACES) {
    const data = readJson(file);
    const entry = data.plugins?.[1];
    if (entry?.name !== 'kivo-creator') { drift.push(`${file}: plugins[1] must be kivo-creator (release-please bumps $.plugins[1].version)`); continue; }
    if (entry.version === version) continue;
    if (isCheck) drift.push(`${file}: kivo-creator version ${entry.version} != ${version}`);
    else { entry.version = version; writeJson(file, data); console.log(`Updated ${file} kivo-creator version to ${version}`); }
  }
}
```

In `main()`, call `syncCreator(isCheck, drift);` right after the `for (const target of TARGETS) { … }` loop. The index error is pushed in both modes, so in fix mode also add after the call: `if (!isCheck && drift.length) { for (const d of drift) console.error(d); process.exit(1); }`.

**Step 7: Run everything**

Run: `node --test test/creator/manifests.test.mjs`
Expected: PASS (`pass 5`, `fail 0`)

Run: `node scripts/sync-codex-manifests.mjs --check && node scripts/build-codex-plugin.mjs --check`
Expected: `Codex and Cursor manifests are in sync with Claude` then `Codex plugin gerado está em sync com a fonte.`

Run: `claude plugin validate . --strict`
Expected: `✔ Validation passed` (the validator reads the relative entry's `plugin.json`).

Run: `node --test test/*.test.mjs`
Expected: `fail 0` (existing suites untouched).

**Step 8: Commit**

```bash
git add .claude-plugin/marketplace.json .cursor-plugin/marketplace.json .codex-plugin/marketplace.json \
  .agents/plugins/marketplace.json plugins/kivo-wise/AGENTS.md scripts/build-codex-plugin.mjs \
  scripts/sync-codex-manifests.mjs AGENTS.md test/creator/manifests.test.mjs
git commit -m "feat(kivo-creator): list the plugin in every marketplace and keep its version in sync"
```

---

### Task 3: release-please package

**Files:**
- Modify: `.release-please-config.json`
- Test: `test/creator/manifests.test.mjs`

**Step 1: Add the failing release-please test**

Append to `test/creator/manifests.test.mjs`:

```js
import { existsSync } from 'node:fs';

/** Resolves the two jsonpath shapes used in our config: $.a.b and $.a[1].b */
function jsonpath(data, path) {
  return path.replace(/^\$\.?/, '').split('.').reduce((acc, part) => {
    const m = part.match(/^([^[\]]+)(?:\[(\d+)\])?$/);
    const value = acc?.[m[1]];
    return m[2] === undefined ? value : value?.[Number(m[2])];
  }, data);
}

test('release-please releases kivo-creator as its own package with a kivo-creator-vX.Y.Z tag', () => {
  const config = readJson(join(ROOT, '.release-please-config.json'));
  const pkg = config.packages['plugins/kivo-creator'];
  assert.ok(pkg, 'package plugins/kivo-creator');
  assert.equal(pkg['package-name'], 'kivo-creator');
  assert.equal(pkg.component, 'kivo-creator');
  assert.equal(pkg['include-component-in-tag'], true);
  assert.equal(pkg['initial-version'], '0.1.0');
  assert.deepEqual(config.packages['.']['exclude-paths'], ['plugins/kivo-creator']);
  const version = manifest('.claude-plugin').version;
  for (const file of pkg['extra-files']) {
    const abs = file.path.startsWith('/') ? join(ROOT, file.path) : join(ROOT, 'plugins/kivo-creator', file.path);
    assert.ok(existsSync(abs), `${file.path} exists`);
    assert.equal(jsonpath(readJson(abs), file.jsonpath), version, `${file.path} ${file.jsonpath}`);
  }
  assert.equal(pkg['extra-files'].length, 7);
});
```

**Step 2: Run it to see it fail**

Run: `node --test test/creator/manifests.test.mjs`
Expected: FAIL with `package plugins/kivo-creator` (actual `undefined`).

**Step 3: Add the package**

In `.release-please-config.json`, add `"exclude-paths": ["plugins/kivo-creator"]` to the `"."` package (so kivo-creator commits do not land in the kivo-wise changelog), and add this second package (paths without a leading `/` are relative to the package folder; a leading `/` is the repository root):

```json
    "plugins/kivo-creator": {
      "release-type": "simple",
      "package-name": "kivo-creator",
      "component": "kivo-creator",
      "include-component-in-tag": true,
      "include-v-in-tag": true,
      "initial-version": "0.1.0",
      "bump-minor-pre-major": true,
      "extra-files": [
        { "type": "json", "path": ".claude-plugin/plugin.json", "jsonpath": "$.version" },
        { "type": "json", "path": ".cursor-plugin/plugin.json", "jsonpath": "$.version" },
        { "type": "json", "path": ".codex-plugin/plugin.json", "jsonpath": "$.version" },
        { "type": "json", "path": "/.claude-plugin/marketplace.json", "jsonpath": "$.plugins[1].version" },
        { "type": "json", "path": "/.cursor-plugin/marketplace.json", "jsonpath": "$.plugins[1].version" },
        { "type": "json", "path": "/.codex-plugin/marketplace.json", "jsonpath": "$.plugins[1].version" },
        { "type": "json", "path": "/.agents/plugins/marketplace.json", "jsonpath": "$.plugins[1].version" }
      ],
      "changelog-sections": [
        { "type": "feat", "section": "Features" },
        { "type": "fix", "section": "Bug Fixes" },
        { "type": "perf", "section": "Performance" },
        { "type": "docs", "section": "Documentation" },
        { "type": "chore", "section": "Chores", "hidden": true }
      ]
    }
```

Do **not** add the package to `.release-please-manifest.json`: a package missing from the manifest is released for the first time at `initial-version` (0.1.0), creating `plugins/kivo-creator/CHANGELOG.md` and the tag `kivo-creator-v0.1.0`.

**Step 4: Run the test**

Run: `node --test test/creator/manifests.test.mjs`
Expected: PASS (`pass 6`, `fail 0`)

**Step 5: Commit**

```bash
git add .release-please-config.json test/creator/manifests.test.mjs
git commit -m "chore(release): release kivo-creator as its own release-please package"
```

---

### Task 4: CI runs the kivo-creator checks

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Extend the jobs**

In the `validate` job, after `Validate the plugin manifest (strict)` add:

```yaml
      - name: Validate the kivo-creator manifest (strict)
        if: steps.cli.outcome == 'success'
        run: claude plugin validate plugins/kivo-creator --strict
```

(If Task 1 Step 5 showed a dependency warning, drop `--strict` here and keep the comment `# dependency on kivo-wise resolves only through the marketplace`.)

In the `test` job, replace the `Run node:test suites (detector, hooks)` script with:

```yaml
        run: node --test test/*.test.mjs test/creator/*.test.mjs
```

**Step 2: Run the same commands locally**

Run: `node --test test/*.test.mjs test/creator/*.test.mjs`
Expected: `fail 0`

**Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run the kivo-creator tests and manifest validation"
```

The skill validation step for `plugins/kivo-creator` is added in Task 29, together with the first skill.

---

### Task 5: Section spec schema and a dependency-free validator

**Files:**
- Create: `plugins/kivo-creator/schemas/section-spec.schema.json`
- Create: `plugins/kivo-creator/scripts/lib/schema.mjs`
- Modify: `test/creator/helpers.mjs`
- Test: `test/creator/schema.test.mjs`

**Step 1: Add a valid spec factory to the test helpers, then write the failing test**

Append to `test/creator/helpers.mjs`:

```js
export const validSpec = () => ({
  id: '01-hero',
  order: 0,
  source: { kind: 'html', ref: 'body > main > section:nth-of-type(1)' },
  kind: 'hero',
  slots: [
    { name: 'heading', type: 'heading', value: 'Acme ships faster', provenance: 'exact' },
    { name: 'items', type: 'list', provenance: 'exact', items: [[{ name: 'text', type: 'text', value: 'One', provenance: 'exact' }]] },
  ],
  layout: { columns: 1, align: 'left', media: 'right', repeat: 0 },
  tokens: [{ role: 'heading', prop: 'color', value: 'rgb(17, 24, 39)', token: '--color-ink', provenance: 'exact' }],
  refs: { 1440: 'refs/01-hero-1440.png' },
});
```

Then create the test:

```js
// test/creator/schema.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { validate } from '../../plugins/kivo-creator/scripts/lib/schema.mjs';
import { PLUGIN, readJson, validSpec } from './helpers.mjs';

const schema = readJson(join(PLUGIN, 'schemas', 'section-spec.schema.json'));

test('a complete spec is valid', () => {
  assert.deepEqual(validate(schema, validSpec()), []);
});

test('missing required fields and unknown keys are reported with their path', () => {
  const spec = validSpec();
  delete spec.layout;
  spec.extra = true;
  assert.deepEqual(validate(schema, spec), ['$.layout: missing', '$.extra: not allowed']);
});

test('enums, patterns and nested $ref are enforced', () => {
  const spec = validSpec();
  spec.kind = 'banner';
  spec.slots[1].items[0][0].provenance = 'guessed';
  spec.tokens[0].token = 'color-ink';
  assert.deepEqual(validate(schema, spec), [
    '$.kind: "banner" not in [hero, features, cta, faq, testimonial, logos, form, media, text, stats, steps, custom]',
    '$.slots[1].items[0][0].provenance: "guessed" not in [exact, inferred]',
    '$.tokens[0].token: does not match ^--[a-z0-9-]+$',
  ]);
});

test('types and minimums are enforced', () => {
  const spec = validSpec();
  spec.layout.columns = 0;
  spec.order = 'first';
  assert.deepEqual(validate(schema, spec), ['$.order: expected integer, got string', '$.layout.columns: below minimum 1']);
});
```

**Step 2: Run it to see it fail**

Run: `node --test test/creator/schema.test.mjs`
Expected: FAIL with `Cannot find module '.../plugins/kivo-creator/scripts/lib/schema.mjs'`

**Step 3: Write the schema**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/hekivo/kivo-wise/blob/main/plugins/kivo-creator/schemas/section-spec.schema.json",
  "title": "kivo-creator section spec",
  "description": "One design section, independent of the source (Figma or HTML) and of the target. Every slot value and token carries its provenance; values that are not in the source are left out.",
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "source", "kind", "slots", "layout", "tokens", "refs"],
  "properties": {
    "id": { "type": "string", "pattern": "^[a-z0-9][a-z0-9-]*$" },
    "order": { "type": "integer", "minimum": 0 },
    "source": {
      "type": "object",
      "additionalProperties": false,
      "required": ["kind", "ref"],
      "properties": {
        "kind": { "enum": ["figma", "html"] },
        "ref": { "type": "string", "minLength": 1 },
        "url": { "type": "string" },
        "component": { "type": "string" }
      }
    },
    "kind": { "enum": ["hero", "features", "cta", "faq", "testimonial", "logos", "form", "media", "text", "stats", "steps", "custom"] },
    "chrome": { "type": "boolean" },
    "slots": { "type": "array", "items": { "$ref": "#/$defs/slot" } },
    "layout": {
      "type": "object",
      "additionalProperties": false,
      "required": ["columns", "align", "media", "repeat"],
      "properties": {
        "columns": { "type": "integer", "minimum": 1 },
        "align": { "enum": ["left", "center", "right"] },
        "media": { "enum": ["none", "left", "right", "top", "bottom", "background"] },
        "repeat": { "type": "integer", "minimum": 0 }
      }
    },
    "tokens": { "type": "array", "items": { "$ref": "#/$defs/token" } },
    "refs": { "type": "object", "additionalProperties": { "type": "string", "minLength": 1 } },
    "codeConnect": {
      "type": "object",
      "additionalProperties": false,
      "required": ["block"],
      "properties": { "block": { "type": "string" }, "component": { "type": "string" } }
    },
    "notes": { "type": "array", "items": { "type": "string" } }
  },
  "$defs": {
    "provenance": { "enum": ["exact", "inferred"] },
    "slot": {
      "type": "object",
      "additionalProperties": false,
      "required": ["name", "type", "provenance"],
      "properties": {
        "name": { "type": "string", "pattern": "^[a-z][a-z0-9_]*$" },
        "type": { "enum": ["heading", "text", "richtext", "image", "link", "list", "form", "embed"] },
        "value": {},
        "items": { "type": "array", "items": { "type": "array", "items": { "$ref": "#/$defs/slot" } } },
        "provenance": { "$ref": "#/$defs/provenance" }
      }
    },
    "token": {
      "type": "object",
      "additionalProperties": false,
      "required": ["role", "prop", "value", "provenance"],
      "properties": {
        "role": { "enum": ["section", "heading", "text", "link", "button", "media"] },
        "prop": { "type": "string", "pattern": "^[a-z][a-zA-Z]*$" },
        "value": { "type": "string", "minLength": 1 },
        "token": { "type": "string", "pattern": "^--[a-z0-9-]+$" },
        "provenance": { "$ref": "#/$defs/provenance" },
        "node": { "type": "string" }
      }
    }
  }
}
```

**Step 4: Write the validator**

```js
// plugins/kivo-creator/scripts/lib/schema.mjs
/**
 * Minimal JSON Schema checker for the schemas this plugin ships: type, enum,
 * const, required, properties, additionalProperties (false or schema), items,
 * minItems, minLength, pattern, minimum, maximum and $ref into #/$defs.
 * Returns a list of "<path>: <problem>" strings; empty means valid.
 */
export function validate(schema, value, root = schema, path = '$', errors = []) {
  if (schema.$ref) {
    const def = root.$defs?.[schema.$ref.replace(/^#\/\$defs\//, '')];
    if (!def) errors.push(`${path}: unknown $ref ${schema.$ref}`);
    else validate(def, value, root, path, errors);
    return errors;
  }
  if ('const' in schema && value !== schema.const) errors.push(`${path}: expected ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: ${JSON.stringify(value)} not in [${schema.enum.join(', ')}]`);
    return errors;
  }
  if (schema.type) {
    const actual = typeOf(value);
    const types = [].concat(schema.type);
    if (!types.some((t) => t === actual || (t === 'number' && actual === 'integer'))) {
      errors.push(`${path}: expected ${types.join('|')}, got ${actual}`);
      return errors;
    }
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: shorter than ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) errors.push(`${path}: does not match ${schema.pattern}`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: below minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: above maximum ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: fewer than ${schema.minItems} items`);
    if (schema.items) value.forEach((item, i) => validate(schema.items, item, root, `${path}[${i}]`, errors));
  } else if (value && typeof value === 'object') {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${path}.${key}: missing`);
    for (const [key, child] of Object.entries(value)) {
      const sub = schema.properties?.[key];
      if (sub) validate(sub, child, root, `${path}.${key}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${path}.${key}: not allowed`);
      else if (typeof schema.additionalProperties === 'object') validate(schema.additionalProperties, child, root, `${path}.${key}`, errors);
    }
  }
  return errors;
}

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}
```

**Step 5: Run the test**

Run: `node --test test/creator/schema.test.mjs`
Expected: PASS (`pass 4`, `fail 0`)

**Step 6: Commit**

```bash
git add plugins/kivo-creator/schemas plugins/kivo-creator/scripts/lib/schema.mjs test/creator/schema.test.mjs test/creator/helpers.mjs
git commit -m "feat(kivo-creator): add the section spec schema and validator"
```

---

### Task 6: Spec checks, spec reader and the validate-spec CLI

**Files:**
- Create: `plugins/kivo-creator/scripts/lib/args.mjs`
- Create: `plugins/kivo-creator/scripts/lib/spec.mjs`
- Create: `plugins/kivo-creator/scripts/validate-spec.mjs`
- Test: `test/creator/spec.test.mjs`

**Step 1: Write the failing test**

```js
// test/creator/spec.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkSpec, readSpecs } from '../../plugins/kivo-creator/scripts/lib/spec.mjs';
import { parseOptions } from '../../plugins/kivo-creator/scripts/lib/args.mjs';
import { PLUGIN, validSpec } from './helpers.mjs';

test('checkSpec adds semantic checks on top of the schema', () => {
  const spec = validSpec();
  spec.slots.push({ name: 'heading', type: 'image', value: { alt: 'x' }, provenance: 'exact' });
  spec.slots.push({ name: 'empty', type: 'list', provenance: 'exact', items: [] });
  spec.slots.push({ name: 'blank', type: 'text', value: '', provenance: 'inferred' });
  spec.refs.desktop = 'refs/x.png';
  assert.deepEqual(checkSpec(spec), [
    '$.slots[2]: duplicate slot name "heading"',
    '$.slots[2]: image slot "heading" needs value.src',
    '$.slots[3]: list slot "empty" needs at least one item',
    '$.slots[4]: slot "blank" has no value',
    '$.refs.desktop: key must be a width in px',
  ]);
});

test('checkSpec returns schema errors first and stops there', () => {
  const spec = validSpec();
  spec.kind = 'banner';
  assert.equal(checkSpec(spec).length, 1);
});

test('readSpecs sorts by order', () => {
  const dir = mkdtempSync(join(tmpdir(), 'specs-'));
  writeFileSync(join(dir, 'a.json'), JSON.stringify({ ...validSpec(), id: 'b', order: 1 }));
  writeFileSync(join(dir, 'b.json'), JSON.stringify({ ...validSpec(), id: 'a', order: 0 }));
  assert.deepEqual(readSpecs(dir).map((s) => s.id), ['a', 'b']);
  assert.deepEqual(readSpecs(join(dir, 'missing')), []);
});

test('parseOptions reads --key=value and declared flags, and rejects the rest', () => {
  assert.deepEqual(parseOptions(['--run=x', '--check'], { run: '', check: false }), { run: 'x', check: true });
  assert.throws(() => parseOptions(['--nope=1'], { run: '' }), /unknown option --nope/);
  assert.throws(() => parseOptions(['--run'], { run: '' }), /--run needs a value/);
  assert.throws(() => parseOptions(['loose'], { run: '' }), /unexpected argument "loose"/);
});

test('validate-spec CLI exits 1 and prints every error', () => {
  const dir = mkdtempSync(join(tmpdir(), 'specs-'));
  writeFileSync(join(dir, 'ok.json'), JSON.stringify(validSpec()));
  writeFileSync(join(dir, 'bad.json'), JSON.stringify({ ...validSpec(), kind: 'banner' }));
  const res = spawnSync(process.execPath, [join(PLUGIN, 'scripts', 'validate-spec.mjs'), dir], { encoding: 'utf8' });
  assert.equal(res.status, 1);
  assert.match(res.stdout, /ok .*ok\.json/);
  assert.match(res.stderr, /bad\.json: \$\.kind: "banner" not in/);
});
```

**Step 2: Run it to see it fail**

Run: `node --test test/creator/spec.test.mjs`
Expected: FAIL with `Cannot find module '.../scripts/lib/spec.mjs'`

**Step 3: Write `args.mjs`**

```js
// plugins/kivo-creator/scripts/lib/args.mjs
import { pathToFileURL } from 'node:url';

/**
 * Parses --key=value options. `defaults` lists every accepted key; keys named
 * in `flags` may appear bare (--check) and become true.
 */
export function parseOptions(argv, defaults, { flags = Object.keys(defaults).filter((k) => defaults[k] === false) } = {}) {
  const options = { ...defaults };
  for (const arg of argv) {
    if (!arg.startsWith('--')) throw new Error(`unexpected argument "${arg}"`);
    const eq = arg.indexOf('=');
    const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    if (!(key in defaults)) throw new Error(`unknown option --${key}`);
    if (eq === -1) {
      if (!flags.includes(key)) throw new Error(`--${key} needs a value (--${key}=...)`);
      options[key] = true;
    } else {
      options[key] = arg.slice(eq + 1);
    }
  }
  return options;
}

/**
 * Runs main() when the module is executed directly, printing errors without a
 * stack. A main() may set process.exitCode before throwing to pick the code.
 */
export function runCli(importMetaUrl, main) {
  if (process.argv[1] && importMetaUrl === pathToFileURL(process.argv[1]).href) {
    Promise.resolve()
      .then(() => main(process.argv.slice(2)))
      .catch((error) => {
        console.error(error.message);
        process.exit(process.exitCode || 1);
      });
  }
}
```

**Step 4: Write `spec.mjs`**

```js
// plugins/kivo-creator/scripts/lib/spec.mjs
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './schema.mjs';

const SCHEMA_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'schemas', 'section-spec.schema.json');
let schema;
export const specSchema = () => (schema ??= JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')));

/** Schema errors, or (when the shape is valid) semantic errors. Empty = valid. */
export function checkSpec(spec) {
  const errors = validate(specSchema(), spec);
  if (errors.length) return errors;
  const seen = new Set();
  spec.slots.forEach((slot, i) => {
    if (seen.has(slot.name)) errors.push(`$.slots[${i}]: duplicate slot name "${slot.name}"`);
    seen.add(slot.name);
  });
  checkSlots(spec.slots, '$.slots', errors);
  for (const key of Object.keys(spec.refs)) if (!/^\d+$/.test(key)) errors.push(`$.refs.${key}: key must be a width in px`);
  return errors;
}

function checkSlots(slots, path, errors) {
  slots.forEach((slot, i) => {
    const at = `${path}[${i}]`;
    if (slot.type === 'list') {
      if (!Array.isArray(slot.items) || slot.items.length === 0) errors.push(`${at}: list slot "${slot.name}" needs at least one item`);
      else slot.items.forEach((item, j) => checkSlots(item, `${at}.items[${j}]`, errors));
      return;
    }
    if (slot.value === undefined || slot.value === null || slot.value === '') {
      errors.push(`${at}: slot "${slot.name}" has no value`);
      return;
    }
    if (slot.type === 'image' && !slot.value?.src) errors.push(`${at}: image slot "${slot.name}" needs value.src`);
    if (slot.type === 'link' && typeof slot.value?.href !== 'string') errors.push(`${at}: link slot "${slot.name}" needs value.href`);
  });
}

export function readSpecs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
```

**Step 5: Write the CLI**

```js
#!/usr/bin/env node
// plugins/kivo-creator/scripts/validate-spec.mjs
/**
 * validate-spec.mjs: check section specs against schemas/section-spec.schema.json.
 * Usage: node scripts/validate-spec.mjs <spec.json | specs-dir>...
 * Exit 0 when every spec is valid, 1 otherwise.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { checkSpec } from './lib/spec.mjs';
import { runCli } from './lib/args.mjs';

export function main(argv) {
  if (!argv.length) throw new Error('usage: validate-spec.mjs <spec.json | specs-dir>...');
  const files = argv.flatMap((p) => (statSync(p).isDirectory() ? readdirSync(p).filter((f) => f.endsWith('.json')).sort().map((f) => join(p, f)) : [p]));
  let failed = 0;
  for (const file of files) {
    let errors;
    try {
      errors = checkSpec(JSON.parse(readFileSync(file, 'utf8')));
    } catch (error) {
      errors = [`invalid JSON: ${error.message}`];
    }
    if (errors.length === 0) console.log(`ok ${file}`);
    else {
      failed++;
      for (const e of errors) console.error(`${file}: ${e}`);
    }
  }
  if (failed) process.exitCode = 1;
}

runCli(import.meta.url, main);
```

**Step 6: Run the test**

Run: `node --test test/creator/spec.test.mjs`
Expected: PASS (`pass 5`, `fail 0`)

**Step 7: Commit**

```bash
git add plugins/kivo-creator/scripts test/creator/spec.test.mjs
git commit -m "feat(kivo-creator): add spec checks, option parsing and the validate-spec CLI"
```

---

### Task 7: Run folders under `.creator/`

**Files:**
- Create: `plugins/kivo-creator/scripts/lib/run.mjs`
- Test: `test/creator/run.test.mjs`

**Step 1: Write the failing test**

```js
// test/creator/run.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRun, runId, runPaths, slugify } from '../../plugins/kivo-creator/scripts/lib/run.mjs';

test('runId is a UTC timestamp plus a slug', () => {
  assert.equal(runId(new Date(Date.UTC(2026, 9, 19, 8, 5, 3)), 'Acme Landing!'), '20261019-080503-acme-landing');
  assert.equal(slugify('  Café / Ünïcode  '), 'cafe-unicode');
});

test('createRun makes the folders and a self-ignoring .creator/.gitignore', () => {
  const project = mkdtempSync(join(tmpdir(), 'proj-'));
  const run = createRun(project, 'landing', new Date(Date.UTC(2026, 0, 2, 3, 4, 5)));
  assert.equal(run.id, '20260102-030405-landing');
  for (const sub of ['specs', 'refs', 'verify']) assert.ok(existsSync(join(run.dir, sub)), sub);
  assert.equal(readFileSync(join(project, '.creator', '.gitignore'), 'utf8'), '*\n');
  assert.equal(runPaths(run.dir).plan, join(run.dir, 'match-plan.json'));
});
```

**Step 2: Run it to see it fail**

Run: `node --test test/creator/run.test.mjs`
Expected: FAIL with `Cannot find module '.../scripts/lib/run.mjs'`

**Step 3: Implement**

```js
// plugins/kivo-creator/scripts/lib/run.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export function slugify(text) {
  return String(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function runId(date = new Date(), label = 'page') {
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}-${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}`;
  return `${stamp}-${slugify(label) || 'page'}`;
}

/** Creates .creator/<run>/ with specs/, refs/ and verify/. .creator/ ignores itself in git. */
export function createRun(projectDir, label, date = new Date()) {
  const base = join(resolve(projectDir), '.creator');
  mkdirSync(base, { recursive: true });
  const ignore = join(base, '.gitignore');
  if (!existsSync(ignore)) writeFileSync(ignore, '*\n');
  const id = runId(date, label);
  const dir = join(base, id);
  for (const sub of ['specs', 'refs', 'verify']) mkdirSync(join(dir, sub), { recursive: true });
  return { id, dir };
}

export function runPaths(dir) {
  return {
    specs: join(dir, 'specs'),
    refs: join(dir, 'refs'),
    verify: join(dir, 'verify'),
    scaffold: join(dir, 'scaffold'),
    plan: join(dir, 'match-plan.json'),
    planMd: join(dir, 'match-plan.md'),
    page: join(dir, 'page.html'),
    emitted: join(dir, 'emitted.json'),
    fidelity: join(dir, 'fidelity.md'),
    fidelityJson: join(dir, 'fidelity.json'),
    figmaSections: join(dir, 'figma-sections.json'),
    codeConnect: join(dir, 'code-connect.json'),
  };
}

export function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
```

**Step 4: Run the test**

Run: `node --test test/creator/run.test.mjs`
Expected: PASS (`pass 2`, `fail 0`)

**Step 5: Commit**

```bash
git add plugins/kivo-creator/scripts/lib/run.mjs test/creator/run.test.mjs
git commit -m "feat(kivo-creator): create run folders under .creator"
```

---

### Task 8: Stack resolution from kivo-wise (`.roots-stack.json` wins)

**Files:**
- Create: `plugins/kivo-creator/scripts/lib/stack.mjs`
- Create: `test/fixtures/creator/projects/acme-mu-plugin/.roots-stack.json`
- Create: `test/fixtures/creator/projects/acme-mu-plugin/wp-content/mu-plugins/acme-core/composer.json`
- Test: `test/creator/stack.test.mjs`

**Step 1: Create the fixture files**

`test/fixtures/creator/projects/acme-mu-plugin/.roots-stack.json`:

```json
{ "profile": "acorn-mu-plugin", "app": "wp-content/mu-plugins/acme-core", "runner": "lando" }
```

`test/fixtures/creator/projects/acme-mu-plugin/wp-content/mu-plugins/acme-core/composer.json`:

```json
{
  "name": "acme/acme-core",
  "type": "wordpress-muplugin",
  "autoload": { "psr-4": { "AcmeCore\\": "app/" } },
  "require": { "roots/acorn": "^6.2", "log1x/acf-composer": "^3.4" }
}
```

**Step 2: Write the failing test**

```js
// test/creator/stack.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveStack } from '../../plugins/kivo-creator/scripts/lib/stack.mjs';
import { FIX, tmpCopy } from './helpers.mjs';

const MU = join(FIX, 'projects', 'acme-mu-plugin');

test('.roots-stack.json gives profile and app; the namespace comes from the app composer.json', () => {
  const s = resolveStack(MU);
  assert.equal(s.profile, 'acorn-mu-plugin');
  assert.equal(s.appPath, join(MU, 'wp-content', 'mu-plugins', 'acme-core'));
  assert.equal(s.namespace, 'AcmeCore\\');
  assert.equal(s.runner, 'lando');
});

test('without the flag, the kivo-wise detector output is used (kind mapped to profile)', () => {
  const dir = tmpCopy(MU);
  rmSync(join(dir, '.roots-stack.json'));
  const detection = { apps: [{ kind: 'acorn-plugin', path: 'wp-content/mu-plugins/acme-core', namespace: 'AcmeCore\\', blocks: 'acf-composer' }], active: 0, runtime: { runner: 'lando' } };
  const s = resolveStack(dir, { detection });
  assert.equal(s.profile, 'acorn-mu-plugin');
  assert.equal(s.blocks, 'acf-composer');
});

test('the flag wins over the detector', () => {
  const detection = { apps: [{ kind: 'sage-theme', path: 'web/app/themes/x' }], active: 0 };
  assert.equal(resolveStack(MU, { detection }).profile, 'acorn-mu-plugin');
});

test('no flag and no detector output is an error that says how to fix it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nostack-'));
  mkdirSync(join(dir, 'x'));
  assert.throws(() => resolveStack(dir), /roots-detect --write/);
});
```

**Step 3: Run it to see it fail**

Run: `node --test test/creator/stack.test.mjs`
Expected: FAIL with `Cannot find module '.../scripts/lib/stack.mjs'`

**Step 4: Implement**

```js
// plugins/kivo-creator/scripts/lib/stack.mjs
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const PROFILES = ['acorn-mu-plugin', 'sage-theme', 'radicle-app'];
// Same mapping as kivo-wise /roots-detect --write.
const KIND_TO_PROFILE = {
  'sage-theme': 'sage-theme',
  'acorn-theme': 'sage-theme',
  'acorn-mu-plugin': 'acorn-mu-plugin',
  'acorn-plugin': 'acorn-mu-plugin',
  'radicle-app': 'radicle-app',
};

const readJsonIfExists = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);

/**
 * Target stack for an adapter. `.roots-stack.json` (written by kivo-wise
 * /roots-detect --write) wins; otherwise `detection` is the JSON printed by
 * kivo-wise's scripts/detect-roots-project.mjs.
 */
export function resolveStack(projectDir, { detection = null } = {}) {
  const root = resolve(projectDir);
  const flag = readJsonIfExists(join(root, '.roots-stack.json'));
  const app = detection?.apps?.[detection.active ?? 0] ?? null;
  const profile = flag?.profile ?? (app ? KIND_TO_PROFILE[app.kind] : undefined);
  const appRel = flag?.app ?? app?.path;
  if (!profile || appRel === undefined) {
    throw new Error('No Roots profile found. Run kivo-wise /roots-detect --write to create .roots-stack.json, or pass the detector JSON with --stack=<file>.');
  }
  if (!PROFILES.includes(profile)) throw new Error(`Unknown profile "${profile}" (expected ${PROFILES.join(', ')})`);
  const appPath = resolve(root, appRel);
  return {
    projectDir: root,
    profile,
    appPath,
    namespace: readNamespace(appPath) ?? app?.namespace ?? 'App\\',
    blocks: app?.blocks ?? (existsSync(join(appPath, 'app', 'Blocks')) ? 'acf-composer' : 'native'),
    runner: flag?.runner ?? detection?.runtime?.runner ?? 'none',
  };
}

function readNamespace(appPath) {
  const psr4 = readJsonIfExists(join(appPath, 'composer.json'))?.autoload?.['psr-4'] ?? {};
  const hit = Object.entries(psr4).find(([, dir]) => [].concat(dir).some((d) => d.replace(/\/$/, '') === 'app'));
  return hit?.[0] ?? null;
}
```

**Step 5: Run the test**

Run: `node --test test/creator/stack.test.mjs`
Expected: PASS (`pass 4`, `fail 0`)

**Step 6: Commit**

```bash
git add plugins/kivo-creator/scripts/lib/stack.mjs test/creator/stack.test.mjs test/fixtures/creator/projects/acme-mu-plugin
git commit -m "feat(kivo-creator): resolve the target stack from kivo-wise"
```

---

### Task 9: Segment a DOM snapshot into sections

The browser part (Task 12) serialises the rendered page into plain nodes: `{ tag, path, role?, cls[], rect {x,y,w,h}, visible, text (own text only), attrs, style, children[] }`. Everything below works on that shape and runs without a browser.

**Files:**
- Create: `plugins/kivo-creator/scripts/lib/segment.mjs`
- Create: `test/creator/snapshots.mjs` (snapshot builders shared by Tasks 9 to 11)
- Test: `test/creator/segment.test.mjs`

**Step 1: Write the snapshot builders**

```js
// test/creator/snapshots.mjs
import { n, r } from './helpers.mjs';

const HEADING = { color: 'rgb(17, 24, 39)', fontFamily: 'Inter, sans-serif', fontSize: '56px', fontWeight: '700', lineHeight: '64px', textAlign: 'left' };

export function hero() {
  return n('section', r(80, 600), [
    n('h1', r(160, 60, 120, 600), [], { text: 'Acme ships faster', style: HEADING }),
    n('p', r(240, 48, 120, 600), [], { text: 'Plan, build and launch in one place.', style: { color: 'rgb(75, 85, 99)', fontSize: '18px', lineHeight: 'normal' } }),
    n('a', r(310, 48, 120, 160), [], { text: 'Start free', cls: ['btn'], attrs: { href: 'https://acme.test/signup' }, style: { backgroundColor: 'rgb(10, 132, 255)', color: 'rgb(255, 255, 255)' } }),
    n('img', r(140, 420, 800, 520), [], { attrs: { src: 'https://acme.test/hero.png', alt: 'Acme dashboard' } }),
  ], { style: { backgroundColor: 'rgba(0, 0, 0, 0)', paddingTop: '80px', paddingBottom: '80px' } });
}

export function features() {
  const card = (i) => n('div', r(860, 200, 120 + i * 420, 380), [
    n('h3', r(880, 30, 120 + i * 420, 380), [], { text: `Feature ${i + 1}` }),
    n('p', r(920, 60, 120 + i * 420, 380), [], { text: `Feature ${i + 1} explained.` }),
  ], { cls: ['card'] });
  return n('section', r(680, 420), [
    n('h2', r(720, 48, 120, 800), [], { text: 'Why Acme', style: { textAlign: 'center' } }),
    n('div', r(860, 200, 120, 1200), [card(0), card(1), card(2)], { cls: ['grid'] }),
  ]);
}

export function faq() {
  const q = (i) => n('details', r(1180 + i * 60, 50, 120, 1200), [
    n('summary', r(1180 + i * 60, 50, 120, 1200), [], { text: `Question ${i + 1}?` }),
    n('p', r(0, 0, 0, 0), [], { text: `Answer ${i + 1}.`, visible: false }),
  ]);
  return n('section', r(1100, 300), [n('h2', r(1120, 48, 120, 800), [], { text: 'Questions' }), q(0), q(1), q(2)]);
}

export function cta() {
  return n('section', r(1400, 240), [
    n('h2', r(1440, 48, 120, 800), [], { text: 'Ready to ship?' }),
    n('p', r(1500, 30, 120, 800), [], { text: 'Start in five minutes.' }),
    n('a', r(1550, 48, 120, 160), [], { text: 'Start free', cls: ['btn'], attrs: { href: 'https://acme.test/signup' } }),
  ]);
}

export function stats() {
  const item = (i, v) => n('li', r(1700, 120, 120 + i * 300, 280), [n('strong', r(1700, 60, 120 + i * 300, 280), [], { text: v }), n('span', r(1760, 30, 120 + i * 300, 280), [], { text: `Label ${i + 1}` })], { cls: ['stat'] });
  return n('section', r(1660, 220), [n('h2', r(1670, 40, 120, 800), [], { text: 'Acme in numbers' }), n('ul', r(1700, 120, 120, 1200), [item(0, '120k'), item(1, '99.9%'), item(2, '40+'), item(3, '7')])]);
}

export function landing({ wrap = false } = {}) {
  const header = n('header', r(0, 80), [n('nav', r(0, 80), [n('a', r(20, 40, 20, 80), [], { text: 'Acme', attrs: { href: '/' } })])]);
  const main = n('main', r(80, 1560), [hero(), features(), faq(), cta()]);
  const footer = n('footer', r(1640, 120), [n('p', r(1660, 20), [], { text: '© Acme' })]);
  const kids = [header, main, footer];
  return n('body', r(0, 1760), wrap ? [n('div', r(0, 1760), kids, { attrs: { id: 'app' } })] : kids);
}
```

**Step 2: Write the failing test**

```js
// test/creator/segment.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segment, textOf, MIN_SECTION_HEIGHT } from '../../plugins/kivo-creator/scripts/lib/segment.mjs';
import { n, r } from './helpers.mjs';
import { landing, hero, cta } from './snapshots.mjs';

const tags = (sections) => sections.map((s) => `${s.chrome ? 'chrome:' : ''}${s.node.tag}`);

test('main content becomes sections; header and footer become chrome, in page order', () => {
  assert.deepEqual(tags(segment(landing())), ['chrome:header', 'section', 'section', 'section', 'section', 'chrome:footer']);
});

test('single wrappers around header, main and footer are unwrapped', () => {
  assert.deepEqual(tags(segment(landing({ wrap: true }))), ['chrome:header', 'section', 'section', 'section', 'section', 'chrome:footer']);
});

test('without <main>, the body children that are not chrome are the sections', () => {
  const body = n('body', r(0, 900), [n('header', r(0, 80)), hero(), cta()]);
  assert.deepEqual(tags(segment(body)), ['chrome:header', 'section', 'section']);
});

test('short siblings merge into the previous section; empty ones are dropped', () => {
  const note = n('div', r(680, 40), [], { text: 'Trusted by 4,000 teams' });
  const spacer = n('div', r(720, 20));
  const main = n('main', r(80, 900), [hero(), note, spacer, cta()]);
  const sections = segment(n('body', r(0, 1000), [main]));
  assert.equal(sections.length, 2);
  assert.match(textOf(sections[0].node), /Trusted by 4,000 teams$/);
  assert.deepEqual(sections[0].node.merged, [note.path]);
  assert.ok(MIN_SECTION_HEIGHT === 80);
});

test('invisible nodes are not sections', () => {
  const hidden = { ...cta(), visible: false };
  const main = n('main', r(80, 900), [hero(), hidden]);
  assert.equal(segment(n('body', r(0, 1000), [main])).length, 1);
});
```

**Step 3: Run it to see it fail**

Run: `node --test test/creator/segment.test.mjs`
Expected: FAIL with `Cannot find module '.../scripts/lib/segment.mjs'`

**Step 4: Implement segmentation and the tree helpers**

```js
// plugins/kivo-creator/scripts/lib/segment.mjs
/**
 * Section segmentation on a serialised DOM snapshot (see collect.mjs).
 * Heuristic, documented in the plan and in the html-ingest skill:
 *  - content root = <main> (or role=main), else the body after unwrapping
 *    single-child wrappers;
 *  - header/footer/nav (banner/contentinfo/navigation) outside <main> = chrome;
 *  - sections = visible children of the root after unwrapping (max 4 levels);
 *  - siblings shorter than MIN_SECTION_HEIGHT merge into the previous one.
 */
export const MIN_SECTION_HEIGHT = 80;
const CHROME_TAGS = new Set(['header', 'footer', 'nav']);
const CHROME_ROLES = new Set(['banner', 'contentinfo', 'navigation']);
export const HEADING = /^h[1-6]$/;

export function walk(node, fn) {
  fn(node);
  for (const child of node.children ?? []) walk(child, fn);
}

export function find(node, pred) {
  if (pred(node)) return node;
  for (const child of node.children ?? []) {
    const hit = find(child, pred);
    if (hit) return hit;
  }
  return null;
}

export function findAll(node, pred, out = []) {
  if (pred(node)) out.push(node);
  for (const child of node.children ?? []) findAll(child, pred, out);
  return out;
}

export function textOf(node) {
  const parts = [];
  walk(node, (n) => { if (n.text) parts.push(n.text); });
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

const isVisible = (n) => n.visible !== false && n.rect && n.rect.w > 0 && n.rect.h > 0;
const visibleKids = (n) => (n.children ?? []).filter(isVisible);
const isChrome = (n) => CHROME_TAGS.has(n.tag) || CHROME_ROLES.has(n.role);
const isMain = (n) => n.tag === 'main' || n.role === 'main';
const hasMedia = (n) => !!find(n, (x) => x.tag === 'img' || x.tag === 'video' || x.tag === 'iframe');

export function segment(snapshot) {
  const body = find(snapshot, (n) => n.tag === 'body') ?? snapshot;
  const chrome = [];
  let level = body;
  for (let depth = 0; depth < 5; depth++) {
    const kids = visibleKids(level);
    chrome.push(...kids.filter(isChrome));
    const rest = kids.filter((k) => !isChrome(k));
    const main = rest.find(isMain);
    if (main) { level = main; break; }
    if (rest.length === 1 && visibleKids(rest[0]).length >= 2) { level = rest[0]; continue; }
    break;
  }
  if (!isMain(level)) {
    const main = find(body, isMain);
    if (main && isVisible(main)) level = main;
  }
  let root = level;
  for (let depth = 0; depth < 4; depth++) {
    const kids = visibleKids(root);
    if (kids.length === 1 && visibleKids(kids[0]).length >= 2) root = kids[0];
    else break;
  }
  const inMain = isMain(level);
  const content = mergeSmall(visibleKids(root).filter((k) => inMain || !isChrome(k)));
  return [
    ...chrome.map((node) => ({ node, chrome: true })),
    ...content.map((node) => ({ node, chrome: false })),
  ].sort((a, b) => a.node.rect.y - b.node.rect.y);
}

function mergeSmall(nodes) {
  const out = [];
  for (const node of nodes) {
    const empty = !textOf(node) && !hasMedia(node);
    if (node.rect.h >= MIN_SECTION_HEIGHT) { out.push(node); continue; }
    if (empty) continue;
    if (!out.length) { out.push(node); continue; }
    const prev = out.pop();
    out.push({
      ...prev,
      text: '',
      rect: union(prev.rect, node.rect),
      children: prev.merged ? [...prev.children, node] : [prev, node],
      merged: [...(prev.merged ?? []), node.path],
    });
  }
  return out;
}

function union(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}
```

**Step 5: Run the test**

Run: `node --test test/creator/segment.test.mjs`
Expected: PASS (`pass 5`, `fail 0`)

**Step 6: Commit**

```bash
git add plugins/kivo-creator/scripts/lib/segment.mjs test/creator/snapshots.mjs test/creator/segment.test.mjs
git commit -m "feat(kivo-creator): segment a DOM snapshot into page sections"
```

---

### Task 10: Classify a section's kind

**Files:**
- Modify: `plugins/kivo-creator/scripts/lib/segment.mjs` (append)
- Test: `test/creator/classify.test.mjs`

**Step 1: Write the failing test**

```js
// test/creator/classify.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, repeatedGroup } from '../../plugins/kivo-creator/scripts/lib/segment.mjs';
import { n, r } from './helpers.mjs';
import { hero, features, faq, cta, stats } from './snapshots.mjs';

test('the landing sections get the expected kinds', () => {
  assert.equal(classify(hero()), 'hero');
  assert.equal(classify(features()), 'features');
  assert.equal(classify(faq()), 'faq');
  assert.equal(classify(cta()), 'cta');
  assert.equal(classify(stats()), 'stats');
});

test('forms, quotes, logos, steps, media and text', () => {
  assert.equal(classify(n('section', r(0, 300), [n('h2', r(0, 40), [], { text: 'Contact' }), n('form', r(50, 200), [n('input', r(50, 40), [], { attrs: { name: 'email' } })])])), 'form');
  assert.equal(classify(n('section', r(0, 300), [n('blockquote', r(0, 100), [], { text: 'Acme changed how we ship.' })])), 'testimonial');
  const logo = (i) => n('img', r(0, 40, i * 200, 120), [], { attrs: { src: `https://acme.test/l${i}.svg`, alt: '' } });
  assert.equal(classify(n('section', r(0, 120), [logo(0), logo(1), logo(2), logo(3)])), 'logos');
  const step = (i) => n('li', r(100, 80, i * 300, 280), [n('h3', r(100, 30, i * 300, 280), [], { text: `Sign up ${i}` })]);
  assert.equal(classify(n('section', r(0, 300), [n('h2', r(0, 40), [], { text: 'How it works' }), n('ol', r(100, 80), [step(1), step(2), step(3)])])), 'steps');
  assert.equal(classify(n('section', r(0, 500), [n('iframe', r(0, 500), [], { attrs: { src: 'https://video.acme.test/1' } })])), 'media');
  assert.equal(classify(n('section', r(0, 500), [n('h2', r(0, 40), [], { text: 'About' }), n('p', r(50, 40), [], { text: 'One.' }), n('p', r(90, 40), [], { text: 'Two.' }), n('p', r(130, 40), [], { text: 'Three.' })])), 'text');
});

test('repeatedGroup finds 3+ siblings with the same tag and classes', () => {
  const group = repeatedGroup(features());
  assert.equal(group.items.length, 3);
  assert.equal(group.container.cls[0], 'grid');
  assert.equal(repeatedGroup(cta()), null);
});
```

**Step 2: Run it to see it fail**

Run: `node --test test/creator/classify.test.mjs`
Expected: FAIL with `SyntaxError: The requested module ... does not provide an export named 'classify'`

**Step 3: Implement**

Append to `plugins/kivo-creator/scripts/lib/segment.mjs`:

```js
const signature = (n) => `${n.tag}.${[...(n.cls ?? [])].sort().join('.')}`;
const ITEM_TAGS = new Set(['li', 'details', 'figure', 'img', 'dt']);

/** First container (breadth-first) holding 3+ siblings that share tag and classes. */
export function repeatedGroup(node) {
  const queue = [node];
  while (queue.length) {
    const current = queue.shift();
    const kids = current.children ?? [];
    if (kids.length >= 3) {
      const counts = new Map();
      for (const k of kids) counts.set(signature(k), (counts.get(signature(k)) ?? 0) + 1);
      const [sig, count] = [...counts].sort((a, b) => b[1] - a[1])[0];
      if (count >= 3 && count / kids.length >= 0.6) {
        const items = kids.filter((k) => signature(k) === sig);
        if (items.every((i) => (i.children ?? []).length > 0) || ITEM_TAGS.has(items[0].tag)) return { container: current, items };
      }
    }
    queue.push(...kids);
  }
  return null;
}

const NUMERIC = /^[~<>]?\d[\d.,]*\s*(%|[kmb]|x)?\+?$/i;
const firstText = (node) => find(node, (n) => !!n.text)?.text.trim() ?? '';

export function classify(node) {
  const has = (pred) => !!find(node, pred);
  const headings = findAll(node, (n) => HEADING.test(n.tag));
  if (has((n) => n.tag === 'form')) return 'form';
  if (has((n) => n.tag === 'details') || headings.filter((h) => textOf(h).endsWith('?')).length >= 2) return 'faq';
  if (has((n) => n.tag === 'h1')) return 'hero';
  if (has((n) => n.tag === 'blockquote')) return 'testimonial';
  const group = repeatedGroup(node);
  if (group) {
    const { container, items } = group;
    const isLogo = (i) => (i.tag === 'img' || !!find(i, (n) => n.tag === 'img')) && !find(i, (n) => HEADING.test(n.tag)) && !textOf(i);
    if (items.every(isLogo)) return 'logos';
    if (items.map(firstText).filter((t) => NUMERIC.test(t)).length * 2 >= items.length) return 'stats';
    if (container.tag === 'ol') return 'steps';
    return 'features';
  }
  if (has((n) => n.tag === 'iframe' || n.tag === 'video')) return 'media';
  const actions = findAll(node, (n) => n.tag === 'button' || (n.tag === 'a' && !!textOf(n)));
  const paragraphs = findAll(node, (n) => n.tag === 'p');
  if (actions.length >= 1 && actions.length <= 3 && headings.length <= 1 && paragraphs.length <= 2) return 'cta';
  if (headings.length || paragraphs.length) return 'text';
  if (has((n) => n.tag === 'img')) return 'media';
  return 'custom';
}
```

**Step 4: Run the tests**

Run: `node --test test/creator/classify.test.mjs test/creator/segment.test.mjs`
Expected: PASS (`pass 8`, `fail 0`)

**Step 5: Commit**

```bash
git add plugins/kivo-creator/scripts/lib/segment.mjs test/creator/classify.test.mjs
git commit -m "feat(kivo-creator): classify section kinds with documented heuristics"
```

---

### Task 11: Slots, layout, tokens and the spec for one section

**Files:**
- Modify: `plugins/kivo-creator/scripts/lib/segment.mjs` (append)
- Test: `test/creator/extract.test.mjs`

**Step 1: Write the failing test**

```js
// test/creator/extract.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSlots, extractLayout, extractTokens, roleNode, toSpec } from '../../plugins/kivo-creator/scripts/lib/segment.mjs';
import { checkSpec } from '../../plugins/kivo-creator/scripts/lib/spec.mjs';
import { hero, features, faq, stats } from './snapshots.mjs';

test('hero slots carry exact DOM values', () => {
  assert.deepEqual(extractSlots(hero()), [
    { name: 'heading', type: 'heading', value: 'Acme ships faster', provenance: 'exact' },
    { name: 'text', type: 'text', value: 'Plan, build and launch in one place.', provenance: 'exact' },
    { name: 'link', type: 'link', value: { href: 'https://acme.test/signup', text: 'Start free' }, provenance: 'exact' },
    { name: 'image', type: 'image', value: { src: 'https://acme.test/hero.png', alt: 'Acme dashboard' }, provenance: 'exact' },
  ]);
});

test('a repeated group becomes one list slot named items', () => {
  const slots = extractSlots(features());
  assert.deepEqual(slots.map((s) => s.name), ['heading', 'items']);
  assert.equal(slots[1].items.length, 3);
  assert.deepEqual(slots[1].items[0].map((s) => `${s.name}:${s.value}`), ['heading:Feature 1', 'text:Feature 1 explained.']);
});

test('details/summary items keep hidden answers', () => {
  const items = extractSlots(faq())[1].items;
  assert.deepEqual(items[2].map((s) => s.value), ['Question 3?', 'Answer 3.']);
});

test('layout: columns from the first row, alignment from the heading, media position', () => {
  assert.deepEqual(extractLayout(hero()), { columns: 1, align: 'left', media: 'right', repeat: 0 });
  assert.deepEqual(extractLayout(features()), { columns: 3, align: 'center', media: 'none', repeat: 3 });
  assert.deepEqual(extractLayout(stats()), { columns: 4, align: 'left', media: 'none', repeat: 4 });
});

test('tokens are computed styles per role, skipping empty values', () => {
  const tokens = extractTokens(hero());
  assert.deepEqual(tokens.map((t) => `${t.role}.${t.prop}=${t.value}`), [
    'section.paddingTop=80px',
    'section.paddingBottom=80px',
    'heading.color=rgb(17, 24, 39)',
    'heading.fontFamily=Inter, sans-serif',
    'heading.fontSize=56px',
    'heading.fontWeight=700',
    'heading.lineHeight=64px',
    'text.color=rgb(75, 85, 99)',
    'text.fontSize=18px',
    'button.backgroundColor=rgb(10, 132, 255)',
    'button.color=rgb(255, 255, 255)',
  ]);
  assert.ok(tokens.every((t) => t.provenance === 'exact' && t.node));
  assert.equal(roleNode(hero(), 'link'), null);
});

test('toSpec builds a valid spec; chrome sections are flagged', () => {
  const spec = toSpec({ node: hero(), chrome: false }, { index: 0, sourceRef: 'file:///acme/landing.html' });
  assert.equal(spec.id, '01-hero');
  assert.equal(spec.source.kind, 'html');
  assert.deepEqual(checkSpec(spec), []);
  const chrome = toSpec({ node: { ...hero(), tag: 'header' }, chrome: true }, { index: 5, sourceRef: 'x' });
  assert.equal(chrome.id, '06-header');
  assert.equal(chrome.chrome, true);
});
```

**Step 2: Run it to see it fail**

Run: `node --test test/creator/extract.test.mjs`
Expected: FAIL with `does not provide an export named 'extractSlots'`

**Step 3: Implement**

Append to `plugins/kivo-creator/scripts/lib/segment.mjs`:

```js
const TEXT_TAGS = new Set(['p', 'dd', 'blockquote', 'figcaption', 'cite']);
const LOOSE_TEXT_TAGS = new Set(['span', 'div', 'strong', 'em', 'small', 'label', 'li']);

/** Slots in document order; a repeated group becomes a trailing list slot "items". */
export function extractSlots(node) {
  const group = repeatedGroup(node);
  // Skip the items, not the container: the container can be the section itself (faq).
  const slots = collectSlots(node, new Set(group ? group.items : []));
  if (group) slots.push({ name: 'items', type: 'list', provenance: 'exact', items: group.items.map((item) => collectSlots(item, new Set())) });
  return slots;
}

function collectSlots(root, skip) {
  const out = [];
  const counters = {};
  const add = (type, value) => {
    counters[type] = (counters[type] ?? 0) + 1;
    out.push({ name: counters[type] === 1 ? type : `${type}_${counters[type]}`, type, value, provenance: 'exact' });
  };
  const visit = (n) => {
    if (skip.has(n)) return;
    const t = n.tag;
    if (HEADING.test(t) || t === 'summary' || t === 'dt') { const v = textOf(n); if (v) add('heading', v); return; }
    if (TEXT_TAGS.has(t)) { const v = textOf(n); if (v) add('text', v); return; }
    if (t === 'img') { if (n.attrs?.src) add('image', { src: n.attrs.src, alt: n.attrs.alt ?? '' }); return; }
    if ((t === 'a' || t === 'button') && textOf(n)) { add('link', { href: n.attrs?.href ?? '', text: textOf(n) }); return; }
    if (t === 'form') {
      const fields = findAll(n, (x) => ['input', 'select', 'textarea'].includes(x.tag)).map((x) => x.attrs?.name).filter(Boolean);
      add('form', { action: n.attrs?.action ?? '', fields });
      return;
    }
    if (t === 'iframe' || t === 'video') { add('embed', { src: n.attrs?.src ?? '' }); return; }
    if (LOOSE_TEXT_TAGS.has(t) && n.text && !(n.children ?? []).length) { add('text', n.text); return; }
    for (const child of n.children ?? []) visit(child);
  };
  visit(root);
  return out;
}

export function extractLayout(node) {
  const group = repeatedGroup(node);
  const heading = find(node, (n) => HEADING.test(n.tag));
  const textAlign = heading?.style?.textAlign ?? 'left';
  return {
    columns: group ? Math.max(1, group.items.filter((i) => Math.abs(i.rect.y - group.items[0].rect.y) <= 4).length) : 1,
    align: textAlign === 'center' ? 'center' : textAlign === 'right' || textAlign === 'end' ? 'right' : 'left',
    media: mediaPosition(node, heading, group),
    repeat: group ? group.items.length : 0,
  };
}

function mediaPosition(node, heading, group) {
  if (node.style?.backgroundImage && node.style.backgroundImage !== 'none') return 'background';
  const inGroup = new Set();
  if (group) for (const item of group.items) walk(item, (n) => inGroup.add(n));
  const media = findAll(node, (n) => ['img', 'video', 'iframe'].includes(n.tag) && !inGroup.has(n) && n.rect?.w > 0);
  if (!media.length) return 'none';
  const biggest = media.sort((a, b) => b.rect.w * b.rect.h - a.rect.w * a.rect.h)[0];
  if (biggest.rect.w * biggest.rect.h >= 0.8 * node.rect.w * node.rect.h) return 'background';
  if (!heading) return 'top';
  const mediaCenter = biggest.rect.x + biggest.rect.w / 2;
  const headingCenter = heading.rect.x + heading.rect.w / 2;
  if (mediaCenter > headingCenter + 40) return 'right';
  if (mediaCenter < headingCenter - 40) return 'left';
  return biggest.rect.y < heading.rect.y ? 'top' : 'bottom';
}

const isButton = (n) => n.tag === 'button' || (n.tag === 'a' && (n.cls ?? []).some((c) => /btn|button/i.test(c)));

/** The element that represents a token role inside a section (shared with verify). */
export function roleNode(node, role) {
  switch (role) {
    case 'section': return node;
    case 'heading': return find(node, (n) => HEADING.test(n.tag));
    case 'text': return find(node, (n) => n.tag === 'p');
    case 'link': return find(node, (n) => n.tag === 'a' && !isButton(n));
    case 'button': return find(node, isButton);
    case 'media': return find(node, (n) => n.tag === 'img' || n.tag === 'video');
    default: return null;
  }
}

const ROLE_PROPS = {
  section: ['backgroundColor', 'paddingTop', 'paddingBottom'],
  heading: ['color', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight'],
  text: ['color', 'fontFamily', 'fontSize', 'lineHeight'],
  link: ['color'],
  button: ['backgroundColor', 'color'],
};
const EMPTY_VALUES = new Set(['', 'none', 'normal', 'auto', 'transparent', 'rgba(0, 0, 0, 0)']);

export function extractTokens(node) {
  const out = [];
  for (const [role, props] of Object.entries(ROLE_PROPS)) {
    const target = roleNode(node, role);
    if (!target) continue;
    for (const prop of props) {
      const value = target.style?.[prop];
      if (value === undefined || EMPTY_VALUES.has(String(value).trim())) continue;
      out.push({ role, prop, value: String(value), provenance: 'exact', node: target.path });
    }
  }
  return out;
}

export function toSpec({ node, chrome }, { index, sourceRef }) {
  const kind = chrome ? 'custom' : classify(node);
  const spec = {
    id: `${String(index + 1).padStart(2, '0')}-${chrome ? node.tag : kind}`,
    order: index,
    source: { kind: 'html', ref: node.path, url: sourceRef },
    kind,
    slots: extractSlots(node),
    layout: extractLayout(node),
    tokens: extractTokens(node),
    refs: {},
    notes: ['kind and layout are inferred by heuristics; slot values and tokens are exact (DOM text and computed styles)'],
  };
  if (chrome) spec.chrome = true;
  if (node.merged) spec.notes.push(`merged short siblings: ${node.merged.join(', ')}`);
  return spec;
}
```

Note for the reviewer: in the hero snapshot the paragraph's `lineHeight` is `normal`, so it is skipped; the transparent section background is skipped too. Those two lines are why the token list in the test has no `section.backgroundColor` and no `text.lineHeight`.

**Step 4: Run the tests**

Run: `node --test test/creator/extract.test.mjs test/creator/classify.test.mjs test/creator/segment.test.mjs`
Expected: PASS (`pass 14`, `fail 0`)

**Step 5: Commit**

```bash
git add plugins/kivo-creator/scripts/lib/segment.mjs test/creator/extract.test.mjs
git commit -m "feat(kivo-creator): extract slots, layout and tokens into a section spec"
```

---

### Task 12: Browser collector and the target project's Playwright

**Files:**
- Create: `plugins/kivo-creator/scripts/lib/collect.mjs`
- Create: `plugins/kivo-creator/scripts/lib/playwright.mjs`
- Test: `test/creator/playwright.test.mjs`

**Step 1: Write the failing test**

```js
// test/creator/playwright.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPlaywright, NO_PLAYWRIGHT } from '../../plugins/kivo-creator/scripts/lib/playwright.mjs';
import { collectSnapshot } from '../../plugins/kivo-creator/scripts/lib/collect.mjs';

test('returns null when the project has no Playwright, and the message says how to install it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nopw-'));
  writeFileSync(join(dir, 'package.json'), '{}');
  assert.equal(await loadPlaywright(dir), null);
  assert.match(NO_PLAYWRIGHT, /playwright install chromium/);
});

test('loads playwright from the project node_modules, not from this plugin', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fakepw-'));
  const pkg = join(dir, 'node_modules', 'playwright');
  mkdirSync(pkg, { recursive: true });
  writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: 'playwright', main: 'index.js' }));
  writeFileSync(join(pkg, 'index.js'), 'exports.chromium = { fake: true };');
  writeFileSync(join(dir, 'package.json'), '{}');
  const pw = await loadPlaywright(dir);
  assert.equal(pw.name, 'playwright');
  assert.deepEqual(pw.chromium, { fake: true });
});

test('the collector is self-contained so Playwright can serialise it', () => {
  const source = collectSnapshot.toString();
  assert.doesNotMatch(source, /\bimport\b|\brequire\(/);
  assert.match(source, /getComputedStyle/);
});
```

**Step 2: Run it to see it fail**

Run: `node --test test/creator/playwright.test.mjs`
Expected: FAIL with `Cannot find module '.../scripts/lib/playwright.mjs'`

**Step 3: Implement the loader**

```js
// plugins/kivo-creator/scripts/lib/playwright.mjs
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const NO_PLAYWRIGHT = [
  'Playwright was not found in the target project.',
  'kivo-creator ships no dependencies; it drives the project\'s own Playwright.',
  'Install it in the project (dev dependency), for example:',
  '  npm i -D playwright && npx playwright install chromium',
  'then run the command again from the project root.',
].join('\n');

/** Resolves playwright (or @playwright/test, playwright-core) from <projectDir>/node_modules. */
export async function loadPlaywright(projectDir) {
  const require = createRequire(join(resolve(projectDir), 'package.json'));
  for (const name of ['playwright', '@playwright/test', 'playwright-core']) {
    let entry;
    try {
      entry = require.resolve(name);
    } catch {
      continue;
    }
    const mod = await import(pathToFileURL(entry).href);
    const chromium = mod.chromium ?? mod.default?.chromium;
    if (chromium) return { name, chromium };
  }
  return null;
}
```

**Step 4: Implement the collector**

```js
// plugins/kivo-creator/scripts/lib/collect.mjs
/**
 * Runs INSIDE the page (page.evaluate). Must stay self-contained: no imports,
 * no closures over module scope. Returns the snapshot shape used by segment.mjs.
 */
export function collectSnapshot({ selector = null, index = 0, maxDepth = 12 } = {}) {
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'LINK', 'META']);
  const PROPS = ['color', 'backgroundColor', 'backgroundImage', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'textAlign', 'paddingTop', 'paddingBottom', 'display'];
  const ATTRS = ['href', 'src', 'alt', 'type', 'name', 'action', 'id', 'placeholder', 'data-block'];
  const cssPath = (el) => {
    const parts = [];
    while (el && el.nodeType === 1 && el.tagName !== 'HTML') {
      const tag = el.tagName.toLowerCase();
      if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) { parts.unshift(`${tag}#${el.id}`); break; }
      let i = 1;
      let sib = el;
      while ((sib = sib.previousElementSibling)) if (sib.tagName === el.tagName) i++;
      parts.unshift(`${tag}:nth-of-type(${i})`);
      el = el.parentElement;
    }
    return parts.join(' > ');
  };
  const visit = (el, depth) => {
    const cs = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    const style = {};
    for (const p of PROPS) style[p] = cs[p];
    const attrs = {};
    for (const a of ATTRS) {
      const raw = el.getAttribute(a);
      if (raw === null) continue;
      attrs[a] = (a === 'href' || a === 'src') && typeof el[a] === 'string' && el[a] ? el[a] : raw;
    }
    const text = Array.from(el.childNodes).filter((c) => c.nodeType === 3).map((c) => c.textContent).join(' ').replace(/\s+/g, ' ').trim().slice(0, 500);
    const node = {
      tag: el.tagName.toLowerCase(),
      path: cssPath(el),
      role: el.getAttribute('role') || undefined,
      cls: Array.from(el.classList).slice(0, 6),
      rect: { x: Math.round(box.left + scrollX), y: Math.round(box.top + scrollY), w: Math.round(box.width), h: Math.round(box.height) },
      visible: cs.display !== 'none' && cs.visibility !== 'hidden' && box.width > 0 && box.height > 0,
      text,
      attrs,
      style,
      children: [],
    };
    if (depth < maxDepth) for (const child of el.children) if (!SKIP.has(child.tagName)) node.children.push(visit(child, depth + 1));
    return node;
  };
  const root = selector ? document.querySelectorAll(selector)[index] : document.body;
  return root ? visit(root, 0) : null;
}
```

**Step 5: Run the test**

Run: `node --test test/creator/playwright.test.mjs`
Expected: PASS (`pass 3`, `fail 0`)

**Step 6: Commit**

```bash
git add plugins/kivo-creator/scripts/lib/collect.mjs plugins/kivo-creator/scripts/lib/playwright.mjs test/creator/playwright.test.mjs
git commit -m "feat(kivo-creator): load the target project's Playwright and collect DOM snapshots"
```

---

### Task 13: `ingest-html.mjs` and the fixture page

**Files:**
- Create: `plugins/kivo-creator/scripts/ingest-html.mjs`
- Create: `test/fixtures/creator/html/acme-landing.html`
- Test: `test/creator/ingest-html.test.mjs` (argument parsing always; browser run only when `CREATOR_PLAYWRIGHT_DIR` points at a folder with Playwright installed)

**Step 1: Write the fixture page**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Acme</title>
<style>
  body { margin: 0; font-family: Inter, sans-serif; color: #111827; }
  header, footer { display: flex; align-items: center; height: 80px; padding: 0 24px; background: #ffffff; }
  section { padding: 64px 120px; }
  h1 { font-size: 56px; line-height: 64px; font-weight: 700; margin: 0 0 16px; }
  h2 { font-size: 36px; font-weight: 700; margin: 0 0 24px; }
  p { color: #4b5563; font-size: 18px; }
  .btn { display: inline-block; padding: 12px 24px; background: #0a84ff; color: #ffffff; text-decoration: none; }
  .hero { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
  .hero img { width: 520px; height: 360px; background: #e5e7eb; }
  .features { text-align: center; background: #f5f7fa; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; }
  .card { background: #ffffff; padding: 24px; }
  details { border-bottom: 1px solid #e5e7eb; padding: 16px 0; }
</style>
</head>
<body>
  <header><nav><a href="/">Acme</a></nav></header>
  <main>
    <section class="hero">
      <div>
        <h1>Acme ships faster</h1>
        <p>Plan, build and launch in one place.</p>
        <a class="btn" href="https://acme.test/signup">Start free</a>
      </div>
      <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="Acme dashboard">
    </section>
    <section class="features">
      <h2>Why Acme</h2>
      <div class="grid">
        <div class="card"><h3>Plan</h3><p>Roadmaps everyone can read.</p></div>
        <div class="card"><h3>Build</h3><p>Reviews that do not block.</p></div>
        <div class="card"><h3>Launch</h3><p>Releases on a schedule.</p></div>
      </div>
    </section>
    <section class="faq">
      <h2>Questions</h2>
      <details><summary>Can I cancel any time?</summary><p>Yes, from your account settings.</p></details>
      <details><summary>Is there a free plan?</summary><p>Yes, for up to three people.</p></details>
      <details><summary>Where is my data stored?</summary><p>In the region you pick at sign-up.</p></details>
    </section>
    <section class="cta">
      <h2>Ready to ship?</h2>
      <p>Start in five minutes.</p>
      <a class="btn" href="https://acme.test/signup">Start free</a>
    </section>
  </main>
  <footer><p>Acme Inc.</p></footer>
</body>
</html>
```

**Step 2: Write the failing test**

```js
// test/creator/ingest-html.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseIngestArgs } from '../../plugins/kivo-creator/scripts/ingest-html.mjs';
import { FIX, PLUGIN } from './helpers.mjs';

test('options: source is required, widths are numbers', () => {
  assert.deepEqual(parseIngestArgs(['--source=page.html', '--widths=390,1440']).widths, [390, 1440]);
  assert.throws(() => parseIngestArgs([]), /--source/);
});

const PW_DIR = process.env.CREATOR_PLAYWRIGHT_DIR;

test('ingests the fixture page into chrome plus four content specs with references', { skip: !PW_DIR && 'set CREATOR_PLAYWRIGHT_DIR to a folder with Playwright installed' }, async () => {
  const { decodePng } = await import('../../plugins/kivo-creator/scripts/png.mjs'); // Task 14
  const out = join(mkdtempSync(join(tmpdir(), 'ingest-')), 'run');
  const res = spawnSync(process.execPath, [join(PLUGIN, 'scripts', 'ingest-html.mjs'), `--project=${PW_DIR}`, `--source=${join(FIX, 'html', 'acme-landing.html')}`, `--run=${out}`], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  const files = readdirSync(join(out, 'specs')).sort();
  assert.deepEqual(files, ['01-header.json', '02-hero.json', '03-features.json', '04-faq.json', '05-cta.json', '06-footer.json']);
  const hero = JSON.parse(readFileSync(join(out, 'specs', '02-hero.json'), 'utf8'));
  assert.equal(hero.slots[0].value, 'Acme ships faster');
  assert.equal(hero.layout.media, 'right');
  const png = decodePng(readFileSync(join(out, hero.refs['1440'])));
  assert.equal(png.width, 1440);
});
```

The browser test loads `scripts/png.mjs` (Task 14) lazily, so this file runs before Task 14 exists.

**Step 3: Run it to see it fail**

Run: `node --test test/creator/ingest-html.test.mjs`
Expected: FAIL with `Cannot find module '.../scripts/ingest-html.mjs'`

**Step 4: Implement the CLI**

```js
#!/usr/bin/env node
// plugins/kivo-creator/scripts/ingest-html.mjs
/**
 * ingest-html.mjs: render an HTML file or URL with the target project's
 * Playwright, split it into sections and write one spec per section plus a
 * reference screenshot per width into .creator/<run>/.
 *
 * Usage:
 *   node scripts/ingest-html.mjs --source=<file.html | https://...> [--project=.]
 *        [--run=.creator/<run>] [--widths=390,1440] [--label=<name>]
 * Exit: 0 ok, 1 error, 3 Playwright missing in the project.
 */
import { basename, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { parseOptions, runCli } from './lib/args.mjs';
import { loadPlaywright, NO_PLAYWRIGHT } from './lib/playwright.mjs';
import { collectSnapshot } from './lib/collect.mjs';
import { segment, toSpec } from './lib/segment.mjs';
import { checkSpec } from './lib/spec.mjs';
import { createRun, runPaths, writeJson } from './lib/run.mjs';

export function parseIngestArgs(argv) {
  const o = parseOptions(argv, { source: '', project: '.', run: '', widths: '390,1440', label: '' });
  if (!o.source) throw new Error('usage: ingest-html.mjs --source=<file.html | url> [--project=.] [--run=<dir>] [--widths=390,1440]');
  return { ...o, widths: String(o.widths).split(',').map(Number).filter((w) => w > 0) };
}

export async function main(argv) {
  const o = parseIngestArgs(argv);
  const pw = await loadPlaywright(o.project);
  if (!pw) { process.exitCode = 3; throw new Error(NO_PLAYWRIGHT); }
  const url = /^https?:\/\//.test(o.source) ? o.source : pathToFileURL(resolve(o.source)).href;
  const run = o.run ? { id: basename(resolve(o.run)), dir: resolve(o.run) } : createRun(o.project, o.label || basename(o.source).replace(/\.[a-z]+$/i, ''));
  const paths = runPaths(run.dir);
  for (const dir of [paths.specs, paths.refs]) mkdirSync(dir, { recursive: true });
  const widest = Math.max(...o.widths);
  const browser = await pw.chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: widest, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'networkidle' });
    const sections = segment(await page.evaluate(collectSnapshot, { maxDepth: 12 }));
    const specs = sections.map((section, index) => toSpec(section, { index, sourceRef: url }));
    for (const width of o.widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(200);
      for (const [i, spec] of specs.entries()) {
        const target = page.locator(sections[i].node.path).first();
        if ((await target.count()) === 0) continue;
        const file = join(paths.refs, `${spec.id}-${width}.png`);
        await target.screenshot({ path: file, animations: 'disabled' });
        spec.refs[String(width)] = relative(run.dir, file).split('\\').join('/');
      }
    }
    for (const spec of specs) {
      const errors = checkSpec(spec);
      if (errors.length) throw new Error(`generated an invalid spec ${spec.id} (please report): ${errors.join('; ')}`);
      writeJson(join(paths.specs, `${spec.id}.json`), spec);
    }
    console.log(JSON.stringify({ run: run.id, dir: relative(process.cwd(), run.dir), sections: specs.map((s) => ({ id: s.id, kind: s.kind, chrome: !!s.chrome })) }, null, 2));
  } finally {
    await browser.close();
  }
}

runCli(import.meta.url, main);
```

**Step 5: Run the tests**

Run: `node --test test/creator/ingest-html.test.mjs`
Expected: `pass 1`, `skipped 1`, `fail 0` (the browser test is skipped without `CREATOR_PLAYWRIGHT_DIR`). After Task 14, run it once with `CREATOR_PLAYWRIGHT_DIR=<a folder where npm i -D playwright && npx playwright install chromium ran>`; expected `pass 2`. CI does not install browsers, so the browser test stays a local check.

**Step 6: Commit**

```bash
git add plugins/kivo-creator/scripts/ingest-html.mjs test/fixtures/creator/html test/creator/ingest-html.test.mjs
git commit -m "feat(kivo-creator): ingest an HTML page into section specs and references"
```

---

### Task 14: Dependency-free PNG decoder and encoder

**Files:**
- Create: `plugins/kivo-creator/scripts/png.mjs`
- Test: `test/creator/png.test.mjs`

**Step 1: Write the failing test**

```js
// test/creator/png.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { decodePng, encodePng, crc32, pngChunk } from '../../plugins/kivo-creator/scripts/png.mjs';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Forward filter (the encoder side), so the decoder is tested on every filter type. */
function filterLine(f, line, prev, bpp) {
  const out = Buffer.alloc(line.length);
  for (let i = 0; i < line.length; i++) {
    const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
    const predictor = [0, a, b, (a + b) >> 1, paeth(a, b, c)][f];
    out[i] = (line[i] - predictor) & 0xff;
  }
  return out;
}

function png({ width, height, colorType, channels, pixels, filters = [0], depth = 8, interlace = 0 }) {
  const stride = width * channels;
  const rows = [];
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const line = pixels.subarray(y * stride, (y + 1) * stride);
    const f = filters[y % filters.length];
    rows.push(Buffer.from([f]), filterLine(f, line, prev, channels));
    prev = line;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = depth;
  ihdr[9] = colorType;
  ihdr[12] = interlace;
  return Buffer.concat([SIGNATURE, pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(Buffer.concat(rows))), pngChunk('IEND', Buffer.alloc(0))]);
}

const pattern = (n) => Buffer.from(Array.from({ length: n }, (_, i) => (i * 37 + 11) % 256));

test('crc32 matches the well-known IEND chunk CRC', () => {
  assert.equal(crc32(Buffer.from('IEND', 'latin1')), 0xae426082);
});

test('decodes 8-bit RGB with all five filter types', () => {
  const pixels = pattern(5 * 5 * 3);
  const img = decodePng(png({ width: 5, height: 5, colorType: 2, channels: 3, pixels, filters: [0, 1, 2, 3, 4] }));
  assert.equal(img.width, 5);
  assert.equal(img.height, 5);
  for (let i = 0; i < 25; i++) {
    assert.deepEqual([...img.data.subarray(i * 4, i * 4 + 4)], [pixels[i * 3], pixels[i * 3 + 1], pixels[i * 3 + 2], 255], `pixel ${i}`);
  }
});

test('decodes RGBA and grayscale', () => {
  const rgba = pattern(4 * 3 * 4);
  assert.deepEqual(decodePng(png({ width: 4, height: 3, colorType: 6, channels: 4, pixels: rgba, filters: [4, 3, 1] })).data, rgba);
  const gray = decodePng(png({ width: 2, height: 1, colorType: 0, channels: 1, pixels: Buffer.from([10, 200]) }));
  assert.deepEqual([...gray.data], [10, 10, 10, 255, 200, 200, 200, 255]);
});

test('encodePng output decodes to the same pixels', () => {
  const image = { width: 3, height: 2, data: pattern(3 * 2 * 4) };
  assert.deepEqual(decodePng(encodePng(image)), image);
});

test('unsupported PNGs fail loudly', () => {
  assert.throws(() => decodePng(Buffer.from('nope')), /not a PNG/);
  assert.throws(() => decodePng(png({ width: 1, height: 1, colorType: 2, channels: 3, pixels: pattern(3), depth: 16 })), /bit depth 16/);
  assert.throws(() => decodePng(png({ width: 1, height: 1, colorType: 2, channels: 3, pixels: pattern(3), interlace: 1 })), /interlaced/);
});
```

**Step 2: Run it to see it fail**

Run: `node --test test/creator/png.test.mjs`
Expected: FAIL with `Cannot find module '.../scripts/png.mjs'`

**Step 3: Implement**

```js
// plugins/kivo-creator/scripts/png.mjs
/**
 * png.mjs: PNG decode/encode and pixel diff with node:zlib only.
 * Decodes 8-bit, non-interlaced PNGs of colour type 0 (gray), 2 (RGB),
 * 3 (palette), 4 (gray+alpha) and 6 (RGBA): what Chromium and Figma export.
 * Encodes RGBA, filter 0. Images are { width, height, data: Buffer RGBA }.
 */
import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

export function decodePng(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG file');
  let offset = 8;
  let header = null;
  let palette = null;
  const idat = [];
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('latin1', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === 'IHDR') header = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], color: data[9], interlace: data[12] };
    else if (type === 'PLTE') palette = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }
  if (!header) throw new Error('PNG has no IHDR chunk');
  const { width, height, depth, color, interlace } = header;
  if (depth !== 8) throw new Error(`unsupported PNG bit depth ${depth} (only 8 is supported)`);
  if (interlace) throw new Error('interlaced PNG is not supported');
  const channels = CHANNELS[color];
  if (!channels) throw new Error(`unsupported PNG colour type ${color}`);
  if (color === 3 && !palette) throw new Error('palette PNG without a PLTE chunk');
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const start = y * (stride + 1);
    const filter = raw[start];
    const line = raw.subarray(start + 1, start + 1 + stride);
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error(`bad PNG filter ${filter} on row ${y}`);
      cur[i] = v & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const s = x * channels;
      if (color === 6) cur.copy(out, o, s, s + 4);
      else if (color === 2) { cur.copy(out, o, s, s + 3); out[o + 3] = 255; }
      else if (color === 0) { out[o] = out[o + 1] = out[o + 2] = cur[s]; out[o + 3] = 255; }
      else if (color === 4) { out[o] = out[o + 1] = out[o + 2] = cur[s]; out[o + 3] = cur[s + 1]; }
      else { palette.copy(out, o, cur[s] * 3, cur[s] * 3 + 3); out[o + 3] = 255; }
    }
    prev = cur;
  }
  return { width, height, data: out };
}

export function encodePng({ width, height, data }) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([SIGNATURE, pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}
```

**Step 4: Run the test**

Run: `node --test test/creator/png.test.mjs`
Expected: PASS (`pass 5`, `fail 0`)

**Step 5: Commit**

```bash
git add plugins/kivo-creator/scripts/png.mjs test/creator/png.test.mjs
git commit -m "feat(kivo-creator): decode and encode PNG with node:zlib only"
```

---

### Task 15: Pixel diff

**Files:**
- Modify: `plugins/kivo-creator/scripts/png.mjs` (append)
- Test: `test/creator/diff.test.mjs`

**Step 1: Write the failing test**

```js
// test/creator/diff.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffImages } from '../../plugins/kivo-creator/scripts/png.mjs';

const solid = (width, height, rgba) => ({ width, height, data: Buffer.from(Array.from({ length: width * height }, () => rgba).flat()) });

test('identical images and small channel noise do not count', () => {
  const a = solid(4, 4, [10, 20, 30, 255]);
  assert.equal(diffImages(a, solid(4, 4, [10, 20, 30, 255])).ratio, 0);
  assert.equal(diffImages(a, solid(4, 4, [26, 20, 30, 255])).differing, 0);
});

test('a pixel beyond the tolerance counts and is painted red in the diff image', () => {
  const a = solid(2, 2, [0, 0, 0, 255]);
  const b = solid(2, 2, [0, 0, 0, 255]);
  b.data[4] = 200;
  const d = diffImages(a, b);
  assert.equal(d.differing, 1);
  assert.equal(d.ratio, 0.25);
  assert.deepEqual([...d.image.data.subarray(4, 8)], [255, 0, 0, 255]);
  assert.equal(d.sizeMatch, true);
});

test('different sizes compare the overlap and count the rest as different', () => {
  const d = diffImages(solid(2, 2, [1, 1, 1, 255]), solid(2, 3, [1, 1, 1, 255]));
  assert.equal(d.width, 2);
  assert.equal(d.height, 3);
  assert.equal(d.differing, 2);
  assert.equal(d.sizeMatch, false);
});
```

**Step 2: Run it to see it fail**

Run: `node --test test/creator/diff.test.mjs`
Expected: FAIL with `does not provide an export named 'diffImages'`

**Step 3: Implement**

Append to `plugins/kivo-creator/scripts/png.mjs`:

```js
/**
 * Pixel diff. A pixel differs when any RGBA channel differs by more than
 * `tolerance`; pixels outside the overlap of two sizes always differ.
 * Returns counts, the ratio and a diff image (red = different, faded gray = same).
 */
export function diffImages(a, b, { tolerance = 16 } = {}) {
  const width = Math.max(a.width, b.width);
  const height = Math.max(a.height, b.height);
  const data = Buffer.alloc(width * height * 4);
  let differing = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const inA = x < a.width && y < a.height;
      const inB = x < b.width && y < b.height;
      let different = !inA || !inB;
      if (!different) {
        const ia = (y * a.width + x) * 4;
        const ib = (y * b.width + x) * 4;
        for (let k = 0; k < 4 && !different; k++) different = Math.abs(a.data[ia + k] - b.data[ib + k]) > tolerance;
      }
      if (different) {
        differing++;
        data[o] = 255; data[o + 1] = 0; data[o + 2] = 0; data[o + 3] = 255;
      } else {
        const ia = (y * a.width + x) * 4;
        const gray = Math.round((a.data[ia] * 0.299 + a.data[ia + 1] * 0.587 + a.data[ia + 2] * 0.114) * 0.3 + 255 * 0.7);
        data[o] = data[o + 1] = data[o + 2] = gray; data[o + 3] = 255;
      }
    }
  }
  const total = width * height;
  return { width, height, differing, total, ratio: total ? differing / total : 0, sizeMatch: a.width === b.width && a.height === b.height, image: { width, height, data } };
}
```

**Step 4: Run the tests**

Run: `node --test test/creator/diff.test.mjs test/creator/png.test.mjs`
Expected: PASS (`pass 8`, `fail 0`)

**Step 5: Commit**

```bash
git add plugins/kivo-creator/scripts/png.mjs test/creator/diff.test.mjs
git commit -m "feat(kivo-creator): add a pixel diff with a size-aware ratio"
```

---

### Task 16: Lint for arbitrary values and inline styles

**Files:**
- Create: `plugins/kivo-creator/scripts/lib/lint.mjs`
- Test: `test/creator/lint.test.mjs`

**Step 1: Write the failing test**

```js
// test/creator/lint.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintSource } from '../../plugins/kivo-creator/scripts/lib/lint.mjs';

test('flags arbitrary Tailwind values, arbitrary properties and inline styles with line numbers', () => {
  const blade = [
    '<section class="bg-surface pt-16">',
    '  <h2 class="text-[#111827] md:text-[36px]">{{ $heading }}</h2>',
    '  <div class="[mask-type:luminance]" style="color: red">x</div>',
    '</section>',
  ].join('\n');
  assert.deepEqual(lintSource(blade, 'stats.blade.php').map((f) => `${f.line}:${f.rule}:${f.match}`), [
    '2:arbitrary-value:text-[#111827]',
    '2:arbitrary-value:md:text-[36px]',
    '3:arbitrary-property:[mask-type:luminance]',
    '3:inline-style:style="',
  ]);
});

test('PHP arrays, Blade echoes and @apply of real utilities are fine; CSS is checked for arbitrary values only', () => {
  assert.deepEqual(lintSource("$fields->addRepeater('items', ['max' => 6]);\n{{ $item['heading'] }}", 'Stats.php'), []);
  assert.deepEqual(lintSource('.x { @apply p-[12px]; }', 'x.css').map((f) => f.rule), ['arbitrary-value']);
});
```

**Step 2: Run it to see it fail**

Run: `node --test test/creator/lint.test.mjs`
Expected: FAIL with `Cannot find module '.../scripts/lib/lint.mjs'`

**Step 3: Implement**

```js
// plugins/kivo-creator/scripts/lib/lint.mjs
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ARBITRARY_VALUE = /(?<![\w-])(?:[a-z0-9-]+:)*-?[a-z][a-z0-9-]*-\[[^\]\s]+\]/g;
const ARBITRARY_PROPERTY = /(?<![\w-])\[[a-z][a-z-]*:[^\]\s]+\]/g;
const INLINE_STYLE = /\bstyle\s*=\s*["'{]/g;

export function lintSource(text, file) {
  const findings = [];
  text.split(/\r?\n/).forEach((line, i) => {
    for (const m of line.matchAll(ARBITRARY_VALUE)) findings.push({ file, line: i + 1, rule: 'arbitrary-value', match: m[0] });
    for (const m of line.matchAll(ARBITRARY_PROPERTY)) findings.push({ file, line: i + 1, rule: 'arbitrary-property', match: m[0] });
    if (!file.endsWith('.css')) for (const m of line.matchAll(INLINE_STYLE)) findings.push({ file, line: i + 1, rule: 'inline-style', match: m[0] });
  });
  return findings;
}

/** Lints project-relative paths that exist; missing files are skipped. */
export function lintFiles(paths, baseDir) {
  return paths.filter((p) => existsSync(join(baseDir, p))).flatMap((p) => lintSource(readFileSync(join(baseDir, p), 'utf8'), p));
}
```

`md:text-[36px]` matches as one token because the optional `(?:[a-z0-9-]+:)*` prefix is consumed first, and the lookbehind keeps `text-[36px]` inside it from matching again.

**Step 4: Run the test**

Run: `node --test test/creator/lint.test.mjs`
Expected: PASS (`pass 2`, `fail 0`)

**Step 5: Commit**

```bash
git add plugins/kivo-creator/scripts/lib/lint.mjs test/creator/lint.test.mjs
git commit -m "feat(kivo-creator): lint generated markup for arbitrary values and inline styles"
```

---

### Task 17: Map design values to theme tokens

**Files:**
- Create: `plugins/kivo-creator/scripts/lib/tokens.mjs`
- Create: `test/fixtures/creator/projects/acme-mu-plugin/wp-content/mu-plugins/acme-core/resources/css/app.css`
- Test: `test/creator/tokens.test.mjs`

**Step 1: Create the fixture theme**

```css
@import "tailwindcss";

@theme {
  --color-ink: #111827;
  --color-muted: #4b5563;
  --color-surface: #f5f7fa;
  --color-brand: #0a84ff;
  --text-4xl: 2.25rem;
  --font-sans: "Inter", sans-serif;
}
```

**Step 2: Write the failing test**

```js
// test/creator/tokens.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadTheme, normalizeValue, mapTokens, roleUtilities } from '../../plugins/kivo-creator/scripts/lib/tokens.mjs';
import { FIX } from './helpers.mjs';

const theme = loadTheme(readFileSync(join(FIX, 'projects/acme-mu-plugin/wp-content/mu-plugins/acme-core/resources/css/app.css'), 'utf8'));
const t = (role, prop, value) => ({ role, prop, value, provenance: 'exact' });

test('normalises colours, rem and font stacks', () => {
  assert.equal(normalizeValue('color', '#F5F7FA'), 'rgb(245, 247, 250)');
  assert.equal(normalizeValue('backgroundColor', 'rgba(10, 132, 255, 0.5)'), 'rgba(10, 132, 255, 0.5)');
  assert.equal(normalizeValue('fontSize', '2.25rem'), '36px');
  assert.equal(normalizeValue('fontFamily', '"Inter", sans-serif'), 'inter');
});

test('maps values to theme tokens, spacing to the scale, and the rest to proposals', () => {
  const { mapped, proposals } = mapTokens([
    t('section', 'backgroundColor', 'rgb(245, 247, 250)'),
    t('section', 'paddingTop', '64px'),
    t('heading', 'fontSize', '36px'),
    t('heading', 'fontWeight', '700'),
    t('heading', 'fontFamily', 'Inter, sans-serif'),
    t('text', 'fontSize', '13px'),
    t('section', 'paddingBottom', '10px'),
    t('heading', 'textAlign', 'center'),
  ], theme);
  assert.deepEqual(mapped.map((m) => `${m.prop}->${m.token}${m.step === undefined ? '' : `:${m.step}`}`), [
    'backgroundColor->--color-surface',
    'paddingTop->--spacing:16',
    'fontSize->--text-4xl',
    'fontWeight->--font-weight-bold',
    'fontFamily->--font-sans',
  ]);
  assert.deepEqual(proposals.map((p) => `${p.suggested}=${p.value}`), ['--text-body=13px', '--spacing-section=10px']);
});

test('roleUtilities turns mapped tokens into utility classes per role', () => {
  const { utils, proposals } = roleUtilities([
    t('section', 'backgroundColor', 'rgb(245, 247, 250)'),
    t('heading', 'color', 'rgb(17, 24, 39)'),
    t('heading', 'fontSize', '36px'),
    t('text', 'color', 'rgb(75, 85, 99)'),
    t('text', 'fontSize', '13px'),
  ], theme);
  assert.deepEqual(utils.section, ['bg-surface']);
  assert.deepEqual(utils.heading, ['text-ink', 'text-4xl']);
  assert.deepEqual(utils.text, ['text-muted']);
  assert.equal(proposals.length, 1);
});
```

**Step 3: Run it to see it fail**

Run: `node --test test/creator/tokens.test.mjs`
Expected: FAIL with `Cannot find module '.../scripts/lib/tokens.mjs'`

**Step 4: Implement**

```js
// plugins/kivo-creator/scripts/lib/tokens.mjs
/**
 * Design value -> theme token mapping (Tailwind v4 @theme). A value with no
 * token becomes a proposal; it is never written as a literal.
 */
const DEFAULT_THEME = [
  ['--font-weight-thin', '100'], ['--font-weight-extralight', '200'], ['--font-weight-light', '300'],
  ['--font-weight-normal', '400'], ['--font-weight-medium', '500'], ['--font-weight-semibold', '600'],
  ['--font-weight-bold', '700'], ['--font-weight-extrabold', '800'], ['--font-weight-black', '900'],
  ['--spacing', '0.25rem'],
];
const NAMESPACES = {
  color: '--color-', backgroundColor: '--color-', borderColor: '--color-',
  fontSize: '--text-', fontFamily: '--font-', fontWeight: '--font-weight-', lineHeight: '--leading-',
};
const SPACING = { paddingTop: 'pt', paddingBottom: 'pb', paddingLeft: 'pl', paddingRight: 'pr', gap: 'gap' };
const UTILITY_PREFIX = { color: 'text-', backgroundColor: 'bg-', borderColor: 'border-', fontSize: 'text-', fontFamily: 'font-', fontWeight: 'font-', lineHeight: 'leading-' };
const ROLE_NAME = { text: 'body' };

export function parseTheme(css) {
  const map = new Map();
  for (const block of css.matchAll(/@theme(?:\s+[a-z]+)?\s*\{([\s\S]*?)\}/g)) {
    for (const m of block[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) map.set(m[1], m[2].trim());
  }
  return map;
}

export const loadTheme = (css = '') => new Map([...DEFAULT_THEME, ...parseTheme(css)]);

export function normalizeColor(value) {
  const v = value.trim().toLowerCase();
  let m = v.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return rgb(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), a);
  }
  m = v.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return rgb(+m[1], +m[2], +m[3], a);
  }
  return null;
}

const rgb = (r, g, b, a) => (a >= 1 ? `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})` : `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${+a.toFixed(3)})`);

export function normalizeValue(prop, value) {
  const v = String(value).trim();
  if (/color$/i.test(prop)) return normalizeColor(v) ?? v.toLowerCase();
  if (prop === 'fontFamily') return v.split(',')[0].replace(/["']/g, '').trim().toLowerCase();
  if (/^-?[\d.]+px$/.test(v)) return `${parseFloat(v)}px`;
  if (/^-?[\d.]+rem$/.test(v)) return `${parseFloat(v) * 16}px`;
  return v.toLowerCase();
}

function spacingStep(value, theme) {
  const base = parseFloat(normalizeValue('spacing', theme.get('--spacing') ?? '0.25rem'));
  const px = parseFloat(normalizeValue('padding', value));
  if (!Number.isFinite(px) || !base) return null;
  const step = px / base;
  return Number.isInteger(step) ? step : null;
}

const proposal = (t) => ({ role: t.role, prop: t.prop, value: t.value, provenance: t.provenance, node: t.node, suggested: `${NAMESPACES[t.prop] ?? '--spacing-'}${ROLE_NAME[t.role] ?? t.role}` });

export function mapTokens(tokens, theme) {
  const mapped = [];
  const proposals = [];
  for (const t of tokens) {
    if (SPACING[t.prop]) {
      const step = spacingStep(t.value, theme);
      if (step === null) proposals.push(proposal(t));
      else mapped.push({ ...t, token: '--spacing', step });
      continue;
    }
    const ns = NAMESPACES[t.prop];
    if (!ns) continue; // not a theme concern (textAlign, display)
    if (t.token && theme.has(t.token)) { mapped.push(t); continue; }
    const want = normalizeValue(t.prop, t.value);
    const hit = [...theme].find(([name, value]) => name.startsWith(ns) && !(ns === '--font-' && name.startsWith('--font-weight-')) && !name.includes('--', 2) && normalizeValue(t.prop, value) === want);
    if (hit) mapped.push({ ...t, token: hit[0] });
    else proposals.push(proposal(t));
  }
  return { mapped, proposals };
}

export function utilityFor(t) {
  if (t.token === '--spacing') return SPACING[t.prop] ? `${SPACING[t.prop]}-${t.step}` : null;
  const ns = NAMESPACES[t.prop];
  if (!ns || !t.token?.startsWith(ns)) return null;
  return UTILITY_PREFIX[t.prop] + t.token.slice(ns.length);
}

export function roleUtilities(tokens, theme) {
  const { mapped, proposals } = mapTokens(tokens, theme);
  const utils = { section: [], heading: [], text: [], link: [], button: [], media: [] };
  for (const t of mapped) {
    const u = utilityFor(t);
    if (u && !utils[t.role].includes(u)) utils[t.role].push(u);
  }
  return { utils, proposals, mapped };
}
```

`!name.includes('--', 2)` skips Tailwind sub-tokens such as `--text-4xl--line-height`.

**Step 5: Run the test**

Run: `node --test test/creator/tokens.test.mjs`
Expected: PASS (`pass 3`, `fail 0`)

**Step 6: Commit**

```bash
git add plugins/kivo-creator/scripts/lib/tokens.mjs test/creator/tokens.test.mjs test/fixtures/creator/projects/acme-mu-plugin
git commit -m "feat(kivo-creator): map design values to @theme tokens and propose the rest"
```

---

### Task 18: Style check of `exact` values

**Files:**
- Create: `plugins/kivo-creator/scripts/lib/style-check.mjs`
- Test: `test/creator/style-check.test.mjs`

**Step 1: Write the failing test**

```js
// test/creator/style-check.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { styleCheck } from '../../plugins/kivo-creator/scripts/lib/style-check.mjs';
import { n, r } from './helpers.mjs';

const rendered = n('section', r(0, 400), [
  n('h2', r(10, 40), [], { text: 'Acme in numbers', style: { color: 'rgb(17, 24, 39)', fontSize: '35.8px' } }),
], { style: { backgroundColor: 'rgb(245, 247, 250)' } });

test('compares exact tokens with the rendered computed style; inferred tokens are ignored', () => {
  const spec = { tokens: [
    { role: 'section', prop: 'backgroundColor', value: '#f5f7fa', provenance: 'exact' },
    { role: 'heading', prop: 'fontSize', value: '36px', provenance: 'exact' },
    { role: 'heading', prop: 'color', value: 'rgb(0, 0, 0)', provenance: 'exact' },
    { role: 'text', prop: 'color', value: 'rgb(75, 85, 99)', provenance: 'exact' },
    { role: 'heading', prop: 'lineHeight', value: '40px', provenance: 'inferred' },
  ] };
  assert.deepEqual(styleCheck(spec, rendered), [
    { role: 'section', prop: 'backgroundColor', expected: '#f5f7fa', actual: 'rgb(245, 247, 250)', pass: true },
    { role: 'heading', prop: 'fontSize', expected: '36px', actual: '35.8px', pass: true },
    { role: 'heading', prop: 'color', expected: 'rgb(0, 0, 0)', actual: 'rgb(17, 24, 39)', pass: false },
    { role: 'text', prop: 'color', expected: 'rgb(75, 85, 99)', actual: null, pass: false, reason: 'no text element in the rendered section' },
  ]);
});
```

**Step 2: Run it to see it fail**

Run: `node --test test/creator/style-check.test.mjs`
Expected: FAIL with `Cannot find module '.../scripts/lib/style-check.mjs'`

**Step 3: Implement**

```js
// plugins/kivo-creator/scripts/lib/style-check.mjs
import { roleNode } from './segment.mjs';
import { normalizeValue } from './tokens.mjs';

function same(prop, expected, actual) {
  const a = normalizeValue(prop, expected);
  const b = normalizeValue(prop, actual);
  if (a.endsWith('px') && b.endsWith('px')) return Math.abs(parseFloat(a) - parseFloat(b)) <= 0.5;
  return a === b;
}

/** Checks every `exact` token of a spec against a rendered section snapshot. */
export function styleCheck(spec, rendered) {
  return spec.tokens.filter((t) => t.provenance === 'exact').map((t) => {
    const base = { role: t.role, prop: t.prop, expected: t.value };
    const node = rendered ? roleNode(rendered, t.role) : null;
    if (!node) return { ...base, actual: null, pass: false, reason: `no ${t.role} element in the rendered section` };
    const actual = node.style?.[t.prop];
    if (actual === undefined) return { ...base, actual: null, pass: false, reason: `${t.prop} was not collected` };
    return { ...base, actual, pass: same(t.prop, t.value, actual) };
  });
}
```

**Step 4: Run the test**

Run: `node --test test/creator/style-check.test.mjs`
Expected: PASS (`pass 1`, `fail 0`)

**Step 5: Commit**

```bash
git add plugins/kivo-creator/scripts/lib/style-check.mjs test/creator/style-check.test.mjs
git commit -m "feat(kivo-creator): check exact design values against computed styles"
```

---

### Task 19: Fidelity verdict and `fidelity.md`

**Files:**
- Create: `plugins/kivo-creator/scripts/lib/fidelity.mjs`
- Test: `test/creator/fidelity.test.mjs`

**Step 1: Write the failing test**

```js
// test/creator/fidelity.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSection, summarize, formatFidelity } from '../../plugins/kivo-creator/scripts/lib/fidelity.mjs';

const spec = { id: '01-hero', kind: 'hero' };

test('a section passes when the diff is within the limit and every style matches', () => {
  const row = evaluateSection({ spec, width: 390, diff: { ratio: 0.005, sizeMatch: true }, styles: [], threshold: 0.02 });
  assert.equal(row.pass, true);
  const missing = evaluateSection({ spec, width: 390, diff: null, styles: [], threshold: 0.02 });
  assert.equal(missing.pass, true);
  assert.equal(missing.pixel.reason, 'no reference image');
});

test('formats the report table, the style mismatches and the lint findings', () => {
  const rows = [
    evaluateSection({ spec, width: 390, diff: { ratio: 0.005, sizeMatch: true }, styles: [], threshold: 0.02 }),
    evaluateSection({ spec, width: 1440, diff: { ratio: 0.031, sizeMatch: false }, threshold: 0.02, styles: [
      { role: 'heading', prop: 'color', expected: 'rgb(17, 24, 39)', actual: 'rgb(17, 24, 39)', pass: true },
      { role: 'heading', prop: 'fontSize', expected: '56px', actual: '48px', pass: false },
    ] }),
  ];
  const result = summarize(rows, [{ file: 'x.blade.php', line: 3, rule: 'arbitrary-value', match: 'bg-[#fff]' }]);
  assert.equal(result.pass, false);
  assert.equal(formatFidelity(result, { run: 'run-1', threshold: 0.02 }), [
    '# Fidelity report: run-1',
    '',
    'Result: **FAIL** (pixel limit 2.00% per section and width)',
    '',
    '| Section | Kind | Width | Pixel diff | Styles | Result |',
    '|---|---|---|---|---|---|',
    '| 01-hero | hero | 390 | 0.50% | - | pass |',
    '| 01-hero | hero | 1440 | 3.10% (size differs) | 1/2 | FAIL |',
    '',
    '## Style mismatches',
    '',
    '- `01-hero` at 1440 px: heading fontSize expected 56px, got 48px',
    '',
    '## Lint',
    '',
    '- `x.blade.php:3` arbitrary-value `bg-[#fff]`',
    '',
  ].join('\n'));
});
```

**Step 2: Run it to see it fail**

Run: `node --test test/creator/fidelity.test.mjs`
Expected: FAIL with `Cannot find module '.../scripts/lib/fidelity.mjs'`

**Step 3: Implement**

```js
// plugins/kivo-creator/scripts/lib/fidelity.mjs
const pct = (ratio) => `${(ratio * 100).toFixed(2)}%`;

export function evaluateSection({ spec, width, diff, styles = [], threshold }) {
  const pixel = diff
    ? { ratio: diff.ratio, pass: diff.ratio <= threshold, sizeMatch: diff.sizeMatch }
    : { ratio: null, pass: null, reason: 'no reference image' };
  const failed = styles.filter((s) => !s.pass);
  return { spec: spec.id, kind: spec.kind, width, pixel, styles: { checked: styles.length, failed }, pass: pixel.pass !== false && failed.length === 0 };
}

export function summarize(rows, lint = []) {
  return { pass: rows.length > 0 && rows.every((r) => r.pass) && lint.length === 0, rows, lint };
}

export function formatFidelity(result, { run, threshold }) {
  const lines = [
    `# Fidelity report: ${run}`,
    '',
    `Result: **${result.pass ? 'PASS' : 'FAIL'}** (pixel limit ${pct(threshold)} per section and width)`,
    '',
    '| Section | Kind | Width | Pixel diff | Styles | Result |',
    '|---|---|---|---|---|---|',
  ];
  for (const r of result.rows) {
    const pixel = r.pixel.ratio === null ? 'no reference' : `${pct(r.pixel.ratio)}${r.pixel.sizeMatch === false ? ' (size differs)' : ''}`;
    const styles = r.styles.checked ? `${r.styles.checked - r.styles.failed.length}/${r.styles.checked}` : '-';
    lines.push(`| ${r.spec} | ${r.kind} | ${r.width} | ${pixel} | ${styles} | ${r.pass ? 'pass' : 'FAIL'} |`);
  }
  const mismatches = result.rows.flatMap((r) => r.styles.failed.map((s) => `- \`${r.spec}\` at ${r.width} px: ${s.role} ${s.prop} expected ${s.expected}, got ${s.actual ?? s.reason}`));
  lines.push('', '## Style mismatches', '', ...(mismatches.length ? mismatches : ['None.']));
  lines.push('', '## Lint', '', ...(result.lint.length ? result.lint.map((f) => `- \`${f.file}:${f.line}\` ${f.rule} \`${f.match}\``) : ['None.']));
  return `${lines.join('\n')}\n`;
}
```

**Step 4: Run the test**

Run: `node --test test/creator/fidelity.test.mjs`
Expected: PASS (`pass 2`, `fail 0`)

**Step 5: Commit**

```bash
git add plugins/kivo-creator/scripts/lib/fidelity.mjs test/creator/fidelity.test.mjs
git commit -m "feat(kivo-creator): build the fidelity verdict and report"
```

---

### Task 20: `verify.mjs`

**Files:**
- Create: `plugins/kivo-creator/scripts/verify.mjs`
- Test: `test/creator/verify.test.mjs`

**Step 1: Write the failing test**

```js
// test/creator/verify.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVerifyArgs, targetsFor } from '../../plugins/kivo-creator/scripts/verify.mjs';

test('options: run and url are required; threshold must be a ratio', () => {
  const o = parseVerifyArgs(['--run=.creator/r', '--url=https://acme.test/?p=12']);
  assert.equal(o.threshold, 0.02);
  assert.deepEqual(o.widths, [390, 1440]);
  assert.equal(o.selector, '[data-block]');
  assert.throws(() => parseVerifyArgs(['--run=x']), /--url/);
  assert.throws(() => parseVerifyArgs(['--run=x', '--url=y', '--threshold=2']), /between 0 and 1/);
});

test('targets skip chrome, gaps and skipped sections, in plan order', () => {
  const specs = [{ id: '01-header', chrome: true }, { id: '02-hero' }, { id: '03-stats' }, { id: '04-cta' }];
  const plan = { sections: [
    { spec: '01-header', decision: { action: 'skip' } },
    { spec: '02-hero', decision: { action: 'fill' } },
    { spec: '03-stats', decision: { action: 'gap' } },
    { spec: '04-cta', decision: { action: 'scaffold' } },
  ] };
  assert.deepEqual(targetsFor(specs, plan).map((s) => s.id), ['02-hero', '04-cta']);
});
```

**Step 2: Run it to see it fail**

Run: `node --test test/creator/verify.test.mjs`
Expected: FAIL with `Cannot find module '.../scripts/verify.mjs'`

**Step 3: Implement**

```js
#!/usr/bin/env node
// plugins/kivo-creator/scripts/verify.mjs
/**
 * verify.mjs: screenshot each rendered section with the target project's
 * Playwright, diff it against the reference, check exact styles at the widest
 * width, lint the generated files and write fidelity.md / fidelity.json.
 *
 * Usage:
 *   node scripts/verify.mjs --run=.creator/<run> --url=<rendered page URL>
 *        [--project=.] [--widths=390,1440] [--threshold=0.02] [--selector=[data-block]]
 * Exit: 0 pass, 1 fail or error, 3 Playwright missing in the project.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { loadPlaywright, NO_PLAYWRIGHT } from './lib/playwright.mjs';
import { collectSnapshot } from './lib/collect.mjs';
import { decodePng, diffImages, encodePng } from './png.mjs';
import { readSpecs } from './lib/spec.mjs';
import { readJson, runPaths, writeJson } from './lib/run.mjs';
import { styleCheck } from './lib/style-check.mjs';
import { lintFiles } from './lib/lint.mjs';
import { evaluateSection, formatFidelity, summarize } from './lib/fidelity.mjs';

export function parseVerifyArgs(argv) {
  const o = parseOptions(argv, { run: '', url: '', project: '.', widths: '390,1440', threshold: '0.02', selector: '[data-block]' });
  if (!o.run || !o.url) throw new Error('usage: verify.mjs --run=<.creator/run> --url=<rendered page> [--project=.] [--widths=390,1440] [--threshold=0.02] [--selector=[data-block]]');
  const threshold = Number(o.threshold);
  if (!(threshold > 0 && threshold < 1)) throw new Error('--threshold must be between 0 and 1');
  return { ...o, threshold, widths: String(o.widths).split(',').map(Number).filter((w) => w > 0) };
}

/** Sections that are rendered on the page, in plan order (chrome, gaps and skips are not). */
export function targetsFor(specs, plan) {
  const dropped = new Set((plan?.sections ?? []).filter((s) => ['skip', 'gap'].includes(s.decision?.action)).map((s) => s.spec));
  return specs.filter((s) => !s.chrome && !dropped.has(s.id));
}

export async function main(argv) {
  const o = parseVerifyArgs(argv);
  const runDir = resolve(o.run);
  const paths = runPaths(runDir);
  const plan = existsSync(paths.plan) ? readJson(paths.plan) : null;
  const targets = targetsFor(readSpecs(paths.specs), plan);
  const emitted = existsSync(paths.emitted) ? readJson(paths.emitted) : { files: [] };
  const pw = await loadPlaywright(o.project);
  if (!pw) { process.exitCode = 3; throw new Error(NO_PLAYWRIGHT); }
  mkdirSync(paths.verify, { recursive: true });
  const widest = Math.max(...o.widths);
  const rows = [];
  const browser = await pw.chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: widest, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(o.url, { waitUntil: 'networkidle' });
    for (const width of o.widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(200);
      const blocks = page.locator(o.selector);
      const count = await blocks.count();
      if (count !== targets.length) throw new Error(`found ${count} elements for ${o.selector} at ${width}px, expected ${targets.length} (one per emitted section); pass --selector for blocks that do not print data-block`);
      for (const [i, spec] of targets.entries()) {
        const shot = join(paths.verify, `${spec.id}-${width}.png`);
        await blocks.nth(i).screenshot({ path: shot, animations: 'disabled' });
        const ref = spec.refs?.[String(width)];
        let diff = null;
        if (ref && existsSync(join(runDir, ref))) {
          diff = diffImages(decodePng(readFileSync(join(runDir, ref))), decodePng(readFileSync(shot)));
          writeFileSync(join(paths.verify, `${spec.id}-${width}.diff.png`), encodePng(diff.image));
        }
        const styles = width === widest ? styleCheck(spec, await page.evaluate(collectSnapshot, { selector: o.selector, index: i })) : [];
        rows.push(evaluateSection({ spec, width, diff, styles, threshold: o.threshold }));
      }
    }
  } finally {
    await browser.close();
  }
  const project = resolve(o.project);
  const files = (emitted.files ?? []).map((f) => (existsSync(join(project, f.target)) ? f.target : f.scaffold));
  const result = summarize(rows, lintFiles(files, project));
  writeJson(paths.fidelityJson, result);
  writeFileSync(paths.fidelity, formatFidelity(result, { run: basename(runDir), threshold: o.threshold }));
  console.log(`${result.pass ? 'PASS' : 'FAIL'}: ${rows.filter((r) => r.pass).length}/${rows.length} section checks, ${result.lint.length} lint findings. Report: ${paths.fidelity}`);
  if (!result.pass) process.exitCode = 1;
}

runCli(import.meta.url, main);
```

**Step 4: Run the test**

Run: `node --test test/creator/verify.test.mjs`
Expected: PASS (`pass 2`, `fail 0`)

**Step 5: Commit**

```bash
git add plugins/kivo-creator/scripts/verify.mjs test/creator/verify.test.mjs
git commit -m "feat(kivo-creator): verify rendered sections with pixel diff, style check and lint"
```

---

### Task 21: Adapter contract and selection

**Files:**
- Create: `plugins/kivo-creator/scripts/adapters/index.mjs`
- Test: `test/creator/adapters.test.mjs`

**Step 1: Write the failing test**

```js
// test/creator/adapters.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertAdapter, selectAdapter, ADAPTER_FOR_PROFILE } from '../../plugins/kivo-creator/scripts/adapters/index.mjs';

test('assertAdapter names every missing member', () => {
  assert.throws(() => assertAdapter({ name: 'x', catalog() {} }), /adapter x misses profiles, selector, allowsGeneratedBlocks, emitPage, scaffoldBlock, themeCss/);
});

test('profiles map to adapters; an unknown profile is an error', async () => {
  assert.equal(ADAPTER_FOR_PROFILE['radicle-app'], 'radicle');
  await assert.rejects(selectAdapter({ profile: 'nope' }), /No adapter for profile "nope"/);
});
```

**Step 2: Run it to see it fail**

Run: `node --test test/creator/adapters.test.mjs`
Expected: FAIL with `Cannot find module '.../scripts/adapters/index.mjs'`

**Step 3: Implement**

```js
// plugins/kivo-creator/scripts/adapters/index.mjs
/**
 * Adapter contract. An adapter is a plain object:
 *  name                   string
 *  profiles               kivo-wise profiles it serves
 *  selector               CSS selector of one rendered section (verify)
 *  allowsGeneratedBlocks  false = record a gap instead of scaffolding
 *  catalog(stack)         -> Block[]  { name, slug, className?, title, description, whenToUse, group?, source, fields: Field[] }
 *                            Field { name, type (ACF vocabulary: text, textarea, wysiwyg, image, link, url, oembed, repeater, ...), min?, max?, subFields? }
 *  emitPage(stack, entries) -> { markup, media }   entries: [{ block, pairs, spec }] (pairs from lib/fill.mjs assign())
 *  scaffoldBlock(stack, spec, { theme, catalog }) -> { block, commands, files: [{ path, content }], notes, proposals } | { gap }
 *  themeCss(stack)        -> absolute path of the CSS file holding @theme, or null
 */
const REQUIRED = ['name', 'profiles', 'selector', 'allowsGeneratedBlocks', 'catalog', 'emitPage', 'scaffoldBlock', 'themeCss'];
const FUNCTIONS = ['catalog', 'emitPage', 'scaffoldBlock', 'themeCss'];

export const ADAPTER_FOR_PROFILE = { 'acorn-mu-plugin': 'acorn-mu-plugin', 'sage-theme': 'sage-theme', 'radicle-app': 'radicle' };
const LOADERS = {
  'acorn-mu-plugin': () => import('./acorn-mu-plugin.mjs'),
};

export function assertAdapter(adapter) {
  const missing = REQUIRED.filter((k) => !(k in (adapter ?? {})));
  if (missing.length) throw new Error(`adapter ${adapter?.name ?? '?'} misses ${missing.join(', ')}`);
  const notFunctions = FUNCTIONS.filter((k) => typeof adapter[k] !== 'function');
  if (notFunctions.length) throw new Error(`adapter ${adapter.name}: ${notFunctions.join(', ')} must be functions`);
  return adapter;
}

export async function selectAdapter(stack) {
  const name = ADAPTER_FOR_PROFILE[stack.profile];
  if (!name) throw new Error(`No adapter for profile "${stack.profile}"`);
  if (!LOADERS[name]) throw new Error(`The ${name} adapter is not available yet`);
  return assertAdapter((await LOADERS[name]()).default);
}
```

**Step 4: Run the test**

Run: `node --test test/creator/adapters.test.mjs`
Expected: PASS (`pass 2`, `fail 0`)

**Step 5: Commit**

```bash
git add plugins/kivo-creator/scripts/adapters/index.mjs test/creator/adapters.test.mjs
git commit -m "feat(kivo-creator): define the adapter contract"
```

---

### Task 22: ACF Composer block catalog

**Files:**
- Create: `plugins/kivo-creator/scripts/adapters/shared/names.mjs`
- Create: `plugins/kivo-creator/scripts/adapters/shared/acf-composer.mjs`
- Create: `test/fixtures/creator/projects/acme-mu-plugin/wp-content/mu-plugins/acme-core/app/Blocks/{Hero,FeatureGrid,Faq,Cta}.php`
- Test: `test/creator/acf-catalog.test.mjs`

**Step 1: Create the fixture blocks** (all under `test/fixtures/creator/projects/acme-mu-plugin/wp-content/mu-plugins/acme-core/app/Blocks/`)

`Hero.php`:

```php
<?php

namespace AcmeCore\Blocks;

use Log1x\AcfComposer\Block;
use Log1x\AcfComposer\Builder;

/**
 * @creator-when The first section of a landing page: main heading, lead text, one image and a call to action.
 */
class Hero extends Block
{
    public $name = 'Hero';

    public $description = 'Page opening with a heading, a lead, an image and a button.';

    public function fields(): array
    {
        $fields = Builder::make($this->slug);

        $fields
            ->addText('title')
            ->addTextarea('lead')
            ->addImage('image')
            ->addLink('cta');

        return $fields->build();
    }
}
```

`FeatureGrid.php`:

```php
<?php

namespace AcmeCore\Blocks;

use Log1x\AcfComposer\Block;
use Log1x\AcfComposer\Builder;

/**
 * @creator-when A grid of product features, each with an icon, a title and a short text.
 */
class FeatureGrid extends Block
{
    public $name = 'Feature Grid';

    public $description = 'Up to six features in a grid.';

    public function fields(): array
    {
        $fields = Builder::make($this->slug);

        $fields
            ->addText('title')
            ->addRepeater('items', ['min' => 1, 'max' => 6])
                ->addText('title')
                ->addTextarea('text')
                ->addImage('icon')
            ->endRepeater();

        return $fields->build();
    }
}
```

`Faq.php`:

```php
<?php

namespace AcmeCore\Blocks;

use Log1x\AcfComposer\Block;
use Log1x\AcfComposer\Builder;

/**
 * @creator-when Questions and answers, shown as an accordion.
 */
class Faq extends Block
{
    public $name = 'FAQ';

    public $slug = 'faq';

    public $description = 'Frequently asked questions with expandable answers.';

    public function fields(): array
    {
        $fields = Builder::make($this->slug);

        $fields
            ->addText('title')
            ->addRepeater('questions', ['min' => 1])
                ->addText('question')
                ->addWysiwyg('answer')
            ->endRepeater();

        return $fields->build();
    }
}
```

`Cta.php`:

```php
<?php

namespace AcmeCore\Blocks;

use Log1x\AcfComposer\Block;
use Log1x\AcfComposer\Builder;

/**
 * @creator-when A closing call to action with one or two buttons and no image.
 */
class Cta extends Block
{
    public $name = 'Call to Action';

    public $slug = 'cta';

    public $description = 'Heading, short text and up to two buttons.';

    public function fields(): array
    {
        $fields = Builder::make($this->slug);

        $fields
            ->addText('title')
            ->addTextarea('text')
            ->addLink('primary')
            ->addLink('secondary');

        return $fields->build();
    }
}
```

**Step 2: Write the failing test**

```js
// test/creator/acf-catalog.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { parseBlockClass, acfCatalog } from '../../plugins/kivo-creator/scripts/adapters/shared/acf-composer.mjs';
import { kebab, pascal } from '../../plugins/kivo-creator/scripts/adapters/shared/names.mjs';
import { resolveStack } from '../../plugins/kivo-creator/scripts/lib/stack.mjs';
import { FIX } from './helpers.mjs';

test('names', () => {
  assert.equal(kebab('Feature Grid'), 'feature-grid');
  assert.equal(kebab('FeatureGrid'), 'feature-grid');
  assert.equal(pascal('feature-grid'), 'FeatureGrid');
});

test('catalog reads every ACF Composer block with its fields and nested repeaters', () => {
  const catalog = acfCatalog(resolveStack(join(FIX, 'projects', 'acme-mu-plugin')));
  assert.deepEqual(catalog.map((b) => b.name), ['acf/cta', 'acf/faq', 'acf/feature-grid', 'acf/hero']);
  const grid = catalog.find((b) => b.name === 'acf/feature-grid');
  assert.equal(grid.title, 'Feature Grid');
  assert.equal(grid.group, 'feature-grid');
  assert.equal(grid.whenToUse, 'A grid of product features, each with an icon, a title and a short text.');
  assert.equal(grid.source, 'wp-content/mu-plugins/acme-core/app/Blocks/FeatureGrid.php');
  assert.deepEqual(grid.fields, [
    { name: 'title', type: 'text' },
    { name: 'items', type: 'repeater', min: 1, max: 6, subFields: [{ name: 'title', type: 'text' }, { name: 'text', type: 'textarea' }, { name: 'icon', type: 'image' }] },
  ]);
});

test('abstract classes and files without a block class are ignored', () => {
  assert.equal(parseBlockClass('<?php abstract class Base extends Block {}', 'Base.php'), null);
  assert.equal(parseBlockClass('<?php // helpers', 'x.php'), null);
});

test('Builder::make with a literal sets the field group name', () => {
  const block = parseBlockClass("<?php class Promo extends Block { public $name = 'Promo'; public function fields(): array { $f = Builder::make('promo_box'); $f->addTrueFalse('dark'); return $f->build(); } }", 'Promo.php');
  assert.equal(block.group, 'promo_box');
  assert.deepEqual(block.fields, [{ name: 'dark', type: 'true_false' }]);
});
```

**Step 3: Run it to see it fail**

Run: `node --test test/creator/acf-catalog.test.mjs`
Expected: FAIL with `Cannot find module '.../adapters/shared/acf-composer.mjs'`

**Step 4: Implement `names.mjs`**

```js
// plugins/kivo-creator/scripts/adapters/shared/names.mjs
export const kebab = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const pascal = (s) => kebab(s).split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
export const words = (className) => className.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
export const posix = (p) => p.split('\\').join('/');
/** Keeps generated comments from closing early (PHP, Blade, CSS). */
export const safeComment = (s) => String(s).replace(/\*\//g, '* /').replace(/--}}/g, '- -}}');
export const phpString = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
```

**Step 5: Implement the catalog part of `acf-composer.mjs`**

```js
// plugins/kivo-creator/scripts/adapters/shared/acf-composer.mjs
/**
 * ACF Composer conventions shared by the acorn-mu-plugin and sage-theme adapters.
 * Block name acf/{slug}; slug defaults to the kebab-case $name; the field group
 * is Builder::make(<literal>) or the slug ($this->slug).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { kebab, posix } from './names.mjs';

const FIELD_CALL = /->(add\w+)\(\s*['"]([\w-]+)['"]\s*(?:,\s*(\[[\s\S]*?\]))?\s*\)|->(endRepeater|endGroup|endFlexibleContent)\(\)/g;
const acfType = (method) => method.replace(/^add/, '').replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();

export function parseFields(php) {
  const start = php.search(/function\s+fields\s*\(/);
  if (start === -1) return [];
  const root = [];
  const stack = [root];
  for (const m of php.slice(start).matchAll(FIELD_CALL)) {
    if (m[4]) { if (stack.length > 1) stack.pop(); continue; }
    const field = { name: m[2], type: acfType(m[1]) };
    const options = m[3] ?? '';
    const min = options.match(/['"]min['"]\s*=>\s*(\d+)/);
    const max = options.match(/['"]max['"]\s*=>\s*(\d+)/);
    if (min) field.min = Number(min[1]);
    if (max) field.max = Number(max[1]);
    stack.at(-1).push(field);
    if (field.type === 'repeater' || field.type === 'group') { field.subFields = []; stack.push(field.subFields); }
  }
  return root;
}

export function parseBlockClass(php, source) {
  const cls = php.match(/(abstract\s+)?class\s+(\w+)\s+extends\s+\w+/);
  if (!cls || cls[1]) return null;
  const prop = (name) => php.match(new RegExp(`\\$${name}\\s*=\\s*(['"])(.*?)\\1`))?.[2] ?? null;
  const title = prop('name');
  if (!title) return null;
  const slug = prop('slug') ?? kebab(title);
  return {
    name: `acf/${slug}`,
    slug,
    className: cls[2],
    title,
    description: prop('description') ?? '',
    whenToUse: php.match(/@creator-when\s+(.+)/)?.[1].trim() ?? '',
    group: php.match(/Builder::make\(\s*['"]([\w-]+)['"]/)?.[1] ?? slug,
    source,
    fields: parseFields(php),
  };
}

function* phpFiles(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* phpFiles(full);
    else if (entry.name.endsWith('.php')) yield full;
  }
}

export function acfCatalog(stack) {
  const blocks = [];
  for (const file of phpFiles(join(stack.appPath, 'app', 'Blocks'))) {
    const block = parseBlockClass(readFileSync(file, 'utf8'), posix(relative(stack.projectDir, file)));
    if (block) blocks.push(block);
  }
  return blocks.sort((a, b) => a.name.localeCompare(b.name));
}

export function findThemeCss(dir) {
  return ['resources/css/app.css', 'resources/styles/app.css'].map((p) => join(dir, p)).find((p) => existsSync(p)) ?? null;
}
```

**Step 6: Run the test**

Run: `node --test test/creator/acf-catalog.test.mjs`
Expected: PASS (`pass 4`, `fail 0`)

**Step 7: Commit**

```bash
git add plugins/kivo-creator/scripts/adapters/shared test/creator/acf-catalog.test.mjs test/fixtures/creator/projects/acme-mu-plugin
git commit -m "feat(kivo-creator): read the ACF Composer block catalog"
```

---

### Task 23: Compatibility filter (slots into fields)

**Files:**
- Create: `plugins/kivo-creator/scripts/lib/fill.mjs`
- Create: `test/fixtures/creator/runs/landing/specs/01-hero.json`, `02-faq.json`, `03-testimonial.json`, `04-stats.json`
- Test: `test/creator/fill.test.mjs`

**Step 1: Create the run fixtures** (under `test/fixtures/creator/runs/landing/specs/`)

`01-hero.json`:

```json
{
  "id": "01-hero",
  "order": 0,
  "source": { "kind": "html", "ref": "body > main > section:nth-of-type(1)", "url": "file:///acme/landing.html" },
  "kind": "hero",
  "slots": [
    { "name": "heading", "type": "heading", "value": "Acme ships faster", "provenance": "exact" },
    { "name": "text", "type": "text", "value": "Plan, build and launch in one place.", "provenance": "exact" },
    { "name": "image", "type": "image", "value": { "src": "https://acme.test/hero.png", "alt": "Acme dashboard" }, "provenance": "exact" },
    { "name": "link", "type": "link", "value": { "href": "https://acme.test/signup", "text": "Start free" }, "provenance": "exact" }
  ],
  "layout": { "columns": 1, "align": "left", "media": "right", "repeat": 0 },
  "tokens": [
    { "role": "heading", "prop": "color", "value": "rgb(17, 24, 39)", "provenance": "exact" },
    { "role": "button", "prop": "backgroundColor", "value": "rgb(10, 132, 255)", "provenance": "exact" }
  ],
  "refs": {}
}
```

`02-faq.json`:

```json
{
  "id": "02-faq",
  "order": 1,
  "source": { "kind": "html", "ref": "body > main > section:nth-of-type(2)", "url": "file:///acme/landing.html" },
  "kind": "faq",
  "slots": [
    { "name": "heading", "type": "heading", "value": "Questions", "provenance": "exact" },
    { "name": "items", "type": "list", "provenance": "exact", "items": [
      [ { "name": "heading", "type": "heading", "value": "Can I cancel any time?", "provenance": "exact" }, { "name": "text", "type": "text", "value": "Yes, from your account settings.", "provenance": "exact" } ],
      [ { "name": "heading", "type": "heading", "value": "Is there a free plan?", "provenance": "exact" }, { "name": "text", "type": "text", "value": "Yes, for up to three people.", "provenance": "exact" } ],
      [ { "name": "heading", "type": "heading", "value": "Where is my data stored?", "provenance": "exact" }, { "name": "text", "type": "text", "value": "In the region you pick at sign-up.", "provenance": "exact" } ]
    ] }
  ],
  "layout": { "columns": 1, "align": "left", "media": "none", "repeat": 3 },
  "tokens": [],
  "refs": {}
}
```

`03-testimonial.json`:

```json
{
  "id": "03-testimonial",
  "order": 2,
  "source": { "kind": "html", "ref": "body > main > section:nth-of-type(3)", "url": "file:///acme/landing.html" },
  "kind": "testimonial",
  "slots": [
    { "name": "text", "type": "text", "value": "Acme cut our release time in half.", "provenance": "exact" },
    { "name": "text_2", "type": "text", "value": "Dana Lee, CTO at Example Co", "provenance": "exact" },
    { "name": "image", "type": "image", "value": { "src": "https://acme.test/dana.jpg", "alt": "Dana Lee" }, "provenance": "exact" }
  ],
  "layout": { "columns": 1, "align": "center", "media": "top", "repeat": 0 },
  "tokens": [],
  "refs": {}
}
```

`04-stats.json`:

```json
{
  "id": "04-stats",
  "order": 3,
  "source": { "kind": "html", "ref": "body > main > section:nth-of-type(4)", "url": "file:///acme/landing.html" },
  "kind": "stats",
  "slots": [
    { "name": "heading", "type": "heading", "value": "Acme in numbers", "provenance": "exact" },
    { "name": "items", "type": "list", "provenance": "exact", "items": [
      [ { "name": "heading", "type": "heading", "value": "120k", "provenance": "exact" }, { "name": "text", "type": "text", "value": "Teams on Acme", "provenance": "exact" } ],
      [ { "name": "heading", "type": "heading", "value": "99.9%", "provenance": "exact" }, { "name": "text", "type": "text", "value": "Uptime last year", "provenance": "exact" } ],
      [ { "name": "heading", "type": "heading", "value": "40", "provenance": "exact" }, { "name": "text", "type": "text", "value": "Countries", "provenance": "exact" } ]
    ] }
  ],
  "layout": { "columns": 3, "align": "center", "media": "none", "repeat": 3 },
  "tokens": [
    { "role": "section", "prop": "backgroundColor", "value": "rgb(245, 247, 250)", "provenance": "exact" },
    { "role": "section", "prop": "paddingTop", "value": "64px", "provenance": "exact" },
    { "role": "section", "prop": "paddingBottom", "value": "64px", "provenance": "exact" },
    { "role": "heading", "prop": "color", "value": "rgb(17, 24, 39)", "provenance": "exact" },
    { "role": "heading", "prop": "fontSize", "value": "36px", "provenance": "exact" },
    { "role": "heading", "prop": "fontWeight", "value": "700", "provenance": "exact" },
    { "role": "text", "prop": "color", "value": "rgb(75, 85, 99)", "provenance": "exact" },
    { "role": "text", "prop": "fontSize", "value": "13px", "provenance": "exact" }
  ],
  "refs": { "1440": "refs/04-stats-1440.png" }
}
```

**Step 2: Write the failing test**

```js
// test/creator/fill.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { assign, valueFor } from '../../plugins/kivo-creator/scripts/lib/fill.mjs';
import { acfCatalog } from '../../plugins/kivo-creator/scripts/adapters/shared/acf-composer.mjs';
import { resolveStack } from '../../plugins/kivo-creator/scripts/lib/stack.mjs';
import { readSpecs } from '../../plugins/kivo-creator/scripts/lib/spec.mjs';
import { FIX } from './helpers.mjs';

const catalog = acfCatalog(resolveStack(join(FIX, 'projects', 'acme-mu-plugin')));
const block = (name) => catalog.find((b) => b.name === name);
const [hero, faq, testimonial, stats] = readSpecs(join(FIX, 'runs', 'landing', 'specs'));
const fits = (spec) => catalog.filter((b) => assign(spec.slots, b.fields).leftovers.length === 0).map((b) => b.name);

test('names first, then type: the hero slots land in title, lead, image and cta', () => {
  const r = assign(hero.slots, block('acf/hero').fields);
  assert.deepEqual(r.pairs.map((p) => `${p.slot.name}->${p.field.name}`), ['heading->title', 'text->lead', 'image->image', 'link->cta']);
  assert.equal(r.coverage, 1);
});

test('which blocks can hold each fixture section', () => {
  assert.deepEqual(fits(hero), ['acf/hero']);
  assert.deepEqual(fits(faq), ['acf/faq', 'acf/feature-grid']);
  assert.deepEqual(fits(testimonial), ['acf/hero']);
  assert.deepEqual(fits(stats), ['acf/faq', 'acf/feature-grid']);
});

test('a list longer than the repeater max does not fit', () => {
  const many = { ...stats, slots: [stats.slots[0], { ...stats.slots[1], items: Array(7).fill(stats.slots[1].items[0]) }] };
  assert.deepEqual(fits(many), ['acf/faq']);
});

test('values are shaped per field type', () => {
  assert.deepEqual(valueFor(hero.slots[3], { type: 'link' }), { url: 'https://acme.test/signup', title: 'Start free', target: '' });
  assert.equal(valueFor(hero.slots[0], { type: 'text' }), 'Acme ships faster');
  assert.equal(valueFor({ type: 'embed', value: { src: 'https://video.acme.test/1' } }, { type: 'oembed' }), 'https://video.acme.test/1');
});
```

**Step 3: Run it to see it fail**

Run: `node --test test/creator/fill.test.mjs`
Expected: FAIL with `Cannot find module '.../scripts/lib/fill.mjs'`

**Step 4: Implement**

```js
// plugins/kivo-creator/scripts/lib/fill.mjs
/**
 * Compatibility filter: which block fields can hold which spec slots.
 * Field types use the ACF vocabulary; native adapters translate block.json
 * attributes into it.
 */
export const ACCEPTS = {
  heading: ['text', 'textarea', 'wysiwyg'],
  text: ['textarea', 'wysiwyg', 'text'],
  richtext: ['wysiwyg'],
  image: ['image'],
  link: ['link', 'url'],
  embed: ['oembed', 'url'],
  list: ['repeater'],
  form: [],
};
const CONTENT_TYPES = new Set(['text', 'textarea', 'wysiwyg', 'image', 'link', 'url', 'oembed', 'repeater']);
const SYNONYMS = {
  heading: ['title', 'heading', 'headline'],
  text: ['text', 'lead', 'body', 'description', 'content', 'subtitle', 'intro', 'answer'],
  image: ['image', 'media', 'photo', 'picture', 'icon'],
  link: ['cta', 'link', 'button', 'url'],
};

function nameScore(slot, field) {
  const words = SYNONYMS[slot.type] ?? [slot.name.replace(/_\d+$/, '')];
  const name = field.name.toLowerCase();
  if (words.includes(name)) return 2;
  return words.some((w) => name.includes(w)) ? 1 : 0;
}

function listFits(slot, field) {
  if (slot.type !== 'list') return true;
  const count = slot.items?.length ?? 0;
  if (field.max && count > field.max) return false;
  if (field.min && count < field.min) return false;
  if (!field.subFields?.length) return true;
  return (slot.items ?? []).every((item) => assign(item, field.subFields).leftovers.length === 0);
}

/** Greedy assignment: exact name, then partial name, then the first field of an accepted type. */
export function assign(slots, fields) {
  const free = fields.filter((f) => CONTENT_TYPES.has(f.type));
  const used = new Set();
  const pairs = [];
  const leftovers = [];
  for (const slot of slots) {
    const ok = (f) => !used.has(f.name) && (ACCEPTS[slot.type] ?? []).includes(f.type) && listFits(slot, f);
    const field = free.find((f) => ok(f) && nameScore(slot, f) === 2)
      ?? free.find((f) => ok(f) && nameScore(slot, f) === 1)
      ?? (ACCEPTS[slot.type] ?? []).map((t) => free.find((f) => f.type === t && ok(f))).find(Boolean);
    if (field) { used.add(field.name); pairs.push({ slot, field }); } else leftovers.push(slot);
  }
  return { pairs, leftovers, unused: free.filter((f) => !used.has(f.name)), coverage: free.length ? pairs.length / free.length : 0 };
}

/** Field value for a slot (ACF shapes; image values are resolved to attachments by the adapter). */
export function valueFor(slot, field) {
  switch (field.type) {
    case 'link': return { url: slot.value?.href ?? '', title: slot.value?.text ?? '', target: '' };
    case 'url': return slot.value?.href ?? slot.value?.src ?? String(slot.value ?? '');
    case 'oembed': return slot.value?.src ?? '';
    case 'image': return { src: slot.value?.src ?? null, alt: slot.value?.alt ?? '' };
    case 'repeater': return (slot.items ?? []).map((item) => Object.fromEntries(assign(item, field.subFields ?? []).pairs.map((p) => [p.field.name, valueFor(p.slot, p.field)])));
    default: return typeof slot.value === 'string' ? slot.value : slot.value?.text ?? '';
  }
}
```

Why the four fit results are right: the hero has an image, which only `acf/hero` holds; faq and stats items (heading + text) fit both the `questions` repeater (`heading` into `question`, `text` into `answer`) and the feature `items` repeater, so the filter alone cannot choose and the model judges with the rubric; the testimonial's two texts and image fit `acf/hero` (this is the case where the model must answer `none`, see Task 32). With 7 stat items the feature grid (`max 6`) drops out and only `acf/faq` (no max) remains.

**Step 5: Run the test**

Run: `node --test test/creator/fill.test.mjs`
Expected: PASS (`pass 4`, `fail 0`)

**Step 6: Commit**

```bash
git add plugins/kivo-creator/scripts/lib/fill.mjs test/creator/fill.test.mjs test/fixtures/creator/runs
git commit -m "feat(kivo-creator): add the slot-to-field compatibility filter"
```

---

### Task 24: Block markup serialisation

**Files:**
- Create: `plugins/kivo-creator/scripts/lib/block-markup.mjs`
- Test: `test/creator/block-markup.test.mjs`

**Step 1: Write the failing test**

```js
// test/creator/block-markup.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeAttributes, serializeBlock } from '../../plugins/kivo-creator/scripts/lib/block-markup.mjs';

test('escapes attributes the way WordPress serialize_block_attributes() does', () => {
  assert.equal(serializeAttributes({ a: '<b> & "c" -- /é' }), '{"a":"\\u003cb\\u003e \\u0026 \\u0022c\\u0022 \\u002d\\u002d /é"}');
});

test('self-closing and wrapping forms; core/ is dropped from the name', () => {
  assert.equal(serializeBlock('acf/hero', { name: 'acf/hero' }), '<!-- wp:acf/hero {"name":"acf/hero"} /-->');
  assert.equal(serializeBlock('core/paragraph', {}, '<p>Hi</p>'), '<!-- wp:paragraph -->\n<p>Hi</p>\n<!-- /wp:paragraph -->');
});
```

**Step 2: Run it to see it fail**

Run: `node --test test/creator/block-markup.test.mjs`
Expected: FAIL with `Cannot find module '.../scripts/lib/block-markup.mjs'`

**Step 3: Implement**

```js
// plugins/kivo-creator/scripts/lib/block-markup.mjs
/**
 * Mirrors serialize_block_attributes() in wp-includes/blocks.php: JSON with
 * unescaped slashes and unicode, then --, <, >, & and \" escaped as \u sequences.
 */
export function serializeAttributes(attrs) {
  return JSON.stringify(attrs)
    .replace(/--/g, '\\u002d\\u002d')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\\"/g, '\\u0022');
}

export function serializeBlock(name, attrs = {}, inner = '') {
  const short = name.startsWith('core/') ? name.slice(5) : name;
  const json = Object.keys(attrs).length ? ` ${serializeAttributes(attrs)}` : '';
  return inner ? `<!-- wp:${short}${json} -->\n${inner}\n<!-- /wp:${short} -->` : `<!-- wp:${short}${json} /-->`;
}
```

Native-first check (do it once, write the result in the commit body): open `wp-includes/blocks.php` in any local WordPress checkout, find `function serialize_block_attributes`, and confirm the five replacements and the `JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE` flags.

**Step 4: Run the test**

Run: `node --test test/creator/block-markup.test.mjs`
Expected: PASS (`pass 2`, `fail 0`)

**Step 5: Commit**

```bash
git add plugins/kivo-creator/scripts/lib/block-markup.mjs test/creator/block-markup.test.mjs
git commit -m "feat(kivo-creator): serialise block markup like WordPress core"
```

---

### Task 25: `acorn-mu-plugin` adapter: catalog and page emit

**Files:**
- Modify: `plugins/kivo-creator/scripts/adapters/shared/acf-composer.mjs` (append)
- Create: `plugins/kivo-creator/scripts/adapters/acorn-mu-plugin.mjs`
- Test: `test/creator/acorn-mu-plugin.test.mjs`

**Step 1: Write the failing test**

```js
// test/creator/acorn-mu-plugin.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { selectAdapter } from '../../plugins/kivo-creator/scripts/adapters/index.mjs';
import { resolveStack } from '../../plugins/kivo-creator/scripts/lib/stack.mjs';
import { readSpecs } from '../../plugins/kivo-creator/scripts/lib/spec.mjs';
import { assign } from '../../plugins/kivo-creator/scripts/lib/fill.mjs';
import { FIX } from './helpers.mjs';

const stack = resolveStack(join(FIX, 'projects', 'acme-mu-plugin'));
const [hero, faq] = readSpecs(join(FIX, 'runs', 'landing', 'specs'));

test('selects the adapter and finds the theme CSS', async () => {
  const adapter = await selectAdapter(stack);
  assert.equal(adapter.name, 'acorn-mu-plugin');
  assert.equal(adapter.themeCss(stack), join(stack.appPath, 'resources', 'css', 'app.css'));
  assert.equal(adapter.catalog(stack).length, 4);
});

test('emits acf/* block markup with field keys, and lists images to import', async () => {
  const adapter = await selectAdapter(stack);
  const catalog = adapter.catalog(stack);
  const entry = (spec, name) => { const block = catalog.find((b) => b.name === name); return { block, spec, pairs: assign(spec.slots, block.fields).pairs }; };
  const { markup, media } = adapter.emitPage(stack, [entry(hero, 'acf/hero'), entry(faq, 'acf/faq')]);
  const [heroLine, faqLine] = markup.trimEnd().split('\n\n');
  assert.equal(heroLine, '<!-- wp:acf/hero {"name":"acf/hero","data":{"title":"Acme ships faster","_title":"field_hero_title","lead":"Plan, build and launch in one place.","_lead":"field_hero_lead","image":null,"_image":"field_hero_image","cta":{"url":"https://acme.test/signup","title":"Start free","target":""},"_cta":"field_hero_cta"},"mode":"preview"} /-->');
  assert.match(faqLine, /"questions":3,"_questions":"field_faq_questions","questions_0_question":"Can I cancel any time\?","_questions_0_question":"field_faq_questions_question","questions_0_answer":"Yes, from your account settings.","_questions_0_answer":"field_faq_questions_answer"/);
  assert.deepEqual(media, [{ spec: '01-hero', block: 'acf/hero', field: 'image', src: 'https://acme.test/hero.png', alt: 'Acme dashboard' }]);
});
```

**Step 2: Run it to see it fail**

Run: `node --test test/creator/acorn-mu-plugin.test.mjs`
Expected: FAIL with `Cannot find module '.../adapters/acorn-mu-plugin.mjs'`

**Step 3: Append the emit part to `acf-composer.mjs`**

Add `import { assign, valueFor } from '../../lib/fill.mjs';` and `import { serializeBlock } from '../../lib/block-markup.mjs';` to the imports, then append:

```js
/** ACF Builder key: field_<group>_<path joined by _> (dashes become underscores). */
export const fieldKey = (group, path) => `field_${[group, ...path].join('_').replace(/-/g, '_')}`;

/**
 * ACF block "data": name => value plus _name => field key; repeater rows are
 * flattened as <name>_<i>_<sub>. Images need an attachment id, so they are
 * emitted as null and listed in `media` for import.
 */
export function acfData(pairs, group, media, prefix = '', path = []) {
  const data = {};
  for (const { slot, field } of pairs) {
    const name = `${prefix}${field.name}`;
    const key = fieldKey(group, [...path, field.name]);
    if (field.type === 'repeater') {
      const rows = slot.items ?? [];
      data[name] = rows.length;
      data[`_${name}`] = key;
      rows.forEach((item, i) => Object.assign(data, acfData(assign(item, field.subFields ?? []).pairs, group, media, `${name}_${i}_`, [...path, field.name])));
    } else if (field.type === 'image') {
      data[name] = null;
      data[`_${name}`] = key;
      media.push({ field: name, src: slot.value?.src ?? null, alt: slot.value?.alt ?? '' });
    } else {
      data[name] = valueFor(slot, field);
      data[`_${name}`] = key;
    }
  }
  return data;
}

export function emitAcfPage(entries) {
  const media = [];
  const parts = entries.map(({ block, pairs, spec }) => {
    const found = [];
    const data = acfData(pairs, block.group ?? block.slug, found);
    media.push(...found.map((m) => ({ spec: spec.id, block: block.name, ...m })));
    return serializeBlock(block.name, { name: block.name, data, mode: 'preview' });
  });
  return { markup: `${parts.join('\n\n')}\n`, media };
}
```

**Step 4: Create the adapter** (scaffolding is added in Task 26; until then it returns a gap)

```js
// plugins/kivo-creator/scripts/adapters/acorn-mu-plugin.mjs
import { acfCatalog, emitAcfPage, findThemeCss } from './shared/acf-composer.mjs';

export default {
  name: 'acorn-mu-plugin',
  profiles: ['acorn-mu-plugin'],
  selector: '[data-block]',
  allowsGeneratedBlocks: true,
  catalog: (stack) => acfCatalog(stack),
  emitPage: (stack, entries) => emitAcfPage(entries),
  scaffoldBlock: () => ({ gap: 'scaffolding lands in the next task' }),
  themeCss: (stack) => findThemeCss(stack.appPath),
};
```

**Step 5: Run the test**

Run: `node --test test/creator/acorn-mu-plugin.test.mjs`
Expected: PASS (`pass 2`, `fail 0`)

**Step 6: Native-first check of the field keys and data shape**

In a real project that uses ACF Composer (any local checkout, not committed here), confirm before relying on the golden line:
1. `vendor/stoutlogic/acf-builder/src/Transform/NamespaceFieldKey.php`: how the key is built from the group and field names (dashes, nesting of repeater sub fields).
2. `wp-content/plugins/advanced-custom-fields-pro/pro/blocks.php` (or `includes/blocks.php`): how block `data` is read (`name` + `_name` pairs, repeater rows as `<name>_<i>_<sub>`).
If either differs, change `fieldKey` / `acfData` and the expected line in the test together, and record the file and line in `docs/provenance.md` (Task 33).

**Step 7: Commit**

```bash
git add plugins/kivo-creator/scripts/adapters test/creator/acorn-mu-plugin.test.mjs
git commit -m "feat(kivo-creator): emit acf block markup from the acorn-mu-plugin adapter"
```

---

### Task 26: `acorn-mu-plugin` adapter: scaffold a missing block

**Files:**
- Create: `plugins/kivo-creator/scripts/adapters/shared/blade-view.mjs`
- Modify: `plugins/kivo-creator/scripts/adapters/shared/acf-composer.mjs` (append)
- Modify: `plugins/kivo-creator/scripts/adapters/acorn-mu-plugin.mjs`
- Create: `test/fixtures/creator/golden/acorn-mu-plugin/Stats.php`, `stats.blade.php`, `stats.css`
- Test: `test/creator/acf-scaffold.test.mjs`

**Step 1: Write the golden files**

`test/fixtures/creator/golden/acorn-mu-plugin/Stats.php`:

```php
<?php

namespace AcmeCore\Blocks;

use Log1x\AcfComposer\Block;
use Log1x\AcfComposer\Builder;

/**
 * Generated by kivo-creator from html body > main > section:nth-of-type(4).
 *
 * @creator-when A stats section: a heading and a row of figures with labels.
 */
class Stats extends Block
{
    public $name = 'Stats';

    public $slug = 'stats';

    public $description = 'Stats section generated from the design.';

    public $category = 'design';

    public $icon = 'block-default';

    public $supports = [
        'align' => false,
        'anchor' => true,
        'mode' => false,
        'jsx' => false,
    ];

    public function with(): array
    {
        return [
            'heading' => (string) (get_field('heading') ?: ''),
            'items' => is_array(get_field('items')) ? get_field('items') : [],
        ];
    }

    public function fields(): array
    {
        $fields = Builder::make($this->slug);

        $fields
            ->addText('heading')
            ->addRepeater('items')
                ->addText('heading')
                ->addTextarea('text')
            ->endRepeater();

        return $fields->build();
    }
}
```

`test/fixtures/creator/golden/acorn-mu-plugin/stats.blade.php`:

```blade
{{-- Generated by kivo-creator from html body > main > section:nth-of-type(4). --}}
<section {{ $attributes->merge(['class' => 'text-center bg-surface pt-16 pb-16', 'data-block' => 'stats']) }}>
  @if ($heading)
    <h2 class="text-ink text-4xl font-bold">{{ $heading }}</h2>
  @endif
  @if ($items)
    <ul class="grid gap-8 md:grid-cols-3">
      @foreach ($items as $item)
        <li>
          @if (! empty($item['heading']))
            <h3 class="text-ink text-4xl font-bold">{{ $item['heading'] }}</h3>
          @endif
          @if (! empty($item['text']))
            <p class="text-muted">@textarea($item['text'])</p>
          @endif
        </li>
      @endforeach
    </ul>
  @endif
</section>
```

`test/fixtures/creator/golden/acorn-mu-plugin/stats.css`:

```css
/* acf/stats: generated by kivo-creator from html body > main > section:nth-of-type(4). */
/* Token proposals (add to @theme, then use the utility; never a literal value): */
/*   --text-body: 13px (text fontSize) */
```

Every golden file ends with exactly one newline.

`@textarea()` follows the kivo-wise rule in `AGENTS.md` ("`addTextarea` → `@textarea($f)`"); the scaffolding skill checks that the directive exists in the project before copying the view.

**Step 2: Write the failing test**

```js
// test/creator/acf-scaffold.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { selectAdapter } from '../../plugins/kivo-creator/scripts/adapters/index.mjs';
import { resolveStack } from '../../plugins/kivo-creator/scripts/lib/stack.mjs';
import { readSpecs } from '../../plugins/kivo-creator/scripts/lib/spec.mjs';
import { loadTheme } from '../../plugins/kivo-creator/scripts/lib/tokens.mjs';
import { lintSource } from '../../plugins/kivo-creator/scripts/lib/lint.mjs';
import { parseBlockClass } from '../../plugins/kivo-creator/scripts/adapters/shared/acf-composer.mjs';
import { FIX } from './helpers.mjs';

const stack = resolveStack(join(FIX, 'projects', 'acme-mu-plugin'));
const stats = readSpecs(join(FIX, 'runs', 'landing', 'specs')).find((s) => s.id === '04-stats');
const golden = (f) => readFileSync(join(FIX, 'golden', 'acorn-mu-plugin', f), 'utf8');

test('scaffolds class, view and CSS that match the golden files', async () => {
  const adapter = await selectAdapter(stack);
  const theme = loadTheme(readFileSync(adapter.themeCss(stack), 'utf8'));
  const out = adapter.scaffoldBlock(stack, stats, { theme, catalog: adapter.catalog(stack) });
  assert.deepEqual(out.commands, ['acf:block Stats --no-interaction']);
  assert.deepEqual(out.files.map((f) => f.path), [
    'wp-content/mu-plugins/acme-core/app/Blocks/Stats.php',
    'wp-content/mu-plugins/acme-core/resources/views/blocks/stats.blade.php',
    'wp-content/mu-plugins/acme-core/resources/css/blocks/stats.css',
  ]);
  assert.equal(out.files[0].content, golden('Stats.php'));
  assert.equal(out.files[1].content, golden('stats.blade.php'));
  assert.equal(out.files[2].content, golden('stats.css'));
  assert.deepEqual(out.proposals.map((p) => p.suggested), ['--text-body']);
  for (const f of out.files) assert.deepEqual(lintSource(f.content, f.path), [], f.path);
});

test('the scaffolded class reads back as a catalog block that holds the spec', async () => {
  const adapter = await selectAdapter(stack);
  const out = adapter.scaffoldBlock(stack, stats, { theme: loadTheme(''), catalog: [] });
  const parsed = parseBlockClass(out.files[0].content, out.files[0].path);
  assert.deepEqual(parsed.fields, out.block.fields);
  assert.equal(out.block.name, 'acf/stats');
});

test('a name already in the catalog gets a numeric suffix', async () => {
  const adapter = await selectAdapter(stack);
  const out = adapter.scaffoldBlock(stack, stats, { theme: loadTheme(''), catalog: [{ className: 'Stats', slug: 'stats' }] });
  assert.equal(out.block.name, 'acf/stats-2');
});
```

**Step 3: Run it to see it fail**

Run: `node --test test/creator/acf-scaffold.test.mjs`
Expected: FAIL in the first test: `out.commands` is `undefined` (the adapter still returns a gap).

**Step 4: Write the shared Blade view renderer**

```js
// plugins/kivo-creator/scripts/adapters/shared/blade-view.mjs
/**
 * Blade view for a scaffolded block. Flavour "acf" (ACF Composer: variables
 * from with(), $attributes bag) or "native" (block.json attributes in $data).
 * Classes come only from mapped tokens and layout: never arbitrary values.
 */
import { safeComment } from './names.mjs';

const ALIGN = { center: 'text-center', right: 'text-right' };
const cls = (list) => (list.length ? ` class="${list.join(' ')}"` : '');

export function renderView({ slug, spec, fields, utils, flavour }) {
  const rootClass = [ALIGN[spec.layout.align], ...utils.section].filter(Boolean).join(' ');
  const open = flavour === 'acf'
    ? `<section {{ $attributes->merge(['class' => '${rootClass}', 'data-block' => '${slug}']) }}>`
    : `<section {!! get_block_wrapper_attributes(['class' => '${rootClass}', 'data-block' => '${slug}']) !!}>`;
  const lines = [`{{-- Generated by kivo-creator from ${spec.source.kind} ${safeComment(spec.source.ref)}. --}}`, open];
  for (const field of fields) {
    const expr = flavour === 'acf' ? `$${field.name}` : `$data['${field.name}']`;
    lines.push(...renderField({ field, expr, depth: 1, top: true, spec, utils, flavour }));
  }
  lines.push('</section>');
  return `${lines.join('\n')}\n`;
}

function renderField({ field, expr, depth, top, spec, utils, flavour }) {
  const pad = '  '.repeat(depth);
  const inner = (line) => `${pad}  ${line}`;
  const guard = top && flavour === 'acf' ? `@if (${expr})` : `@if (! empty(${expr}))`;
  let body;
  switch (field.slotType) {
    case 'heading': {
      const tag = top ? (spec.kind === 'hero' ? 'h1' : 'h2') : 'h3';
      body = [inner(`<${tag}${cls(utils.heading)}>{{ ${expr} }}</${tag}>`)];
      break;
    }
    case 'text':
      body = [inner(flavour === 'acf' ? `<p${cls(utils.text)}>@textarea(${expr})</p>` : `<p${cls(utils.text)}>{{ ${expr} }}</p>`)];
      break;
    case 'richtext':
      body = [inner(`<div${cls(utils.text)}>{!! wp_kses_post(${expr}) !!}</div>`)];
      break;
    case 'image':
      body = [inner(flavour === 'acf' ? `{!! wp_get_attachment_image(${expr}['ID'] ?? 0, 'large') !!}` : `<img src="{{ ${expr}['url'] }}" alt="{{ ${expr}['alt'] ?? '' }}">`)];
      break;
    case 'link': {
      const label = flavour === 'acf' ? 'title' : 'text';
      body = [inner(`<a href="{{ ${expr}['url'] }}"${cls(utils.button.length ? utils.button : utils.link)}>{{ ${expr}['${label}'] }}</a>`)];
      break;
    }
    case 'embed':
      body = [inner(`{!! ${expr} !!}`)];
      break;
    case 'list': {
      const cols = spec.layout.columns > 1 ? ` md:grid-cols-${spec.layout.columns}` : '';
      body = [
        inner(`<ul class="grid gap-8${cols}">`),
        inner(`  @foreach (${expr} as $item)`),
        inner('    <li>'),
        ...field.subFields.flatMap((sub) => renderField({ field: sub, expr: `$item['${sub.name}']`, depth: depth + 4, top: false, spec, utils, flavour })),
        inner('    </li>'),
        inner('  @endforeach'),
        inner('</ul>'),
      ];
      break;
    }
    default:
      body = [];
  }
  return [`${pad}${guard}`, ...body, `${pad}@endif`];
}
```

**Step 5: Append the scaffold part to `acf-composer.mjs`**

Add to the imports: `import { roleUtilities } from '../../lib/tokens.mjs';`, `import { renderView } from './blade-view.mjs';`, and extend the `./names.mjs` import to `{ kebab, pascal, posix, words, safeComment, phpString }`. Then append:

```js
export const WHEN = {
  hero: 'A page-opening section: main heading, lead text, call to action and optional media.',
  features: 'A grid of repeated items, each with a heading and text.',
  stats: 'A stats section: a heading and a row of figures with labels.',
  cta: 'A short call to action: heading, text and one or two links.',
  faq: 'Questions and answers.',
  testimonial: 'A quote with its author.',
  logos: 'A row of logos.',
  form: 'A section around a form.',
  media: 'A large image or an embedded video.',
  text: 'A block of text with an optional heading.',
  steps: 'An ordered sequence of steps.',
  custom: 'A custom section generated from the design.',
};
const SLOT_TO_ACF = { heading: 'text', text: 'textarea', richtext: 'wysiwyg', image: 'image', link: 'link', embed: 'oembed' };
const ACF_METHOD = { text: 'addText', textarea: 'addTextarea', wysiwyg: 'addWysiwyg', image: 'addImage', link: 'addLink', oembed: 'addOembed' };

/** Fields for a new block, derived from the slots (forms are left to the person). */
export function fieldsFromSlots(slots) {
  const fields = [];
  const notes = [];
  for (const slot of slots) {
    if (slot.type === 'form') { notes.push(`form slot "${slot.name}": connect the project's form block or shortcode by hand`); continue; }
    if (slot.type === 'list') {
      const sub = fieldsFromSlots(slot.items?.[0] ?? []);
      fields.push({ name: slot.name, acfType: 'repeater', slotType: 'list', subFields: sub.fields.filter((f) => f.acfType !== 'repeater') });
      notes.push(...sub.notes);
      continue;
    }
    fields.push({ name: slot.name, acfType: SLOT_TO_ACF[slot.type], slotType: slot.type });
  }
  return { fields, notes };
}

export const toCatalogField = (f) => (f.acfType === 'repeater' ? { name: f.name, type: 'repeater', subFields: f.subFields.map(toCatalogField) } : { name: f.name, type: f.acfType });

export function uniqueName(spec, catalog) {
  const base = pascal(spec.kind === 'custom' ? spec.id.replace(/^\d+-/, '') : spec.kind);
  let className = base;
  let slug = kebab(base);
  for (let n = 2; catalog.some((b) => b.className === className || b.slug === slug); n++) {
    className = `${base}${n}`;
    slug = `${kebab(base)}-${n}`;
  }
  return { className, slug, title: words(className) };
}

function withLine(f) {
  if (f.acfType === 'repeater') return `'${f.name}' => is_array(get_field('${f.name}')) ? get_field('${f.name}') : [],`;
  if (f.acfType === 'image' || f.acfType === 'link') return `'${f.name}' => get_field('${f.name}') ?: null,`;
  return `'${f.name}' => (string) (get_field('${f.name}') ?: ''),`;
}

function builderLines(f, depth) {
  const pad = '    '.repeat(depth);
  if (f.acfType === 'repeater') return [`${pad}->addRepeater('${f.name}')`, ...f.subFields.flatMap((s) => builderLines(s, depth + 1)), `${pad}->endRepeater()`];
  return [`${pad}->${ACF_METHOD[f.acfType]}('${f.name}')`];
}

export function renderAcfClass({ namespace, className, title, slug, spec, fields }) {
  const builder = fields.flatMap((f) => builderLines(f, 3));
  builder[builder.length - 1] += ';';
  return [
    '<?php', '',
    `namespace ${namespace}\\Blocks;`, '',
    'use Log1x\\AcfComposer\\Block;',
    'use Log1x\\AcfComposer\\Builder;', '',
    '/**',
    ` * Generated by kivo-creator from ${spec.source.kind} ${safeComment(spec.source.ref)}.`,
    ' *',
    ` * @creator-when ${WHEN[spec.kind]}`,
    ' */',
    `class ${className} extends Block`,
    '{',
    `    public $name = '${phpString(title)}';`, '',
    `    public $slug = '${slug}';`, '',
    `    public $description = '${phpString(title)} section generated from the design.';`, '',
    "    public $category = 'design';", '',
    "    public $icon = 'block-default';", '',
    '    public $supports = [',
    "        'align' => false,",
    "        'anchor' => true,",
    "        'mode' => false,",
    "        'jsx' => false,",
    '    ];', '',
    '    public function with(): array',
    '    {',
    '        return [',
    ...fields.map((f) => `            ${withLine(f)}`),
    '        ];',
    '    }', '',
    '    public function fields(): array',
    '    {',
    '        $fields = Builder::make($this->slug);', '',
    '        $fields',
    ...builder,
    '',
    '        return $fields->build();',
    '    }',
    '}',
    '',
  ].join('\n');
}

export function renderBlockCss({ name, spec, proposals }) {
  const lines = [`/* ${name}: generated by kivo-creator from ${spec.source.kind} ${safeComment(spec.source.ref)}. */`];
  if (proposals.length) {
    lines.push('/* Token proposals (add to @theme, then use the utility; never a literal value): */');
    for (const p of proposals) lines.push(`/*   ${p.suggested}: ${p.value} (${p.role} ${p.prop}) */`);
  }
  return `${lines.join('\n')}\n`;
}

export function scaffoldAcf(stack, spec, { theme, catalog = [] }) {
  const { className, slug, title } = uniqueName(spec, catalog);
  const { fields, notes } = fieldsFromSlots(spec.slots);
  const { utils, proposals } = roleUtilities(spec.tokens, theme);
  const app = posix(relative(stack.projectDir, stack.appPath)) || '.';
  const at = (...parts) => posix(join(app, ...parts));
  const files = [
    { path: at('app', 'Blocks', `${className}.php`), content: renderAcfClass({ namespace: stack.namespace.replace(/\\+$/, ''), className, title, slug, spec, fields }) },
    { path: at('resources', 'views', 'blocks', `${slug}.blade.php`), content: renderView({ slug, spec, fields, utils, flavour: 'acf' }) },
    { path: at('resources', 'css', 'blocks', `${slug}.css`), content: renderBlockCss({ name: `acf/${slug}`, spec, proposals }) },
  ];
  const block = { name: `acf/${slug}`, slug, className, title, description: `${title} section generated from the design.`, whenToUse: WHEN[spec.kind], group: slug, source: files[0].path, fields: fields.map(toCatalogField) };
  return { block, commands: [`acf:block ${className} --no-interaction`], files, notes, proposals };
}
```

**Step 6: Wire it into the adapter**

In `plugins/kivo-creator/scripts/adapters/acorn-mu-plugin.mjs` import `scaffoldAcf` and replace the placeholder:

```js
  scaffoldBlock: (stack, spec, options) => scaffoldAcf(stack, spec, options),
```

**Step 7: Run the tests**

Run: `node --test test/creator/acf-scaffold.test.mjs test/creator/acorn-mu-plugin.test.mjs`
Expected: PASS (`pass 5`, `fail 0`). If a golden comparison fails, read the diff: fix the generator when the golden file is what kivo-wise conventions ask for; never "fix" the golden file to match a generator bug.

**Step 8: Commit**

```bash
git add plugins/kivo-creator/scripts/adapters test/creator/acf-scaffold.test.mjs test/fixtures/creator/golden
git commit -m "feat(kivo-creator): scaffold missing ACF Composer blocks in the project's conventions"
```

---

### Task 27: Match plan

**Files:**
- Create: `plugins/kivo-creator/scripts/lib/match.mjs`
- Create: `plugins/kivo-creator/scripts/lib/context.mjs`
- Create: `plugins/kivo-creator/scripts/match.mjs`
- Test: `test/creator/match.test.mjs`

**Step 1: Write the failing test**

```js
// test/creator/match.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildPlan, checkPlan, formatPlan, THRESHOLD } from '../../plugins/kivo-creator/scripts/lib/match.mjs';
import { acfCatalog } from '../../plugins/kivo-creator/scripts/adapters/shared/acf-composer.mjs';
import { resolveStack } from '../../plugins/kivo-creator/scripts/lib/stack.mjs';
import { readSpecs } from '../../plugins/kivo-creator/scripts/lib/spec.mjs';
import { FIX, PLUGIN, tmpCopy } from './helpers.mjs';

const catalog = acfCatalog(resolveStack(join(FIX, 'projects', 'acme-mu-plugin')));
const specs = readSpecs(join(FIX, 'runs', 'landing', 'specs'));
const header = { id: '00-header', kind: 'custom', chrome: true, slots: [] };
const media = { id: '05-media', kind: 'media', slots: [{ name: 'embed', type: 'embed', value: { src: 'https://video.acme.test/1' }, provenance: 'exact' }] };
const connected = { ...specs[3], id: '06-stats', codeConnect: { block: 'acf/feature-grid', component: 'Stats/Default' } };

test('deterministic decisions: chrome is skipped, Code Connect fills, nothing-fits scaffolds; the rest waits for judgment', () => {
  const plan = buildPlan({ run: 'r', adapter: 'acorn-mu-plugin', specs: [header, ...specs, media, connected], catalog });
  const d = Object.fromEntries(plan.sections.map((s) => [s.spec, s.decision?.action ?? null]));
  assert.deepEqual(d, { '00-header': 'skip', '01-hero': null, '02-faq': null, '03-testimonial': null, '04-stats': null, '05-media': 'scaffold', '06-stats': 'fill' });
  assert.deepEqual(plan.sections[2].candidates.map((c) => c.block), ['acf/faq', 'acf/feature-grid']);
  assert.equal(plan.threshold, THRESHOLD);
});

test('a target that forbids generated blocks records a gap instead', () => {
  const plan = buildPlan({ run: 'r', adapter: 'x', specs: [media], catalog, allowsGeneratedBlocks: false });
  assert.equal(plan.sections[0].decision.action, 'gap');
});

test('checkPlan refuses open, unknown, low-confidence and filter-violating decisions', () => {
  const plan = buildPlan({ run: 'r', adapter: 'acorn-mu-plugin', specs, catalog });
  plan.sections[0].decision = { action: 'fill', block: 'acf/hero', confidence: 0.9, reason: 'hero with image' };
  plan.sections[1].decision = { action: 'fill', block: 'acf/hero', confidence: 0.9, reason: 'x' };
  plan.sections[2].decision = { action: 'fill', block: 'acf/hero', confidence: 0.4, reason: 'unsure' };
  assert.deepEqual(checkPlan(plan, catalog), [
    'section 02-faq: "acf/hero" did not pass the compatibility filter',
    'section 03-testimonial: confidence 0.4 is below 0.6; ask the person and set approvedBy: "person"',
    'section 04-stats: no decision yet (judge the candidates)',
  ]);
});

test('formatPlan renders a table that names the open sections', () => {
  const md = formatPlan(buildPlan({ run: 'r', adapter: 'acorn-mu-plugin', specs: specs.slice(0, 2), catalog }));
  assert.match(md, /^# Match plan: r/);
  assert.match(md, /\| 02-faq \| faq \| judge \| - \| - \| candidates: acf\/faq \(1\), acf\/feature-grid \(1\) \|/);
});

test('CLI: builds the plan, refuses to overwrite it, and --check fails while decisions are open', () => {
  const project = tmpCopy(join(FIX, 'projects', 'acme-mu-plugin'));
  const run = join(project, '.creator', 'run-1');
  mkdirSync(run, { recursive: true });
  cpSync(join(FIX, 'runs', 'landing', 'specs'), join(run, 'specs'), { recursive: true });
  const cli = (...args) => spawnSync(process.execPath, [join(PLUGIN, 'scripts', 'match.mjs'), `--project=${project}`, ...args], { encoding: 'utf8' });
  const built = cli(`--run=${run}`);
  assert.equal(built.status, 0, built.stderr);
  assert.deepEqual(JSON.parse(built.stdout).judge, ['01-hero', '02-faq', '03-testimonial', '04-stats']);
  assert.match(cli(`--run=${run}`).stderr, /exists; edit it and run --check/);
  assert.equal(cli(`--run=${run}`, '--check').status, 1);
  const plan = JSON.parse(readFileSync(join(run, 'match-plan.json'), 'utf8'));
  for (const s of plan.sections) s.decision = { action: 'scaffold', block: null, confidence: 1, reason: 'test' };
  writeFileSync(join(run, 'match-plan.json'), JSON.stringify(plan));
  const ok = cli(`--run=${run}`, '--check');
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(cli('--catalog').stdout, /"acf\/feature-grid"/);
});
```

**Step 2: Run it to see it fail**

Run: `node --test test/creator/match.test.mjs`
Expected: FAIL with `Cannot find module '.../scripts/lib/match.mjs'`

**Step 3: Implement the plan logic**

```js
// plugins/kivo-creator/scripts/lib/match.mjs
import { assign } from './fill.mjs';

export const THRESHOLD = 0.6;
const ACTIONS = new Set(['fill', 'scaffold', 'gap', 'skip', 'ask']);
const round2 = (n) => Math.round(n * 100) / 100;

export function candidatesFor(spec, catalog) {
  return catalog
    .map((block) => {
      const r = assign(spec.slots, block.fields);
      return { block: block.name, fits: r.leftovers.length === 0, coverage: round2(r.coverage), unused: r.unused.map((f) => f.name) };
    })
    .filter((c) => c.fits)
    .sort((a, b) => b.coverage - a.coverage || a.block.localeCompare(b.block));
}

export function buildPlan({ run, adapter, specs, catalog, allowsGeneratedBlocks = true }) {
  const sections = specs.map((spec) => {
    const base = { spec: spec.id, kind: spec.kind };
    if (spec.chrome) return { ...base, candidates: [], decision: { action: 'skip', block: null, confidence: 1, reason: 'site chrome (header, footer or navigation) is not page content' } };
    const connected = spec.codeConnect?.block && catalog.find((b) => b.name === spec.codeConnect.block);
    if (connected) return { ...base, candidates: [], decision: { action: 'fill', block: connected.name, confidence: 1, reason: `Code Connect maps ${spec.codeConnect.component ?? 'the Figma component'} to this block` } };
    const candidates = candidatesFor(spec, catalog);
    if (!candidates.length) {
      return { ...base, candidates, decision: allowsGeneratedBlocks
        ? { action: 'scaffold', block: null, confidence: 1, reason: 'no block in the catalog can hold these slots' }
        : { action: 'gap', block: null, confidence: 1, reason: 'no block fits and this target does not allow generated blocks' } };
    }
    return { ...base, candidates, decision: null };
  });
  return { run, adapter, threshold: THRESHOLD, sections };
}

export function checkPlan(plan, catalog, { allowsGeneratedBlocks = true } = {}) {
  const errors = [];
  const names = new Set(catalog.map((b) => b.name));
  for (const s of plan.sections ?? []) {
    const d = s.decision;
    const at = `section ${s.spec}`;
    if (!d) { errors.push(`${at}: no decision yet (judge the candidates)`); continue; }
    if (!ACTIONS.has(d.action)) { errors.push(`${at}: unknown action "${d.action}"`); continue; }
    if (!d.reason) errors.push(`${at}: decision needs a reason`);
    if (d.action === 'ask') errors.push(`${at}: waiting for the person to choose`);
    if (d.action === 'scaffold' && !allowsGeneratedBlocks) errors.push(`${at}: this target does not allow generated blocks; use "gap"`);
    if (d.action !== 'fill') continue;
    if (!names.has(d.block)) { errors.push(`${at}: block "${d.block}" is not in the catalog`); continue; }
    if (s.candidates?.length && !s.candidates.some((c) => c.block === d.block) && d.approvedBy !== 'person') errors.push(`${at}: "${d.block}" did not pass the compatibility filter`);
    else if ((d.confidence ?? 0) < plan.threshold && d.approvedBy !== 'person') errors.push(`${at}: confidence ${d.confidence} is below ${plan.threshold}; ask the person and set approvedBy: "person"`);
  }
  return errors;
}

const cell = (v) => String(v).replace(/\|/g, '\\|');

export function formatPlan(plan) {
  const lines = [
    `# Match plan: ${plan.run}`,
    '',
    `Adapter: \`${plan.adapter}\`. Confidence threshold: ${plan.threshold}. Nothing is emitted until this plan is approved.`,
    '',
    '| Section | Kind | Action | Block | Confidence | Reason |',
    '|---|---|---|---|---|---|',
  ];
  for (const s of plan.sections) {
    const d = s.decision;
    const reason = d?.reason ?? `candidates: ${s.candidates.map((c) => `${c.block} (${c.coverage})`).join(', ') || 'none'}`;
    lines.push(`| ${s.spec} | ${s.kind} | ${d?.action ?? 'judge'} | ${d?.block ?? '-'} | ${d?.confidence ?? '-'} | ${cell(reason)} |`);
  }
  return `${lines.join('\n')}\n`;
}
```

**Step 4: Implement the shared context loader**

```js
// plugins/kivo-creator/scripts/lib/context.mjs
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveStack } from './stack.mjs';
import { selectAdapter } from '../adapters/index.mjs';
import { loadTheme } from './tokens.mjs';

/** Stack, adapter, catalog and theme for a project (stackFile = kivo-wise detector JSON). */
export async function loadContext({ project = '.', stack: stackFile = '' } = {}) {
  const detection = stackFile ? JSON.parse(readFileSync(resolve(stackFile), 'utf8')) : null;
  const stack = resolveStack(project, { detection });
  const adapter = await selectAdapter(stack);
  const cssPath = adapter.themeCss(stack);
  return { stack, adapter, catalog: adapter.catalog(stack), theme: loadTheme(cssPath ? readFileSync(cssPath, 'utf8') : ''), cssPath };
}
```

**Step 5: Implement the CLI**

```js
#!/usr/bin/env node
// plugins/kivo-creator/scripts/match.mjs
/**
 * match.mjs: build or check the match plan of a run.
 *   node scripts/match.mjs --catalog [--project=.] [--stack=<detector.json>]   print the block catalog
 *   node scripts/match.mjs --run=.creator/<run> [--project=.] [--force]        write match-plan.json/.md
 *   node scripts/match.mjs --run=.creator/<run> --check [--project=.]          validate decisions, refresh .md
 */
import { existsSync, writeFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { loadContext } from './lib/context.mjs';
import { buildPlan, checkPlan, formatPlan } from './lib/match.mjs';
import { readSpecs, checkSpec } from './lib/spec.mjs';
import { readJson, runPaths, writeJson } from './lib/run.mjs';

export async function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '', stack: '', check: false, catalog: false, force: false });
  const ctx = await loadContext(o);
  if (o.catalog) { console.log(JSON.stringify(ctx.catalog, null, 2)); return; }
  if (!o.run) throw new Error('usage: match.mjs --run=<.creator/run> [--check] [--force] [--project=.] | --catalog');
  const runDir = resolve(o.run);
  const paths = runPaths(runDir);
  if (o.check) {
    const plan = readJson(paths.plan);
    writeFileSync(paths.planMd, formatPlan(plan));
    const errors = checkPlan(plan, ctx.catalog, { allowsGeneratedBlocks: ctx.adapter.allowsGeneratedBlocks });
    if (errors.length) { for (const e of errors) console.error(e); process.exitCode = 1; return; }
    console.log(`match plan ok: ${plan.sections.length} sections`);
    return;
  }
  if (existsSync(paths.plan) && !o.force) throw new Error(`${relative(process.cwd(), paths.plan)} exists; edit it and run --check, or pass --force to rebuild it`);
  const specs = readSpecs(paths.specs);
  if (!specs.length) throw new Error(`no specs in ${relative(process.cwd(), paths.specs)}`);
  for (const spec of specs) {
    const errors = checkSpec(spec);
    if (errors.length) throw new Error(`invalid spec ${spec.id}: ${errors.join('; ')}`);
  }
  const plan = buildPlan({ run: basename(runDir), adapter: ctx.adapter.name, specs, catalog: ctx.catalog, allowsGeneratedBlocks: ctx.adapter.allowsGeneratedBlocks });
  writeJson(paths.plan, plan);
  writeFileSync(paths.planMd, formatPlan(plan));
  console.log(JSON.stringify({ plan: relative(process.cwd(), paths.plan), judge: plan.sections.filter((s) => !s.decision).map((s) => s.spec) }, null, 2));
}

runCli(import.meta.url, main);
```

**Step 6: Run the test**

Run: `node --test test/creator/match.test.mjs`
Expected: PASS (`pass 5`, `fail 0`)

**Step 7: Commit**

```bash
git add plugins/kivo-creator/scripts/lib/match.mjs plugins/kivo-creator/scripts/lib/context.mjs plugins/kivo-creator/scripts/match.mjs test/creator/match.test.mjs
git commit -m "feat(kivo-creator): build and check the match plan"
```

---

### Task 28: `emit.mjs`

**Files:**
- Create: `plugins/kivo-creator/scripts/emit.mjs`
- Test: `test/creator/emit.test.mjs`

**Step 1: Write the failing test**

```js
// test/creator/emit.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { FIX, PLUGIN, tmpCopy } from './helpers.mjs';

function prepare(decisions) {
  const project = tmpCopy(join(FIX, 'projects', 'acme-mu-plugin'));
  const run = join(project, '.creator', 'run-1');
  mkdirSync(run, { recursive: true });
  cpSync(join(FIX, 'runs', 'landing', 'specs'), join(run, 'specs'), { recursive: true });
  const sections = Object.entries(decisions).map(([spec, decision]) => ({ spec, kind: spec.split('-')[1], candidates: [], decision }));
  writeFileSync(join(run, 'match-plan.json'), JSON.stringify({ run: 'run-1', adapter: 'acorn-mu-plugin', threshold: 0.6, sections }));
  return { project, run };
}
const emit = (project, run) => spawnSync(process.execPath, [join(PLUGIN, 'scripts', 'emit.mjs'), `--project=${project}`, `--run=${run}`], { encoding: 'utf8' });

test('fills existing blocks, scaffolds the gap under .creator and records what to do next', () => {
  const { project, run } = prepare({
    '01-hero': { action: 'fill', block: 'acf/hero', confidence: 0.9, reason: 'hero' },
    '02-faq': { action: 'fill', block: 'acf/faq', confidence: 0.8, reason: 'faq' },
    '03-testimonial': { action: 'gap', block: null, confidence: 1, reason: 'no testimonial block; asked to skip' },
    '04-stats': { action: 'scaffold', block: null, confidence: 1, reason: 'no stats block' },
  });
  const res = emit(project, run);
  assert.equal(res.status, 0, res.stderr);
  const page = readFileSync(join(run, 'page.html'), 'utf8');
  assert.deepEqual(page.match(/<!-- wp:acf\/[\w-]+/g), ['<!-- wp:acf/hero', '<!-- wp:acf/faq', '<!-- wp:acf/stats']);
  const emitted = JSON.parse(readFileSync(join(run, 'emitted.json'), 'utf8'));
  assert.deepEqual(emitted.commands, ['acf:block Stats --no-interaction']);
  assert.deepEqual(emitted.files.map((f) => f.target), [
    'wp-content/mu-plugins/acme-core/app/Blocks/Stats.php',
    'wp-content/mu-plugins/acme-core/resources/views/blocks/stats.blade.php',
    'wp-content/mu-plugins/acme-core/resources/css/blocks/stats.css',
  ]);
  assert.ok(existsSync(join(project, emitted.files[0].scaffold)));
  assert.ok(!existsSync(join(project, emitted.files[0].target)), 'emit never writes into the project');
  assert.deepEqual(emitted.gaps, [{ spec: '03-testimonial', reason: 'no testimonial block; asked to skip' }]);
  assert.equal(emitted.media.length, 1);
  assert.deepEqual(emitted.proposals.map((p) => p.suggested), ['--text-body']);
});

test('refuses a plan that does not pass --check', () => {
  const { project, run } = prepare({ '01-hero': null });
  const res = emit(project, run);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /no decision yet/);
});
```

**Step 2: Run it to see it fail**

Run: `node --test test/creator/emit.test.mjs`
Expected: FAIL with `Cannot find module '.../scripts/emit.mjs'` in stderr (status 1).

**Step 3: Implement**

```js
#!/usr/bin/env node
// plugins/kivo-creator/scripts/emit.mjs
/**
 * emit.mjs: turn an approved match plan into page markup and scaffolded
 * blocks. Writes ONLY under .creator/<run>/: page.html, scaffold/<project
 * paths>, emitted.json. Copying scaffold files into the project is a reviewed
 * step of the block-scaffolding-from-design skill, after the project's
 * generator ran.
 *
 * Usage: node scripts/emit.mjs --run=.creator/<run> [--project=.] [--stack=<detector.json>]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { loadContext } from './lib/context.mjs';
import { checkPlan } from './lib/match.mjs';
import { assign } from './lib/fill.mjs';
import { readSpecs } from './lib/spec.mjs';
import { readJson, runPaths, writeJson } from './lib/run.mjs';

const posix = (p) => p.split('\\').join('/');

export async function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '', stack: '' });
  if (!o.run) throw new Error('usage: emit.mjs --run=<.creator/run> [--project=.]');
  const ctx = await loadContext(o);
  const project = resolve(o.project);
  const runDir = resolve(o.run);
  const paths = runPaths(runDir);
  const plan = readJson(paths.plan);
  const errors = checkPlan(plan, ctx.catalog, { allowsGeneratedBlocks: ctx.adapter.allowsGeneratedBlocks });
  if (errors.length) throw new Error(`the match plan is not approved yet:\n${errors.join('\n')}`);
  const specs = new Map(readSpecs(paths.specs).map((s) => [s.id, s]));
  const catalog = [...ctx.catalog];
  const entries = [];
  const out = { adapter: ctx.adapter.name, page: posix(relative(project, paths.page)), files: [], commands: [], media: [], gaps: [], proposals: [], notes: [] };
  for (const section of plan.sections) {
    const spec = specs.get(section.spec);
    const d = section.decision;
    if (!spec) throw new Error(`plan names ${section.spec}, which has no spec`);
    if (d.action === 'skip') continue;
    if (d.action === 'gap') { out.gaps.push({ spec: spec.id, reason: d.reason }); continue; }
    if (d.action === 'fill') {
      const block = catalog.find((b) => b.name === d.block);
      entries.push({ block, spec, pairs: assign(spec.slots, block.fields).pairs });
      continue;
    }
    const made = ctx.adapter.scaffoldBlock(ctx.stack, spec, { theme: ctx.theme, catalog });
    if (made.gap) { out.gaps.push({ spec: spec.id, reason: made.gap }); continue; }
    catalog.push(made.block);
    entries.push({ block: made.block, spec, pairs: assign(spec.slots, made.block.fields).pairs });
    out.commands.push(...made.commands);
    out.notes.push(...made.notes);
    out.proposals.push(...made.proposals.map((p) => ({ spec: spec.id, ...p })));
    for (const file of made.files) {
      const scaffold = join(paths.scaffold, file.path);
      mkdirSync(dirname(scaffold), { recursive: true });
      writeFileSync(scaffold, file.content);
      out.files.push({ target: file.path, scaffold: posix(relative(project, scaffold)) });
    }
  }
  const { markup, media } = ctx.adapter.emitPage(ctx.stack, entries);
  writeFileSync(paths.page, markup);
  out.media = media;
  writeJson(paths.emitted, out);
  console.log(JSON.stringify({ page: out.page, blocks: entries.length, scaffolded: out.files.length, gaps: out.gaps.length, commands: out.commands }, null, 2));
}

runCli(import.meta.url, main);
```

**Step 4: Run the test**

Run: `node --test test/creator/emit.test.mjs`
Expected: PASS (`pass 2`, `fail 0`)

**Step 5: Run the whole suite**

Run: `node --test test/creator/`
Expected: `fail 0`

**Step 6: Commit**

```bash
git add plugins/kivo-creator/scripts/emit.mjs test/creator/emit.test.mjs
git commit -m "feat(kivo-creator): emit page markup and scaffolded blocks into the run folder"
```

---

### Task 29: Skills `html-ingest` and `section-matching`

Skills hold the procedure; every number or file they produce comes from a script. Follow the contract enforced by `scripts/validate-skills.mjs` (see "Read this first").

**Files:**
- Create: `plugins/kivo-creator/skills/html-ingest/SKILL.md`
- Create: `plugins/kivo-creator/skills/section-matching/SKILL.md`
- Modify: `.github/workflows/ci.yml` (skill validation step)

**Step 1: Run the validator to see it has nothing to validate**

Run: `node scripts/validate-skills.mjs --root plugins/kivo-creator`
Expected: the three manifests are checked and no skill is listed (0 skills).

**Step 2: Write `html-ingest`**

````markdown
---
name: html-ingest
description: Use when an HTML file, a URL or a published page has to become kivo-creator section specs - rendering it at 390 and 1440 px with the project's own Playwright, splitting it into sections, recording text slots, links, media, computed styles and one reference screenshot per section and width under .creator/<run>/. For a Figma source use figma-ingest; for choosing blocks use section-matching.
license: MIT
compatibility: Node 20+ and Playwright installed in the target project (kivo-creator ships no dependencies). Read-only towards the project; writes only under .creator/.
---

# HTML ingest

Turn a page into neutral section specs. The script does the rendering and the measuring; you review the split and fix it before anything is matched.

## When to use

- "Convert this page / this HTML / this URL into our blocks", "migrate this landing page".
- A `/creator` run whose source is a `.html` file or an `http(s)` URL.
- Not for Figma links (`figma-ingest`), not for choosing blocks (`section-matching`).

## Inputs required

1. The source: a local `.html` file or an `http(s)` URL that the machine can reach.
2. The target project root, with `.roots-stack.json` (kivo-wise `/roots-detect --write`) or the kivo-wise detector JSON.
3. Playwright in the project: `node_modules/playwright` or `@playwright/test`, with Chromium installed (`npx playwright install chromium`). Run the script where the project's own end-to-end tests run Playwright (usually the host); it is a read-only browser run, not a WordPress, Composer or PHP command.
4. The kivo-creator plugin root: the folder that holds `skills/`, `scripts/` and `schemas/` (two levels above this skill's folder).

## Procedure

1. From the project root run:

   ```bash
   node <kivo-creator>/scripts/ingest-html.mjs --source=<file.html | https://...> --project=.
   ```

   Exit 3 means Playwright is missing in the project: show the printed install hint and stop. Never install it without asking.
2. Read the printed list of sections (`id`, `kind`, `chrome`). The split follows these rules (see `scripts/lib/segment.mjs`):
   - content root is `<main>`, else the body after unwrapping single wrappers;
   - `header`, `footer` and `nav` outside `<main>` are `chrome` (kept, never matched);
   - sections are the visible children of the root; pieces shorter than 80 px are merged into the previous section;
   - `kind` and `layout` are inferred; slot values and computed styles are exact.
3. Open every spec in `.creator/<run>/specs/` and compare it with the reference images in `refs/`. Fix by editing the JSON, never by guessing:
   - two designs merged into one section: split the slots into two specs (new `id`, `order`, same `source.ref` plus a note);
   - a wrapper picked as one section: move its children into separate specs;
   - a wrong `kind`: change it and add a note saying why;
   - a value you cannot see in the source: delete the slot. Never invent copy, colours or sizes.
4. Validate: `node <kivo-creator>/scripts/validate-spec.mjs .creator/<run>/specs`.
5. Hand over to `section-matching` with the run folder.

## Verification

- `validate-spec.mjs` prints `ok` for every spec.
- Every non-chrome spec has `refs` for 390 and 1440 (unless the element is hidden at one width; note it).
- The number of non-chrome specs equals the number of sections a person sees on the page.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Exit 3 and an install hint | Playwright not installed in the project | Ask the person; install it as a dev dependency with their package manager and `npx playwright install chromium` |
| Whole page is one section | No `<main>` and several wrappers with more than one child | Split the spec by hand (Procedure step 3) or ask for the right container |
| Missing section that appears after scrolling | Lazy content not rendered at `networkidle` | Ask for a static export of the page, or remove the lazy loading in a local copy before ingesting |
| `refs` missing for 390 | The section is hidden on mobile | Keep the spec; note it; verify only checks widths that have references |
| Wrong text in a slot (cookie banner, overlay) | The overlay is part of `<body>` | Delete the overlay's spec or slots; note the decision |

## Escalation

Stop and ask when the page needs a login, when the source is not reachable, or when the person disagrees with the section split and the right split is not visible in the references.
````

**Step 3: Write `section-matching`**

````markdown
---
name: section-matching
description: Use when kivo-creator section specs in .creator/<run>/specs must be mapped to the project's existing blocks before anything is generated - building the match plan, applying the compatibility filter, judging the remaining candidates with the written rubric (including an explicit none), asking the person below the confidence threshold and checking the plan. For ingesting a source use html-ingest or figma-ingest; for generating missing blocks use block-scaffolding-from-design.
license: MIT
compatibility: Node 20+. Reads the project's block catalog through the kivo-creator adapter; writes only .creator/<run>/match-plan.json and match-plan.md.
---

# Section matching

Recognise first, generate last. Each section is matched to a block the project already has; a new block is generated only when nothing fits. The plan is written to disk and approved before anything is emitted.

## When to use

- After `html-ingest` or `figma-ingest` produced valid specs.
- "Which of our blocks should this section use?", "map the design to our blocks".
- Not for writing block code (`block-scaffolding-from-design`) or checking the rendered page (`visual-fidelity`).

## Inputs required

1. The run folder `.creator/<run>/` with valid specs.
2. The project root with `.roots-stack.json`, or the kivo-wise detector JSON passed with `--stack=<file>`.
3. The kivo-creator plugin root (two levels above this skill's folder).

## Procedure

1. Read the catalog: `node <kivo-creator>/scripts/match.mjs --catalog --project=.` (name, title, description, `whenToUse`, fields).
2. Build the plan: `node <kivo-creator>/scripts/match.mjs --run=.creator/<run> --project=.`. It writes `match-plan.json` and prints the sections to `judge`. Already decided by the script:
   - chrome sections: `skip`;
   - a Code Connect mapping (`spec.codeConnect.block`): `fill` with confidence 1;
   - no block passes the compatibility filter: `scaffold` (or `gap` when the target forbids generated blocks).
3. For each section in `judge`, read its spec, its reference image and its `candidates` (blocks whose fields can hold every slot, ranked by field coverage). Score each candidate with the rubric, then write the decision into `match-plan.json`:

   | Criterion | Question | Weight |
   |---|---|---|
   | Purpose | Do the block's description and `whenToUse` describe this kind of section? | Decisive: a block built for another purpose is never a match, even when its fields fit |
   | Structure | Do the slots and the repeat count fit without dropping content? Unused optional fields are fine | High |
   | Layout | Can the block show the media position and column count (styles, variants)? | Medium |
   | Cost of a new block | Would a new block duplicate one that only needs a style variant or one field? | Tie-breaker |

   Always consider `none`: when the only candidates serve another purpose (a testimonial fits a hero's fields but is not a hero), choose `scaffold` with `block: null`.

   Decision shape:

   ```json
   { "action": "fill", "block": "acf/faq", "confidence": 0.85, "reason": "Questions and answers; the questions repeater holds the three items" }
   ```

   Confidence: 0.9 or more when purpose and structure are clear; 0.6 to 0.9 with a caveat written in `reason`; below the plan's `threshold` (0.6) set `"action": "ask"` and ask the person.
4. Ask the person about every `ask` decision, listing the candidates and `none`. Record the answer as the decision with `"approvedBy": "person"`.
5. Check: `node <kivo-creator>/scripts/match.mjs --run=.creator/<run> --check --project=.`. Fix every error it prints and run it again.
6. Show `match-plan.md` and stop. Emitting happens only after the person approves the plan.

## Verification

- `match.mjs --check` exits 0 and prints `match plan ok`.
- Every `fill` names a block from the catalog that is among the section's candidates (or was approved by the person).
- Every `scaffold` or `gap` has a reason a person can accept without opening the files.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Every section goes to `scaffold` | Catalog empty: blocks live outside the adapter's folder or are not ACF Composer classes | Run `--catalog`; if blocks are missing, check the profile in `.roots-stack.json` and the block folder |
| A good block is missing from `candidates` | A slot type its fields cannot hold (for example an image slot and no image field) | Decide whether the slot matters; dropping it is the person's call, never yours |
| `did not pass the compatibility filter` | A fill names a block that cannot hold all slots | Pick a candidate, or ask the person and record `approvedBy` |
| `confidence ... is below 0.6` | A low-confidence fill without approval | Ask the person; record `approvedBy: "person"` |
| Same block chosen for two different purposes | Purpose criterion skipped | Re-score with the rubric; purpose is decisive |

## Escalation

Ask the person whenever the decision is below the threshold, when two candidates are equally good, or when the right answer is a new style variant of an existing block instead of a new block.
````

**Step 4: Validate**

Run: `node scripts/validate-skills.mjs --root plugins/kivo-creator`
Expected: `✓ skills/html-ingest/SKILL.md` and `✓ skills/section-matching/SKILL.md`, no `✗` lines, exit 0. A warning about the description is acceptable only if it is the negative-routing recommendation; both descriptions end with "For … use …".

**Step 5: Add the CI step**

In `.github/workflows/ci.yml`, job `validate`, after `Validate skills against the contract (C3)`:

```yaml
      - name: Validate kivo-creator skills against the contract
        run: node scripts/validate-skills.mjs --root plugins/kivo-creator
```

**Step 6: Commit**

```bash
git add plugins/kivo-creator/skills .github/workflows/ci.yml
git commit -m "feat(kivo-creator): add the html-ingest and section-matching skills"
```

---

### Task 30: Skills `block-scaffolding-from-design` and `visual-fidelity`

**Files:**
- Create: `plugins/kivo-creator/skills/block-scaffolding-from-design/SKILL.md`
- Create: `plugins/kivo-creator/skills/visual-fidelity/SKILL.md`

**Step 1: Write `block-scaffolding-from-design`**

````markdown
---
name: block-scaffolding-from-design
description: Use when an approved kivo-creator match plan must be emitted - writing the page as block markup, scaffolding the blocks that were missing in the project's conventions (run the project's generator first, then review and copy the prepared files), turning unmatched design values into token proposals and importing media. For deciding which block a section uses use section-matching; for checking the rendered result use visual-fidelity.
license: MIT
compatibility: Node 20+. Project commands go through the runner from the kivo-wise session context. emit.mjs writes only under .creator/<run>/.
---

# Block scaffolding from design

Emit an approved plan. Existing blocks are filled; missing blocks are generated with the project's own generator and then completed with files prepared from the spec.

Runner placeholders (`{{runner.wp}}`, `{{runner.acorn}}`, `{{runner.cache}}`) come from the kivo-wise session context. Never run `wp`, `composer`, `php` or `npm` on the host.

## When to use

- The person approved `match-plan.md`.
- "Generate the missing blocks", "build the page from the plan".
- Not for changing the plan (`section-matching`) or judging the result (`visual-fidelity`).

## Inputs required

1. `.creator/<run>/match-plan.json` that passes `match.mjs --check`.
2. The project root and its runner (session context).
3. The kivo-creator plugin root (two levels above this skill's folder).

## Procedure

1. Emit: `node <kivo-creator>/scripts/emit.mjs --run=.creator/<run> --project=.`. It writes `page.html` (block markup), `scaffold/<project paths>` and `emitted.json` (`files`, `commands`, `media`, `gaps`, `proposals`, `notes`). Nothing in the project changes yet.
2. Token proposals first. Show `emitted.proposals` (value, role, suggested token). Add a token to the `@theme` block only when the person agrees, then run step 1 again so the views use the new utility. Never put a literal value or an arbitrary class (`text-[13px]`) in markup to avoid this step.
3. For each new block, in order:
   1. run the project's generator with the runner, exactly as listed in `emitted.commands` (for example `{{runner.acorn}} acf:block Stats --no-interaction`);
   2. show the difference between the generated files and `scaffold/<path>` as a diff;
   3. check what the prepared view assumes: the Blade directives it uses (for example `@textarea`) must exist in the project; if one does not, ask before changing the escaping;
   4. copy the reviewed files over the generated ones.
4. Rebuild caches: `{{runner.acorn}} acf:cache` (or `{{runner.cache}}`) so ACF Composer picks up the new fields.
5. Media: for each `emitted.media` entry, import the file (`{{runner.wp}} media import <src> --porcelain`) and put the attachment id in place of `null` for that field in `page.html`. Ask before importing remote files you do not recognise.
6. Run the project's own checks on the new files (code style, static analysis, tests), as the project defines them.
7. Report: blocks filled, blocks created (with paths), gaps with their reasons, tokens added or still proposed, media imported. Then hand over to `visual-fidelity`.

## Verification

- `git status` shows only the new block files, the `@theme` lines the person approved and nothing else.
- The project's checks pass on the new files.
- `page.html` has no `null` image ids left, or the report lists each one.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `the match plan is not approved yet` | Open, low-confidence or invalid decisions | Go back to `section-matching` |
| Generator command not found | The project has no ACF Composer generator or uses its own stubs | Run `{{runner.acorn}} list`; use the project's generator; if there is none, ask before creating files by hand |
| New fields missing in the editor | ACF Composer manifest not rebuilt | `{{runner.acorn}} acf:cache` (or `{{runner.cache}}`) |
| A view uses a directive the project lacks | The prepared view follows the kivo-wise escaping rules | Ask; do not swap in a different escaping on your own |
| A proposal keeps coming back | The token was added under another name or namespace | Use the suggested namespace (`--color-*`, `--text-*`) so the mapper finds it |

## Escalation

Ask before adding any `@theme` token, before importing media from an unknown host, and whenever a generated block would duplicate an existing one with a different style.
````

**Step 2: Write `visual-fidelity`**

````markdown
---
name: visual-fidelity
description: Use when a page emitted by kivo-creator must be proved against its design - rendering the block markup on the local site, screenshotting every section at 390 and 1440 px with the project's Playwright, pixel diff against the references (2 percent per section by default), style check of exact values, lint for arbitrary values and inline styles, and up to three fix rounds before handing the report to the person. For emitting the page use block-scaffolding-from-design.
license: MIT
compatibility: Node 20+ and Playwright in the target project. Creates a local page through the runner; never on a shared or production site.
---

# Visual fidelity

Prove fidelity with numbers. `verify.mjs` produces `fidelity.md`; you fix what it reports, at most three rounds.

## When to use

- After `block-scaffolding-from-design`, or after any change to a block used by a `/creator` page.
- "Does it match the design?", "verify the page".
- Not for choosing blocks or writing them.

## Inputs required

1. `.creator/<run>/` with `page.html`, `emitted.json`, specs and references.
2. The local site URL and runner (session context). Local development only.
3. Playwright in the project (same as `html-ingest`).
4. The kivo-creator plugin root (two levels above this skill's folder).

## Procedure

1. Put the page on the local site:

   ```bash
   {{runner.wp}} post create .creator/<run>/page.html --post_type=page --post_status=publish --post_title="creator <run>" --post_name=creator-<run> --porcelain
   ```

   Keep the printed id. Get the URL with `{{runner.wp}} post list --post__in=<id> --post_type=page --field=url`.
2. Verify:

   ```bash
   node <kivo-creator>/scripts/verify.mjs --run=.creator/<run> --url=<page url> --project=.
   ```

   Defaults: widths 390 and 1440, threshold 0.02, selector `[data-block]` (scaffolded blocks print it). If existing blocks do not print `data-block`, pass `--selector` with the wrapper they do print, and say so in the report.
3. Read `.creator/<run>/fidelity.md` and the diff images in `verify/` (red pixels = different).
4. Fix, smallest cause first: a wrong token or utility, a missing field value, spacing from the wrong scale step, an image not imported. Never fix a diff with an arbitrary value, an inline style or a hard-coded string.
5. Update the page (`{{runner.wp}} post update <id> .creator/<run>/page.html`) when `page.html` changed, then run step 2 again. Stop after three rounds.
6. Hand `fidelity.md` to the person with what was fixed and what is left. Delete the page afterwards when the person agrees (`{{runner.wp}} post delete <id> --force`).

## Verification

- `verify.mjs` exits 0 (`PASS`), or the person accepted the remaining rows after round three.
- The lint section of `fidelity.md` says `None.`

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `found N elements for [data-block]` | Existing blocks do not print `data-block`, or a block renders twice | Pass `--selector`; check nested blocks |
| Every row is `no reference` | Figma source without `FIGMA_TOKEN` for references | Run `figma-ref.mjs` with a token, or accept a style-and-lint-only report |
| Large diff on image areas only | Media not imported (ids still `null`) | Import media (block-scaffolding-from-design step 5) |
| `size differs` on every row | Fonts not loaded, or a different container width | Load the project's fonts on the page; compare with the right template |
| Style mismatch on font size at 1440 | A token maps to the wrong step | Fix the token mapping or ask for a new token |

## Escalation

After three rounds, or when a fix needs a design decision (a new token, a new variant, changing a shared block), stop and hand the report to the person.
````

**Step 3: Validate**

Run: `node scripts/validate-skills.mjs --root plugins/kivo-creator`
Expected: four `✓` lines, exit 0.

**Step 4: Commit**

```bash
git add plugins/kivo-creator/skills
git commit -m "feat(kivo-creator): add the scaffolding and visual fidelity skills"
```

---

### Task 31: `/creator` command skill (stops at the match plan)

The design calls `/creator` a command. Claude Code recommends skills over `commands/` for new plugins, so it is a skill with `disable-model-invocation: true` (only the person starts it), invoked as `/kivo-creator:creator`.

**Files:**
- Create: `plugins/kivo-creator/skills/creator/SKILL.md`

**Step 1: Write the skill**

````markdown
---
name: creator
description: Use when the person runs the creator command to turn a Figma frame, an HTML file or a URL into a WordPress page on the Roots stack - routes the source, runs the ingest, builds and checks the match plan, and stops for approval before anything is emitted. Resumes a run with --run=.creator/<run>. For one step on its own use html-ingest, figma-ingest, section-matching, block-scaffolding-from-design or visual-fidelity.
disable-model-invocation: true
license: MIT
compatibility: Requires the kivo-wise plugin (stack detection, runner context). Node 20+; Playwright in the target project for HTML sources and verification; the official Figma MCP server for Figma sources.
---

# /creator

Arguments: `<figma.com URL | file.html | https URL>` or `--run=.creator/<run>` to resume.

## When to use

- The person typed the command with a source or a run folder.
- Never start it on your own; the individual skills cover single steps.

## Inputs required

1. A source (Figma frame URL with `node-id`, an `.html` file or an `http(s)` URL), or an existing run folder.
2. The target stack: `.roots-stack.json` at the project root. If it is missing, run kivo-wise `/roots-detect --write` first (or ask the person).
3. The kivo-creator plugin root (two levels above this skill's folder).

## Procedure

1. **Route the source.** `figma.com/design/...` or `figma.com/file/...` → `figma-ingest`. A path ending in `.html` or an `http(s)` URL → `html-ingest`. `--run=` → skip to step 3 with that folder. Anything else: ask. There is no fallback: if the Figma MCP server is missing, stop with the instructions from `figma-ingest`.
2. **Ingest** with the routed skill. It ends with valid specs in `.creator/<run>/specs/`.
3. **Match** with `section-matching` until `node <kivo-creator>/scripts/match.mjs --run=.creator/<run> --check --project=.` passes.
4. **Stop.** Show `.creator/<run>/match-plan.md`, the gaps and any question still open, and ask the person to approve the plan. Do not emit, scaffold or edit project files in this turn.
5. After the person approves (a later message): `block-scaffolding-from-design`, then `visual-fidelity` (at most three fix rounds). Finish with the fidelity report.

## Verification

- At the stop point the working tree of the project is unchanged apart from `.creator/` (`git status`).
- `match.mjs --check` passes on the plan you show.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| No profile found | No `.roots-stack.json` and no detector output | Run kivo-wise `/roots-detect --write`, then resume with `--run=` |
| Figma tools unavailable | The Figma MCP server is not connected in this session | Stop; follow the connection steps in `figma-ingest` |
| Plan check fails | Open or invalid decisions | Finish `section-matching` before stopping |
| Files appear in the project before approval | Emit started too early | Revert them; emitting waits for approval |

## Escalation

Every run stops at the match plan for the person's approval. Ask again before emitting if the plan changed after it was approved.
````

**Step 2: Validate**

Run: `node scripts/validate-skills.mjs --root plugins/kivo-creator`
Expected: five `✓` lines, exit 0.

Run: `claude plugin validate plugins/kivo-creator --strict`
Expected: `✔ Validation passed`

**Step 3: Commit**

```bash
git add plugins/kivo-creator/skills/creator
git commit -m "feat(kivo-creator): add the /creator command skill that stops at the match plan"
```

---

### Task 32: Eval staging and the phase 1 evals

**Files:**
- Create: `scripts/build-creator-eval.mjs` (repository root, development only, not shipped)
- Test: `test/creator/build-creator-eval.test.mjs`
- Create: `plugins/kivo-creator/evals/match-plan-judgment/{case.yaml,prompt.md,scaffold.sh,graders/*.md}`
- Create: `plugins/kivo-creator/evals/match-none/…`, `plugins/kivo-creator/evals/scaffold-no-arbitrary/…`, `plugins/kivo-creator/evals/creator-stops-at-plan/…`
- Create: `plugins/kivo-creator/evals/scaffold-no-arbitrary/plan.json`

**Step 1: Write the failing test for the staging script**

```js
// test/creator/build-creator-eval.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stage } from '../../scripts/build-creator-eval.mjs';
import { PLUGIN, readJson } from './helpers.mjs';

test('stages a copy without dependencies, with the Figma server declared and the fixtures inside evals/', () => {
  const out = stage(mkdtempSync(join(tmpdir(), 'stage-')));
  const manifest = readJson(join(out, '.claude-plugin', 'plugin.json'));
  assert.equal(manifest.dependencies, undefined);
  assert.deepEqual(readJson(join(out, '.mcp.json')), { mcpServers: { figma: { type: 'http', url: 'https://mcp.figma.com/mcp' } } });
  assert.ok(existsSync(join(out, 'evals', 'fixtures', 'projects', 'acme-mu-plugin', '.roots-stack.json')));
  assert.deepEqual(readJson(join(PLUGIN, '.claude-plugin', 'plugin.json')).dependencies, ['kivo-wise'], 'source untouched');
  assert.ok(!existsSync(join(PLUGIN, '.mcp.json')), 'the shipped plugin declares no MCP server');
});
```

**Step 2: Run it to see it fail**

Run: `node --test test/creator/build-creator-eval.test.mjs`
Expected: FAIL with `Cannot find module '.../scripts/build-creator-eval.mjs'`

**Step 3: Write the staging script**

```js
#!/usr/bin/env node
// scripts/build-creator-eval.mjs
/**
 * Stage plugins/kivo-creator for `claude plugin eval`.
 *
 * Why a staged copy:
 *  1. A declared marketplace dependency (kivo-wise) stops the plugin loading
 *     inside the eval sandbox, so the copy drops `dependencies`.
 *  2. Eval mocks only stand in for MCP servers the plugin declares, so the copy
 *     declares the official Figma server as `figma`. A case without mock files
 *     for it gets no server at all: that is the "Figma MCP missing" case.
 *  3. Runs cannot read the eval folder; scaffold scripts copy fixtures from
 *     evals/fixtures, staged here from test/fixtures/creator.
 *
 * Usage: node scripts/build-creator-eval.mjs [--out=.creator-eval]
 * Then:  claude plugin eval .creator-eval/kivo-creator --scaffold --allow-tools Bash Write Edit
 */
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'plugins', 'kivo-creator');

export function stage(outBase) {
  const out = join(resolve(outBase), 'kivo-creator');
  rmSync(out, { recursive: true, force: true });
  cpSync(SOURCE, out, { recursive: true, filter: (p) => !p.includes(`${sep}evals${sep}results`) });
  const manifestPath = join(out, '.claude-plugin', 'plugin.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  delete manifest.dependencies;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(out, '.mcp.json'), `${JSON.stringify({ mcpServers: { figma: { type: 'http', url: 'https://mcp.figma.com/mcp' } } }, null, 2)}\n`);
  cpSync(join(ROOT, 'test', 'fixtures', 'creator'), join(out, 'evals', 'fixtures'), { recursive: true });
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = process.argv.slice(2).find((a) => a.startsWith('--out='));
  const out = stage(arg ? arg.slice(6) : join(ROOT, '.creator-eval'));
  console.log(`staged ${relative(ROOT, out)}\nrun: claude plugin eval ${relative(ROOT, out)} --scaffold --allow-tools Bash Write Edit`);
}
```

**Step 4: Run the test**

Run: `node --test test/creator/build-creator-eval.test.mjs`
Expected: PASS (`pass 1`, `fail 0`)

**Step 5: Write the eval cases**

Every case folder holds `case.yaml`, `prompt.md`, `scaffold.sh` (executable: `chmod +x`) and `graders/`. The scaffold seeds the acme mu-plugin project and a run folder.

`plugins/kivo-creator/evals/match-plan-judgment/case.yaml`:

```yaml
schema_version: '1.1'
name: match-plan-judgment
context:
  scaffold_script: scaffold.sh
```

`plugins/kivo-creator/evals/match-plan-judgment/scaffold.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
fx="$(cd "$(dirname "$0")/../fixtures" && pwd)"
cp -R "$fx/projects/acme-mu-plugin/." .
mkdir -p .creator/run-1/specs
printf '*\n' > .creator/.gitignore
cp "$fx/runs/landing/specs/01-hero.json" "$fx/runs/landing/specs/02-faq.json" .creator/run-1/specs/
```

`plugins/kivo-creator/evals/match-plan-judgment/prompt.md`:

```markdown
---
description: The faq section fits two blocks structurally; the plan must pick acf/faq by purpose and acf/hero for the hero
tags: [skill, section-matching]
max_turns: 25
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]
---

Our landing page was already ingested into .creator/run-1 (specs only). Build the match plan against our existing blocks, make sure it passes its check, and stop there. Do not generate blocks or emit anything.
```

`graders/skill-fired.md`:

```markdown
---
type: tool_used
tool: Skill
input_match: '"skill"\s*:\s*"(?:[\w-]+:)?section-matching"'
---
```

`graders/faq-by-purpose.md`:

```markdown
---
type: regex
target: { source: file, path: .creator/run-1/match-plan.json }
pattern: '"decision":\s*\{[^}]*"block":\s*"acf/faq"'
weight: 2
---
```

`graders/hero.md`:

```markdown
---
type: regex
target: { source: file, path: .creator/run-1/match-plan.json }
pattern: '"decision":\s*\{[^}]*"block":\s*"acf/hero"'
---
```

`graders/check-ran.md`:

```markdown
---
type: tool_used
tool: Bash
input_match: 'match\.mjs[^"]*--check'
---
```

`graders/no-emit.md`:

```markdown
---
type: tool_used
tool: Bash
input_match: 'emit\.mjs'
min: 0
max: 0
arm: both
---
```

`plugins/kivo-creator/evals/match-none/` uses the same `case.yaml` (with `name: match-none`) and this `scaffold.sh` (only the testimonial):

```bash
#!/usr/bin/env bash
set -euo pipefail
fx="$(cd "$(dirname "$0")/../fixtures" && pwd)"
cp -R "$fx/projects/acme-mu-plugin/." .
mkdir -p .creator/run-1/specs
printf '*\n' > .creator/.gitignore
cp "$fx/runs/landing/specs/03-testimonial.json" .creator/run-1/specs/
```

`prompt.md`:

```markdown
---
description: A testimonial fits the hero block's fields but not its purpose; the plan must say none (scaffold or ask), not acf/hero
tags: [skill, section-matching]
max_turns: 25
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]
---

Match the section in .creator/run-1 to one of our blocks and write the match plan. Stop at the plan.
```

`graders/none-chosen.md`:

```markdown
---
type: regex
target: { source: file, path: .creator/run-1/match-plan.json }
pattern: '"decision":\s*\{[^}]*"action":\s*"(scaffold|ask|gap)"'
weight: 2
---
```

`graders/not-hero.md`:

```markdown
---
type: regex
target: { source: file, path: .creator/run-1/match-plan.json }
pattern: '"decision":\s*\{[^}]*"block":\s*"acf/hero"'
match: not_contains
weight: 2
---
```

`graders/explains.md`:

```markdown
---
type: llm
focus: last_message
---
PASS if the reply says that the hero block can hold the fields but serves a different purpose (page opening, not a quote), and proposes a new block or asks the person. FAIL if it maps the testimonial to the hero block, or invents content that is not in the spec.
```

`plugins/kivo-creator/evals/scaffold-no-arbitrary/plan.json` (the approved plan the scaffold seeds):

```json
{
  "run": "run-1",
  "adapter": "acorn-mu-plugin",
  "threshold": 0.6,
  "sections": [
    { "spec": "04-stats", "kind": "stats", "candidates": [], "decision": { "action": "scaffold", "block": null, "confidence": 1, "reason": "approved: no stats block" } }
  ]
}
```

`scaffold.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
fx="$here/../fixtures"
cp -R "$fx/projects/acme-mu-plugin/." .
mkdir -p .creator/run-1/specs
printf '*\n' > .creator/.gitignore
cp "$fx/runs/landing/specs/04-stats.json" .creator/run-1/specs/
cp "$here/plan.json" .creator/run-1/match-plan.json
```

`prompt.md`:

```markdown
---
description: Emitting a stats block whose text size has no theme token must propose a token, never write an arbitrary value
tags: [skill, block-scaffolding-from-design]
max_turns: 25
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]
---

The match plan in .creator/run-1 is approved. Emit it and prepare the new block for review, but do not copy anything into the mu-plugin yet. Tell me which design values still need tokens.
```

`graders/emitted.md`:

```markdown
---
type: tool_used
tool: Bash
input_match: 'emit\.mjs'
---
```

`graders/no-arbitrary.md`:

```markdown
---
type: regex
target: trace
pattern: '\b(?:text|bg|p[tbxy]?|m[tbxy]?|gap|leading|font)-\[[^\]]+\]'
match: not_contains
weight: 2
---
```

`graders/proposal.md`:

```markdown
---
type: llm
focus: last_message
---
PASS if the reply names the 13px body text size (or the text font size of the stats section) as a value that needs a new theme token, and does not suggest writing the value directly in a class or a style attribute. FAIL otherwise.
```

`graders/project-untouched.md`:

```markdown
---
type: file_exists
path: 'wp-content/mu-plugins/acme-core/app/Blocks/Stats.php'
exists: false
arm: both
---
```

`plugins/kivo-creator/evals/creator-stops-at-plan/` scaffold copies specs `01-hero.json`, `02-faq.json` and `03-testimonial.json` (same script shape as `match-plan-judgment`). `prompt.md`:

```markdown
---
description: /creator on an ingested run stops at the match plan and asks for approval
tags: [command, creator]
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]
---

/kivo-creator:creator --run=.creator/run-1
```

`graders/plan-written.md`:

```markdown
---
type: file_exists
path: '.creator/run-1/match-plan.md'
---
```

`graders/no-emit.md`: same as in `match-plan-judgment`.

`graders/no-project-writes.md`:

```markdown
---
type: tool_used
tool: Write
input_match: 'app/Blocks|resources/views'
min: 0
max: 0
arm: both
---
```

`graders/asks-approval.md`:

```markdown
---
type: llm
focus: last_message
---
PASS if the reply shows the match plan (a table or list with one decision per section) and asks the person to approve it before anything is generated. FAIL if it says blocks were generated or emitted, or if it does not ask for approval.
```

**Step 6: Stage and run the suite once**

```bash
chmod +x plugins/kivo-creator/evals/*/scaffold.sh
node scripts/build-creator-eval.mjs
claude plugin eval .creator-eval/kivo-creator --scaffold --allow-tools Bash Write Edit --runs 1 --ablation none --no-publish
```

Expected: the run loads `kivo-creator` (the progress line names it; `figma[not started: no mock]` is expected), all four cases execute, and each prints a score. Record the scores in the commit body. If a case fails because of the grader rather than the plugin (read the transcript in `evals/results/`), fix the grader and re-run; if the plugin is wrong, fix the skill.

**Step 7: Commit**

```bash
git add scripts/build-creator-eval.mjs test/creator/build-creator-eval.test.mjs plugins/kivo-creator/evals
git commit -m "test(kivo-creator): stage the plugin for claude plugin eval and add phase 1 evals"
```

---

### Task 33: README, provenance and root README (phase 1)

**Files:**
- Modify: `plugins/kivo-creator/README.md`
- Modify: `docs/provenance.md` (new section at the end)
- Modify: `README.md` (root: new section after "Docs brain")

**Step 1: Write the plugin README**

````markdown
# kivo-creator

Figma and HTML to WordPress on the Roots stack. kivo-creator turns a design into a page made of blocks the project already has, generates a block only when nothing fits, and proves the result with numbers.

```
source ─▶ ingest ─▶ section specs ─▶ match plan (stop for approval) ─▶ emit ─▶ verify ─▶ report
```

Requires the [kivo-wise](../../README.md) plugin (stack detection and runner context), Node.js 20+, and Playwright in the target project for HTML sources and verification. Figma sources need the official Figma MCP server connected in the session.

## Install

```bash
claude plugin marketplace add hekivo/kivo-wise
claude plugin install kivo-creator@kivo-wise   # installs kivo-wise too
```

## Use

```
/kivo-creator:creator ./landing.html
/kivo-creator:creator https://www.figma.com/design/<file>/<name>?node-id=1-2
/kivo-creator:creator --run=.creator/<run>
```

Every run writes to `.creator/<run>/` in the project (ignored by git) and stops at `match-plan.md`. Nothing is generated before you approve the plan.

## Skills

| Skill | Purpose |
|---|---|
| `creator` | The command: route the source, ingest, match, stop for approval |
| `html-ingest` | Render a page with the project's Playwright and write section specs |
| `figma-ingest` | Read a Figma frame through the official MCP server and write section specs |
| `section-matching` | Map sections to existing blocks: compatibility filter, rubric, explicit `none` |
| `block-scaffolding-from-design` | Emit block markup; generate missing blocks with the project's generator |
| `visual-fidelity` | Screenshot, pixel diff, style check, lint; up to three fix rounds |
| `code-connect` | Propose Figma Code Connect mappings and send them only after approval |

## Scripts

All scripts are dependency-free Node ESM in `scripts/`: `ingest-html.mjs`, `validate-spec.mjs`, `match.mjs`, `emit.mjs`, `verify.mjs`, `png.mjs` (PNG decoder and pixel diff on `node:zlib`), `figma-sections.mjs`, `figma-ref.mjs`, `code-connect.mjs`. Section specs follow `schemas/section-spec.schema.json`.

## Adapters

| Adapter | Target | Emit |
|---|---|---|
| `acorn-mu-plugin` | ACF Composer blocks in an Acorn mu-plugin | block class, Blade view, CSS notes, `acf/*` block markup |
| `sage-theme` | Sage theme blocks (ACF Composer or native `block.json`) | same, inside the theme |
| `radicle` | Radicle native blocks | `block.json`, Blade view, block markup |

## Rules

Never invent a value (every slot and token is `exact` or `inferred`); no arbitrary Tailwind values; no inline styles; no BEM; unmatched design values become token proposals; generated blocks pass the project's own checks.

## Development

```bash
node --test test/creator/
node scripts/validate-skills.mjs --root plugins/kivo-creator
node scripts/build-creator-eval.mjs && claude plugin eval .creator-eval/kivo-creator --scaffold --allow-tools Bash Write Edit
```

Evals run on a staged copy because a declared plugin dependency does not load inside the eval sandbox; see `scripts/build-creator-eval.mjs`.

## License

MIT.
````

(The Figma, Code Connect, `sage-theme` and `radicle` rows describe phases 2 and 3; keep them, the release that ships this README includes them.)

**Step 2: Add the provenance section**

Append to `docs/provenance.md`:

```markdown
## kivo-creator (plugin, phases 1-3)
- New plugin; design in `docs/plans/2026-10-19-kivo-creator-design.md`.
- Ideas kept from the superpowers-sage 2.x design skills removed in 3.0 (`designing`, `sage-design-system`, `building`, `verifying`; agents `design-extractor`, `visual-verifier`): routing by source with no silent fallback, `exact` / `inferred` provenance, no arbitrary Tailwind values, tokens before blocks, the verify and fix loop. Nothing was copied; the code and the skills are new.
- Changed on purpose: matching against the existing block catalog before generating; a numeric pixel diff (`scripts/png.mjs`, `node:zlib` only) instead of a visual judgment; emit writes only under `.creator/<run>/` and the project's generator runs before prepared files are copied.
- Verified at source: `serialize_block_attributes()` in `wp-includes/blocks.php` (escaping mirrored by `scripts/lib/block-markup.mjs`). <!-- add the ACF Builder field key and ACF block data references found in Task 25, with file and line -->
- Unverified: ACF Composer's default slug for names with spaces (implemented as kebab-case, as the kivo-wise acorn-scaffolding reference states).
```

**Step 3: Add the root README section**

In the root `README.md`, after the "Docs brain" section:

```markdown
## kivo-creator

A second plugin in this repository, [`plugins/kivo-creator`](plugins/kivo-creator/README.md): Figma and HTML to WordPress blocks on the Roots stack. It reuses the project's blocks first, generates only the gaps and verifies the page with a pixel diff. Install with `claude plugin install kivo-creator@kivo-wise`; it depends on kivo-wise. Released separately (`kivo-creator-vX.Y.Z` tags).
```

**Step 4: Check**

Run: `node scripts/validate-skills.mjs --root plugins/kivo-creator && node scripts/build-codex-plugin.mjs --check && node --test test/creator/`
Expected: exit 0, `fail 0`.

Check the public-content rule: `git grep -nIi -e "lndo.site" -e "/home/" -- plugins/kivo-creator test/fixtures/creator docs/provenance.md` prints nothing.

**Step 5: Commit**

```bash
git add plugins/kivo-creator/README.md docs/provenance.md README.md
git commit -m "docs(kivo-creator): add the README and provenance for the core"
```

Phase 1 is complete: HTML source to approved plan to emitted page and verified fidelity, for the `acorn-mu-plugin` target.

---

# Phase 2: Figma ingest and Code Connect

The Figma part runs in the main session only: subagents do not inherit MCP servers. The skills name the official Figma MCP tools by their tool name (`get_metadata`, `get_design_context`, `get_variable_defs`, `get_screenshot`, `get_code_connect_map`, `send_code_connect_mappings`); the full tool name depends on how the server is connected (for example `mcp__figma__get_metadata`, or `mcp__plugin_kivo-creator_figma__get_metadata` in the eval sandbox), so skills match the suffix.

### Task 34: Figma URL, metadata tree and section skeletons

**Files:**
- Create: `plugins/kivo-creator/scripts/lib/figma.mjs`
- Create: `plugins/kivo-creator/scripts/figma-sections.mjs`
- Create: `test/fixtures/creator/figma/metadata.xml`
- Test: `test/creator/figma.test.mjs`

**Step 1: Create the recorded-shape metadata fixture**

`test/fixtures/creator/figma/metadata.xml` (the shape `get_metadata` returns: one XML element per node with id, name and geometry; acme content):

```xml
<frame id="1:2" name="Acme Landing" x="0" y="0" width="1440" height="2600">
  <frame id="1:3" name="Header" x="0" y="0" width="1440" height="80">
    <instance id="1:4" name="Logo/Acme" x="24" y="20" width="96" height="40" />
  </frame>
  <instance id="1:10" name="Hero/Default" x="0" y="80" width="1440" height="640">
    <text id="1:11" name="Acme ships faster" x="120" y="200" width="600" height="64" />
    <text id="1:12" name="Plan, build and launch in one place." x="120" y="280" width="600" height="28" />
    <instance id="1:13" name="Button/Primary" x="120" y="340" width="160" height="48" />
    <rectangle id="1:14" name="Dashboard image" x="800" y="140" width="520" height="420" />
  </instance>
  <frame id="1:20" name="Features" x="0" y="720" width="1440" height="560">
    <text id="1:21" name="Why Acme" x="120" y="760" width="800" height="48" />
    <instance id="1:22" name="Feature Card" x="120" y="860" width="380" height="240" />
    <instance id="1:23" name="Feature Card" x="540" y="860" width="380" height="240" />
    <instance id="1:24" name="Feature Card" x="960" y="860" width="380" height="240" />
  </frame>
  <frame id="1:30" name="Pricing Table" x="0" y="1280" width="1440" height="600">
    <instance id="1:31" name="Pricing/Plan" x="120" y="1340" width="380" height="480" />
  </frame>
  <frame id="1:40" name="Footer CTA" x="0" y="1880" width="1440" height="320">
    <text id="1:41" name="Ready to ship?" x="120" y="1940" width="800" height="48" />
    <instance id="1:42" name="Button/Primary" x="120" y="2020" width="160" height="48" />
  </frame>
  <frame id="1:50" name="Footer" x="0" y="2200" width="1440" height="400" />
</frame>
```

**Step 2: Write the failing test**

```js
// test/creator/figma.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseFigmaUrl, parseXmlTree, sectionsFromMetadata, componentsFromMetadata, kindFromName } from '../../plugins/kivo-creator/scripts/lib/figma.mjs';
import { FIX, PLUGIN, tmpCopy } from './helpers.mjs';

const xml = readFileSync(join(FIX, 'figma', 'metadata.xml'), 'utf8');

test('parses design, file and branch URLs; node-id dashes become colons', () => {
  assert.deepEqual(parseFigmaUrl('https://www.figma.com/design/AbC123acme/Acme-Landing?node-id=1-2&t=x'), { kind: 'design', fileKey: 'AbC123acme', nodeId: '1:2' });
  assert.equal(parseFigmaUrl('https://figma.com/design/AbC123acme/branch/Br4nch/Acme').fileKey, 'Br4nch');
  assert.throws(() => parseFigmaUrl('https://example.com/design/x'), /figma\.com/);
});

test('the XML tree keeps ids, names and geometry', () => {
  const root = parseXmlTree(xml).children[0];
  assert.equal(root.attrs.name, 'Acme Landing');
  assert.equal(root.children.length, 6);
});

test('top-level frames become ordered section skeletons; header and footer are chrome', () => {
  assert.deepEqual(sectionsFromMetadata(xml, '1:2').map((s) => `${s.id}|${s.nodeId}|${s.kind}|${s.chrome}`), [
    '01-header|1:3|custom|true',
    '02-hero|1:10|hero|false',
    '03-features|1:20|features|false',
    '04-pricing-table|1:30|custom|false',
    '05-cta|1:40|cta|false',
    '06-footer|1:50|custom|true',
  ]);
});

test('kind from layer names', () => {
  assert.equal(kindFromName('Footer CTA'), 'cta');
  assert.equal(kindFromName('FAQ / Accordion'), 'faq');
  assert.equal(kindFromName('Customer quotes'), 'testimonial');
  assert.equal(kindFromName('Pricing Table'), 'custom');
});

test('components are the distinct instances, first id wins', () => {
  assert.deepEqual(componentsFromMetadata(xml).map((c) => `${c.id} ${c.name}`), ['1:4 Logo/Acme', '1:10 Hero/Default', '1:13 Button/Primary', '1:22 Feature Card', '1:31 Pricing/Plan']);
});

test('CLI writes the run with figma-sections.json and a copy of the metadata', () => {
  const project = tmpCopy(join(FIX, 'projects', 'acme-mu-plugin'));
  const res = spawnSync(process.execPath, [join(PLUGIN, 'scripts', 'figma-sections.mjs'), `--project=${project}`, '--url=https://www.figma.com/design/AbC123acme/Acme-Landing?node-id=1-2', `--metadata=${join(FIX, 'figma', 'metadata.xml')}`], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  const runDir = join(project, out.dir);
  assert.deepEqual(readdirSync(runDir).filter((f) => f.startsWith('figma-')).sort(), ['figma-metadata.xml', 'figma-sections.json']);
  assert.equal(JSON.parse(readFileSync(join(runDir, 'figma-sections.json'), 'utf8')).sections.length, 6);
  assert.match(out.run, /-acme-landing$/);
});
```

**Step 3: Run it to see it fail**

Run: `node --test test/creator/figma.test.mjs`
Expected: FAIL with `Cannot find module '.../scripts/lib/figma.mjs'`

**Step 4: Implement `figma.mjs`**

```js
// plugins/kivo-creator/scripts/lib/figma.mjs
import { slugify } from './run.mjs';

export function parseFigmaUrl(url) {
  const u = new URL(url);
  if (!/(^|\.)figma\.com$/.test(u.hostname)) throw new Error(`not a figma.com URL: ${url}`);
  const m = u.pathname.match(/^\/(design|file|proto|board|make)\/([A-Za-z0-9]+)(?:\/branch\/([A-Za-z0-9]+))?/);
  if (!m) throw new Error(`unrecognised Figma URL path: ${u.pathname}`);
  const node = u.searchParams.get('node-id');
  return { kind: m[1], fileKey: m[3] ?? m[2], nodeId: node ? node.replace(/-/g, ':') : null };
}

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Tolerant XML element tree (no text nodes): what get_metadata returns. */
export function parseXmlTree(xml) {
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  for (const m of xml.matchAll(/<(\/?)([A-Za-z][\w-]*)([^>]*?)(\/?)>/g)) {
    const [, closing, tag, rawAttrs, selfClosing] = m;
    if (closing) { if (stack.length > 1) stack.pop(); continue; }
    const attrs = {};
    for (const a of rawAttrs.matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[a[1]] = decode(a[2]);
    const node = { tag, attrs, children: [] };
    stack.at(-1).children.push(node);
    if (!selfClosing) stack.push(node);
  }
  return root;
}

function findNode(node, id) {
  if (node.attrs?.id === id) return node;
  for (const child of node.children) {
    const hit = findNode(child, id);
    if (hit) return hit;
  }
  return null;
}

const CONTAINERS = new Set(['frame', 'instance', 'section', 'group', 'component']);
const KIND_RULES = [
  [/\bcta\b|call to action/i, 'cta'],
  [/^(header|footer|nav(igation)?|top ?bar)\b/i, 'chrome'],
  [/hero|banner/i, 'hero'],
  [/faq|question|accordion/i, 'faq'],
  [/feature|benefit/i, 'features'],
  [/testimonial|quote|review/i, 'testimonial'],
  [/logo|client|partner/i, 'logos'],
  [/stat|number|metric/i, 'stats'],
  [/step|how it works/i, 'steps'],
  [/form|contact|sign ?up/i, 'form'],
  [/video|gallery|media/i, 'media'],
];

export function kindFromName(name) {
  return KIND_RULES.find(([re]) => re.test(name))?.[1] ?? 'custom';
}

const box = (a) => ({ x: Number(a.x ?? 0), y: Number(a.y ?? 0), width: Number(a.width ?? 0), height: Number(a.height ?? 0) });

/** Section skeletons (no values) for the frame `nodeId`: its container children, top to bottom. */
export function sectionsFromMetadata(xml, nodeId) {
  const tree = parseXmlTree(xml);
  let root = (nodeId && findNode(tree, nodeId)) || tree.children[0];
  if (!root) throw new Error('get_metadata returned no nodes');
  for (let depth = 0; depth < 3; depth++) {
    const kids = root.children.filter((c) => CONTAINERS.has(c.tag));
    if (kids.length === 1 && box(kids[0].attrs).width >= 0.9 * box(root.attrs).width && kids[0].children.length >= 2) root = kids[0];
    else break;
  }
  return root.children
    .filter((c) => CONTAINERS.has(c.tag))
    .sort((a, b) => box(a.attrs).y - box(b.attrs).y)
    .map((c, i) => {
      const rule = kindFromName(c.attrs.name ?? '');
      const chrome = rule === 'chrome';
      const kind = chrome ? 'custom' : rule;
      const label = chrome || kind === 'custom' ? slugify(c.attrs.name ?? 'section') : kind;
      return { id: `${String(i + 1).padStart(2, '0')}-${label}`, nodeId: c.attrs.id, name: c.attrs.name ?? '', kind, chrome, box: box(c.attrs) };
    });
}

/** Distinct component instances (by name), first id wins: candidates for Code Connect. */
export function componentsFromMetadata(xml) {
  const seen = new Map();
  const visit = (node) => {
    if (node.tag === 'instance' && node.attrs.name && !seen.has(node.attrs.name)) seen.set(node.attrs.name, { id: node.attrs.id, name: node.attrs.name });
    node.children.forEach(visit);
  };
  visit(parseXmlTree(xml));
  return [...seen.values()];
}
```

The chrome id uses the layer name slug (`01-header`, `06-footer`); a `custom` id too (`04-pricing-table`), so specs stay readable.

**Step 5: Implement the CLI**

```js
#!/usr/bin/env node
// plugins/kivo-creator/scripts/figma-sections.mjs
/**
 * figma-sections.mjs: create a run for a Figma frame from a saved get_metadata
 * response and write .creator/<run>/figma-sections.json (ids, node ids, kinds,
 * geometry). It writes no specs: those need get_design_context per section.
 *
 * Usage: node scripts/figma-sections.mjs --url=<figma frame URL> --metadata=<saved XML> [--project=.] [--run=<dir>]
 */
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { parseFigmaUrl, parseXmlTree, sectionsFromMetadata } from './lib/figma.mjs';
import { createRun, runPaths, writeJson } from './lib/run.mjs';

export function main(argv) {
  const o = parseOptions(argv, { url: '', metadata: '', project: '.', run: '' });
  if (!o.url || !o.metadata) throw new Error('usage: figma-sections.mjs --url=<figma URL> --metadata=<saved get_metadata XML> [--project=.]');
  const { fileKey, nodeId } = parseFigmaUrl(o.url);
  const xml = readFileSync(o.metadata, 'utf8');
  const sections = sectionsFromMetadata(xml, nodeId);
  const rootName = parseXmlTree(xml).children[0]?.attrs.name ?? 'figma';
  const run = o.run ? { id: basename(resolve(o.run)), dir: resolve(o.run) } : createRun(o.project, rootName);
  mkdirSync(run.dir, { recursive: true });
  const paths = runPaths(run.dir);
  copyFileSync(o.metadata, join(run.dir, 'figma-metadata.xml'));
  writeJson(paths.figmaSections, { url: o.url, fileKey, nodeId, sections });
  console.log(JSON.stringify({ run: run.id, dir: relative(resolve(o.project), run.dir), sections: sections.map((s) => ({ id: s.id, nodeId: s.nodeId, kind: s.kind, chrome: s.chrome })) }, null, 2));
}

runCli(import.meta.url, main);
```

**Step 6: Run the test**

Run: `node --test test/creator/figma.test.mjs`
Expected: PASS (`pass 6`, `fail 0`)

**Step 7: Commit**

```bash
git add plugins/kivo-creator/scripts/lib/figma.mjs plugins/kivo-creator/scripts/figma-sections.mjs test/fixtures/creator/figma test/creator/figma.test.mjs
git commit -m "feat(kivo-creator): turn Figma metadata into section skeletons"
```

---

### Task 35: Reference images from Figma (`figma-ref.mjs`)

**Files:**
- Create: `plugins/kivo-creator/scripts/figma-ref.mjs`
- Test: `test/creator/figma-ref.test.mjs`

**Step 1: Write the failing test**

```js
// test/creator/figma-ref.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fetchRefs } from '../../plugins/kivo-creator/scripts/figma-ref.mjs';
import { encodePng } from '../../plugins/kivo-creator/scripts/png.mjs';
import { PLUGIN, validSpec } from './helpers.mjs';

function runWithFigmaSpec() {
  const run = mkdtempSync(join(tmpdir(), 'figref-'));
  mkdirSync(join(run, 'specs'));
  mkdirSync(join(run, 'refs'));
  const spec = { ...validSpec(), id: '02-hero', refs: {}, source: { kind: 'figma', ref: '1:10', url: 'https://www.figma.com/design/AbC123acme/Acme?node-id=1-2' } };
  writeFileSync(join(run, 'specs', '02-hero.json'), JSON.stringify(spec));
  return run;
}

test('downloads one PNG per Figma section and records it under refs/<id>-<width>.png', async () => {
  const png = encodePng({ width: 4, height: 2, data: Buffer.alloc(32, 200) });
  const seen = [];
  const server = createServer((req, res) => {
    seen.push({ url: req.url, token: req.headers['x-figma-token'] });
    if (req.url.startsWith('/v1/images/AbC123acme')) {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ err: null, images: { '1:10': `http://127.0.0.1:${server.address().port}/img/hero.png` } }));
    } else { res.setHeader('content-type', 'image/png'); res.end(png); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const run = runWithFigmaSpec();
    const out = await fetchRefs({ runDir: run, token: 'test-token', base: `http://127.0.0.1:${server.address().port}` });
    assert.deepEqual(out, [{ spec: '02-hero', saved: 'refs/02-hero-4.png' }]);
    assert.ok(existsSync(join(run, 'refs', '02-hero-4.png')));
    assert.deepEqual(JSON.parse(readFileSync(join(run, 'specs', '02-hero.json'), 'utf8')).refs, { 4: 'refs/02-hero-4.png' });
    assert.equal(seen[0].url, '/v1/images/AbC123acme?ids=1%3A10&format=png&scale=1');
    assert.equal(seen[0].token, 'test-token');
  } finally {
    server.close();
  }
});

test('CLI without FIGMA_TOKEN exits 2 and explains, without printing any token', () => {
  const run = runWithFigmaSpec();
  const env = { ...process.env };
  delete env.FIGMA_TOKEN;
  const res = spawnSync(process.execPath, [join(PLUGIN, 'scripts', 'figma-ref.mjs'), `--run=${run}`], { encoding: 'utf8', env });
  assert.equal(res.status, 2);
  assert.match(res.stderr, /FIGMA_TOKEN is not set/);
});
```

**Step 2: Run it to see it fail**

Run: `node --test test/creator/figma-ref.test.mjs`
Expected: FAIL with `Cannot find module '.../scripts/figma-ref.mjs'`

**Step 3: Implement**

```js
#!/usr/bin/env node
// plugins/kivo-creator/scripts/figma-ref.mjs
/**
 * figma-ref.mjs: download reference PNGs for the Figma sections of a run
 * through the Figma REST images API, so verify.mjs can pixel-diff them.
 * The MCP get_screenshot result reaches the model, not the disk; this is
 * the on-disk path. Reads FIGMA_TOKEN from the environment and never prints it.
 *
 * Usage: FIGMA_TOKEN=... node scripts/figma-ref.mjs --run=.creator/<run>
 */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { parseFigmaUrl } from './lib/figma.mjs';
import { decodePng } from './png.mjs';
import { readSpecs } from './lib/spec.mjs';
import { runPaths, writeJson } from './lib/run.mjs';

export async function fetchRefs({ runDir, token, base = 'https://api.figma.com', fetchImpl = fetch }) {
  const paths = runPaths(runDir);
  const specs = readSpecs(paths.specs).filter((s) => s.source.kind === 'figma' && !s.chrome);
  if (!specs.length) return [];
  const { fileKey } = parseFigmaUrl(specs[0].source.url);
  const ids = specs.map((s) => s.source.ref).join(',');
  const res = await fetchImpl(`${base}/v1/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=1`, { headers: { 'X-Figma-Token': token } });
  if (!res.ok) throw new Error(`Figma images API answered ${res.status}`);
  const body = await res.json();
  if (body.err) throw new Error(`Figma images API: ${body.err}`);
  const out = [];
  for (const spec of specs) {
    const url = body.images?.[spec.source.ref];
    if (!url) { out.push({ spec: spec.id, saved: null, reason: 'no image returned' }); continue; }
    const img = await fetchImpl(url);
    if (!img.ok) { out.push({ spec: spec.id, saved: null, reason: `download answered ${img.status}` }); continue; }
    const buf = Buffer.from(await img.arrayBuffer());
    const rel = `refs/${spec.id}-${decodePng(buf).width}.png`;
    writeFileSync(join(runDir, rel), buf);
    spec.refs = { ...spec.refs, [rel.match(/-(\d+)\.png$/)[1]]: rel };
    writeJson(join(paths.specs, `${spec.id}.json`), spec);
    out.push({ spec: spec.id, saved: rel });
  }
  return out;
}

export async function main(argv) {
  const o = parseOptions(argv, { run: '' });
  if (!o.run) throw new Error('usage: figma-ref.mjs --run=<.creator/run>');
  const token = process.env.FIGMA_TOKEN;
  if (!token) {
    process.exitCode = 2;
    throw new Error('FIGMA_TOKEN is not set. Export a Figma personal access token (file read scope) in the shell, or skip pixel references: verify then reports "no reference" and still checks styles and lint.');
  }
  const out = await fetchRefs({ runDir: resolve(o.run), token, base: process.env.FIGMA_API_BASE || 'https://api.figma.com' });
  console.log(JSON.stringify(out, null, 2));
}

runCli(import.meta.url, main);
```

**Step 4: Run the test**

Run: `node --test test/creator/figma-ref.test.mjs`
Expected: PASS (`pass 2`, `fail 0`)

**Step 5: Commit**

```bash
git add plugins/kivo-creator/scripts/figma-ref.mjs test/creator/figma-ref.test.mjs
git commit -m "feat(kivo-creator): download Figma reference images for the pixel diff"
```

---

### Task 36: Skill `figma-ingest`

**Files:**
- Create: `plugins/kivo-creator/skills/figma-ingest/SKILL.md`

**Step 1: Write the skill**

````markdown
---
name: figma-ingest
description: Use when a Figma frame URL has to become kivo-creator section specs - reading the frame through the official Figma MCP server in the main session (get_metadata for the tree, get_design_context per section, get_variable_defs for tokens, get_screenshot to look, get_code_connect_map for mapped components), writing exact or inferred values only, and stopping with connection steps when the server is missing. For HTML sources use html-ingest; for creating Code Connect mappings use code-connect.
license: MIT
compatibility: Main session only (subagents do not inherit MCP servers). Needs the official Figma MCP server; optional FIGMA_TOKEN for reference images. Node 20+.
---

# Figma ingest

Read a Figma frame into neutral section specs. The MCP output is a reference to read, never code to copy: its arbitrary classes and literal values are not carried into the project.

## When to use

- A `figma.com/design/...` (or `/file/`) link with a `node-id`, from `/creator` or on its own.
- Not for HTML (`html-ingest`) and not for writing Code Connect mappings (`code-connect`).

## Inputs required

1. The frame URL with `node-id` (a page link without it is ambiguous: ask for the frame).
2. The Figma MCP tools in this session. Their names end in `get_metadata`, `get_design_context`, `get_variable_defs`, `get_screenshot` and `get_code_connect_map`; the prefix depends on how the server was connected.
3. The target project root with `.roots-stack.json`, and the kivo-creator plugin root (two levels above this skill's folder).

## Procedure

1. **Check the server.** If none of the tools above is available, stop and say: the official Figma MCP server is not connected in this session; add the remote server `https://mcp.figma.com/mcp` (HTTP transport) in the assistant's MCP settings, or enable the local server of the Figma desktop app, sign in, and start a new session. Do not fall back to screenshots, the REST API or guessing.
2. **Metadata.** Call `get_metadata` with the file key and node id from the URL (`node-id=1-2` means `1:2`). Save the response text to `.creator/figma-metadata.xml`, then:

   ```bash
   node <kivo-creator>/scripts/figma-sections.mjs --url="<figma URL>" --metadata=.creator/figma-metadata.xml --project=.
   ```

   It creates `.creator/<run>/` with `figma-sections.json`: one entry per top-level frame (`id`, `nodeId`, `kind` from the layer name, `chrome`, geometry).
3. **Variables.** Call `get_variable_defs` for the frame; save the result as `.creator/<run>/figma-variables.json`.
4. **Code Connect.** Call `get_code_connect_map` for the frame; save it as `.creator/<run>/figma-code-connect.json`. When a section's node is mapped to a block in the catalog (`node <kivo-creator>/scripts/match.mjs --catalog --project=.`), set `"codeConnect": { "block": "<block name>", "component": "<component name>" }` in that section's spec.
5. **One spec per section.** For each non-chrome entry, call `get_design_context` with its `nodeId` (and `get_screenshot` when you need to look at it), then write `.creator/<run>/specs/<id>.json` following `schemas/section-spec.schema.json`:
   - `source`: `{ "kind": "figma", "ref": "<nodeId>", "url": "<figma URL>" }`; `kind` from `figma-sections.json`, corrected when the content clearly says otherwise (add a note).
   - `slots`: literal texts, image and link targets that appear in the design context are `exact`; a repeated card becomes one `list` slot named `items`. Leave out anything that is not in the design.
   - `layout`: columns, alignment, media position and repeat count from the geometry and auto layout; mark it in `notes` as inferred.
   - `tokens`: colours, font family, size, weight, line height and padding per role (`section`, `heading`, `text`, `link`, `button`), `exact` when the design context or a variable gives the value. Write the value as CSS (`#0a84ff`, `56px`); never copy a Tailwind class from the reference code.
   - `refs`: leave `{}`; step 7 fills it.
   Chrome entries get a spec with `"chrome": true`, empty `slots` and `tokens`, `layout` `{ "columns": 1, "align": "left", "media": "none", "repeat": 0 }` and the note "chrome: not read". They are never matched.
6. **Validate**: `node <kivo-creator>/scripts/validate-spec.mjs .creator/<run>/specs`.
7. **References.** With `FIGMA_TOKEN` in the environment: `node <kivo-creator>/scripts/figma-ref.mjs --run=.creator/<run>` saves one PNG per section at the frame's width. Without it, say that the pixel diff will report "no reference" and only styles and lint are checked.
8. Hand over to `section-matching`.

## Verification

- `validate-spec.mjs` prints `ok` for every spec.
- Every slot value can be found in a saved MCP response or in the design context you read.
- No Tailwind class, `px-[…]` value or `var(--…)` fallback from the reference code appears in any spec.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Figma tools missing | Server not connected, or running inside a subagent | Stop with the connection steps; run in the main session |
| `get_metadata` returns one huge frame | The link points at a page or a wrapper | Ask for the frame link, or pass the inner frame's node id |
| Design context truncated | Very large section | Call it for the children of that section and merge the slots |
| `FIGMA_TOKEN is not set` | No token in the environment | Ask the person to export one, or accept a report without pixel diff |
| Values only in the screenshot | Raster image or flattened text | Leave them out; note that the source is a raster |

## Escalation

Ask when the frame has variants for several breakpoints (which one is canonical), when text is rasterised, or when a component mapped by Code Connect points at code that does not exist in the project.
````

**Step 2: Validate**

Run: `node scripts/validate-skills.mjs --root plugins/kivo-creator`
Expected: six `✓` lines, exit 0. (`figma-sections.mjs` and `figma-ref.mjs` are written with the `<kivo-creator>/` prefix, which the validator does not resolve; `schemas/...` is not a script reference.)

**Step 3: Commit**

```bash
git add plugins/kivo-creator/skills/figma-ingest
git commit -m "feat(kivo-creator): add the figma-ingest skill"
```

---

### Task 37: Code Connect proposals

**Files:**
- Create: `plugins/kivo-creator/scripts/lib/code-connect.mjs`
- Create: `plugins/kivo-creator/scripts/code-connect.mjs`
- Create: `test/fixtures/creator/figma/code-connect-map.json`
- Create: `test/fixtures/creator/projects/acme-mu-plugin/wp-content/mu-plugins/acme-core/resources/views/components/button.blade.php`
- Test: `test/creator/code-connect.test.mjs`

**Step 1: Create the fixtures**

`test/fixtures/creator/figma/code-connect-map.json` (shape of `get_code_connect_map`: node id to the mapped code):

```json
{
  "1:13": {
    "codeConnectSrc": "wp-content/mu-plugins/acme-core/resources/views/components/button.blade.php",
    "codeConnectName": "x-button"
  }
}
```

`.../acme-core/resources/views/components/button.blade.php`:

```blade
<a {{ $attributes->merge(['class' => 'bg-brand text-white']) }}>{{ $slot }}</a>
```

**Step 2: Write the failing test**

```js
// test/creator/code-connect.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { proposeMappings, bladeComponents, similarity } from '../../plugins/kivo-creator/scripts/lib/code-connect.mjs';
import { componentsFromMetadata } from '../../plugins/kivo-creator/scripts/lib/figma.mjs';
import { acfCatalog } from '../../plugins/kivo-creator/scripts/adapters/shared/acf-composer.mjs';
import { resolveStack } from '../../plugins/kivo-creator/scripts/lib/stack.mjs';
import { FIX, PLUGIN } from './helpers.mjs';

const stack = resolveStack(join(FIX, 'projects', 'acme-mu-plugin'));
const components = componentsFromMetadata(readFileSync(join(FIX, 'figma', 'metadata.xml'), 'utf8'));
const map = JSON.parse(readFileSync(join(FIX, 'figma', 'code-connect-map.json'), 'utf8'));

test('similarity ignores variant words', () => {
  assert.equal(similarity('Hero/Default', 'Hero'), 1);
  assert.equal(similarity('Feature Card', 'Feature Grid'), 1 / 3);
});

test('Blade components are listed as x-<name>', () => {
  assert.deepEqual(bladeComponents(stack).map((c) => c.name), ['x-button']);
});

test('keeps existing mappings, proposes confident ones and flags components without code', () => {
  const r = proposeMappings({ components, map, targets: [...acfCatalog(stack), ...bladeComponents(stack)] });
  assert.deepEqual(r.mapped.map((m) => `${m.component}->${m.codeConnectName}`), ['Button/Primary->x-button']);
  assert.deepEqual(r.proposals.map((p) => `${p.component}->${p.target}`), ['Hero/Default->acf/hero']);
  assert.deepEqual(r.unmatched.map((u) => u.component), ['Logo/Acme', 'Feature Card', 'Pricing/Plan']);
});

test('CLI writes the proposal file and sends nothing', () => {
  const res = spawnSync(process.execPath, [join(PLUGIN, 'scripts', 'code-connect.mjs'), `--project=${join(FIX, 'projects', 'acme-mu-plugin')}`, `--metadata=${join(FIX, 'figma', 'metadata.xml')}`, `--map=${join(FIX, 'figma', 'code-connect-map.json')}`], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(JSON.parse(res.stdout).proposals[0].target, 'acf/hero');
});
```

**Step 3: Run it to see it fail**

Run: `node --test test/creator/code-connect.test.mjs`
Expected: FAIL with `Cannot find module '.../scripts/lib/code-connect.mjs'`

**Step 4: Implement the library**

```js
// plugins/kivo-creator/scripts/lib/code-connect.mjs
import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const STOP = new Set(['default', 'primary', 'secondary', 'tertiary', 'block', 'section', 'component', 'variant', 'desktop', 'mobile', 'tablet', 'v1', 'v2', 'new']);
const words = (s) => String(s).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w));

/** Jaccard similarity of the meaningful words of two names. */
export function similarity(a, b) {
  const A = new Set(words(a));
  const B = new Set(words(b));
  if (!A.size || !B.size) return 0;
  const shared = [...A].filter((w) => B.has(w)).length;
  return shared / new Set([...A, ...B]).size;
}

/** Anonymous and class-based Blade components under resources/views/components. */
export function bladeComponents(stack) {
  const base = join(stack.appPath, 'resources', 'views', 'components');
  const out = [];
  const visit = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.name.endsWith('.blade.php')) {
        const id = relative(base, full).replace(/\.blade\.php$/, '').split(/[\\/]/).join('.');
        out.push({ name: `x-${id}`, title: id.replace(/[.-]/g, ' '), slug: id, source: relative(stack.projectDir, full).split('\\').join('/') });
      }
    }
  };
  visit(base);
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * components: [{ id, name }] from get_metadata; map: get_code_connect_map;
 * targets: blocks and Blade components ({ name, title, slug, source }).
 */
export function proposeMappings({ components, map = {}, targets, threshold = 0.5 }) {
  const mapped = [];
  const proposals = [];
  const unmatched = [];
  for (const c of components) {
    if (map[c.id]) { mapped.push({ component: c.name, nodeId: c.id, codeConnectName: map[c.id].codeConnectName, source: map[c.id].codeConnectSrc }); continue; }
    const base = c.name.split('/')[0];
    const best = targets
      .map((t) => ({ target: t.name, source: t.source, score: Math.max(similarity(base, t.title ?? ''), similarity(base, t.slug ?? '')) }))
      .sort((a, b) => b.score - a.score)[0];
    if (best && best.score >= threshold) proposals.push({ component: c.name, nodeId: c.id, target: best.target, source: best.source, score: Math.round(best.score * 100) / 100 });
    else unmatched.push({ component: c.name, nodeId: c.id });
  }
  return { mapped, proposals, unmatched };
}
```

**Step 5: Implement the CLI**

```js
#!/usr/bin/env node
// plugins/kivo-creator/scripts/code-connect.mjs
/**
 * code-connect.mjs: propose Code Connect mappings from saved get_metadata and
 * get_code_connect_map responses. It only writes a proposal; sending mappings
 * to Figma is done by the code-connect skill after the person approves.
 *
 * Usage: node scripts/code-connect.mjs --metadata=<xml> --map=<json> [--project=.] [--stack=<detector.json>] [--out=<file>]
 */
import { readFileSync } from 'node:fs';
import { parseOptions, runCli } from './lib/args.mjs';
import { loadContext } from './lib/context.mjs';
import { componentsFromMetadata } from './lib/figma.mjs';
import { bladeComponents, proposeMappings } from './lib/code-connect.mjs';
import { writeJson } from './lib/run.mjs';

export async function main(argv) {
  const o = parseOptions(argv, { metadata: '', map: '', project: '.', stack: '', out: '' });
  if (!o.metadata) throw new Error('usage: code-connect.mjs --metadata=<saved get_metadata XML> [--map=<saved get_code_connect_map JSON>] [--project=.] [--out=<file>]');
  const ctx = await loadContext(o);
  const result = proposeMappings({
    components: componentsFromMetadata(readFileSync(o.metadata, 'utf8')),
    map: o.map ? JSON.parse(readFileSync(o.map, 'utf8')) : {},
    targets: [...ctx.catalog, ...bladeComponents(ctx.stack)],
  });
  if (o.out) writeJson(o.out, result);
  console.log(JSON.stringify(result, null, 2));
}

runCli(import.meta.url, main);
```

**Step 6: Run the test**

Run: `node --test test/creator/code-connect.test.mjs`
Expected: PASS (`pass 4`, `fail 0`)

**Step 7: Commit**

```bash
git add plugins/kivo-creator/scripts/lib/code-connect.mjs plugins/kivo-creator/scripts/code-connect.mjs test/creator/code-connect.test.mjs test/fixtures/creator
git commit -m "feat(kivo-creator): propose Code Connect mappings from the catalog"
```

---

### Task 38: Skill `code-connect`

**Files:**
- Create: `plugins/kivo-creator/skills/code-connect/SKILL.md`

**Step 1: Write the skill**

````markdown
---
name: code-connect
description: Use when Figma components should point at the project's blocks and Blade components through Code Connect - reading the existing map, proposing new mappings from the block catalog, flagging components with no code counterpart, and sending mappings with send_code_connect_mappings only after the person approves the exact list. For reading a frame into specs use figma-ingest.
license: MIT
compatibility: Main session only, with the official Figma MCP server. Node 20+. Writes to Figma only after explicit approval.
---

# Code Connect

Mapped components make matching deterministic: a section whose Figma component is mapped to a block is filled without judgment. This skill creates those mappings, carefully, because they change a shared Figma file.

## When to use

- "Connect our Figma components to the code", "set up Code Connect".
- `figma-ingest` reported components without mappings that keep appearing.
- Not for ingesting a page (`figma-ingest`).

## Inputs required

1. A Figma file or frame URL.
2. The Figma MCP tools in this session (names ending in `get_metadata`, `get_code_connect_map`, `send_code_connect_mappings`).
3. The target project root and the kivo-creator plugin root (two levels above this skill's folder).

## Procedure

1. If the Figma tools are missing, stop with the connection steps from `figma-ingest`.
2. Call `get_metadata` for the frame and save it (for example `.creator/figma-metadata.xml`); call `get_code_connect_map` and save it (`.creator/figma-code-connect.json`).
3. Propose:

   ```bash
   node <kivo-creator>/scripts/code-connect.mjs --metadata=.creator/figma-metadata.xml --map=.creator/figma-code-connect.json --project=. --out=.creator/code-connect.json
   ```

4. Show three lists: already mapped (component and code), proposed (component, block or Blade component, score) and without a code counterpart. For each proposal, read the target's source file and drop proposals whose purpose does not match.
5. Ask the person to approve the exact list to send. Change nothing in Figma before that answer.
6. After approval, call `send_code_connect_mappings` once with the approved mappings, built from the tool's own input schema (node id, component name, source path, label). Do not send rejected or unreviewed items.
7. Call `get_code_connect_map` again and report what changed. List the unmatched components as candidates for new blocks or Blade components; do not create them here.

## Verification

- The map read after sending contains every approved mapping and nothing else new.
- No `send_code_connect_mappings` call happened before the approval message.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Send fails with a permission error | The account cannot edit the file or has no Code Connect access | Report it; the proposal file stays for someone with access |
| A proposal maps a card to a whole section block | Name similarity is not purpose | Drop it in step 4; map cards to Blade components instead |
| Everything is unmatched | Component names share no words with the code | Propose by hand from the catalog, still with approval |
| Mapped source path does not exist | The map points at a moved or deleted file | Flag it; propose the new path for approval |

## Escalation

Every send needs the person's explicit approval of the list. Ask before overwriting a mapping someone else created.
````

**Step 2: Validate**

Run: `node scripts/validate-skills.mjs --root plugins/kivo-creator`
Expected: seven `✓` lines, exit 0.

**Step 3: Commit**

```bash
git add plugins/kivo-creator/skills/code-connect
git commit -m "feat(kivo-creator): add the code-connect skill that sends only after approval"
```

---

### Task 39: Recorded Figma responses and the phase 2 evals

**Files:**
- Create: `test/fixtures/creator/figma/variables.json`
- Create: `test/fixtures/creator/figma/design-context-1:10.md`, `design-context-1:20.md`, `design-context-1:30.md`, `design-context-1:40.md`
- Modify: `scripts/build-creator-eval.mjs` (copy Figma fixtures next to case mocks)
- Modify: `test/creator/build-creator-eval.test.mjs`
- Create: `plugins/kivo-creator/evals/figma-stops-without-mcp/…`
- Create: `plugins/kivo-creator/evals/figma-ingest-mocked/…` (with `mocks/figma/*.md`)
- Create: `plugins/kivo-creator/evals/code-connect-asks-first/…` (with `mocks/figma/*.md`)

**Step 1: Record the responses**

These fixtures follow the shape of the official server's answers with acme content. Before the first release, replace them with real recordings from a public acme demo file (see Open questions); keep the file names.

`test/fixtures/creator/figma/variables.json`:

```json
{
  "color/ink": "#111827",
  "color/muted": "#4B5563",
  "color/brand": "#0A84FF",
  "color/surface": "#F5F7FA",
  "font/family/sans": "Inter",
  "font/size/display": "56",
  "font/size/body": "18"
}
```

`test/fixtures/creator/figma/design-context-1:10.md`:

```markdown
Reference code for node 1:10 "Hero/Default" (React + Tailwind). Adapt it to the project; do not copy classes.

export default function HeroDefault() {
  return (
    <section className="bg-white px-[120px] py-[80px] flex gap-12 items-center">
      <div className="flex flex-col gap-4">
        <h1 className="font-['Inter'] font-bold text-[56px] leading-[64px] text-[var(--color-ink,#111827)]">Acme ships faster</h1>
        <p className="font-['Inter'] text-[18px] text-[var(--color-muted,#4b5563)]">Plan, build and launch in one place.</p>
        <a href="https://acme.test/signup" className="bg-[var(--color-brand,#0a84ff)] text-white px-6 py-3">Start free</a>
      </div>
      <img src="https://acme.test/hero.png" alt="Acme dashboard" className="w-[520px] h-[420px]" />
    </section>
  );
}

Variables used: color/ink, color/muted, color/brand. Component instance: Button/Primary (1:13).
```

`design-context-1:20.md`:

```markdown
Reference code for node 1:20 "Features" (React + Tailwind).

export default function Features() {
  return (
    <section className="bg-[var(--color-surface,#f5f7fa)] px-[120px] py-[64px] text-center">
      <h2 className="font-bold text-[36px] text-[var(--color-ink,#111827)]">Why Acme</h2>
      <div className="grid grid-cols-3 gap-8">
        <div><h3 className="font-bold text-[20px]">Plan</h3><p className="text-[16px]">Roadmaps everyone can read.</p></div>
        <div><h3 className="font-bold text-[20px]">Build</h3><p className="text-[16px]">Reviews that do not block.</p></div>
        <div><h3 className="font-bold text-[20px]">Launch</h3><p className="text-[16px]">Releases on a schedule.</p></div>
      </div>
    </section>
  );
}

Component instances: Feature Card (1:22, 1:23, 1:24).
```

`design-context-1:30.md`:

```markdown
Reference code for node 1:30 "Pricing Table" (React + Tailwind).

export default function PricingTable() {
  return (
    <section className="px-[120px] py-[64px]">
      <div className="w-[380px] p-8 border"><h3 className="font-bold text-[24px]">Team</h3><p className="text-[40px] font-bold">$12</p><p>per person per month</p></div>
    </section>
  );
}

Component instance: Pricing/Plan (1:31).
```

`design-context-1:40.md`:

```markdown
Reference code for node 1:40 "Footer CTA" (React + Tailwind).

export default function FooterCta() {
  return (
    <section className="px-[120px] py-[64px]">
      <h2 className="font-bold text-[36px]">Ready to ship?</h2>
      <a href="https://acme.test/signup" className="bg-[var(--color-brand,#0a84ff)] text-white px-6 py-3">Start free</a>
    </section>
  );
}
```

**Step 2: Copy Figma fixtures next to case mocks when staging (test first)**

Append to `test/creator/build-creator-eval.test.mjs`:

```js
test('cases with Figma mocks get the recorded responses in mocks/figma/fixtures', () => {
  const out = stage(mkdtempSync(join(tmpdir(), 'stage-')));
  assert.ok(existsSync(join(out, 'evals', 'figma-ingest-mocked', 'mocks', 'figma', 'fixtures', 'metadata.xml')));
  assert.ok(!existsSync(join(out, 'evals', 'figma-stops-without-mcp', 'mocks')), 'the missing-MCP case has no mocks');
});
```

Run: `node --test test/creator/build-creator-eval.test.mjs`
Expected: FAIL on `metadata.xml` (the cases do not exist yet and the script does not copy).

In `scripts/build-creator-eval.mjs` add `existsSync, readdirSync` to the `node:fs` import and, before `return out;` in `stage()`:

```js
  const figmaFixtures = join(ROOT, 'test', 'fixtures', 'creator', 'figma');
  for (const entry of readdirSync(join(out, 'evals'), { withFileTypes: true })) {
    const mocks = join(out, 'evals', entry.name, 'mocks', 'figma');
    if (entry.isDirectory() && existsSync(mocks)) cpSync(figmaFixtures, join(mocks, 'fixtures'), { recursive: true });
  }
```

**Step 3: Write the cases**

The three cases share this `scaffold.sh` (project only, no run folder):

```bash
#!/usr/bin/env bash
set -euo pipefail
fx="$(cd "$(dirname "$0")/../fixtures" && pwd)"
cp -R "$fx/projects/acme-mu-plugin/." .
```

and a `case.yaml` of the same shape as in Task 32 with their own `name`.

`plugins/kivo-creator/evals/figma-stops-without-mcp/` has no `mocks/` folder: the staged `figma` server therefore does not start.

`prompt.md`:

```markdown
---
description: Without the Figma MCP server the ingest stops and explains how to connect it, inventing nothing
tags: [skill, figma-ingest]
max_turns: 12
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write]
---

Turn this Figma frame into a page with our blocks: https://www.figma.com/design/AbC123acme/Acme-Landing?node-id=1-2
```

Graders:

`skill-fired.md`:

```markdown
---
type: tool_used
tool: Skill
input_match: '"skill"\s*:\s*"(?:[\w-]+:)?(figma-ingest|creator)"'
---
```

`no-specs.md`:

```markdown
---
type: file_exists
path: '.creator/**/specs/*.json'
exists: false
arm: both
weight: 2
---
```

`explains.md`:

```markdown
---
type: llm
focus: last_message
---
PASS if the reply says the Figma MCP server is not available in this session, explains how to connect the official server (the remote server URL or the desktop app's local server) and stops. FAIL if it describes the design's content, writes specs, or offers to guess from the URL.
```

`plugins/kivo-creator/evals/figma-ingest-mocked/` mocks under `mocks/figma/`:

`get_metadata.md`:

```markdown
---
expect:
  nodeId: '/^1[:-]2$/'
---
{{file:fixtures/metadata.xml}}
```

`get_variable_defs.md`:

```markdown
{{file:fixtures/variables.json}}
```

`get_design_context.md`:

```markdown
---
expect:
  nodeId: string
---
{{file:fixtures/design-context-{input.nodeId}.md}}
```

`get_screenshot.md`:

```markdown
Screenshot not available in this recording; use get_design_context.
```

`get_code_connect_map.md`:

```markdown
{{file:fixtures/code-connect-map.json}}
```

`prompt.md`:

```markdown
---
description: With recorded Figma responses the ingest writes valid specs with exact values and no copied Tailwind classes
tags: [skill, figma-ingest]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]
---

Ingest this Figma frame into section specs for our project and stop before matching: https://www.figma.com/design/AbC123acme/Acme-Landing?node-id=1-2
```

Graders:

`context-read.md`:

```markdown
---
type: tool_used
tool: mcp__plugin_kivo-creator_figma__get_design_context
min: 3
---
```

`hero-spec.md`:

```markdown
---
type: regex
target: files
pattern: '\.creator/[^/\n]+/specs/02-hero\.json'
weight: 2
---
```

`validated.md`:

```markdown
---
type: tool_used
tool: Bash
input_match: 'validate-spec\.mjs'
---
```

`no-copied-classes.md`:

```markdown
---
type: regex
target: trace
pattern: 'specs/[^"]*\.json[^}]*(px-\[|text-\[|var\(--color)'
match: not_contains
weight: 2
---
```

`exact-values.md`:

```markdown
---
type: llm
focus: last_message
---
PASS if the reply lists the sections it wrote (hero, features, pricing table, call to action, with header and footer as chrome), says values come from the design context or variables, and does not claim reference images exist unless a token was available. FAIL if it invents copy that is not in the recorded design context or says blocks were generated.
```

`plugins/kivo-creator/evals/code-connect-asks-first/` mocks under `mocks/figma/`: `get_metadata.md` and `get_code_connect_map.md` as above, plus:

`send_code_connect_mappings.md`:

```markdown
Mappings saved.
```

`prompt.md`:

```markdown
---
description: Code Connect proposals are shown for approval; nothing is sent in the first turn
tags: [skill, code-connect]
max_turns: 25
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write]
---

Set up Code Connect for our Figma file so its components point at our blocks and Blade components: https://www.figma.com/design/AbC123acme/Acme-Landing?node-id=1-2
```

Graders:

`skill-fired.md` (`input_match: '"skill"\s*:\s*"(?:[\w-]+:)?code-connect"'`, `type: tool_used`, `tool: Skill`).

`nothing-sent.md`:

```markdown
---
type: tool_used
tool: mcp__plugin_kivo-creator_figma__send_code_connect_mappings
min: 0
max: 0
arm: both
weight: 3
---
```

`proposal.md`:

```markdown
---
type: llm
focus: last_message
---
PASS if the reply (1) says Button/Primary is already mapped to x-button, (2) proposes Hero/Default to the acf/hero block, (3) lists Logo/Acme, Feature Card and Pricing/Plan as having no code counterpart, and (4) asks for approval before sending anything. FAIL if any mapping is described as already sent, or if approval is not requested.
```

**Step 4: Run the staging test and the evals**

Run: `chmod +x plugins/kivo-creator/evals/*/scaffold.sh && node --test test/creator/build-creator-eval.test.mjs`
Expected: PASS (`pass 2`, `fail 0`)

```bash
node scripts/build-creator-eval.mjs
claude plugin eval .creator-eval/kivo-creator --scaffold --allow-tools Bash Write Edit --case 'figma-*' --runs 1 --ablation none --no-publish
claude plugin eval .creator-eval/kivo-creator --scaffold --allow-tools Bash Write --case code-connect-asks-first --runs 1 --ablation none --no-publish
```

Expected: `figma-stops-without-mcp` shows `figma[not started: no mock]` and passes; the mocked cases answer from the recordings (no network). If `{{file:fixtures/design-context-{input.nodeId}.md}}` cannot resolve a node id with a colon on your platform, rename the fixtures to `design-context-1-10.md` and switch the mock to a `type: agent` mock whose body tells the judge to answer with the matching file's content; record the change in the commit body.

**Step 5: Commit**

```bash
git add test/fixtures/creator/figma scripts/build-creator-eval.mjs test/creator/build-creator-eval.test.mjs plugins/kivo-creator/evals
git commit -m "test(kivo-creator): add Figma evals with recorded MCP responses"
```

---

### Task 40: Phase 2 documentation

**Files:**
- Modify: `docs/provenance.md` (kivo-creator section)

**Step 1: Extend the provenance section**

Append these bullets to the kivo-creator section:

```markdown
- Figma: tool names and the main-session limit come from the official Figma MCP server documentation and the design (`get_metadata`, `get_design_context`, `get_variable_defs`, `get_screenshot`, `get_code_connect_map`, `send_code_connect_mappings`). Fixture responses in `test/fixtures/creator/figma/` follow the shape of real answers with invented acme content.
- Code Connect proposals use word similarity between component and block names (`scripts/lib/code-connect.mjs`); sending is always gated by the person's approval.
- Reference images come from the Figma REST images endpoint (`/v1/images/:key`) with a personal access token, because MCP screenshots are not written to disk.
```

**Step 2: Check and commit**

Run: `node --test test/creator/ && node scripts/validate-skills.mjs --root plugins/kivo-creator`
Expected: `fail 0`, exit 0.

```bash
git add docs/provenance.md
git commit -m "docs(kivo-creator): record the Figma and Code Connect sources"
```

---

# Phase 3: `sage-theme` and `radicle` adapters

Radicle documentation now lives in a licensed repository; use only what is public (the kivo-wise detector output, the public Roots site and README files) and the project's own files. The native-block adapter therefore follows the project's existing `block.json` files instead of assuming a folder layout.

### Task 41: Native block catalog (`block.json`)

**Files:**
- Create: `plugins/kivo-creator/scripts/adapters/shared/native-block.mjs`
- Create: `test/fixtures/creator/projects/acme-radicle/.roots-stack.json`, `composer.json`, `resources/css/app.css`, `resources/blocks/hero/block.json`, `resources/blocks/faq/block.json`
- Test: `test/creator/native-catalog.test.mjs`

**Step 1: Create the fixture project**

`test/fixtures/creator/projects/acme-radicle/.roots-stack.json`:

```json
{ "profile": "radicle-app", "app": ".", "runner": "lando" }
```

`composer.json`:

```json
{ "name": "acme/site", "autoload": { "psr-4": { "App\\": "app/" } }, "require": { "roots/acorn": "^6.3" } }
```

`resources/css/app.css`: same content as the acme-mu-plugin `app.css` (Task 17).

`resources/blocks/hero/block.json`:

```json
{
  "$schema": "https://schemas.wp.org/trunk/block.json",
  "apiVersion": 3,
  "name": "acme/hero",
  "title": "Hero",
  "category": "design",
  "description": "Page opening with a heading, a lead, an image and a button.",
  "attributes": {
    "heading": { "type": "string" },
    "lead": { "type": "string" },
    "image": { "type": "object" },
    "button": { "type": "object" },
    "dark": { "type": "boolean", "default": false }
  }
}
```

`resources/blocks/faq/block.json`:

```json
{
  "$schema": "https://schemas.wp.org/trunk/block.json",
  "apiVersion": 3,
  "name": "acme/faq",
  "title": "FAQ",
  "category": "design",
  "description": "Questions and answers.",
  "attributes": {
    "title": { "type": "string" },
    "items": { "type": "array", "items": { "type": "object", "properties": { "question": { "type": "string" }, "answer": { "type": "string", "source": "html" } } } }
  }
}
```

**Step 2: Write the failing test**

```js
// test/creator/native-catalog.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { nativeCatalog, nativeField } from '../../plugins/kivo-creator/scripts/adapters/shared/native-block.mjs';
import { resolveStack } from '../../plugins/kivo-creator/scripts/lib/stack.mjs';
import { FIX } from './helpers.mjs';

const stack = resolveStack(join(FIX, 'projects', 'acme-radicle'));

test('reads every block.json below the app, skipping vendor and build folders', () => {
  const catalog = nativeCatalog(stack);
  assert.deepEqual(catalog.map((b) => b.name), ['acme/faq', 'acme/hero']);
  const hero = catalog.find((b) => b.name === 'acme/hero');
  assert.equal(hero.source, 'resources/blocks/hero/block.json');
  assert.deepEqual(hero.fields, [
    { name: 'heading', type: 'text' },
    { name: 'lead', type: 'text' },
    { name: 'image', type: 'image' },
    { name: 'button', type: 'link' },
  ]);
  assert.deepEqual(catalog[0].fields[1], { name: 'items', type: 'repeater', subFields: [{ name: 'question', type: 'text' }, { name: 'answer', type: 'wysiwyg' }] });
});

test('attribute types translate into the field vocabulary', () => {
  assert.deepEqual(nativeField('video_url', { type: 'string' }), { name: 'video_url', type: 'url' });
  assert.equal(nativeField('dark', { type: 'boolean' }), null);
  assert.equal(nativeField('settings', { type: 'object' }), null);
});
```

**Step 3: Run it to see it fail**

Run: `node --test test/creator/native-catalog.test.mjs`
Expected: FAIL with `Cannot find module '.../adapters/shared/native-block.mjs'`

**Step 4: Implement the catalog part**

```js
// plugins/kivo-creator/scripts/adapters/shared/native-block.mjs
/**
 * Native blocks (block.json). Used by the radicle adapter and by sage-theme
 * when the theme registers blocks without ACF Composer. The layout follows the
 * project's existing block.json files; nothing about folders is assumed.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { posix } from './names.mjs';

const SKIP = new Set(['node_modules', 'vendor', 'public', 'storage', 'build', 'dist', '.git', '.creator', 'wp', 'uploads']);

function* blockJsonFiles(dir, depth = 0) {
  if (depth > 6 || !existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) { if (!SKIP.has(entry.name)) yield* blockJsonFiles(join(dir, entry.name), depth + 1); }
    else if (entry.name === 'block.json') yield join(dir, entry.name);
  }
}

export function nativeField(name, attr) {
  if (attr.type === 'string') {
    if (/url|href|embed|video/i.test(name)) return { name, type: 'url' };
    return { name, type: attr.source === 'html' || attr.source === 'rich-text' ? 'wysiwyg' : 'text' };
  }
  if (attr.type === 'object') {
    if (/image|media|photo|picture|icon|avatar/i.test(name)) return { name, type: 'image' };
    if (/link|button|cta/i.test(name)) return { name, type: 'link' };
    return null;
  }
  if (attr.type === 'array') {
    const props = attr.items?.properties ?? {};
    return { name, type: 'repeater', subFields: Object.entries(props).map(([n, a]) => nativeField(n, a)).filter(Boolean) };
  }
  return null;
}

export function nativeCatalog(stack) {
  const blocks = [];
  for (const file of blockJsonFiles(stack.appPath)) {
    let json;
    try { json = JSON.parse(readFileSync(file, 'utf8')); } catch { continue; }
    if (!json.name) continue;
    blocks.push({
      name: json.name,
      slug: json.name.split('/')[1],
      title: json.title ?? json.name,
      description: json.description ?? '',
      whenToUse: json.description ?? '',
      source: posix(relative(stack.projectDir, file)),
      dir: posix(relative(stack.projectDir, dirname(file))),
      fields: Object.entries(json.attributes ?? {}).map(([n, a]) => nativeField(n, a)).filter(Boolean),
    });
  }
  return blocks.sort((a, b) => a.name.localeCompare(b.name));
}
```

`hero.fields` drops the boolean `dark` attribute: settings are not content slots.

**Step 5: Run the test**

Run: `node --test test/creator/native-catalog.test.mjs`
Expected: PASS (`pass 2`, `fail 0`)

**Step 6: Commit**

```bash
git add plugins/kivo-creator/scripts/adapters/shared/native-block.mjs test/creator/native-catalog.test.mjs test/fixtures/creator/projects/acme-radicle
git commit -m "feat(kivo-creator): read native block.json blocks into the catalog"
```

---

### Task 42: Native emit and scaffold

**Files:**
- Modify: `plugins/kivo-creator/scripts/adapters/shared/native-block.mjs` (append)
- Create: `test/fixtures/creator/golden/native/stats.blade.php`
- Test: `test/creator/native-emit.test.mjs`

**Step 1: Write the golden view**

`test/fixtures/creator/golden/native/stats.blade.php`:

```blade
{{-- Generated by kivo-creator from html body > main > section:nth-of-type(4). --}}
<section {!! get_block_wrapper_attributes(['class' => 'text-center bg-surface pt-16 pb-16', 'data-block' => 'stats']) !!}>
  @if (! empty($data['heading']))
    <h2 class="text-ink text-4xl font-bold">{{ $data['heading'] }}</h2>
  @endif
  @if (! empty($data['items']))
    <ul class="grid gap-8 md:grid-cols-3">
      @foreach ($data['items'] as $item)
        <li>
          @if (! empty($item['heading']))
            <h3 class="text-ink text-4xl font-bold">{{ $item['heading'] }}</h3>
          @endif
          @if (! empty($item['text']))
            <p class="text-muted">{{ $item['text'] }}</p>
          @endif
        </li>
      @endforeach
    </ul>
  @endif
</section>
```

**Step 2: Write the failing test**

```js
// test/creator/native-emit.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nativeCatalog, emitNativePage, scaffoldNative } from '../../plugins/kivo-creator/scripts/adapters/shared/native-block.mjs';
import { resolveStack } from '../../plugins/kivo-creator/scripts/lib/stack.mjs';
import { readSpecs } from '../../plugins/kivo-creator/scripts/lib/spec.mjs';
import { assign } from '../../plugins/kivo-creator/scripts/lib/fill.mjs';
import { loadTheme } from '../../plugins/kivo-creator/scripts/lib/tokens.mjs';
import { lintSource } from '../../plugins/kivo-creator/scripts/lib/lint.mjs';
import { FIX } from './helpers.mjs';

const stack = resolveStack(join(FIX, 'projects', 'acme-radicle'));
const catalog = nativeCatalog(stack);
const specs = readSpecs(join(FIX, 'runs', 'landing', 'specs'));
const theme = loadTheme(readFileSync(join(stack.appPath, 'resources', 'css', 'app.css'), 'utf8'));

test('emits native block markup with attribute values', () => {
  const hero = catalog.find((b) => b.name === 'acme/hero');
  const { markup, media } = emitNativePage([{ block: hero, spec: specs[0], pairs: assign(specs[0].slots, hero.fields).pairs }]);
  assert.equal(markup, '<!-- wp:acme/hero {"heading":"Acme ships faster","lead":"Plan, build and launch in one place.","image":{"url":"https://acme.test/hero.png","alt":"Acme dashboard"},"button":{"url":"https://acme.test/signup","text":"Start free"}} /-->\n');
  assert.deepEqual(media, [{ spec: '01-hero', block: 'acme/hero', field: 'image', src: 'https://acme.test/hero.png', alt: 'Acme dashboard' }]);
});

test('scaffolds block.json next to the existing blocks, a Blade view and registration notes', () => {
  const out = scaffoldNative(stack, specs[3], { theme, catalog });
  assert.deepEqual(out.files.map((f) => f.path), ['resources/blocks/stats/block.json', 'resources/views/blocks/stats.blade.php', 'resources/css/blocks/stats.css']);
  assert.deepEqual(JSON.parse(out.files[0].content), {
    $schema: 'https://schemas.wp.org/trunk/block.json',
    apiVersion: 3,
    name: 'acme/stats',
    title: 'Stats',
    category: 'design',
    description: 'Stats section generated from the design.',
    attributes: {
      heading: { type: 'string' },
      items: { type: 'array', items: { type: 'object', properties: { heading: { type: 'string' }, text: { type: 'string' } } } },
    },
    supports: { html: false, anchor: true },
  });
  assert.equal(out.files[1].content, readFileSync(join(FIX, 'golden', 'native', 'stats.blade.php'), 'utf8'));
  assert.deepEqual(out.commands, []);
  assert.match(out.notes.join('\n'), /register_block_type\(.*resources\/blocks\/stats/);
  assert.match(out.notes.join('\n'), /editor/);
  for (const f of out.files) assert.deepEqual(lintSource(f.content, f.path), [], f.path);
});

test('the scaffolded block reads back into the catalog with the same fields', () => {
  const out = scaffoldNative(stack, specs[3], { theme, catalog });
  const json = JSON.parse(out.files[0].content);
  assert.deepEqual(Object.keys(json.attributes), out.block.fields.map((f) => f.name));
  assert.deepEqual(out.block.fields[1].subFields.map((f) => f.type), ['text', 'text']);
});
```

**Step 3: Run it to see it fail**

Run: `node --test test/creator/native-emit.test.mjs`
Expected: FAIL with `does not provide an export named 'emitNativePage'`

**Step 4: Implement**

Add to the imports of `native-block.mjs`: `import { assign, valueFor } from '../../lib/fill.mjs';`, `import { serializeBlock } from '../../lib/block-markup.mjs';`, `import { roleUtilities } from '../../lib/tokens.mjs';`, `import { renderView } from './blade-view.mjs';`, `import { fieldsFromSlots, uniqueName, renderBlockCss, WHEN } from './acf-composer.mjs';` and extend the `./names.mjs` import with `kebab`. Then append:

```js
function nativeValue(slot, field, media, at) {
  switch (field.type) {
    case 'image':
      media.push({ ...at, field: field.name, src: slot.value?.src ?? null, alt: slot.value?.alt ?? '' });
      return { url: slot.value?.src ?? '', alt: slot.value?.alt ?? '' };
    case 'link':
      return { url: slot.value?.href ?? '', text: slot.value?.text ?? '' };
    case 'repeater':
      return (slot.items ?? []).map((item) => Object.fromEntries(assign(item, field.subFields ?? []).pairs.map((p) => [p.field.name, nativeValue(p.slot, p.field, media, at)])));
    default:
      return valueFor(slot, field);
  }
}

/** Block markup with attributes; images keep their URL (listed in media for an optional import). */
export function emitNativePage(entries) {
  const media = [];
  const parts = entries.map(({ block, spec, pairs }) => {
    const attrs = Object.fromEntries(pairs.map((p) => [p.field.name, nativeValue(p.slot, p.field, media, { spec: spec.id, block: block.name })]));
    return serializeBlock(block.name, attrs);
  });
  return { markup: `${parts.join('\n\n')}\n`, media };
}

const ATTRIBUTE = { text: 'string', textarea: 'string', wysiwyg: 'string', oembed: 'string', image: 'object', link: 'object' };
const NATIVE_TYPE = { text: 'text', textarea: 'text', wysiwyg: 'wysiwyg', oembed: 'url', image: 'image', link: 'link' };

const attributeFor = (f) => (f.acfType === 'repeater'
  ? { type: 'array', items: { type: 'object', properties: Object.fromEntries(f.subFields.map((s) => [s.name, attributeFor(s)])) } }
  : { type: ATTRIBUTE[f.acfType] });
const catalogField = (f) => (f.acfType === 'repeater' ? { name: f.name, type: 'repeater', subFields: f.subFields.map(catalogField) } : { name: f.name, type: NATIVE_TYPE[f.acfType] });

function mostCommon(values, fallback) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
}

/**
 * New native block: block.json beside the existing ones, a Blade view that
 * reads $data, and notes for the registration and the editor UI (neither is
 * generated: they follow project conventions this plugin cannot see).
 */
export function scaffoldNative(stack, spec, { theme, catalog = [], fallbackPrefix = 'app', fallbackDir = 'resources/blocks' }) {
  const { slug, title } = uniqueName(spec, catalog.map((b) => ({ ...b, className: '' })));
  const prefix = mostCommon(catalog.map((b) => b.name.split('/')[0]), fallbackPrefix);
  const app = posix(relative(stack.projectDir, stack.appPath));
  const blocksDir = mostCommon(catalog.filter((b) => b.dir).map((b) => posix(dirname(b.dir))), posix(join(app, fallbackDir)));
  const { fields, notes } = fieldsFromSlots(spec.slots);
  const { utils, proposals } = roleUtilities(spec.tokens, theme);
  const name = `${prefix}/${slug}`;
  const blockJson = {
    $schema: 'https://schemas.wp.org/trunk/block.json',
    apiVersion: 3,
    name,
    title,
    category: 'design',
    description: `${title} section generated from the design.`,
    attributes: Object.fromEntries(fields.map((f) => [f.name, attributeFor(f)])),
    supports: { html: false, anchor: true },
  };
  const at = (...parts) => posix(join(app, ...parts));
  const blockDir = posix(join(blocksDir, slug));
  const files = [
    { path: `${blockDir}/block.json`, content: `${JSON.stringify(blockJson, null, 2)}\n` },
    { path: at('resources', 'views', 'blocks', `${slug}.blade.php`), content: renderView({ slug, spec, fields, utils, flavour: 'native' }) },
    { path: at('resources', 'css', 'blocks', `${slug}.css`), content: renderBlockCss({ name, spec, proposals }) },
  ];
  notes.push(
    `register the block where the project registers the others, on init: register_block_type(base_path('${blockDir}'), ['render_callback' => fn ($attributes) => view('blocks.${slug}', ['data' => $attributes])->render()]); (adjust base_path to the project's helper)`,
    'the editor UI (edit script) is not generated: run the project\'s make:block generator if it has one, or add a ServerSideRender edit script the way the existing blocks do',
  );
  const block = { name, slug, title, description: blockJson.description, whenToUse: WHEN[spec.kind], source: files[0].path, dir: blockDir, fields: fields.map(catalogField) };
  return { block, commands: [], files, notes, proposals };
}
```

`uniqueName()` compares `className` and `slug`; native blocks have no class, so the catalog is passed with an empty `className`.

**Step 5: Run the test**

Run: `node --test test/creator/native-emit.test.mjs test/creator/native-catalog.test.mjs`
Expected: PASS (`pass 5`, `fail 0`)

**Step 6: Commit**

```bash
git add plugins/kivo-creator/scripts/adapters/shared/native-block.mjs test/creator/native-emit.test.mjs test/fixtures/creator/golden/native
git commit -m "feat(kivo-creator): emit and scaffold native block.json blocks"
```

---

### Task 43: `sage-theme` adapter

**Files:**
- Create: `plugins/kivo-creator/scripts/adapters/sage-theme.mjs`
- Modify: `plugins/kivo-creator/scripts/adapters/index.mjs` (add the loader)
- Create: `test/fixtures/creator/projects/acme-sage/.roots-stack.json`, `web/app/themes/acme/composer.json`, `web/app/themes/acme/app/Blocks/Hero.php`, `web/app/themes/acme/resources/css/app.css`
- Test: `test/creator/sage-theme.test.mjs`

**Step 1: Create the fixture**

`.roots-stack.json`:

```json
{ "profile": "sage-theme", "app": "web/app/themes/acme", "runner": "lando" }
```

`web/app/themes/acme/composer.json`:

```json
{ "name": "acme/acme-theme", "type": "wordpress-theme", "autoload": { "psr-4": { "App\\": "app/" } }, "require": { "roots/acorn": "^6.2", "log1x/acf-composer": "^3.4" } }
```

`web/app/themes/acme/app/Blocks/Hero.php`: the acme-mu-plugin `Hero.php` from Task 22 with `namespace App\Blocks;`.

`web/app/themes/acme/resources/css/app.css`: same content as Task 17.

**Step 2: Write the failing test**

```js
// test/creator/sage-theme.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { selectAdapter } from '../../plugins/kivo-creator/scripts/adapters/index.mjs';
import { resolveStack } from '../../plugins/kivo-creator/scripts/lib/stack.mjs';
import { readSpecs } from '../../plugins/kivo-creator/scripts/lib/spec.mjs';
import { assign } from '../../plugins/kivo-creator/scripts/lib/fill.mjs';
import { loadTheme } from '../../plugins/kivo-creator/scripts/lib/tokens.mjs';
import { FIX } from './helpers.mjs';

const specs = readSpecs(join(FIX, 'runs', 'landing', 'specs'));

test('ACF Composer theme: catalog, emit and scaffold inside the theme with the theme namespace', async () => {
  const stack = resolveStack(join(FIX, 'projects', 'acme-sage'));
  const adapter = await selectAdapter(stack);
  assert.equal(adapter.name, 'sage-theme');
  const catalog = adapter.catalog(stack);
  assert.deepEqual(catalog.map((b) => b.name), ['acf/hero']);
  const { markup } = adapter.emitPage(stack, [{ block: catalog[0], spec: specs[0], pairs: assign(specs[0].slots, catalog[0].fields).pairs }]);
  assert.match(markup, /^<!-- wp:acf\/hero \{"name":"acf\/hero","data":\{"title":"Acme ships faster"/);
  const out = adapter.scaffoldBlock(stack, specs[3], { theme: loadTheme(readFileSync(adapter.themeCss(stack), 'utf8')), catalog });
  assert.equal(out.files[0].path, 'web/app/themes/acme/app/Blocks/Stats.php');
  assert.match(out.files[0].content, /^<\?php\n\nnamespace App\\Blocks;/);
});

test('native theme: block.json catalog and native scaffold', async () => {
  const base = resolveStack(join(FIX, 'projects', 'acme-radicle'));
  const stack = { ...base, profile: 'sage-theme', blocks: 'native' };
  const adapter = await selectAdapter(stack);
  assert.deepEqual(adapter.catalog(stack).map((b) => b.name), ['acme/faq', 'acme/hero']);
  const out = adapter.scaffoldBlock(stack, specs[3], { theme: loadTheme(''), catalog: adapter.catalog(stack) });
  assert.equal(out.block.name, 'acme/stats');
});
```

**Step 3: Run it to see it fail**

Run: `node --test test/creator/sage-theme.test.mjs`
Expected: FAIL with `The sage-theme adapter is not available yet`

**Step 4: Implement**

```js
// plugins/kivo-creator/scripts/adapters/sage-theme.mjs
import { acfCatalog, emitAcfPage, findThemeCss, scaffoldAcf } from './shared/acf-composer.mjs';
import { emitNativePage, nativeCatalog, scaffoldNative } from './shared/native-block.mjs';

const usesAcf = (stack) => stack.blocks === 'acf-composer';

export default {
  name: 'sage-theme',
  profiles: ['sage-theme'],
  selector: '[data-block]',
  allowsGeneratedBlocks: true,
  catalog: (stack) => (usesAcf(stack) ? acfCatalog(stack) : nativeCatalog(stack)),
  emitPage: (stack, entries) => (usesAcf(stack) ? emitAcfPage(entries) : emitNativePage(entries)),
  scaffoldBlock: (stack, spec, options) => (usesAcf(stack) ? scaffoldAcf(stack, spec, options) : scaffoldNative(stack, spec, options)),
  themeCss: (stack) => findThemeCss(stack.appPath),
};
```

In `plugins/kivo-creator/scripts/adapters/index.mjs` add to `LOADERS`:

```js
  'sage-theme': () => import('./sage-theme.mjs'),
```

**Step 5: Run the tests**

Run: `node --test test/creator/sage-theme.test.mjs test/creator/adapters.test.mjs`
Expected: PASS (`pass 4`, `fail 0`)

**Step 6: Commit**

```bash
git add plugins/kivo-creator/scripts/adapters test/creator/sage-theme.test.mjs test/fixtures/creator/projects/acme-sage
git commit -m "feat(kivo-creator): add the sage-theme adapter"
```

---

### Task 44: `radicle` adapter

**Files:**
- Create: `plugins/kivo-creator/scripts/adapters/radicle.mjs`
- Modify: `plugins/kivo-creator/scripts/adapters/index.mjs` (add the loader)
- Test: `test/creator/radicle.test.mjs`

**Step 1: Write the failing test**

```js
// test/creator/radicle.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdirSync, cpSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { selectAdapter } from '../../plugins/kivo-creator/scripts/adapters/index.mjs';
import { resolveStack } from '../../plugins/kivo-creator/scripts/lib/stack.mjs';
import { FIX, PLUGIN, tmpCopy } from './helpers.mjs';

test('radicle-app profile selects the native radicle adapter', async () => {
  const stack = resolveStack(join(FIX, 'projects', 'acme-radicle'));
  const adapter = await selectAdapter(stack);
  assert.equal(adapter.name, 'radicle');
  assert.deepEqual(adapter.catalog(stack).map((b) => b.name), ['acme/faq', 'acme/hero']);
  assert.equal(adapter.themeCss(stack), join(stack.appPath, 'resources', 'css', 'app.css'));
});

test('match and emit work end to end on the radicle fixture', () => {
  const project = tmpCopy(join(FIX, 'projects', 'acme-radicle'));
  const run = join(project, '.creator', 'run-1');
  mkdirSync(run, { recursive: true });
  cpSync(join(FIX, 'runs', 'landing', 'specs'), join(run, 'specs'), { recursive: true });
  const node = (script, ...args) => spawnSync(process.execPath, [join(PLUGIN, 'scripts', script), `--project=${project}`, `--run=${run}`, ...args], { encoding: 'utf8' });
  const built = node('match.mjs');
  assert.equal(built.status, 0, built.stderr);
  assert.deepEqual(JSON.parse(built.stdout).judge, ['01-hero', '02-faq', '03-testimonial', '04-stats']);
});
```

**Step 2: Run it to see it fail**

Run: `node --test test/creator/radicle.test.mjs`
Expected: FAIL with `The radicle adapter is not available yet`

**Step 3: Implement**

```js
// plugins/kivo-creator/scripts/adapters/radicle.mjs
/**
 * Radicle projects register native blocks (block.json) from the project root.
 * Folder layout and the generator are read from the project, not assumed:
 * new blocks go next to the existing block.json files.
 */
import { findThemeCss } from './shared/acf-composer.mjs';
import { emitNativePage, nativeCatalog, scaffoldNative } from './shared/native-block.mjs';

export default {
  name: 'radicle',
  profiles: ['radicle-app'],
  selector: '[data-block]',
  allowsGeneratedBlocks: true,
  catalog: (stack) => nativeCatalog(stack),
  emitPage: (stack, entries) => emitNativePage(entries),
  scaffoldBlock: (stack, spec, options) => scaffoldNative(stack, spec, options),
  themeCss: (stack) => findThemeCss(stack.appPath),
};
```

In `index.mjs` add to `LOADERS`:

```js
  radicle: () => import('./radicle.mjs'),
```

**Step 4: Run the tests**

Run: `node --test test/creator/radicle.test.mjs test/creator/adapters.test.mjs`
Expected: PASS (`pass 4`, `fail 0`)

Why every spec waits for judgment on this fixture: `acme/hero` holds the hero and the testimonial (two texts and an image); `acme/faq` holds the faq and the stats items. The model decides with the rubric.

**Step 5: Commit**

```bash
git add plugins/kivo-creator/scripts/adapters test/creator/radicle.test.mjs
git commit -m "feat(kivo-creator): add the radicle adapter"
```

---

### Task 45: Skills and docs know the three adapters

**Files:**
- Modify: `plugins/kivo-creator/skills/block-scaffolding-from-design/SKILL.md`
- Modify: `docs/provenance.md`

**Step 1: Add the native-block notes to the scaffolding skill**

In `block-scaffolding-from-design`, Procedure step 3, add a fourth sub-step after "copy the reviewed files over the generated ones":

```markdown
   5. native blocks (`sage-theme` without ACF Composer, `radicle`): `emitted.commands` is empty. If `{{runner.acorn}} list` shows a `make:block` generator, run it first and compare; otherwise copy `block.json`, the view and the CSS notes, then follow `emitted.notes` for the registration and the editor script, matching how the existing blocks do it.
```

(The sub-steps were numbered 1 to 4; this becomes 5.)

**Step 2: Extend the provenance section**

```markdown
- Native blocks (`sage-theme` without ACF Composer, `radicle`): catalog from the project's own `block.json` files; new blocks are placed next to them. Radicle specifics were not read from licensed documentation; the adapter relies on the kivo-wise detector (`blocks: native`) and on the project's files. Registration and editor scripts are left as notes because their conventions differ per project.
```

**Step 3: Validate and commit**

Run: `node scripts/validate-skills.mjs --root plugins/kivo-creator`
Expected: seven `✓` lines, exit 0.

```bash
git add plugins/kivo-creator/skills/block-scaffolding-from-design/SKILL.md docs/provenance.md
git commit -m "docs(kivo-creator): document the sage-theme and radicle adapters"
```

---

### Task 46: Final verification

**Step 1: Run every check CI runs**

```bash
node --test test/*.test.mjs test/creator/*.test.mjs
node scripts/validate-skills.mjs
node scripts/validate-skills.mjs --root plugins/kivo-creator
node scripts/test-validate-skills.mjs
node scripts/sync-cursor-hooks.mjs --check
node scripts/sync-codex-manifests.mjs --check
node scripts/build-codex-plugin.mjs --check
claude plugin validate . --strict
claude plugin validate plugins/kivo-creator --strict
```

Expected: every command exits 0; the test summary ends with `fail 0`.

**Step 2: Public-content check**

```bash
git grep -nIiE 'lndo\.site|/home/|/Users/' -- plugins/kivo-creator test/fixtures/creator test/creator docs/provenance.md
git grep -nIi 'radicle' -- plugins/kivo-creator | grep -vi 'radicle-app\|radicle adapter\|radicle\.mjs\|`radicle`'
```

Expected: no output from the first command; the second shows only neutral mentions (adapter names, profile names). Any client name, licensed text or local path must be removed.

**Step 3: Run the full eval suite once**

```bash
node scripts/build-creator-eval.mjs
claude plugin eval .creator-eval/kivo-creator --scaffold --allow-tools Bash Write Edit --no-publish
```

Expected: seven cases run with the default three runs and the no-plugin baseline. Record the with-plugin scores and Δ in the merge request description.

**Step 4: Try the real flow once on the HTML fixture (local, not committed)**

In a scratch copy of `test/fixtures/creator/projects/acme-mu-plugin` with Playwright installed:

```bash
node plugins/kivo-creator/scripts/ingest-html.mjs --source=test/fixtures/creator/html/acme-landing.html --project=<scratch>
node plugins/kivo-creator/scripts/match.mjs --run=<scratch>/.creator/<run> --project=<scratch>
```

Expected: six specs (header and footer as chrome) and a plan with the four content sections waiting for judgment or decided. Nothing in `<scratch>` changes outside `.creator/`.

**Step 5: Commit any fixes, then stop**

Do not push and do not open the merge request unless asked. The first release of `kivo-creator` (0.1.0) happens when release-please opens its PR after the merge.

---

## Open questions

1. **Recorded Figma responses:** the files in `test/fixtures/creator/figma/` follow the shape of the official server's answers with invented acme content. Should they be replaced with real recordings from a public acme demo file before 0.1.0 (needs a Figma account and a file that may be public)?
2. **Where `ingest-html.mjs` and `verify.mjs` run:** they need a browser, so they run where the project's own Playwright runs (usually the host), not through Lando. kivo-wise's rule says Node tooling goes through the runner; is a read-only browser run on the host an accepted exception, or should the skills route through `{{runner.node}}` when the project runs Playwright inside a container?
3. **`data-block` on existing blocks:** verify finds rendered sections with `[data-block]`. Scaffolded blocks print it; existing blocks usually do not. Accept `--selector` per project, or add a recommended `data-block` attribute to the kivo-wise block conventions?
4. **Dependency and `claude plugin validate --strict`:** if the standalone validation warns about the `kivo-wise` dependency, CI drops `--strict` for `plugins/kivo-creator` (Task 4). Confirm once the validator's behaviour is known.
5. **Cursor marketplace relative source:** Cursor's marketplace is given the same relative string as Claude Code. Confirm Cursor resolves it, or switch its entry to a GitHub subdirectory source.
6. **Radicle conventions:** the radicle adapter places new `block.json` files next to existing ones and leaves registration and the editor script as notes. Someone with access to the licensed Radicle documentation should confirm the default block folder and whether `make:block` is the expected generator.
7. **`@textarea` directive:** the ACF view follows the kivo-wise `AGENTS.md` escaping rule (`@textarea($f)`), which assumes the project registers that directive. Keep it, or emit `{!! nl2br(e($f)) !!}`-style escaping when the directive is absent (kivo-wise currently forbids `nl2br(esc_html())`)?

## Deviations

Recorded while executing the plan; each one is the smallest change that made the task's own test pass or kept the repo checks green.

- **Task 9 (segment):** the unwrapping loops descended into any single visible child with 2+ children, so `main > [hero, hidden cta]` was split into the hero's own children (the `invisible nodes are not sections` test got 2 sections). Unwrapping now only enters a generic wrapper: not a `section` or `article` element and without a heading of its own (`isWrapper`).
- **Task 24 (block markup):** the native-first check against WordPress 7.1 `wp-includes/blocks.php` (`serialize_block_attributes`) showed a sixth replacement, an escaped backslash (`\\`) to `\`, applied with `strtr` (one left-to-right pass). `serializeAttributes` now uses a single alternation regex with the same six replacements, and the test has a backslash case.
- **Task 25 (field keys):** the native-first check (Step 6) against `stoutlogic/acf-builder` `src/Transform/NamespaceFieldKey.php` showed that the key is `field_` + the group name with spaces replaced by `_` + `_` + the field key, lowercased; dashes are kept, and repeater sub fields are namespaced by the inner builder (repeater name) and then by the group. `fieldKey` no longer turns dashes into underscores, and the test asserts the dashed and spaced cases. ACF Pro `pro/blocks.php` passes `$block['data']` to `acf_setup_meta()`, which confirms the `name` / `_name` pairs and `<name>_<i>_<sub>` repeater rows.
- **Section selector (open question 3, decided by the lead):** every adapter keeps a default `selector` (`[data-block]` for `acorn-mu-plugin`) and every script that locates sections accepts `--selector`. `emit.mjs --selector` records the selector (or the adapter default) in `emitted.json`; `verify.mjs` uses `--selector`, then `emitted.json`, then `[data-block]` (`selectorFor`; the parsed default is now empty instead of `[data-block]`); `ingest-html.mjs --selector` takes the project's section elements as they are instead of the segmentation heuristic. Tests cover each path (the ingest one runs with `CREATOR_PLAYWRIGHT_DIR`).
- **Playwright location (open question 2, decided by the lead):** `ingest-html.mjs` and `verify.mjs` run on the host with the target project's own Playwright (`node_modules`), not through Lando. The skills say so.
