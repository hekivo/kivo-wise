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

const admin = 'https://analyticsadmin.googleapis.com/v1beta';
async function post(url, body, { token, fetchImpl = fetch }) {
  const res = await fetchImpl(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`GA4 Admin HTTP ${res.status}`);
  return res.json();
}
const need = (p, keys) => keys.filter((k) => !p?.[k]).map((k) => `params.${k} is required`);
export const actions = {
  createProperty: { validate: (p) => need(p, ['account', 'displayName', 'timeZone', 'currencyCode']), apply: async (p, ctx) => ({ property: (await post(`${admin}/properties`, { parent: `accounts/${p.account}`, displayName: p.displayName, timeZone: p.timeZone, currencyCode: p.currencyCode }, ctx)).name }) },
  createWebStream: { validate: (p) => need(p, ['property', 'displayName', 'defaultUri']), apply: async (p, ctx) => { const r = await post(`${admin}/${p.property}/dataStreams`, { type: 'WEB_DATA_STREAM', displayName: p.displayName, webStreamData: { defaultUri: p.defaultUri } }, ctx); return { stream: r.name, measurementId: r.webStreamData?.measurementId ?? '' }; } },
  createKeyEvent: { validate: (p) => need(p, ['property', 'eventName']), apply: async (p, ctx) => ({ keyEvent: (await post(`${admin}/${p.property}/keyEvents`, { eventName: p.eventName }, ctx)).name }) },
};
