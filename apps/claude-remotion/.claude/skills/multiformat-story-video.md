---
name: multiformat-story-video
description: Turn a set of 4 art-directed story images into ONE short video rendered in MULTIPLE formats (16:9 + 9:16) from a single composition. A step up from "one poster → one video" — the 4 images tell a Problem→Reveal→Power→Act story, proved by short clips of the real app, carried by a shouty character VO, closed by a reusable branded QR outro. Covers the image naming/verify contract, the image-gen content discipline, and the format-parameterised render.
metadata:
  tags: remotion, story, multiformat, 16x9, 9x16, poster, voiceover, elevenlabs, qr, outro, yourgov, google-image-api, verify
---

## When to use

Use this when you want the SAME short advert in more than one aspect ratio (e.g. 16:9 for YouTube +
9:16 for Reels/TikTok/Shorts), built from a small set of art-directed images that tell a story.
This is the tier above [[campaign-poster-video]] (one poster → one video): here 4 images form a
narrative and one composition renders every format. Proven on the YourGov "Finger Hero" story video
(2026-07-06): `YourGovStory16x9` + `YourGovStory9x16` from one `YourGovStory` component.

**Hard rule — never render or build without the owner's explicit go-ahead** ([[feedback_no_render_without_permission]]). A timed-out question is a WAIT, not a proceed.

## The story shape (4 images)

Classic hook-driven arc, one image per beat, each proved by a short real-app clip (the "spine"):

1. **HOOK** — intrigue: "this thing exists."
2. **GAP** — make it personal/guilty: "but do YOU know…?"
3. **POWER** — the turn: what the product lets you see/do.
4. **CALL** — the CTA: the empowered action + the ask.

Then a **reusable branded OUTRO** (QR + logos + URL) — see below. The VO carries the story: one short
line per beat, plus lines over the spine clips; a final copy/VO pass checks back against the video's
GOAL (e.g. "would this make a stranger open the URL?").

## Image contract (naming + formats)

Author/generate **one image per beat per format**, with this exact naming in the source folder so the
gen→verify→render pipeline is deterministic:

| beat | 16:9 file | 9:16 file |
|---|---|---|
| hook  | `1-16.png` | `1.png` |
| gap   | `2-16.png` | `2.png` (or `2-1.png`) |
| power | `3-16.png` | `3.png` |
| call  | `4-16.png` | `4.png` |

- **16:9** ≈ 1672×941 (fills a 1920×1080 stage). **9:16** ≈ 941×1672 (fills 1080×1920). Off-aspect
  stills still work via blurred-fill, but native aspect is best.
- With the **Google image API**, request ALL formats in ONE call so the set is style-consistent.

### Image-gen content discipline (do not skip — [[feedback_image_gen_control_exact_content]])
The image must contain EXACTLY what we want and nothing else. In every prompt either:
- say **"do not include any URL, web address, brand name, or logo"** (we composite those in Remotion), OR
- **stipulate the exact text/URL** to show.
Stray artefacts (a placeholder URL like "yourMPmap.com", an invented name, a wrong logo) leak into the
render and cost a full re-edit. Use image #1 as a **style guide**; write the other prompts to match it.

### Verify step (mandatory before render)
Analyse every generated image against its spec BEFORE it enters the render: right beat content, right
aspect ratio, **no stray URLs / names / logos**, style matches the guide. Reject and regenerate any
mismatch. Only verified images get formatted into the render folders.

## Format the assets for the render

Copy the verified images into the per-format render folders with **beat names** (this is the layer the
composition reads — it decouples the render from the gen-folder naming):

```
public/yourgov/campaign/story/16x9/{hook,gap,power,call}.png   ← from 1-16..4-16
public/yourgov/campaign/story/9x16/{hook,gap,power,call}.png   ← from 1,2,3,4
```

## VO + music

One short colonel line per beat (shared voice, never re-designed —
`node scripts/generate-promo-vo-11.mjs --voice-id <colonel> --cues <cues.json> --out-dir public/yourgov/story-audio`).
The SAME audio drives BOTH formats. Timeline is **VO-driven**: each beat holds for its measured line
(read `vo.manifest.json` durations, size the beat = line + small pad). Music bed low (~0.2) under it.
Keep bookend lines tight — the colonel adds dramatic pauses, so a "…" can balloon a line to 6–7s.

## The reusable branded OUTRO (all YourGov videos)

> ⚠️ **The reference implementation named below was removed during the pre-release consolidation.**
> The technique is real and is kept here; the file paths are history, not somewhere to look. For the multi-format technique as it ships today, see `VerticalAdvert`: one aspect-neutral beat sheet, a per-format layout policy, and the dimensions derived from a `format` prop.

`YourGovOutro` (in the retired `yourgov_story/`) was shared across those videos: a logo +
**scannable QR** (generate with `studio/tools/make-qr.py <url> --ec H`) + the URL + the
**build-in-public solvx.uk mark** (the evolving logo — swap its treatment per video; the wordmark text
stays constant). Dark finger-hero stage; QR on a white card; logos in white on dark. Format-aware.

## The format-parameterised composition

ONE component, a `format: "16x9" | "9x16"` prop; register it once per format in `Root.tsx` with the
matching `width`/`height`. The prop swaps the image set folder + spine framing (full-bleed clip in
16:9, framed inset "▶ THE REAL APP" card in 9:16); story, VO, and outro are identical. This is the
one-bundle → N-formats proof (feeds the parked multi-format pipeline).

- **Gotcha:** for a fixed-size inset card, use explicit px width/height (from `useVideoConfig().width`)
  and centre it with a nested `AbsoluteFill`, not a flex `aspectRatio` (it collapsed to height 0).

## Build sequence

1. Concept: story + hook + VO draft + goal check (write to `studio/projects/<proj>/STORY_VIDEO_CONCEPT.md`).
2. Prompts: image #1 = style guide; 3 prompts for the rest; content discipline applied. Owner generates
   all formats (Google API: one call). 
3. **Verify** every image; reject mismatches.
4. Format assets into `story/<fmt>/{hook,gap,power,call}.png`.
5. Generate VO once; read durations.
6. Still-check the risky bits per format (outro, spine inset, off-aspect hook), THEN — with the owner's
   go-ahead — render every format.
7. Report; on approval, hand each format to socials-studio (`publish-handoff.mjs --id-suffix <fmt>`).

## Related
- [[campaign-poster-video]] — the one-image → one-video tier below this.
- [[feedback_image_gen_control_exact_content]] — the image content-discipline rule.
- [[feedback_no_render_without_permission]] — never build/render unattended.
- Reframe916 composition — the generic 16:9→9:16 post-hoc reframe (a different, non-native path).
