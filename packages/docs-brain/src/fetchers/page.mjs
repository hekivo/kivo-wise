// Fetch one web page, markdown first: Accept: text/markdown, then <link rel=alternate>, then HTML conversion.
import { firstH1, parseFrontmatter } from '../convert/frontmatter.mjs';
import { findMarkdownAlternate, htmlToMarkdown } from '../convert/html-to-md.mjs';
import { MARKDOWN_ACCEPT, conditionalHeaders, isMarkdownType, withQuery } from '../http.mjs';
import { sha256 } from '../util.mjs';

function looksLikeMarkdown(res, url) {
  if (isMarkdownType(res.contentType)) return true;
  return /text\/plain/i.test(res.contentType) && /\.(md|txt)(\?|$)/.test(url);
}

function markdownPage(text, source) {
  const headingStrips = (source.strip || []).filter((s) => s && s.heading).map((s) => s.heading);
  let { data, body } = parseFrontmatter(text, { stripHeadings: headingStrips });
  // developer.wordpress.org ?output_format=md starts with "Title: ...", "Author: ..." lines.
  const header = /^Title:\s*(.+)\n(?:[A-Z][\w ]+:.*\n)*/.exec(body);
  let title = data.title ? String(data.title) : null;
  if (header) {
    title = title ?? header[1].trim();
    body = body.slice(header[0].length).replace(/^\s+/, '');
  }
  return { title: title ?? firstH1(body), body, description: data.description ? String(data.description) : undefined };
}

/**
 * Returns { notModified } | { ok:false, status } | { ok:true, title, body, negotiated, via, etag, last_modified, raw_sha256, finalUrl }.
 */
export async function fetchPage(http, url, { source, prev = null, query = null } = {}) {
  const target = withQuery(url, query);
  const res = await http.get(target, { accept: MARKDOWN_ACCEPT, headers: conditionalHeaders(prev) });
  if (res.status === 304) return { notModified: true };
  if (res.status >= 400) return { ok: false, status: res.status };
  const base = { ok: true, etag: res.headers.etag, last_modified: res.headers['last-modified'], raw_sha256: sha256(res.text), finalUrl: res.url };
  if (looksLikeMarkdown(res, target)) {
    return { ...base, ...markdownPage(res.text, source), negotiated: isMarkdownType(res.contentType), via: isMarkdownType(res.contentType) ? 'accept' : 'md-url' };
  }
  const alt = findMarkdownAlternate(res.text, res.url || target);
  if (alt && alt !== target) {
    const altRes = await http.get(alt, { accept: 'text/markdown, text/plain;q=0.9' });
    if (altRes.status < 400 && looksLikeMarkdown(altRes, alt)) {
      return { ...base, ...markdownPage(altRes.text, source), negotiated: true, via: 'link-alternate' };
    }
  }
  const engine = source.convert === 'turndown' ? 'turndown' : 'defuddle';
  const conv = await htmlToMarkdown(res.text, { url: res.url || target, engine, selector: source.selector, strip: source.strip });
  return { ...base, ...markdownPage(conv.markdown, { strip: [] }), title: conv.title, negotiated: false, via: `html-${engine}`, note: conv.note };
}

export function pageRecordExtras(r) {
  const lock = {};
  if (r.etag) lock.etag = r.etag;
  if (r.last_modified) lock.last_modified = r.last_modified;
  if (r.raw_sha256) lock.raw_sha256 = r.raw_sha256;
  return lock;
}
