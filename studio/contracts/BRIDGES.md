# The bridges — project-bright ⇄ socials-studio (master map)

The two apps stay **separate but connected**, talking ONLY through JSON drop-folder contracts. This is
the index — read it first to see the whole system without hunting through files.

- **project-bright** = the video-production studio (rendering, VO, music, footage, brand capture).
- **socials-studio** = the marketing brain (campaigns, social scraping, monitoring, publishing).
- No shared runtime, no shared DB. Each drops a folder into the other's tree; the other picks it up.
  Nothing auto-publishes or auto-produces — a human/operator gates each step.

```
                     ┌──────────────── socials-studio (marketing) ────────────────┐
   commission ──────▶│ 2. video_production_request_v1                              │
                     │ 3a. brand_pack_request_v1     4a. content_audit_request_v1  │
                     └───────────────────────────────┬────────────────────────────┘
                                                      │  JSON + media in drop folders
                     ┌───────────────────────────────▼────────────────────────────┐
   deliver ─────────▶│ 1. finished_video_publish_v1  3b. brand_pack_v1            │
                     │                               4b. content_audit_v1          │
                     └──────────────── project-bright (production) ────────────────┘
```

## The four bridges

### 1. Publish — `finished_video_publish_v1`  (project-bright → socials-studio)
Deliver a finished video for posting. Contract: `finished_video_publish_v1.md`.
- **project-bright emits:** `apps/claude-remotion/scripts/publish-handoff.mjs` → drops
  `video.mp4 + thumb.jpg + publish.json` into `<socials-studio>/handoffs/incoming/<id>/`.
  Flags: `--audience own|client`, `--client <name>`, `--request-id <id>` (loop closure).
- **socials-studio intakes:** `ingest_handoffs.py` → surfaces into `POST_QUEUE.md` for **sign-off**
  (never auto-publishes). `audience: client` videos are segregated as **DO NOT POST**.

### 2. Commission — `video_production_request_v1`  (socials-studio → project-bright)
Ask production to make a video, carrying the marketing frame (goal/KPI/stakeholder notes/angle).
Contract: `video_production_request_v1.md`. Emitter spec: `../requests/README.md`.
- **socials-studio emits** (their `request_video.py`) → `<project-bright>/studio/requests/incoming/<id>/request.json`.
- **project-bright intakes:** `apps/claude-remotion/scripts/ingest-requests.mjs` → `studio/requests/QUEUE.md`.
- Routes by `video.type` (ai-top5-daily / promo / explainer / …); delivered back via bridge #1 with `request_id` set.

### 3. Brand capture — `brand_pack_request_v1` → `brand_pack_v1`  (round trip)
socials asks for a site's brand; project-bright captures it. Contract: `brand_pack_exchange_v1.md`.
- **socials-studio requests** → `<project-bright>/studio/brand-packs/requests/incoming/<id>/`.
- **project-bright captures:** `apps/video-bright-mvp/backend/scripts/run-brand-pack.ts` (strict path)
  / `runMediaScraper` (open path) → returns `brand_pack_v1` to `<socials-studio>/handoffs/brand-packs/incoming/<id>/`.
  Asset files (logo/fonts) stay project-bright-side; socials gets the manifest. Fills a campaign pack's `branding`.

### 4. Content audit — `content_audit_request_v1` → `content_audit_v1`  (round trip)
socials scrapes + filters a brand's own recent content; project-bright catalogues it + scores completeness.
Contract: `content_audit_exchange_v1.md`.
- **socials-studio emits:** `audit_content.py` → `<project-bright>/studio/audits/incoming/<id>/` (manifest + media).
- **project-bright processes:** `apps/chatty-susan/process_audit.py` → Gemini catalogue + completeness +
  omissions → `content_audit_v1` to `<socials-studio>/handoffs/audits/incoming/<id>/`.
- **socials-studio reads:** `ingest_audits.py` → marketing report (assets to reuse + coverage blind spots).

## The loop (how they compose)
```
audit (4) → surfaces content gaps ─┐
brand capture (3) → branding ──────┤
                                   ├─▶ commission (2) → production → deliver (1) → publish + monitor
performance/monitoring ────────────┘        ↑______________ feeds the next commission ______________│
```
Marketing (socials-studio) commissions goal-framed video; production (project-bright) makes it on-brand,
delivers it back; socials publishes + monitors; performance + audits shape the next request.

## State (2026-07-05)
| Bridge | project-bright side | socials-studio side |
|---|---|---|
| 1 publish | ✅ publish-handoff.mjs | ✅ ingest_handoffs.py |
| 2 commission | ✅ ingest-requests.mjs | ✅ request_video.py |
| 3 brand-pack | ✅ run-brand-pack.ts (capture; exchange wiring TODO) | ⏳ request/read (campaign-pack branding block) |
| 4 content-audit | ✅ process_audit.py | ✅ audit_content.py / ingest_audits.py |

All contracts live in `studio/contracts/`. All tools are indexed in `studio/STUDIO.md`.
