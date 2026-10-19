#!/usr/bin/env node
// plugins/kivo-creator/scripts/validate-spec.mjs
/**
 * validate-spec.mjs: check section specs against schemas/section-spec.schema.json.
 * Usage: node scripts/validate-spec.mjs <spec.json | specs-dir>...
 * Exit 0 when every spec is valid, 1 otherwise.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { checkSpec } from './lib/spec.mjs';
import { runCli } from './lib/args.mjs';

export function main(argv) {
  if (!argv.length) throw new Error('usage: validate-spec.mjs <spec.json | specs-dir>...');
  const files = argv.flatMap((p) => (statSync(p).isDirectory() ? readdirSync(p).filter((f) => f.endsWith('.json')).sort().map((f) => join(p, f)) : [p]));
  let failed = 0;
  for (const file of files) {
    let errors;
    try {
      errors = checkSpec(JSON.parse(readFileSync(file, 'utf8')));
    } catch (error) {
      errors = [`invalid JSON: ${error.message}`];
    }
    if (errors.length === 0) console.log(`ok ${file}`);
    else {
      failed++;
      for (const e of errors) console.error(`${file}: ${e}`);
    }
  }
  if (failed) process.exitCode = 1;
}

runCli(import.meta.url, main);
