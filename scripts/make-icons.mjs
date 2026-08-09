// PNG icons via hand-rolled encoder
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const INK = [0x08, 0x08, 0x0a];
const BONE = [0xf4, 0xf4, 0xef];

// dot diameter as fraction of canvas width, inside Android maskable safe area
const DOT_SCALE = 0.42;
// supersample factor, 4 matches higher values at these sizes
const SS = 4;

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function coverage(x, y, w, h, radius) {
  const cx = w / 2;
  const cy = h / 2;
  let hits = 0;
  for (let sy = 0; sy < SS; sy += 1) {
    for (let sx = 0; sx < SS; sx += 1) {
      const px = x + (sx + 0.5) / SS - cx;
      const py = y + (sy + 0.5) / SS - cy;
      if (px * px + py * py <= radius * radius) hits += 1;
    }
  }
  return hits / (SS * SS);
}

function renderPng(w, h = w, scale = DOT_SCALE) {
  const radius = (Math.min(w, h) * scale) / 2;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  let o = 0;
  for (let y = 0; y < h; y += 1) {
    raw[o] = 0; // filter none
    o += 1;
    for (let x = 0; x < w; x += 1) {
      const a = coverage(x, y, w, h, radius);
      for (let ch = 0; ch < 3; ch += 1) {
        raw[o] = Math.round(INK[ch] * (1 - a) + BONE[ch] * a);
        o += 1;
      }
      raw[o] = 255;
      o += 1;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#08080a"/>
  <circle cx="32" cy="32" r="${(64 * DOT_SCALE) / 2}" fill="#f4f4ef"/>
</svg>
`;

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'favicon.svg'), svg);
for (const [name, size] of [
  ['favicon-32.png', 32],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]) {
  writeFileSync(join(OUT, name), renderPng(size));
  console.log(`wrote public/${name} (${size}x${size})`);
}

// no font rasteriser here -> preview icon carries no text
writeFileSync(join(OUT, 'og.png'), renderPng(1200, 630, 0.22));
console.log('wrote public/og.png (1200x630)');
console.log('wrote public/favicon.svg');
