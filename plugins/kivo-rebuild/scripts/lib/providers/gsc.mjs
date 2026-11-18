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
