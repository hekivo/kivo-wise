#!/usr/bin/env node
// plugins/kivo-creator/scripts/figma-sections.mjs
/**
 * figma-sections.mjs: create a run for a Figma frame from a saved get_metadata
 * response and write .creator/<run>/figma-sections.json (ids, node ids, kinds,
 * geometry). It writes no specs: those need get_design_context per section.
 *
 * Usage: node scripts/figma-sections.mjs --url=<figma frame URL> --metadata=<saved XML> [--project=.] [--run=<dir>]
 */
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { parseFigmaUrl, parseXmlTree, sectionsFromMetadata } from './lib/figma.mjs';
import { createRun, runPaths, writeJson } from './lib/run.mjs';

export function main(argv) {
  const o = parseOptions(argv, { url: '', metadata: '', project: '.', run: '' });
  if (!o.url || !o.metadata) throw new Error('usage: figma-sections.mjs --url=<figma URL> --metadata=<saved get_metadata XML> [--project=.]');
  const { fileKey, nodeId } = parseFigmaUrl(o.url);
  const xml = readFileSync(o.metadata, 'utf8');
  const sections = sectionsFromMetadata(xml, nodeId);
  const rootName = parseXmlTree(xml).children[0]?.attrs.name ?? 'figma';
  const run = o.run ? { id: basename(resolve(o.run)), dir: resolve(o.run) } : createRun(o.project, rootName);
  mkdirSync(run.dir, { recursive: true });
  const paths = runPaths(run.dir);
  copyFileSync(o.metadata, join(run.dir, 'figma-metadata.xml'));
  writeJson(paths.figmaSections, { url: o.url, fileKey, nodeId, sections });
  console.log(JSON.stringify({ run: run.id, dir: relative(resolve(o.project), run.dir), sections: sections.map((s) => ({ id: s.id, nodeId: s.nodeId, kind: s.kind, chrome: s.chrome })) }, null, 2));
}

runCli(import.meta.url, main);
