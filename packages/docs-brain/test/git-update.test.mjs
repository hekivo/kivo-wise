import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECT, commitFiles, makeGitRepo, manifestYaml, runCli, tmp, write } from './helpers.mjs';

function setup() {
  const repo = makeGitRepo({
    'docs/intro.md': '---\ntitle: Introduction\ndescription: Start here\n---\n\n# Introduction\n\nWelcome to the demo docs.\n',
    'docs/guide/setup.md': '# Setup\n\nRun `demo install` to set up the project.\n',
    'docs/image.png': 'binary',
    'README.md': '# not included\n',
  });
  const work = tmp();
  const manifest = join(work, 'sources.yaml');
  write(
    manifest,
    manifestYaml([
      {
        id: 'demo',
        type: 'git',
        repo: repo.dir,
        ref: 'main',
        root: 'docs',
        include: ['**/*.md'],
        url_map: 'https://docs.example.org/{path}.html',
        version: { from: 'composer.lock', package: 'roots/acorn', strategy: 'record-sha' },
        license: 'unspecified',
        redistribute: false,
      },
      {
        id: 'open',
        type: 'git',
        repo: repo.dir,
        ref: 'main',
        include: ['docs/guide/*.md'],
        license: 'MIT',
      },
    ]),
  );
  const corpus = join(work, 'corpus');
  return { repo, work, manifest, corpus, args: ['--project', PROJECT, '--manifest', manifest, '--corpus', corpus, '--offline'] };
}

test('git fetcher + record-sha: writes pages with frontmatter, SUMMARY, INDEX, llms.txt and lock.json', async () => {
  const { repo, corpus, args, work } = setup();
  const r = await runCli(['update', ...args]);
  assert.equal(r.code, 0, r.stderr + r.stdout);

  const intro = readFileSync(join(corpus, 'demo/main/intro.md'), 'utf8');
  assert.match(intro, /^---\ntitle: Introduction\nsource: demo\nversion: main\nurl: https:\/\/docs\.example\.org\/intro\.html\n/);
  assert.match(intro, /\nupstream_modified: \S+/);
  assert.match(intro, /\nfetched_at: \S+Z\n/);
  assert.match(intro, /\nsha256: [0-9a-f]{64}\n/);
  assert.match(intro, /\nlicense: unspecified\nredistribute: false\n/);
  assert.match(intro, new RegExp(`\\nupstream_sha: ${repo.sha}\\n`));
  assert.match(intro, /\ndescription: Start here\n/);
  assert.equal((intro.match(/^# Introduction$/gm) || []).length, 1);
  assert.ok(existsSync(join(corpus, 'demo/main/guide/setup.md')));
  assert.ok(!existsSync(join(corpus, 'demo/main/image.png.md')));
  assert.ok(existsSync(join(corpus, 'open/main/docs/guide/setup.md')));

  const summary = readFileSync(join(corpus, 'demo/main/SUMMARY.md'), 'utf8');
  assert.match(summary, /\[Introduction\]\(intro\.md\)/);
  assert.match(summary, /\[Setup\]\(guide\/setup\.md\)/);

  const index = readFileSync(join(corpus, 'INDEX.md'), 'utf8');
  assert.match(index, /demo\/main\/intro\.md \| Introduction \| https:\/\/docs\.example\.org\/intro\.html/);

  const llms = readFileSync(join(corpus, 'llms.txt'), 'utf8');
  assert.match(llms, /^# /);
  assert.ok(!/demo\/main/.test(llms), 'redistribute: false pages stay out of llms.txt');
  assert.match(llms, /open\/main\/docs\/guide\/setup\.md/);

  const lock = JSON.parse(readFileSync(join(work, 'state/lock.json'), 'utf8'));
  assert.equal(lock.sources.demo.upstream.sha, repo.sha);
  assert.equal(lock.sources.demo.version, 'main');
  assert.equal(lock.sources.demo.installed, 'v6.2.0');
  assert.equal(Object.keys(lock.sources.demo.pages).length, 2);
});

test('git update is incremental: unchanged SHA rewrites nothing; a new commit updates and prunes', async () => {
  const { repo, corpus, args } = setup();
  await runCli(['update', ...args]);
  const file = join(corpus, 'demo/main/intro.md');
  const before = statSync(file).mtimeMs;
  const again = await runCli(['update', 'demo', ...args]);
  assert.equal(again.code, 0);
  assert.match(again.stdout, /demo.*unchanged/);
  assert.equal(statSync(file).mtimeMs, before);

  const dry0 = await runCli(['status', '--check', ...args]);
  assert.equal(dry0.code, 0, dry0.stdout + dry0.stderr);

  commitFiles(repo.dir, { 'docs/new.md': '# New page\n\nFresh.\n' }, ['docs/guide/setup.md']);
  const status = await runCli(['status', '--check', ...args]);
  assert.equal(status.code, 1, 'upstream drift detected through git ls-remote');
  assert.match(status.stdout, /demo.*upstream/);

  const dry = await runCli(['update', 'demo', '--dry-run', ...args]);
  assert.match(dry.stdout, /\+1 ~0 -1/);
  assert.ok(existsSync(join(corpus, 'demo/main/guide/setup.md')), 'dry run writes nothing');

  const upd = await runCli(['update', 'demo', ...args]);
  assert.equal(upd.code, 0);
  assert.ok(existsSync(join(corpus, 'demo/main/new.md')));
  assert.ok(!existsSync(join(corpus, 'demo/main/guide/setup.md')), 'removed upstream page pruned');
  assert.equal(statSync(file).mtimeMs, before, 'unchanged page kept as is');
});

test('search finds path:line snippets (JS scan and default) and respects --source', async () => {
  const { args } = setup();
  await runCli(['update', ...args]);
  for (const extra of [['--no-rg'], []]) {
    const r = await runCli(['search', 'demo install', ...extra, ...args]);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /demo\/main\/guide\/setup\.md:\d+:.*demo install/);
    assert.match(r.stdout, /open\/main\/docs\/guide\/setup\.md:\d+:/);
  }
  const only = await runCli(['search', 'demo install', '--source', 'open', '--no-rg', ...args]);
  assert.ok(!/demo\/main\//.test(only.stdout));
  const limited = await runCli(['search', 'demo install', '--limit', '1', '--no-rg', ...args]);
  assert.equal(limited.stdout.trim().split('\n').filter((l) => /:\d+:/.test(l)).length, 1);
});

test('export-llms writes only redistributable pages', async () => {
  const { args, work } = setup();
  await runCli(['update', ...args]);
  const out = join(work, 'export.txt');
  const r = await runCli(['export-llms', '--out', out, ...args]);
  assert.equal(r.code, 0, r.stderr);
  const text = readFileSync(out, 'utf8');
  assert.match(text, /open\/main\/docs\/guide\/setup\.md/);
  assert.ok(!/demo\/main/.test(text));
});
