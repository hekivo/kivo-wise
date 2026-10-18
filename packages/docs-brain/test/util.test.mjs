import { test } from 'node:test';
import assert from 'node:assert/strict';
import { globToRegExp, matchesAny, renderTemplate, urlToCorpusPath, semverParts } from '../src/util.mjs';
import { parseFrontmatter, serializeFrontmatter, buildPage } from '../src/convert/frontmatter.mjs';

test('globToRegExp handles **, * and ? like gitignore-style globs', () => {
  assert.ok(globToRegExp('acorn/**/*.md').test('acorn/installation.md'));
  assert.ok(globToRegExp('acorn/**/*.md').test('acorn/a/b/c.md'));
  assert.ok(!globToRegExp('docs/*.md').test('docs/a/b.md'));
  assert.ok(globToRegExp('docs/__*.md').test('docs/__nav.md'));
  assert.ok(globToRegExp('**/en/skills.md').test('https://code.claude.com/docs/en/skills.md'));
  assert.ok(globToRegExp('**/en/plugins*.md').test('https://code.claude.com/docs/en/plugins-reference.md'));
  assert.ok(globToRegExp('https://wpml.org/documentation/**').test('https://wpml.org/documentation/a/b/'));
  assert.ok(!globToRegExp('https://wpml.org/*/documentation/**').test('https://wpml.org/documentation/a/'));
  assert.ok(globToRegExp('https://wpml.org/*/documentation/**').test('https://wpml.org/fr/documentation/a/'));
  assert.ok(globToRegExp('doc/0*.md').test('doc/01-basic-usage.md'));
  assert.equal(matchesAny('v/old.md', ['v/**']), true);
});

test('renderTemplate fills {major}, {minor}, {version}, {name}', () => {
  const parts = semverParts('v13.26.1');
  assert.deepEqual(parts, { version: '13.26.1', major: '13', minor: '26', patch: '1' });
  assert.equal(renderTemplate('{major}.x', parts), '13.x');
  assert.equal(renderTemplate('v{version}', parts), 'v13.26.1');
  assert.equal(renderTemplate('{major}.{minor}', parts), '13.26');
});

test('urlToCorpusPath turns URLs into stable relative .md paths', () => {
  assert.equal(urlToCorpusPath('https://roots.io/acorn/docs/installation/'), 'acorn/docs/installation.md');
  assert.equal(urlToCorpusPath('https://code.claude.com/docs/en/skills.md'), 'docs/en/skills.md');
  assert.equal(urlToCorpusPath('https://example.org/'), 'index.md');
  assert.equal(urlToCorpusPath('https://developer.wordpress.org/cli/commands/cache/?output_format=md'), 'cli/commands/cache.md');
  assert.equal(urlToCorpusPath('https://discourse.roots.io/t/some-topic/123.md'), 't/some-topic/123.md');
});

test('frontmatter parse/serialize round trip and buildPage adds a single H1', () => {
  const src = '---\ntitle: Hello\ndescription: World\n---\n\nBody text\n';
  const fm = parseFrontmatter(src);
  assert.equal(fm.data.title, 'Hello');
  assert.equal(fm.body, 'Body text\n');
  const out = serializeFrontmatter({ title: 'A: b', n: 1 });
  assert.match(out, /^---\ntitle: "A: b"\nn: 1\n---\n$/);

  const page = buildPage({
    body: 'Body text\n',
    title: 'Hello',
    meta: { source: 's', version: '1', url: 'https://x/y', license: 'MIT', redistribute: true, fetched_at: '2026-01-01T00:00:00Z' },
  });
  assert.match(page.text, /^---\ntitle: Hello\nsource: s\nversion: "1"\n/);
  assert.match(page.text, /\n# Hello\n\nBody text\n$/);
  assert.equal(page.sha256.length, 64);
  const twice = buildPage({ body: '# Hello\n\nBody\n', title: 'Hello', meta: { source: 's', version: '1' } });
  assert.equal((twice.text.match(/^# /gm) || []).length, 1, 'does not duplicate an existing H1');
});

test('parseFrontmatter strips the "In this article" section when asked', () => {
  const md = '# T\n\n## In this article\n\n- a\n- b\n\n## Real\n\ntext\n';
  const fm = parseFrontmatter(md, { stripHeadings: ['In this article'] });
  assert.ok(!/In this article/.test(fm.body));
  assert.match(fm.body, /## Real\n\ntext/);
});
