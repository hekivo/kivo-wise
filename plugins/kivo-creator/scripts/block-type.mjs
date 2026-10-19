#!/usr/bin/env node
// plugins/kivo-creator/scripts/block-type.mjs
/**
 * block-type.mjs: the block type new blocks get (adapters/shared/block-type.mjs).
 *   node scripts/block-type.mjs [--project=.] [--stack=<detector.json>]   print the decision as JSON
 *   node scripts/block-type.mjs --set=acf|native [--project=.]           record creator.blocks in .roots-stack.json
 * --set keeps every other key of .roots-stack.json and needs the file to exist
 * (kivo-wise /roots-detect --write creates it).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { loadContext } from './lib/context.mjs';
import { BLOCK_TYPES } from './adapters/shared/block-type.mjs';

export async function main(argv) {
  const o = parseOptions(argv, { project: '.', stack: '', set: '' });
  if (o.set) {
    if (!BLOCK_TYPES.includes(o.set)) throw new Error(`--set must be "acf" or "native" (got ${JSON.stringify(o.set)})`);
    const file = join(resolve(o.project), '.roots-stack.json');
    if (!existsSync(file)) throw new Error('No .roots-stack.json at the project root. Run kivo-wise /roots-detect --write first, then record the block type.');
    const flag = JSON.parse(readFileSync(file, 'utf8'));
    flag.creator = { ...(flag.creator ?? {}), blocks: o.set };
    writeFileSync(file, `${JSON.stringify(flag, null, 2)}\n`);
  }
  const ctx = await loadContext(o);
  console.log(JSON.stringify(ctx.blockType, null, 2));
}

runCli(import.meta.url, main);
