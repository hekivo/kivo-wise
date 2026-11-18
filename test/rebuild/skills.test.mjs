import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PLUGIN } from './helpers.mjs';

const SKILLS = ['rebuild', 'connect', 'site-survey', 'search-signals', 'url-inventory', 'template-map', 'legacy-features', 'parity-audit', 'review-board'];
const AGENTS = { 'legacy-area-inventory': 'sonnet', 'parity-auditor': 'opus', 'template-sampler': 'haiku', 'setup-planner': 'opus' };

const AGENT_FILES = () => Object.keys(AGENTS).map((n) => join(PLUGIN, 'agents', `${n}.md`));

function markdownIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? markdownIn(join(dir, e.name)) : e.name.endsWith('.md') ? [join(dir, e.name)] : []));
}

test('every skill exists and every script it names exists', () => {
  for (const s of SKILLS) {
    const files = markdownIn(join(PLUGIN, 'skills', s));
    assert.ok(files.some((f) => f.endsWith('SKILL.md')), `${s}: SKILL.md`);
    for (const f of files) {
      const md = readFileSync(f, 'utf8');
      for (const m of md.matchAll(/scripts\/([a-z0-9-]+\.mjs)/g)) assert.ok(existsSync(join(PLUGIN, 'scripts', m[1])), `${f}: scripts/${m[1]}`);
    }
  }
});

test('agents declare their model and tools', () => {
  for (const [name, model] of Object.entries(AGENTS)) {
    const md = readFileSync(join(PLUGIN, 'agents', `${name}.md`), 'utf8');
    assert.match(md, new RegExp(`^name: ${name}$`, 'm'));
    assert.match(md, new RegExp(`^model: ${model}$`, 'm'));
    assert.match(md, /^tools: /m);
    for (const m of md.matchAll(/scripts\/([a-z0-9-]+\.mjs)/g)) assert.ok(existsSync(join(PLUGIN, 'scripts', m[1])), `${name}: scripts/${m[1]}`);
  }
});

test('setup actions shown in references and agents are valid plan actions', async () => {
  const { PROVIDERS, checkActions } = await import('../../plugins/kivo-rebuild/scripts/setup-plan.mjs');
  const files = [...markdownIn(join(PLUGIN, 'skills', 'connect', 'references')), ...AGENT_FILES()];
  let seen = 0;
  for (const f of files) {
    for (const m of readFileSync(f, 'utf8').matchAll(/```json\n([\s\S]*?)```/g)) {
      const doc = JSON.parse(m[1]);
      const actions = doc.actions ?? (doc.provider ? [doc] : []);
      for (const a of actions) {
        seen += 1;
        const op = PROVIDERS[a.provider]?.actions?.[a.op];
        assert.ok(op, `${f}: ${a.provider}.${a.op} is not an operation`);
        assert.deepEqual(op.validate(a.params), [], `${f}: ${a.id} params`);
      }
    }
  }
  assert.ok(seen >= 4, 'the references and the planner agent show example actions');
  // The documented order for a domain property: a reference may only name an earlier action.
  const base = { resource: 'example.test', change: 'c', undo: 'u' };
  const plan = [
    { id: 'A1', provider: 'gsc', op: 'verificationToken', params: { domain: 'example.test' }, ...base },
    { id: 'A2', provider: 'cloudflare', op: 'createTxtRecord', params: { zone: 'z', name: 'example.test', content: { $from: 'A1.token' } }, ...base },
  ];
  assert.deepEqual(checkActions(plan), []);
  assert.match(checkActions([plan[1]]).join(), /must name an earlier action/);
});

test('connect has one reference per source', () => {
  const refs = readdirSync(join(PLUGIN, 'skills', 'connect', 'references')).sort();
  assert.deepEqual(refs, ['bing-webmaster.md', 'cloudflare.md', 'ga4.md', 'gsc.md', 'gtm.md', 'merchant-center.md', 'pagespeed-crux.md', 'playwright.md', 'rd-station.md']);
});
