#!/usr/bin/env node
// check-ai-top5-mix.mjs — objective checks on the rendered AI Top 5 audio.
//
// ⚠️ THIS IS NOT LISTENING. It measures sample values. It can tell you the mix does not clip, that
// the bed is present where it should be, that the duck moves in the intended direction and that the
// riser resolves on the frame it was aimed at. It cannot tell you whether any of that SOUNDS right —
// whether the duck is musical, whether the riser is exciting, whether the hits sit well. Those are
// questions for ears, and nothing here is a substitute for them.
//
// Usage: node scripts/check-ai-top5-mix.mjs <render.wav>
//   Produce the wav with:  ffmpeg -i out/ai-top5.mp4 -vn -c:a pcm_s16le out/ai-top5.wav

import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("usage: node scripts/check-ai-top5-mix.mjs <render.wav>");
  process.exit(2);
}

// ── Minimal 16-bit PCM WAV reader ─────────────────────────────────────────────────────────────
function readWav(p) {
  const b = readFileSync(p);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("not a RIFF/WAVE file");
  }
  let pos = 12;
  let channels = 0;
  let sampleRate = 0;
  let bits = 0;
  let data = null;
  while (pos + 8 <= b.length) {
    const id = b.toString("ascii", pos, pos + 4);
    const size = b.readUInt32LE(pos + 4);
    if (id === "fmt ") {
      channels = b.readUInt16LE(pos + 10);
      sampleRate = b.readUInt32LE(pos + 12);
      bits = b.readUInt16LE(pos + 22);
    } else if (id === "data") {
      data = b.subarray(pos + 8, pos + 8 + size);
    }
    pos += 8 + size + (size % 2);
  }
  if (!data) throw new Error("no data chunk");
  if (bits !== 16) throw new Error(`expected 16-bit PCM, got ${bits}`);
  return { channels, sampleRate, data };
}

const { channels, sampleRate, data } = readWav(path);
const frames = data.length / 2 / channels;
const FPS = 30;
const samplesPerVideoFrame = sampleRate / FPS;

/** Peak and RMS over a video-frame range, as a fraction of full scale. */
function window(fromFrame, toFrame) {
  const s0 = Math.max(0, Math.floor(fromFrame * samplesPerVideoFrame));
  const s1 = Math.min(frames, Math.ceil(toFrame * samplesPerVideoFrame));
  let peak = 0;
  let sum = 0;
  let n = 0;
  for (let i = s0; i < s1; i++) {
    for (let c = 0; c < channels; c++) {
      const v = data.readInt16LE((i * channels + c) * 2) / 32768;
      const a = Math.abs(v);
      if (a > peak) peak = a;
      sum += v * v;
      n++;
    }
  }
  return { peak, rms: n ? Math.sqrt(sum / n) : 0 };
}

const db = (x) => (x <= 0 ? -Infinity : 20 * Math.log10(x));
const fmt = (x) => (x === -Infinity ? " -inf" : x.toFixed(1).padStart(6));

// ── The episode's structure, from grid.ts ─────────────────────────────────────────────────────
const BEAT = (30 * 60) / 124;
const at = (beat) => Math.round(beat * BEAT);
const COLD_OPEN_BEATS = 13;
const STORY_BEATS = 38;
const SIGN_OFF_BEATS = 14;
const RISER_BEATS = 5;
const storyStart = [];
for (let i = 0, b = COLD_OPEN_BEATS; i < 5; i++, b += STORY_BEATS) storyStart.push(b);
const endBeat = COLD_OPEN_BEATS + 5 * STORY_BEATS + SIGN_OFF_BEATS;

const failures = [];
const note = (ok, msg) => {
  console.log(`   ${ok ? "ok  " : "FAIL"} ${msg}`);
  if (!ok) failures.push(msg);
};

console.log(`${path}`);
console.log(`  ${channels}ch ${sampleRate}Hz, ${(frames / sampleRate).toFixed(2)}s (${Math.round(frames / samplesPerVideoFrame)} video frames)\n`);

// ── 1. Headroom ───────────────────────────────────────────────────────────────────────────────
const all = window(0, frames / samplesPerVideoFrame);
console.log("1. Level");
console.log(`   peak ${fmt(db(all.peak))} dBFS | programme RMS ${fmt(db(all.rms))} dBFS`);
note(all.peak < 0.999, `peak below full scale (${all.peak.toFixed(4)})`);
note(db(all.peak) < -0.5, `at least 0.5 dB of headroom`);

// ── 2. The bed is actually present ────────────────────────────────────────────────────────────
// A silent stretch anywhere would mean the bed failed to load or the loop ran out.
console.log("\n2. Bed presence");
let quietest = { rms: Infinity, frame: -1 };
for (let f = 0; f + 30 < endBeatFrames(); f += 15) {
  const w = window(f, f + 30);
  if (w.rms < quietest.rms) quietest = { rms: w.rms, frame: f };
}
function endBeatFrames() {
  return at(endBeat);
}
console.log(`   quietest one-second window: ${fmt(db(quietest.rms))} dBFS at frame ${quietest.frame}`);
note(quietest.rms > 0.002, "no silent gap in the programme (bed runs throughout)");

// ── 3. Duck and swell move in the intended direction ──────────────────────────────────────────
// The bed is loudest under the cold open and the sign-off, and ducked under each story's body.
console.log("\n3. Duck / swell");
const coldOpen = window(at(3), at(COLD_OPEN_BEATS) - 8);
const signOff = window(at(endBeat - SIGN_OFF_BEATS) + 20, at(endBeat) - 20);
const storyBody = window(storyStart[1] ? at(storyStart[1] + 12) : 0, at(storyStart[1] + 26));
console.log(`   cold open  RMS ${fmt(db(coldOpen.rms))} dBFS`);
console.log(`   story body RMS ${fmt(db(storyBody.rms))} dBFS`);
console.log(`   sign-off   RMS ${fmt(db(signOff.rms))} dBFS`);
note(coldOpen.rms > storyBody.rms, "bed is louder under the cold open than under a story body");
note(signOff.rms > storyBody.rms, "bed swells again for the sign-off");

// ── 4. The riser resolves on the #1 boundary ──────────────────────────────────────────────────
// It should rise across its window and be gone shortly after the boundary.
console.log("\n4. Riser into #1");
const topBeat = storyStart[4];
const riserFrom = at(topBeat - RISER_BEATS);
const riserTo = at(topBeat);
const riserEarly = window(riserFrom, riserFrom + 20);
const riserLate = window(riserTo - 20, riserTo);
const afterBoundary = window(riserTo + 30, riserTo + 60);
console.log(`   window ${riserFrom}..${riserTo} (${RISER_BEATS} beats, resolving on the #1 boundary at ${riserTo})`);
console.log(`   first 20f RMS ${fmt(db(riserEarly.rms))} | last 20f RMS ${fmt(db(riserLate.rms))} | 1s after ${fmt(db(afterBoundary.rms))}`);
note(riserLate.rms > riserEarly.rms, "riser builds across its window");
note(afterBoundary.rms < riserLate.rms, "riser has resolved after the boundary rather than running on");

// ── 5. The number hits escalate 5 -> 1 ────────────────────────────────────────────────────────
// Gain is 0.5 + 0.4 * energyFor(rank), so each hit should be louder than the last.
console.log("\n5. Number-hit escalation");
const hits = storyStart.map((b, i) => {
  const f = at(b + 1);
  return { rank: 5 - i, frame: f, peak: window(f, f + 12).peak };
});
for (const h of hits) console.log(`   #${h.rank} at frame ${String(h.frame).padStart(4)} peak ${fmt(db(h.peak))} dBFS`);
// ⚠️ Assert the TREND, not a strict per-step ordering. These peaks are measured on the finished
// mix, where the bed and whatever else is sounding at that moment contribute; the hit's own stem
// cannot be isolated from a composite. The first version of this check demanded each hit exceed
// the last and failed on #3 being 0.1 dB under #4 — a difference that says nothing about the hit
// gains, which do escalate by construction. A least-squares slope over the five is what a
// composite signal can honestly support.
const n5 = hits.length;
const meanX = (n5 - 1) / 2;
const meanY = hits.reduce((a, h) => a + db(h.peak), 0) / n5;
let num = 0;
let den = 0;
hits.forEach((h, i) => {
  num += (i - meanX) * (db(h.peak) - meanY);
  den += (i - meanX) ** 2;
});
const slope = num / den;
console.log(`   trend: ${slope.toFixed(2)} dB per position, #5 -> #1`);
note(slope > 0.4, `escalation trend is upward and material (${slope.toFixed(2)} dB/position)`);
note(db(hits[n5 - 1].peak) > db(hits[0].peak) + 2, "#1 hits at least 2 dB above #5");

// ── 6. The tail ends cleanly ──────────────────────────────────────────────────────────────────
console.log("\n6. Tail");
// ⚠️ Compare the tail against the SIGN-OFF's own body, not against a story body. A story body is
// deliberately ducked, so measuring the ending against it asks the wrong question — the first
// version of this check did, and would have called a hard cut acceptable had the sign-off been
// quiet. What matters is that the music falls away relative to the section it is ending.
const lastHalfSecond = window(at(endBeat) - 15, at(endBeat));
const signOffBody = window(at(endBeat - SIGN_OFF_BEATS) + 20, at(endBeat) - 45);
console.log(`   sign-off body RMS ${fmt(db(signOffBody.rms))} dBFS`);
console.log(`   final 0.5s    RMS ${fmt(db(lastHalfSecond.rms))} dBFS`);
note(
  lastHalfSecond.rms < signOffBody.rms * 0.5,
  "the mix fades out at the end rather than being cut off at level"
);

console.log(
  `\n${failures.length === 0 ? "ALL OBJECTIVE CHECKS PASS" : `${failures.length} CHECK(S) FAILED`}` +
    " — none of this is a substitute for listening."
);
process.exit(failures.length === 0 ? 0 : 1);
