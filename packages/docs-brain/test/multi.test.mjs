import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pandocAvailable } from '../src/convert/pandoc-rst.mjs';
import { makeGitRepo, manifestYaml, runCli, tmp, write } from './helpers.mjs';

test('repos list form: per-repo dirs, vitepress cleanup, {repo} url_map, also_index, order_from, rst skip note', async () => {
  const php = makeGitRepo({
    'docs/index.md': '---\ntitle: PHP\n---\n\n<script setup>\nimport X from "y";\n</script>\n\n# PHP\n\n::: tip Note\nUse php 8.4.\n:::\n',
    'docs/config.md': '# Configuration\n\nSet `xdebug: true`.\n',
    'docs/__nav.md': '- [Configuration](config.md)\n- [Home](index.md)\n',
    'builders/php.js': 'module.exports = { name: "php" };\n',
    'docs/legacy.rst': 'Legacy\n======\n\ntext\n',
  });
  const redis = makeGitRepo({ 'docs/index.md': '# Redis\n\nRedis service.\n' });
  const work = tmp();
  write(
    join(work, 'kivo/sources.yaml'),
    manifestYaml([
      {
        id: 'lando-plugins',
        type: 'git',
        repos: [
          { repo: php.dir, root: 'docs', include: ['index.md', 'config.md', '*.rst'] },
          { repo: redis.dir, root: 'docs', include: ['index.md'] },
        ],
        also_index: ['builders/*.js'],
        order_from: 'docs/__nav.md',
        convert: 'vitepress',
        url_map: 'https://docs.lando.dev/plugins/{repo}/{name}.html',
        license: 'MIT',
      },
    ]),
  );
  const project = join(work, 'project');
  write(join(project, '.docs-brain.json'), JSON.stringify({ roots: ['../kivo/corpus', '../extra'], manifest: '../kivo/sources.yaml' }));
  write(join(work, 'extra/other/1/page.md'), '---\ntitle: Other\n---\n\n# Other\n\nRedis service in a second root.\n');

  const r = await runCli(['update', '--project', project, '--offline']);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const corpus = join(work, 'kivo/corpus');
  const phpName = php.dir.split('/').pop();
  const index = readFileSync(join(corpus, `lando-plugins/main/${phpName}/index.md`), 'utf8');
  assert.match(index, new RegExp(`url: https://docs.lando.dev/plugins/${phpName}/\\n`), 'index.html collapses to /');
  assert.ok(!/script setup/.test(index));
  assert.match(index, /\*\*Note\*\*\n\nUse php 8\.4\./);
  assert.ok(existsSync(join(corpus, `lando-plugins/main/${redis.dir.split('/').pop()}/index.md`)));
  assert.match(readFileSync(join(corpus, `lando-plugins/main/${phpName}/_source/builders/php.js.md`), 'utf8'), /```js\nmodule\.exports/);
  const summary = readFileSync(join(corpus, 'lando-plugins/main/SUMMARY.md'), 'utf8');
  assert.ok(summary.indexOf('config.md') < summary.indexOf(`${phpName}/index.md`), 'order_from respected');
  assert.ok(existsSync(join(work, 'kivo/state/lock.json')), 'state/ next to corpus/ in the kivo-wisdom layout');
  if (!pandocAvailable()) assert.match(r.stderr, /pandoc not available/);
  else assert.ok(existsSync(join(corpus, `lando-plugins/main/${phpName}/legacy.md`)));

  const s = await runCli(['search', 'Redis service', '--project', project, '--no-rg']);
  assert.match(s.stdout, /kivo\/corpus\/lando-plugins\/main\/.*index\.md:\d+:/);
  assert.match(s.stdout, /extra\/other\/1\/page\.md:\d+:/, 'search iterates every root');
});
