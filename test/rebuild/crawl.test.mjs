// test/rebuild/crawl.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIX } from './helpers.mjs';
import { crawl } from '../../plugins/kivo-rebuild/scripts/crawl-sitemap.mjs';

const fakeFetch = async (url) => {
  const name = new URL(url).pathname.slice(1);
  const file = join(FIX, 'sitemaps', name === 'sitemap_index.xml' ? 'index.xml' : name);
  if (!existsSync(file)) return new Response('not found', { status: 404 });
  return new Response(readFileSync(file, 'utf8'), { status: 200, headers: { 'content-type': name.startsWith('html') ? 'text/html' : 'application/xml' } });
};

test('crawl follows the index, types by stem, dedupes, records failures', async () => {
  const { urls, failures } = await crawl({ origin: 'https://www.example.test', start: 'https://www.example.test/sitemap_index.xml', fetchImpl: fakeFetch, types: { product: 'product' } });
  const paths = urls.map((u) => u.path).sort();
  assert.deepEqual(paths, ['/', '/about/', '/product/café/', '/product/tea/']);
  assert.equal(urls.find((u) => u.path === '/product/café/').type, 'product');
  assert.equal(urls.find((u) => u.path === '/product/café/').lastmod, '2026-02-01');
  assert.equal(urls.find((u) => u.path === '/').lastmod, '2026-01-01');
  assert.equal(urls.find((u) => u.path === '/about/').type, 'page');
  assert.deepEqual(failures.map((f) => f.sitemap).sort(), ['broken-sitemap.xml', 'html-sitemap.xml']);
  assert.match(failures.find((f) => f.sitemap === 'html-sitemap.xml').error, /not a sitemap/);
});

test('urls schema accepts the crawl output including failures', async () => {
  const { checkDoc } = await import('../../plugins/kivo-rebuild/scripts/lib/state.mjs');
  const { urls, failures } = await crawl({ origin: 'https://www.example.test', start: 'https://www.example.test/sitemap_index.xml', fetchImpl: fakeFetch });
  const doc = { schema_version: 1, kind: 'urls', run_id: 'r', generated_at: 'x', items: urls, failures };
  assert.deepEqual(checkDoc('urls', doc), []);
  assert.notDeepEqual(checkDoc('urls', { ...doc, failures: [{ sitemap: 1 }] }), []);
});
