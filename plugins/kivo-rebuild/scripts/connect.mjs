#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/connect.mjs
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { accessToken, defaultExec } from './lib/credentials.mjs';
import { readDoc, rebuildDir, writeDoc, ensureGitignore } from './lib/state.mjs';
import * as gsc from './lib/providers/gsc.mjs';
import * as ga4 from './lib/providers/ga4.mjs';
import * as gtm from './lib/providers/gtm.mjs';
import * as cloudflare from './lib/providers/cloudflare.mjs';
import * as pagespeed from './lib/providers/pagespeed.mjs';

export const PROVIDERS = [gsc, ga4, gtm, cloudflare, pagespeed];
const MANUAL = ['bing', 'rdstation', 'merchant'];

export function detect({ exec = defaultExec, project = '.' } = {}) {
  const has = (cmd) => { try { exec(cmd, ['--version']); return true; } catch { return false; } };
  return { gcloud: has('gcloud'), gh: has('gh'), op: has('op'), playwright: existsSync(join(project, 'node_modules', '@playwright', 'test')) };
}

export async function testAll({ config, providers = PROVIDERS, exec = defaultExec, fetchImpl = fetch, mcp = [], env = process.env }) {
  const items = [];
  const tokens = new Map();
  const now = () => new Date().toISOString();
  for (const p of providers) {
    if (mcp.includes(p.id)) { items.push({ source: p.id, path: 'mcp', ok: true, identity: 'mcp', tested_at: now() }); continue; }
    if (!p.configured(config)) { items.push({ source: p.id, path: 'none', ok: false, error: 'not configured', tested_at: now() }); continue; }
    let token = '';
    if (p.usesGoogleToken !== false) {
      const sa = config[p.id]?.service_account ?? config.gsc?.service_account ?? '';
      try {
        if (!tokens.has(sa)) tokens.set(sa, accessToken(sa, { exec }));
        token = tokens.get(sa);
      } catch (e) {
        items.push({ source: p.id, path: 'api', ok: false, identity: sa || 'gcloud user', error: `${e.message}: run gcloud auth login (and grant roles/iam.serviceAccountTokenCreator on ${sa || 'the service account'})`, tested_at: now() });
        continue;
      }
    }
    let r;
    try { r = await p.readTest({ config, token, fetchImpl, env }); } catch (e) { r = { ok: false, identity: '', error: String(e.message).replace(/([?&](key|token|access_token)=)[^&\s]+/gi, '$1<redacted>').slice(0, 200) }; }
    items.push({ source: p.id, path: 'api', ok: r.ok, identity: r.identity ?? '', ...(r.error ? { error: r.error } : {}), tested_at: now() });
  }
  return items;
}

export async function main(argv) {
  const o = parseOptions(argv, { project: '.', check: false, mcp: '', only: '' });
  const config = readDoc(join(rebuildDir(o.project), 'config.json'));
  if (!config) throw new Error('.rebuild/config.json missing: the connect skill writes it first');
  ensureGitignore(o.project);
  const only = o.only ? o.only.split(',') : null;
  const providers = PROVIDERS.filter((p) => !only || only.includes(p.id));
  const items = await testAll({ config, providers, mcp: o.mcp ? o.mcp.split(',') : [] });
  const tools = detect({ project: o.project });
  items.push({ source: 'playwright', path: tools.playwright ? 'api' : 'none', ok: tools.playwright, tested_at: new Date().toISOString(), ...(tools.playwright ? {} : { error: 'install @playwright/test in the project' }) });
  for (const m of MANUAL) if (config[m]) items.push({ source: m, path: 'manual', ok: true, identity: 'export', tested_at: new Date().toISOString() });
  writeDoc(join(rebuildDir(o.project), 'connections.json'), 'connections', { items, tools });
  for (const i of items) console.log(`${i.source} ${i.path} ${i.ok ? 'ok' : 'FAIL'} ${i.ok ? i.identity ?? '' : i.error}`);
  if (items.some((i) => !i.ok && i.path !== 'none')) process.exitCode = 1;
}

runCli(import.meta.url, main);
