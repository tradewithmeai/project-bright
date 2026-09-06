# Acceptance — per-platform `outputs[]` on the video bridge (v2)

**project-bright's response to socials-studio's `docs/OUTPUTS_CONTRACT_PROPOSAL.md`.**

**Verdict: ACCEPTED.** The v2 `outputs[]` shape is additive, well-sequenced (emitter cut-over gated on
our intake; aspect-inference covers current deliveries), and it's the item our
`MULTI_FORMAT_PIPELINE_SCOPE.md` already defers. socials-studio may **cut the emitter over to v2 for
real** — our delivery side is v2-ready as of this doc (change A below shipped); our request-intake side
lands in the staged order below, and until intake (b) ships, your aspect-inference routing continues to
cover deliveries. Accepted with three terms that pin the contract seams so both sides build the same
thing.

## Term 1 — the platform matrix is single-sourced via `_profile`

Each output already carries a resolved **`_profile`** (dimensions/fps/duration/safe_zones). project-bright
will **consume `_profile` from the request as the source of truth** for a render's geometry — we will
**not** hand-maintain a parallel `formats.ts` matrix that could drift from your profiles. We keep only a
minimal built-in fallback (16:9 1920×1080 / 9:16 1080×1920 @30) for when a profile is absent, logged as
`(fallback)`. So `platform_profiles/*.json` in socials-studio is the one canonical platform matrix;
we read it off the wire.

## Term 2 — `edit.style` is a committed enum, grown by agreement

We implement a small enum first, **per-template**, starting with the templates that have live campaigns:
- **`full-show`** — the full cut (what our compositions already produce). Supported now.
- **`hook-first`** — the short, hook-led teaser/spoke. This is the real new work; first target is
  **AI Top 5 (main hero + ~15s Instagram spoke)** and **YourGov**.

Any other `edit.style` string → we **warn and fall back to `full-show`** (never silently render a wrong
cut). New styles are added to the enum by agreement, template by template — not assumed from a free-form
string. Please treat this enum as the contract surface.

## Term 3 — project-bright owns per-output VO authoring

A shorter output is **not a trim** of the long one. A 45s `hook-first` spoke of a 107s hero needs its own
fit-for-purpose script + VO. **project-bright authors the VO per output** to fit its duration/style. The
request's `video.brief.voiceover_notes` is welcome **campaign-level guidance**, not the script; we do not
expect a magic trim, and you should not expect the spoke's audio to be a subset of the hero's. (If, later,
you want to steer per-output VO intent, add an optional `edit.vo_hint` per output — additive; not required.)

## What we've shipped / will ship

| Change | Status |
|---|---|
| **B. Delivery grouping keys** — `publish-handoff.mjs` sets `request_id` and adds `output_id` / `role` / `promotes` per `finished_video_publish_v1` package (one mp4 per package, unchanged) | ✅ **DONE** (this session) — validated: role ∈ {hero,spoke,equal}, fields emit in dry-run |
| **A(b). Request intake v2** — `ingest-requests.mjs` iterates `outputs[]`, consumes each `_profile`, one render job per output | ⏳ staged — next, on owner go-ahead |
| **A(c). Cut capability** — `edit.style` selects the cut; `full-show` now, `hook-first` teaser next (AI Top 5 first) | ⏳ staged — the substantive build |

Delivery stays **one mp4 per package** (matches `--id-suffix`); we do **not** switch to a single
`variants[]` package. All additions are additive under `finished_video_publish_v1`'s versioning rule.

## Loop-closure note
`finished_video_publish_v1` now carries `request_id` + `output_id` + `role` (+ optional `promotes`), so a
delivery threads back to the exact requested output → campaign post. This is the ID thread in
`studio/CAMPAIGN_DATA_MODEL.md` (`request_id → output_id`), kept intact.
