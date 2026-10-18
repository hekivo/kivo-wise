import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PROJECT, manifestYaml, runCli, startServer, tmp, write } from './helpers.mjs';

const SITE = resolve(import.meta.dirname, 'fixtures/site');
const read = (f) => readFileSync(join(SITE, f), 'utf8');

function fm(text, key) {
  const m = new RegExp(`^${key}: (.*)$`, 'm').exec(text);
  return m ? m[1] : undefined;
}

async function site() {
  const state = { lastmodA: '2026-10-01T10:00:00+00:00', items: null, llmsEtag: '"v1"' };
  let base;
  const sub = (s) => s.replaceAll('{{BASE}}', base);
  const srv = await startServer({
    '/sitemap_index.xml': () => ({ headers: { 'content-type': 'application/xml' }, body: sub(read('sitemap_index.xml')) }),
    '/sitemap.xml': () => ({ headers: { 'content-type': 'application/xml' }, body: sub(read('sitemap.xml')).replace('2026-10-01T10:00:00+00:00', state.lastmodA) }),
    '/docs/page-a/': (req) =>
      /text\/markdown/.test(req.headers.accept || '')
        ? { headers: { 'content-type': 'text/markdown; charset=utf-8', vary: 'Accept' }, body: read('page-a.md') }
        : { body: read('page-a.html') },
    '/docs/page-b/': () => ({ headers: { 'content-type': 'text/html; charset=utf-8' }, body: read('page-b.html') }),
    '/wp-json/wp/v2/resource': (req, url) => {
      const after = url.searchParams.get('modified_after');
      const items = (state.items ?? JSON.parse(sub(read('rest-resource.json')))).filter((i) => !after || i.modified > after);
      return { headers: { 'content-type': 'application/json', 'x-wp-total': String(items.length), 'x-wp-totalpages': '1' }, body: JSON.stringify(items) };
    },
    '/llms.txt': (req) =>
      req.headers['if-none-match'] === state.llmsEtag
        ? { status: 304, headers: { etag: state.llmsEtag } }
        : { headers: { 'content-type': 'text/plain', etag: state.llmsEtag }, body: read('llms.txt') },
    '/docs/en/skills.md': () => ({ headers: { 'content-type': 'text/markdown', etag: '"s1"' }, body: read('skills.md') }),
    '/docs/en/plugins-reference.md': () => ({ headers: { 'content-type': 'text/markdown' }, body: read('plugins-reference.md') }),
    '/t/topic/1': (req) =>
      /text\/markdown/.test(req.headers.accept || '')
        ? { headers: { 'content-type': 'text/markdown' }, body: '# Topic one\n\nSee [the follow-up](/t/topic/2) and [elsewhere](/u/someone).\n' }
        : { body: '<html><body>html</body></html>' },
    '/t/topic/2': () => ({ headers: { 'content-type': 'text/markdown' }, body: '# Topic two\n\nResolved by upgrading Acorn.\n' }),
  });
  base = srv.base;
  return { ...srv, state, sub };
}

function setup(srv, sources) {
  const work = tmp();
  const manifest = join(work, 'sources.yaml');
  write(manifest, manifestYaml(sources));
  const corpus = join(work, 'out');
  return { work, corpus, args: ['--project', PROJECT, '--manifest', manifest, '--corpus', corpus, '--offline'] };
}

test('sitemap: include/exclude, markdown negotiation first, defuddle fallback, lastmod incremental', async (t) => {
  const srv = await site();
  t.after(srv.close);
  const { corpus, args } = setup(srv, [
    {
      id: 'docs',
      type: 'sitemap',
      sitemap: `${srv.base}/sitemap_index.xml`,
      children: ['sitemap.xml'],
      include: [`${srv.base}/docs/**`],
      exclude: [`${srv.base}/*/docs/**`],
      selector: 'main#content',
      convert: 'defuddle',
      license: 'proprietary',
      redistribute: false,
      version: { fixed: 'current' },
    },
  ]);
  const r = await runCli(['update', ...args]);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const a = readFileSync(join(corpus, 'docs/current/docs/page-a.md'), 'utf8');
  const b = readFileSync(join(corpus, 'docs/current/docs/page-b.md'), 'utf8');
  assert.equal(fm(a, 'markdown_negotiated'), 'true');
  assert.match(a, /negotiated markdown/);
  assert.equal(fm(b, 'markdown_negotiated'), 'false');
  assert.equal(fm(b, 'title'), 'have_rows()');
  assert.equal(fm(b, 'url'), `${srv.base}/docs/page-b/`);
  assert.equal(fm(b, 'upstream_modified'), '2026-10-02T10:00:00+00:00');
  assert.equal(fm(b, 'redistribute'), 'false');
  assert.match(b, /Checks whether a repeater/);
  assert.ok(!/Site navigation/.test(b));
  assert.ok(!existsSync(join(corpus, 'docs/current/fr')), 'exclude glob applied');
  assert.ok(!existsSync(join(corpus, 'docs/current/blog')), 'include glob applied');
  const accepts = srv.requests.filter((q) => q.path === '/docs/page-b/').map((q) => q.headers.accept);
  assert.match(accepts[0], /^text\/markdown/, 'markdown is always asked first');

  const pageHits = () => srv.requests.filter((q) => q.path.startsWith('/docs/')).length;
  const before = pageHits();
  const mtimeB = statSync(join(corpus, 'docs/current/docs/page-b.md')).mtimeMs;
  await runCli(['update', ...args]);
  assert.equal(pageHits(), before, 'no page refetched when lastmod is unchanged');
  const st0 = await runCli(['status', '--check', ...args.filter((x) => x !== '--offline')]);
  assert.equal(st0.code, 0, st0.stdout + st0.stderr);
  srv.state.lastmodA = '2026-10-10T10:00:00+00:00';
  const st = await runCli(['status', '--check', ...args.filter((x) => x !== '--offline')]);
  assert.equal(st.code, 1, 'sitemap lastmod drift');
  await runCli(['update', ...args]);
  assert.equal(srv.requests.filter((q) => q.path === '/docs/page-a/').length, 2, 'only the changed page refetched');
  assert.equal(statSync(join(corpus, 'docs/current/docs/page-b.md')).mtimeMs, mtimeB);
});

test('rest: turndown of content.rendered, strip selectors, modified_after on the next run', async (t) => {
  const srv = await site();
  t.after(srv.close);
  const { corpus, args, work } = setup(srv, [
    {
      id: 'acf',
      type: 'rest',
      base: `${srv.base}/wp-json/wp/v2`,
      collections: ['resource'],
      fields: ['id', 'slug', 'link', 'modified', 'title', 'content'],
      drift: 'modified_after',
      strip: [{ selector: '.pro-cta' }],
      convert: 'turndown',
      version: { from: 'composer.lock', package: 'wpengine/advanced-custom-fields-pro', strategy: 'major.minor' },
      license: 'proprietary',
      redistribute: false,
    },
  ]);
  const r = await runCli(['update', ...args]);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const gf = readFileSync(join(corpus, 'acf/6.8/resources/get_field.md'), 'utf8');
  assert.equal(fm(gf, 'title'), 'get_field() – ACF');
  assert.equal(fm(gf, 'version'), '"6.8"');
  assert.equal(fm(gf, 'upstream_modified'), '2026-10-01T09:00:00');
  assert.equal(fm(gf, 'markdown_negotiated'), 'false');
  assert.match(gf, /```php\n\$value = get_field\('text_field'\);\n```/);
  assert.ok(!/Buy PRO/.test(gf));
  const first = srv.requests.find((q) => q.path === '/wp-json/wp/v2/resource');
  assert.match(first.search, /_fields=id%2Cslug%2Clink%2Cmodified%2Ctitle%2Ccontent|_fields=id,slug,link,modified,title,content/);
  assert.ok(!/modified_after/.test(first.search), 'first run is a full sync');

  const st0 = await runCli(['status', '--check', ...args.filter((x) => x !== '--offline')]);
  assert.equal(st0.code, 0, st0.stdout + st0.stderr);
  const items = JSON.parse(srv.sub(read('rest-resource.json')));
  items[1].modified = '2026-10-12T09:00:00';
  items[1].content.rendered = '<p>Loops over repeater and flexible content rows.</p>';
  srv.state.items = items;
  const mtime = statSync(join(corpus, 'acf/6.8/resources/get_field.md')).mtimeMs;
  const st = await runCli(['status', '--check', ...args.filter((x) => x !== '--offline')]);
  assert.equal(st.code, 1, 'x-wp-total > 0 with modified_after means upstream drift');
  await runCli(['update', ...args]);
  const calls = srv.requests.filter((q) => q.path === '/wp-json/wp/v2/resource');
  assert.match(calls.at(-1).search, /modified_after=2026-10-03T09%3A00%3A00|modified_after=2026-10-03T09:00:00/);
  assert.match(readFileSync(join(corpus, 'acf/6.8/resources/have_rows.md'), 'utf8'), /flexible content rows/);
  assert.equal(statSync(join(corpus, 'acf/6.8/resources/get_field.md')).mtimeMs, mtime, 'untouched page kept');
  const lock = JSON.parse(readFileSync(join(corpus, '.state/lock.json'), 'utf8'));
  assert.equal(Object.keys(lock.sources.acf.pages).length, 2, 'partial sync merges with the previous pages');
  assert.ok(work);
});

test('llms: include globs over llms.txt links, If-None-Match on the next run', async (t) => {
  const srv = await site();
  t.after(srv.close);
  const { corpus, args } = setup(srv, [
    {
      id: 'cc',
      type: 'llms',
      url: `${srv.base}/llms.txt`,
      include: ['**/en/skills.md', '**/en/plugins*.md'],
      drift: 'etag',
      license: 'Anthropic-terms',
    },
  ]);
  const r = await runCli(['update', ...args]);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const skills = readFileSync(join(corpus, 'cc/current/docs/en/skills.md'), 'utf8');
  assert.equal(fm(skills, 'title'), 'Skills');
  assert.equal(fm(skills, 'url'), `${srv.base}/docs/en/skills.md`);
  assert.equal(fm(skills, 'markdown_negotiated'), 'true');
  assert.ok(existsSync(join(corpus, 'cc/current/docs/en/plugins-reference.md')));
  assert.ok(!existsSync(join(corpus, 'cc/current/docs/en/changelog.md')));
  assert.ok(!srv.requests.some((q) => q.path.includes('never-fetched')));

  const again = await runCli(['update', ...args]);
  assert.match(again.stdout, /cc.*unchanged/);
  const llmsCalls = srv.requests.filter((q) => q.path === '/llms.txt');
  assert.equal(llmsCalls.at(-1).headers['if-none-match'], '"v1"');
  const llmsOut = readFileSync(join(corpus, 'llms.txt'), 'utf8');
  assert.match(llmsOut, /cc\/current\/docs\/en\/skills\.md/);
});

test('negotiate: seeds + follow pattern, markdown pages, max_pages', async (t) => {
  const srv = await site();
  t.after(srv.close);
  const { corpus, args } = setup(srv, [
    { id: 'forum', type: 'negotiate', seeds: [`${srv.base}/t/topic/1`], follow: '/t/', max_pages: 5, license: 'unspecified', redistribute: false },
  ]);
  const r = await runCli(['update', ...args]);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const one = readFileSync(join(corpus, 'forum/current/t/topic/1.md'), 'utf8');
  assert.equal(fm(one, 'markdown_negotiated'), 'true');
  assert.match(readFileSync(join(corpus, 'forum/current/t/topic/2.md'), 'utf8'), /upgrading Acorn/);
  assert.ok(!srv.requests.some((q) => q.path.startsWith('/u/')), 'links outside follow are ignored');
});

test('offline mode refuses non-loopback hosts with a note instead of throwing', async () => {
  const work = tmp();
  const manifest = join(work, 'sources.yaml');
  write(manifest, manifestYaml([{ id: 'remote', type: 'llms', url: 'https://example.invalid/llms.txt', license: 'MIT' }]));
  const r = await runCli(['update', '--project', PROJECT, '--manifest', manifest, '--corpus', join(work, 'c'), '--offline']);
  assert.match(r.stderr, /offline/);
  assert.match(r.stdout, /remote: failed/);
});
