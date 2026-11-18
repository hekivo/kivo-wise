// plugins/kivo-rebuild/scripts/lib/providers/ga4.mjs
export const id = 'ga4';
export const configured = (config) => Boolean(config.ga4?.property_id);
export const identityOf = (config) => config.ga4?.service_account || 'gcloud user';
export const reportUrl = (pid) => `https://analyticsdata.googleapis.com/v1beta/properties/${pid}:runReport`;

export async function readTest({ config, token, fetchImpl = fetch }) {
  const res = await fetchImpl(reportUrl(config.ga4.property_id), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }], metrics: [{ name: 'sessions' }], limit: 1 }),
  });
  if (res.ok) return { ok: true, identity: identityOf(config) };
  if (res.status === 403) return { ok: false, identity: identityOf(config), error: `${identityOf(config)} has no access to GA4 property ${config.ga4.property_id}: add it as Viewer in Admin > Property access management` };
  return { ok: false, identity: identityOf(config), error: `HTTP ${res.status} from GA4 Data API` };
}
