// plugins/kivo-rebuild/scripts/lib/signals.mjs
import { join } from 'node:path';
import { readDoc, writeDoc } from './state.mjs';

export function period(months, today = new Date()) {
  const end = new Date(today.getTime() - 2 * 86400000);
  const start = new Date(end);
  start.setMonth(start.getMonth() - months);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

const FIELDS = { gsc: ['clicks', 'impressions', 'ctr', 'position'], ga4: ['sessions', 'conversions'] };

/** Replaces one source's fields and `sources` entry in signals.json; the other source is kept. */
export function mergeSignals(dir, runId, source, data, meta) {
  const file = join(dir, 'signals.json');
  const doc = readDoc(file) ?? { items: [], sources: { gsc: null, ga4: null } };
  const byPath = new Map(doc.items.map((i) => [i.path, i]));
  for (const item of byPath.values()) for (const f of FIELDS[source]) delete item[f];
  for (const [path, values] of data) byPath.set(path, { ...(byPath.get(path) ?? { path }), ...values });
  const items = [...byPath.values()].filter((i) => Object.keys(i).length > 1);
  writeDoc(file, 'signals', { items, sources: { ...doc.sources, [source]: meta } }, { runId });
}
