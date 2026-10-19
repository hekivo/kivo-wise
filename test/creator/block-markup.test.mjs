// test/creator/block-markup.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeAttributes, serializeBlock } from '../../plugins/kivo-creator/scripts/lib/block-markup.mjs';

test('escapes attributes the way WordPress serialize_block_attributes() does', () => {
  assert.equal(serializeAttributes({ a: '<b> & "c" -- /é' }), '{"a":"\\u003cb\\u003e \\u0026 \\u0022c\\u0022 \\u002d\\u002d /é"}');
  assert.equal(serializeAttributes({ a: 'C:\\x "q"' }), '{"a":"C:\\u005cx \\u0022q\\u0022"}');
});

test('self-closing and wrapping forms; core/ is dropped from the name', () => {
  assert.equal(serializeBlock('acf/hero', { name: 'acf/hero' }), '<!-- wp:acf/hero {"name":"acf/hero"} /-->');
  assert.equal(serializeBlock('core/paragraph', {}, '<p>Hi</p>'), '<!-- wp:paragraph -->\n<p>Hi</p>\n<!-- /wp:paragraph -->');
});
