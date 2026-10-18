> Historical document from superpowers-sage 2.x. It describes features that were removed or replaced in kivo-wise 3.0 and is kept for reference only.

# Design Spec: Pencil MCP Support
**Date:** 2026-04-16
**Status:** approved
**Scope:** superpowers-sage plugin

---

## Context

The plugin already supports three design tools (Paper, Figma, Stitch) through a consistent
routing model: URL-based detection → tool-specific extraction → structured spec artifacts →
implementation → visual verification.

Pencil MCP is a local design tool that works with `.pen` files on disk — no cloud URL. It is
used in production on the Interiores Decora project (`design/` folder with `.pen` and `.lib.pen`
files). The goal is to add Pencil as a first-class fourth design tool with full pipeline coverage:
detection → token extraction → per-section spec → component mapping → visual verification.

---

## Decision

**Approach C — Native integration + dedicated agent + component mapper.**

Pencil is integrated into all existing files that reference design tools, following the same
patterns as Paper/Figma/Stitch. A new `pencil-extractor` agent encapsulates all Pencil-specific
knowledge and operates in three modes. A component mapper produces a `component-map.md` that
bridges the Pencil component library to Blade components.

The `.pen` file is always the source of truth. Generated artifacts (spec files, screenshots,
component-map) are starting points — not substitutes. Any ambiguity during implementation or
verification must be resolved by consulting the live `.pen` file.

---

## Architecture

### Pipeline

```
1. DETECTION
   detect-design-tools.mjs
   → Pencil MCP in .mcp.json? + design/*.pen exists?
   → Reports: pencil: { configured, hasFiles, libFile, pageFiles[] }

2. PANORAMIC EXTRACTION (global tokens)
   design-extractor (PANORAMIC) → pencil-extractor
   → Opens design-system.lib.pen (or first .lib.pen found)
   → get_variables() → design-tokens.md (@theme ready)
   → get_screenshot() → overview-ref.png

3. SURGICAL EXTRACTION (per section)
   design-extractor (SURGICAL) → pencil-extractor
   → Opens page .pen file
   → batch_get(sectionId, resolveVariables:true, readDepth:4)
   → get_screenshot(sectionId) → section-<name>-ref.png
   → Produces section-<name>-spec.md with Pencil Nodes table
   → Directive: "consult .pen for additional detail"

4. COMPONENT MAPPING
   pencil-extractor (COMPONENT_MAP)
   → Opens components.lib.pen
   → Lists reusable nodes
   → Maps to suggested Blade components
   → Produces component-map.md (design/ + plan assets/)

5. IMPLEMENTATION
   building skill (unchanged)
   → Reads design-tokens.md + section-spec.md + component-map.md

6. VERIFICATION
   visual-verifier
   → Playwright screenshot of running site
   → Tries get_screenshot(nodeId) from Pencil (live)
   → Fallback: saved section-<name>-ref.png
   → Reports which reference was used: LIVE | CACHED
```

### File inventory

```
superpowers-sage/
├── agents/
│   └── pencil-extractor.md          ← NEW
├── scripts/
│   ├── detect-design-tools.mjs      ← MODIFIED
│   ├── test-detect-design-tools.mjs ← MODIFIED
│   └── __fixtures__/
│       ├── mcp-only-pencil.json     ← NEW
│       ├── mcp-pencil-figma.json    ← NEW
│       └── mcp-all-three.json       ← MODIFIED (→ mcp-all-four.json)
├── skills/
│   └── designing/SKILL.md           ← MODIFIED
├── agents/
│   ├── design-extractor.md          ← MODIFIED
│   ├── sage-architect.md            ← MODIFIED
│   └── visual-verifier.md           ← MODIFIED
└── README.md                        ← MODIFIED
```

---

## Components

### NEW: `agents/pencil-extractor.md`

Agent with three modes, always invoked by `design-extractor` — never directly by the user.

#### Mode PANORAMIC

1. Glob `design/**/*.lib.pen` → prioritise `*design-system*.lib.pen`
   → Fallback: first `*.lib.pen` found
   → Fallback: first `*.pen` in `design/`
   → If none: BLOCKED — instruct user to create `design-system.lib.pen`
2. `open_document(libFilePath)` → `get_editor_state()` to confirm
3. `get_variables()` → map each variable to `@theme` token:
   - Preserve CSS custom property name (`--bg`, `--fg`, etc.)
   - Add Tailwind utility equivalent per token
4. `get_editor_state()` → collect top-level frame IDs
   → `get_screenshot(firstFrameId)` → save as `assets/overview-ref.png`
   (Pencil requires a nodeId — full-document screenshot is not available;
   first frame gives a representative visual reference)
5. Produce `design-tokens.md`:
   - Token table: name | hex | semantic usage
   - Ready-to-paste `@theme` CSS block
   - Tailwind utility mapping per token

#### Mode SURGICAL

Inputs: `filePath`, `sectionId` OR `sectionName`

1. `open_document(filePath)` → `get_editor_state()`
2. Resolve sectionId:
   - If sectionName: `batch_get(readDepth:1)` → match by `name` field (case-insensitive)
   - If sectionId: use directly
3. `batch_get([sectionId], readDepth:4, resolveVariables:true)`
   - Extract: layout, typography, colors, spacing, fills, text content
   - For each `ref` node: record Pencil component ID → cross-reference `component-map.md`
4. `get_screenshot(sectionId)` → save as `assets/section-<name>-ref.png`
5. Produce `section-<name>-spec.md`:
   - Same schema as Paper/Figma specs (building skill compatibility)
   - Extra section: **Pencil Nodes** table — nodeId | role | component ref
   - Footer directive: "For detail not covered here, consult `<filePath>` → node
     `<sectionId>` via `batch_get(resolveVariables:true)`"

#### Mode COMPONENT_MAP

1. Glob `design/**/*.lib.pen` → open `components.lib.pen` (or non-design-system lib)
2. `get_editor_state()` → list Reusable Components
3. For each reusable node: `batch_get([nodeId], readDepth:3)`
   - Extract: name, padding, colors, typography, children structure
4. Produce `component-map.md`:

   | Pencil ID | Pencil Name   | Suggested Blade         | Notes                       |
   |-----------|---------------|-------------------------|-----------------------------|
   | KDvPj     | Btn/Primary   | `<x-btn.primary>`       | Manrope 12/500, pad [18,32] |
   | 2phBq     | EyebrowRow    | `<x-eyebrow-row>`       | Sálvia line + label SM caps |
   | ru89g     | SectionHeader | `<x-section-header>`    | EyebrowRow + H2 + subtitle  |

5. Save to:
   - `docs/plans/<plan>/assets/component-map.md` (plan-scoped)
   - `design/component-map.md` (persistent project-level reference)

#### Core directive (embedded in agent)

> **Golden rule:** Generated artifacts are starting points, not ground truth. When in doubt
> during implementation — exact color, spacing, node structure — open the `.pen` file and
> query via `batch_get(resolveVariables:true)`. The live file takes precedence over any
> saved artifact.

---

### MODIFIED: `detect-design-tools.mjs`

Inside `detectMCPServers()`:
```javascript
if (nameLower.includes('pencil') || cmdStr.includes('pencil')) {
  result.pencil = { name, configured: true };
}
```

After MCP detection loop:
```javascript
const designDir = join(rootPath, 'design');
if (existsSync(designDir)) {
  const penFiles = readdirSync(designDir).filter(f => f.endsWith('.pen'));
  const libFile =
    penFiles.find(f => f.endsWith('.lib.pen') && f.includes('design-system')) ||
    penFiles.find(f => f.endsWith('.lib.pen')) ||
    null;
  const pageFiles = penFiles.filter(f => !f.endsWith('.lib.pen'));
  result.pencil = {
    ...result.pencil,
    hasFiles: penFiles.length > 0,
    libFile: libFile ? join('design', libFile) : null,
    pageFiles: pageFiles.map(f => join('design', f)),
  };
}
```

Output `designTools` block gains `pencil` key alongside paper/stitch/figma.

---

### MODIFIED: `skills/designing/SKILL.md`

Routing step 0 — add path-based detection before local fallback:

```
2. Path match (NEW):
   - Input ends in .pen OR starts with design/ → pencil branch
   - No input + design/ exists with .pen files → list available files,
     ask user to confirm which page to extract
```

MCP gate for Pencil branch:
```
⛔ .pen file detected but Pencil MCP is not configured.
   claude mcp add pencil -- npx -y @anthropic/pencil-mcp
   Restart the session after installing.
```

Pencil workflow (added after Stitch section):
```
#### Pencil workflow:
1. open_document(filePath)
2. get_editor_state() — confirm top-level nodes
3. batch_get(readDepth:1) — map available sections
4. Extract per section (delegate to pencil-extractor SURGICAL mode)
5. Save screenshot + spec.md per section
```

---

### MODIFIED: `agents/design-extractor.md`

Detection order — add Pencil as step 4:
```
4. Pencil MCP — ToolSearch mcp__pencil__open_document
   → If found: delegate entirely to pencil-extractor agent
   → Pass: mode (PANORAMIC|SURGICAL|COMPONENT_MAP), filePath, sectionId
```

No other changes — pencil-extractor owns all Pencil logic.

---

### MODIFIED: `agents/sage-architect.md`

In workflow step 2, add Pencil check:
```
- mcp__pencil__open_document → Pencil workflow
  → If detected: read design/component-map.md if present
  → Reference Pencil IDs in ADR component table:
    e.g. "EyebrowRow (Pencil: 2phBq) → <x-eyebrow-row>"
```

---

### MODIFIED: `agents/visual-verifier.md`

Replace Step 1 with:
```
### Step 1 — Load reference (MODIFIED)

1. ToolSearch mcp__pencil__open_document — Pencil available?
2. If yes:
   a. Read section-<name>-spec.md → extract "pencil-node-id" field
   b. open_document(filePath) → get_screenshot(nodeId)
   c. Use as primary reference — label: "LIVE — Pencil"
3. If Pencil unavailable or nodeId not found:
   → Read saved section-<name>-ref.png
   → Label: "CACHED — saved <date>"
4. Report reference source in report header:
   **Reference:** LIVE (Pencil) | CACHED (2026-04-16)
```

---

## `.pen` File Organisation Convention

### Canonical structure

```
design/
  ├── design-system.lib.pen     ← global tokens (source of truth)
  ├── components.lib.pen        ← reusable component masters
  ├── component-map.md          ← generated by pencil-extractor
  └── [page-name].pen           ← one file per site route, no .lib suffix
```

### Rules

- `*.lib.pen` — system/library files, never represent a page
- `*design-system*.lib.pen` — highest priority for token extraction
- `*.pen` (no `.lib`) — implementable pages, one per route
- `component-map.md` — generated, never edited manually

---

## Fixtures

### `mcp-only-pencil.json`
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

### `mcp-pencil-figma.json`
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

### `mcp-all-four.json` (rename from mcp-all-three.json)
Add Pencil entry to existing three-server fixture.

---

## Out of Scope (Phase 2)

- Auto-generation of Blade component stubs from component-map
- Multi-design-system support (multiple `.lib.pen` simultaneously)
- Diff detection between `.pen` versions (design change alerts)

---

## Implementation Order

1. Fixtures (`mcp-only-pencil.json`, `mcp-pencil-figma.json`, `mcp-all-four.json`)
2. `detect-design-tools.mjs` + `test-detect-design-tools.mjs`
3. `agents/pencil-extractor.md` ← critical path, everything depends on this
4. `agents/design-extractor.md`
5. `agents/sage-architect.md`
6. `agents/visual-verifier.md`
7. `skills/designing/SKILL.md`
8. `README.md`
9. WSL project `CLAUDE.md`
