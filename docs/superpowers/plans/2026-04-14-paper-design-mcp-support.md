> Historical document from superpowers-sage 2.x. It describes features that were removed or replaced in kivo-wise 3.0 and is kept for reference only.

# Paper.design MCP Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add paper.design MCP as a first-class design source in the `superpowers-sage` plugin, alongside Stitch and Figma, with URL-based routing and enriched extraction (screenshot + computed_styles + JSX) plus a new style spot-check during verification.

**Architecture:** The dispatch of a design source is determined by the URL the user provides (`paper.design/*` → paper, `figma.com/*` → figma, etc.). The `designing` skill gains a paper branch that persists three artifacts per section: `.png`, `.styles.json`, and `.reference.jsx`. The `verifying` skill gains an additive style spot-check that activates only when `.styles.json` is present. All ancillary surfaces (inventory script, hooks, agents, meta-skill, README) are updated to mention paper.

**Tech Stack:** Markdown skill files, Node.js script (`detect-design-tools.mjs`), bash hook (`session-start.sh`), Claude Code MCP tools (`mcp__paper__*`).

**Spec:** `docs/superpowers/specs/2026-04-13-paper-design-mcp-support.md`

---

## Conventions for this plan

- All file paths are absolute from repo root: `C:/Users/leo/Work/superpowers-sage/`.
- Markdown skill edits use the existing `Edit` tool semantics (exact `old_string` → `new_string`). Each task quotes the exact strings.
- Commit messages use Conventional Commits (`feat:`, `docs:`, `chore:`).
- Skill markdown is not automatically testable — those tasks finish with a "manual smoke check" step that reads the file back to confirm the change applied cleanly.
- The Node.js detect script IS automatically testable — that task uses TDD with fixtures.

---

## Task 1: Branch setup

**Files:** none (workspace state)

- [ ] **Step 1: Verify branch and create feature branch**

```bash
cd C:/Users/leo/Work/superpowers-sage
git status
git checkout -b feat/paper-design-mcp-support-2026-04-14
```

Expected: clean working tree (or only `.superpowers-sage/hooks.log` modified, which is fine), then on new branch `feat/paper-design-mcp-support-2026-04-14`.

- [ ] **Step 2: Confirm the spec file exists**

```bash
ls docs/superpowers/specs/2026-04-13-paper-design-mcp-support.md
```

Expected: file listed. If absent, stop and ask the user — the spec is required context.

---

## Task 2: Detect script — fixtures

**Files:**
- Create: `scripts/__fixtures__/mcp-only-paper.json`
- Create: `scripts/__fixtures__/mcp-only-figma.json`
- Create: `scripts/__fixtures__/mcp-only-stitch.json`
- Create: `scripts/__fixtures__/mcp-paper-figma.json`
- Create: `scripts/__fixtures__/mcp-all-three.json`
- Create: `scripts/__fixtures__/mcp-none.json`

- [ ] **Step 1: Create fixture directory**

```bash
mkdir -p C:/Users/leo/Work/superpowers-sage/scripts/__fixtures__
```

- [ ] **Step 2: Write `mcp-only-paper.json`**

```json
{
  "mcpServers": {
    "paper": {
      "command": "npx",
      "args": ["-y", "@paper-design/mcp"]
    }
  }
}
```

- [ ] **Step 3: Write `mcp-only-figma.json`**

```json
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": ["-y", "figma-developer-mcp"]
    }
  }
}
```

- [ ] **Step 4: Write `mcp-only-stitch.json`**

```json
{
  "mcpServers": {
    "stitch": {
      "command": "npx",
      "args": ["-y", "@anthropic/stitch-mcp"]
    }
  }
}
```

- [ ] **Step 5: Write `mcp-paper-figma.json`**

```json
{
  "mcpServers": {
    "paper": {
      "command": "npx",
      "args": ["-y", "@paper-design/mcp"]
    },
    "figma": {
      "command": "npx",
      "args": ["-y", "figma-developer-mcp"]
    }
  }
}
```

- [ ] **Step 6: Write `mcp-all-three.json`**

```json
{
  "mcpServers": {
    "paper": {
      "command": "npx",
      "args": ["-y", "@paper-design/mcp"]
    },
    "figma": {
      "command": "npx",
      "args": ["-y", "figma-developer-mcp"]
    },
    "stitch": {
      "command": "npx",
      "args": ["-y", "@anthropic/stitch-mcp"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@anthropic/playwright-mcp"]
    }
  }
}
```

- [ ] **Step 7: Write `mcp-none.json`**

```json
{
  "mcpServers": {}
}
```

- [ ] **Step 8: Verify all six fixtures exist**

```bash
ls C:/Users/leo/Work/superpowers-sage/scripts/__fixtures__/
```

Expected: six `mcp-*.json` files.

---

## Task 3: Detect script — failing test runner

**Files:**
- Create: `scripts/test-detect-design-tools.mjs`

- [ ] **Step 1: Write the test runner**

This script invokes `detect-design-tools.mjs` against each fixture by setting a temporary working directory containing only the fixture as `.mcp.json`, then asserts on the parsed JSON.

```javascript
#!/usr/bin/env node
// Test runner for detect-design-tools.mjs
// Usage: node scripts/test-detect-design-tools.mjs

import { spawnSync } from 'child_process';
import { mkdtempSync, copyFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DETECT = resolve(__dirname, 'detect-design-tools.mjs');
const FIXTURES = resolve(__dirname, '__fixtures__');

function runDetect(fixtureName) {
  const tmp = mkdtempSync(join(tmpdir(), 'detect-test-'));
  try {
    copyFileSync(join(FIXTURES, fixtureName), join(tmp, '.mcp.json'));
    const res = spawnSync('node', [DETECT, '--path', tmp], { encoding: 'utf8' });
    if (res.status !== 0) {
      throw new Error(`detect exited ${res.status}: ${res.stderr}`);
    }
    return JSON.parse(res.stdout);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

const cases = [
  {
    name: 'only paper',
    fixture: 'mcp-only-paper.json',
    expect: (out) => out.designTools.paper?.configured === true
      && out.designTools.figma?.configured === false
      && out.designTools.stitch?.configured === false,
  },
  {
    name: 'only figma',
    fixture: 'mcp-only-figma.json',
    expect: (out) => out.designTools.figma?.configured === true
      && out.designTools.paper?.configured === false
      && out.designTools.stitch?.configured === false,
  },
  {
    name: 'only stitch',
    fixture: 'mcp-only-stitch.json',
    expect: (out) => out.designTools.stitch?.configured === true
      && out.designTools.paper?.configured === false
      && out.designTools.figma?.configured === false,
  },
  {
    name: 'paper + figma',
    fixture: 'mcp-paper-figma.json',
    expect: (out) => out.designTools.paper?.configured === true
      && out.designTools.figma?.configured === true
      && out.designTools.stitch?.configured === false,
  },
  {
    name: 'all three + playwright',
    fixture: 'mcp-all-three.json',
    expect: (out) => out.designTools.paper?.configured === true
      && out.designTools.figma?.configured === true
      && out.designTools.stitch?.configured === true
      && out.verificationTools.playwright?.configured === true,
  },
  {
    name: 'none',
    fixture: 'mcp-none.json',
    expect: (out) => out.designTools.paper?.configured === false
      && out.designTools.figma?.configured === false
      && out.designTools.stitch?.configured === false,
  },
];

let failed = 0;
for (const c of cases) {
  try {
    const out = runDetect(c.fixture);
    if (!c.expect(out)) {
      console.error(`FAIL: ${c.name}\n  output: ${JSON.stringify(out, null, 2)}`);
      failed++;
    } else {
      console.log(`PASS: ${c.name}`);
    }
  } catch (err) {
    console.error(`ERROR: ${c.name}: ${err.message}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} tests passed`);
```

- [ ] **Step 2: Run the test — verify it FAILS**

```bash
cd C:/Users/leo/Work/superpowers-sage
node scripts/test-detect-design-tools.mjs
```

Expected: at least the four `paper`-related cases (`only paper`, `paper + figma`, `all three + playwright`, `none`) fail with messages like `out.designTools.paper?.configured === false` not being satisfied — because `detect-design-tools.mjs` doesn't know about paper yet. The `only figma`, `only stitch` cases may still pass.

If ALL cases pass at this point, the test runner is wrong — stop and inspect.

---

## Task 4: Detect script — add paper detection

**Files:**
- Modify: `scripts/detect-design-tools.mjs`

- [ ] **Step 1: Add paper to `detectMCPServers`**

Use `Edit` to replace this block (the figma branch + the playwright/chrome branches):

`old_string`:
```
    if (nameLower.includes('stitch') || cmdStr.includes('stitch')) {
      result.stitch = { name, configured: true };
    }
    if (nameLower.includes('figma') || cmdStr.includes('figma')) {
      result.figma = { name, configured: true };
    }
```

`new_string`:
```
    if (nameLower.includes('stitch') || cmdStr.includes('stitch')) {
      result.stitch = { name, configured: true };
    }
    if (nameLower.includes('figma') || cmdStr.includes('figma')) {
      result.figma = { name, configured: true };
    }
    if (nameLower === 'paper' || nameLower.includes('paper.design') || cmdStr.includes('paper-design') || cmdStr.includes('paper.design')) {
      result.paper = { name, configured: true };
    }
```

- [ ] **Step 2: Add paper to the output `designTools` object**

`old_string`:
```
  designTools: {
    stitch: tools.stitch || { configured: false },
    figma: tools.figma || { configured: false },
  },
```

`new_string`:
```
  designTools: {
    paper: tools.paper || { configured: false },
    stitch: tools.stitch || { configured: false },
    figma: tools.figma || { configured: false },
  },
```

- [ ] **Step 3: Run the test — verify it PASSES**

```bash
cd C:/Users/leo/Work/superpowers-sage
node scripts/test-detect-design-tools.mjs
```

Expected: `All 6 tests passed`.

If any test fails, read the failing case's output JSON and adjust the matcher in `detectMCPServers` until the assertion passes. Do NOT relax the test — fix the script.

- [ ] **Step 4: Commit**

```bash
git add scripts/detect-design-tools.mjs scripts/test-detect-design-tools.mjs scripts/__fixtures__/
git commit -m "feat(detect): add paper.design MCP detection with fixture tests"
```

---

## Task 5: `designing` skill — add paper extraction branch

**Files:**
- Modify: `skills/designing/SKILL.md`

This is a markdown-only change. Use `Edit` to apply each replacement, then read back to confirm.

- [ ] **Step 1: Update the description in frontmatter**

`old_string`:
```
description: Design tool integration for Sage projects; detects and uses Stitch or Figma MCPs to extract layout, content, and visual references. Also works with local screenshot assets. Use when you need to consult or capture design references.
```

`new_string`:
```
description: Design tool integration for Sage projects; routes to Paper, Stitch, or Figma MCPs (or local assets) based on the URL/source the user provides. Paper enriches extraction with screenshots, computed styles, and JSX structural references. Use when you need to consult or capture design references.
```

- [ ] **Step 2: Replace the "Detect available design tools" section**

`old_string`:
```
### 0) Detect available design tools

Use ToolSearch to discover which MCPs are available:

1. Search for `mcp__stitch__` — if found, Stitch is available
2. Search for `mcp__figma__` — if found, Figma is available
3. Check `docs/plans/<active-plan>/assets/` for local reference images

If both Stitch and Figma are detected, ask the user which contains this project's layout.
```

`new_string`:
```
### 0) Determine source from user input (URL-based routing)

Routing is driven by what the user provided, not by which MCPs happen to be configured.

1. **URL match** — inspect the user's input for a design URL:
   - `paper.design/*` or `*.paper.design/*` → **paper** branch (use `mcp__paper__*`)
   - `figma.com/*` → **figma** branch (use `mcp__figma__*` / `mcp__claude_ai_Figma__*`)
   - `stitch.withgoogle.com/*` (or other known stitch hosts) → **stitch** branch (use `mcp__stitch__*`)
2. **Local fallback** — if no URL but `docs/plans/<active-plan>/assets/section-*.png` exists → **offline** branch
3. **Ask** — if neither URL nor local assets are present, ask the user for one

**MCP gate:** once the branch is known, ToolSearch the corresponding `mcp__<tool>__*` namespace. If the MCP is NOT configured, stop with this message:

```
⛔ You sent a {paper|figma|stitch} link but the `{tool}` MCP is not configured.

Configure it and re-run, or send a link from another source.
```

Do NOT silently fall back to a different MCP.
```

- [ ] **Step 3: Insert the paper workflow before the Stitch workflow**

`old_string`:
```
### 1) Extract design data (per section, never full design at once)

#### Stitch workflow:
```

`new_string`:
```
### 1) Extract design data (per section, never full design at once)

#### Paper workflow (preferred when source is paper.design):
1. `mcp__paper__get_basic_info` — get document metadata
2. `mcp__paper__get_tree_summary` — locate the target section node
3. `mcp__paper__get_node_info` on the section — capture structure, text, hierarchy
4. `mcp__paper__get_screenshot` — save as `assets/section-{name}.png`
5. `mcp__paper__get_computed_styles` — save as `assets/section-{name}.styles.json` (typography, colors, spacing — exact values; consumed by `verifying` for the style spot-check)
6. `mcp__paper__get_jsx` — save as `assets/section-{name}.reference.jsx` with this header comment as the FIRST lines of the file:
   ```
   // REFERÊNCIA ESTRUTURAL APENAS — NÃO COPIAR.
   // Sage usa Blade, não React. Use isso só para entender
   // hierarquia de componentes e nesting.
   ```
7. Produce the structured output (see step 2) — same schema as the other branches.

#### Stitch workflow:
```

- [ ] **Step 4: Update step 3 (plan frontmatter) to include `paper`**

`old_string`:
```
- Update `plan.md` frontmatter with `design-tool: stitch|figma|offline`
```

`new_string`:
```
- Update `plan.md` frontmatter with `design-tool: paper|stitch|figma|offline`
```

- [ ] **Step 5: Read the file back and confirm all four edits applied cleanly**

Read `skills/designing/SKILL.md` end-to-end. Verify:
- Frontmatter `description` mentions Paper
- Section "0) Determine source from user input" is present (replaces "Detect available design tools")
- "Paper workflow" section appears before "Stitch workflow"
- "design-tool: paper|stitch|figma|offline" appears in step 3

If anything is missing or duplicated, fix in place.

- [ ] **Step 6: Commit**

```bash
git add skills/designing/SKILL.md
git commit -m "feat(designing): add paper.design branch with URL-based routing"
```

---

## Task 6: `verifying` skill — add style spot-check

**Files:**
- Modify: `skills/verifying/SKILL.md`

- [ ] **Step 1: Update reference source priority to mention paper**

`old_string`:
```
3. **Design MCP**: Stitch `get_screen` or Figma `get_design_context`
```

`new_string`:
```
3. **Design MCP**: Paper `get_screenshot`, Stitch `get_screen`, or Figma `get_design_context`
```

- [ ] **Step 2: Insert a new section "3b) Style spot-check (paper sources only)" between sections 3 and 4**

`old_string`:
```
### 4) Report findings
```

`new_string`:
```
### 3b) Style spot-check (paper sources only)

This step is **additive** — it runs only when `assets/section-{name}.styles.json` exists (i.e., the source was paper). For all other sources, skip silently and proceed to step 4.

1. Read `docs/plans/<active-plan>/assets/section-{name}.styles.json`
2. For each key property (typography, colors, spacing, border-radius), find the implemented value:
   - **Tailwind class** (`p-6`, `text-lg`, `bg-slate-900`) — resolve to its real value via the project's Tailwind config (`tailwind.config.js` or `@theme` block in `resources/css/app.css`). For example, `p-6` → `padding: 1.5rem` → `24px`.
   - **Arbitrary value** (`p-[23px]`) — capture the literal between brackets.
3. Compare design value vs implemented value. Produce a per-section report block:

```
### Style Spot-Check
✓ padding:    design=24px, impl=p-6 (24px)
✗ font-size:  design=18px, impl=text-base (16px)  — DRIFT
✓ color:      design=#0F172A, impl=bg-slate-900 (#0F172A)
⚠ gap:        design=32px, impl=gap-[31px] — arbitrary value, near-match
```

4. **Non-fatal**: drift here does NOT block verification. The drift items are surfaced as warnings inside the final report (step 4) under a `### Style Drift` subsection. The user decides whether to adjust.

### 4) Report findings
```

- [ ] **Step 3: Update the Report findings template to mention the optional Style Drift block**

`old_string`:
```
### Recommendation
{proceed / fix before continuing}
```

`new_string`:
```
### Style Drift
{omit this section if source was not paper, or no drift found.
 Otherwise list the ✗ and ⚠ lines from the spot-check.}

### Recommendation
{proceed / fix before continuing}
```

- [ ] **Step 4: Read the file back and confirm**

Read `skills/verifying/SKILL.md`. Verify that section "3b) Style spot-check" exists between "3) Compare visually" and "4) Report findings", and that the Report findings template includes the Style Drift block.

- [ ] **Step 5: Commit**

```bash
git add skills/verifying/SKILL.md
git commit -m "feat(verifying): add paper-only style spot-check vs computed_styles"
```

---

## Task 7: `design-extractor` agent — add paper source

**Files:**
- Modify: `agents/design-extractor.md`

- [ ] **Step 1: Update frontmatter description**

`old_string`:
```
description: Extracts precise design specifications from Figma/Stitch MCPs or local reference images; produces structured spec files (typography, colors, spacing, SVGs, layout) in two modes — PANORAMIC for full-project token extraction and SURGICAL for per-component deep extraction
```

`new_string`:
```
description: Extracts precise design specifications from Paper/Figma/Stitch MCPs or local reference images; produces structured spec files (typography, colors, spacing, SVGs, layout) in two modes — PANORAMIC for full-project token extraction and SURGICAL for per-component deep extraction
```

- [ ] **Step 2: Update the body intro**

`old_string`:
```
You are a design extraction specialist. You read design references (Figma, Stitch, or local images) and produce structured, precise specification files for the `building` skill and `visual-verifier` agent. You do NOT implement anything — you only extract and document.
```

`new_string`:
```
You are a design extraction specialist. You read design references (Paper, Figma, Stitch, or local images) and produce structured, precise specification files for the `building` skill and `visual-verifier` agent. You do NOT implement anything — you only extract and document.

When the source is Paper, also persist `assets/section-<name>.styles.json` (from `mcp__paper__get_computed_styles`) and `assets/section-<name>.reference.jsx` (from `mcp__paper__get_jsx`). The JSX file is a STRUCTURAL REFERENCE ONLY — Sage uses Blade, not React; do not copy it as code.
```

- [ ] **Step 3: Update HARD REQUIREMENT detection list**

`old_string`:
```
On start, check for a design reference in this order:
1. Figma MCP — ToolSearch for `mcp__claude_ai_Figma__get_design_context`
2. Stitch MCP — ToolSearch for `mcp__stitch__get_screen`
3. Local reference images — Glob for `docs/plans/*/assets/section-*.png`
```

`new_string`:
```
On start, check for a design reference in this order (or use whichever matches the URL the caller provided):
1. Paper MCP — ToolSearch for `mcp__paper__get_node_info`
2. Figma MCP — ToolSearch for `mcp__claude_ai_Figma__get_design_context`
3. Stitch MCP — ToolSearch for `mcp__stitch__get_screen`
4. Local reference images — Glob for `docs/plans/*/assets/section-*.png`
```

- [ ] **Step 4: Add Paper to PANORAMIC mode tools list**

`old_string`:
```
**Tools (use in order of availability):**
- Figma: `mcp__claude_ai_Figma__get_variable_defs` → `mcp__claude_ai_Figma__get_design_context` → `mcp__claude_ai_Figma__get_screenshot`
- Stitch: `mcp__stitch__list_screens` → `mcp__stitch__get_screen` for each section
- Local: Read all `assets/section-*.png` images, infer global tokens visually
```

`new_string`:
```
**Tools (use in order of availability):**
- Paper: `mcp__paper__get_basic_info` → `mcp__paper__get_tree_summary` → `mcp__paper__get_computed_styles` (root) → `mcp__paper__get_screenshot` (root)
- Figma: `mcp__claude_ai_Figma__get_variable_defs` → `mcp__claude_ai_Figma__get_design_context` → `mcp__claude_ai_Figma__get_screenshot`
- Stitch: `mcp__stitch__list_screens` → `mcp__stitch__get_screen` for each section
- Local: Read all `assets/section-*.png` images, infer global tokens visually
```

- [ ] **Step 5: Add Paper to SURGICAL mode tools list**

`old_string`:
```
**Tools (use in order of availability):**
- Figma: `mcp__claude_ai_Figma__get_design_context` with the component's nodeId → `mcp__claude_ai_Figma__get_screenshot`
- Stitch: `mcp__stitch__get_screen` for this section
- Local: Read `assets/section-<name>.png`, extract as precisely as possible
```

`new_string`:
```
**Tools (use in order of availability):**
- Paper: `mcp__paper__get_node_info` (section node) → `mcp__paper__get_computed_styles` → `mcp__paper__get_screenshot` → `mcp__paper__get_jsx` (saved as `section-<name>.reference.jsx` with the "REFERÊNCIA ESTRUTURAL APENAS" header)
- Figma: `mcp__claude_ai_Figma__get_design_context` with the component's nodeId → `mcp__claude_ai_Figma__get_screenshot`
- Stitch: `mcp__stitch__get_screen` for this section
- Local: Read `assets/section-<name>.png`, extract as precisely as possible
```

- [ ] **Step 6: Update tool allowlist in frontmatter**

The current frontmatter has `tools: Read, Write, Glob, ToolSearch`. The agent needs the paper MCP tools available.

`old_string`:
```
tools: Read, Write, Glob, ToolSearch
```

`new_string`:
```
tools: Read, Write, Glob, ToolSearch, mcp__paper__get_basic_info, mcp__paper__get_tree_summary, mcp__paper__get_node_info, mcp__paper__get_computed_styles, mcp__paper__get_screenshot, mcp__paper__get_jsx
```

Note: Figma/Stitch tools are loaded via ToolSearch on demand. We list paper explicitly because it is the preferred source and we want the agent to use them without a search round-trip.

- [ ] **Step 7: Read the file back and confirm**

Read `agents/design-extractor.md`. Verify all six edits applied.

- [ ] **Step 8: Commit**

```bash
git add agents/design-extractor.md
git commit -m "feat(agents): add paper.design source to design-extractor"
```

---

## Task 8: `sage-architect` agent — add paper to design tool list

**Files:**
- Modify: `agents/sage-architect.md`

- [ ] **Step 1: Update workflow step 2 to mention paper**

`old_string`:
```
2. If design tools are available (check via ToolSearch for `mcp__stitch__*` or `mcp__figma__*`), use them to understand the visual design
```

`new_string`:
```
2. If design tools are available (check via ToolSearch for `mcp__paper__*`, `mcp__stitch__*`, or `mcp__figma__*`), use them to understand the visual design. If the user provided a design URL, use the matching MCP (paper.design → paper, figma.com → figma, stitch host → stitch).
```

- [ ] **Step 2: Read the file back and confirm**

Read `agents/sage-architect.md` lines around the workflow section.

- [ ] **Step 3: Commit**

```bash
git add agents/sage-architect.md
git commit -m "feat(agents): add paper.design to sage-architect design tool list"
```

---

## Task 9: `architecture-discovery` skill — minor wording update

**Files:**
- Modify: `skills/architecture-discovery/SKILL.md`

- [ ] **Step 1: Update the visual companion `session.json` template tools block**

`old_string`:
```
  "tools": {
    "figma": false,
    "playwright": false
  }
```

`new_string`:
```
  "tools": {
    "paper": false,
    "figma": false,
    "playwright": false
  }
```

- [ ] **Step 2: Read the file back and confirm**

Read the relevant block in `skills/architecture-discovery/SKILL.md`.

- [ ] **Step 3: Commit**

```bash
git add skills/architecture-discovery/SKILL.md
git commit -m "feat(architecture-discovery): track paper in visual companion session"
```

---

## Task 10: `onboarding` skill — detect and list paper

**Files:**
- Modify: `skills/onboarding/SKILL.md`

- [ ] **Step 1: Add paper to the detection list**

`old_string`:
```
Use ToolSearch to check for available design MCPs:

- Search for `mcp__stitch__` — Stitch (Google) MCP
- Search for `mcp__figma__` — Figma MCP
- Search for `mcp__playwright__` — Playwright MCP for screenshots
```

`new_string`:
```
Use ToolSearch to check for available design MCPs:

- Search for `mcp__paper__` — Paper.design MCP (preferred when the user works from paper.design)
- Search for `mcp__stitch__` — Stitch (Google) MCP
- Search for `mcp__figma__` — Figma MCP
- Search for `mcp__playwright__` — Playwright MCP for screenshots
```

- [ ] **Step 2: Add paper to the structured overview template**

`old_string`:
```
### Design Tools
- Stitch: {available/not available}
- Figma: {available/not available}
- Playwright: {available/not available}
```

`new_string`:
```
### Design Tools
- Paper: {available/not available}  (preferred when designs live on paper.design)
- Stitch: {available/not available}
- Figma: {available/not available}
- Playwright: {available/not available}
```

- [ ] **Step 3: Read the file back and confirm both edits applied**

- [ ] **Step 4: Commit**

```bash
git add skills/onboarding/SKILL.md
git commit -m "feat(onboarding): detect and list paper.design MCP"
```

---

## Task 11: `sageing` meta-skill — document paper

**Files:**
- Modify: `skills/sageing/SKILL.md`

- [ ] **Step 1: Update the `/designing` row in the workflow skills table**

`old_string`:
```
| **Designing**              | `/designing`              | Design tool integration (Stitch/Figma/offline assets)                |
```

`new_string`:
```
| **Designing**              | `/designing`              | Design tool integration (Paper/Stitch/Figma/offline assets) — routes by URL |
```

- [ ] **Step 2: Update the Design Tool Integration table**

`old_string`:
```
The plugin detects and uses design tools via MCP servers:

| Tool                | MCP                        | Usage                                               |
| ------------------- | -------------------------- | --------------------------------------------------- |
| **Stitch** (Google) | `mcp__stitch__*`           | `list_screens` → `get_screen` → extract per section |
| **Figma**           | `mcp__figma__*`            | List files → get frames → extract layers/text       |
| **Playwright**      | `mcp__playwright__*`       | Capture implementation screenshots for verification |
| **Chrome**          | `mcp__Claude_in_Chrome__*` | Alternative screenshot capture                      |
```

`new_string`:
```
The plugin routes to a design tool based on the URL the user provides:

| Tool                | URL pattern                  | MCP                        | Usage                                                                            |
| ------------------- | ---------------------------- | -------------------------- | -------------------------------------------------------------------------------- |
| **Paper** (preferred) | `paper.design/*`           | `mcp__paper__*`            | `get_basic_info` → `get_tree_summary` → `get_node_info` → `get_screenshot` + `get_computed_styles` + `get_jsx` |
| **Stitch** (Google) | `stitch.withgoogle.com/*`    | `mcp__stitch__*`           | `list_screens` → `get_screen` → extract per section                              |
| **Figma**           | `figma.com/*`                | `mcp__figma__*`            | List files → get frames → extract layers/text                                    |
| **Playwright**      | n/a                          | `mcp__playwright__*`       | Capture implementation screenshots for verification                              |
| **Chrome**          | n/a                          | `mcp__Claude_in_Chrome__*` | Alternative screenshot capture                                                   |

Routing is by URL, not by which MCP happens to be configured. If the user sends a `paper.design` link and the paper MCP is not installed, `/designing` stops with a setup instruction rather than silently falling back.

When using Paper as source, `/designing` persists three artifacts per section in `assets/`: `.png` (screenshot), `.styles.json` (computed styles, consumed by `/verifying` for style spot-check), and `.reference.jsx` (structural reference — never copied as code, since Sage uses Blade not React).
```

- [ ] **Step 3: Update the plan frontmatter example**

`old_string`:
```
design-tool: stitch | figma | offline | none
```

`new_string`:
```
design-tool: paper | stitch | figma | offline | none
```

- [ ] **Step 4: Read the file back and confirm all three edits**

- [ ] **Step 5: Commit**

```bash
git add skills/sageing/SKILL.md
git commit -m "docs(sageing): document paper.design as preferred design source"
```

---

## Task 12: `session-start.sh` hook — surface paper detection

**Files:**
- Modify: `hooks/session-start.sh`

- [ ] **Step 1: Add PAPER variable initialization**

`old_string`:
```
STITCH="no"
FIGMA="no"
PLAYWRIGHT="no"
CHROME="no"

if [ -n "$DESIGN_TOOLS" ]; then
  echo "$DESIGN_TOOLS" | grep -q '"stitch".*"configured": true' 2>/dev/null && STITCH="yes"
  echo "$DESIGN_TOOLS" | grep -q '"figma".*"configured": true' 2>/dev/null && FIGMA="yes"
  echo "$DESIGN_TOOLS" | grep -q '"playwright".*"configured": true' 2>/dev/null && PLAYWRIGHT="yes"
  echo "$DESIGN_TOOLS" | grep -q '"chrome".*"configured": true' 2>/dev/null && CHROME="yes"
fi
```

`new_string`:
```
PAPER="no"
STITCH="no"
FIGMA="no"
PLAYWRIGHT="no"
CHROME="no"

if [ -n "$DESIGN_TOOLS" ]; then
  echo "$DESIGN_TOOLS" | grep -q '"paper".*"configured": true' 2>/dev/null && PAPER="yes"
  echo "$DESIGN_TOOLS" | grep -q '"stitch".*"configured": true' 2>/dev/null && STITCH="yes"
  echo "$DESIGN_TOOLS" | grep -q '"figma".*"configured": true' 2>/dev/null && FIGMA="yes"
  echo "$DESIGN_TOOLS" | grep -q '"playwright".*"configured": true' 2>/dev/null && PLAYWRIGHT="yes"
  echo "$DESIGN_TOOLS" | grep -q '"chrome".*"configured": true' 2>/dev/null && CHROME="yes"
fi
```

- [ ] **Step 2: Add paper to the setup instructions block**

`old_string`:
```
if [ "$STITCH" = "no" ]; then
  SETUP_INSTRUCTIONS="${SETUP_INSTRUCTIONS}\n- Stitch MCP: \`claude mcp add stitch -- npx -y @anthropic/stitch-mcp\`"
fi
```

`new_string`:
```
if [ "$PAPER" = "no" ]; then
  SETUP_INSTRUCTIONS="${SETUP_INSTRUCTIONS}\n- Paper.design MCP (preferred): see https://paper.design/docs/mcp"
fi
if [ "$STITCH" = "no" ]; then
  SETUP_INSTRUCTIONS="${SETUP_INSTRUCTIONS}\n- Stitch MCP: \`claude mcp add stitch -- npx -y @anthropic/stitch-mcp\`"
fi
```

- [ ] **Step 3: Add paper to the SUMMARY line**

`old_string`:
```
SUMMARY="${SUMMARY}\n\nDesign Tools: Stitch: ${STITCH} | Figma: ${FIGMA} | Playwright: ${PLAYWRIGHT} | Chrome: ${CHROME}"
```

`new_string`:
```
SUMMARY="${SUMMARY}\n\nDesign Tools: Paper: ${PAPER} | Stitch: ${STITCH} | Figma: ${FIGMA} | Playwright: ${PLAYWRIGHT} | Chrome: ${CHROME}"
```

- [ ] **Step 4: Smoke test the hook**

```bash
cd C:/Users/leo/Work/superpowers-sage
bash hooks/session-start.sh 2>&1 | head -40
```

Expected: JSON output (or empty if not in a Sage project — that's fine, the hook exits 0 early). If the script errors with bash syntax issues, fix and re-run.

If the working directory IS a Sage project, the output should include `Paper: ` somewhere in the summary string.

- [ ] **Step 5: Commit**

```bash
git add hooks/session-start.sh
git commit -m "feat(hooks): surface paper.design MCP in session-start summary"
```

---

## Task 13: Plugin manifests — keywords

**Files:**
- Modify: `plugin.json`
- Modify: `.claude-plugin/plugin.json`

- [ ] **Step 1: Update `plugin.json` description**

`old_string`:
```
  "description": "Modern WordPress development with Sage, Acorn & Lando. Workflow skills: /architecture-discovery, /plan-generator, /building, /designing, /verifying (+ /architecting compatibility alias), with design tool integration, content modeling, visual verification, and comprehensive hooks.",
```

`new_string`:
```
  "description": "Modern WordPress development with Sage, Acorn & Lando. Workflow skills: /architecture-discovery, /plan-generator, /building, /designing, /verifying (+ /architecting compatibility alias), with Paper/Figma/Stitch design tool integration, content modeling, visual verification, and comprehensive hooks.",
```

- [ ] **Step 2: Update `plugin.json` keywords**

`old_string`:
```
    "blade",
    "stitch",
    "figma",
    "design-tools",
```

`new_string`:
```
    "blade",
    "paper",
    "paper-design",
    "stitch",
    "figma",
    "design-tools",
```

- [ ] **Step 3: Repeat steps 1 and 2 for `.claude-plugin/plugin.json`**

Apply identical edits.

- [ ] **Step 4: Validate JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('plugin.json','utf8'))"
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8'))"
```

Expected: both commands exit 0 with no output. If either errors, fix the JSON.

- [ ] **Step 5: Commit**

```bash
git add plugin.json .claude-plugin/plugin.json
git commit -m "chore(plugin): add paper.design to manifest description and keywords"
```

---

## Task 14: README — design tools section

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the Design Tools section**

`old_string`:
```
### Design Tools (optional)

These MCP integrations unlock the `/designing` and `/verifying` skills. Configure once per machine independent of which AI assistant you use:

```bash
# Stitch (Google) — extract screens and sections from designs
claude mcp add stitch -- npx -y @anthropic/stitch-mcp

# Figma — extract frames and layers from designs
claude mcp add figma -- npx -y figma-developer-mcp --figma-api-key=YOUR_KEY

# Playwright — capture implementation screenshots for visual verification
claude mcp add playwright -- npx -y @anthropic/playwright-mcp
```
```

`new_string`:
````
### Design Tools (optional)

These MCP integrations unlock the `/designing` and `/verifying` skills. The plugin routes to a design tool based on the URL the user provides — `paper.design/*` → paper, `figma.com/*` → figma, etc. Paper is preferred when available because it enriches extraction with computed styles and a JSX structural reference, and enables a style drift spot-check during `/verifying`. Configure once per machine independent of which AI assistant you use:

```bash
# Paper.design (preferred) — extract sections, computed styles, and JSX references
# See https://paper.design/docs/mcp for setup instructions

# Stitch (Google) — extract screens and sections from designs
claude mcp add stitch -- npx -y @anthropic/stitch-mcp

# Figma — extract frames and layers from designs
claude mcp add figma -- npx -y figma-developer-mcp --figma-api-key=YOUR_KEY

# Playwright — capture implementation screenshots for visual verification
claude mcp add playwright -- npx -y @anthropic/playwright-mcp
```
````

- [ ] **Step 2: Read the section back and confirm formatting**

Use the Read tool on `README.md` (lines 110-135) and confirm the section renders cleanly — code fences balanced, no orphaned `bash` opener, paper bullet present.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): document paper.design as preferred design source"
```

---

## Task 15: Manual validation checklist

**Files:** none — runtime validation in a real Sage project.

This task is a **gate** before declaring the work done. It cannot be automated. The agent executing this plan should pause here and ask the user to either run the checklist themselves or provide a target Sage project where the agent can run it.

- [ ] **Step 1: Detect script regression**

```bash
cd C:/Users/leo/Work/superpowers-sage
node scripts/test-detect-design-tools.mjs
```

Expected: `All 6 tests passed`. If not, the implementation broke between tasks — git bisect to find the regression.

- [ ] **Step 2: Paper extraction smoke test**

In a real Sage project that has the `paper` MCP configured and an active plan with assets directory:
1. Provide the user a paper.design URL pointing at a real document section
2. Invoke `/designing` with that URL
3. Verify the skill routes to the paper branch (does NOT prompt for Stitch/Figma)
4. Verify three artifacts appear under `docs/plans/<active-plan>/assets/`:
   - `section-{name}.png`
   - `section-{name}.styles.json`
   - `section-{name}.reference.jsx` (with the "REFERÊNCIA ESTRUTURAL APENAS" header as the first three lines)

- [ ] **Step 3: Figma regression**

Repeat step 2 with a `figma.com` URL. Verify the figma branch runs as before and ONLY the `.png` is produced (no `.styles.json`, no `.reference.jsx`).

- [ ] **Step 4: Verifying with paper source**

Pick a section whose `assets/` includes a `.styles.json` (from step 2). Invoke `/verifying` for that section. The report MUST include a `### Style Spot-Check` block AND, if drift exists, a `### Style Drift` block in the final report.

- [ ] **Step 5: Verifying with figma source**

Pick a section whose `assets/` includes only the `.png` (no `.styles.json`). Invoke `/verifying` for that section. The report must NOT include a Style Spot-Check block. The visual diff must run as before.

- [ ] **Step 6: Onboarding lists paper**

In a project with the paper MCP configured, run `/onboarding`. The structured overview must show `Paper: available` in the Design Tools section.

- [ ] **Step 7: MCP-not-configured stop message**

In a project WITHOUT the paper MCP configured, send a `paper.design/*` URL to `/designing`. The skill must stop with the explicit setup instruction (NOT silently fall back to figma/stitch/offline).

- [ ] **Step 8: Mark validation results**

Append a brief notes section to the spec file (`docs/superpowers/specs/2026-04-13-paper-design-mcp-support.md`) under a new heading `## Validation Results (YYYY-MM-DD)` listing pass/fail for steps 1-7. Commit:

```bash
git add docs/superpowers/specs/2026-04-13-paper-design-mcp-support.md
git commit -m "docs(specs): record paper.design MCP validation results"
```

---

## Task 16: Final review and PR

**Files:** none

- [ ] **Step 1: Show full git log for the branch**

```bash
git log --oneline main..HEAD
```

Expected: 13 commits, one per task (Tasks 2–14) plus the validation commit from Task 15.

- [ ] **Step 2: Diff against main for a final read**

```bash
git diff main...HEAD --stat
```

Expected modified/created files:
- `scripts/detect-design-tools.mjs` (modified)
- `scripts/test-detect-design-tools.mjs` (created)
- `scripts/__fixtures__/mcp-*.json` (6 created)
- `skills/designing/SKILL.md` (modified)
- `skills/verifying/SKILL.md` (modified)
- `skills/onboarding/SKILL.md` (modified)
- `skills/sageing/SKILL.md` (modified)
- `skills/architecture-discovery/SKILL.md` (modified)
- `agents/design-extractor.md` (modified)
- `agents/sage-architect.md` (modified)
- `hooks/session-start.sh` (modified)
- `plugin.json` (modified)
- `.claude-plugin/plugin.json` (modified)
- `README.md` (modified)
- `docs/superpowers/specs/2026-04-13-paper-design-mcp-support.md` (created earlier, possibly amended in Task 15)
- `docs/superpowers/plans/2026-04-14-paper-design-mcp-support.md` (this plan)

- [ ] **Step 3: Ask the user how to proceed with merge/PR**

Do NOT push or open a PR autonomously. Ask the user whether they want a PR, a direct merge to main, or to keep the branch open for further iteration.

---

## Spec coverage check (run after writing the plan)

| Spec section | Implemented in |
|---|---|
| URL-based routing | Task 5 (designing skill, step 2), Task 11 (sageing docs) |
| `detect-design-tools.mjs` paper inventory | Tasks 2–4 |
| Designing — paper extraction branch | Task 5 |
| Verifying — visual diff (existing) | unchanged, preserved by Task 6 |
| Verifying — style spot-check | Task 6 |
| `session-start.sh` paper variable | Task 12 |
| `onboarding` skill — list paper | Task 10 |
| `sageing` meta-skill — paper docs | Task 11 |
| `architecture-discovery` — minor wording | Task 9 |
| `design-extractor` agent | Task 7 |
| `sage-architect` agent | Task 8 |
| `plugin.json` / `.claude-plugin/plugin.json` | Task 13 |
| `README.md` | Task 14 |
| Automated test for detect script | Task 3 (red), Task 4 (green) |
| Manual validation checklist | Task 15 |

All spec items mapped. No gaps.
