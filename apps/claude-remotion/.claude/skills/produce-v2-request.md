---
name: produce-v2-request
description: Action a video_production_request_v1 (v2, outputs[]) from socials-studio end-to-end — ingest the request, render every output (hero + spokes) via the right pipeline, deliver each with the grouping keys (request_id/output_id/role/promotes), verify the campaign routing, clean up, and log costs. The PRODUCER-side mirror of socials-studio's video-pipeline skill. Proven on the first real run (ai-top5-2026-07-07).
metadata:
  tags: bridge, outputs, request, producer, publish-handoff, ingest-requests, ai-top5, hero, spoke, campaign
---

## When to use

A `<task-notification>`/owner message says a production request landed, or the owner says "run the
daily / action the request". Requests arrive as
`studio/requests/incoming/<id>/request.json` (schema `video_production_request_v1`, version 2 =
`outputs[]`). **Real videos are ONLY produced against a request** — pb does not freelance deliverables
(tests/dev builds excepted). Never render without the owner's go or a request that commissions it.

## Contract facts (memorise, don't re-read the contracts every time)

- **v2 request:** `outputs[]`, one entry per deliverable. Each has `output_id`, `role`
  (hero|spoke|equal), `platforms[]`, `aspect`, `edit.style`, optional `duration_s`/`max_duration_s`,
  optional `promotes` (the hero's output_id), and a resolved **`_profile`** (dimensions/fps/duration/
  safe_zones) — **consume `_profile` as the single source for geometry; never hand-maintain a parallel
  formats matrix** (acceptance Term 1).
- **`edit.style` enum we support:** `full-show` (the existing full composition) and `hook-first`
  (the purpose-built teaser). Anything else → warn + fall back to full-show, never silently wrong
  (Term 2). The intake (`ingest-requests.mjs`) already flags unsupported styles in QUEUE.md.
- **Per-output VO is OURS:** a shorter output gets a NEW short script/VO, never a trim of the hero
  (Term 3). `video.brief.voiceover_notes` is guidance, not the script.
- **Delivery:** one mp4 per package via `publish-handoff.mjs`, each carrying
  `--request-id <id> --output-id <output_id> --role <role> [--promotes <hero-id>]`. These keys are
  what routes the file into `socials-studio/campaigns/<slug>/media/<post>/<output_id>.mp4`.
- **Read the `campaign.stakeholder_notes` + `video.cta`** — they are the brief's intent (e.g. the
  ai-top5 CTA is "explore the feed and vote at solvx.uk", NOT "vote on tomorrow's top 5"). Flag in the
  completion report anything the video only partially honours.

## The run (proven sequence — ai-top5 example)

From `apps/claude-remotion/`:

1. **Ingest + read:** `node scripts/ingest-requests.mjs` → read
   `studio/requests/incoming/<id>/request.json` in full (stakeholder notes, outputs, profiles).
2. **Populate the edition** (pipeline-specific): ai-top5 →
   `node scripts/make-ai-top5.mjs --ai-script --with-audio` (fetches the live API, writes data.ts +
   data.json, generates script + VO; logs its own API cost).
3. **Render the hero:** `npx remotion render AiTop5 out/ai-top5_<date>_ed<N>.mp4` (background task).
4. **Spokes:** the ai-top5 9:16 spoke and its generator were retired — everything it did is
   covered by `VerticalAdvert`, which renders both aspects from one registration. A vertical cut of
   an edition is authored as a VerticalAdvert beat sheet.
5. **Refresh the record:** `node scripts/record-ai-top5.mjs --video out/<hero>.mp4` — the
   VIDEO_RECORD must match the render (frames/duration). ⚠️ The timeline moved out of `tokens.ts`
   into `grid.ts` and is expressed in BEATS; `describeLayout()` there prints the authoritative
   per-story frame ranges.
6. **Deliver EVERY output** (verify streams first if anything changed — ffprobe via
   `scripts/ffmpeg-bin.mjs`):
   - hero: `node scripts/publish-handoff.mjs --video out/<hero>.mp4 --request-id <id> --output-id yt-hero --role hero`
   - spoke: `node scripts/publish-handoff.mjs --video out/<spoke>.mp4 --request-id <id> --output-id ig-spoke --role spoke --promotes yt-hero --id-suffix ig-spoke`
   - **Gotcha:** same-pipeline deliveries derive the SAME package id (date+edition) — every non-hero
     output needs `--id-suffix <output_id>` or it overwrites the hero's package.
7. **Ingest on the socials side:** `cd $SOCIALS_STUDIO_DIR && py ingest_handoffs.py`
   then **verify the routing landed**: files exist at
   `socials-studio/campaigns/<slug>/media/<post>/<output_id>.mp4` and `py campaign.py status <slug>`
   shows the media count. Publishing stays HUMAN sign-off — never touch POST_QUEUE beyond ingest.
8. **Clean up:** delete `studio/requests/incoming/<id>/` (per QUEUE.md instruction) and re-run
   `ingest-requests.mjs` to refresh the queue.
9. **Log costs PER VIDEO (both surfaces, always) — do NOT lump:** provider costs are logged by the
   make-scripts. Agent tokens: run `node ../../studio/tools/token-report.mjs --label "<video>"`
   **immediately after each individual video finishes rendering** — one report per output (hero, then
   each spoke), and one per custom/one-off video — so every video gets its OWN delta in
   `studio/logs/runs.jsonl`. The delta is "since the last logged entry", so if you render two videos and
   only report once, the two costs are lumped into one unattributable figure (this happened
   2026-07-08 — see [[feedback_api_usage_always_logged]]). Per-video cost attribution is a core part of
   the cost-instrumented design, not optional. Commit `runs.jsonl`.
10. **Report** with FULL absolute paths for every file the owner should watch
    (`$SOCIALS_STUDIO_DIR\campaigns\...`), checks run, commit hashes, costs, and
    any spec gaps (e.g. spoke duration vs the profile's ideal_s, CTA partially honoured).

## Known gaps to flag (current state)

- The ai-top5 `hook-first` spoke is ~15s vs the instagram profile's ideal 45s — deliver + flag until
  the teaser retune lands.
- The request CTA / stakeholder framing is not yet fed into the show's script-writer — socials' copy
  carries it; note it in the report each run until wired.

## Related
- `studio/contracts/OUTPUTS_CONTRACT_ACCEPTANCE.md` — the three accepted terms.
- `studio/contracts/video_production_request_v1.md` / `finished_video_publish_v1.md` — the schemas.
- socials-studio `.claude/skills/video-pipeline.md` — the consumer-side mirror of this skill.
- [[multiformat-story-video]] — building a NEW multi-format video (vs producing a requested one).
- [[record-final-video]] — the completion-report shape after any render (post-render report).
