---
description: Produce today's AI Top 5 edition via a background agent, and log the run
argument-hint: "[YYYY-MM-DD]  (optional — defaults to today)"
---

Launch a **background agent** to produce the AI Top 5 daily edition, then have it record the run
so we build a reliability history.

⚠️ The 9:16 spoke was retired along with the `AiTop5Teaser` composition and
`scripts/make-ai-top5-teaser.mjs`. This routine produces ONE video. A vertical cut of an edition is
authored as a `VerticalAdvert` beat sheet instead.

Target date: **$ARGUMENTS** — if that is empty, use today's date. Edition 1 unless told otherwise.

Call the `Agent` tool (`subagent_type: general-purpose`) with the brief below, substituting the
date everywhere `<DATE>` appears and the compact form `YYYYMMDD` where `<DATESTAMP>` appears.
Do not run the production steps yourself — the point of this command is that the agent does it,
unattended, the same way every day, so its failures are measurable.

Then tell the operator it is running and stop. Report only when the completion notification
arrives, and relay what the agent actually found — including anything that went wrong.

---

## THE BRIEF TO PASS TO THE AGENT

Produce the AI Top 5 daily edition for **<DATE>**, edition 1, for Project Bright. This is an
established daily routine. Follow it exactly. Do not improvise, optimise, or "improve" anything.

Working directory for all commands: `apps/claude-remotion`

### Steps, in order

0. **PRE-FLIGHT: check the feed date BEFORE spending anything.** Run:

   ```
   py -c "import json,urllib.request; d=json.load(urllib.request.urlopen('https://solvx.uk/api/ai-news.json',timeout=20)); print('feed date:', d.get('date'))"
   ```

   **If that command throws (JSON decode error, timeout, connection reset), run it ONCE more before
   concluding anything.** On 2026-08-04 the first fetch raised a `JSONDecodeError` at char 0 and the
   immediate retry returned a clean 200 with the correct date. A bare exception is not evidence the
   feed is stale — treating it as one skips a perfectly good edition. Only a SUCCESSFUL fetch showing
   the wrong date is a block. If the second attempt also throws, report the error and stop.

   If the printed date is **not `<DATE>`**, STOP IMMEDIATELY. Do not run step 1. Report the feed
   date, the current UTC time, and that the run is blocked pending the aggregator. Do not force a
   date override — that would relabel yesterday's stories as today's, which is worse than no
   edition.

   **Why this step exists:** on 2026-07-27 the feed had not refreshed, but `make-ai-top5.mjs`
   generates the voiceover *before* anything checks the date, so **3,592 ElevenLabs credits were
   spent re-voicing yesterday's stories** and `public/vo/*.mp3` was overwritten with takes nobody
   wanted. The script reported the stale date correctly — it was simply never asked first.
   The feed does **not** refresh at 06:30 UTC as the old runbook claims; observed generation is
   nearer **08:56 UTC**, so an early run is a live risk, not a theoretical one.

1. `node scripts/make-ai-top5.mjs --ai-script --with-audio`
   **Both flags are required.** Without them it rewrites `data.ts` and silently reuses the
   PREVIOUS day's voiceover. Confirm the output shows date `<DATE>` and `voiceovers=5/5`.
   Capture the five headlines with their categories, and the ElevenLabs cost/quota line verbatim.

1b. **Check the voice before you render it.** Run:

   ```
   node scripts/check-vo.mjs --dir public/vo
   ```

   It is free, takes seconds, and reads every take's amplitude envelope. It reports each line as
   `ok`, `TRUNCATED — ends mid-word`, `CLIPPED HEAD` or `SILENT`, and writes `public/vo/vo.check.json`.

   **Why this step exists:** on 2026-08-05 two of six lines in another project's voiceover ended
   MID-WORD — ElevenLabs began another word and the file simply stopped — and it reached a finished
   render before a human heard it at 41.8s. Nothing in the pipeline could see it: the files were
   ordinary durations and the frame counts were right. A stutter costs a full re-render to fix here
   and nothing at all to catch at this step.

   **If any line reports TRUNCATED**, run `node scripts/check-vo.mjs --dir public/vo --fix` (it trims
   back to the end of the last real word and keeps the original as `*.untrimmed.mp3`; no API call, no
   cost), then re-run the check and report both the before and after. **Do NOT re-run
   `make-ai-top5.mjs`** — that regenerates every take and desyncs the record.

   Report the verdict line for all takes either way, including when they all pass.

2. `npx remotion render AiTop5 out/ai-top5_<DATE>_ed1.mp4`
   1920x1080. Takes a few minutes — let it finish.
   The length FOLLOWS THE MEASURED VOICEOVER, so it varies day to day: report what it is rather
   than matching a target. A silent edition (no VO generated) is 3150 frames / 105.00 s exactly;
   a voiced one is longer, because each story grows to carry its own clip.
   The timeline is derived in `src/templates/ai_top5/grid.ts` from a 124 BPM grid, in whole beats.
   `describeLayout()` there prints the per-story breakdown if a length looks wrong.

3. `node scripts/record-ai-top5.mjs --video out/ai-top5_<DATE>_ed1.mp4`

   Writes a **v2** record (`schema: video_record_v2`) with stable section ids, which step 5b needs.
   Confirm it reports `timeline_confidence: exact`. If it prints a NOTE about absorbing a few frames
   into the sign-off, that is fine and expected. If it prints a WARN about more than one beat of
   drift, **stop and report it** — `grid.ts` has changed since the render and the parts must not be
   cut from an approximate timeline.

3b. **Render the edition as its parts, so it can be reviewed.** Run:

   ```
   node scripts/render-sections.mjs --record ../../studio/projects/ai-top5/records/VIDEO_RECORD.json --concurrency 2
   ```

   This re-renders each of the 7 sections (`cold-open`, `story-5` … `story-1`, `sign-off`) as its own
   mp4 under `out/sections/AiTop5/`, and marks each one `produced` in the record **after every part**,
   so a run that dies halfway leaves a record saying exactly which parts exist. Takes ~8 minutes.

   Expect `7/7 produced`. Each part is verified against its own VIDEO STREAM frame count, not the
   container duration — a part reported `length-mismatch` is a real problem; report it, do not fix it.

   **Why:** the reviewer (`node scripts/serve-reviewer.mjs`, then `http://127.0.0.1:5199/`) can only
   open a video that has rendered parts. Without this step the one video produced every single day is
   the one video that cannot be reviewed section by section.

   The section **ids are stable across editions** — `story-1` is always the number-one story whatever
   the headline — so verdicts can be compared day to day.

4. Deliver to the socials queue:

   `node scripts/publish-handoff.mjs --video out/ai-top5_<DATE>_ed1.mp4 --request-id ai-top5-<DATE> --output-id yt-hero --role hero`

   **Historical note, kept because it is why the next step verifies rather than assumes.** While
   this routine also produced a spoke, its handoff needed `--id-suffix ig-spoke`; without it the
   spoke resolved to the SAME handoff id as the hero and silently overwrote it. On 2026-07-26 a
   37 MB hero was replaced by a 1.4 MB spoke and the tool printed success both times. A green
   console line was not evidence then and is not now.

5. **Verify — do not assume.** This directory must exist:
   - `$SOCIALS_STUDIO_DIR\handoffs\incoming\ai-top5-<DATESTAMP>-ed1`

   It must contain `video.mp4`, `thumb.jpg`, `publish.json`. Report the `video.mp4` size — it must
   be tens of MB — and confirm `output_id`/`role` in `publish.json` (`yt-hero`/`hero`).

6. **Log the run** — append one line to
   `<repo>\studio\projects\ai-top5\records\daily_runs.jsonl`:

   ```json
   {"date":"<DATE>","edition":1,"ok":true,"stories":[{"rank":1,"category":"","headline":""}],
    "hero":{"frames":0,"seconds":0,"mb":0},
    "vo":{"chars":0,"credits":0,"quota_used":0,"quota_total":30000,"revoiced_hooks":0,
          "revoiced_news":0,"worst_passes":1},
    "handoff":{"hero_mb":0},
    "retries":[],"anomalies":[],"agent_minutes":0}
   ```

   **Take `quota_used` AND `quota_total` from the quota line step 1 actually printed** — do not
   copy the number above. It is a placeholder showing the current 30,000 starter tier, and it was
   `131000` from an older plan for five days after the account changed, so five runs logged a
   quota headroom that did not exist. The printed line is the only authority; if it disagrees with
   this template, the template is the stale one and should be corrected in the same session.

   Set `ok:false` if any step needed a retry or produced a wrong result. Put every retry and every
   oddity in `retries`/`anomalies` **even if you recovered from it** — the value of this log is
   the failures, not the successes. A run that needed one retry and then worked is NOT a clean run.

7. **Complete the handoff into socials-studio.** Run:

   ```
   cd $SOCIALS_STUDIO_DIR && py ingest_handoffs.py
   ```

   Then confirm today's package appears in the printed list. Report its status verbatim.

   **This does NOT publish.** `ingest_handoffs.py` routes the delivered media into
   `campaigns/ai-top5/media/<post>/` and regenerates the managed block in `POST_QUEUE.md` so the
   edition is visible for sign-off. Publishing is a separate, human-triggered step
   (socials-studio's `/top5publish`). Re-running is idempotent — the queue is rebuilt from disk.

   Expect today's edition to show `requested`. That is correct: status is DERIVED from the
   campaign post, and the post only becomes `published` once the publisher writes its
   `posted_ids`. Nobody marks anything by hand.

### Hard constraints

- **STOP after the INGEST.** Do not publish, post, or approve — nothing reaches any social
  platform. The ingest itself is safe and is step 7: it only makes the edition visible for
  sign-off. Leaving it undone was a manual step with no purpose, since the operator then had to
  run it by hand anyway before anything could be reviewed.
- **Do not git commit or push.** The operator owns commits.
- **Do not edit any source file, template, or config.** If something is broken, stop and report it.
- Do not re-run `make-ai-top5.mjs` after rendering — it regenerates VO and desyncs the record.

### Report back

- The five stories: rank, CATEGORY, headline
- The edition: frames / duration / file size
- **The ElevenLabs cost line verbatim** (characters, credits this run, quota remaining). Every
  paid API call gets its usage recorded — this is a standing project rule.
- **Voice-trial watch:** how many hooks and news reads the fit-to-window guard had to re-voice,
  and how many passes the worst one needed. A new, slower presenter voice is on trial; the guard
  quietly shortening copy every day is exactly what we are watching for.
- **Edge-trim watch (NEW 2026-08-03, first run is 2026-08-04):** `generate-vo.mjs` now strips the
  silence ElevenLabs pads onto every take before measuring it, so the hook cap applies to speech
  rather than speech-plus-padding. Report the `edge-trimmed … (-Nf of TTS padding)` lines, and
  **specifically whether #1's hook survived with its flourish** instead of collapsing to a bare
  "Number 1!" — it had done so for five consecutive days before this change, and the expectation
  is that ~9-12f of recovered headroom is enough to fit it. If #1 still collapses, say so plainly:
  the prediction was wrong and the 75f cap needs raising for real.
- **The VO check (step 1b):** the verdict for every take, and whether anything had to be trimmed.
- **The parts (step 3b):** `N/7 produced`, and any part reporting `length-mismatch`.
- The handoff path with its `video.mp4` size and confirmed `output_id`/`role`
- Anything that failed, was retried, or looked wrong. **Report problems plainly. Do not paper over
  them and do not claim success you have not verified.**
