import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildBoard, applyMarks, normalizeMarks } from '../../plugins/kivo-rebuild/scripts/board.mjs';
import { run, tmpProject } from './helpers.mjs';

const inventory = { items: [
  { path: '/a/', type: 'page', proposed: 'keep', reason: 'r', rule_id: 'R14', clicks: 5 },
  { path: '/b/', type: 'page', proposed: 'review', reason: 'r', rule_id: 'R99', clicks: 0 },
  { path: '/c/', type: 'page', proposed: 'gone', reason: 'r', rule_id: 'R13', clicks: 0, final: 'gone', decided_by: 'owner' },
] };
const templates = { items: [{ group: 'page', label: 'Page', template: 'page.blade.php', count: 3, clicks: 5, samples: ['/a/'], status: 'todo' }] };

test('build embeds data and truncates but keeps review rows', () => {
  const html = buildBoard({ run: 'r1', inventory, templates, parity: { items: [] }, features: { items: [] }, maxUrls: 1 });
  const data = JSON.parse(html.match(/const DATA = (.*?);\n/s)[1]);
  assert.deepEqual(data.urls.map((u) => u.path).sort(), ['/a/', '/b/']);
  assert.equal(data.truncated, 1);
  assert.match(html, /<title>Rebuild review<\/title>/);
});

test('import applies marks, reports conflicts, round trip from db export', () => {
  const inv = structuredClone(inventory);
  const tpl = structuredClone(templates);
  const marks = normalizeMarks({ decisions: [{ path: '/b/', final: 'redirect', note: 'to /a/', decided_by: 'reviewer' }, { path: '/c/', final: 'keep', decided_by: 'reviewer' }], templates: [{ group: 'page', status: 'issues', note: 'footer' }], parity: [] });
  const { changed, conflicts } = applyMarks({ inventory: inv, templates: tpl, parity: { items: [] } }, marks);
  assert.equal(changed, 2);
  assert.deepEqual(conflicts, ['conflict /c/: gone by owner vs keep by reviewer']);
  assert.equal(inv.items[1].final, 'redirect');
  assert.equal(inv.items[2].final, 'gone');
  assert.equal(tpl.items[0].status, 'issues');
});

test('build keeps replacement patterns and script endings in data inert', () => {
  const nasty = { items: [{ path: "/a-$&-$'/", type: 'page', proposed: 'review', reason: '</script><b>x</b>', rule_id: 'R99', clicks: 1 }] };
  const html = buildBoard({ run: 'r1', inventory: nasty, templates, parity: { items: [] }, features: { items: [] } });
  const data = JSON.parse(html.match(/const DATA = (.*?);\n/s)[1]);
  assert.equal(data.urls[0].path, "/a-$&-$'/");
  assert.equal(data.urls[0].reason, '</script><b>x</b>');
  assert.equal(html.split('</script>').length, 2);
});

test('build and import through the CLI, downloaded marks format', () => {
  const project = tmpProject();
  const dir = join(project, '.rebuild', 'runs', '2026-11-18-acme');
  mkdirSync(dir, { recursive: true });
  const doc = (kind, body) => JSON.stringify({ schema_version: 1, kind, run_id: '2026-11-18-acme', generated_at: '2026-11-18T00:00:00Z', ...body });
  writeFileSync(join(dir, 'inventory.json'), doc('inventory', inventory));
  writeFileSync(join(dir, 'templates.json'), doc('templates', templates));
  const built = run('board.mjs', ['build', `--project=${project}`]);
  assert.equal(built.code, 0, built.stderr);
  assert.match(readFileSync(join(dir, 'board', 'index.html'), 'utf8'), /Rebuild review/);

  const file = join(project, 'marks.json');
  writeFileSync(file, JSON.stringify({ run: '2026-11-18-acme', marks: { urls: { '/b/': { final: 'keep', note: 'ok', decided_by: 'reviewer' }, '/c/': { final: 'keep', decided_by: 'reviewer' } }, templates: { page: { status: 'ok' } }, parity: {} } }));
  const imported = run('board.mjs', ['import', `--project=${project}`, `--file=${file}`]);
  assert.equal(imported.code, 0, imported.stderr);
  assert.match(imported.stdout, /^2 changes, 1 conflicts$/m);
  assert.match(imported.stderr, /conflict \/c\/: gone by owner vs keep by reviewer/);
  const inv = JSON.parse(readFileSync(join(dir, 'inventory.json'), 'utf8'));
  assert.equal(inv.items[1].final, 'keep');
  assert.equal(inv.items[2].final, 'gone');
  assert.equal(JSON.parse(readFileSync(join(dir, 'templates.json'), 'utf8')).items[0].status, 'ok');
});

test('import without a run or marks file fails with a clear message', () => {
  const project = tmpProject();
  const r = run('board.mjs', ['import', `--project=${project}`, '--file=x.json']);
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /no run/);
});

test('clearing a decision someone else made is a conflict; clearing your own drops decided_by', () => {
  const doc = () => ({ inventory: { items: [{ path: '/a/', final: 'keep', decided_by: 'owner' }] }, templates: null, parity: null });
  const other = doc();
  const r1 = applyMarks(other, { urls: { '/a/': { final: null, decided_by: 'dev' } } });
  assert.equal(r1.conflicts.length, 1);
  assert.equal(other.inventory.items[0].final, 'keep');
  const own = doc();
  applyMarks(own, { urls: { '/a/': { final: null, decided_by: 'owner' } } });
  assert.equal(own.inventory.items[0].final, null);
  assert.equal(own.inventory.items[0].decided_by, undefined);
});
