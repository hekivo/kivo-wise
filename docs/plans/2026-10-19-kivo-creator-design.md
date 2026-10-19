# kivo-creator: design

- **Date:** 2026-10-19
- **Status:** approved by Leo on 2026-10-19
- **Scope:** Figma and HTML to WordPress on the Roots stack. Paper and Pencil are out of scope.
- **Parity:** `kivo-creator` is the generic, public upstream (this repo, `plugins/kivo-creator`, MIT). A team replica adds its own adapters on top and tracks parity in its own `UPSTREAM.md`. Nothing private flows back here.

## 1. Why a new plugin, and what we learned from superpowers-sage

superpowers-sage 2.x generated code from Paper, Figma, Stitch or Pencil (`designing`, `sage-design-system`, `building`, `verifying`, agents `design-extractor`, `pencil-extractor`, `visual-verifier`). It was removed in 3.0 (`e77e8e8`).

Keep:
- source routed from the URL, with no silent fallback when the MCP is missing;
- every extracted value tagged `exact` or `inferred`, and never invented;
- no arbitrary Tailwind values (`[#hex]`, `[12px]`) in generated markup;
- tokens commented with the design node they came from;
- foundation (tokens, base components) before any block;
- the verify → fix loop, which produced most of the quality.

Fix:
- the pipeline was long, rigid, tied to plans and needed four MCPs;
- the Figma branch used stale tools and never used Code Connect;
- fidelity was judged by eye; there was no pixel diff and the style check covered Paper only;
- everything was generated from scratch because there was no block catalog to reuse.

## 2. Principle: recognise first, generate last

A real project already has blocks. The converter first maps each design section to an existing block and fills its fields. It generates a new block only when nothing fits, and it proves fidelity with numbers.

## 3. Pipeline

```
source ─▶ ingest ─▶ section spec (neutral) ─▶ match against the target catalog ─▶ emit ─▶ verify ─▶ report
                                                  │ no block fits
                                                  └▶ scaffold a new block (or record a gap)
```

### 3.1 Ingest

- **Figma** (official Figma MCP, main session only; subagents do not inherit MCP servers): `get_metadata` for the frame tree and section geometry, `get_design_context` per section, `get_variable_defs` for tokens, `get_screenshot` per section at the canonical width, and `get_code_connect_map` for components already mapped to code. If the MCP is missing, stop and say how to connect it.
- **HTML** (a file, a URL or a published page to migrate): `scripts/ingest-html.mjs` drives Playwright from the target project (no Playwright bundled here), renders at 390 and 1440 px, splits sections by landmarks and layout heuristics, and records text slots, links, media, computed styles and a screenshot per section.

### 3.2 Section spec

One JSON file per section, validated by `schemas/section-spec.schema.json`:

| Field | Meaning |
|---|---|
| `id`, `source` | `{ kind: "figma" \| "html", ref }` (node id or CSS path) |
| `kind` | `hero`, `features`, `cta`, `faq`, `testimonial`, `logos`, `form`, `media`, `text`, `stats`, `steps`, `custom` |
| `slots[]` | `{ name, type: heading \| text \| richtext \| image \| link \| list \| form \| embed, value, provenance: exact \| inferred }` |
| `layout` | columns, alignment, media position, repeat count |
| `tokens` | colours, type, spacing used, each `{ value, token?, provenance }` |
| `refs` | screenshot paths per width |

### 3.3 Match

An adapter exposes the target catalog (`catalog()` → blocks with purpose, when to use, fields). Matching order:
1. **Code Connect**: a Figma component mapped to a block is a deterministic match.
2. **Compatibility filter**: slots and repeat counts the block's fields can hold.
3. **Judgment**: the session model ranks the remaining candidates with a written rubric and an explicit `none` option. An adapter may plug in a typed classifier instead.

Below the confidence threshold, ask the person. The match plan is written to disk before anything is emitted.

### 3.4 Emit

- Fit: fill the block fields from the slots and serialise the page in the target's format (block markup or the target's draft API).
- No fit: `scaffoldBlock(spec)` writes the block in the target's conventions, or the adapter records a gap when the target forbids generated blocks.
- Tokens: map design variables and computed styles to the theme tokens (`@theme`). An unmatched value becomes a token proposal in the report, never a literal in code.

### 3.5 Verify

`scripts/verify.mjs`:
- Playwright screenshot of each rendered section (`[data-block]` or the adapter's selector) at 390 and 1440 px;
- pixel diff against the reference with a dependency-free PNG decoder (`node:zlib`); default limit 2% of pixels per section;
- style check of the `exact` values in the spec against computed styles;
- lint: no arbitrary Tailwind values, no inline styles in generated markup;
- `fidelity.md` with a table per section and width.

On failure, fix and verify again, at most three rounds, then hand the report to the person.

### 3.6 Code Connect

Skill `code-connect`: read the map, propose mappings from Figma components to blocks and Blade components, and send them (`send_code_connect_mappings`) only after the person approves. It flags Figma components with no code counterpart.

## 4. Adapters in this plugin

| Adapter | Target | Emit |
|---|---|---|
| `acorn-mu-plugin` | ACF Composer blocks in an Acorn mu-plugin | block class, Blade view, CSS per block, page as `acf/*` block markup |
| `sage-theme` | blocks in a Sage theme (ACF Composer or native `block.json`) | same, inside the theme |
| `radicle` | Radicle blocks | Radicle block conventions |

Adapters read profile and paths from the kivo-wise detector (`.roots-stack.json` wins). kivo-creator depends on kivo-wise for stack knowledge.

## 5. Commands and skills

- `/creator` (command): route the source, run the pipeline, stop at the match plan for approval.
- Skills: `figma-ingest`, `html-ingest`, `section-matching`, `block-scaffolding-from-design`, `visual-fidelity`, `code-connect`.
- Output goes to `.creator/<run>/` in the target repo (ignored by git): specs, refs, match plan, report.

## 6. Rules

Native first; never invent values; no arbitrary values; no BEM; strings through the project's i18n function; generated blocks pass the project's own validators and tests.

## 7. Testing

- Unit tests: spec schema, PNG decoder and diff, HTML segmentation on fixture pages, compatibility filter, each adapter's emit against golden files.
- Evals (`claude plugin eval`), with recorded Figma MCP responses (`--mocks`) and fixture HTML: correct block chosen, `none` when nothing fits, no arbitrary values, stops without the MCP.

## 8. Phases

1. Core: spec schema, HTML ingest, verify, `acorn-mu-plugin` adapter, `/creator`.
2. Figma ingest and Code Connect.
3. `sage-theme` and `radicle` adapters.
4. Team replica with its adapters (outside this repo).
