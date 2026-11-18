// plugins/kivo-rebuild/scripts/lib/rules.mjs
// First matching rule wins. R99 always matches and cannot be disabled.
const st = (r, k) => r[k]?.status ?? null;
const is3xx = (s) => s >= 300 && s < 400;
const ext = (path, list) => list.includes((path.split('?')[0].split('/').pop().split('.').slice(1).pop() ?? '').toLowerCase());
const isTag = (r, c) => c.tagTypes.includes(r.type);
// A Location on the live or staging host becomes a path; a foreign host stays absolute.
export function toTarget(location, origins = []) {
  const loc = String(location ?? '').trim();
  if (!loc) return '';
  const m = loc.match(/^https?:\/\/[^/?#]+/i);
  if (!m) return loc.startsWith('/') ? loc : '/' + loc;
  const host = m[0].toLowerCase();
  const own = origins.filter(Boolean).some((o) => o.replace(/\/$/, '').toLowerCase() === host);
  return own ? loc.slice(m[0].length) || '/' : loc;
}

export const RULES = [
  { id: 'R01', describe: 'path is in the approved redirects', when: (r, c) => c.redirects.has(r.path), decide: (r, c) => ({ decision: 'redirect', reason: `approved redirect to ${c.redirects.get(r.path)}`, target: c.redirects.get(r.path) }) },
  { id: 'R02', describe: 'from search, file extension, outside the sitemap', when: (r, c) => r.origin === 'search' && ext(r.path, c.fileExt), decide: (r) => ({ decision: 'review', reason: `file outside the sitemap (live ${st(r, 'live') ?? '?'})` }) },
  { id: 'R03', describe: 'from search, with a query string', when: (r) => r.origin === 'search' && r.path.includes('?'), decide: () => ({ decision: 'review', reason: 'query-string variant' }) },
  { id: 'R04', describe: 'from search, live site answers 3xx', when: (r) => r.origin === 'search' && is3xx(st(r, 'live')), decide: (r, c) => ({ decision: 'redirect', reason: 'live site redirects; needs an edge rule', target: toTarget(r.live.location, c.origins) }) },
  { id: 'R05', describe: 'from search, live site answers 404 or 410', when: (r) => r.origin === 'search' && [404, 410].includes(st(r, 'live')), decide: () => ({ decision: 'review', reason: 'already gone on the live site' }) },
  { id: 'R06', describe: 'from search, any other case', when: (r) => r.origin === 'search', decide: () => ({ decision: 'review', reason: 'outside the sitemap' }) },
  { id: 'R07', describe: 'staging 404, changed on the live site after the import date, not a tag type', when: (r, c) => c.hasStaging && st(r, 'staging') === 404 && c.importDate && r.lastmod && r.lastmod > c.importDate && !isTag(r, c), decide: () => ({ decision: 'keep', reason: 'changed on the live site after the import: cutover delta' }) },
  { id: 'R08', describe: 'path starts with a junk prefix', when: (r, c) => c.junkPrefixes.some((p) => r.path.startsWith(p)), decide: () => ({ decision: 'gone', reason: 'test, draft or plugin page' }) },
  { id: 'R09', describe: 'tag type, staging answers 200', when: (r, c) => isTag(r, c) && st(r, 'staging') === 200, decide: () => ({ decision: 'keep', reason: 'tag archive resolves' }) },
  { id: 'R10', describe: 'tag type, no search data', when: (r, c) => isTag(r, c) && !c.hasSignals, decide: () => ({ decision: 'review', reason: 'tag archive without search data' }) },
  { id: 'R11', describe: 'tag type with clicks', when: (r, c) => isTag(r, c) && (r.clicks ?? 0) > 0, decide: () => ({ decision: 'review', reason: 'tag with clicks: keep or redirect to a category' }) },
  { id: 'R12', describe: 'tag type with impressions but no clicks', when: (r, c) => isTag(r, c) && (r.impressions ?? 0) > 0, decide: () => ({ decision: 'noindex', reason: 'shown in search but never clicked' }) },
  { id: 'R13', describe: 'tag type, never shown in search', when: (r, c) => isTag(r, c), decide: () => ({ decision: 'gone', reason: 'never shown in search' }) },
  { id: 'R14', describe: 'staging answers 200', when: (r) => st(r, 'staging') === 200, decide: () => ({ decision: 'keep', reason: 'same URL on the new project' }) },
  { id: 'R15', describe: 'staging answers 3xx', when: (r) => is3xx(st(r, 'staging')), decide: (r, c) => ({ decision: 'redirect', reason: 'staging already redirects', target: toTarget(r.staging.location, c.origins) }) },
  { id: 'R16', describe: 'no staging, live answers 200 or has no data', when: (r, c) => !c.hasStaging && (st(r, 'live') === 200 || st(r, 'live') === null), decide: () => ({ decision: 'keep', reason: 'exists on the live site' }) },
  { id: 'R17', describe: 'no staging, live answers 3xx', when: (r, c) => !c.hasStaging && is3xx(st(r, 'live')), decide: (r, c) => ({ decision: 'redirect', reason: 'live site redirects', target: toTarget(r.live.location, c.origins) }) },
  { id: 'R18', describe: 'no staging, live answers 404 or 410', when: (r, c) => !c.hasStaging && [404, 410].includes(st(r, 'live')), decide: () => ({ decision: 'gone', reason: 'already gone on the live site' }) },
  { id: 'R99', describe: 'no other rule fits', when: () => true, decide: (r) => ({ decision: 'review', reason: `no rule fits (staging ${st(r, 'staging') ?? '?'})` }) },
];

export function propose(row, ctx) {
  for (const rule of RULES) {
    if (rule.id !== 'R99' && ctx.disabled.has(rule.id)) continue;
    if (!rule.when(row, ctx)) continue;
    const d = rule.decide(row, ctx);
    return { proposed: d.decision, reason: d.reason, rule_id: rule.id, ...(d.target ? { target: d.target } : {}) };
  }
  throw new Error('unreachable: R99 always matches');
}
