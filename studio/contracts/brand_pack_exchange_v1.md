# Contract — brand-pack exchange (`brand_pack_request_v1` → `brand_pack_v1`)

The third bridge, aligning with the socials Claude's proposed seam (`campaign_packs/BRANDING.md`).
socials-studio (marketing) declares it needs branding for a site/campaign; **project-bright captures it**
(via video-bright's brand-pack engine, which lives here) and returns a BrandPack. This fills the
campaign pack's `branding` block so repeatable video assets render on-brand.

```
socials-studio  ──[ brand_pack_request_v1 ]──▶  project-bright   (capture brand for site X, campaign Y)
project-bright  ──[ brand_pack_v1          ]──▶  socials-studio   (logo/colours/fonts/taglines/motifs)
```

Same drop-folder pattern as the video bridges. **Assets (logo/font files) STAY project-bright-side**
(that's where rendering happens); socials-studio receives the JSON manifest + refs and sets
`branding.brand_pack.status = received` + `ref`.

## Answers to the socials Claude's open questions
1. **Colour roles:** the 5 roles you named (`primary / secondary / accent / bg / text`) — best-effort
   assigned from the captured palette — PLUS a raw `palette[]` of all captured colours so roles can be
   reassigned by hand. Start simple: the 5 roles.
2. **Font files vs names:** BOTH, per font: `{ family, source: "google"|"file"|"system", file, weights[] }`.
   **Prefer a Google-Font family name** (project-bright loads it via `@remotion/google-fonts` — no file
   needed); capture a file only for a genuinely custom/uploaded face.
3. **Logo variants:** `logo.primary` is guaranteed; `logo.variants { light, dark, mark }` are best-effort
   (null if the site doesn't expose them). project-bright can derive a light/dark version by recolour when
   only one is found.
4. **Folder locations:**
   - request in → `<project-bright>/studio/brand-packs/requests/incoming/<id>/brand_pack_request.json`
   - response out → `<socials-studio>/handoffs/brand-packs/incoming/<id>/brand_pack.json`
   - **asset files** (logos, any font files) → `<project-bright>/studio/brand-packs/<id>/assets/` (stay here)
5. **Per-campaign vs house singleton:** BOTH, via `scope` + a stable `id`. Capture the **house** pack
   (`solvx-house`) once and reuse it; capture **per-client** packs (e.g. `example-client`) as needed. A
   campaign pack references a BrandPack by `id`. Start simple: one house pack + client packs on demand.

## `brand_pack_request_v1` (socials-studio → project-bright)
```jsonc
{
  "schema": "brand_pack_request_v1", "version": 1,
  "id": "bp-example-client",             // stable; also the BrandPack id returned
  "requested_at": "2026-07-05T...Z", "requested_by": "socials-studio",
  "campaign_id": "example-client-promo", // or null for a house capture
  "scope": "client",                     // house | campaign | client
  "brand": { "name": "Example Client", "site": "https://example-client.co.uk" },  // the capture source
  "need_slots": ["logo", "colors", "fonts", "taglines"],
  "logo_variants_wanted": ["primary", "light", "dark", "mark"],
  "note": "for the client promo end-card + repeatable lower-thirds"
}
```

## `brand_pack_v1` (project-bright → socials-studio)
```jsonc
{
  "schema": "brand_pack_v1", "version": 1,
  "id": "bp-example-client", "request_id": "bp-example-client",
  "captured_at": "2026-07-05T...Z",
  "source": { "site": "https://example-client.co.uk", "method": "website-capture" },
  "status": "captured",                  // captured | partial | failed
  "logo": { "primary": "assets/logo.svg", "variants": { "light": null, "dark": null, "mark": null } },
  "colors": { "primary": "#e8b23a", "secondary": null, "accent": null, "bg": "#0a0d10", "text": "#ffffff",
              "palette": ["#e8b23a", "#0a0d10", "#ffffff"] },
  "fonts": { "display": { "family": "Fredoka", "source": "google", "file": null, "weights": [700] },
             "body": { "family": "Inter", "source": "google", "file": null, "weights": [400, 600] } },
  "taglines": ["Specialist repairs · nationwide"],
  "motifs": [],
  "assets_dir": "studio/brand-packs/bp-example-client/assets",   // project-bright-side; refs above are relative to it
  "gaps": ["no dark-mode logo found; light/dark to be derived"],   // honest gap surfacing
  "confidence": { "colors": "high", "logo": "medium", "fonts": "medium" }
}
```

## How it flows into production
socials sets `branding.brand_pack.ref` → the pack → `video_production_request_v1.source.brand_ref` →
project-bright renders the end-card / lower-thirds / repeatable section from the BrandPack (loading the
Google fonts, using the colour roles + logo). One capture, reused across every video in the campaign.

## Start simple (first real pack)
Capture **one** pack end-to-end to prove the seam — a real client pack (whichever one already needs
its logo for a promo end-card) or the `solvx-house` pack. Everything else (variants, motifs, per-campaign packs)
layers on after.
