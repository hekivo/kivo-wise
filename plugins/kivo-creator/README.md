# kivo-creator

Figma and HTML to WordPress on the Roots stack. kivo-creator turns a design into a page made of blocks the project already has, generates a block only when nothing fits, and proves the result with numbers.

```
source ─▶ ingest ─▶ section specs ─▶ match plan (stop for approval) ─▶ emit ─▶ verify ─▶ report
```

Requires the [kivo-wise](../../README.md) plugin (stack detection and runner context), Node.js 20+, and Playwright in the target project for HTML sources and verification. Figma sources need the official Figma MCP server connected in the session. Pixel references for Figma sections also need a Figma personal access token exported as `FIGMA_TOKEN`; without it reference images cannot be fetched, and verify only checks styles and lint for those sections.

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

All scripts are dependency-free Node ESM in `scripts/`: `ingest-html.mjs`, `validate-spec.mjs`, `match.mjs`, `block-type.mjs`, `emit.mjs`, `verify.mjs`, `png.mjs` (PNG decoder and pixel diff on `node:zlib`), `figma-sections.mjs`, `figma-ref.mjs`, `code-connect.mjs`. Section specs follow `schemas/section-spec.schema.json`.

## Adapters

| Adapter | Target | New blocks when the project has none yet |
|---|---|---|
| `acorn-mu-plugin` | Blocks in an Acorn mu-plugin | ACF Composer (recommended) |
| `sage-theme` | Blocks in a Sage theme | ACF Composer when `composer.json` requires `log1x/acf-composer`, otherwise native (recommended) |
| `radicle` | Blocks in a Radicle project | native `block.json` (recommended) |

Every adapter reads both block types into its catalog (ACF Composer classes and `block.json` files), so a section can fill any existing block, and each existing block is emitted in its own markup. **New blocks follow the project's existing pattern**: if the project uses ACF Composer blocks they are always ACF (block class, Blade view, CSS notes, `acf/*` markup); if it uses `block.json` they are always native (`block.json`, Blade view, markup). The decision (`scripts/adapters/shared/block-type.mjs`):

1. `.roots-stack.json` `"creator": { "blocks": "acf" | "native" }` wins; any other value is an error.
2. Otherwise the existing blocks are counted; a type with at least 80% of them (`DOMINANT_SHARE`) is the project's type.
3. Both types and neither at 80%, or no blocks at all: nothing is guessed. `/creator` asks the person once (recommending the profile default from the table when there are no blocks) and offers to record the answer with `node scripts/block-type.mjs --set=acf|native`; until then `emit.mjs` refuses to scaffold. `--blocks=acf|native` answers for one run.

The decision is recorded as `blockType` (`type`, `source`: `override` | `count` | `asked`, `counts`) in `match-plan.json`, `match-plan.md` and `emitted.json`.

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
