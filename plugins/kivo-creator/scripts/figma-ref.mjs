#!/usr/bin/env node
// plugins/kivo-creator/scripts/figma-ref.mjs
/**
 * figma-ref.mjs: download reference PNGs for the Figma sections of a run
 * through the Figma REST images API, so verify.mjs can pixel-diff them.
 * The MCP get_screenshot result reaches the model, not the disk; this is
 * the on-disk path. Reads FIGMA_TOKEN from the environment only (there is no
 * option for it) and never prints it; the token goes to the API host only,
 * never to the image download host.
 *
 * Usage: node scripts/figma-ref.mjs --run=.creator/<run>   (FIGMA_TOKEN exported in the shell)
 */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { parseFigmaUrl } from './lib/figma.mjs';
import { decodePng } from './png.mjs';
import { readSpecs } from './lib/spec.mjs';
import { runPaths, writeJson } from './lib/run.mjs';

export async function fetchRefs({ runDir, token, base = 'https://api.figma.com', fetchImpl = fetch }) {
  const paths = runPaths(runDir);
  const specs = readSpecs(paths.specs).filter((s) => s.source.kind === 'figma' && !s.chrome);
  if (!specs.length) return [];
  const { fileKey } = parseFigmaUrl(specs[0].source.url);
  const ids = specs.map((s) => s.source.ref).join(',');
  const res = await fetchImpl(`${base}/v1/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=1`, { headers: { 'X-Figma-Token': token } });
  if (!res.ok) throw new Error(`Figma images API answered ${res.status}`);
  const body = await res.json();
  if (body.err) throw new Error(`Figma images API: ${body.err}`);
  const out = [];
  for (const spec of specs) {
    const url = body.images?.[spec.source.ref];
    if (!url) { out.push({ spec: spec.id, saved: null, reason: 'no image returned' }); continue; }
    const img = await fetchImpl(url);
    if (!img.ok) { out.push({ spec: spec.id, saved: null, reason: `download answered ${img.status}` }); continue; }
    const buf = Buffer.from(await img.arrayBuffer());
    const width = decodePng(buf).width;
    const rel = `refs/${spec.id}-${width}.png`;
    writeFileSync(join(runDir, rel), buf);
    spec.refs = { ...spec.refs, [width]: rel };
    writeJson(join(paths.specs, `${spec.id}.json`), spec);
    out.push({ spec: spec.id, saved: rel });
  }
  return out;
}

export async function main(argv) {
  const o = parseOptions(argv, { run: '' });
  if (!o.run) throw new Error('usage: figma-ref.mjs --run=<.creator/run> (with FIGMA_TOKEN exported in the shell)');
  const token = process.env.FIGMA_TOKEN;
  if (!token) {
    process.exitCode = 2;
    throw new Error('FIGMA_TOKEN is not set, so reference images cannot be fetched. Export a Figma personal access token (file content read scope) in the shell, or go on without pixel references: verify then reports "no reference" and still checks styles and lint.');
  }
  const out = await fetchRefs({ runDir: resolve(o.run), token, base: process.env.FIGMA_API_BASE || 'https://api.figma.com' });
  console.log(JSON.stringify(out, null, 2));
}

runCli(import.meta.url, main);
