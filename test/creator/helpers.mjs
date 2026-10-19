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
