import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, propose } from '../../plugins/kivo-rebuild/scripts/lib/rules.mjs';

const ctx = (o = {}) => ({ redirects: new Map(), importDate: '2026-01-10', junkPrefixes: ['/test-'], tagTypes: ['post_tag'], fileExt: ['pdf'], hasSignals: true, hasStaging: true, disabled: new Set(), ...o });
const row = (o) => ({ path: '/x/', origin: 'sitemap', type: 'page', lastmod: null, live: { status: 200 }, staging: { status: 200 }, clicks: 0, impressions: 0, ...o });

const cases = [
  ['approved redirect', row({ path: '/old/' }), ctx({ redirects: new Map([['/old/', '/new/']]) }), 'redirect', 'R01'],
  ['pdf from search', row({ origin: 'search', path: '/f/a.pdf', live: { status: 404 } }), ctx(), 'review', 'R02'],
  ['query from search', row({ origin: 'search', path: '/?s=a' }), ctx(), 'review', 'R03'],
  ['search 301', row({ origin: 'search', live: { status: 301, location: '/y/' } }), ctx(), 'redirect', 'R04'],
  ['search 404', row({ origin: 'search', live: { status: 404 } }), ctx(), 'review', 'R05'],
  ['search outside the sitemap', row({ origin: 'search' }), ctx(), 'review', 'R06'],
  ['delta after import', row({ staging: { status: 404 }, lastmod: '2026-02-01' }), ctx(), 'keep', 'R07'],
  ['junk page', row({ path: '/test-page/', staging: { status: 404 } }), ctx(), 'gone', 'R08'],
  ['tag resolves', row({ type: 'post_tag' }), ctx(), 'keep', 'R09'],
  ['tag no signals', row({ type: 'post_tag', staging: { status: 404 } }), ctx({ hasSignals: false }), 'review', 'R10'],
  ['tag clicked', row({ type: 'post_tag', staging: { status: 404 }, clicks: 3 }), ctx(), 'review', 'R11'],
  ['tag impressions only', row({ type: 'post_tag', staging: { status: 404 }, impressions: 9 }), ctx(), 'noindex', 'R12'],
  ['tag invisible', row({ type: 'post_tag', staging: { status: 404 } }), ctx(), 'gone', 'R13'],
  ['same url', row({}), ctx(), 'keep', 'R14'],
  ['staging redirect', row({ staging: { status: 301, location: '/z/' } }), ctx(), 'redirect', 'R15'],
  ['no staging live 200', row({ staging: null }), ctx({ hasStaging: false }), 'keep', 'R16'],
  ['no staging live redirect', row({ staging: null, live: { status: 301, location: '/w/' } }), ctx({ hasStaging: false }), 'redirect', 'R17'],
  ['no staging live 404', row({ staging: null, live: { status: 404 } }), ctx({ hasStaging: false }), 'gone', 'R18'],
  ['fallback', row({ staging: { status: 500 } }), ctx(), 'review', 'R99'],
];

for (const [name, r, c, decision, id] of cases) {
  test(name, () => {
    const p = propose(r, c);
    assert.equal(p.proposed, decision);
    assert.equal(p.rule_id, id);
  });
}

test('disabled rule falls through', () => {
  assert.equal(propose(row({ type: 'post_tag', staging: { status: 404 } }), ctx({ disabled: new Set(['R13']) })).rule_id, 'R99');
});

test('the fallback rule cannot be disabled', () => {
  assert.equal(propose(row({ staging: { status: 500 } }), ctx({ disabled: new Set(['R99']) })).rule_id, 'R99');
});

test('redirect targets are carried', () => {
  assert.equal(propose(row({ origin: 'search', live: { status: 301, location: '/y/' } }), ctx()).target, '/y/');
});

test('every rule is described, and ids are unique and ordered', () => {
  const ids = RULES.map((r) => r.id);
  assert.deepEqual(ids, [...ids].sort());
  assert.equal(new Set(ids).size, ids.length);
  for (const r of RULES) assert.ok(r.describe && typeof r.describe === 'string', `${r.id} has no describe`);
});

test('redirect targets on the live or staging host become paths; foreign hosts stay absolute', async () => {
  const { toTarget } = await import('../../plugins/kivo-rebuild/scripts/lib/rules.mjs');
  const origins = ['https://www.example.test', 'https://staging.example.test'];
  assert.equal(toTarget('https://www.example.test/b/?x=1', origins), '/b/?x=1');
  assert.equal(toTarget('https://STAGING.example.test', origins), '/');
  assert.equal(toTarget('https://other.example.test/c/', origins), 'https://other.example.test/c/');
  assert.equal(toTarget('/d/', origins), '/d/');
  assert.equal(toTarget('', origins), '');
});
