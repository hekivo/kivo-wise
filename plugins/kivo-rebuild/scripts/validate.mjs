#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/validate.mjs
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { KINDS, checkDoc, latestRun, rebuildDir, runDir } from './lib/state.mjs';

export function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '' });
  const runId = o.run || latestRun(o.project);
  const files = [join(rebuildDir(o.project), 'config.json'), join(rebuildDir(o.project), 'connections.json')];
  if (runId) for (const k of KINDS) if (!['config', 'connections'].includes(k)) files.push(join(runDir(o.project, runId), `${k}.json`));
  let bad = 0;
  for (const f of files.filter(existsSync)) {
    let doc;
    try { doc = JSON.parse(readFileSync(f, 'utf8')); } catch (e) { console.error(`${f}: invalid JSON: ${e.message}`); bad++; continue; }
    const errors = checkDoc(doc.kind, doc);
    if (errors.length) { bad++; for (const e of errors) console.error(`${f}: ${e}`); } else console.log(`ok ${f}`);
  }
  if (bad) process.exitCode = 1;
}

runCli(import.meta.url, main);
