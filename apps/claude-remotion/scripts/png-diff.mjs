#!/usr/bin/env node
// png-diff.mjs — compare two PNG files pixel by pixel.
//
// Exists because the ffmpeg Remotion bundles is built with most encoders disabled: there is no
// rawvideo and no ppm output, and no filters, so the usual `-lavfi psnr` route is unavailable. This
// decodes PNG directly with node:zlib, which needs no dependency and no build step.
//
// It answers one question: when an asset is re-encoded, how much does the RENDERED FRAME move? A
// number on the source file is not the interesting one — the plate is upscaled and composited under
// other layers before anyone sees it.
//
// ⚠️ A metric is not the gate. This says how far the pixels moved; whether that is visible is a
// question for the eye. Both are used here.
//
// Usage: node scripts/png-diff.mjs a.png b.png

import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

function decodePNG(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${path}: not a PNG`);
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colourType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colourType = data[9];
      if (data[12] !== 0) throw new Error(`${path}: interlaced PNG not supported`);
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(`${path}: only 8-bit PNGs supported (got ${bitDepth})`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colourType];
  if (!channels) throw new Error(`${path}: unsupported colour type ${colourType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);

  // Undo the per-scanline filters. This is the whole of PNG decoding once zlib has run.
  let rp = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++];
    const line = raw.subarray(rp, rp + stride);
    rp += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prior = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prior ? prior[x] : 0;
      const c = prior && x >= channels ? prior[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
  }
  return { width, height, channels, data: out };
}

const [aPath, bPath] = process.argv.slice(2);
if (!aPath || !bPath) {
  console.error("usage: node scripts/png-diff.mjs a.png b.png");
  process.exit(2);
}

const a = decodePNG(aPath);
const b = decodePNG(bPath);
if (a.width !== b.width || a.height !== b.height) {
  console.error(`size mismatch: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  process.exit(1);
}

// Compare RGB only — an alpha difference on a fully composited frame is not a visible difference.
const n = Math.min(a.channels, b.channels, 3);
let max = 0;
let sum = 0;
let count = 0;
let over2 = 0;
for (let i = 0; i < a.width * a.height; i++) {
  for (let c = 0; c < n; c++) {
    const d = Math.abs(a.data[i * a.channels + c] - b.data[i * b.channels + c]);
    if (d > max) max = d;
    if (d > 2) over2++;
    sum += d * d;
    count++;
  }
}
const rmse = Math.sqrt(sum / count);
const psnr = rmse === 0 ? Infinity : 20 * Math.log10(255 / rmse);
console.log(`${a.width}x${a.height}`);
console.log(`  max channel difference : ${max}/255`);
console.log(`  RMSE                   : ${rmse.toFixed(3)}`);
console.log(`  PSNR                   : ${psnr === Infinity ? "identical" : psnr.toFixed(2) + " dB"}`);
console.log(`  samples differing by >2: ${((over2 / count) * 100).toFixed(3)}%`);
