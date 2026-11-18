// plugins/kivo-rebuild/scripts/lib/providers/cloudflare.mjs
export const id = 'cloudflare';
export const configured = (config) => Boolean(config.cloudflare?.zone_id);
export const usesGoogleToken = false;
export async function readTest({ config, fetchImpl = fetch, env = process.env }) {
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!token) return { ok: false, identity: 'api token', error: `CLOUDFLARE_API_TOKEN not set: run connect under op run with ${config.cloudflare.token_ref ?? 'an op:// reference in config.cloudflare.token_ref'}` };
  const res = await fetchImpl(`https://api.cloudflare.com/client/v4/zones/${config.cloudflare.zone_id}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.ok ? { ok: true, identity: 'api token' } : { ok: false, identity: 'api token', error: `HTTP ${res.status} from Cloudflare` };
}
