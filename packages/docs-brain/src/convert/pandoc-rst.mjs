// reStructuredText -> GFM through pandoc when it is installed; otherwise a note and a skip.
import { spawnSync } from 'node:child_process';

const availability = new Map();

export function pandocAvailable(bin = 'pandoc') {
  if (availability.has(bin)) return availability.get(bin);
  const r = spawnSync(bin, ['--version'], { encoding: 'utf8' });
  const ok = !r.error && r.status === 0;
  availability.set(bin, ok);
  return ok;
}

export function convertRst(text, { pandocBin = 'pandoc' } = {}) {
  if (!pandocAvailable(pandocBin)) {
    return { markdown: null, note: 'pandoc not available; rst pages skipped (install pandoc to convert them)' };
  }
  const r = spawnSync(pandocBin, ['-f', 'rst', '-t', 'gfm', '--wrap=none'], { input: text, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) return { markdown: null, note: `pandoc failed: ${(r.stderr || '').trim().slice(0, 200)}` };
  return { markdown: r.stdout, note: null };
}
