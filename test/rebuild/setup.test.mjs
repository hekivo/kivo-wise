import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkActions, planHash, renderPlan } from '../../plugins/kivo-rebuild/scripts/setup-plan.mjs';
import { applyPlan, checkApproval, resolveRefs } from '../../plugins/kivo-rebuild/scripts/setup-apply.mjs';
import * as gtm from '../../plugins/kivo-rebuild/scripts/lib/providers/gtm.mjs';
import * as ga4 from '../../plugins/kivo-rebuild/scripts/lib/providers/ga4.mjs';
import * as gsc from '../../plugins/kivo-rebuild/scripts/lib/providers/gsc.mjs';
import * as cloudflare from '../../plugins/kivo-rebuild/scripts/lib/providers/cloudflare.mjs';
import { readJson, run, tmpProject } from './helpers.mjs';

const actions = [
  { id: 'A1', provider: 'gtm', op: 'createWorkspace', resource: 'container 1', params: { container: 'accounts/1/containers/2', name: 'rebuild' }, change: 'new workspace', undo: 'delete workspace rebuild' },
  { id: 'A2', provider: 'gtm', op: 'createVersion', resource: 'workspace', params: { workspace: 'accounts/1/containers/2/workspaces/9', name: 'v1' }, change: 'version, not published', undo: 'delete version v1' },
];

test('hash is stable and ignores status', () => {
  const h = planHash(actions);
  assert.equal(planHash(actions.map((a) => ({ ...a, status: 'applied' }))), h);
  assert.notEqual(planHash([{ ...actions[0], params: { ...actions[0].params, name: 'other' } }, actions[1]]), h);
  assert.match(renderPlan({ hash: h, actions }), /\| A1 \| gtm \| createWorkspace/);
});

test('hash does not depend on key order inside params', () => {
  const a = [{ ...actions[0], params: { container: 'c', name: 'n' } }];
  const b = [{ ...actions[0], params: { name: 'n', container: 'c' } }];
  assert.equal(planHash(a), planHash(b));
});

test('approval must match the stored and recomputed hash', () => {
  const plan = { hash: planHash(actions), actions };
  assert.doesNotThrow(() => checkApproval(plan, plan.hash));
  assert.throws(() => checkApproval(plan, 'nope'), /does not match/);
  const edited = { hash: plan.hash, actions: [{ ...actions[0], params: { ...actions[0].params, name: 'hand-edit' } }, actions[1]] };
  assert.throws(() => checkApproval(edited, plan.hash), /plan changed after approval/);
});

test('stops at the first failure and lists undo steps of applied actions', async () => {
  const fetchImpl = async (url) => (url.endsWith(':create_version') ? new Response('{}', { status: 400 }) : new Response(JSON.stringify({ path: 'accounts/1/containers/2/workspaces/9' }), { status: 200 }));
  const plan = { hash: planHash(actions), actions: structuredClone(actions) };
  const out = await applyPlan(plan, { providers: { gtm }, token: 't', fetchImpl });
  assert.equal(plan.actions[0].status, 'applied');
  assert.equal(plan.actions[1].status, 'failed');
  assert.deepEqual(out.undo, ['delete workspace rebuild']);
  assert.equal(out.failed, 'A2');
});

test('already applied actions are skipped on a second apply', async () => {
  const calls = [];
  const fetchImpl = async (url) => { calls.push(url); return new Response(JSON.stringify({ path: 'p', containerVersion: { path: 'v' } }), { status: 200 }); };
  const plan = { hash: planHash(actions), actions: structuredClone(actions) };
  plan.actions[0].status = 'applied';
  const out = await applyPlan(plan, { providers: { gtm }, token: 't', fetchImpl });
  assert.equal(calls.length, 1);
  assert.match(calls[0], /:create_version$/);
  assert.equal(out.failed, null);
  assert.deepEqual(out.undo, ['delete version v1', 'delete workspace rebuild']);
});

test('tag manager has no publish operation', () => {
  assert.equal(Object.keys(gtm.actions).some((k) => /publish/i.test(k)), false);
});

test('checkActions rejects unknown providers, unknown operations and missing params', () => {
  const errors = checkActions([
    { id: 'X1', provider: 'bing', op: 'x', params: {} },
    { id: 'X2', provider: 'gtm', op: 'publish', params: {} },
    { id: 'X3', provider: 'gtm', op: 'createWorkspace', params: { container: 'c' } },
  ]);
  assert.equal(errors.length, 3);
  assert.match(errors[0], /unknown provider bing/);
  assert.match(errors[1], /no operation publish/);
  assert.match(errors[2], /params\.name is required/);
  assert.deepEqual(checkActions(actions), []);
});

function recorder(responses = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : null, auth: init.headers?.Authorization });
    return new Response(JSON.stringify(responses[url.split('?')[0]] ?? {}), { status: 200 });
  };
  return { calls, fetchImpl };
}

test('ga4 operations call the Admin API with the documented bodies', async () => {
  const r = recorder({
    'https://analyticsadmin.googleapis.com/v1beta/properties': { name: 'properties/77' },
    'https://analyticsadmin.googleapis.com/v1beta/properties/77/dataStreams': { name: 'properties/77/dataStreams/5', webStreamData: { measurementId: 'G-TEST0001' } },
    'https://analyticsadmin.googleapis.com/v1beta/properties/77/keyEvents': { name: 'properties/77/keyEvents/3' },
  });
  const ctx = { token: 'tok', fetchImpl: r.fetchImpl };
  assert.deepEqual(await ga4.actions.createProperty.apply({ account: '12', displayName: 'Acme Store', timeZone: 'America/Sao_Paulo', currencyCode: 'BRL' }, ctx), { property: 'properties/77' });
  assert.deepEqual(r.calls[0].body, { parent: 'accounts/12', displayName: 'Acme Store', timeZone: 'America/Sao_Paulo', currencyCode: 'BRL' });
  assert.equal(r.calls[0].auth, 'Bearer tok');
  assert.deepEqual(await ga4.actions.createWebStream.apply({ property: 'properties/77', displayName: 'web', defaultUri: 'https://example.test' }, ctx), { stream: 'properties/77/dataStreams/5', measurementId: 'G-TEST0001' });
  assert.deepEqual(r.calls[1].body, { type: 'WEB_DATA_STREAM', displayName: 'web', webStreamData: { defaultUri: 'https://example.test' } });
  assert.deepEqual(await ga4.actions.createKeyEvent.apply({ property: 'properties/77', eventName: 'purchase' }, ctx), { keyEvent: 'properties/77/keyEvents/3' });
  assert.deepEqual(r.calls[2].body, { eventName: 'purchase' });
});

test('search console operations encode the property and sitemap in the path', async () => {
  const r = recorder({ 'https://www.googleapis.com/siteVerification/v1/token': { token: 'gsv-abc' } });
  const ctx = { token: 'tok', fetchImpl: r.fetchImpl };
  assert.deepEqual(await gsc.actions.verificationToken.apply({ domain: 'example.test' }, ctx), { token: 'gsv-abc' });
  assert.deepEqual(r.calls[0].body, { site: { type: 'INET_DOMAIN', identifier: 'example.test' }, verificationMethod: 'DNS_TXT' });
  await gsc.actions.verify.apply({ domain: 'example.test' }, ctx);
  assert.equal(r.calls[1].url, 'https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=DNS_TXT');
  await gsc.actions.addSite.apply({ property: 'sc-domain:example.test' }, ctx);
  assert.equal(r.calls[2].method, 'PUT');
  assert.equal(r.calls[2].url, 'https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Aexample.test');
  await gsc.actions.submitSitemap.apply({ property: 'sc-domain:example.test', sitemap: 'https://example.test/sitemap.xml' }, ctx);
  assert.equal(r.calls[3].url, 'https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Aexample.test/sitemaps/https%3A%2F%2Fexample.test%2Fsitemap.xml');
});

test('cloudflare stores the access token value in 1Password through stdin, never argv or a file', async () => {
  const r = { calls: [] };
  const value = 'placeholder-value-for-test';
  const fetchImpl = async (url, init) => {
    r.calls.push({ url, auth: init.headers.Authorization, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ success: true, result: { client_id: 'abc.access', client_secret: value } }), { status: 200 });
  };
  const execCalls = [];
  const exec = (cmd, args, opts = {}) => { execCalls.push({ cmd, args, item: JSON.parse(opts.input) }); return ''; };
  const result = await cloudflare.actions.createAccessServiceToken.apply({ account: 'acc1', name: 'acme-staging', vault: 'acme-vault' }, { fetchImpl, env: { CLOUDFLARE_API_TOKEN: 'cf' }, exec });
  assert.deepEqual(result, { client_id: 'abc.access', stored: 'op://acme-vault/acme-staging' });
  assert.equal(JSON.stringify(result).includes(value), false);
  assert.equal(r.calls[0].body.duration, '8760h');
  assert.equal(execCalls.length, 1);
  const [c] = execCalls;
  assert.equal(c.cmd, 'op');
  assert.deepEqual(c.args, ['item', 'create', '--vault', 'acme-vault', '-']);
  assert.equal(c.item.title, 'acme-staging');
  assert.deepEqual(c.item.fields.map((f) => f.label), ['CF-Access-Client-Id', 'CF-Access-Client-Secret']);
  assert.equal(c.item.fields[1].type, 'CONCEALED');
});

test('cloudflare reports the orphaned token when storing it fails', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ success: true, result: { client_id: 'abc.access', client_secret: 'placeholder' } }), { status: 200 });
  const exec = () => { throw new Error('op item failed (exit 1)'); };
  await assert.rejects(cloudflare.actions.createAccessServiceToken.apply({ account: 'acc1', name: 'n', vault: 'v' }, { fetchImpl, env: { CLOUDFLARE_API_TOKEN: 't' }, exec }), /abc\.access was created but not stored.*delete it/);
});

test('cloudflare dns record uses a 300 second TTL', async () => {
  const bodies = [];
  const fetchImpl = async (url, init) => { bodies.push({ url, body: JSON.parse(init.body) }); return new Response(JSON.stringify({ success: true, result: { id: 'rec1' } }), { status: 200 }); };
  const out = await cloudflare.actions.createTxtRecord.apply({ zone: 'z1', name: 'example.test', content: 'gsv-abc' }, { fetchImpl, env: { CLOUDFLARE_API_TOKEN: 'cf' } });
  assert.deepEqual(out, { record: 'rec1' });
  assert.equal(bodies[0].url, 'https://api.cloudflare.com/client/v4/zones/z1/dns_records');
  assert.deepEqual(bodies[0].body, { type: 'TXT', name: 'example.test', content: 'gsv-abc', ttl: 300 });
});

function projectWithInput(input) {
  const project = tmpProject();
  const runId = '2026-11-18-acme';
  const dir = join(project, '.rebuild', 'runs', runId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'setup-input.json'), JSON.stringify(input));
  return { project, runId, dir };
}

test('setup-plan writes a validated plan with the hash and a review table', () => {
  const { project, dir } = projectWithInput({ actions });
  const r = run('setup-plan.mjs', [`--project=${project}`]);
  assert.equal(r.code, 0, r.stderr);
  const plan = readJson(join(dir, 'setup-plan.json'));
  assert.equal(plan.kind, 'setup-plan');
  assert.equal(plan.hash, planHash(actions));
  assert.ok(plan.actions.every((a) => a.status === 'planned'));
  const md = readFileSync(join(dir, 'setup-plan.md'), 'utf8');
  assert.match(md, new RegExp(plan.hash));
  assert.match(md, /\| A2 \| gtm \| createVersion/);
});

test('setup-plan refuses an input with an unknown operation and writes nothing', () => {
  const { project, dir } = projectWithInput({ actions: [{ ...actions[0], op: 'publish' }] });
  const r = run('setup-plan.mjs', [`--project=${project}`]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /no operation publish/);
  assert.throws(() => readFileSync(join(dir, 'setup-plan.json')));
});

test('setup-apply refuses a missing approval and a plan edited by hand', () => {
  const { project, dir } = projectWithInput({ actions });
  assert.equal(run('setup-plan.mjs', [`--project=${project}`]).code, 0);
  const file = join(dir, 'setup-plan.json');
  const plan = readJson(file);

  const none = run('setup-apply.mjs', [`--project=${project}`]);
  assert.equal(none.code, 1);
  assert.match(none.stderr, /does not match/);

  plan.actions[0].params.name = 'hand-edit';
  writeFileSync(file, JSON.stringify(plan));
  const edited = run('setup-apply.mjs', [`--project=${project}`, `--approved=${plan.hash}`]);
  assert.equal(edited.code, 1);
  assert.match(edited.stderr, /plan changed after approval/);
  assert.equal(readJson(file).actions[0].status, 'planned');
});

test('$from params resolve from earlier results at apply time and are checked at plan time', async () => {
  const seen = [];
  const providers = { fake: { actions: {
    make: { validate: () => [], apply: async () => ({ property: 'properties/42' }) },
    use: { validate: () => [], apply: async (p) => { seen.push(p); return { ok: true }; } },
  } } };
  const plan = { actions: [
    { id: 'A1', provider: 'fake', op: 'make', params: {}, undo: 'u1', status: 'planned' },
    { id: 'A2', provider: 'fake', op: 'use', params: { parent: { $from: 'A1.property' }, name: 'web' }, undo: 'u2', status: 'planned' },
  ] };
  const out = await applyPlan(plan, { providers, token: 't' });
  assert.equal(out.failed, null);
  assert.deepEqual(seen, [{ parent: 'properties/42', name: 'web' }]);
  assert.throws(() => resolveRefs({ x: { $from: 'A9.y' } }, new Map()), /A9 has not been applied/);
  assert.throws(() => resolveRefs({ x: { $from: 'A1.missing' } }, new Map([['A1', {}]])), /no such value/);
  const errors = checkActions([
    { id: 'A1', provider: 'cloudflare', op: 'createTxtRecord', params: { zone: 'z', name: 'n', content: { $from: 'A2.token' } } },
    { id: 'A2', provider: 'cloudflare', op: 'createTxtRecord', params: { zone: 'z', name: 'n', content: 'c' } },
  ]);
  assert.deepEqual(errors, ['A1: $from A2.token must name an earlier action']);
});

test('google tokens for a service account are minted with explicit scopes and never ask to publish', async () => {
  const { googleToken, GOOGLE_SCOPES } = await import('../../plugins/kivo-rebuild/scripts/lib/credentials.mjs');
  const calls = [];
  const exec = (cmd, args) => { calls.push([cmd, ...args].join(' ')); return 'operator-token\n'; };
  const fetchImpl = async (url, init) => { calls.push({ url, auth: init.headers.Authorization, body: JSON.parse(init.body) }); return new Response(JSON.stringify({ accessToken: 'scoped' }), { status: 200 }); };
  const tok = await googleToken('reader@acme-proj.iam.example.test', GOOGLE_SCOPES.write, { exec, fetchImpl });
  assert.equal(tok, 'scoped');
  assert.equal(calls[0], 'gcloud auth print-access-token');
  assert.match(calls[1].url, /iamcredentials\.googleapis\.com\/v1\/projects\/-\/serviceAccounts\/reader%40acme-proj\.iam\.example\.test:generateAccessToken$/);
  assert.equal(calls[1].auth, 'Bearer operator-token');
  assert.deepEqual(calls[1].body.scope, GOOGLE_SCOPES.write);
  assert.equal([...GOOGLE_SCOPES.read, ...GOOGLE_SCOPES.write].some((s) => s.includes('publish')), false);
  const bad = async () => new Response('{}', { status: 403 });
  await assert.rejects(googleToken('reader@acme-proj.iam.example.test', GOOGLE_SCOPES.read, { exec, fetchImpl: bad }), /HTTP 403/);
});
