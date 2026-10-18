// WP REST sources: paginated collections, content.rendered -> markdown, modified_after incremental sync.
import { parseHTML } from 'linkedom';
import { htmlToMarkdown } from '../convert/html-to-md.mjs';
import { urlToCorpusPath } from '../util.mjs';
import { fetchPage, pageRecordExtras } from './page.mjs';

function decode(html) {
  if (!html) return '';
  const { document } = parseHTML(`<!doctype html><html><body><p>${html}</p></body></html>`);
  return document.querySelector('p').textContent.trim();
}

function collectionUrl(source, collection, { page, perPage, after, fields }) {
  const u = new URL(`${source.base.replace(/\/+$/, '')}/${collection}`);
  u.searchParams.set('per_page', String(perPage));
  u.searchParams.set('page', String(page));
  u.searchParams.set('orderby', 'modified');
  u.searchParams.set('order', 'asc');
  if (fields?.length) u.searchParams.set('_fields', fields.join(','));
  if (after) u.searchParams.set('modified_after', after);
  return u.href;
}

async function getJson(http, url) {
  const res = await http.get(url, { accept: 'application/json' });
  let data = null;
  try {
    data = JSON.parse(res.text);
  } catch {
    data = null;
  }
  return { res, data };
}

export async function fetchSource({ source, prev, ctx }) {
  const notes = [];
  if (!source.base || source.collections.length === 0) return { ok: false, notes: [`${source.id}: rest source needs base and collections`] };
  if (source.categories?.from_sitemap) notes.push(`${source.id}: categories.from_sitemap is not implemented; category pages skipped`);
  const incremental = Boolean(prev && Object.keys(prev.pages ?? {}).length && !ctx.force && (source.drift ?? 'modified_after') === 'modified_after');
  const cursors = { ...(incremental ? prev.upstream?.cursor ?? {} : {}) };
  const totals = {};
  const pages = [];
  const perPage = source.page_size ?? 100;
  const fields = source.fields?.length ? source.fields : ['id', 'slug', 'link', 'modified', 'modified_gmt', 'title', 'content'];
  for (const collection of source.collections) {
    const after = incremental ? cursors[collection] : null;
    let page = 1;
    let totalPages = 1;
    do {
      const { res, data } = await getJson(ctx.http, collectionUrl(source, collection, { page, perPage, after, fields }));
      if (res.status >= 400 || !Array.isArray(data)) {
        notes.push(`${source.id}: ${collection} page ${page}: HTTP ${res.status}`);
        if (page === 1 && pages.length === 0 && source.collections.length === 1) return { ok: false, notes };
        break;
      }
      totalPages = Number(res.headers['x-wp-totalpages'] ?? 1) || 1;
      totals[collection] = Number(res.headers['x-wp-total'] ?? data.length);
      for (const item of data) {
        if (item.modified && (!cursors[collection] || item.modified > cursors[collection])) cursors[collection] = item.modified;
        const link = item.link ?? null;
        const title = decode(item.title?.rendered ?? item.title ?? item.slug);
        let body = null;
        let negotiated = false;
        let lock = {};
        if (source.prefer_markdown && link) {
          const r = await fetchPage(ctx.http, link, { source, query: source.prefer_markdown.query });
          if (r.ok && r.negotiated) {
            body = r.body;
            negotiated = true;
            lock = pageRecordExtras(r);
          }
        }
        if (body === null) {
          const html = item.content?.rendered ?? '';
          const conv = await htmlToMarkdown(`<!doctype html><html><head><title>${title}</title></head><body><main>${html}</main></body></html>`, {
            url: link ?? source.base,
            engine: source.convert === 'defuddle' ? 'defuddle' : 'turndown',
            selector: 'main',
            strip: source.strip,
          });
          body = conv.markdown.replace(/^#\s+.*\n+/, '');
        }
        pages.push({
          path: link ? urlToCorpusPath(link) : `${collection}/${item.slug ?? item.id}.md`,
          title,
          body: `# ${title}\n\n${body}`,
          url: link,
          upstream_modified: item.modified_gmt ? `${item.modified_gmt}Z` : item.modified ?? null,
          markdown_negotiated: negotiated,
          extra: { rest_collection: collection, rest_id: item.id },
          lock,
        });
      }
      page++;
    } while (page <= totalPages);
  }
  return { ok: true, partial: incremental, pages, upstream: { cursor: cursors, totals }, notes };
}

export async function checkUpstream({ source, entry, ctx }) {
  const cursors = entry?.upstream?.cursor ?? {};
  const changed = [];
  for (const collection of source.collections) {
    const after = cursors[collection];
    const { res } = await getJson(ctx.http, collectionUrl(source, collection, { page: 1, perPage: 1, after, fields: ['id'] }));
    if (res.status >= 400) return { checked: false, detail: `${collection}: HTTP ${res.status}` };
    const n = Number(res.headers['x-wp-total'] ?? 0);
    if (n > 0) changed.push(`${collection}: ${n} modified after ${after ?? 'never'}`);
  }
  return { checked: true, drift: changed.length > 0, detail: changed.join(', ') || 'up to date' };
}
