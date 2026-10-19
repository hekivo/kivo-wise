// test/creator/schema.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { validate } from '../../plugins/kivo-creator/scripts/lib/schema.mjs';
import { PLUGIN, readJson, validSpec } from './helpers.mjs';

const schema = readJson(join(PLUGIN, 'schemas', 'section-spec.schema.json'));

test('a complete spec is valid', () => {
  assert.deepEqual(validate(schema, validSpec()), []);
});

test('missing required fields and unknown keys are reported with their path', () => {
  const spec = validSpec();
  delete spec.layout;
  spec.extra = true;
  assert.deepEqual(validate(schema, spec), ['$.layout: missing', '$.extra: not allowed']);
});

test('enums, patterns and nested $ref are enforced', () => {
  const spec = validSpec();
  spec.kind = 'banner';
  spec.slots[1].items[0][0].provenance = 'guessed';
  spec.tokens[0].token = 'color-ink';
  assert.deepEqual(validate(schema, spec), [
    '$.kind: "banner" not in [hero, features, cta, faq, testimonial, logos, form, media, text, stats, steps, custom]',
    '$.slots[1].items[0][0].provenance: "guessed" not in [exact, inferred]',
    '$.tokens[0].token: does not match ^--[a-z0-9-]+$',
  ]);
});

test('types and minimums are enforced', () => {
  const spec = validSpec();
  spec.layout.columns = 0;
  spec.order = 'first';
  assert.deepEqual(validate(schema, spec), ['$.order: expected integer, got string', '$.layout.columns: below minimum 1']);
});
