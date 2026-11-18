// plugins/kivo-rebuild/scripts/lib/providers/pagespeed.mjs
export const id = 'pagespeed';
export const configured = (config) => Boolean(config.live);
export const usesGoogleToken = false;
export async function readTest({ config, fetchImpl = fetch, env = process.env }) {
  const key = env.PAGESPEED_API_KEY ? `&key=${env.PAGESPEED_API_KEY}` : '';
  const res = await fetchImpl(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(config.live)}&strategy=mobile&category=performance${key}`);
  return res.ok ? { ok: true, identity: key ? 'api key' : 'anonymous' } : { ok: false, identity: 'anonymous', error: `HTTP ${res.status} from PageSpeed (429 means set PAGESPEED_API_KEY through op run)` };
}
