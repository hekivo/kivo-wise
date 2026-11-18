// plugins/kivo-rebuild/scripts/lib/state.mjs
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './schema.mjs';

const SCHEMAS = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'schemas');
export const KINDS = ['config', 'connections', 'urls', 'signals', 'inventory', 'templates', 'features', 'parity', 'setup-plan'];
const cache = new Map();
export function schemaFor(kind) {
  if (!KINDS.includes(kind)) throw new Error(`unknown kind ${kind}`);
  if (!cache.has(kind)) cache.set(kind, JSON.parse(readFileSync(join(SCHEMAS, `${kind}.schema.json`), 'utf8')));
  return cache.get(kind);
}

export const rebuildDir = (project) => join(resolve(project), '.rebuild');
export const runDir = (project, runId) => join(rebuildDir(project), 'runs', runId);

export function newRunId(slug, date = new Date()) {
  const s = String(slug).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${date.toISOString().slice(0, 10)}-${s}`;
}

export function latestRun(project) {
  const dir = join(rebuildDir(project), 'runs');
  if (!existsSync(dir)) return null;
  const ids = readdirSync(dir).filter((d) => /^\d{4}-\d{2}-\d{2}-/.test(d)).sort();
  return ids.at(-1) ?? null;
}

export function readDoc(file) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

export function checkDoc(kind, doc) {
  return validate(schemaFor(kind), doc);
}

export function writeDoc(file, kind, body, { runId } = {}) {
  const doc = { schema_version: 1, kind, ...(runId ? { run_id: runId } : {}), generated_at: new Date().toISOString(), ...body };
  const errors = checkDoc(kind, doc);
  if (errors.length) throw new Error(`${file}: ${errors.slice(0, 20).join('; ')}`);
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(doc, null, 2) + '\n');
  renameSync(tmp, file);
  return doc;
}

export function ensureGitignore(project) {
  mkdirSync(rebuildDir(project), { recursive: true });
  writeFileSync(join(rebuildDir(project), '.gitignore'), '*\n');
}
