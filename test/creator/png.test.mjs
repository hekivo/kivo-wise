// test/creator/png.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { decodePng, encodePng, crc32, pngChunk } from '../../plugins/kivo-creator/scripts/png.mjs';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Forward filter (the encoder side), so the decoder is tested on every filter type. */
function filterLine(f, line, prev, bpp) {
  const out = Buffer.alloc(line.length);
  for (let i = 0; i < line.length; i++) {
    const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
    const predictor = [0, a, b, (a + b) >> 1, paeth(a, b, c)][f];
    out[i] = (line[i] - predictor) & 0xff;
  }
  return out;
}

function png({ width, height, colorType, channels, pixels, filters = [0], depth = 8, interlace = 0 }) {
  const stride = width * channels;
  const rows = [];
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const line = pixels.subarray(y * stride, (y + 1) * stride);
    const f = filters[y % filters.length];
    rows.push(Buffer.from([f]), filterLine(f, line, prev, channels));
    prev = line;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = depth;
  ihdr[9] = colorType;
  ihdr[12] = interlace;
  return Buffer.concat([SIGNATURE, pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(Buffer.concat(rows))), pngChunk('IEND', Buffer.alloc(0))]);
}

const pattern = (n) => Buffer.from(Array.from({ length: n }, (_, i) => (i * 37 + 11) % 256));

test('crc32 matches the well-known IEND chunk CRC', () => {
  assert.equal(crc32(Buffer.from('IEND', 'latin1')), 0xae426082);
});

test('decodes 8-bit RGB with all five filter types', () => {
  const pixels = pattern(5 * 5 * 3);
  const img = decodePng(png({ width: 5, height: 5, colorType: 2, channels: 3, pixels, filters: [0, 1, 2, 3, 4] }));
  assert.equal(img.width, 5);
  assert.equal(img.height, 5);
  for (let i = 0; i < 25; i++) {
    assert.deepEqual([...img.data.subarray(i * 4, i * 4 + 4)], [pixels[i * 3], pixels[i * 3 + 1], pixels[i * 3 + 2], 255], `pixel ${i}`);
  }
});

test('decodes RGBA and grayscale', () => {
  const rgba = pattern(4 * 3 * 4);
  assert.deepEqual(decodePng(png({ width: 4, height: 3, colorType: 6, channels: 4, pixels: rgba, filters: [4, 3, 1] })).data, rgba);
  const gray = decodePng(png({ width: 2, height: 1, colorType: 0, channels: 1, pixels: Buffer.from([10, 200]) }));
  assert.deepEqual([...gray.data], [10, 10, 10, 255, 200, 200, 200, 255]);
});

test('encodePng output decodes to the same pixels', () => {
  const image = { width: 3, height: 2, data: pattern(3 * 2 * 4) };
  assert.deepEqual(decodePng(encodePng(image)), image);
});

test('unsupported PNGs fail loudly', () => {
  assert.throws(() => decodePng(Buffer.from('nope')), /not a PNG/);
  assert.throws(() => decodePng(png({ width: 1, height: 1, colorType: 2, channels: 3, pixels: pattern(3), depth: 16 })), /bit depth 16/);
  assert.throws(() => decodePng(png({ width: 1, height: 1, colorType: 2, channels: 3, pixels: pattern(3), interlace: 1 })), /interlaced/);
});
