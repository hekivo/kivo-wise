#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/kion-bridge.mjs
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { checkDoc, latestRun, readDoc, runDir } from './lib/state.mjs';

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const shellQuote = (a) => (/^[A-Za-z0-9_./:=@%+-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`);

// Ids come from the name; an empty or repeated slug falls back to the kion id so every feature id is unique.
export function seedFeatures(kionInventory) {
  const used = new Set();
  return (kionInventory.items ?? []).filter((it) => it.verdict !== 'remove').map((it) => {
    let base = slug(it.name) || slug(String(it.id));
    if (used.has(base)) base = `${base}-${slug(String(it.id))}`;
    used.add(base);
    return { id: `F-${base}`, area: it.area, name: it.name, source: it.source, behaviour: it.evidence || it.name, kion: it.id };
  });
}

// Question texts already in the project's kion store, so a rerun of --apply adds nothing twice.
export function existingQuestionTexts(project) {
  try {
    const doc = JSON.parse(readFileSync(join(resolve(project), '.kion', 'questions.json'), 'utf8'));
    return new Set((doc.items ?? []).map((q) => q.text));
  } catch { return new Set(); }
}

export function gapQuestions(parity, features) {
  const byId = new Map(features.map((f) => [f.id, f]));
  return parity.filter((p) => p.class === 'missing-not-planned' && ['P0', 'P1'].includes(p.priority)).map((p) => {
    const f = byId.get(p.feature);
    if (!f) throw new Error(`unknown feature ${p.feature} in parity`);
    return {
      text: `Who owns "${f.name}" in the new project, and is it needed at launch?`,
      type: 'decision', tier: p.priority === 'P0' ? 'high' : 'normal', area: f.area,
      grounds: [f.source, p.note].filter(Boolean),
      options: [{ key: 'build', label: 'Build it before launch', recommended: p.priority === 'P0' }, { key: 'later', label: 'After launch' }, { key: 'drop', label: 'Drop it' }],
      status: 'open', source: 'discovery',
    };
  });
}

export function main(argv) {
  const [cmd, ...rest] = argv;
  if (!['seed', 'questions'].includes(cmd)) throw new Error('usage: kion-bridge.mjs seed|questions --project=. [--run=id] [--kion=path] [--apply]');
  const o = parseOptions(rest, { project: '.', run: '', kion: '', apply: false });
  const runId = o.run || latestRun(o.project);
  if (!runId) throw new Error('no run: run crawl-sitemap.mjs first');
  const dir = runDir(o.project, runId);

  if (cmd === 'seed') {
    const inv = JSON.parse(readFileSync(join(resolve(o.project), '.kion', 'inventory.json'), 'utf8'));
    const items = seedFeatures(inv);
    const problems = checkDoc('features', { schema_version: 1, kind: 'features', run_id: runId, generated_at: '', items });
    if (problems.length) throw new Error(`kion inventory does not fit the features schema:\n${problems.slice(0, 20).join('\n')}`);
    const out = join(dir, 'fragments', 'features');
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'kion.json'), JSON.stringify({ items }, null, 2) + '\n');
    console.log(`seeded ${items.length} features from kion`);
    return;
  }

  if (!o.kion) throw new Error('--kion=<path to kion.mjs> is required');
  const kion = resolve(o.kion);
  const parity = readDoc(join(dir, 'parity.json'));
  const features = readDoc(join(dir, 'features.json'));
  if (!parity || !features) throw new Error(`${dir}: parity.json and features.json are required: run merge.mjs for both first`);
  const known = existingQuestionTexts(o.project);
  const all = gapQuestions(parity.items ?? [], features.items ?? []);
  const qs = all.filter((q) => !known.has(q.text));
  if (all.length > qs.length) console.log(`${all.length - qs.length} questions already in kion, skipped`);
  for (const q of qs) {
    const args = [kion, 'add', 'question', '--data', JSON.stringify(q)];
    console.log(`node ${args.map(shellQuote).join(' ')}`);
    if (o.apply) {
      const r = spawnSync(process.execPath, args, { cwd: resolve(o.project), encoding: 'utf8' });
      if (r.status !== 0) { console.error(r.stderr); process.exitCode = 1; return; }
    }
  }
  console.log(`${qs.length} questions${o.apply ? ' added' : ' (dry run; add --apply)'}`);
}

runCli(import.meta.url, main);
