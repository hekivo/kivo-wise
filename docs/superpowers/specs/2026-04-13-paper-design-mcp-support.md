> Historical document from superpowers-sage 2.x. It describes features that were removed or replaced in kivo-wise 3.0 and is kept for reference only.

# Paper.design MCP Support

**Date:** 2026-04-13
**Status:** Approved (pending implementation)

## Problem

The `superpowers-sage` plugin currently supports two design-tool MCPs as sources for layout/content extraction: Stitch and Figma. Users working from paper.design have no first-class path — they fall back to the offline branch (manual screenshots) and lose the structured extraction that Stitch/Figma users get.

Paper.design exposes capabilities the other two don't (`get_jsx`, `get_computed_styles`, `write_html`, `get_fill_image`, `get_tree_summary`), which can enrich both extraction (designing) and verification (verifying) when used.

## Goals

1. Treat paper.design as a first-class design source, on par with Figma and Stitch.
2. Route to the right MCP based on the **URL/input the user provides** — not based on which MCPs happen to be configured.
3. Use paper's extra capabilities to enrich the assets persisted to disk and to enable a new style-drift spot-check during verification.
4. Keep the textual schema of extracted sections **identical** across all sources so downstream skills (`building`, `verifying`) stay agnostic of the source.

## Non-goals

- Re-architecting how `building` consumes design assets. It keeps reading the same per-section markdown.
- Auto-generating Blade from paper's JSX. JSX is a structural reference only.
- Replacing the visual diff in `verifying`. The new style spot-check is additive, not a replacement.
- Supporting paper-specific MCP tools that aren't useful for Sage workflows (`computer`, `write_html` for arbitrary HTML, etc.).

## Design

### 1. URL-based routing

Dispatch of a design source is determined by the URL/input the user provides, not by which MCPs are configured.

| User input pattern | Source branch |
|---|---|
| `paper.design/*`, `*.paper.design/*` | paper |
| `figma.com/*` | figma |
| `stitch.withgoogle.com/*` (or known stitch hosts) | stitch |
| Local path or `assets/*.png` exists in active plan | offline |
| Nothing provided | ask the user |

If the user provides a URL whose corresponding MCP is **not configured**, the skill stops with an explicit message ("you sent a paper.design link but the `paper` MCP is not configured on this machine — configure it or send a link from another source"). No silent fallback.

`scripts/detect-design-tools.mjs` is no longer a selector. It becomes a pure inventory script (used by onboarding to list what's available). It gains a `paper` field in `designTools` alongside `stitch` and `figma`.

### 2. `skills/designing/SKILL.md` — paper extraction branch

A new branch parallel to the existing Stitch/Figma/offline branches. For each section the user wants extracted:

1. `mcp__paper__get_basic_info` + `mcp__paper__get_tree_summary` — map the document, locate the target section node.
2. `mcp__paper__get_node_info` on the section — capture structure, text, hierarchy.
3. `mcp__paper__get_screenshot` — save as `assets/section-{name}.png`.
4. `mcp__paper__get_computed_styles` — save as `assets/section-{name}.styles.json` (typography, colors, spacing — exact values).
5. `mcp__paper__get_jsx` — save as `assets/section-{name}.reference.jsx` with this header comment:
   ```
   // REFERÊNCIA ESTRUTURAL APENAS — NÃO COPIAR.
   // Sage usa Blade, não React. Use isso só para entender
   // hierarquia de componentes e nesting.
   ```
6. Produce the same structured chat output as the other branches (Layout / Headline / Body / Components / Colors / Typography / Spacing).

**Key principle:** the textual schema in chat is identical regardless of source. Only the contents of `assets/` differ — paper enriches them, the others don't.

The plan frontmatter `design-tool` field gains `paper` as a valid value alongside `stitch | figma | offline`.

### 3. `skills/verifying/SKILL.md` — style spot-check (paper only)

The existing visual diff (Playwright/Chrome screenshot of implementation × reference screenshot in `assets/`) is unchanged.

A new additive layer activates only when `assets/section-{name}.styles.json` is present (i.e., source = paper):

1. Read the styles JSON saved by `designing`.
2. For each key property (typography, colors, spacing, border-radius), find the implemented value:
   - If the Blade/CSS uses a Tailwind class (`p-6`, `text-lg`, `bg-slate-900`), resolve the class to its real value from the project's Tailwind config.
   - If it uses an arbitrary value (`p-[23px]`), capture the literal.
3. Compare design value × implemented value and produce a per-section report:
   ```
   ✓ padding:    design=24px, impl=p-6 (24px)
   ✗ font-size:  design=18px, impl=text-base (16px)  — DRIFT
   ✓ color:      design=#0F172A, impl=bg-slate-900 (#0F172A)
   ```
4. **Non-fatal**: drift does not block verifying. It surfaces as a highlighted warning section in the final report alongside the visual diff. The user decides whether to adjust.

If the source is Stitch/Figma/offline (no `.styles.json` present), the spot-check is skipped silently.

### 4. Inventory, agents, and docs

- **`scripts/detect-design-tools.mjs`** — `detectMCPServers` matches `paper` (by name or command); output JSON includes `designTools.paper`. Signature unchanged otherwise.
- **`hooks/session-start.sh`** — if it consumes the detect JSON, surface the new `paper` key.
- **`skills/onboarding/SKILL.md`** — list paper alongside Stitch/Figma in the detected design tools section, with a note that it is preferred when the design link is `paper.design`.
- **`skills/sageing/SKILL.md`** (meta-skill) — describe paper as a third supported design source, document the URL-based routing rule.
- **`skills/architecture-discovery/SKILL.md`** — wherever it mentions "consult Figma/Stitch", change to "consult paper/Figma/Stitch as appropriate for the link provided". No structural change to discovery.
- **`agents/design-extractor.md`** — list paper as a supported source; ensure the agent's tool allowlist includes `mcp__paper__*`. Reinforce the JSX-as-reference rule.
- **`agents/sage-architect.md`** — wherever it mentions design-tool consultation, add paper. No behavior change.
- **`plugin.json`** and **`.claude-plugin/plugin.json`** — update description/keywords if they explicitly mention Figma/Stitch.
- **`README.md`** — design tools section now includes paper.design with link and preference note.

## Validation

### Automated — `detect-design-tools.mjs`

Add fixtures under `scripts/__fixtures__/` for: only paper, only figma, only stitch, paper+figma, paper+stitch+figma, none. A small test script (`scripts/test-detect.mjs`) runs the detect against each fixture and asserts the expected JSON. Pure Node, no external deps.

### Manual — skills and agents

Markdown skills can't be unit-tested. The plan must include a manual checklist gate before marking the work done:

1. Paste a `paper.design/...` link in a test project → `designing` routes to the paper branch and saves three artifacts (`.png`, `.styles.json`, `.reference.jsx`) under `assets/`.
2. Paste a Figma link → still works as before (regression check).
3. Run `verifying` against a section implemented with paper as source → report includes the style spot-check section.
4. Run `verifying` against a section with figma as source → spot-check is skipped; only the visual diff runs.
5. Run `onboarding` in a project with paper configured → paper is listed in detected design tools.

## Open questions

None at this time. All questions raised during brainstorming were resolved.
