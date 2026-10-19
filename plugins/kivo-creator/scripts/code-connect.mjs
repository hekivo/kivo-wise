#!/usr/bin/env node
// plugins/kivo-creator/scripts/code-connect.mjs
/**
 * code-connect.mjs: propose Code Connect mappings from saved get_metadata and
 * get_code_connect_map responses. It only writes a proposal; sending mappings
 * to Figma is done by the code-connect skill after the person approves.
 *
 * Usage: node scripts/code-connect.mjs --metadata=<xml> --map=<json> [--project=.] [--stack=<detector.json>] [--out=<file>]
 */
import { readFileSync } from 'node:fs';
import { parseOptions, runCli } from './lib/args.mjs';
import { loadContext } from './lib/context.mjs';
import { componentsFromMetadata } from './lib/figma.mjs';
import { bladeComponents, proposeMappings } from './lib/code-connect.mjs';
import { writeJson } from './lib/run.mjs';

export async function main(argv) {
  const o = parseOptions(argv, { metadata: '', map: '', project: '.', stack: '', out: '' });
  if (!o.metadata) throw new Error('usage: code-connect.mjs --metadata=<saved get_metadata XML> [--map=<saved get_code_connect_map JSON>] [--project=.] [--out=<file>]');
  const ctx = await loadContext(o);
  const result = proposeMappings({
    components: componentsFromMetadata(readFileSync(o.metadata, 'utf8')),
    map: o.map ? JSON.parse(readFileSync(o.map, 'utf8')) : {},
    targets: [...ctx.catalog, ...bladeComponents(ctx.stack)],
  });
  if (o.out) writeJson(o.out, result);
  console.log(JSON.stringify(result, null, 2));
}

runCli(import.meta.url, main);
