// HTTP client with per-source politeness, offline mode (loopback only) and markdown negotiation.
import { sleep } from './util.mjs';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export class OfflineError extends Error {}

export const MARKDOWN_ACCEPT = 'text/markdown, text/x-markdown;q=0.95, text/html;q=0.8, */*;q=0.5';

export function isMarkdownType(contentType) {
  return /text\/(x-)?markdown/i.test(contentType || '');
}

export function withQuery(url, query) {
  if (!query) return url;
  const u = new URL(url);
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, String(v));
  return u.href;
}

export class Http {
  constructor({ offline = false, userAgent = 'docs-brain/0.1', politenessMs = 0, timeoutMs = 30000 } = {}) {
    this.offline = offline;
    this.userAgent = userAgent;
    this.politenessMs = politenessMs;
    this.timeoutMs = timeoutMs;
    this.last = 0;
    this.count = 0;
  }

  assertAllowed(url) {
    if (!this.offline) return;
    const host = new URL(url).hostname;
    if (!LOOPBACK.has(host)) throw new OfflineError(`offline: refusing to fetch ${url}`);
  }

  /** GET (or HEAD) returning { status, headers, text, url, contentType }. Never throws on HTTP status. */
  async request(url, { method = 'GET', accept, headers = {} } = {}) {
    this.assertAllowed(url);
    const wait = this.last + this.politenessMs - Date.now();
    if (this.count > 0 && wait > 0) await sleep(wait);
    this.last = Date.now();
    this.count++;
    const h = { 'user-agent': this.userAgent, ...headers };
    if (accept) h.accept = accept;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { method, headers: h, redirect: 'follow', signal: ctrl.signal });
      const text = method === 'HEAD' || res.status === 304 ? '' : await res.text();
      const hdr = Object.fromEntries(res.headers.entries());
      return { status: res.status, headers: hdr, text, url: res.url || url, contentType: hdr['content-type'] || '' };
    } finally {
      clearTimeout(timer);
    }
  }

  get(url, opts) {
    return this.request(url, opts);
  }
}

/** Conditional request headers from a previous page/lock entry. */
export function conditionalHeaders(prev) {
  const h = {};
  if (prev?.etag) h['if-none-match'] = prev.etag;
  if (prev?.last_modified) h['if-modified-since'] = prev.last_modified;
  return h;
}
