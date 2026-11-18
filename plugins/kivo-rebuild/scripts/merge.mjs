#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/merge.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { checkDoc, latestRun, readDoc, runDir, writeDoc } from './lib/state.mjs';

export function mergeFragments(kind, fragments, { features = [] } = {}) {
  const key = kind === 'features' ? 'id' : 'feature';
  const owner = new Map();
  const errors = [];
  const items = [];
  for (const frag of [...fragments].sort((a, b) => a.name.localeCompare(b.name))) {
    for (const it of frag.items) {
      if (owner.has(it[key])) { errors.push(`duplicate ${it[key]} in ${owner.get(it[key])} and ${frag.name}`); continue; }
      owner.set(it[key], frag.name);
      items.push(it);
    }
  }
  if (kind === 'parity') {
    const known = new Set(features.map((f) => f.id));
    for (const it of items) if (!known.has(it.feature)) errors.push(`unknown feature ${it.feature} in ${owner.get(it.feature)}`);
    for (const id of known) if (!owner.has(id)) errors.push(`not audited: ${id}`);
  }
  return { items, errors };
}

function readFragments(dir, kind, runId) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((name) => {
    let body;
    try { body = JSON.parse(readFileSync(join(dir, name), 'utf8')); } catch (e) { throw new Error(`${name}: not valid JSON (${e.message})`); }
    const items = body?.items;
    if (!Array.isArray(items)) throw new Error(`${name}: expected {"items": [...]}`);
    // Check each fragment on its own so the error names the file that has to be fixed.
    const problems = checkDoc(kind, { schema_version: 1, kind, run_id: runId, generated_at: '', items });
    if (problems.length) throw new Error(problems.slice(0, 20).map((p) => `${name}: ${p}`).join('\n'));
    return { name, items };
  });
}

export function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '', kind: '' });
  if (!['features', 'parity'].includes(o.kind)) throw new Error('--kind=features|parity');
  const runId = o.run || latestRun(o.project);
  if (!runId) throw new Error('no run: run crawl-sitemap.mjs first');
  const dir = runDir(o.project, runId);
  let features = [];
  if (o.kind === 'parity') {
    const doc = readDoc(join(dir, 'features.json'));
    if (!doc) throw new Error(`${join(dir, 'features.json')} not found: merge the features fragments first`);
    features = doc.items ?? [];
  }
  const fragments = readFragments(join(dir, 'fragments', o.kind), o.kind, runId);
  if (!fragments.length) throw new Error(`no fragments in ${join(dir, 'fragments', o.kind)}`);
  const { items, errors } = mergeFragments(o.kind, fragments, { features });
  if (errors.length) {
    for (const e of errors) console.error(e);
    process.exitCode = 1;
    return;
  }
  writeDoc(join(dir, `${o.kind}.json`), o.kind, { items }, { runId });
  console.log(`${o.kind}: ${items.length} items from ${fragments.length} fragments`);
}

runCli(import.meta.url, main);
