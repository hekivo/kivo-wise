// test/creator/ingest-html.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseIngestArgs } from '../../plugins/kivo-creator/scripts/ingest-html.mjs';
import { FIX, PLUGIN } from './helpers.mjs';

test('options: source is required, widths are numbers', () => {
  assert.deepEqual(parseIngestArgs(['--source=page.html', '--widths=390,1440']).widths, [390, 1440]);
  assert.throws(() => parseIngestArgs([]), /--source/);
});

const PW_DIR = process.env.CREATOR_PLAYWRIGHT_DIR;

test('ingests the fixture page into chrome plus four content specs with references', { skip: !PW_DIR && 'set CREATOR_PLAYWRIGHT_DIR to a folder with Playwright installed' }, async () => {
  const { decodePng } = await import('../../plugins/kivo-creator/scripts/png.mjs'); // Task 14
  const out = join(mkdtempSync(join(tmpdir(), 'ingest-')), 'run');
  const res = spawnSync(process.execPath, [join(PLUGIN, 'scripts', 'ingest-html.mjs'), `--project=${PW_DIR}`, `--source=${join(FIX, 'html', 'acme-landing.html')}`, `--run=${out}`], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  const files = readdirSync(join(out, 'specs')).sort();
  assert.deepEqual(files, ['01-header.json', '02-hero.json', '03-features.json', '04-faq.json', '05-cta.json', '06-footer.json']);
  const hero = JSON.parse(readFileSync(join(out, 'specs', '02-hero.json'), 'utf8'));
  assert.equal(hero.slots[0].value, 'Acme ships faster');
  assert.equal(hero.layout.media, 'right');
  const png = decodePng(readFileSync(join(out, hero.refs['1440'])));
  assert.equal(png.width, 1440);
});
