---
name: footage-moment-triage
description: Turn raw screen-recorded footage (minutes to hours) into owner-approved cut candidates via a two-pass Gemini analysis — a cheap coarse index over proxies, then a 30s-chunk fine pass that finds ACTION PEAKS at sub-scene precision — and cut tight candidates from the originals for the owner to pick from. Owns the proxy recipe, the inline-vs-Files-API constraint, timestamp-drift bounds, 503 handling, and the moment-not-scene candidate rule. Proven on the Splitfire advert (11 min → 10 moment candidates → 5 owner picks).
metadata:
  tags: gemini, footage, triage, analyse-clip, proxy, moments, candidates, rapid-cut, gameplay
---

## When to use

Use when a video build starts from raw recorded footage and the cut needs the BEST MOMENTS, not
whole scenes — a rapid-cut section, hook flashes, a highlight reel. The output is a small set of
tightly-cut candidate files the OWNER picks from before any composition work.

Do NOT use for: a single short clip you can watch judgments off directly, or footage the owner has
already timestamped for you.

> Ground truth: `studio/tools/analyse_clip.py` (+ `studio/tools/gemini_video.py`), run with Susan's
> venv `.venv/Scripts/python.exe`. Worked artifacts:
> `studio/projects/splitfire/analysis/` (coarse + `fine/` + `MOMENTS.md`) and the candidate sets in
> `studio/projects/splitfire/candidates*/`.

## Domain facts (fixed)

- **Inline only — the Files API is denied.** `gemini_video.py` switches to the Files upload API
  above `INLINE_MAX_BYTES` (18MB), and that endpoint 403s on this project ("denied access") while
  inline `generateContent` works fine. Every analysed file must be **under 18MB** — which is what
  the proxy step guarantees. (The `AQ.…` GOOGLE_AI_KEY is VALID — it's Google's newer key format;
  do not misdiagnose it. See memory `project_gemini_video_understanding`.)
- **Proxy recipe:** `ffmpeg -vf "scale=960:-2" -c:v libx264 -crf 30 -preset veryfast -c:a aac -b:a
  64k` → ~2MB per 24s, ~12MB per 6min. Timestamps identical to the original, so windows found on
  the proxy cut cleanly from the original.
- **Gemini timestamps DRIFT on long clips.** A 331s half returned shot times overrunning the clip's
  own length. Bound the drift by analysing **30-second chunks** in the fine pass — inside 30s the
  drift is a second or two at worst. Chunk offset arithmetic maps chunk-local times back to
  original time (`chunk_index × 30 [+ half offset]`).
- **The trimmed Remotion ffmpeg has no `segment` muxer** — chunk with an `-ss/-t` loop, not
  `-f segment`.
- **503 storms are normal** (flash-lite "high demand"). Retry with sleep; if a chunk keeps failing,
  fall back to `GEMINI_VIDEO_MODEL=gemini-2.5-flash` — a separate capacity pool, still cents.
- **Cost:** ~$0.005–0.02 per short clip on flash-lite; a full 16-min triage (coarse + 24 fine
  chunks) ran ~$0.06 total. Every call's tokens+cost are in the JSON `_usage` block and stderr —
  the always-log rule is satisfied by the tool, but per-run totals still get reported in chat.

## The two-pass pipeline

1. **Coarse pass (index).** Proxy every source file (split >18MB into halves) → `analyse_clip.py`
   each → a per-clip summary + `shots[]` with `keep_worthiness` 1–10. Output: which clips and which
   REGIONS matter, at scene granularity. Cheap; run over everything.
2. **Fine pass (moments).** Chop the footage (or just the promising regions) into **30s chunks**
   (`-ss/-t` loop over the proxies) → analyse each chunk → harvest shots with `keep >= 8` and
   duration 0.5–8s → sort by keep then brevity → write a `MOMENTS.md` index with ORIGINAL-time
   windows and suggested-use labels ("multiple rifle kills", "eliminating BOT-4").
3. **Cut candidates from the ORIGINALS** (never the proxies): each pick = the moment window with
   ~0.3s pre-roll and ~0.5s+ tail (the shot-windows-want-tail rule), `-crf 18`, audio INCLUDED
   (real game audio / announcer calls are usable in the cut). Name files
   `mNN_<origSeconds>s_<description>.mp4` so the provenance is in the filename.
4. **Owner picks.** Present the candidates as a table + the folder path; the owner selects (e.g.
   4–5 for a rapid-cut section). Only picked clips enter the composition; the in-cut trim takes the
   ~1–2s PEAK inside each pick, landing the action on the music grid.

## Hard rules

1. **The unit is the action PEAK, not the scene.** A 9s "keep=10" window is NOT a candidate — the
   owner rejected exactly that ("2 secs of following a bot and then a sec of shooting — we only
   need the last second"). If the fine pass still returns windows >~5s, chunk smaller or trim to
   the described peak before presenting.
2. **Candidates are owner-approved before the build.** Never wire unpicked footage into a hero
   section.
3. **Current-build footage only for hero moments.** Old recordings show an old version of the
   product; they're demoted to background slots (intro PiP) at most — ask if unsure which
   recordings are current.
4. **Cut from originals; analyse on proxies.** Proxies exist for the API limit, not for delivery.
5. **Verify what a slot clip actually shows** (a still or the analysis description) before wiring
   it — a "keep=8 establishing shot" window opened on near-black and shipped a black corner box
   until the stills gate caught it.

## Self-evaluation (code is ground truth)

1. `studio/tools/analyse_clip.py` exists and its docstring names the venv invocation and cost
   logging → read the header.
2. `gemini_video.py` has `INLINE_MAX_BYTES = 18MB` and a Files-API branch above it → grep.
3. The worked artifacts exist: `studio/projects/splitfire/analysis/MOMENTS.md` (fine-pass index
   with original-time windows) and `studio/projects/splitfire/candidates-new/` (moment-named cuts).
4. The fine pass used 30s chunks → `studio/projects/splitfire/analysis/fine/` holds `a00…b11`
   chunk JSONs.
5. The bundled ffmpeg still lacks the segment muxer → `ffmpeg -f segment` errors; the chunk loop in
   this skill stays `-ss/-t`.

## Changelog (append-only — newest first)

- v2 (2026-07-19): BangBop advert re-cut from a new gameplay recording. Two lessons:
  (1) **Browser-window captures carry CHROME + PRIVATE UI.** The recording was a Chrome
  window (game runs at a URL), so every frame had the tabs, the bookmarks bar (personal
  links: "Request access…", "Application Form…"), and the URL bar across the top ~140px.
  That MUST be cropped before the footage enters a published cut — both because it looks
  like "old TV in a browser" and because it leaks private info. Recipe: `crop=1918:936:0:142`
  (tune the offset to the chrome height), then let the composition's punch-in/objectFit
  cover reframe. **Always eyeball a still of window-captured footage for chrome + private
  tabs/bookmarks before cutting.** (2) Re-slotting 5 picks into a 6-slot EDL: keep the
  fixed sync anchors (drop frame, CTA start, lower-third/SFX frames) and only re-time the
  INTERNAL cut boundaries on the beat grid so total frames are unchanged — the crash/kill
  labels + explosion SFX then stay put with zero extra edits.
- v1 (2026-07-18): Created from the Splitfire advert triage (10 clips + an 11-min recording →
  MOMENTS.md → 10 candidates → 5 owner picks). Root lessons baked in: owner's c01 correction
  (moments not scenes); Gemini timestamp drift on long clips (bounded by 30s chunks); Files-API 403
  vs inline (proxies under 18MB); 503 fallback to non-lite flash; black-window candidate caught by
  the stills gate (verify slot clips). Costs measured: ~$0.06 for a full 16-min two-pass triage.
