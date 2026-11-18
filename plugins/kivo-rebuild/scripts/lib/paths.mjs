// plugins/kivo-rebuild/scripts/lib/paths.mjs
/** Canonical form used to join sitemap, search and HTTP rows. */
export function normalizePath(input, origin = '') {
  let s = String(input).trim();
  let foreign = '';
  const m = s.match(/^https?:\/\/[^/?#]+/i);
  if (m) {
    const host = m[0].toLowerCase();
    if (origin && host === origin.replace(/\/$/, '').toLowerCase()) s = s.slice(m[0].length) || '/';
    else { foreign = host; s = s.slice(m[0].length) || '/'; }
  }
  s = s.split('#')[0];
  let [path, query = ''] = s.split('?');
  try { path = decodeURIComponent(path); } catch { /* keep undecodable input as is */ }
  path = ('/' + path).replace(/\/{2,}/g, '/');
  const last = path.split('/').pop();
  if (!query && !/\.[a-z0-9]{2,5}$/i.test(last) && !path.endsWith('/')) path += '/';
  if (query) query = query.split('&').filter(Boolean).sort().join('&');
  return foreign + path + (query ? '?' + query : '');
}

export function joinUrl(origin, path) {
  return origin.replace(/\/$/, '') + (path.startsWith('/') ? path : '/' + path);
}
