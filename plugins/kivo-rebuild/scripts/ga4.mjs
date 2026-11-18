#!/usr/bin/env node
// plugins/kivo-rebuild/scripts/ga4.mjs
import { join } from 'node:path';
import { parseOptions, runCli } from './lib/args.mjs';
import { googleToken, GOOGLE_SCOPES } from './lib/credentials.mjs';
import { normalizePath } from './lib/paths.mjs';
import { reportUrl } from './lib/providers/ga4.mjs';
import { latestRun, readDoc, rebuildDir, runDir } from './lib/state.mjs';
import { mergeSignals, period } from './lib/signals.mjs';

export async function fromApi({ propertyId, token, start, end, fetchImpl = fetch }) {
  const out = new Map();
  for (let offset = 0; ; offset += 100000) {
    const res = await fetchImpl(reportUrl(propertyId), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateRanges: [{ startDate: start, endDate: end }], dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'sessions' }, { name: 'keyEvents' }], limit: 100000, offset }),
    });
    if (!res.ok) throw new Error(`GA4 Data API HTTP ${res.status}`);
    const body = await res.json();
    for (const r of body.rows ?? []) {
      const path = normalizePath(r.dimensionValues[0].value);
      const prev = out.get(path) ?? { sessions: 0, conversions: 0 };
      out.set(path, { sessions: prev.sessions + Number(r.metricValues[0].value), conversions: prev.conversions + Math.round(Number(r.metricValues[1].value)) });
    }
    if (offset + 100000 >= (body.rowCount ?? 0)) break;
  }
  return out;
}

export async function main(argv) {
  const o = parseOptions(argv, { project: '.', run: '', months: '16' });
  const runId = o.run || latestRun(o.project);
  if (!runId) throw new Error('no run found: crawl the sitemap first or pass --run=<id>');
  const config = readDoc(join(rebuildDir(o.project), 'config.json')) ?? {};
  if (!config.ga4?.property_id) throw new Error('config.ga4.property_id missing');
  const { start, end } = period(Number(o.months));
  const data = await fromApi({ propertyId: config.ga4.property_id, token: await googleToken(config.ga4.service_account ?? config.gsc?.service_account, GOOGLE_SCOPES.read), start, end });
  mergeSignals(runDir(o.project, runId), runId, 'ga4', data, { period: `${start}..${end}`, path: 'api', rows: data.size });
  console.log(`ga4: ${data.size} pages (${start}..${end})`);
}

runCli(import.meta.url, main);
