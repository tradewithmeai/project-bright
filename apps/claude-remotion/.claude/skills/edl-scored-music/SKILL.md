---
name: edl-scored-music
description: Compose a music track TO the cut — timed sections via the ElevenLabs composition plan so a drop lands on an exact video frame — then mix it against voiceover with a constant bed + speech duck. Owns the frame-clean BPM grid, the plan→track workflow, the RMS verification pass, and the owner-validated mixing hierarchy. Proven on the Splitfire 30s advert (drop at f240 = 8.000s exactly).
metadata:
  tags: music, elevenlabs, composition-plan, dubstep, drop, mixing, duck, voiceover, edl, remotion
---

## When to use

Use when a video needs music whose STRUCTURE is locked to the cut — a drop on a specific frame, a
breakdown under a spoken section, a final hit on the CTA — rather than a generic bed laid under a
finished edit. This is the "score to the EDL" mode: the EDL comes first, the music is generated to
its section durations, and every cut lands on a musical gridline by construction.

Do NOT use for: a simple background bed (plain `--prompt` mode is fine), or licensed/real tracks.

> Ground truth: `scripts/generate-music.mjs` (`--plan` mode), the worked plan
> `studio/projects/splitfire/music-plan.json`, and the consuming grid + mix in
> ⚠️ **The reference implementation named below was removed during the pre-release consolidation.**
> The technique is real and is kept here; the file paths are history, not somewhere to look. The ducking model described here now ships as `shared/AudioMix.tsx` (`duckAt`, `MusicBed`, `SfxCues`), used by `FootagePromo`.

> `splitfire_advert/tokens.ts` + `SplitfireAdvert.tsx` (retired). The surviving implementation
> is `src/templates/shared/AudioMix.tsx`.
> When this skill and that code disagree, the code wins.

## Domain facts (fixed)

- **Pick a frame-clean BPM first.** At 30fps, `frames_per_beat = 1800 / BPM` — choose a BPM where
  that is an integer, or every cut drifts off the grid: **150→12f, 120→15f, 100→18f, 90→20f,
  75→24f**. (140 BPM = 12.857f/beat — rejected for the Splitfire build for exactly this reason.)
  Declare `BEAT` and `BAR = 4 × BEAT` as tokens; every section boundary is a bar multiple.
- **The tool:** `node scripts/generate-music.mjs --plan <plan.json> --out public/<x>/audio/music.mp3`
  (from `apps/claude-remotion`). The plan is an ElevenLabs composition plan:
  `{ positive_global_styles[], negative_global_styles[], sections: [{ section_name,
  positive_local_styles[], negative_local_styles[], duration_ms, lines: [] }] }`.
  `lines: []` keeps it instrumental. Cost is measured by credit delta and logged to
  `studio/logs/api-usage.log` (the subscription endpoint sometimes returns nothing — the log then
  records unknown; flag it, don't drop the entry).
- **Section durations are honoured almost exactly.** Verified: a 35,200ms plan produced a 35.24s
  track, with the drop section starting at 8.000s as planned. Trust the boundaries.
- **Section DYNAMICS are NOT honoured.** Verified twice: "suddenly much quieter / stripped" breakdown
  wording still produced the LOUDEST section of the track (-10.8dB RMS vs -12.8 for the drop), and
  outro decay behaviour was inconsistent across regens. Do not fight this with regens — enforce the
  loudness contour in the composition mix (see the hierarchy below). What the plan DOES reliably
  control: section character (riser vs wobble vs half-time vs space) and timing.
- **Verify with RMS, not ears alone.** The bundled Remotion ffmpeg has NO `volumedetect`/`astats`
  filters and no raw `s16le` muxer — decode to wav (`-ac 1 -ar 8000 out.wav`) and compute
  per-section RMS in Python (`wave` + `struct`; stdlib only — `audioop` is gone in 3.13). Compare
  each planned section's level and confirm the drop boundary.

## The mixing hierarchy (owner-validated on Splitfire v1→v6 — apply in this order)

1. **Never step the music gain per section.** A per-section gain envelope (duck the breakdown,
   ride the outro) was REJECTED by the owner as audibly artificial ("the volume changes sounded
   off"). The track's own dynamics do the section work.
2. **Constant bed level, tuned once.** Start at 1.0; the owner settled at **0.6** against
   full-level VO for a dense dubstep bed. One number, flat.
3. **VO louder = amplify the FILES, not `volume > 1`.** Remotion volume is 0..1; boost the
   voiceover mp3s themselves (`ffmpeg -af volume=1.5` ≈ +3.5dB, back up originals first).
4. **Speech duck for local collisions.** When VO is still buried in the track's loudest stretch,
   duck the music ONLY while a line speaks: per-cue `interpolate(f, [start-attack, start, end,
   end+release], [1, factor, factor, 1])`, take the min across cues, multiply into the bed level.
   Shipped values: `factor 0.55, attack 8f, release 14f`, with each cue's `dur` = the MEASURED
   frame length of its mp3 (ffprobe), kept in tokens next to the cue. Keyed to the voice, not the
   timeline, so it never reads as a level change — this is the acceptable form of ducking.
5. **Anti-click tail.** End the master with a ~10f fade to 0 so the track can't end on a click.

## Procedure

1. Lock the EDL first: sections in bars, every boundary a named token, the drop = the frame the
   video's key moment lands (the Splitfire rule: the first full-screen gameplay frame IS the drop).
2. Measure the VO lines (ffprobe → frames) BEFORE freezing section lengths — stretch the master to
   seat every line rather than squeezing lines into a pre-chosen runtime (Splitfire grew 30.4s →
   35.2s to seat a 5.9s CTA line; the owner had explicitly allowed running long and cutting down).
3. Author the plan JSON: sections map 1:1 to the EDL tokens, `duration_ms = frames / 30 * 1000`,
   dynamics wording included but not relied on; negative globals kill vocals/tempo-changes.
4. Generate; probe total duration; run the RMS pass; confirm the drop boundary.
5. Audition gate: the owner hears the track + VO BEFORE the composition is built around them
   (VO-tone rule). RMS is evidence, not a verdict.
6. Mix per the hierarchy; re-render; the owner's ear is the acceptance test.

## Hard rules

1. Frame-clean BPM or nothing — `1800 / BPM` must be an integer at 30fps.
2. Music section durations and composition tokens are ONE source of truth: change one, change both
   (and regenerate the track — the old file is stale the moment the grid moves).
3. Never per-section gain steps; ducking only under measured speech windows with ramps.
4. Every generation logs its cost (credit delta or explicit unknown).
5. The owner auditions generated audio before a full render is built on it.

## Self-evaluation (code is ground truth)

1. `generate-music.mjs` has a `--plan` branch that posts `composition_plan` → grep `--plan` +
   `composition_plan` in `scripts/generate-music.mjs`.
2. The worked plan exists and its section `duration_ms` values sum to the master length implied by
   `TOTAL_FRAMES` in the retired `splitfire_advert/tokens.ts` (1056f = 35,200ms).
3. `BEAT = 12` / `BAR = 48` in that tokens file (the 150 BPM frame-clean grid).
4. The shipped mix is constant-bed × speech-duck: grep `duckAt` + `MUSIC_LEVEL` in
   `SplitfireAdvert.tsx`; the duck reads per-cue `dur` values from `VO_CUES` and `DUCK` from tokens.
5. No per-section music gain table survives in the composition (the removed `MUSIC_GAIN` step
   envelope must NOT come back — grep for it; only DUCK + a flat level should exist).

## Changelog (append-only — newest first)

- v1 (2026-07-18): Created from the Splitfire 30s advert build — the first proven score-to-the-EDL
  run (previously the deferred upgrade noted in project memory). Facts verified live: durations
  honoured (35.2s plan → 35.24s track, drop at 8.000s), dynamics wording ignored twice (breakdown
  loudest at -10.8dB despite "suddenly much quieter"), bundled ffmpeg lacks loudness filters (RMS
  via wav+Python instead). Mixing hierarchy distilled from the owner's v1→v6 verdicts: section gain
  steps rejected → constant 0.6 bed → VO files +3.5dB → speech duck (0.55/8f/14f) accepted.
