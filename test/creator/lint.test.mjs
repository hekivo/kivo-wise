// test/creator/lint.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintSource } from '../../plugins/kivo-creator/scripts/lib/lint.mjs';

test('flags arbitrary Tailwind values, arbitrary properties and inline styles with line numbers', () => {
  const blade = [
    '<section class="bg-surface pt-16">',
    '  <h2 class="text-[#111827] md:text-[36px]">{{ $heading }}</h2>',
    '  <div class="[mask-type:luminance]" style="color: red">x</div>',
    '</section>',
  ].join('\n');
  assert.deepEqual(lintSource(blade, 'stats.blade.php').map((f) => `${f.line}:${f.rule}:${f.match}`), [
    '2:arbitrary-value:text-[#111827]',
    '2:arbitrary-value:md:text-[36px]',
    '3:arbitrary-property:[mask-type:luminance]',
    '3:inline-style:style="',
  ]);
});

test('PHP arrays, Blade echoes and @apply of real utilities are fine; CSS is checked for arbitrary values only', () => {
  assert.deepEqual(lintSource("$fields->addRepeater('items', ['max' => 6]);\n{{ $item['heading'] }}", 'Stats.php'), []);
  assert.deepEqual(lintSource('.x { @apply p-[12px]; }', 'x.css').map((f) => f.rule), ['arbitrary-value']);
});
