import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { htmlToMarkdown, findMarkdownAlternate } from '../src/convert/html-to-md.mjs';
import { stripVitepress } from '../src/convert/vitepress.mjs';
import { stripMdx } from '../src/convert/mdx-strip.mjs';
import { convertRst } from '../src/convert/pandoc-rst.mjs';

const SITE = resolve(import.meta.dirname, 'fixtures/site');
const pageA = readFileSync(resolve(SITE, 'page-a.html'), 'utf8');

test('htmlToMarkdown with turndown honours selector and strip selectors, keeps code and tables', async () => {
  const r = await htmlToMarkdown(pageA, {
    url: 'https://example.org/docs/page-a/',
    engine: 'turndown',
    selector: 'main#content',
    strip: [{ selector: '.pro-cta' }, { heading: 'In this article' }],
  });
  assert.equal(r.title, 'get_field()');
  assert.match(r.markdown, /^# get_field\(\)/m);
  assert.match(r.markdown, /Use `the_field\(\)` to print it/);
  assert.match(r.markdown, /```php\nget_field\(\$selector/);
  assert.match(r.markdown, /\| Name \| Type \|/);
  assert.ok(!/Upgrade to PRO/.test(r.markdown), 'strip selector removed');
  assert.ok(!/In this article/.test(r.markdown), 'strip heading removed');
  assert.ok(!/Home/.test(r.markdown), 'outside the selector');
  assert.ok(!/Copyright/.test(r.markdown));
});

test('htmlToMarkdown with defuddle extracts the main content without a selector', async () => {
  const r = await htmlToMarkdown(readFileSync(resolve(SITE, 'page-b.html'), 'utf8'), {
    url: 'https://example.org/docs/page-b/',
    engine: 'defuddle',
  });
  assert.equal(r.title, 'have_rows()');
  assert.match(r.markdown, /Checks whether a repeater/);
  assert.match(r.markdown, /```php/);
  assert.ok(!/Site navigation/.test(r.markdown));
});

test('findMarkdownAlternate reads <link rel="alternate" type="text/markdown">', () => {
  assert.equal(findMarkdownAlternate(pageA, 'https://example.org/docs/page-a/'), 'https://example.org/docs/page-a.md');
  assert.equal(findMarkdownAlternate('<html><head></head></html>', 'https://example.org/'), null);
});

test('stripVitepress turns ::: containers into plain paragraphs and drops <script setup>', () => {
  const src = [
    '---',
    'title: Tooling',
    'description: Lando tooling',
    '---',
    '',
    '<script setup>',
    "import { VPLandoCard } from '@lando/vitepress-theme-default-plus';",
    '</script>',
    '',
    '# Tooling',
    '',
    '::: tip Heads up',
    'Run `lando rebuild` after changes.',
    ':::',
    '',
    '::: warning',
    'Danger zone.',
    ':::',
    '',
    '<VPLandoCard title="x" />',
    '',
    '```yaml',
    '::: not-a-container-inside-code',
    '```',
  ].join('\n');
  const out = stripVitepress(src);
  assert.match(out, /^---\ntitle: Tooling/);
  assert.ok(!/<script setup>/.test(out));
  assert.ok(!/VPLandoCard/.test(out));
  assert.match(out, /\*\*Heads up\*\*\n\nRun `lando rebuild` after changes\./);
  assert.match(out, /\*\*Warning\*\*\n\nDanger zone\./);
  assert.ok(!/^:::\s*$/m.test(out), 'closing fences removed');
  assert.match(out, /```yaml\n::: not-a-container-inside-code\n```/, 'code blocks untouched');
});

test('stripMdx removes imports, exports and JSX wrappers but keeps text and code', () => {
  const src = [
    '---',
    'title: Theme variables',
    '---',
    "import { ApiTable } from '@/components/api-table.tsx';",
    'export const description = "Using utility classes";',
    '',
    '# Theme variables',
    '',
    '<TipGood>Use @theme</TipGood>',
    '',
    '<Figure>',
    'Some figure caption text.',
    '</Figure>',
    '',
    '<ApiTable rows={[["a", "b"]]} />',
    '{/* a comment */}',
    '',
    '```css',
    '<Keep this="inside code" />',
    '```',
  ].join('\n');
  const out = stripMdx(src);
  assert.ok(!/^import /m.test(out));
  assert.ok(!/^export /m.test(out));
  assert.ok(!/ApiTable/.test(out.replace(/```css[\s\S]*```/, '')));
  assert.ok(!/a comment/.test(out));
  assert.match(out, /Use @theme/);
  assert.match(out, /Some figure caption text\./);
  assert.match(out, /<Keep this="inside code" \/>/);
});

test('convertRst records a note and skips when pandoc is missing', () => {
  const r = convertRst('Title\n=====\n\nText.\n', { pandocBin: '/nonexistent/pandoc-xyz' });
  assert.equal(r.markdown, null);
  assert.match(r.note, /pandoc not available/);
});
