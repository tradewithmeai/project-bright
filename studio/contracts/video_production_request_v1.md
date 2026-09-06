# Contract — `video_production_request_v1`

The **return bridge**: socials-studio (the marketing brain — campaigns, goals, performance) → project-bright
(production). It is the mirror of `finished_video_publish_v1`. Together they close the loop:

```
socials-studio  ──[ video_production_request_v1 ]──▶  project-bright   (commission: what to make + why)
project-bright  ──[ finished_video_publish_v1  ]──▶  socials-studio    (deliver: the finished video)
socials-studio  ── publishes + monitors ──▶ performance feeds the NEXT request
```

The point: production should be **goal-focused and well-framed**, carrying the marketing stakeholder's
intent — not just "make a video." This format is how that intent travels.

## Transport (mirror of the publish bridge)

A drop-folder on the same machine — socials-studio writes INTO project-bright's tree:

```
<project-bright>/studio/requests/incoming/<id>/
  ├── request.json      THIS contract
  └── assets/           optional — footage/stills/brand the request references (or pointers in request.json)
```

- Emitter: socials-studio (its Claude; spec passed over — it already plans/queues/monitors posts).
- Intake: project-bright `scripts/ingest-requests.mjs` → surfaces requests into `studio/requests/QUEUE.md`
  for the operator/Claude to action. It never auto-produces — a human/operator picks what to build.
- Root resolves from `$PROJECT_BRIGHT_DIR` (default `<repo>`).

## `request.json` schema

```jsonc
{
  "schema": "video_production_request_v1",
  "version": 1,
  "id": "camp-ai-top5-launch-001",     // stable per request; re-emit overwrites
  "requested_at": "2026-07-05T10:00:00Z",
  "requested_by": "socials-studio",
  "status": "requested",               // requested | accepted | in_production | delivered | declined
  "priority": "high",                  // high | normal | low
  "needed_by": "2026-07-06T18:00:00Z", // when production is needed; null = no deadline

  // WHY — the marketing frame. This is what makes production goal-focused.
  "campaign": {
    "id": "ai-top5-launch",
    "name": "AI Top 5 — flagship launch",
    "goal": "launch",                  // awareness | recruitment | launch | engagement | retention | conversion
    "kpi": "sign-ups from the daily-news hook; comments/votes on the story set",
    "stakeholder_notes": "Lead with the build-in-public angle ('I built an AI that makes a daily news show'), not the news itself. Funnel to solvx.uk."
  },

  // WHAT — the video. `type` is an OPEN, extensible hint; `brief` is a free-form escape hatch so the
  // format stays DYNAMIC (any video the studio can make, without a schema change per type).
  "video": {
    "type": "ai-top5-daily",           // ai-top5-daily | promo | explainer | montage | announcement | teaser | recap | free
    "working_title": "AI Top 5 — launch cut",
    "angle": "build-in-public",        // the framing thread (build-in-public / build-by-public / product / testimonial …)
    "key_message": "A daily AI news show, made automatically. The public shapes it.",
    "hook": "I built an AI that makes a daily news show.",   // optional suggested hook
    "cta": "Watch daily + vote on tomorrow's stories at solvx.uk",
    "must_include": ["the five stories", "the voting/build-by-public beat"],
    "avoid": ["framing it as breaking news (content may be a day old)"],
    "brief": { }                        // free-form: anything the type/fields above don't capture
  },

  // WHO — audience + ownership (mirrors the publish bridge's audience field).
  "audience": { "who": "AI builders / indie hackers", "owner": "own", "client": null },

  // HOW — format + destination platforms (drives aspect/duration/cut decisions).
  "format": { "aspect": "16:9", "target_duration_s": 100, "platforms": ["youtube", "twitter", "bluesky"] },

  // FROM WHAT — source material (or "generated" for pipelines like AI Top 5).
  "source": {
    "kind": "generated",               // generated | footage | web-capture | mixed
    "assets": [],                       // paths/pointers to footage/stills folders, or []
    "brand_ref": null                   // pointer to a brand.json (e.g. a client's) or null
  },

  // OPTIONAL — performance context so framing is data-informed (from socials-studio monitoring).
  "performance_context": {
    "notes": "Short build-in-public clips outperform polished explainers 3:1 on Bluesky.",
    "top_performers": []
  }
}
```

## How it drives production
project-bright's Claude reads `request.json` and routes to the right pipeline by `video.type`:
- `ai-top5-daily` → the make-ai-top5 → render → record flow, framed per `campaign` + `video.angle`.
- `promo` / `montage` → the footage pipeline (analyse_folder → cast_promo → build), using `source.assets`.
- `explainer` → web-capture route.
- `free` / anything else → the operator + `video.brief` free-form.
The `campaign` + `video` framing shapes the COPY (VO, on-screen, CTA) so it serves the goal — that's the
"better framing / marketing-stakeholder input" this bridge exists for.

## Closing the loop
When project-bright delivers via `finished_video_publish_v1`, it SHOULD set `request_id` to this request's
`id` (add the field to that contract). socials-studio's `ingest_handoffs.py` can then match the delivered
video back to the campaign that commissioned it — request → produce → deliver → publish → monitor, tracked.

## Versioning
`schema` + `version` explicit. Additive fields are non-breaking; a shape change bumps `version`. The
`video.type` list and `video.brief` free-form are the dynamic escape hatches — new video types need NO
schema change.
