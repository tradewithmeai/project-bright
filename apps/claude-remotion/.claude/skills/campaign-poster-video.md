---
name: campaign-poster-video
description: Turn ONE precise landscape campaign image (a comic/meme advert poster) into a short, high-energy video — a virtual camera scans/cuts up the single still in sync with a shouty character voiceover written straight off the poster's own content, closing on a shared brand end-card. The "one image → one video" pattern. Also covers the bigger mixed advert (posters + real app footage + stingers) and the shared toolchain: ElevenLabs prompt-designed voices, music beds, clip judging, and capture-first app walkthroughs.
metadata:
  tags: remotion, advert, campaign, poster, meme, voiceover, elevenlabs, voice-design, one-image-video, yourgov, frame-based
---

> ⚠️ **The reference implementation named below was removed during the pre-release consolidation.**
> The technique is real and is kept here; the file paths are history, not somewhere to look. The surviving equivalent of the camera-scan pattern is `shared/VirtualCamera.tsx`, used by `ProductWalkthrough`; for a short-form advert with a hook and a safe area, see `VerticalAdvert`.

## When to use

Use this when the raw material is a **single strong landscape image** (a designed poster / comic-meme
advert — e.g. ChatGPT-generated, precisely art-directed) and you want a punchy social advert out of it,
**fast and cheap**. The image carries the art and the message; the video adds motion + a voiceover +
music + a branded close. One image = one video. A campaign = several such videos sharing one voice and
one end-card. Proven on the YourGov campaign (2026-07-06): `YourGov4Steps` (one poster) and
`YourGovAdvert` (the full mixed anchor).

**Why it works:** a well-prompted image is controllable and effectively free on a ChatGPT subscription.
Comic/halftone art tolerates a ~2× camera zoom without looking soft, so a static 16:9 poster can be
"cut up" purely with a moving camera — no per-element compositing needed for v1.

## The one-image → one-video loop

1. **Land the image.** Copy it into `apps/claude-remotion/public/yourgov/campaign/<name>.png`. Confirm
   it is 16:9 (≈1672×941 from ChatGPT) so it fills the stage with no letterbox. (Portrait posters also
   work — see *blurred-fill* below.)
2. **Write the VO off the poster.** Read the poster's own panels/headlines and narrate THEM, sillier —
   in character. Save `studio/projects/<proj>/vo_cues_<name>.json` = `{ lines:[{id,cue_s,text}] }`.
   Keep it tight; the poster already says the words, the VO is the comic performance of them.
3. **Generate the voice** (shared character voice, no re-design):
   `node scripts/generate-promo-vo-11.mjs --voice-id <colonel> --cues <cues.json> --out-dir public/yourgov/<name>-audio`
   → one mp3 per line + `vo.manifest.json` with **measured durations**.
4. **Lay the timeline from the real durations.** Place line N right after line N-1 with a ~0.25–0.4s
   gap (a longer beat after a punchline). This total is the video length. A new voice = new durations =
   re-lay the timeline (the composition bakes the cue array).
5. **Build the camera-scan composition** (see pattern below): open on the whole poster, scan each
   panel/region as its VO line plays, pull back, then cut to the shared **end-card**. Music bed under it.
6. **Render + spot-check stills** at each scanned region + the end card, then render full and review.

## The camera-scan composition pattern (single image)

Reference implementation (retired): `yourgov_4steps/YourGov4Steps.tsx`. The equivalent that
ships today is `shared/VirtualCamera.tsx` — the same idea with the clamp made explicit and the
focus regions expressed as fractions of the capture.

- **One `<Img>` under a CSS-transform camera.** Per segment, interpolate a `{cx,cy,scale}` box and apply
  `transform: scale(S) translate(TX%, TY%)` where `TX=(0.5-cx)*100`, `TY=(0.5-cy)*100` — brings the
  point `(cx,cy)` (fractions of the stage) to screen centre at zoom `S`.
- **Cover-clamp EVERY box** so the zoom never reveals the frame edge (black): clamp `cx,cy` to
  `[0.5/S, 1-0.5/S]`. A panel near a corner then sits as close to centre as geometry allows.
- **Chain the moves** — each segment's `from` = the previous segment's `to`, so the camera *scans* the
  strip smoothly (comic-read L→R) rather than resetting.
- **Open and close on the whole poster.** First segment: gentle push into the title. Last segment: pull
  back to `{0.5,0.45,1.0}` so the final banner/tagline reads.
- **Flash the cuts.** A 5-frame white flash at each segment start punches the beat (comic energy).
- **End-card.** After the last VO beat, cut full-frame to the shared brand card
  (`check-click-change.png`) with a small punch-in — so the character's final bark lands on it.
- **Portrait posters → blurred-fill** (this now lives in `shared/PhotoFit.tsx` as `FittedPhoto`,
  and in `shared/ReframedMedia.tsx` for the fit/crop choice): a blurred, darkened
  `objectFit:cover` copy fills the 16:9 sides, the sharp poster sits `objectFit:contain` on top — nothing
  crops, no black bars.

## The shared character voice (ElevenLabs voice design)

`scripts/generate-promo-vo-11.mjs` designs a voice from a text prompt (ElevenLabs text-to-voice:
create-previews → create-voice) then TTS's each cue line. **Design once, reuse by ID.**
- The YourGov campaign voice = a **jokey shouty British army colonel**, voice_id `711U8tu85oOru9cJekha`.
  Reuse with `--voice-id 711U8tu85oOru9cJekha` (never re-design — keeps every video consistent).
- To make a NEW character: `--describe "<prompt>"` (creates + prints a new voice_id to reuse after).
- `voice_settings` in the script (stability 0.4 / style 0.6) tune the shout; lower stability = more manic.
- **Key requirement:** the ElevenLabs key needs the **`text_to_speech`** permission (voice-design +
  music are separate perms). A 401 `missing_permissions` = ask the owner to enable it.

## Music bed + sound effects

- **Music:** `node scripts/generate-music.mjs --prompt "<vibe>" --length-ms <ms> --out public/yourgov/audio/music.mp3`
  (ElevenLabs Music). One bold/playful bed, reused across the campaign, under the VO at volume ~0.4.
- **SFX:** `node scripts/generate-sfx.mjs --prompt "<sound>" --duration <s> --out public/yourgov/audio/<sfx>.mp3`
  (ElevenLabs Sound Generation). Punch a stab under each stinger — e.g. a comedic **stampede** rumble
  under the finger-rampage clips (~0.7 volume, started ~0.1s early so the transient lands on the cut).

## Video-in-video (PiP) + a framed poster

Two moves that lift a one-image video (see `yourgov_4steps`):
- **Inset the scanning poster inside a bordered frame** (`position:absolute; inset:52px; borderRadius;
  border`): gives the pan/zoom breathing room, a "framed poster" look, and space for the PiP.
- **Corner PiP of the real app walkthrough** — a small `OffthreadVideo` (the walkthrough render copied to
  `public/yourgov/clips/walkthrough.mp4`) in a labelled framed window, faded in/out, timed with the VO —
  so the poster's claims are corroborated by real app footage playing alongside.

## The bigger mixed advert (optional, heavier)

`yourgov_advert/YourGovAdvert.tsx` (retired) was the campaign anchor: poster punches (blurred-fill) +
**real app footage** (capture-first, below) + 0.5s "finger-on-the-rampage" video stingers + kinetic
keyword captions + a persistent `yourgov.solvx.uk` corner bug + the CHECK·CLICK·CHANGE cards, all on a
VO-driven timeline. Use for the long YouTube cut; the one-image videos are the teasers/spokes.

## Real app footage (when a beat must show the product)

Drive the app's OWN demo script to produce correct-by-construction states, then pan/zoom them:
`apps/chatty-susan/capture_yourgov.py` (Playwright, 1920×1080 @2× DPI, tour off, autopilot off →
`public/captures/yourgov/*.png`) composited under `mygov_explainer/GuidedZoom`. See the
`make-product-footage` skill. This fixed the prior failure mode (hand-grabbed wrong states).

## Judging supplied clips / footage (Gemini)

- Rate a folder of clips + get keep-worthiness per shot: `studio/tools/analyse_folder.py <folder>
  --out-dir <dir>` (Gemini; ~$0.001/clip). Use the keep-9 shots; extract ~0.5s punch stingers with the
  bundled ffmpeg (`-ss/-t -c:v libx264`, no `-vf`).
- Assess whether a FINISHED multi-track video can be re-cut: `apps/chatty-susan/editability_audit.py`.

## Gotchas (all hit today)

- **Gemini timestamps drift ~1.5× on long clips** — verify windows against real-sampled contact sheets
  (`contact_sheet.py`) before extracting, never trust the raw seconds.
- **VO durations are voice-specific** — swapping the voice re-times the whole video; re-lay the cue array.
- **Bundled Remotion ffmpeg has no libavfilter** (`-vf` fails) — trim with `-ss/-t` + re-encode; scale in
  Remotion via `objectFit`.
- **Cover-clamp or you get black edges** on any zoom past a corner.
- **Assets:** commit the source poster PNGs + the shared end-card (campaign identity); gitignore the
  generated audio (`public/yourgov/*-audio/`, `public/yourgov/audio/`) and extracted clips — regenerable.

## Lessons learned (hard-won on the YourGov campaign)

- **Audio mix is a real thing — the owner hears it, you can't.** Get it wrong and it's the first note
  back. Rules that emerged: music bed **low (~0.24)** so the VO sits clearly on top; an SFX must be a
  **dedicated, long-enough** clip (a 1.3s stab buried under music is inaudible — a ~4.5s *building*
  stampede at ~0.8 reads); **de-clash** an SFX peak from a vocal punchline — let the build swell UNDER
  the setup line and DECAY before the exclamation + visual hit, don't stack both on the same beat.
- **Motif restraint.** One well-built comedic beat beats five scattered stingers. The finger "rampage"
  landed as a single gag — a built-up stampede + the colonel's "…what's that noise?… FINGER!" + the clip
  dropping full-frame — after the scattered version was called overkill. Set up → payoff, once.
- **Re-timing.** Any change to intro length or the VO voice shifts the whole timeline; the cue array +
  segment `at`s are all absolute, so re-lay them. Keep an eye on: VO cues, camera segments, SFX, PiP
  window, end-card, outro. (A future refactor could wrap all content in one offset Sequence.)
- **Brand marks must be REPEATABLE — don't use an AI photoreal render as a logo.** A gorgeous
  ChatGPT neon logo draws a different random circuit tangle every time, never reproduces, and can't be
  recoloured/scaled. For a logo, build it as **flat SVG/code** (one `currentColor` fill, recolourable)
  and add the neon **glow as a CSS effect** in the video — so it's pixel-identical, scalable, and glows
  on demand. (Applies to any recurring brand element, not just the logo.)

## Campaign discipline

One video per image. One character voice (the colonel) across all. One shared end-card
(`check-click-change.png`) closing every cut. Different poster tone per video (absurd / hero / rave /
subversive twist) but the same finger + CHECK·CLICK·CHANGE spine — a real TV-style campaign with a twist.
Per-platform: 16:9 for YouTube (+ description depth), 9:16 teasers for Insta/TikTok, a straighter LinkedIn cut.
