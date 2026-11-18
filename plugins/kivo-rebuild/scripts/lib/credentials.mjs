// plugins/kivo-rebuild/scripts/lib/credentials.mjs
import { spawnSync } from 'node:child_process';

// `input`, when given, goes to the child's stdin: the way to hand a secret to a CLI without argv or a file.
export function defaultExec(cmd, args, { input } = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'], ...(input === undefined ? {} : { input }) });
  if (r.status !== 0) throw new Error(`${cmd} ${args[0]} failed (exit ${r.status})`);
  return r.stdout;
}

const HEADER_LABELS = ['CF-Access-Client-Id', 'CF-Access-Client-Secret'];

export function resolveHeaders(ref, { exec = defaultExec } = {}) {
  if (!ref) return {};
  if (ref.startsWith('op://')) {
    const [vault, item] = ref.slice(5).split('/');
    const data = JSON.parse(exec('op', ['item', 'get', item, '--vault', vault, '--format', 'json']));
    const headers = {};
    for (const f of data.fields ?? []) {
      if (HEADER_LABELS.includes(f.label)) headers[f.label] = f.value;
      else if (f.label?.startsWith('header:')) headers[f.label.slice(7)] = f.value;
    }
    return headers;
  }
  if (ref.startsWith('tf-output:')) {
    const [, dir, output] = ref.split(':');
    return JSON.parse(exec('terraform', [`-chdir=${dir}`, 'output', '-json', output]));
  }
  throw new Error('credential references accept only op:// or tf-output: forms');
}

export function accessToken(serviceAccount, { exec = defaultExec } = {}) {
  const args = ['auth', 'print-access-token'];
  if (serviceAccount) args.push(`--impersonate-service-account=${serviceAccount}`);
  return exec('gcloud', args).trim();
}

// `gcloud auth print-access-token` has no --scopes flag and an impersonated token only carries cloud-platform,
// which the Analytics, Tag Manager and Search Console APIs reject. With a service account, mint the token through
// the IAM Credentials API with explicit scopes, authenticated by the operator's own gcloud login.
// tagmanager.publish is never requested: the plugin cannot publish a container.
const G = 'https://www.googleapis.com/auth/';
export const GOOGLE_SCOPES = {
  read: [`${G}webmasters.readonly`, `${G}analytics.readonly`, `${G}tagmanager.readonly`],
  write: [`${G}webmasters`, `${G}siteverification`, `${G}analytics.edit`, `${G}tagmanager.edit.containers`, `${G}tagmanager.edit.containerversions`],
};

export async function googleToken(serviceAccount, scopes, { exec = defaultExec, fetchImpl = fetch } = {}) {
  if (!serviceAccount) return accessToken('', { exec });
  const base = exec('gcloud', ['auth', 'print-access-token']).trim();
  const url = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(serviceAccount)}:generateAccessToken`;
  const res = await fetchImpl(url, { method: 'POST', headers: { Authorization: `Bearer ${base}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: scopes, lifetime: '3600s' }) });
  if (!res.ok) throw new Error(`generateAccessToken HTTP ${res.status} for ${serviceAccount}`);
  const { accessToken: token } = await res.json();
  if (!token) throw new Error(`generateAccessToken returned no token for ${serviceAccount}`);
  return token;
}
