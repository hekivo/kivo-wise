// test/creator/helpers.mjs
import { mkdtempSync, cpSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PLUGIN = join(ROOT, 'plugins', 'kivo-creator');
export const FIX = join(ROOT, 'test', 'fixtures', 'creator');

export const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

export function tmpCopy(src) {
  const dir = mkdtempSync(join(tmpdir(), 'creator-'));
  cpSync(src, dir, { recursive: true });
  return dir;
}

let seq = 0;
/** Snapshot node as produced by scripts/lib/collect.mjs. */
export function n(tag, rect, children = [], extra = {}) {
  seq += 1;
  return {
    tag,
    path: `${tag}:nth-of-type(${seq})`,
    cls: [],
    visible: true,
    text: '',
    attrs: {},
    style: {},
    ...extra,
    rect,
    children,
  };
}
export const r = (y, h, x = 0, w = 1440) => ({ x, y, w, h });

export const validSpec = () => ({
  id: '01-hero',
  order: 0,
  source: { kind: 'html', ref: 'body > main > section:nth-of-type(1)' },
  kind: 'hero',
  slots: [
    { name: 'heading', type: 'heading', value: 'Acme ships faster', provenance: 'exact' },
    { name: 'items', type: 'list', provenance: 'exact', items: [[{ name: 'text', type: 'text', value: 'One', provenance: 'exact' }]] },
  ],
  layout: { columns: 1, align: 'left', media: 'right', repeat: 0 },
  tokens: [{ role: 'heading', prop: 'color', value: 'rgb(17, 24, 39)', token: '--color-ink', provenance: 'exact' }],
  refs: { 1440: 'refs/01-hero-1440.png' },
});
