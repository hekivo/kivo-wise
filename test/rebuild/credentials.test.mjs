import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultExec, resolveHeaders } from '../../plugins/kivo-rebuild/scripts/lib/credentials.mjs';

test('op reference maps labelled fields to headers', () => {
  const exec = (cmd, args) => {
    assert.equal(cmd, 'op');
    assert.deepEqual(args.slice(0, 4), ['item', 'get', 'staging-token', '--vault']);
    return JSON.stringify({ fields: [{ label: 'CF-Access-Client-Id', value: 'id1' }, { label: 'CF-Access-Client-Secret', value: 's1' }, { label: 'notes', value: 'x' }] });
  };
  assert.deepEqual(resolveHeaders('op://Infra/staging-token', { exec }), { 'CF-Access-Client-Id': 'id1', 'CF-Access-Client-Secret': 's1' });
});

test('op fields labelled header:<name> become headers', () => {
  const exec = () => JSON.stringify({ fields: [{ label: 'header:X-Staging-Key', value: 'k' }] });
  assert.deepEqual(resolveHeaders('op://Infra/item', { exec }), { 'X-Staging-Key': 'k' });
});

test('terraform output reference', () => {
  const exec = (cmd, args) => { assert.equal(cmd, 'terraform'); assert.equal(args[0], '-chdir=infra/cf'); return '{"X-A":"1"}'; };
  assert.deepEqual(resolveHeaders('tf-output:infra/cf:staging_headers', { exec }), { 'X-A': '1' });
});

test('an empty reference gives no headers', () => {
  assert.deepEqual(resolveHeaders(''), {});
  assert.deepEqual(resolveHeaders(undefined), {});
});

test('rejects literal values', () => {
  assert.throws(() => resolveHeaders('abc123'), /only op:\/\/ or tf-output:/);
});

test('the default exec reports the command name and exit code, never its output', () => {
  assert.throws(
    () => defaultExec(process.execPath, ['-e', 'console.log("TOPSECRET"); console.error("TOPSECRET"); process.exit(3)']),
    (e) => /failed \(exit 3\)/.test(e.message) && !/TOPSECRET/.test(e.message),
  );
});
