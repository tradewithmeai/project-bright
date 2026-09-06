#!/usr/bin/env node
/**
 * repair-vo.mjs — re-voice ONE missing lane without re-running the whole edition.
 *
 *   node scripts/repair-vo.mjs --check              # what is missing? costs nothing
 *   node scripts/repair-vo.mjs --lane intro
 *   node scripts/repair-vo.mjs --lane signoff --text "custom line"
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-07-30 the intro TTS call failed with `fetch failed` — one transient network error out of
 * seven calls. `make-ai-top5.mjs` reported "6 ok, 1 failed", wrote `intro_vo: null`, and carried
 * on. The hero rendered and shipped with a **silent 6.5 second cold-open**, and the routine's gate
 * did not catch it because `voiceovers=5/5` counts the five story reads only — the intro and
 * sign-off are printed but not asserted.
 *
 * Recovery was worse than the fault. `--with-audio` is all-or-nothing, so fixing a 44-character
 * intro meant regenerating a whole new AI script and all five story reads: ~1,542 credits and a
 * different edition, to repair one line. Nobody sensible does that, which means the real outcome
 * is shipping the broken video.
 *
 * So this exists to make the cheap fix possible: ~44 characters of TTS, the same voice from the
 * same registry role, then patch `data.ts` and re-render. Roughly 1/35th of the cost.
 *
 * WHAT IT WILL NOT DO
 * -------------------
 * It will not touch the five story reads. Those are concatenated multi-part clips whose frame
 * layout is locked to the composition (lead-in, hook, gap, news at frame 111), and re-voicing one
 * in isolation would desync it from the record written by record-ai-top5.mjs. If a story read is
 * missing, that genuinely is a full re-run — and this script says so rather than pretending.
 */
import '../../../scripts/load-env.mjs';
import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.APP_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const VO_DIR = join(ROOT, 'public', 'vo');
const DATA_TS = join(ROOT, 'src', 'templates', 'ai_top5', 'data.ts');

const args = process.argv.slice(2);
const val = (f, d = null) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };

// The lanes this script may repair, and the field each one sets in data.ts.
const LANES = {
  intro: { file: 'intro.mp3', field: 'intro_vo' },
  signoff: { file: 'signoff.mp3', field: 'signoff_vo' },
};

// ── report what is missing ──────────────────────────────────────────────────
const dataSrc = existsSync(DATA_TS) ? readFileSync(DATA_TS, 'utf8') : '';
const fieldValue = (f) => {
  const m = dataSrc.match(new RegExp(`${f}:\\s*(null|"[^"]*")`));
  return m ? m[1] : '(not found)';
};

console.log('\n  VO lanes:');
const broken = [];
for (const [lane, { file, field }] of Object.entries(LANES)) {
  const p = join(VO_DIR, file);
  const onDisk = existsSync(p) ? `${statSync(p).size} bytes` : 'MISSING';
  const inData = fieldValue(field);
  const bad = !existsSync(p) || inData === 'null';
  if (bad) broken.push(lane);
  console.log(`    ${lane.padEnd(8)} disk: ${onDisk.padEnd(14)} data.ts ${field} = ${inData}  ${bad ? '<< BROKEN' : 'ok'}`);
}
for (let n = 1; n <= 5; n++) {
  const p = join(VO_DIR, `${n}.mp3`);
  if (!existsSync(p)) {
    console.log(`    story ${n}  MISSING — this script CANNOT repair a story read (see the header).`);
    broken.push(`story${n}`);
  }
}
if (!broken.length) console.log('    all present');

if (args.includes('--check')) {
  console.log(`\n  ${broken.length ? `broken: ${broken.join(', ')}` : 'nothing to repair'}\n`);
  process.exit(broken.length ? 1 : 0);
}

const lane = val('--lane');
if (!lane || !LANES[lane]) {
  console.error(`\n  usage: --lane ${Object.keys(LANES).join('|')}  [--text "..."]   or --check\n`);
  process.exit(2);
}

// ── re-voice just that lane ─────────────────────────────────────────────────
// Import the production TTS path so the voice, model and settings come from the same registry
// role the edition used. A repair recorded in a different voice is not a repair.
const gv = await import('./generate-vo.mjs');
const FALLBACK = {
  intro: process.env.AI_TOP5_INTRO
    || "Annnnd today, we've got the rockin', poppin', top five A.I. stories — just for you!",
  signoff: process.env.AI_TOP5_SIGNOFF
    || "And that's your A.I. Top Five! We'll be back tomorrow with five more — see you then!",
};
const text = val('--text') || FALLBACK[lane];

// NOTE the limitation, plainly: the AI-written line for this lane is passed to TTS and never
// persisted anywhere, so it cannot be recovered after the fact. This repair therefore uses the
// FIXED fallback line, not whatever the model wrote for that edition. Close, not identical —
// and worth fixing separately by having make-ai-top5 record the script it used.
console.log(`\n  re-voicing ${lane}: "${text}"`);
console.log(`  (fixed fallback line — the AI-written original is not persisted anywhere)`);

const { file, field } = LANES[lane];
const before = existsSync(join(VO_DIR, file)) ? statSync(join(VO_DIR, file)).size : 0;

const out = await gv.ttsOne(text, file, lane);
if (!out) {
  console.error(`\n  FAILED — ${lane} not written. Nothing changed.\n`);
  process.exit(1);
}
const after = statSync(join(VO_DIR, file)).size;
console.log(`  wrote public/vo/${file}  ${before} -> ${after} bytes`);

// ── patch data.ts ───────────────────────────────────────────────────────────
const re = new RegExp(`(${field}:\\s*)(null|"[^"]*")`);
if (!re.test(dataSrc)) {
  console.error(`\n  could not find ${field} in data.ts — mp3 is written but data.ts NOT patched.\n`);
  process.exit(1);
}
writeFileSync(DATA_TS, dataSrc.replace(re, `$1"vo/${file}"`), 'utf8');
console.log(`  patched data.ts: ${field} = "vo/${file}"`);
console.log(`\n  Now RE-RENDER — the existing mp4 still has the fault baked in:`);
console.log(`      npx remotion render AiTop5 out/ai-top5_<DATE>_ed1.mp4`);
console.log(`  then re-run the hero publish-handoff to replace the queued video.\n`);
