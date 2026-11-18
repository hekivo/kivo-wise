// plugins/kivo-rebuild/scripts/lib/providers/gsc.mjs
export const id = 'gsc';
export const configured = (config) => Boolean(config.gsc?.property);
export const identityOf = (config) => config.gsc?.service_account || 'gcloud user';
const day = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
export const queryUrl = (property) => `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`;

export async function readTest({ config, token, fetchImpl = fetch }) {
  const res = await fetchImpl(queryUrl(config.gsc.property), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: day(8), endDate: day(1), dimensions: ['page'], rowLimit: 1 }),
  });
  if (res.ok) return { ok: true, identity: identityOf(config) };
  if (res.status === 403) return { ok: false, identity: identityOf(config), error: `${identityOf(config)} is not a user of ${config.gsc.property}: add it in Search Console > Settings > Users and permissions (Restricted is enough)` };
  return { ok: false, identity: identityOf(config), error: `HTTP ${res.status} from Search Console` };
}

const wm = 'https://www.googleapis.com/webmasters/v3/sites';
const sv = 'https://www.googleapis.com/siteVerification/v1';
async function req(method, url, body, { token, fetchImpl = fetch }) {
  const res = await fetchImpl(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!res.ok) throw new Error(`Google HTTP ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}
const need = (p, keys) => keys.filter((k) => !p?.[k]).map((k) => `params.${k} is required`);
export const actions = {
  verificationToken: { validate: (p) => need(p, ['domain']), apply: async (p, ctx) => ({ token: (await req('POST', `${sv}/token`, { site: { type: 'INET_DOMAIN', identifier: p.domain }, verificationMethod: 'DNS_TXT' }, ctx)).token }) },
  verify: { validate: (p) => need(p, ['domain']), apply: async (p, ctx) => ({ id: (await req('POST', `${sv}/webResource?verificationMethod=DNS_TXT`, { site: { type: 'INET_DOMAIN', identifier: p.domain } }, ctx)).id }) },
  addSite: { validate: (p) => need(p, ['property']), apply: async (p, ctx) => { await req('PUT', `${wm}/${encodeURIComponent(p.property)}`, null, ctx); return { property: p.property }; } },
  submitSitemap: { validate: (p) => need(p, ['property', 'sitemap']), apply: async (p, ctx) => { await req('PUT', `${wm}/${encodeURIComponent(p.property)}/sitemaps/${encodeURIComponent(p.sitemap)}`, null, ctx); return { sitemap: p.sitemap }; } },
};
