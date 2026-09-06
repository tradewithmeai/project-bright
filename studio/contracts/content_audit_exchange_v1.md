# Contract — content-audit exchange (`content_audit_request_v1` → `content_audit_v1`)

The fourth bridge, closing the **content-audit loop**. socials-studio scrapes + filters a brand's own
recent social content and drops it here; **project-bright catalogues it with Gemini + scores
completeness** and returns the audit. Feeds video creation (what assets exist) AND marketing (coverage,
blind spots). Mirrors the socials Claude's MVP (`audit_content.py` / `ingest_audits.py`).

```
socials-studio ──[ content_audit_request_v1 + media ]──▶ project-bright/studio/audits/incoming/<id>/
project-bright ──[ content_audit_v1 (catalogue+completeness) ]──▶ socials-studio/handoffs/audits/incoming/<id>/
```

## Transport
- request in → `<project-bright>/studio/audits/incoming/<id>/` containing `manifest.json`
  (`content_audit_request_v1`) + the downloaded media files.
- audit out → `<socials-studio>/handoffs/audits/incoming/<id>/content_audit.json` (`content_audit_v1`).
- project-bright processor: `apps/chatty-susan/process_audit.py` (Gemini catalogue + completeness).
  Delete the incoming folder once returned.

## `content_audit_request_v1` (socials-studio → project-bright) — the manifest
```jsonc
{
  "schema": "content_audit_request_v1", "version": 1,
  "id": "audit-solvx-20260705",
  "requested_by": "socials-studio",
  "requested_at": "2026-07-05T...Z",
  "brand": "solvX",
  "scope": "own",                       // own | client
  "filter": { "recency_days": 90, "own_only": true, "cap": 50 },
  "items": [
    { "item_id": "bsky-abc", "file": "media/bsky-abc.jpg", "platform": "bluesky",
      "date": "2026-07-01", "caption": "…", "engagement": { "likes": 3 } }
  ]
}
```
(`file` is relative to the audit folder. socials-studio's existing `manifest.json` maps 1:1 — path→file,
plus caption/date/platform per item.)

## `content_audit_v1` (project-bright → socials-studio) — the catalogue + score
```jsonc
{
  "schema": "content_audit_v1", "version": 1,
  "id": "audit-solvx-20260705", "request_id": "audit-solvx-20260705",
  "processed_at": "2026-07-05T...Z",
  "brand": "solvX", "items": 12,
  "catalogue": [
    { "item_id": "bsky-abc", "platform": "bluesky", "date": "2026-07-01",
      "media_kind": "image",            // image | video
      "content_type": "text_graphic",   // hero_product | people | logo | b_roll | text_graphic | lifestyle | screenshot | other
      "subject": "…", "summary": "…", "on_screen_text": "…",
      "usable_as": ["thumbnail", "b-roll"], "quality": "medium" }
  ],
  "completeness": {
    "score": 0.5,                        // 0..1 — fraction of the target content categories present
    "by_category": { "hero_product": 0, "people": 1, "logo": 0, "b_roll": 3, "text_graphic": 6,
                     "lifestyle": 0, "screenshot": 2 }
  },
  "omissions": ["no logo usage in recent content", "no people / lifestyle shots",
                "no hero product footage"],
  "usage": { "provider": "google", "items": 12, "cost_usd": 0.03 }
}
```

## The two lanes (don't cross)
- **socials-studio** — scrape (authed session) + filter + manifest + read the returned audit into a
  marketing report. (`audit_content.py`, `ingest_audits.py`.)
- **project-bright** — Gemini catalogue + content-type classification + completeness/omissions.
  (`process_audit.py`.) Runs on project-bright's Gemini key; logs cost (always-log-API-cost rule).

## Completeness (MVP heuristic)
Target categories a brand video typically needs: `hero_product`, `people`, `logo`, `b_roll`,
`text_graphic`, `lifestyle`. `score` = present categories / target categories; `omissions` = the empty
ones. Crude on purpose — the full audit model (weighting, demographic/campaign coverage) comes later.
