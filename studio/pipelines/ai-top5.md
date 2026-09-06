# Pipeline — AI Top 5 (daily automated bulletin)

The first end-to-end studio pipeline. Fetches the day's AI news facts, writes the whole spoken script
app-side, voices it, renders a polished countdown video, and (soon) publishes via socials-studio.

## Status
- ✅ Working: facts API → app-written script → OpenAI TTS → Remotion render (history-preserving output).
- ✅ Era-device visual system wired (2026-07-03): #5 50s TV+chair, #4 80s system+speaker, #3 90s
  flatscreen+catherine landing, #2 00s projector+card-flip landing, #1 tablet colour-splash finale.
  Story text lives ON the device screen; #N slams huge on the VO announce then docks; 8s sign-off =
  five-story round-up → solvx.uk brand close. Owner verdict: "very impressed."
- 🔧 Polish pending (first real test): audio feel, video polish, API service check, then a task cleanup.
- ✅ Publish bridge v1 (2026-07-03): `publish-handoff.mjs` drops a finished-video handoff into
  socials-studio for **human sign-off** (never auto-publishes). See "Publish" below.

## Known issues — MARKED, deferred by owner (2026-07-03, do not fix without a fresh go-ahead)
1. **Speaker sting drags the floor/skirting (~26s).** The base-pivot model fixed the beat SQUASH
   (floor pinned, pixel-proven) but the sting ROCK still rotates the whole `speaker_cutout.png`
   about its base — and the cutout carries baked floor-shadow/skirting pixels, so those swing with
   the rotation. Real fix = a shadow-free speaker plate (drop the baked contact shadow, re-cast it
   procedurally in Remotion) OR mask the rock to the cabinet body only. `--erode` cured the halo,
   not the rotated baked shadow. See [[extract-image-layers]] gotchas.
2. **Residual cyan in the #1 tablet finale.** The rounded screen `div` (radiusFrac 0.035) doesn't
   fully cover the square keyable cyan in the plate corners, so cyan peeks at the tablet corners.
   Fix = grow the `20s` rect a hair / reduce radius / add corner bleed in `FinaleColourSplash.tsx`.
3. **Text↔voiceover timing.** On-screen messages don't land exactly with the spoken line. The
   arrival frames now come from `grid.ts` (`PHASE_BEATS`, `StoryPhases`) and sit on exact beats;
   aligning them to VO WORD timings would mean measuring the words, which nothing does yet.
4. **Presenter chat is thin.** Owner wants a short intro + a roundup + a highlight line, and the AI
   news API to emit *narrative* linking copy (not just per-story facts) so the show has connective tissue.
5. **Sign-off socials row shows platform NAMES only** (YOUTUBE · TIKTOK · INSTAGRAM · X) — awaiting
   the real handles from the owner (`SignOff.tsx`).
6. **Screen news-image gen is parked.** Placeholders are fine for now; build-in-public applies —
   the YouTube description asks viewers for comments/suggestions on the screen imagery.

## Fixes landed this session (2026-07-03) — the "how they were fixed" record
- **Screen rect landed on the black border, not inside it** → `detect_screen.py` now runs FULL-res
  (`--scale 1.0`) + keeps only the LARGEST connected keyable region (`--no-largest` to disable) +
  the DVE lands with a +2px bleed. Full-res exposed 80s EQ-meter stray cyan (h ballooned 415→618);
  largest-region fixed it.
- **Speaker cutout had interior holes** (purple body on purple wall) → `extract_by_diff.py --fill-holes`.
- **Cutout halo travelled with the moving prop** → `extract_by_diff.py --erode N` pulls the matte
  inside the hard cartoon edge. Proven: speaker `--thresh 14 --fill-holes --erode 3`; chair
  `--thresh 14 --erode 1`.
- **Chair leg vanished across the skirting** → lower `--thresh 14` (low-contrast part diffs enough).
- **Prop motion dragged its baked floor-shadow** → BASE-PIVOT model in `tokens.ts` (`PROP`): props
  ROCK/SQUASH about their measured base (`baseX/baseY` in `StoryVisual.tsx`) so feet stay glued.
  (Rotation still swings the *baked* shadow — see Known issue #1.)
- **#1 tablet needed a keyed foreground over a code-driven splash** → new `strip_bg.py` keys the warm
  (orange) background to transparent → `20s_tablet_fg.png` over a hue-cycling sunburst in
  `FinaleColourSplash.tsx`.
- **Each device screen is a different corner shape** → `radiusFrac` per device in `screenTargets.ts`
  (50s CRT soft, projector wall sharp).
- **Card-flip brand face flashed too fast to read** → hold the branded back to `round(APPROACH*0.6)`,
  APPROACH.cardflip 28→46 (`StoryVisual.tsx`).
- **#N appeared small and mistimed** → `NUMBER_SIZE 180→440`, slam moved to `STING_FRAME` (the VO
  position announce), then docks top-right (`tokens.ts` NUMBER_DOCK, `AiTop5Composition.tsx`).
- **32MB "Request too large" reading a full-res frame** → NOT a config switch (it's a hard Anthropic
  API request-size cap; images count toward it and are downsized to ≤1568px internally anyway). Fixed
  permanently with `apps/chatty-susan/view_image.py <img>` → small JPEG, then Read that. See STUDIO.md tool index.

## Run
```bash
# from apps/claude-remotion  (keys auto-load from the repo-root .env)
# 0) GATE: validate the facts API before spending anything (reachable/fresh/complete/caps/categories):
node scripts/check-ai-news.mjs          # exit 0 = pipeline-ready; 1 = do NOT run; 2 = warnings
# 1) iterate the SCRIPT free (gpt-4o-mini, ~$0.0004, no TTS):
node scripts/make-ai-top5.mjs --ai-script
# 2) when the copy reads well, add audio (OpenAI TTS ~$0.02) + render to a dated path:
node scripts/make-ai-top5.mjs --with-audio --ai-script   # also writes data.json for the record step
npx remotion render AiTop5 out/ai-top5_<date>_ed<edition>.mp4   # exact path is printed by step 2
# 3) refresh the companion record so it matches THIS render (never ship a stale record):
node scripts/record-ai-top5.mjs --video out/ai-top5_<date>_ed<edition>.mp4
```
The daily drop into socials-studio is **video + VIDEO_RECORD** — always regenerate the record (step 3)
per render. The record was going stale (it described an earlier edition), which mis-informed the
socials side; `record-ai-top5.mjs` rebuilds it from the exact rendered content each time.

## Tools in this pipeline
- `apps/claude-remotion/scripts/write-script.mjs` — one LLM call → full spoken script from the facts.
- `apps/claude-remotion/scripts/generate-vo.mjs` — TTS (OpenAI default; ElevenLabs fallback); swap-point for Piper.
- `apps/claude-remotion/scripts/make-ai-top5.mjs` — orchestrator: fetch API → data.ts → render hint.
- `apps/claude-remotion/src/templates/ai_top5/` — the Remotion composition (timing in `tokens.ts`).
- Facts API: `https://solvx.uk/api/ai-news.json` (the website; category fix live).

## Data source
Website returns facts-only per story (headline/beats/takeaway/summary/source/tags/category). The studio app
owns ALL spoken voice (Architecture A). The website's `voiceover` field is now redundant (fallback only).

## Publish (bridge v1 — built 2026-07-03)
Finished render → **socials-studio** app → 5 platforms, via a drop-folder handoff. The bridge
DELIVERS for sign-off; it never auto-publishes (socials-studio rule).

```bash
# from apps/claude-remotion, after a render lands in out/
node scripts/publish-handoff.mjs --dry-run            # preview the publish.json (writes nothing)
node scripts/publish-handoff.mjs                       # newest out/ai-top5*.mp4 -> handoff package
# then in socials-studio:
py ingest_handoffs.py                                  # surfaces it in POST_QUEUE.md for sign-off
```
- Package: `<socials-studio>/handoffs/incoming/<id>/{video.mp4, thumb.jpg, publish.json}`
  (video hardlinked when same drive — no extra space). Dest root: `$SOCIALS_STUDIO_DIR` (default
  `$SOCIALS_STUDIO_DIR`).
- Contract: `studio/contracts/finished_video_publish_v1.md`. The emitter seeds title / description /
  headline rundown / tags / per-platform draft captions from `data.ts`; socials-studio's copy skills
  refine each platform's voice before a human signs off.
