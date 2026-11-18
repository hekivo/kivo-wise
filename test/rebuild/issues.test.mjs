import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { issueDrafts } from '../../plugins/kivo-rebuild/scripts/issues.mjs';
import { readJson, run, tmpProject } from './helpers.mjs';

const templates = () => ({ items: [
  { group: 'page', label: 'Page', template: 'page.blade.php', count: 3, clicks: 1, samples: ['/a/'], status: 'issues', note: 'footer misaligned' },
  { group: 'post', label: 'Post', template: 'single.blade.php', count: 1, clicks: 0, samples: [], status: 'ok' },
  { group: 'home', label: 'Home', template: 'front-page.blade.php', count: 1, clicks: 9, samples: ['/'], status: 'issues', note: 'x', issue: 12 },
] });

test('one draft per template with issues, skipping already-filed ones', () => {
  const drafts = issueDrafts({ templates: templates(), inventory: { items: [] } });
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].key, 'template:page');
  assert.equal(drafts[0].title, 'Front-end review: Page');
  assert.deepEqual(drafts[0].labels, ['frontend-review', 'template:page']);
  assert.match(drafts[0].body, /footer misaligned/);
  assert.match(drafts[0].body, /page\.blade\.php/);
});

function projectWith(items) {
  const project = tmpProject();
  const runId = '2026-11-18-acme';
  const dir = join(project, '.rebuild', 'runs', runId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'templates.json'), JSON.stringify({ schema_version: 1, kind: 'templates', run_id: runId, generated_at: '2026-11-18T00:00:00Z', items }, null, 2));
  return { project, runId, file: join(dir, 'templates.json') };
}

// A stand-in for the GitHub CLI: logs every call, numbers new issues, fails on titles containing FAIL.
function fakeGh() {
  const bin = join(tmpProject(), 'bin');
  mkdirSync(bin, { recursive: true });
  const log = join(bin, 'calls.log');
  const counter = join(bin, 'counter');
  writeFileSync(counter, '40');
  const script = `#!/bin/sh
echo "$*" >> "${log}"
if [ "$1" = "issue" ]; then
  case "$*" in *FAIL*) echo "boom" >&2; exit 1;; esac
  n=$(( $(cat "${counter}") + 1 )); echo $n > "${counter}"
  echo "https://github.com/acme/store/issues/$n"
fi
`;
  writeFileSync(join(bin, 'gh'), script);
  chmodSync(join(bin, 'gh'), 0o755);
  return { env: { PATH: `${bin}:${process.env.PATH}` }, calls: () => (readFileSync(log, 'utf8').trim().split('\n').filter(Boolean)) };
}

const skipWin = { skip: process.platform === 'win32' };

test('dry run prints drafts, calls nothing and leaves templates.json alone', skipWin, () => {
  const { project, file } = projectWith(templates().items);
  const before = readFileSync(file, 'utf8');
  const gh = fakeGh();
  const r = run('issues.mjs', [`--project=${project}`, '--repo=acme/store'], { env: gh.env });
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /DRY RUN: 1 issues for acme\/store/);
  assert.match(r.stdout, /Front-end review: Page/);
  assert.match(r.stdout, /labels: frontend-review, template:page/);
  assert.equal(readFileSync(file, 'utf8'), before);
  assert.throws(() => gh.calls(), /ENOENT/);
});

test('apply creates labels and issues, then stores the issue numbers', skipWin, () => {
  const items = templates().items;
  items[1] = { ...items[1], status: 'issues', note: 'nav overlaps' };
  const { project, file } = projectWith(items);
  const gh = fakeGh();
  const r = run('issues.mjs', [`--project=${project}`, '--repo=acme/store', '--apply'], { env: gh.env });
  assert.equal(r.code, 0, r.stderr);
  const doc = readJson(file);
  assert.equal(doc.items.find((t) => t.group === 'page').issue, 41);
  assert.equal(doc.items.find((t) => t.group === 'post').issue, 42);
  assert.equal(doc.items.find((t) => t.group === 'home').issue, 12);
  const calls = gh.calls();
  assert.equal(calls.filter((c) => c.startsWith('issue create --repo acme/store')).length, 2);
  assert.equal(calls.filter((c) => c === 'label create frontend-review --repo acme/store --force').length, 1);
  assert.ok(calls.includes('label create template:page --repo acme/store --force'));
  // A second run has nothing left to file.
  const again = run('issues.mjs', [`--project=${project}`, '--repo=acme/store', '--apply'], { env: gh.env });
  assert.equal(again.code, 0, again.stderr);
  assert.equal(gh.calls().filter((c) => c.startsWith('issue create')).length, 2);
});

test('apply keeps the numbers of issues filed before a failure and exits non-zero', skipWin, () => {
  const items = [
    { group: 'page', label: 'Page', template: 'page.blade.php', count: 3, clicks: 1, samples: [], status: 'issues', note: 'a' },
    { group: 'post', label: 'FAIL Post', template: 'single.blade.php', count: 1, clicks: 0, samples: [], status: 'issues', note: 'b' },
  ];
  const { project, file } = projectWith(items);
  const gh = fakeGh();
  const r = run('issues.mjs', [`--project=${project}`, '--repo=acme/store', '--apply'], { env: gh.env });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /failed: Front-end review: FAIL Post: boom/);
  const doc = readJson(file);
  assert.equal(doc.items[0].issue, 41);
  assert.equal(doc.items[1].issue, undefined);
});

test('apply without --repo refuses before calling gh', skipWin, () => {
  const { project } = projectWith(templates().items);
  const gh = fakeGh();
  const r = run('issues.mjs', [`--project=${project}`, '--apply'], { env: gh.env });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /--repo=<owner\/name> is required/);
  assert.throws(() => gh.calls(), /ENOENT/);
});

test('missing templates.json explains the next step', () => {
  const project = tmpProject();
  mkdirSync(join(project, '.rebuild', 'runs', '2026-11-18-acme'), { recursive: true });
  const r = run('issues.mjs', [`--project=${project}`]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /templates\.json not found/);
});
