# Contract — `finished_video_publish_v1`

The handoff shape for the **outgoing publish bridge**: project-bright (video studio) → socials-studio
(publisher). This is the ONE load-bearing artifact of the bridge. It pairs a finished, distribution-ready
`.mp4` with the metadata a publisher needs. It is deliberately NOT the editor bridge
(`video_bright_*_project`) — that carries editable timeline slots; this carries a finished video + how to post it.

## Transport (v1)

A **drop-folder handoff** on the same machine — no server, no auth, no network:

```
<socials-studio>/handoffs/incoming/<id>/
  ├── video.mp4        the finished render (hardlinked if same drive, else copied)
  ├── thumb.jpg        a poster frame (best-effort; may be absent)
  └── publish.json     THIS contract
```

- Emitter: `apps/claude-remotion/scripts/publish-handoff.mjs` (project-bright).
- Intake: `ingest_handoffs.py` (socials-studio) — lists pending handoffs into its POST_QUEUE for
  **human sign-off**. The bridge NEVER auto-publishes (socials-studio rule: "Always show copy + media
  for explicit sign-off before publishing"). Full automation is a later, per-campaign opt-in.
- Destination root resolves from `$SOCIALS_STUDIO_DIR`, default `$SOCIALS_STUDIO_DIR`.

## `publish.json` schema

```jsonc
{
  "schema": "finished_video_publish_v1",
  "version": 1,
  "id": "ai-top5-20260703-ed3",   // stable per video (pipeline-date-edition); re-emit overwrites
  "produced_at": "2026-07-03T17:40:00.000Z",
  "status": "pending_review",     // pending_review | approved | published (socials-studio owns transitions)
  "audience": "own",              // own = post to solvX's channels | client = deliver to client, NEVER post to solvX
  "client": null,                 // subject/client name — set for a client deliverable OR a solvX showcase-of-client-work
  "request_id": null,             // the video_production_request_v1 id this delivers (loop closure), or null
  "source": {
    "app": "project-bright",
    "pipeline": "ai-top5",
    "render_path": "D:/…/out/ai-top5_2026-07-03_ed3.mp4"  // original, for provenance
  },
  "video":     { "file": "video.mp4", "duration_s": 103.0, "width": 1920, "height": 1080, "fps": 30 },
  "thumbnail": { "file": "thumb.jpg" },                    // null if none produced
  "title": "AI Top 5 — 3 July 2026 (Edition 3)",
  "description": "The day's biggest AI news, counted down…\n\n#5 …\n#1 …\n\n▶ solvx.uk",
  "tags": ["AI", "news", "buildinpublic", "…"],
  "hub_url": "https://solvx.uk",
  "rundown": [ { "n": 5, "headline": "…", "category": "…" }, … ],  // the five stories (may be empty)
  "platforms": [
    // SEED captions only — socials-studio's own copy skills (post-offthecuff / multi-platform-post)
    // refine each to its platform voice. `enabled` is a suggestion; the operator decides at sign-off.
    { "platform": "youtube",   "enabled": true,  "suggested_caption": "…" },
    { "platform": "twitter",   "enabled": true,  "suggested_caption": "…" },  // ≤280
    { "platform": "bluesky",   "enabled": true,  "suggested_caption": "…" },  // ≤300
    { "platform": "instagram", "enabled": true,  "suggested_caption": "…" },
    { "platform": "linkedin",  "enabled": false, "suggested_caption": "…" }
  ]
}
```

## Audience: own vs client (why this matters)

The socials-studio drop folder is solvX's OWN publishing queue (@solvXuk / solvx.uk accounts). A
**client** video — one whose brand, site, and handles are the client's (e.g. a client promo →
their own domain and handles) — must NEVER be posted to solvX's accounts. So every handoff
declares `audience`:
- `own` — solvX content; the bridge queues it for posting to solvX's channels. A build-in-public
  *showcase* of client work is still `own` (it posts to solvX, with solvX-framed captions), and sets
  `client` to name the subject.
- `client` — a client deliverable; `ingest_handoffs.py` segregates it under a "DO NOT POST to solvX"
  section and never puts it in the post queue. It's handed to the client, not published by us.

The 2026-07-03 near-miss (a client promo emitted into solvX's own-content drop folder,
caught by the socials-studio sign-off gate) is exactly what this field prevents structurally.

## Division of labour (why the captions are only "suggested")

The video studio owns the FACTS (finished file, title, headline rundown, tags, thumbnail, hub link)
and a first-draft caption. socials-studio owns the VOICE — its `post-offthecuff` / `feature` /
`multi-platform-post` skills rewrite each platform's copy against its sensation filter, and a human
signs off before anything ships. The bridge moves the video + facts; it does not decide the final copy.

## Versioning

`schema` + `version` are explicit so the intake can reject/upgrade. Additive fields are non-breaking;
a shape change bumps `version` and adds a `finished_video_publish_v2.md` alongside this file.
