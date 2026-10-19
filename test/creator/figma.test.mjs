// test/creator/figma.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseFigmaUrl, parseXmlTree, sectionsFromMetadata, componentsFromMetadata, kindFromName } from '../../plugins/kivo-creator/scripts/lib/figma.mjs';
import { FIX, PLUGIN, tmpCopy } from './helpers.mjs';

const xml = readFileSync(join(FIX, 'figma', 'metadata.xml'), 'utf8');

test('parses design, file and branch URLs; node-id dashes become colons', () => {
  assert.deepEqual(parseFigmaUrl('https://www.figma.com/design/AbC123acme/Acme-Landing?node-id=1-2&t=x'), { kind: 'design', fileKey: 'AbC123acme', nodeId: '1:2' });
  assert.equal(parseFigmaUrl('https://figma.com/design/AbC123acme/branch/Br4nch/Acme').fileKey, 'Br4nch');
  assert.throws(() => parseFigmaUrl('https://example.com/design/x'), /figma\.com/);
});

test('the XML tree keeps ids, names and geometry', () => {
  const root = parseXmlTree(xml).children[0];
  assert.equal(root.attrs.name, 'Acme Landing');
  assert.equal(root.children.length, 6);
});

test('top-level frames become ordered section skeletons; header and footer are chrome', () => {
  assert.deepEqual(sectionsFromMetadata(xml, '1:2').map((s) => `${s.id}|${s.nodeId}|${s.kind}|${s.chrome}`), [
    '01-header|1:3|custom|true',
    '02-hero|1:10|hero|false',
    '03-features|1:20|features|false',
    '04-pricing-table|1:30|custom|false',
    '05-cta|1:40|cta|false',
    '06-footer|1:50|custom|true',
  ]);
});

test('kind from layer names', () => {
  assert.equal(kindFromName('Footer CTA'), 'cta');
  assert.equal(kindFromName('FAQ / Accordion'), 'faq');
  assert.equal(kindFromName('Customer quotes'), 'testimonial');
  assert.equal(kindFromName('Pricing Table'), 'custom');
});

test('components are the distinct instances, first id wins', () => {
  assert.deepEqual(componentsFromMetadata(xml).map((c) => `${c.id} ${c.name}`), ['1:4 Logo/Acme', '1:10 Hero/Default', '1:13 Button/Primary', '1:22 Feature Card', '1:31 Pricing/Plan']);
});

test('CLI writes the run with figma-sections.json and a copy of the metadata', () => {
  const project = tmpCopy(join(FIX, 'projects', 'acme-mu-plugin'));
  const res = spawnSync(process.execPath, [join(PLUGIN, 'scripts', 'figma-sections.mjs'), `--project=${project}`, '--url=https://www.figma.com/design/AbC123acme/Acme-Landing?node-id=1-2', `--metadata=${join(FIX, 'figma', 'metadata.xml')}`], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  const runDir = join(project, out.dir);
  assert.deepEqual(readdirSync(runDir).filter((f) => f.startsWith('figma-')).sort(), ['figma-metadata.xml', 'figma-sections.json']);
  assert.equal(JSON.parse(readFileSync(join(runDir, 'figma-sections.json'), 'utf8')).sections.length, 6);
  assert.match(out.run, /-acme-landing$/);
});
