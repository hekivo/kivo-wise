// state/lock.json: resolved versions, upstream markers and page hashes per source.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { ensureDir, nowIso } from './util.mjs';

export const LOCK_FILE = 'lock.json';

export function emptyLock() {
  return { version: 1, generated_at: null, sources: {} };
}

export function readLock(stateDir) {
  const file = join(stateDir, LOCK_FILE);
  if (!existsSync(file)) return emptyLock();
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    return { ...emptyLock(), ...data, sources: data.sources ?? {} };
  } catch {
    return emptyLock();
  }
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, sortKeys(value[k])]),
    );
  }
  return value;
}

export function writeLock(stateDir, lock) {
  ensureDir(stateDir);
  const out = { ...lock, generated_at: nowIso() };
  writeFileSync(join(stateDir, LOCK_FILE), JSON.stringify(sortKeys(out), null, 2) + '\n');
}

/** Where a corpus root keeps its state: sibling `state/` when the root is named like corpus_dir (kivo-wisdom layout), `.state/` inside otherwise. */
export function stateDirFor(corpusDir, manifest) {
  const corpusName = manifest?.corpusDir ?? 'corpus';
  if (basename(corpusDir) === corpusName) return join(dirname(corpusDir), 'state');
  return join(corpusDir, '.state');
}
