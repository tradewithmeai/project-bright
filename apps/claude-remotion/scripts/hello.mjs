// hello.mjs — render the zero-key hello-world and prove the artefact, not the exit code.
//
// This is the install proof. It renders `HelloWorld` (no API key, no public/ assets, no web
// font, no audio) and then checks the file it actually produced. Exit code alone is not
// evidence: this project has shipped a de-blinding leak and a week-long render bug with
// exit code 0, so every check here asserts on the artefact.
//
// Thresholds, and why they are these numbers:
//   - size > 50 KB. A black 150-frame 1080p libx264 render measures 14,336 B and a flat
//     colour 14,341 B, so 50 KB discriminates a real render from an empty one by ~3.6x.
//     A correct render measured 260,887 B on one machine and 188,869 B on another — a 38%
//     cross-machine delta, which is why no byte count is asserted as a constant.
//   - frame count == 150 +/- 1, read with ffprobe -count_frames (counts frames, does not
//     trust container metadata).
// Deliberately NO golden-frame or SSIM comparison: that breaks on every stranger's font
// rendering and GPU, and would reject correct input.
//
// Usage:  npm run hello        (add --keep to leave out/hello.mp4 in place)

import { execFileSync, execSync } from 'node:child_process';
import { existsSync, statSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFfprobe } from './ffmpeg-bin.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'out');
const OUT = join(OUT_DIR, 'hello.mp4');

const EXPECTED_FRAMES = 150;
const FRAME_TOLERANCE = 1;
const MIN_BYTES = 50 * 1024;

const fail = (msg) => {
  console.error(`\n  FAILED — ${msg}\n`);
  process.exit(1);
};

console.log('Rendering HelloWorld — no API key, no assets, no network needed.\n');

mkdirSync(OUT_DIR, { recursive: true });
if (existsSync(OUT)) rmSync(OUT);

try {
  execSync(`npx remotion render HelloWorld "${OUT}" --pixel-format yuv420p`, {
    cwd: ROOT,
    stdio: 'inherit',
  });
} catch (e) {
  fail(`the render itself did not complete (${e.message}).\n` +
    `  If this is a fresh clone, check that "npm install" finished in ${ROOT}.`);
}

// --- Assert on the artefact ------------------------------------------------------------

if (!existsSync(OUT)) fail(`the render reported success but wrote no file at ${OUT}.`);

const bytes = statSync(OUT).size;
if (bytes <= MIN_BYTES) {
  fail(`${OUT} is ${bytes.toLocaleString()} B, at or below the ${MIN_BYTES.toLocaleString()} B floor.\n` +
    `  A blank or single-colour render measures ~14 KB, so this size means the frames are empty.`);
}

let frames;
try {
  const probe = execFileSync(resolveFfprobe(), [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-count_frames',
    '-show_entries', 'stream=nb_read_frames',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    OUT,
  ], { encoding: 'utf8' });
  frames = Number.parseInt(probe.trim(), 10);
} catch (e) {
  fail(`could not probe ${OUT} for its frame count (${e.message}).\n` +
    `  ffprobe ships inside Remotion's compositor package, so this usually means the\n` +
    `  install is incomplete. Set FFPROBE_BIN to override the binary used.`);
}

if (!Number.isFinite(frames)) fail(`ffprobe returned no frame count for ${OUT}.`);
if (Math.abs(frames - EXPECTED_FRAMES) > FRAME_TOLERANCE) {
  fail(`${OUT} has ${frames} frames, expected ${EXPECTED_FRAMES} (+/-${FRAME_TOLERANCE}).`);
}

console.log(`\n  PASSED`);
console.log(`    file    ${OUT}`);
console.log(`    size    ${bytes.toLocaleString()} B  (floor ${MIN_BYTES.toLocaleString()} B)`);
console.log(`    frames  ${frames}  (expected ${EXPECTED_FRAMES} +/-${FRAME_TOLERANCE})`);
console.log(`\n  Your install renders. Next: README.md, "Day one".\n`);

if (!process.argv.includes('--keep')) rmSync(OUT, { force: true });
