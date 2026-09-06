// make-audio-assets.mjs — deterministic generator for the AI Top 5 audio assets.
//
// Synthesizes ALL audio in-house so every file is licence-clean by construction
// (design bible §4.1 bed, §4.2 SFX stings, §4.5 licensing log → CREDITS.md).
//
// WHY Node DSP + ffmpeg encode (not lavfi): the Remotion-bundled ffmpeg is built
// with --disable-filters and only a small whitelist (amix, pan, volume, sine,
// adelay, atrim, loudnorm…) — aevalsrc/anoisesrc/highpass/afade do NOT exist in
// it. So all sample math happens here in Node (deterministic, seeded PRNG,
// biquad filters, echo, sidechain pump), we write a WAV, and the bundled ffmpeg
// only encodes WAV → MP3 (libmp3lame + wav demuxer ARE enabled). Works on any
// render host with no external ffmpeg install.
//
// Outputs (FIXED filename contract — the composition wiring depends on these):
//   public/audio/bed.mp3               124 BPM driving loop, 8 bars, seamless
//   public/audio/sfx/numberHit.mp3     pitched impact for each rank slam
//   public/audio/sfx/whoosh.mp3        bandpass-swept noise into each story
//   public/audio/sfx/riser.mp3         crescendo INTO #1
//   public/audio/sfx/coldOpenSlam.mp3  3-note rising arp + terminal impact
//   public/audio/CREDITS.md            source + licence log (regenerated here)
//
// Usage: node scripts/make-audio-assets.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFfmpeg, resolveFfprobe } from './ffmpeg-bin.mjs';

const ROOT = process.env.APP_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO_DIR = join(ROOT, 'public', 'audio');
const SFX_DIR = join(AUDIO_DIR, 'sfx');

const FFMPEG = resolveFfmpeg();
const FFPROBE = resolveFfprobe();

// ---------------------------------------------------------------------------
// Timing tokens (all named — no raw numbers buried in the DSP loops).
// BPM is a SYSTEM CONTRACT (§4.1): the composition's motion beat grid assumes
// the bed is exactly 124 BPM. Any future bed swap MUST also be 124 BPM.
// ---------------------------------------------------------------------------
const BED_BPM = 124;
const BEAT_SEC = 60 / BED_BPM;            // 0.483870967…s — one beat
const HALF_BEAT_SEC = BEAT_SEC / 2;       // 8th note (bass gate)
const SIXTEENTH_SEC = BEAT_SEC / 4;       // 16th note (arp/shaker gate, arp echo)
const BAR_SEC = 4 * BEAT_SEC;             // 1.935483…s — one bar
const BED_BARS = 8;                       // 8-bar loop
const BED_DUR_SEC = BED_BARS * BAR_SEC;   // 15.483870967…s — EXACT bar boundary
const BASS_ALT_BARS = 1;                  // bass alternates note every bar

// SFX durations (§4.2)
const NUMBER_HIT_DUR_SEC = 0.4;
const WHOOSH_DUR_SEC = 0.5;
const WHOOSH_PEAK_SEC = 0.42;             // rise until here, then hard collapse
const RISER_DUR_SEC = 2.3;
const SLAM_DUR_SEC = 1.0;
const SLAM_NOTE_GAP_SEC = 0.11;           // arpeggio note spacing
const SLAM_IMPACT_AT_SEC = 0.33;          // terminal impact lands here

// Sidechain-feel pump: everything but the kick dips to 45% on each beat and
// recovers over 120ms — the classic four-on-the-floor drive.
const SIDECHAIN_FLOOR = 0.45;
const SIDECHAIN_RECOVER_SEC = 0.12;

// Musical pitches (A-minor-ish energy: A1/C2 bass, A3/C#4/E4 bright arp+sting)
const BASS_NOTE_A_HZ = 55;
const BASS_NOTE_B_HZ = 65.41;
const ARP_NOTES_HZ = [220, 277.18, 329.63, 277.18]; // A3 C#4 E4 C#4 per 16th
const SLAM_NOTES_HZ = [220, 277.18, 329.63];        // rising sting arp

// Render settings
const SR = 44100;
const MP3_ARGS = ['-c:a', 'libmp3lame', '-b:a', '192k'];
const PEAK_TARGET = 0.95;
const DUR_TOLERANCE_SEC = 0.15; // mp3 encoder delay/padding stretches duration slightly

const TWO_PI = Math.PI * 2;

// ---------------------------------------------------------------------------
// Small DSP toolkit (deterministic)
// ---------------------------------------------------------------------------

// mulberry32 — tiny seeded PRNG; returns noise in [-1, 1)
function makeNoise(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return (((x ^ (x >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

// RBJ biquad
class Biquad {
  constructor() { this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.z1 = 0; this.z2 = 0; }
  set(type, freq, q) {
    const w0 = TWO_PI * freq / SR;
    const cw = Math.cos(w0), sw = Math.sin(w0), alpha = sw / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lowpass') {
      b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2;
    } else if (type === 'highpass') {
      b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2;
    } else { // bandpass (constant peak gain)
      b0 = alpha; b1 = 0; b2 = -alpha;
    }
    a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0;
    this.a1 = a1 / a0; this.a2 = a2 / a0;
    return this;
  }
  process(x) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
}

const duckAt = (t) => {
  const tt = t % BEAT_SEC;
  return SIDECHAIN_FLOOR + (1 - SIDECHAIN_FLOOR) * Math.min(tt / SIDECHAIN_RECOVER_SEC, 1);
};

// normalize both channels to PEAK_TARGET (with gentle tanh glue first if hot)
function master(chans) {
  let peak = 0;
  for (const c of chans) for (let i = 0; i < c.length; i++) peak = Math.max(peak, Math.abs(c[i]));
  if (peak === 0) return chans;
  const g = PEAK_TARGET / peak;
  for (const c of chans) for (let i = 0; i < c.length; i++) c[i] *= g;
  return chans;
}

function fadeOut(chans, fadeSec) {
  const n = chans[0].length, f = Math.min(n, Math.round(fadeSec * SR));
  for (const c of chans) {
    for (let i = 0; i < f; i++) {
      const k = i / f; // 0..1 across the fade
      c[n - f + i] *= 0.5 * (1 + Math.cos(Math.PI * k));
    }
  }
  return chans;
}

// 16-bit PCM stereo WAV
function writeWav(path, [left, right]) {
  const n = left.length;
  const data = Buffer.alloc(44 + n * 4);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 4, 4); data.write('WAVE', 8);
  data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20);
  data.writeUInt16LE(2, 22); data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 4, 28);
  data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(left[i] * 32767))), 44 + i * 4);
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(right[i] * 32767))), 44 + i * 4 + 2);
  }
  writeFileSync(path, data);
}

// ---------------------------------------------------------------------------
// BED — 124 BPM, 8 bars, seamless. Every layer is periodic in t with a period
// dividing BED_DUR_SEC. Stateful processors (biquads, echo, phases) are warmed
// up by rendering TWO loop passes and keeping the second, so the file's first
// sample already carries the steady-state echo/filter tails → seamless loop by
// construction (bible §4.1 loop-seam requirement handled at synthesis time).
// ---------------------------------------------------------------------------
function synthBed() {
  const n = Math.round(BED_DUR_SEC * SR);
  const left = new Float32Array(n), right = new Float32Array(n);

  const clickNoise = makeNoise(101);
  const hatNoiseL = makeNoise(202), hatNoiseR = makeNoise(303);
  const hatHpL = new Biquad().set('highpass', 6000, 0.707);
  const hatHpR = new Biquad().set('highpass', 6000, 0.707);
  const bassLp = new Biquad().set('lowpass', 240, 0.707);
  const arpLp = new Biquad().set('lowpass', 3200, 0.707);

  // arp echo at one 16th — pure drive
  const echoLen = Math.round(SIXTEENTH_SEC * SR);
  const echoBuf = new Float32Array(echoLen);
  let echoIdx = 0;

  let bassPhase = 0, arpPhase = 0;

  const KICK_DROP_HZ = 110, KICK_BASE_HZ = 52, KICK_DROP_RATE = 32, KICK_DECAY = 11;
  const KICK_CLICK_DECAY = 180, KICK_GAIN = 0.95, KICK_CLICK_GAIN = 0.4;
  const HAT_OFF_DECAY = 55, HAT_16TH_DECAY = 90, HAT_GAIN = 0.5, HAT_16TH_GAIN = 0.5;
  const BASS_ENV_DECAY = 7, BASS_GAIN = 0.95, BASS_SAW_MIX = 0.3;
  const ARP_ENV_DECAY = 14, ARP_GAIN = 0.34, ECHO_WET = 0.5, ECHO_FB = 0.32;

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const duck = duckAt(t);

      // KICK: sine w/ exponential pitch drop 162→52Hz (closed-form phase) + click
      const ktt = t % BEAT_SEC;
      const kickPhase = TWO_PI * (KICK_BASE_HZ * ktt + (KICK_DROP_HZ / KICK_DROP_RATE) * (1 - Math.exp(-KICK_DROP_RATE * ktt)));
      const kick = KICK_GAIN * Math.sin(kickPhase) * Math.exp(-KICK_DECAY * ktt)
        + KICK_CLICK_GAIN * clickNoise() * Math.exp(-KICK_CLICK_DECAY * ktt);

      // HATS: offbeat ticks + quiet 16th shaker, highpassed, per-channel noise
      const offTT = (t + HALF_BEAT_SEC) % BEAT_SEC;
      const hatEnv = Math.exp(-HAT_OFF_DECAY * offTT);
      const shakerEnv = HAT_16TH_GAIN * Math.exp(-HAT_16TH_DECAY * (t % SIXTEENTH_SEC));
      const hatL = hatHpL.process(hatNoiseL() * hatEnv + hatNoiseL() * shakerEnv) * HAT_GAIN * duck;
      const hatR = hatHpR.process(hatNoiseR() * hatEnv + hatNoiseR() * shakerEnv) * HAT_GAIN * duck;

      // BASS: 8th-note pluck, note alternates each bar, sine + soft saw
      const barIdx = Math.floor(t / BAR_SEC) % (2 * BASS_ALT_BARS);
      const bassFreq = barIdx < BASS_ALT_BARS ? BASS_NOTE_A_HZ : BASS_NOTE_B_HZ;
      bassPhase += TWO_PI * bassFreq / SR;
      const saw = ((bassPhase / TWO_PI) % 1) * 2 - 1;
      const bassEnv = Math.exp(-BASS_ENV_DECAY * (t % HALF_BEAT_SEC));
      const bass = bassLp.process((0.85 * Math.sin(bassPhase) + BASS_SAW_MIX * saw) * bassEnv) * BASS_GAIN * duck;

      // ARP: bright 16th plucks A3→C#4→E4→C#4, phase-continuous, echoed
      const step = Math.floor(t / SIXTEENTH_SEC) % ARP_NOTES_HZ.length;
      arpPhase += TWO_PI * ARP_NOTES_HZ[step] / SR;
      const pluck = arpLp.process(Math.sin(arpPhase) * Math.exp(-ARP_ENV_DECAY * (t % SIXTEENTH_SEC)));
      const delayed = echoBuf[echoIdx];
      echoBuf[echoIdx] = pluck + delayed * ECHO_FB;
      echoIdx = (echoIdx + 1) % echoLen;
      const arp = (pluck + delayed * ECHO_WET) * ARP_GAIN * duck;

      if (pass === 1) {
        left[i] = kick + bass + arp + hatL;
        right[i] = kick + bass + arp + hatR;
      }
    }
  }
  return master([left, right]);
}

// ---------------------------------------------------------------------------
// SFX (§4.2) — mono synth duplicated to stereo, normalized, faded out.
// ---------------------------------------------------------------------------
function monoToStereo(m) { return [m, Float32Array.from(m)]; }

// numberHit: pitched impact — sine pitch-drop thump + noise click + mid knock
function synthNumberHit() {
  const n = Math.round(NUMBER_HIT_DUR_SEC * SR);
  const m = new Float32Array(n);
  const noise = makeNoise(11);
  const DROP_HZ = 110, BASE_HZ = 48, DROP_RATE = 26, THUMP_DECAY = 9;
  const CLICK_DECAY = 70, KNOCK_HZ = 185, KNOCK_DECAY = 30;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const phase = TWO_PI * (BASE_HZ * t + (DROP_HZ / DROP_RATE) * (1 - Math.exp(-DROP_RATE * t)));
    m[i] = 0.95 * Math.sin(phase) * Math.exp(-THUMP_DECAY * t)
      + 0.5 * noise() * Math.exp(-CLICK_DECAY * t)
      + 0.25 * Math.sin(TWO_PI * KNOCK_HZ * t) * Math.exp(-KNOCK_DECAY * t);
  }
  return fadeOut(master(monoToStereo(m)), 0.06);
}

// whoosh: noise through a RISING bandpass sweep (300→3600Hz) + rising chirp,
// amplitude climbs to the peak then collapses hard — "rising then cutting"
function synthWhoosh() {
  const n = Math.round(WHOOSH_DUR_SEC * SR);
  const m = new Float32Array(n);
  const noise = makeNoise(22);
  const bp = new Biquad();
  const SWEEP_LO_HZ = 300, SWEEP_HI_HZ = 3600, SWEEP_Q = 1.1, COEF_BLOCK = 16;
  const CHIRP_F0 = 250, CHIRP_RAMP = 3800, CUT_RATE = 60;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const k = Math.min(t / WHOOSH_PEAK_SEC, 1);
    if (i % COEF_BLOCK === 0) bp.set('bandpass', SWEEP_LO_HZ * Math.pow(SWEEP_HI_HZ / SWEEP_LO_HZ, k), SWEEP_Q);
    const env = Math.pow(k, 1.6) * Math.exp(-CUT_RATE * Math.max(t - WHOOSH_PEAK_SEC, 0));
    m[i] = (2.2 * bp.process(noise()) + 0.45 * Math.sin(TWO_PI * (CHIRP_F0 * t + CHIRP_RAMP * t * t))) * env;
  }
  return fadeOut(master(monoToStereo(m)), 0.04);
}

// riser: rising filtered noise + two pitch-rising chirp partials (140→~1000Hz),
// squared crescendo, accelerating flutter (2→~12Hz). Hard end — it crescendos
// INTO the #1 number hit.
function synthRiser() {
  const n = Math.round(RISER_DUR_SEC * SR);
  const m = new Float32Array(n);
  const noise = makeNoise(33);
  const hp = new Biquad().set('highpass', 160, 0.707);
  const noiseLp = new Biquad();
  const NOISE_LP_LO_HZ = 700, NOISE_LP_HI_HZ = 8000, COEF_BLOCK = 32;
  const CHIRP_F0 = 140, CHIRP_RAMP = 190; // f(t) = 140 + 380t → ~1014Hz at 2.3s
  const FLUT_BASE_HZ = 2, FLUT_ACCEL = 2.2;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const k = t / RISER_DUR_SEC;
    if (i % COEF_BLOCK === 0) noiseLp.set('lowpass', NOISE_LP_LO_HZ * Math.pow(NOISE_LP_HI_HZ / NOISE_LP_LO_HZ, k), 0.707);
    const flutter = 0.72 + 0.28 * Math.sin(TWO_PI * (FLUT_BASE_HZ + FLUT_ACCEL * t) * t);
    const tones = 0.5 * Math.sin(TWO_PI * (CHIRP_F0 * t + CHIRP_RAMP * t * t))
      + 0.25 * Math.sin(TWO_PI * (2 * CHIRP_F0 * t + 2 * CHIRP_RAMP * t * t));
    m[i] = hp.process((0.7 * noiseLp.process(noise()) + tones) * k * k * flutter);
  }
  return fadeOut(master(monoToStereo(m)), 0.06);
}

// coldOpenSlam: the signature sting — 3 fast rising plucks then a terminal sub
// impact + noise burst that rings out.
function synthColdOpenSlam() {
  const n = Math.round(SLAM_DUR_SEC * SR);
  const m = new Float32Array(n);
  const noise = makeNoise(44);
  const NOTE_GAIN = 0.38, NOTE_DECAY = 9;
  const IMP_DROP_HZ = 84, IMP_BASE_HZ = 44, IMP_DROP_RATE = 22, IMP_DECAY = 4.5;
  const IMP_NOISE_DECAY = 26;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let y = 0;
    for (let k = 0; k < SLAM_NOTES_HZ.length; k++) {
      const dt = t - k * SLAM_NOTE_GAP_SEC;
      if (dt >= 0) y += NOTE_GAIN * Math.sin(TWO_PI * SLAM_NOTES_HZ[k] * dt) * Math.exp(-NOTE_DECAY * dt);
    }
    const di = t - SLAM_IMPACT_AT_SEC;
    if (di >= 0) {
      const phase = TWO_PI * (IMP_BASE_HZ * di + (IMP_DROP_HZ / IMP_DROP_RATE) * (1 - Math.exp(-IMP_DROP_RATE * di)));
      y += 0.95 * Math.sin(phase) * Math.exp(-IMP_DECAY * di) + 0.5 * noise() * Math.exp(-IMP_NOISE_DECAY * di);
    }
    m[i] = y;
  }
  return fadeOut(master(monoToStereo(m)), 0.1);
}

// ---------------------------------------------------------------------------
// Encode + verify
// ---------------------------------------------------------------------------
function encodeMp3(chans, outPath) {
  const wavPath = outPath + '.tmp.wav';
  writeWav(wavPath, chans);
  execFileSync(FFMPEG, ['-y', '-i', wavPath, ...MP3_ARGS, outPath], { stdio: ['ignore', 'ignore', 'pipe'] });
  rmSync(wavPath);
}

function probe(path) {
  const info = JSON.parse(
    execFileSync(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', path], { encoding: 'utf8' }),
  );
  return { dur: Number(info.format.duration), size: statSync(path).size };
}

const JOBS = [
  { name: 'bed.mp3', out: join(AUDIO_DIR, 'bed.mp3'), synth: synthBed, expectedDur: BED_DUR_SEC, minBytes: 120_000 },
  { name: 'sfx/numberHit.mp3', out: join(SFX_DIR, 'numberHit.mp3'), synth: synthNumberHit, expectedDur: NUMBER_HIT_DUR_SEC, minBytes: 3_000 },
  { name: 'sfx/whoosh.mp3', out: join(SFX_DIR, 'whoosh.mp3'), synth: synthWhoosh, expectedDur: WHOOSH_DUR_SEC, minBytes: 3_000 },
  { name: 'sfx/riser.mp3', out: join(SFX_DIR, 'riser.mp3'), synth: synthRiser, expectedDur: RISER_DUR_SEC, minBytes: 18_000 },
  { name: 'sfx/coldOpenSlam.mp3', out: join(SFX_DIR, 'coldOpenSlam.mp3'), synth: synthColdOpenSlam, expectedDur: SLAM_DUR_SEC, minBytes: 8_000 },
];

mkdirSync(SFX_DIR, { recursive: true });

const results = [];
for (const job of JOBS) {
  encodeMp3(job.synth(), job.out);
  const { dur, size } = probe(job.out);
  const ok = Math.abs(dur - job.expectedDur) <= DUR_TOLERANCE_SEC && size >= job.minBytes;
  results.push({ name: job.name, dur, expected: job.expectedDur, size, ok });
}

const pad = (s, w) => String(s).padEnd(w);
console.log('');
console.log(pad('file', 24) + pad('duration', 12) + pad('expected', 12) + pad('bytes', 10) + 'status');
console.log('-'.repeat(64));
for (const r of results) {
  console.log(
    pad(r.name, 24) + pad(r.dur.toFixed(3) + 's', 12) + pad(r.expected.toFixed(3) + 's', 12) +
    pad(r.size, 10) + (r.ok ? 'OK' : 'FAIL'),
  );
}

// ---------------------------------------------------------------------------
// CREDITS.md (§4.5) — regenerated on every run so it never drifts from reality.
// ---------------------------------------------------------------------------
const credits = `# AI Top 5 — audio credits & licences

All files below are **synthesized in-house** by \`scripts/make-audio-assets.mjs\`
(deterministic Node DSP + Remotion-bundled ffmpeg mp3 encode — no third-party
audio, no samples). Licence: generated in-house for this project; no external
attribution required.

| File | Source | Licence | Notes |
|------|--------|---------|-------|
| \`bed.mp3\` | synthesized in-house via make-audio-assets.mjs | in-house (no third-party audio) | **${BED_BPM} BPM**, ${BED_BARS} bars (${BED_DUR_SEC.toFixed(3)}s), four-on-the-floor kick + offbeat hats + 2-note bassline + 16th arp w/ echo, sidechain-pumped. Cut exactly on the bar boundary; stateful FX are warmed up over a prior loop pass, so the loop is seamless by construction. |
| \`sfx/numberHit.mp3\` | synthesized in-house via make-audio-assets.mjs | in-house | ~${NUMBER_HIT_DUR_SEC}s pitched impact (sine pitch-drop thump + noise click). |
| \`sfx/whoosh.mp3\` | synthesized in-house via make-audio-assets.mjs | in-house | ~${WHOOSH_DUR_SEC}s bandpass-swept noise (300→3600Hz) + rising chirp, rises then cuts. |
| \`sfx/riser.mp3\` | synthesized in-house via make-audio-assets.mjs | in-house | ~${RISER_DUR_SEC}s rising filtered noise + pitch-rising tones + accelerating flutter, crescendos INTO #1. |
| \`sfx/coldOpenSlam.mp3\` | synthesized in-house via make-audio-assets.mjs | in-house | ~${SLAM_DUR_SEC}s signature sting: 3-note rising arpeggio (A3-C#4-E4) + terminal sub impact. |

## Bed-swap contract (READ BEFORE REPLACING bed.mp3)

The composition's motion beat grid is tempo-locked to the bed (design bible
§3.0 / §4.1). Any replacement bed **MUST be exactly ${BED_BPM} BPM** and trimmed
to a bar boundary (seamless loop). When swapping in a sourced bed:

1. Verify the file's individual licence page (not the search snippet — some
   Pixabay uploads are mislabelled).
2. Record here: source URL, licence URL/name, and BPM.
3. Re-check the loop seam (trim to a bar boundary + short crossfade if needed).

Regenerate everything with: \`node scripts/make-audio-assets.mjs\`
`;
writeFileSync(join(AUDIO_DIR, 'CREDITS.md'), credits);
console.log('\nWrote ' + join(AUDIO_DIR, 'CREDITS.md'));

if (results.some((r) => !r.ok)) {
  console.error('\nOne or more assets failed verification.');
  process.exit(1);
}
console.log('All audio assets verified.');
