// plugins/kivo-rebuild/scripts/lib/credentials.mjs
import { spawnSync } from 'node:child_process';

export function defaultExec(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
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
