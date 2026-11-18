import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PLUGIN = join(ROOT, 'plugins', 'kivo-rebuild');
export const FIX = join(ROOT, 'test', 'fixtures', 'rebuild');
export const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
export const tmpProject = () => mkdtempSync(join(tmpdir(), 'rebuild-'));
export function run(script, args = [], { cwd = ROOT, env = {} } = {}) {
  const r = spawnSync(process.execPath, [join(PLUGIN, 'scripts', script), ...args], { cwd, env: { ...process.env, ...env }, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
