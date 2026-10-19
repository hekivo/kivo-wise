// test/creator/tokens.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadTheme, normalizeValue, mapTokens, roleUtilities } from '../../plugins/kivo-creator/scripts/lib/tokens.mjs';
import { FIX } from './helpers.mjs';

const theme = loadTheme(readFileSync(join(FIX, 'projects/acme-mu-plugin/wp-content/mu-plugins/acme-core/resources/css/app.css'), 'utf8'));
const t = (role, prop, value) => ({ role, prop, value, provenance: 'exact' });

test('normalises colours, rem and font stacks', () => {
  assert.equal(normalizeValue('color', '#F5F7FA'), 'rgb(245, 247, 250)');
  assert.equal(normalizeValue('backgroundColor', 'rgba(10, 132, 255, 0.5)'), 'rgba(10, 132, 255, 0.5)');
  assert.equal(normalizeValue('fontSize', '2.25rem'), '36px');
  assert.equal(normalizeValue('fontFamily', '"Inter", sans-serif'), 'inter');
});

test('maps values to theme tokens, spacing to the scale, and the rest to proposals', () => {
  const { mapped, proposals } = mapTokens([
    t('section', 'backgroundColor', 'rgb(245, 247, 250)'),
    t('section', 'paddingTop', '64px'),
    t('heading', 'fontSize', '36px'),
    t('heading', 'fontWeight', '700'),
    t('heading', 'fontFamily', 'Inter, sans-serif'),
    t('text', 'fontSize', '13px'),
    t('section', 'paddingBottom', '10px'),
    t('heading', 'textAlign', 'center'),
  ], theme);
  assert.deepEqual(mapped.map((m) => `${m.prop}->${m.token}${m.step === undefined ? '' : `:${m.step}`}`), [
    'backgroundColor->--color-surface',
    'paddingTop->--spacing:16',
    'fontSize->--text-4xl',
    'fontWeight->--font-weight-bold',
    'fontFamily->--font-sans',
  ]);
  assert.deepEqual(proposals.map((p) => `${p.suggested}=${p.value}`), ['--text-body=13px', '--spacing-section=10px']);
});

test('roleUtilities turns mapped tokens into utility classes per role', () => {
  const { utils, proposals } = roleUtilities([
    t('section', 'backgroundColor', 'rgb(245, 247, 250)'),
    t('heading', 'color', 'rgb(17, 24, 39)'),
    t('heading', 'fontSize', '36px'),
    t('text', 'color', 'rgb(75, 85, 99)'),
    t('text', 'fontSize', '13px'),
  ], theme);
  assert.deepEqual(utils.section, ['bg-surface']);
  assert.deepEqual(utils.heading, ['text-ink', 'text-4xl']);
  assert.deepEqual(utils.text, ['text-muted']);
  assert.equal(proposals.length, 1);
});
