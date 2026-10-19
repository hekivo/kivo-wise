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

Or, inside Claude Code:

```
/plugin install kivo-creator --marketplace hekivo/kivo-wise
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
