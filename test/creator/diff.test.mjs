// test/creator/diff.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffImages } from '../../plugins/kivo-creator/scripts/png.mjs';

const solid = (width, height, rgba) => ({ width, height, data: Buffer.from(Array.from({ length: width * height }, () => rgba).flat()) });

test('identical images and small channel noise do not count', () => {
  const a = solid(4, 4, [10, 20, 30, 255]);
  assert.equal(diffImages(a, solid(4, 4, [10, 20, 30, 255])).ratio, 0);
  assert.equal(diffImages(a, solid(4, 4, [26, 20, 30, 255])).differing, 0);
});

test('a pixel beyond the tolerance counts and is painted red in the diff image', () => {
  const a = solid(2, 2, [0, 0, 0, 255]);
  const b = solid(2, 2, [0, 0, 0, 255]);
  b.data[4] = 200;
  const d = diffImages(a, b);
  assert.equal(d.differing, 1);
  assert.equal(d.ratio, 0.25);
  assert.deepEqual([...d.image.data.subarray(4, 8)], [255, 0, 0, 255]);
  assert.equal(d.sizeMatch, true);
});

test('different sizes compare the overlap and count the rest as different', () => {
  const d = diffImages(solid(2, 2, [1, 1, 1, 255]), solid(2, 3, [1, 1, 1, 255]));
  assert.equal(d.width, 2);
  assert.equal(d.height, 3);
  assert.equal(d.differing, 2);
  assert.equal(d.sizeMatch, false);
});
