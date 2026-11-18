// plugins/kivo-rebuild/scripts/lib/providers/gtm.mjs
export const id = 'gtm';
export const configured = (config) => Boolean(config.gtm?.account_id && config.gtm?.container_id);
export const identityOf = (config) => config.gtm?.service_account || config.gsc?.service_account || 'gcloud user';
export const base = (config) => `https://tagmanager.googleapis.com/tagmanager/v2/accounts/${config.gtm.account_id}/containers/${config.gtm.container_id}`;

export async function readTest({ config, token, fetchImpl = fetch }) {
  const res = await fetchImpl(base(config), { headers: { Authorization: `Bearer ${token}` } });
  if (res.ok) return { ok: true, identity: identityOf(config) };
  if (res.status === 403) return { ok: false, identity: identityOf(config), error: `${identityOf(config)} has no access to container ${config.gtm.container_id}: add it in Tag Manager > Admin > User Management (Read)` };
  return { ok: false, identity: identityOf(config), error: `HTTP ${res.status} from Tag Manager API` };
}

const api = 'https://tagmanager.googleapis.com/tagmanager/v2';
async function call(url, body, { token, fetchImpl = fetch }) {
  const res = await fetchImpl(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Tag Manager HTTP ${res.status}`);
  return res.json();
}
const need = (p, keys) => keys.filter((k) => !p?.[k]).map((k) => `params.${k} is required`);
// No publish operation exists on purpose: a person publishes the version in the Tag Manager UI.
export const actions = {
  createWorkspace: { validate: (p) => need(p, ['container', 'name']), apply: async (p, ctx) => ({ workspace: (await call(`${api}/${p.container}/workspaces`, { name: p.name }, ctx)).path }) },
  createTag: { validate: (p) => need(p, ['workspace', 'tag']), apply: async (p, ctx) => ({ tag: (await call(`${api}/${p.workspace}/tags`, p.tag, ctx)).path }) },
  createVersion: { validate: (p) => need(p, ['workspace', 'name']), apply: async (p, ctx) => ({ version: (await call(`${api}/${p.workspace}:create_version`, { name: p.name }, ctx)).containerVersion?.path ?? '' }) },
};
