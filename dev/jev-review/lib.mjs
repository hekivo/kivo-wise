/**
 * Shared helpers for the Jev review harness (dev tooling, never loaded by the plugin).
 *
 * The TypeSafe key is read from process.env.TYPESAFE_API_KEY inside this process only. It is
 * never printed, logged or written; error text is passed through redact() before it is shown.
 */

import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '..', '..');
export const RESULTS = join(HERE, 'results');
export const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
export const MODEL = process.env.JEV_MODEL || 'jev-1.13.0';
/** Price per input token in USD (docs.typesafe.ai/models: $0.042 per Mtok input, output free). */
export const USD_PER_INPUT_TOKEN = 0.042 / 1e6;

const KEY_NAME = 'TYPESAFE_API_KEY';

export function redact(text) {
  const key = process.env[KEY_NAME];
  let out = String(text ?? '');
  if (key) out = out.split(key).join('[REDACTED]');
  return out.replace(/Bearer\s+[A-Za-z0-9._\-]+/g, 'Bearer [REDACTED]');
}

export function requireKey() {
  if (!process.env[KEY_NAME]) {
    console.error(`${KEY_NAME} is not set. This harness is optional; see dev/jev-review/README.md.`);
    process.exit(2);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * POST one System One request. Retries 429/529/5xx with exponential backoff (honours retry-after).
 * Appends usage to results/usage.jsonl as { at, tag, questions, input_tokens, output_tokens }.
 */
export async function ask(state, questions, { tag = 'misc', retries = 5 } = {}) {
  const body = JSON.stringify({ model: MODEL, state, questions });
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env[KEY_NAME]}`, 'Content-Type': 'application/json' },
        body,
      });
    } catch (error) {
      if (attempt >= retries) throw new Error(redact(`network error: ${error.message}`));
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (res.ok) {
      const json = await res.json();
      recordUsage(tag, Object.keys(questions).length, json.usage, json.model);
      return json;
    }
    const retryable = res.status === 429 || res.status === 529 || res.status >= 500;
    const text = redact(await res.text().catch(() => ''));
    if (!retryable || attempt >= retries) throw new Error(`TypeSafe ${res.status}: ${text.slice(0, 500)}`);
    const after = Number(res.headers.get('retry-after'));
    await sleep(Number.isFinite(after) && after > 0 ? after * 1000 : 1000 * 2 ** attempt);
  }
}

function recordUsage(tag, questions, usage = {}, model = '') {
  mkdirSync(RESULTS, { recursive: true });
  appendFileSync(
    join(RESULTS, 'usage.jsonl'),
    `${JSON.stringify({ at: new Date().toISOString(), tag, model, questions, input_tokens: usage.input_tokens ?? 0, output_tokens: usage.output_tokens ?? 0 })}\n`,
  );
}

/** Run async fn over items with at most `limit` in flight. */
export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Minimal frontmatter reader: returns { data, body } with single-line scalar values. */
export function readFrontmatter(file) {
  const text = readFileSync(file, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text, text };
  const data = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s?(.*)$/);
    if (kv) data[kv[1]] = kv[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return { data, body: m[2], text };
}

/** The plugin's own skills (skills/<name>/SKILL.md), sorted by name. */
export function loadSkills() {
  const dir = join(ROOT, 'skills');
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'SKILL.md')))
    .map((d) => {
      const file = join(dir, d.name, 'SKILL.md');
      const { data, body, text } = readFrontmatter(file);
      return { name: data.name || d.name, description: data.description || '', body, text, file };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Deterministic shuffle (mulberry32 seeded by a string) to spread Choice option-order bias. */
export function seededShuffle(list, seedText) {
  let h = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i++) {
    h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function writeResult(name, data) {
  mkdirSync(RESULTS, { recursive: true });
  const file = join(RESULTS, name);
  writeFileSync(file, typeof data === 'string' ? data : `${JSON.stringify(data, null, 2)}\n`);
  return file;
}

export function argValue(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
