#!/usr/bin/env node
// scripts/build-rebuild-eval.mjs
/**
 * Stage plugins/kivo-rebuild for `claude plugin eval`.
 *
 * Same reasons as build-creator-eval.mjs: a declared marketplace dependency
 * (kivo-wise) stops the plugin loading inside the eval sandbox, so the copy
 * drops `dependencies`; and runs cannot read the eval folder, so scaffold
 * scripts copy their fixtures from evals/fixtures, staged here from
 * test/fixtures/rebuild.
 *
 * Usage: node scripts/build-rebuild-eval.mjs [--out=.rebuild-eval]
 * Then:  claude plugin eval .rebuild-eval/kivo-rebuild --scaffold --allow-tools Bash Write Edit
 */
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'plugins', 'kivo-rebuild');

export function stage(outBase) {
  const out = join(resolve(outBase), 'kivo-rebuild');
  rmSync(out, { recursive: true, force: true });
  cpSync(SOURCE, out, { recursive: true, filter: (p) => !p.includes(`${sep}evals${sep}results`) });
  const manifestPath = join(out, '.claude-plugin', 'plugin.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  delete manifest.dependencies;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  cpSync(join(ROOT, 'test', 'fixtures', 'rebuild'), join(out, 'evals', 'fixtures'), { recursive: true });
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = process.argv.slice(2).find((a) => a.startsWith('--out='));
  console.log(stage(arg ? arg.slice(6) : '.rebuild-eval'));
}
