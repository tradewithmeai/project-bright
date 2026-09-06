# AI Top 5 — audio credits & licences

All files below are **synthesized in-house** by `scripts/make-audio-assets.mjs`
(deterministic Node DSP + Remotion-bundled ffmpeg mp3 encode — no third-party
audio, no samples). Licence: generated in-house for this project; no external
attribution required.

| File | Source | Licence | Notes |
|------|--------|---------|-------|
| `bed.mp3` | synthesized in-house via make-audio-assets.mjs | in-house (no third-party audio) | **124 BPM**, 8 bars (15.484s), four-on-the-floor kick + offbeat hats + 2-note bassline + 16th arp w/ echo, sidechain-pumped. Cut exactly on the bar boundary; stateful FX are warmed up over a prior loop pass, so the loop is seamless by construction. |
| `sfx/numberHit.mp3` | synthesized in-house via make-audio-assets.mjs | in-house | ~0.4s pitched impact (sine pitch-drop thump + noise click). |
| `sfx/whoosh.mp3` | synthesized in-house via make-audio-assets.mjs | in-house | ~0.5s bandpass-swept noise (300→3600Hz) + rising chirp, rises then cuts. |
| `sfx/riser.mp3` | synthesized in-house via make-audio-assets.mjs | in-house | ~2.3s rising filtered noise + pitch-rising tones + accelerating flutter, crescendos INTO #1. |
| `sfx/coldOpenSlam.mp3` | synthesized in-house via make-audio-assets.mjs | in-house | ~1s signature sting: 3-note rising arpeggio (A3-C#4-E4) + terminal sub impact. |

## Bed-swap contract (READ BEFORE REPLACING bed.mp3)

The composition's motion beat grid is tempo-locked to the bed (design bible
§3.0 / §4.1). Any replacement bed **MUST be exactly 124 BPM** and trimmed
to a bar boundary (seamless loop). When swapping in a sourced bed:

1. Verify the file's individual licence page (not the search snippet — some
   Pixabay uploads are mislabelled).
2. Record here: source URL, licence URL/name, and BPM.
3. Re-check the loop seam (trim to a bar boundary + short crossfade if needed).

Regenerate everything with: `node scripts/make-audio-assets.mjs`
