// test/rebuild/connect.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testAll } from '../../plugins/kivo-rebuild/scripts/connect.mjs';
import * as gsc from '../../plugins/kivo-rebuild/scripts/lib/providers/gsc.mjs';
import * as ga4 from '../../plugins/kivo-rebuild/scripts/lib/providers/ga4.mjs';

const config = { gsc: { property: 'sc-domain:example.test', service_account: 'reader@acme-proj.iam.example.test' }, ga4: { property_id: '123', service_account: 'reader@acme-proj.iam.example.test' } };
const exec = (cmd, args) => { if (cmd === 'gcloud' && args[1] === 'print-access-token') return 'tok\n'; return 'v1'; };

test('gsc ok, ga4 403 explains the human step, unconfigured is none', async () => {
  const fetchImpl = async (url, init) => {
    assert.equal(init.headers.Authorization, 'Bearer tok');
    if (url.includes('searchconsole')) return new Response(JSON.stringify({ rows: [{ keys: ['/'] }] }), { status: 200 });
    return new Response('{}', { status: 403 });
  };
  const items = await testAll({ config, providers: [gsc, ga4], exec, fetchImpl, mcp: [] });
  const by = Object.fromEntries(items.map((i) => [i.source, i]));
  assert.equal(by.gsc.ok, true);
  assert.equal(by.gsc.path, 'api');
  assert.equal(by.gsc.identity, 'reader@acme-proj.iam.example.test');
  assert.equal(by.ga4.ok, false);
  assert.match(by.ga4.error, /Property access management/);
});

test('mcp sources skip the api call', async () => {
  const fetchImpl = async () => { throw new Error('must not call'); };
  const items = await testAll({ config, providers: [gsc], exec, fetchImpl, mcp: ['gsc'] });
  assert.deepEqual(items[0], { ...items[0], source: 'gsc', path: 'mcp', ok: true, identity: 'mcp' });
});

test('output never contains the token', async () => {
  const fetchImpl = async () => new Response('{}', { status: 500 });
  const items = await testAll({ config, providers: [gsc], exec, fetchImpl, mcp: [] });
  assert.doesNotMatch(JSON.stringify(items), /tok/);
});
