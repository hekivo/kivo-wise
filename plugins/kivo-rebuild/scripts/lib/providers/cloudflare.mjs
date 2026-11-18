// plugins/kivo-rebuild/scripts/lib/providers/cloudflare.mjs
import { defaultExec } from '../credentials.mjs';

// The secret reaches 1Password as a JSON item template on stdin (`op item create -`): never argv, never a file.
export function storeServiceToken({ vault, title, clientId, clientSecret }, exec = defaultExec) {
  const item = { title, category: 'API_CREDENTIAL', fields: [
    { id: 'client_id', label: 'CF-Access-Client-Id', type: 'STRING', value: clientId },
    { id: 'client_secret', label: 'CF-Access-Client-Secret', type: 'CONCEALED', value: clientSecret },
  ] };
  exec('op', ['item', 'create', '--vault', vault, '-'], { input: JSON.stringify(item) });
}

export const id = 'cloudflare';
export const configured = (config) => Boolean(config.cloudflare?.zone_id);
export const usesGoogleToken = false;
export async function readTest({ config, fetchImpl = fetch, env = process.env }) {
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!token) return { ok: false, identity: 'api token', error: `CLOUDFLARE_API_TOKEN not set: run connect under op run with ${config.cloudflare.token_ref ?? 'an op:// reference in config.cloudflare.token_ref'}` };
  const res = await fetchImpl(`https://api.cloudflare.com/client/v4/zones/${config.cloudflare.zone_id}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.ok ? { ok: true, identity: 'api token' } : { ok: false, identity: 'api token', error: `HTTP ${res.status} from Cloudflare` };
}

const cf = 'https://api.cloudflare.com/client/v4';
async function cfPost(path, body, { fetchImpl = fetch, env = process.env }) {
  const res = await fetchImpl(`${cf}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(`Cloudflare HTTP ${res.status}`);
  return json.result;
}
const need = (p, keys) => keys.filter((k) => !p?.[k]).map((k) => `params.${k} is required`);
export const actions = {
  createTxtRecord: { validate: (p) => need(p, ['zone', 'name', 'content']), apply: async (p, ctx) => ({ record: (await cfPost(`/zones/${p.zone}/dns_records`, { type: 'TXT', name: p.name, content: p.content, ttl: 300 }, ctx)).id }) },
  createAccessServiceToken: {
    validate: (p) => need(p, ['account', 'name', 'vault']),
    apply: async (p, ctx) => {
      const r = await cfPost(`/accounts/${p.account}/access/service_tokens`, { name: p.name, duration: p.duration ?? '8760h' }, ctx);
      // The one place a secret passes through the plugin: in memory, straight into 1Password, never returned.
      try {
        storeServiceToken({ vault: p.vault, title: p.name, clientId: r.client_id, clientSecret: r.client_secret }, ctx.exec ?? defaultExec);
      } catch (e) {
        throw new Error(`service token ${r.client_id} was created but not stored (${e.message}); its secret is lost: delete it in Cloudflare Zero Trust > Access > Service Auth and re-run`);
      }
      return { client_id: r.client_id, stored: `op://${p.vault}/${p.name}` };
    },
  },
};
