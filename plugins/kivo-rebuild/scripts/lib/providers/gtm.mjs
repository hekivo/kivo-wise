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
