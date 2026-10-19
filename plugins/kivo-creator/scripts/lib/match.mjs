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
