# Brand-pack scraper — state, plan, and scope boundary

**Status (2026-07-05): WORKING, parked at "good enough to prove the pipeline," marked for improvement.**
Do not push further without the branding/comms expert (see Scope boundary). The scrape → brand pack →
on-brand video pipeline is proven; the *quality* of what it captures is the open work.

## What works
- `apps/video-bright-mvp/backend/scripts/run-brand-pack.ts` — standalone CLI (no Express/auth/DB),
  chains capture → extract → **trust-promotion** → generate. `npx tsx run-brand-pack.ts <url> <outDir>`.
- Feeds `build-brand-sting.mjs` → the `BrandSting` repeatable asset (any pack → a branded reveal).
- Proven: `solvx.uk` → pack → `out/brand-sting-solvx.mp4` (on-brand, colours from the scrape).

## What it does NOT do well yet (the improvement plan)
Tested on real brands, the STRICT path under-delivers even on strong, well-structured sites:
- **solvx.uk** — weak source brand (soft logo, little structured identity); got a palette, no logo.
- **stripe.com** — a STRONG brand, yet the strict path returned: name *null*, **wrong colours**
  (illustration/gradient greens+navies, NOT the brand indigo `#635BFF`), no logo, no font, no tagline.

So the tuning targets, in priority order:
1. **Brand-primary colour detection** — pick the *brand* colour, not the most-frequent CSS colour.
   Weight by role (buttons/links/headers/logo area), not raw frequency.
2. **Logo promotion** — the trust-promotion gate is too strict (blocks anything not JSON-LD-backed).
   Loosen for own-domain header/`link[rel=icon]`/`og:image` logos, or fall to the OPEN media-scraper.
3. **Font capture** — surface the site's real display/body faces (custom fonts too).
4. **Name + tagline** — promote `og:site_name` / `<title>` / hero H1 when JSON-LD is absent.
5. **Two paths, kept separate:** STRICT brand-pack (legitimacy-gated) for defensible assets; OPEN
   `runMediaScraper` for logos/images the strict path refuses. Revive the open path next for logos.

## The benchmark method (how to tune)
Pick a brand that **publishes its own brand pack** (Stripe: `#635BFF`, the wordmark, "sohne", the
tagline). Capture with our scraper → **diff against the official pack** → tune promotion/colour-role
rules until ours matches at least the published version. Repeat across a few known brands.

## Scope boundary (why we stop here)
Grabbing *data* is our lane; deciding "which colour is the brand primary, is this logo usable, does this
read on-brand" is **taste + comms judgement** — beyond the owner's branding knowledge and at/over the
system's scope. The system's job is to put the raw pack + a draft video in front of the **expert friend**
(a branding/comms pro), who corrects it human-to-human. That review loop is the future stakeholder-
feedback layer (the benched video-bright permissions return as exactly this). Until that expert input:
scraper stays as-is, improvements above are queued, and we don't over-invest guessing at brand taste.

## Gotchas
- Some sites **403-block headless** (WordPress/Automattic sites, for one; curl 200, headless 403
  even with a real UA). Needs stealth/headed, or a manual brand.json.
- Strict path outputs honest `gaps[]` — trust them; they show exactly what wasn't defensibly captured.

See [[project_brand_pack_scraper_revived]] and `studio/contracts/brand_pack_exchange_v1.md`.
