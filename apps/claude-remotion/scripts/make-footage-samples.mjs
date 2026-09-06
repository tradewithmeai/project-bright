// make-footage-samples.mjs — deterministic generator for the FootagePromo sample clips.
//
// FootagePromo has to exercise REAL video decoding, not a DOM animation pretending to be footage.
// That needs committed video files, and committed video files need provenance. So the clips are
// synthesized here from our own maths: no stock footage, no third-party frames, no licence
// question, and anyone can regenerate them byte-for-byte.
//
// The approach mirrors scripts/make-audio-assets.mjs: do the pixel work in Node, hand ffmpeg
// nothing but an encode. Remotion's bundled ffmpeg is built with --disable-filters, so generators
// like testsrc/lavfi are unavailable; image2pipe + libx264 are not.
//
// Deliberately TWO clips at DIFFERENT dimensions, because the template claims to handle footage
// whose size does not match the composition, and a demo where every clip is already 1920x1080
// would not test that claim:
//
//   sample-a.mp4   960x540   16:9, matches the composition aspect
//   sample-b.mp4   720x720   1:1, does NOT — exercises cover-cropping
//
// Kept small on purpose: low resolution, few seconds, CRF tuned for size. They exist to prove the
// grammar, not to look like an advert.
//
// Usage:  node scripts/make-footage-samples.mjs

import { deflateSync } from 'node:zlib';
import { mkdirSync, rmSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFfmpeg } from './ffmpeg-bin.mjs';

const ROOT = process.env.APP_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'footage-samples');
const TMP = join(ROOT, 'out', '.footage-tmp');

const FPS = 30;
const SECONDS = 4;

// ── Minimal PNG writer ────────────────────────────────────────────────────────────────────────
// Truecolour 8-bit, filter 0 on every scanline. No dependencies, and byte-identical every run.

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Frame painters ────────────────────────────────────────────────────────────────────────────
// Both are pure functions of (x, y, t). They need to be recognisably DIFFERENT from one another
// and to have obvious motion, so a cut between them is unmistakable on screen and a frozen or
// mis-trimmed clip is equally obvious.

const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

/** Clip A — cool diagonal sweep with a travelling bright band. Reads as "wide shot". */
function paintA(w, h, t) {
  const buf = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      const diag = (u + v) * 0.5;
      // A band that sweeps across, so direction of travel is legible.
      const band = Math.exp(-Math.pow((diag - ((t * 0.45) % 1.3) + 0.15) * 6.0, 2));
      const base = 0.10 + 0.16 * Math.sin((u * 3.1 + t * 0.7) * Math.PI);
      const i = (y * w + x) * 3;
      buf[i] = clamp8(255 * (base * 0.35 + band * 0.55));
      buf[i + 1] = clamp8(255 * (base * 0.85 + band * 0.85));
      buf[i + 2] = clamp8(255 * (base * 1.25 + band * 1.0));
    }
  }
  return buf;
}

/** Clip B — warm concentric rings pulsing from the centre. Reads as "detail shot". */
function paintB(w, h, t) {
  const buf = Buffer.alloc(w * h * 3);
  const cx = w / 2, cy = h / 2, maxR = Math.hypot(cx, cy);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = Math.hypot(x - cx, y - cy) / maxR;
      const rings = 0.5 + 0.5 * Math.sin((r * 11 - t * 2.6) * Math.PI);
      const vign = 1 - r * 0.65;
      const i = (y * w + x) * 3;
      buf[i] = clamp8(255 * (0.16 + rings * 0.72) * vign);
      buf[i + 1] = clamp8(255 * (0.10 + rings * 0.42) * vign);
      buf[i + 2] = clamp8(255 * (0.08 + rings * 0.14) * vign);
    }
  }
  return buf;
}

// ── Encode ────────────────────────────────────────────────────────────────────────────────────

function build(name, width, height, paint) {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  const total = FPS * SECONDS;
  for (let f = 0; f < total; f++) {
    const png = encodePng(width, height, paint(width, height, f / FPS));
    writeFileSync(join(TMP, `f_${String(f).padStart(4, '0')}.png`), png);
  }
  const out = join(OUT_DIR, name);
  rmSync(out, { force: true });
  const r = spawnSync(
    resolveFfmpeg(),
    [
      '-v', 'error',
      '-framerate', String(FPS),
      '-i', join(TMP, 'f_%04d.png'),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'veryslow',
      '-crf', '30',
      '-an',
      out,
    ],
    { stdio: 'inherit' }
  );
  rmSync(TMP, { recursive: true, force: true });
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${name}`);
  const bytes = statSync(out).size;
  console.log(`  ${name.padEnd(16)} ${width}x${height}  ${total} frames  ${bytes.toLocaleString()} B`);
  return bytes;
}

// -- Voice-band placeholder ------------------------------------------------------------------
//
// The mix ducks the music under speech, and proving that needs something in the speech lane. Real
// speech would mean a paid text-to-speech call, so instead this synthesizes a VOICE-BAND TONE: a
// couple of harmonics in the range a voice occupies, with a syllable-rate amplitude envelope.
//
// It is not speech and is not named as if it were. It is a stand-in whose only job is to occupy
// the speech lane so the duck has something to duck under, and so the demo can show the mechanism
// without anyone having to supply a voiceover first.

const SR = 44100;

function wavFromSamples(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE((v * 32767) | 0, i * 2);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVE', 8);
  head.write('fmt ', 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(SR, 24);
  head.writeUInt32LE(SR * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

function buildVoiceTone(name, seconds, f0, syllablesPerSecond) {
  const n = Math.round(SR * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    // Syllable envelope: a raised cosine per syllable, with small gaps between them.
    const sp = t * syllablesPerSecond;
    const frac = sp - Math.floor(sp);
    const syl = frac < 0.72 ? 0.5 - 0.5 * Math.cos((frac / 0.72) * 2 * Math.PI) : 0;
    // Slight pitch movement, so it does not read as a test tone.
    const f = f0 * (1 + 0.05 * Math.sin(t * 2.1));
    const wave =
      0.6 * Math.sin(2 * Math.PI * f * t) +
      0.25 * Math.sin(2 * Math.PI * f * 2 * t) +
      0.12 * Math.sin(2 * Math.PI * f * 3 * t);
    // Overall fade so the file cannot start or end on a click.
    const edge = Math.min(1, t / 0.02, (seconds - t) / 0.03);
    out[i] = wave * syl * 0.5 * Math.max(0, edge);
  }
  const wav = join(TMP, 'v.wav');
  mkdirSync(TMP, { recursive: true });
  writeFileSync(wav, wavFromSamples(out));
  const outPath = join(OUT_DIR, name);
  rmSync(outPath, { force: true });
  const r = spawnSync(
    resolveFfmpeg(),
    ['-v', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '96k', outPath],
    { stdio: 'inherit' }
  );
  rmSync(TMP, { recursive: true, force: true });
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${name}`);
  const bytes = statSync(outPath).size;
  console.log(`  ${name.padEnd(16)} ${seconds}s voice-band tone  ${bytes.toLocaleString()} B`);
  return bytes;
}

mkdirSync(OUT_DIR, { recursive: true });
console.log('Generating neutral sample media (no third-party material):');
let total = 0;
total += build('sample-a.mp4', 960, 540, paintA);
total += build('sample-b.mp4', 720, 720, paintB);
total += buildVoiceTone('voice-tone-a.mp3', 2.0, 165, 3.2);
total += buildVoiceTone('voice-tone-b.mp3', 2.6, 190, 2.8);
console.log(`  total ${total.toLocaleString()} B`);
if (!existsSync(join(OUT_DIR, 'sample-a.mp4'))) throw new Error('sample-a.mp4 missing');
