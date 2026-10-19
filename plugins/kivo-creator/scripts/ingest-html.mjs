#!/usr/bin/env node
// plugins/kivo-creator/scripts/ingest-html.mjs
/**
 * ingest-html.mjs: render an HTML file or URL with the target project's
 * Playwright, split it into sections and write one spec per section plus a
 * reference screenshot per width into .creator/<run>/.
 *
 * Usage:
 *   node scripts/ingest-html.mjs --source=<file.html | https://...> [--project=.]
 *        [--run=.creator/<run>] [--widths=390,1440] [--label=<name>]
 * Exit: 0 ok, 1 error, 3 Playwright missing in the project.
 */
import { basename, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { parseOptions, runCli } from './lib/args.mjs';
import { loadPlaywright, NO_PLAYWRIGHT } from './lib/playwright.mjs';
import { collectSnapshot } from './lib/collect.mjs';
import { segment, toSpec } from './lib/segment.mjs';
import { checkSpec } from './lib/spec.mjs';
import { createRun, runPaths, writeJson } from './lib/run.mjs';

export function parseIngestArgs(argv) {
  const o = parseOptions(argv, { source: '', project: '.', run: '', widths: '390,1440', label: '' });
  if (!o.source) throw new Error('usage: ingest-html.mjs --source=<file.html | url> [--project=.] [--run=<dir>] [--widths=390,1440]');
  return { ...o, widths: String(o.widths).split(',').map(Number).filter((w) => w > 0) };
}

export async function main(argv) {
  const o = parseIngestArgs(argv);
  const pw = await loadPlaywright(o.project);
  if (!pw) { process.exitCode = 3; throw new Error(NO_PLAYWRIGHT); }
  const url = /^https?:\/\//.test(o.source) ? o.source : pathToFileURL(resolve(o.source)).href;
  const run = o.run ? { id: basename(resolve(o.run)), dir: resolve(o.run) } : createRun(o.project, o.label || basename(o.source).replace(/\.[a-z]+$/i, ''));
  const paths = runPaths(run.dir);
  for (const dir of [paths.specs, paths.refs]) mkdirSync(dir, { recursive: true });
  const widest = Math.max(...o.widths);
  const browser = await pw.chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: widest, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'networkidle' });
    const sections = segment(await page.evaluate(collectSnapshot, { maxDepth: 12 }));
    const specs = sections.map((section, index) => toSpec(section, { index, sourceRef: url }));
    for (const width of o.widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(200);
      for (const [i, spec] of specs.entries()) {
        const target = page.locator(sections[i].node.path).first();
        if ((await target.count()) === 0) continue;
        const file = join(paths.refs, `${spec.id}-${width}.png`);
        await target.screenshot({ path: file, animations: 'disabled' });
        spec.refs[String(width)] = relative(run.dir, file).split('\\').join('/');
      }
    }
    for (const spec of specs) {
      const errors = checkSpec(spec);
      if (errors.length) throw new Error(`generated an invalid spec ${spec.id} (please report): ${errors.join('; ')}`);
      writeJson(join(paths.specs, `${spec.id}.json`), spec);
    }
    console.log(JSON.stringify({ run: run.id, dir: relative(process.cwd(), run.dir), sections: specs.map((s) => ({ id: s.id, kind: s.kind, chrome: !!s.chrome })) }, null, 2));
  } finally {
    await browser.close();
  }
}

runCli(import.meta.url, main);
