// plugins/kivo-creator/scripts/adapters/shared/block-type.mjs
/**
 * Which block type NEW blocks get: the project's existing pattern.
 *  1. `.roots-stack.json` `creator.blocks: "acf" | "native"` wins (source "override").
 *  2. `--blocks=acf|native` is the person's answer for this run (source "asked").
 *  3. Otherwise count the blocks the adapter found: ACF Composer classes vs
 *     block.json files. A type holding at least DOMINANT_SHARE of them wins
 *     (source "count").
 *  4. Both present and neither dominant: { type: null, reason: 'mixed' }.
 *     No blocks at all: { type: null, reason: 'none', recommended }.
 * Scaffolding refuses while type is null. Matching into existing blocks is not
 * affected: the catalog is the union of both types and each existing block is
 * emitted in its own markup.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { acfCatalog, emitAcfPage, scaffoldAcf } from './acf-composer.mjs';
import { emitNativePage, nativeCatalog, scaffoldNative } from './native-block.mjs';

export const BLOCK_TYPES = ['acf', 'native'];
/** Share of the existing blocks one type needs before it counts as the project's type. */
export const DOMINANT_SHARE = 0.8;

const LABEL = { acf: 'ACF Composer', native: 'block.json' };
const readJsonIfExists = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);

export const blockTypeOf = (block) => block.type ?? (String(block.name).startsWith('acf/') ? 'acf' : 'native');

export function countBlocks(catalog) {
  const counts = { acf: 0, native: 0 };
  for (const block of catalog) counts[blockTypeOf(block)] += 1;
  return counts;
}

function requiresAcfComposer(stack) {
  for (const dir of new Set([stack.appPath, stack.projectDir])) {
    const composer = readJsonIfExists(join(dir, 'composer.json'));
    if (composer?.require?.['log1x/acf-composer'] || composer?.['require-dev']?.['log1x/acf-composer']) return true;
  }
  return false;
}

/** The type recommended when the project has no blocks yet. */
export function profileDefault(stack) {
  if (stack.profile === 'acorn-mu-plugin') return 'acf';
  if (stack.profile === 'radicle-app') return 'native';
  return requiresAcfComposer(stack) ? 'acf' : 'native';
}

function checkValue(value, where) {
  if (!BLOCK_TYPES.includes(value)) throw new Error(`${where} must be "acf" or "native" (got ${JSON.stringify(value)})`);
  return value;
}

export function resolveBlockType(stack, catalog, { asked = null } = {}) {
  const counts = countBlocks(catalog);
  const raw = stack.creatorBlocks;
  const override = raw === undefined || raw === null ? null : checkValue(raw, '.roots-stack.json: creator.blocks');
  const answer = asked === null || asked === undefined || asked === '' ? null : checkValue(asked, '--blocks');
  if (override) {
    if (answer && answer !== override) throw new Error(`--blocks=${answer} conflicts with creator.blocks "${override}" in .roots-stack.json; change or remove one of them`);
    return { type: override, source: 'override', counts };
  }
  if (answer) return { type: answer, source: 'asked', counts };
  const total = counts.acf + counts.native;
  if (!total) return { type: null, source: null, reason: 'none', recommended: profileDefault(stack), counts };
  const dominant = BLOCK_TYPES.find((t) => counts[t] / total >= DOMINANT_SHARE);
  if (dominant) return { type: dominant, source: 'count', counts };
  return { type: null, source: null, reason: 'mixed', counts };
}

const plural = (n, what) => `${n} ${what} block${n === 1 ? '' : 's'}`;

/** One line for match-plan.md. */
export function describeBlockType(decision) {
  const counts = decision?.counts ?? { acf: 0, native: 0 };
  const tally = `${counts.acf} ${LABEL.acf}, ${counts.native} ${LABEL.native}`;
  if (decision?.type) return `New blocks: \`${decision.type}\` (${decision.source}: ${tally}).`;
  if (decision?.reason === 'none') return `New blocks: not decided (no blocks yet; the profile recommends \`${decision.recommended}\`). Ask the person.`;
  return `New blocks: not decided (mixed: ${tally}). Ask the person.`;
}

export function unresolvedMessage(decision) {
  const counts = decision?.counts ?? { acf: 0, native: 0 };
  const why = decision?.reason === 'none'
    ? `this project has no blocks yet; the profile recommends "${decision.recommended}"`
    : `this project has ${plural(counts.acf, LABEL.acf)} and ${plural(counts.native, LABEL.native)} and neither reaches ${DOMINANT_SHARE * 100}%`;
  return [
    `New blocks need a block type: ${why}. Ask the person once, then either`,
    '  record it in .roots-stack.json: "creator": { "blocks": "acf" }   (or "native"),',
    '  e.g. node <kivo-creator>/scripts/block-type.mjs --set=acf --project=.',
    '  or pass --blocks=acf|native to match.mjs --check and emit.mjs for this run only.',
  ].join('\n');
}

export function requireBlockType(decision) {
  if (!decision?.type) throw new Error(unresolvedMessage(decision));
  return decision.type;
}

/** Existing blocks of both types, sorted by name; a name found twice keeps the first (ACF). */
export function unionCatalog(stack) {
  const seen = new Set();
  return [...acfCatalog(stack), ...nativeCatalog(stack)]
    .filter((b) => (seen.has(b.name) ? false : seen.add(b.name)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Page markup in each block's own format, in order. */
export function emitByBlockType(entries) {
  const parts = [];
  const media = [];
  for (const entry of entries) {
    const out = blockTypeOf(entry.block) === 'acf' ? emitAcfPage([entry]) : emitNativePage([entry]);
    parts.push(out.markup.replace(/\n$/, ''));
    media.push(...out.media);
  }
  return { markup: `${parts.join('\n\n')}\n`, media };
}

/** New block in the project's type; options.blockType is the decision from resolveBlockType. */
export function scaffoldByBlockType(stack, spec, options = {}) {
  const decision = options.blockType ?? resolveBlockType(stack, unionCatalog(stack));
  return requireBlockType(decision) === 'acf' ? scaffoldAcf(stack, spec, options) : scaffoldNative(stack, spec, options);
}
