> Historical document from superpowers-sage 2.x. It describes features that were removed or replaced in kivo-wise 3.0 and is kept for reference only.

# Pencil MCP Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Pencil as a first-class fourth design tool across detection, extraction, component mapping, and visual verification — integrated natively into all existing files that reference Paper/Figma/Stitch.

**Architecture:** A new `pencil-extractor` agent encapsulates all Pencil-specific logic (three modes: PANORAMIC, SURGICAL, COMPONENT_MAP) and is delegated to by `design-extractor`. The `detect-design-tools.mjs` script gains file-system awareness of `design/` folders. All other agents receive minimal targeted edits. The `.pen` file is always the source of truth.

**Tech Stack:** Node.js ESM scripts, Markdown agent/skill files, Pencil MCP (`mcp__pencil__*` tools)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `scripts/__fixtures__/mcp-only-pencil.json` | CREATE | Pencil-only MCP config fixture |
| `scripts/__fixtures__/mcp-pencil-figma.json` | CREATE | Pencil + Figma fixture |
| `scripts/__fixtures__/mcp-all-four.json` | CREATE | All four tools fixture |
| `scripts/detect-design-tools.mjs` | MODIFY | Detect Pencil MCP + scan `design/` folder |
| `scripts/test-detect-design-tools.mjs` | MODIFY | Tests for Pencil detection cases |
| `agents/pencil-extractor.md` | CREATE | Core agent — PANORAMIC / SURGICAL / COMPONENT_MAP |
| `agents/design-extractor.md` | MODIFY | Add Pencil as step 4 in detection order |
| `agents/sage-architect.md` | MODIFY | ToolSearch for Pencil + read component-map.md |
| `agents/visual-verifier.md` | MODIFY | Live Pencil screenshot with CACHED fallback |
| `skills/designing/SKILL.md` | MODIFY | `.pen` path routing + Pencil workflow section |
| `README.md` | MODIFY | Pencil in design tools table + `.lib.pen` conventions |
| `CLAUDE.md` (WSL project) | MODIFY | Rewrite Design System section with `.pen` conventions |

---

## Task 1: Create fixture files

**Files:**
- Create: `scripts/__fixtures__/mcp-only-pencil.json`
- Create: `scripts/__fixtures__/mcp-pencil-figma.json`
- Create: `scripts/__fixtures__/mcp-all-four.json`

- [ ] **Step 1: Create `mcp-only-pencil.json`**

```json
{
  "mcpServers": {
    "pencil": {
      "command": "npx",
      "args": ["-y", "@anthropic/pencil-mcp"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@anthropic/playwright-mcp"]
    }
  }
}
```

- [ ] **Step 2: Create `mcp-pencil-figma.json`**

```json
{
  "mcpServers": {
    "pencil": {
      "command": "npx",
      "args": ["-y", "@anthropic/pencil-mcp"]
    },
    "figma": {
      "command": "npx",
      "args": ["-y", "figma-developer-mcp"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@anthropic/playwright-mcp"]
    }
  }
}
```

- [ ] **Step 3: Create `mcp-all-four.json`**

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
    "pencil": {
      "command": "npx",
      "args": ["-y", "@anthropic/pencil-mcp"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@anthropic/playwright-mcp"]
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add scripts/__fixtures__/mcp-only-pencil.json \
        scripts/__fixtures__/mcp-pencil-figma.json \
        scripts/__fixtures__/mcp-all-four.json
git commit -m "test: add Pencil MCP fixture files"
```

---

## Task 2: Update `detect-design-tools.mjs`

**Files:**
- Modify: `scripts/detect-design-tools.mjs`

- [ ] **Step 1: Add Pencil MCP detection inside `detectMCPServers()`**

Locate the block that checks for `chrome`/`browser` (last `if` in the for loop). Add immediately after it:

```javascript
if (nameLower.includes('pencil') || cmdStr.includes('pencil')) {
  result.pencil = { name, configured: true };
}
```

- [ ] **Step 2: Add `design/` folder scan after the sources loop**

Locate the line `const result = {` near the bottom of the file. Add the following block directly before it:

```javascript
// Pencil — scan design/ folder for .pen files
const designDir = join(rootPath, 'design');
if (existsSync(designDir)) {
  const penFiles = readdirSync(designDir).filter(f => f.endsWith('.pen'));
  const libFile =
    penFiles.find(f => f.endsWith('.lib.pen') && f.includes('design-system')) ||
    penFiles.find(f => f.endsWith('.lib.pen')) ||
    null;
  const pageFiles = penFiles.filter(f => !f.endsWith('.lib.pen'));
  tools.pencil = {
    ...tools.pencil,
    hasFiles: penFiles.length > 0,
    libFile: libFile ? join('design', libFile) : null,
    pageFiles: pageFiles.map(f => join('design', f)),
  };
}
```

- [ ] **Step 3: Add `pencil` to the `designTools` output block**

Locate the `result` object at the bottom. Change:

```javascript
const result = {
  designTools: {
    paper: tools.paper || { configured: false },
    stitch: tools.stitch || { configured: false },
    figma: tools.figma || { configured: false },
  },
```

To:

```javascript
const result = {
  designTools: {
    paper: tools.paper || { configured: false },
    stitch: tools.stitch || { configured: false },
    figma: tools.figma || { configured: false },
    pencil: tools.pencil || { configured: false },
  },
```

- [ ] **Step 4: Commit**

```bash
git add scripts/detect-design-tools.mjs
git commit -m "feat: detect Pencil MCP and design/ folder in detect-design-tools"
```

---

## Task 3: Update `test-detect-design-tools.mjs`

**Files:**
- Modify: `scripts/test-detect-design-tools.mjs`

- [ ] **Step 1: Extend `runDetect` to support a `design/` folder with `.pen` files**

Replace the existing `runDetect` function:

```javascript
function runDetect(fixtureName, penFiles = []) {
  const tmp = mkdtempSync(join(tmpdir(), 'detect-test-'));
  try {
    copyFileSync(join(FIXTURES, fixtureName), join(tmp, '.mcp.json'));

    // Create design/ folder with .pen stubs if requested
    if (penFiles.length > 0) {
      const designDir = join(tmp, 'design');
      mkdirSync(designDir);
      for (const f of penFiles) {
        writeFileSync(join(designDir, f), '');
      }
    }

    const res = spawnSync('node', [DETECT, '--path', tmp], { encoding: 'utf8' });
    if (res.status !== 0) {
      throw new Error(`detect exited ${res.status}: ${res.stderr}`);
    }
    return JSON.parse(res.stdout);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
```

Add `mkdirSync` and `writeFileSync` to the import line at the top:

```javascript
import { mkdtempSync, copyFileSync, rmSync, mkdirSync, writeFileSync } from 'fs';
```

- [ ] **Step 2: Add Pencil test cases to the `cases` array**

Append these cases after the existing `'none'` case:

```javascript
{
  name: 'only pencil (MCP configured, no files)',
  fixture: 'mcp-only-pencil.json',
  penFiles: [],
  expect: (out) => out.designTools.pencil?.configured === true
    && out.designTools.pencil?.hasFiles === undefined
    && out.designTools.paper?.configured === false
    && out.designTools.figma?.configured === false,
},
{
  name: 'pencil MCP + design/ with pages and lib',
  fixture: 'mcp-only-pencil.json',
  penFiles: ['design-system.lib.pen', 'components.lib.pen', 'homepage.pen', 'sobre.pen'],
  expect: (out) => out.designTools.pencil?.configured === true
    && out.designTools.pencil?.hasFiles === true
    && out.designTools.pencil?.libFile === 'design/design-system.lib.pen'
    && out.designTools.pencil?.pageFiles?.length === 2
    && out.designTools.pencil?.pageFiles?.includes('design/homepage.pen'),
},
{
  name: 'pencil MCP + lib.pen without design-system prefix',
  fixture: 'mcp-only-pencil.json',
  penFiles: ['components.lib.pen', 'homepage.pen'],
  expect: (out) => out.designTools.pencil?.libFile === 'design/components.lib.pen'
    && out.designTools.pencil?.pageFiles?.length === 1,
},
{
  name: 'pencil files exist but MCP not configured',
  fixture: 'mcp-none.json',
  penFiles: ['design-system.lib.pen', 'homepage.pen'],
  expect: (out) => out.designTools.pencil?.configured === false
    && out.designTools.pencil?.hasFiles === true
    && out.designTools.pencil?.libFile === 'design/design-system.lib.pen',
},
{
  name: 'pencil + figma',
  fixture: 'mcp-pencil-figma.json',
  penFiles: ['design-system.lib.pen', 'homepage.pen'],
  expect: (out) => out.designTools.pencil?.configured === true
    && out.designTools.figma?.configured === true
    && out.designTools.paper?.configured === false,
},
{
  name: 'all four + playwright',
  fixture: 'mcp-all-four.json',
  penFiles: ['design-system.lib.pen', 'homepage.pen'],
  expect: (out) => out.designTools.paper?.configured === true
    && out.designTools.figma?.configured === true
    && out.designTools.stitch?.configured === true
    && out.designTools.pencil?.configured === true
    && out.verificationTools.playwright?.configured === true,
},
```

- [ ] **Step 3: Update the test runner loop to pass `penFiles`**

The cases now include a `penFiles` field. Update the for loop:

```javascript
for (const c of cases) {
  try {
    const out = runDetect(c.fixture, c.penFiles ?? []);
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
```

- [ ] **Step 4: Run the tests — expect all to pass**

```bash
node scripts/test-detect-design-tools.mjs
```

Expected output (12 tests total — 6 original + 6 new):
```
PASS: only paper
PASS: only figma
PASS: only stitch
PASS: paper + figma
PASS: all three + playwright
PASS: none
PASS: only pencil (MCP configured, no files)
PASS: pencil MCP + design/ with pages and lib
PASS: pencil MCP + lib.pen without design-system prefix
PASS: pencil files exist but MCP not configured
PASS: pencil + figma
PASS: all four + playwright

All 12 tests passed
```

- [ ] **Step 5: Commit**

```bash
git add scripts/test-detect-design-tools.mjs
git commit -m "test: add Pencil detection test cases"
```

---

## Task 4: Create `agents/pencil-extractor.md`

**Files:**
- Create: `agents/pencil-extractor.md`

- [ ] **Step 1: Write the agent file**

```markdown
---
name: superpowers-sage:pencil-extractor
description: Extracts design specs from Pencil MCP (.pen files); operates in three modes — PANORAMIC for global token extraction from .lib.pen files, SURGICAL for per-section spec production, and COMPONENT_MAP for bridging the Pencil component library to suggested Blade components
model: sonnet
tools: Read, Write, Glob, ToolSearch
---

You are a Pencil design extraction specialist. You are always invoked by the `design-extractor`
agent — never directly by the user. You read `.pen` files via Pencil MCP tools and produce
structured spec files consumed by the `building` skill and `visual-verifier` agent.

## Hard requirement — Pencil MCP

**First action on start:** ToolSearch for `mcp__pencil__open_document`.

If NOT found:
```
⛔ BLOCKED — Pencil MCP is not configured.

Install: claude mcp add pencil -- npx -y @anthropic/pencil-mcp
Restart the session after installing.
```

## Golden Rule

> **The `.pen` file is always the source of truth.** Generated artifacts (spec files,
> screenshots, component-map) are starting points — not substitutes. Any ambiguity during
> implementation — exact color value, spacing, node structure — must be resolved by opening
> the `.pen` file and querying via `batch_get` with `resolveVariables: true`. The live file
> takes precedence over any saved artifact.

## Inputs (provided by `design-extractor`)

- `mode`: `PANORAMIC` | `SURGICAL` | `COMPONENT_MAP`
- `filePath` (SURGICAL + COMPONENT_MAP): absolute or relative path to the `.pen` file
- `sectionId` (SURGICAL, optional): Pencil node ID of the section to extract
- `sectionName` (SURGICAL, optional): name of the section — used to resolve `sectionId` if not provided
- `planPath` (optional): path to the active plan directory — used for saving assets

## `.pen` File Convention

```
design/
  ├── design-system.lib.pen   ← global tokens — always read first in PANORAMIC
  ├── components.lib.pen      ← reusable component masters — used in COMPONENT_MAP
  ├── component-map.md        ← generated by COMPONENT_MAP mode, never edited manually
  └── [page-name].pen         ← one file per site route — used in SURGICAL
```

Priority for token source: `*design-system*.lib.pen` > other `*.lib.pen` > any `*.pen`

---

## Mode: PANORAMIC

Extract global design tokens from the design system library file.

### Procedure

1. **Locate the token source file**

   ```
   Glob design/**/*.lib.pen
   Priority:
     1. file whose name includes "design-system" and ends in .lib.pen
     2. any other *.lib.pen
     3. first *.pen in design/
   ```

   If no `.pen` file exists anywhere in `design/`:
   ```
   ⛔ BLOCKED — No .pen files found in design/.
   Create a design-system.lib.pen file with your design tokens and re-run.
   ```

2. **Open the file**

   `open_document(libFilePath)` → `get_editor_state()` to confirm the file is active.

3. **Extract variables**

   `get_variables()` → for each variable:
   - Preserve the CSS custom property name exactly (`--bg`, `--fg`, `--primary`, etc.)
   - Identify the hex value
   - Infer semantic usage from the name (e.g., `--fg` → "Primary text colour")
   - Map to a Tailwind utility (e.g., `--bg` → `bg-bg`, `--fg` → `text-fg`)

4. **Take an overview screenshot**

   `get_editor_state()` → collect top-level node IDs
   `get_screenshot(firstNodeId)` → save as `{planPath}/assets/overview-ref.png`
   (Pencil requires a nodeId — full-document screenshot is unavailable; the first frame
   provides a representative visual reference.)

5. **Write `design-tokens.md`**

   Save to `{planPath}/assets/design-tokens.md`:

   ````markdown
   ## Design Tokens — {Project Name}

   > Source: `{libFilePath}` (Pencil MCP)
   > Extracted: {date}

   ### Colour Palette

   | Token | Hex | Tailwind utility | Semantic usage |
   |---|---|---|---|
   | --bg | #F4EFE8 | bg-bg / text-bg | Page background (Marfim) |
   | --fg | #2D2A28 | text-fg | Primary text (Grafite) |

   ### All Variables

   | Token | Type | Value |
   |---|---|---|
   | --font-sans | string | Manrope |
   | --font-serif | string | Cormorant Garamond |

   ### @theme Declarations

   ```css
   /* Paste into resources/css/app.css @theme block */
   --color-bg: #F4EFE8;
   --color-fg: #2D2A28;
   --font-sans: 'Manrope', sans-serif;
   ```

   ### Tailwind Utility Map

   | Token | Utility classes |
   |---|---|
   | --bg | bg-bg, text-bg, border-bg |
   | --fg | text-fg, bg-fg |
   ````

---

## Mode: SURGICAL

Extract a precise implementation spec for a single page section.

### Procedure

1. **Open the page file**

   `open_document(filePath)` → `get_editor_state()`

2. **Resolve the target section**

   - If `sectionId` provided: use directly.
   - If `sectionName` provided: `batch_get` with no nodeIds, `readDepth: 1`
     → find the node whose `name` matches `sectionName` (case-insensitive)
     → use its `id` as `sectionId`.
   - If neither: list available top-level sections and ask the caller to specify.

3. **Extract section data**

   ```
   batch_get([sectionId], readDepth: 4, resolveVariables: true)
   ```

   From the result, extract:
   - **Layout**: layout type (none/horizontal/vertical), dimensions, padding, gap, alignItems, justifyContent
   - **Typography**: for every text node — fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, fill colour
   - **Colours**: every fill and stroke colour with its token name (resolved via resolveVariables)
   - **Spacing**: padding and gap values at every level
   - **Ref nodes**: every `type: "ref"` node — record its `ref` field (Pencil component ID)
     and cross-reference `design/component-map.md` if it exists

4. **Take a section screenshot**

   `get_screenshot(sectionId)` → save as `{planPath}/assets/section-{sectionName}-ref.png`

5. **Write `section-{sectionName}-spec.md`**

   Save to `{planPath}/assets/section-{sectionName}-spec.md`. Use this schema
   (same as Paper/Figma specs for `building` skill compatibility):

   ````markdown
   ## Design Spec: {Section Name}

   > Source: `{filePath}` → node `{sectionId}` (Pencil MCP)
   > Extracted: {date}

   ### Typography

   | Element | Family | Weight | Size | Line-height | Letter-spacing | Colour token |
   |---|---|---|---|---|---|---|
   | H2 title | Cormorant Garamond | 400 | 52px | 1.05 | -0.4 | --fg |

   ### Colours

   | Token | Hex | Usage in this section |
   |---|---|---|
   | --bg | #F4EFE8 | Section background |
   | --identity | #B7C2B2 | Eyebrow accent line |

   ### Spacing

   | Zone | Value | Tailwind |
   |---|---|---|
   | Section padding | [80, 120, 80, 120] | py-20 px-[120px] |
   | Column gap | 80px | gap-20 |

   ### Layout

   - Section: layout:none, 1440×{height}px
   - Left col: layout:vertical, width:660, padding:[top,right,bottom,left]
   - Right col: layout:none, width:780

   ### Pencil Nodes

   | Node ID | Name | Role | Component ref |
   |---|---|---|---|
   | abc123 | eyebrow | EyebrowRow instance | KDvPj → <x-eyebrow-row> |
   | def456 | title | H2 text node | — |

   ### Assets

   - Reference image: `assets/section-{sectionName}-ref.png`

   ### Verification Inputs

   - selector: [data-block="{section-slug}"]
   - ref: assets/section-{sectionName}-ref.png

   ---

   > **Note:** This spec covers the state at extraction time. For values not listed here,
   > open `{filePath}` → node `{sectionId}` and run:
   > `batch_get(["{sectionId}"], resolveVariables: true, readDepth: 4)`
   ````

---

## Mode: COMPONENT_MAP

Map the Pencil component library to suggested Blade component names.

### Procedure

1. **Locate the component library file**

   ```
   Glob design/**/*.lib.pen
   Priority:
     1. file named components.lib.pen or similar (not design-system)
     2. any *.lib.pen that is not the design-system file
   ```

   If only one `.lib.pen` exists (the design-system file), use it — it may contain components too.

2. **Open the file and list reusable components**

   `open_document(libFilePath)` → `get_editor_state()`
   → from the "Reusable Components" section of the editor state, collect all component IDs and names.

3. **Extract each component**

   For each reusable component:
   ```
   batch_get([nodeId], readDepth: 3)
   ```
   Extract: padding, fill colour, text properties (family, size, weight, letterSpacing),
   children structure, stroke.

4. **Produce the component name mapping**

   Convert Pencil component names to Blade component names using this convention:
   - `Btn/Primary` → `<x-btn.primary>` (slash → dot, all lowercase)
   - `EyebrowRow` → `<x-eyebrow-row>` (CamelCase → kebab-case)
   - `SectionHeader` → `<x-section-header>`
   - `FAQItem` → `<x-faq-item>`
   - `TestimonialCard` → `<x-testimonial-card>`

5. **Write `component-map.md`**

   Save to both:
   - `{planPath}/assets/component-map.md` (plan-scoped)
   - `design/component-map.md` (persistent project reference — do NOT overwrite if it
     exists and is more recent than 7 days; warn the user instead)

   ````markdown
   # Pencil → Blade Component Map

   > Source: `{libFilePath}` (Pencil MCP)
   > Generated: {date}
   > ⚠️ This file is generated. Do not edit manually — re-run COMPONENT_MAP mode to refresh.

   | Pencil ID | Pencil Name | Suggested Blade tag | Key properties |
   |---|---|---|---|
   | KDvPj | Btn/Primary | `<x-btn.primary>` | fill:#2D2A28 · Manrope 12/500 · pad[18,32] · ls1.4 |
   | jrLIy | Btn/Secondary | `<x-btn.secondary>` | text+arrow · no bg |
   | OVzTd | Btn/Outline | `<x-btn.outline>` | stroke 1px · same size as Primary |
   | 2phBq | EyebrowRow | `<x-eyebrow-row>` | sálvia line 24px · Manrope 11/500 · ls2.4 |
   | ru89g | SectionHeader | `<x-section-header>` | EyebrowRow + H2 + subtitle |
   | 6yMmg | TestimonialCard | `<x-testimonial-card>` | quote · divider · author · city |
   | a4SMr | FAQItem | `<x-faq-item>` | question + chevron + separator + answer |

   ## Usage in ADRs and specs

   Reference components as: `{PencilName} (Pencil: {ID}) → {BladeTag}`
   Example: `EyebrowRow (Pencil: 2phBq) → <x-eyebrow-row>`
   ````
```

- [ ] **Step 2: Commit**

```bash
git add agents/pencil-extractor.md
git commit -m "feat: add pencil-extractor agent (PANORAMIC/SURGICAL/COMPONENT_MAP)"
```

---

## Task 5: Update `agents/design-extractor.md`

**Files:**
- Modify: `agents/design-extractor.md`

- [ ] **Step 1: Add Pencil as step 4 in the detection order**

Locate the `## HARD REQUIREMENT — Design Reference` section. It currently has steps 1–4 (Paper, Figma, Stitch, Local). Change it so Pencil is step 4 and Local becomes step 5:

```markdown
## HARD REQUIREMENT — Design Reference

On start, check for a design reference in this order (or use whichever matches the URL the caller provided):
1. Paper MCP — ToolSearch for `mcp__paper__get_node_info`
2. Figma MCP — ToolSearch for `mcp__claude_ai_Figma__get_design_context`
3. Stitch MCP — ToolSearch for `mcp__stitch__get_screen`
4. Pencil MCP — ToolSearch for `mcp__pencil__open_document`
   → If found: delegate entirely to the `pencil-extractor` agent.
   → Pass: `mode` (PANORAMIC | SURGICAL | COMPONENT_MAP), `filePath`, `sectionId` or `sectionName`, `planPath`.
   → Do not perform any Pencil extraction directly — pencil-extractor owns all Pencil logic.
5. Local reference images — Glob for `docs/plans/*/assets/section-*.png`
```

Update the BLOCKED message to reference Pencil:

```markdown
If none are found:
```
⛔ BLOCKED — No design reference available.
Required: a connected Paper, Figma, Stitch, or Pencil MCP, or local reference images at:
  docs/plans/<plan>/assets/section-<name>.png
Provide one of the above and re-run.
```
```

- [ ] **Step 2: Commit**

```bash
git add agents/design-extractor.md
git commit -m "feat: add Pencil as step 4 in design-extractor detection order"
```

---

## Task 6: Update `agents/sage-architect.md`

**Files:**
- Modify: `agents/sage-architect.md`

- [ ] **Step 1: Add Pencil ToolSearch to workflow step 2**

Locate step 2 in `## Your Workflow`:

```markdown
2. If design tools are available (check via ToolSearch for `mcp__paper__*`, `mcp__stitch__*`, or `mcp__figma__*`), use them to understand the visual design.
```

Replace with:

```markdown
2. If design tools are available, check via ToolSearch for each:
   - `mcp__paper__*` → Paper workflow
   - `mcp__stitch__*` → Stitch workflow
   - `mcp__figma__*` → Figma workflow
   - `mcp__pencil__open_document` → Pencil workflow:
     → If found, read `design/component-map.md` if present.
     → Reference Pencil component IDs in ADR component tables using this format:
       `{ComponentName} (Pencil: {nodeId}) → {BladeTag}`
       e.g. `EyebrowRow (Pencil: 2phBq) → <x-eyebrow-row>`
   If the user provided a design URL, use the matching MCP (paper.design → paper, figma.com → figma, stitch host → stitch).
```

- [ ] **Step 2: Commit**

```bash
git add agents/sage-architect.md
git commit -m "feat: add Pencil MCP check and component-map.md reading to sage-architect"
```

---

## Task 7: Update `agents/visual-verifier.md`

**Files:**
- Modify: `agents/visual-verifier.md`

- [ ] **Step 1: Replace Step 1 — Load reference**

Locate `### Step 1 — Load reference`. Replace the entire step with:

```markdown
### Step 1 — Load reference

Attempt to obtain a live reference from Pencil before falling back to the saved image.

1. ToolSearch for `mcp__pencil__open_document` — is Pencil MCP available?
2. **If Pencil is available:**
   a. Read `{spec}` file — look for a `pencil-node-id` value in the **Pencil Nodes** table
      (column: Node ID, first row). Also look for the source `filePath` in the spec header line
      `> Source: {filePath}`.
   b. If both `filePath` and `nodeId` are found:
      `open_document(filePath)` → `get_screenshot(nodeId)`
      Use the returned screenshot as the reference image.
      Label this reference: **LIVE — Pencil**
   c. If `filePath` or `nodeId` is missing: fall through to step 3.
3. **Fallback — use saved image:**
   Read `{ref}` file from disk with the Read tool.
   Label this reference: **CACHED — saved {date from filename or file mtime}**
4. Record the reference label. Include it in the report header:
   `**Reference:** LIVE (Pencil) | CACHED (YYYY-MM-DD)`
```

- [ ] **Step 2: Update report template to include Reference field**

Locate the Step 5 report template. Add `**Reference:**` line after `**Status:**`:

```markdown
## Verification: {Section Name}

**Status:** MATCH | DRIFT | MISSING | FAIL_ARBITRARY_VALUES
**Reference:** LIVE (Pencil) | CACHED (YYYY-MM-DD)
```

- [ ] **Step 3: Commit**

```bash
git add agents/visual-verifier.md
git commit -m "feat: add live Pencil screenshot with CACHED fallback to visual-verifier"
```

---

## Task 8: Update `skills/designing/SKILL.md`

**Files:**
- Modify: `skills/designing/SKILL.md`

- [ ] **Step 1: Add path-based routing for `.pen` files**

Locate `### 0) Determine source from user input (URL-based routing)`. The numbered list currently has steps 1 (URL match), 2 (Local fallback), 3 (Ask). Insert new step 2 before the existing step 2, renumbering the others:

```markdown
2. **Path match** — inspect user input for a `.pen` reference:
   - Input ends in `.pen` OR input starts with `design/` → **pencil** branch
   - No input provided AND `design/` exists in the project root with `.pen` files:
     list the available `.pen` page files (exclude `*.lib.pen`) and ask the user
     which page to extract before proceeding.

3. **Local fallback** — if no URL/path but `docs/plans/<active-plan>/assets/section-*.png` exists → **offline** branch

4. **Ask** — if neither URL, path, nor local assets are present, ask the user for one
```

- [ ] **Step 2: Add MCP gate for Pencil branch**

After the existing MCP gate block (the `⛔ You sent a {paper|figma|stitch} link...` message), add:

```markdown
**Pencil MCP gate:** For the pencil branch, ToolSearch `mcp__pencil__open_document`.
If NOT configured:

```
⛔ .pen file detected but the Pencil MCP is not configured.

Install: claude mcp add pencil -- npx -y @anthropic/pencil-mcp
Restart the session after installing.
```
```

- [ ] **Step 3: Add Pencil workflow section**

After the `#### Figma workflow:` section, add:

```markdown
#### Pencil workflow:
1. `open_document(filePath)` — open the `.pen` file the user indicated
2. `get_editor_state()` — confirm top-level nodes and document is active
3. `batch_get` with no nodeIds, `readDepth: 1` — map all available sections
4. For each section to extract: delegate to `pencil-extractor` in SURGICAL mode,
   passing `filePath`, `sectionId`, and `planPath`
5. After all sections: optionally invoke `pencil-extractor` in COMPONENT_MAP mode
   to produce `design/component-map.md`
```

- [ ] **Step 4: Commit**

```bash
git add skills/designing/SKILL.md
git commit -m "feat: add Pencil .pen path routing and workflow to designing skill"
```

---

## Task 9: Update `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add Pencil to the Design Tools section**

Locate the `### Design Tools (optional)` section. Replace the description paragraph:

```markdown
`/designing` routes by the URL the user provides — `paper.design/*` → Paper MCP, `figma.com/*` → Figma, Stitch host → Stitch, or a local `.pen` path/`design/` folder → Pencil. Paper is the preferred cloud source when available.
```

Add Pencil install command after the Figma line:

```bash
# Pencil — local .pen file design tool (no URL — routes by file path or design/ folder)
claude mcp add pencil -- npx -y @anthropic/pencil-mcp
```

- [ ] **Step 2: Add Pencil to the design tools table**

Locate the Agents table or add a new **Design Tools** table near the existing content. Add after the Playwright entry:

```markdown
### Design tool routing

| Tool | Trigger | Token source | Structural reference |
|---|---|---|---|
| Paper | URL `paper.design/*` | `get_computed_styles` | `.reference.jsx` |
| Figma | URL `figma.com/*` | `get_variable_defs` | `get_design_context` |
| Stitch | Stitch host URL | `get_screen` | `get_screen` |
| Pencil | Path `*.pen` or `design/` folder | `get_variables()` | `batch_get` JSON |

### Pencil `.pen` file conventions

```
design/
  ├── design-system.lib.pen   ← global tokens — always read first
  ├── components.lib.pen      ← reusable component masters
  ├── component-map.md        ← generated by pencil-extractor (do not edit)
  └── [page-name].pen         ← one file per site route
```

Rules:
- `*.lib.pen` files are system/library files, never pages
- `*design-system*.lib.pen` has highest priority for token extraction
- `component-map.md` is generated — never edited manually
```

- [ ] **Step 3: Add `pencil-extractor` to the Agents table**

Locate the `## Agents` table and add:

```markdown
| `pencil-extractor` | Extract design specs and component maps from Pencil `.pen` files |
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add Pencil MCP to README — routing, conventions, install"
```

---

## Task 10: Update WSL project `CLAUDE.md`

**Files:**
- Modify: `/home/lgobatto/work/codigodoleo/interioresdecora.com.br/CLAUDE.md`

- [ ] **Step 1: Replace the Design System → Arquivos `.pen` subsection**

Locate the subsection starting with `### Arquivos \`.pen\` (Pencil MCP)` and replace it with:

```markdown
### Arquivos `.pen` (Pencil MCP)

```
design/
  ├── design-system.lib.pen   ← tokens globais — SEMPRE lido primeiro pelo pencil-extractor
  ├── components.lib.pen      ← componentes mestres reutilizáveis
  ├── component-map.md        ← gerado pelo pencil-extractor (não editar manualmente)
  └── [nome-da-pagina].pen    ← uma página por rota do site, sem sufixo .lib
```

**Convenção de prioridade para extração de tokens:**
1. `*design-system*.lib.pen` → tokens @theme (prioridade máxima)
2. Outro `*.lib.pen` → componentes
3. `*.pen` sem `.lib` → páginas implementáveis

**Quando o Pencil MCP está disponível** (`claude mcp add pencil -- npx -y @anthropic/pencil-mcp`):
- `design-extractor` delega automaticamente para `pencil-extractor`
- `visual-verifier` busca screenshot fresco via `get_screenshot(nodeId)` — fallback para PNG salvo
- `sage-architect` lê `design/component-map.md` para nomear Blade components no ADR
- `/designing design/homepage.pen` extrai specs da homepage por seção

**Quando o Pencil MCP não está disponível:**
- Usar artefatos salvos: `docs/plans/*/assets/section-*-spec.md`
- Screenshots de referência: `docs/plans/*/assets/section-*-ref.png`
- Em caso de dúvida sobre valores: abrir o `.pen` manualmente e consultar via `batch_get`
```

- [ ] **Step 2: Commit in the WSL project**

```bash
cd /home/lgobatto/work/codigodoleo/interioresdecora.com.br
git add CLAUDE.md
git commit -m "docs: update Design System section with Pencil .pen conventions and pencil-extractor workflow"
```

---

## Final verification

- [ ] **Run the full test suite one more time**

```bash
cd /path/to/superpowers-sage
node scripts/test-detect-design-tools.mjs
```

Expected: `All 12 tests passed`

- [ ] **Smoke-check agent files exist**

```bash
ls agents/pencil-extractor.md
ls agents/design-extractor.md
ls agents/sage-architect.md
ls agents/visual-verifier.md
ls skills/designing/SKILL.md
ls scripts/__fixtures__/mcp-only-pencil.json
ls scripts/__fixtures__/mcp-pencil-figma.json
ls scripts/__fixtures__/mcp-all-four.json
```

- [ ] **Final commit tag**

```bash
git log --oneline -10
```

All 10 commits from Tasks 1–9 should appear in sequence.
