#!/usr/bin/env node
/**
 * trim-vo-silence.mjs — remove the silence a TTS engine pads onto a take, and cap the pauses left
 * inside it. Library + CLI.
 *
 *   node scripts/trim-vo-silence.mjs [--dir public/vo] [--keep 0.6] [--floor -40] [--dry]
 *
 * WHY THIS EXISTS
 * ---------------
 * generate-vo.mjs assembles each story clip as [lead-in][hook][gap][news] and computes every one of
 * those lengths in frames, so the news read starts exactly on NEWS_START_FRAME and the gap after the
 * hook is exactly HOOK_TAIL_FRAMES — one beat at 124 BPM, 0.5s.
 *
 * The arithmetic was right and the result was wrong. ElevenLabs pads a take with silence at both
 * ends, so `probeFrames(hook)` was measuring speech PLUS a trailing hold, and the news part carried
 * its own silent lead-in. The gap a listener actually heard on the 2026-08-03 edition:
 *
 *     story 5  1.60s      story 4  1.65s      story 3  1.92s      story 2  1.90s      story 1  1.43s
 *
 * against an intended 0.50s. On screen that is a hole immediately after the number slam — the
 * loudest moment in the segment followed by nearly two seconds of nothing, five times an episode.
 * It reads as the show hesitating. (One of the two dead beats per story in task #84; the other was
 * the tail, which was a frame-budget question and was fixed in tokens.ts.)
 *
 * Trimming the PARTS before they are measured makes the existing frame math honest — the gap
 * becomes the 0.5s it always claimed to be — and it does something else worth having: the hook cap
 * then applies to speech rather than to speech-plus-padding, so fewer takes need re-voicing.
 *
 * COSTS NOTHING. It re-cuts audio that already exists; no TTS call, no credits.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveFfmpeg, resolveFfprobe } from "./ffmpeg-bin.mjs";

export const DEFAULTS = {
  keep: 0.6,    // seconds of silence to leave where a pause is wanted
  floor: -40,   // dBFS below which audio counts as silence
  merge: 0.15,  // bridge two silences separated by a shorter blip (see detectSilences)
};

const durationSec = (file) => {
  const r = spawnSync(resolveFfprobe(), ["-v", "error", "-show_entries", "format=duration",
    "-of", "csv=p=0", file], { encoding: "utf8", timeout: 30000 });
  const s = parseFloat(String(r.stdout || "").trim());
  return Number.isFinite(s) && s > 0 ? s : null;
};

/**
 * Every silence in `file` longer than `keep`, as [start, end] second pairs.
 *
 * The compositor's ffmpeg is a MINIMAL build: it carries `silencedetect` but NOT `silenceremove`
 * ("No such filter"). So detect, then rebuild with `atrim` + `concat`, which are core filters
 * present in every build.
 */
export function detectSilences(file, { keep = DEFAULTS.keep, floor = DEFAULTS.floor,
                                       merge = DEFAULTS.merge } = {}) {
  const r = spawnSync(resolveFfmpeg(), ["-hide_banner", "-i", file,
    "-af", `silencedetect=noise=${floor}dB:d=${keep}`, "-f", "null", "-"],
    { encoding: "utf8", timeout: 60000 });
  const log = `${r.stdout || ""}${r.stderr || ""}`;
  const found = [];
  let start = null;
  for (const line of log.split(/\r?\n/)) {
    const s = line.match(/silence_start:\s*(-?[\d.]+)/);
    if (s) { start = Math.max(0, Number(s[1])); continue; }
    const e = line.match(/silence_end:\s*([\d.]+)/);
    if (e && start !== null) { found.push([start, Number(e[1])]); start = null; }
  }

  // MERGE silences separated by a blip. The hook/news concat seam leaves a ~50ms click in the
  // middle of the gap, so silencedetect reports the ONE audible pause as TWO silences of ~0.7s and
  // ~0.9s — each only just over the cap, so capping them individually removed almost nothing while
  // the pause a listener hears went untouched.
  const merged = [];
  for (const s of found) {
    const prev = merged[merged.length - 1];
    if (prev && s[0] - prev[1] < merge) prev[1] = s[1];
    else merged.push([...s]);
  }
  return merged.filter(([s, e]) => e - s > keep);
}

/** Rebuild `file` from `segs` ([start, end] seconds). Returns true on success. */
function splice(file, segs) {
  if (segs.length === 0) return false;
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.trim.mp3`);
  const filter = segs
    .map(([s, e], i) => `[0:a]atrim=start=${s.toFixed(3)}:end=${e.toFixed(3)},asetpts=N/SR/TB[s${i}]`)
    .join(";") + `;${segs.map((_, i) => `[s${i}]`).join("")}concat=n=${segs.length}:v=0:a=1[out]`;
  const r = spawnSync(resolveFfmpeg(), ["-hide_banner", "-v", "error", "-y", "-i", file,
    "-filter_complex", filter, "-map", "[out]",
    "-codec:a", "libmp3lame", "-q:a", "2", tmp], { encoding: "utf8", timeout: 60000 });
  if (r.status !== 0 || !fs.existsSync(tmp)) {
    fs.rmSync(tmp, { force: true });
    return false;
  }
  fs.renameSync(tmp, file);
  return true;
}

/**
 * Strip leading and trailing silence from a TTS take, in place. This is the one generate-vo.mjs
 * needs: it makes probeFrames() measure SPEECH, so the assembled clip's frame layout is real.
 *
 * Non-fatal by contract — voiceover generation must never fail because a trim did not work. On any
 * problem the file is left exactly as it was and {trimmed:false} comes back.
 */
export function trimEdges(file, { floor = DEFAULTS.floor } = {}) {
  const before = durationSec(file);
  if (before == null) return { trimmed: false, before: null, after: null };
  // 0.05s: short enough to catch a tight pad, long enough not to chase a breath.
  const sil = detectSilences(file, { keep: 0.05, floor, merge: 0 });
  const head = sil.find(([s]) => s <= 0.02);
  const tail = sil.find(([, e]) => e >= before - 0.02);
  const start = head ? head[1] : 0;
  const end = tail ? tail[0] : before;
  if (end - start < 0.15 || (start < 0.02 && end > before - 0.02)) {
    return { trimmed: false, before, after: before };   // nothing to take, or would gut the take
  }
  if (!splice(file, [[start, end]])) return { trimmed: false, before, after: before };
  return { trimmed: true, before, after: durationSec(file) ?? before };
}

/** Cap every over-long silence inside `file` at `keep` seconds, in place. */
export function capSilences(file, opts = {}) {
  const { keep = DEFAULTS.keep } = opts;
  const before = durationSec(file);
  if (before == null) return { trimmed: false, before: null, after: null };
  const sil = detectSilences(file, { ...DEFAULTS, ...opts });
  const segs = [];
  let cursor = 0;
  for (const [s, e] of sil) {
    const cut = Math.min(s + keep, e);
    if (cut > cursor + 0.001) segs.push([cursor, cut]);
    cursor = e;
  }
  if (before > cursor + 0.001) segs.push([cursor, before]);
  if (segs.length <= 1) return { trimmed: false, before, after: before };
  if (!splice(file, segs)) return { trimmed: false, before, after: before };
  return { trimmed: true, before, after: durationSec(file) ?? before };
}

// ── CLI: cap silences across a directory of clips (retro-fitting an already-voiced edition) ──
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const argv = process.argv.slice(2);
  const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const DIR = path.resolve(ROOT, arg("--dir", "public/vo"));
  const keep = Number(arg("--keep", String(DEFAULTS.keep)));
  const floor = Number(arg("--floor", String(DEFAULTS.floor)));
  const merge = Number(arg("--merge", String(DEFAULTS.merge)));
  const dry = argv.includes("--dry");

  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".mp3")).sort();
  if (!files.length) {
    console.error(`[trim-vo] no mp3s in ${DIR}`);
    process.exit(1);
  }
  console.log(`[trim-vo] ${DIR}  keep=${keep}s floor=${floor}dB${dry ? "  (dry run)" : ""}`);
  let saved = 0;
  for (const name of files) {
    const file = path.join(DIR, name);
    if (dry) {
      const before = durationSec(file);
      const sil = detectSilences(file, { keep, floor, merge });
      const cut = sil.reduce((a, [s, e]) => a + (e - s - keep), 0);
      console.log(`[trim-vo]   ${name.padEnd(12)} ${before.toFixed(2)}s -> ${(before - cut).toFixed(2)}s ` +
        `(-${cut.toFixed(2)}s, -${Math.round(cut * 30)}f)`);
      saved += cut;
      continue;
    }
    const r = capSilences(file, { keep, floor, merge });
    if (!r.trimmed) {
      console.log(`[trim-vo]   ${name.padEnd(12)} ${(r.before ?? 0).toFixed(2)}s — no silence over ${keep}s, left alone`);
      continue;
    }
    saved += r.before - r.after;
    console.log(`[trim-vo]   ${name.padEnd(12)} ${r.before.toFixed(2)}s -> ${r.after.toFixed(2)}s ` +
      `(-${(r.before - r.after).toFixed(2)}s, -${Math.round((r.before - r.after) * 30)}f)`);
  }
  console.log(`[trim-vo] total ${saved.toFixed(2)}s (${Math.round(saved * 30)}f) removed${dry ? " — nothing written" : ""}`);
}
