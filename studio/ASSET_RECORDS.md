# Studio — Asset Records Discipline

In the Susan era every uploaded image/clip automatically got an analysis sidecar, and every final
render got a record-final-video record. The local pivot lost that automation but NOT the
requirement. This doc codifies the discipline so it is never lost again. It applies to **every
project under `studio/projects/`**, starting with `ai-top5`.

## THE RULE

The moment an asset enters a project, its record exists. No orphan assets.

| Asset | Required record(s) | Location |
|-------|-------------------|----------|
| Image (plate, cutout, card, mask source) | `<stem>.analysis.json` (structured, machine-usable) **and** `<stem>.log.md` (human description) | `studio/projects/<video>/analysis/` |
| Rendered clip (component/test render) | `<stem>.record.md` | `studio/projects/<video>/records/` |
| FINAL integrated render | `VIDEO_RECORD.md` — a **living document**, amended per render version (plus `VIDEO_RECORD.json` when following the skill's JSON schema) | `studio/projects/<video>/records/` |

- One dir per video under `studio/projects/<video>/`, mirroring the media-dump per-video folders.
- Derived intermediates (masks, previews, marked-screen checks) do not need full analysis files,
  but must be listed in the parent asset's `log.md` under "Derived files".
- Superseded renders: do not delete their record — mark it superseded and note the successor.

## WHY (all four purposes, not just one)

1. **Searchable asset catalogue** — grep/Glob over `analysis/` answers "what do we have?" without
   opening images.
2. **Grounding for advisory/planning** — palette, orientation, focal element and description feed
   template/recipe decisions without re-inspecting pixels.
3. **Provenance** — each record names the media-dump source file (or generator + prompt/tool for
   generated assets). The `ai-top5` media-dump folder is already gone; records are now the only
   provenance we keep.
4. **SELF-EVAL (the primary purpose)** — the record is what a judge checks a render against. A
   render without a record cannot be evaluated, compared across versions, or regression-checked.

## HOW

**Zero paid API by default.** Everything below is derivable free:
- `analysis.json`: PIL/Pillow stats (dimensions, orientation, alpha, quantised palette →
  primary/accent/background/text, per Susan's `image_analysis.py` fields) + code-derived facts.
- `log.md`: Read-tool visual inspection — Claude reads the image and writes 3-6 sentences
  (subject, style, notable edges/artefacts, intended use).
- Clip/video records: code-derived from the Remotion source (frames, layers, tokens, hexes) —
  read the template, don't watch the video.
- If a paid API *is* used (e.g. Gemini clip analysis), the STUDIO.md logging rule applies: token
  usage + `cost_usd` go into the record itself.

**Canonical final-video format:** the **record-final-video** skill at
`apps/claude-remotion/.claude/skills/record-final-video/` (schema in
`rules/layer-record-schema.md`). Key obligations: layers listed back→front; motion as frame
windows at 30fps (frames authoritative); every hex in the file, dominance-ordered; focal element;
caption track with frame windows; `"Unconfirmed"` for anything the source doesn't state — never
invent; still-preview gate before sign-off; verdicts appended under `review`.

**Clip records** (`<stem>.record.md`) are a lighter cut of the same format: composition id, source
template file, duration/fps, layers, motion arc, palette, focal element, render command + output
filename/size/date.

## CHECKLIST — when new assets land

```
[ ] 1. Copy asset into studio/projects/<video>/ (keep media-dump original untouched)
[ ] 2. Create analysis/ and records/ dirs if missing
[ ] 3. For each IMAGE: write analysis/<stem>.analysis.json (PIL stats + palette + provenance)
[ ] 4. For each IMAGE: write analysis/<stem>.log.md (Read-tool visual description + derived files)
[ ] 5. For each rendered CLIP: write records/<stem>.record.md (code-derived from the template)
[ ] 6. After a FINAL render: create/amend records/VIDEO_RECORD.md per record-final-video,
       with a version entry (date, output file, size, what changed since last version)
[ ] 7. Any paid API call used? Log tokens + cost_usd in the record
[ ] 8. Sweep: every file in the project dir either has a record or is listed as a derived file
```

An agent finishing a render task has NOT finished until step 6 is done.

## Skill discoverability (action item)

`studio/SKILLS.md` lists the skill as: *"`record-final-video` — Read a multi-layer template →
precise text+JSON record of every layer/motion/colour/timing/slot."* The name is the problem: it
reads as an 11-slot-era internals tool, so agents recording a *final video* never find it — which
is exactly how this discipline lapsed. **Recommendation (do not execute now): rename it to
`record-final-video` in a future commit**, update the SKILLS.md row, and keep the flexible-mode
schema as the default for post-pivot bespoke builds.

## Record v2 — the per-section feed (2026-08-04)

A final-video record is now also the **reviewer's data source**, so `VIDEO_RECORD.json` must carry a
`sections[]` array where each entry has:

| field | why |
|---|---|
| `id` | a STABLE slug for the section's role (`hook`, `engine`, `step-03-voice`, `ident-out`). Never derived from content — review comments and thumbnail paths are keyed on it |
| `label` | what a human calls it |
| `start` / `frames` / `end` | frames, authoritative |
| `seconds` | derived at 30 fps, for seeking |
| `render` | the FILE this part was rendered to, its declared and actual frame count, and when |
| `text` | what is on screen, verbatim, so a reviewer can check picture against intent |
| `clips` | the b-roll used |
| `audio` | the vo lane and bed for that section |
| `budget` | designed vs actual, and whether it grew to fit its read |

**Render the parts, do not slice them out afterwards.** `scripts/render-sections.mjs` renders each
section as its own mp4 and marks it `produced` only once the file actually contains the frames it
declared, writing the record after EACH part. A section is then a FILE: its boundaries cannot drift
from the video because they are the video, and nothing has to be derived, seeked or scored.

`timeline_confidence` (`"exact"` / `"approximate"` + `drift_frames`) still applies to any record
whose sections are DERIVED rather than rendered, and must live in the JSON rather than on stderr — a
record that is silently wrong is worse than one that admits it. The live example:
`studio/projects/ai-top5/records/VIDEO_RECORD.json` records sections summing to 3180 frames against
a 3032-frame video, with no trace in the file. Rendering that pipeline's parts removes the class.

Worked reference: `studio/projects/project-bright-promo/records/VIDEO_RECORD.{md,json}`.

## AI Top 5 — Phase 3 story-logo assets (2026-07-07)
Real brand marks for the background logo tier, vendored once via `apps/claude-remotion/scripts/vendor-logos.mjs`.
- `public/logos/si/*.svg` (10): anthropic, google, deepmind, nvidia, meta, cloudflare, coinbase, baidu, github, linuxfoundation — Simple Icons @16.25.0, CC0-1.0.
- `public/logos/brand/openai.svg` — Simple Icons @13.21.0 (the genuine mark, pre-v16 trademark removal); owner-approved editorial hand-source.
- HELD: Broadcom (custom non-CC0 licence). No mark: Tencent, Zhipu AI (fall through to plain/gen). Manifest: `src/templates/ai_top5/logos.json`; guard: `scripts/check-logos.mjs`.
