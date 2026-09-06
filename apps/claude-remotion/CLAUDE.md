# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

This is a **Claude Code + Remotion cyborg system** for programmatic video production. Claude Code acts as a technical video director — authoring, editing, and rendering compositions by writing React/Remotion components and directing the scene specifications that drive each video.

Two parallel systems live here:

- **Code-transition videos** — animated code walk-throughs driven by files in `public/` (the original project)
- **Remotion Lab** — a research and production environment for reusable short-form video templates

---

## Commands

- `npm run dev` — start Remotion Studio (live preview at localhost)
- `npm run build` — bundle the video project
- `npm run lint` — TypeScript type check + ESLint across `src/`
- `npm run check:assets` — the provenance gate: every file tracked under `public/` must be loaded
  by something and covered by a `public/PROVENANCE.md` section. `node scripts/check-assets.mjs
  --self-test` proves the gate can fail.
- `npx remotion render <CompositionId>` — render a composition to video
- `npx remotion still <CompositionId> --frame=<N> --scale=0.5` — render one frame for quick layout check

Frame reference at 30fps: `--frame=30` = 1s, `--frame=90` = 3s, `--frame=300` = 10s.

---

## Remotion animation rules

These rules are absolute — violating them causes broken renders:

- **Always** drive animation via `useCurrentFrame()` + `interpolate()`. Never use CSS `transition`, CSS `animation`, or Tailwind animation classes — they do not render correctly in Remotion.
- **Always** clamp `interpolate()` with `extrapolateLeft: "clamp"` and `extrapolateRight: "clamp"` unless intentional overflow is needed.
- Use `Easing.bezier(...)` for natural motion curves.
- Time is always in **frames**, not seconds. At 30fps: 1s = 30 frames. Convert using `const { fps } = useVideoConfig()`.
- Use `<Sequence from={N} durationInFrames={M}>` to delay or time-limit elements. Default `<Sequence>` is `AbsoluteFill`; use `layout="none"` for inline content.
- Frame references inside a `<Sequence from={N}>` are **relative** — frame 0 inside the Sequence = frame N in the parent. Design components accordingly.
- Reference `public/` assets with `staticFile("filename")`, not raw paths.
- Use `OffthreadVideo` from `"remotion"` for video assets (renders each frame independently — correct for production). `@remotion/media` is **not installed**.
- Use `<Img>` from `"remotion"` for images.
- `clip-path: polygon(...)` in style objects is fine — it is static CSS, not an animation. Animate the polygon values by computing them from `useCurrentFrame()`.

---

## Project structure

### Code-transition system (`src/`)

1. **Source snippets** — `public/code1.*`, `code2.*`, etc. (one file = one step)
2. **`src/calculate-metadata/get-files.ts`** — fetches `public/code*` files via `getStaticFiles()`
3. **`src/calculate-metadata/process-snippet.ts`** — Twoslash (CDN) for `.ts`/`.tsx`, then Code Hike `highlight()`; `//  ^?` triggers type callout
4. **`src/calculate-metadata/calculate-metadata.tsx`** — orchestrates steps 2–3, auto-sizes video width, returns computed props
5. **`src/Root.tsx`** — registers all Remotion `<Composition>` entries
6. **`src/CodeWalkthrough.tsx`** — renders steps via `<Series>`, one `<CodeTransition>` per step; step duration = `totalFrames / stepCount`, transition = 30 frames
7. **`src/CodeTransition.tsx`** — per-token animation via Code Hike's `calculateTransitions`, driven by `useCurrentFrame`; uses `delayRender`/`continueRender` for DOM measurement

Annotations in `src/annotations/`: `Callout` (Twoslash `^?`), `Error` (type errors), `InlineToken` (token-level transitions).

Font: Roboto Mono via `@remotion/google-fonts` — `waitUntilDone()` must be called in `calculateMetadata` before `measureText()`. Constants in `src/font.ts`: `fontSize=40`, `tabSize=3`, `horizontalPadding=60`, `verticalPadding=84`.

### Remotion Lab (`src/templates/` + `remotion_lab/`)

Templates live in `src/templates/<template-name>/` — each exports a composition component and its props type.

Lab documentation, scene specs, and experiment records live in `remotion_lab/`:
```
remotion_lab/
├── docs/               ← Lab philosophy and system design
├── experiments/        ← Per-experiment records (goal, assets, notes)
├── components/         ← Future shared components
├── overlays/           ← Future overlay templates
├── transitions/        ← Future transition templates
└── renders/            ← Render outputs (gitignored)
```

---

## Registered compositions (`src/Root.tsx`)

`Root.tsx` registers **eleven** compositions in three groups: **start here**, **generic
templates**, and **curated examples**. Every one renders from a clean clone — no key, no API, no
asset you have to go and find, and no step that spends money.

| ID | Format | Duration | Description |
|----|--------|----------|-------------|
| **START HERE** | | | |
| `HelloWorld` | 1920x1080 | 150f (5s) | The install proof. No key, no assets, no network. `npm run hello` renders it and checks the artefact. Copy this to start something new. |
| **GENERIC TEMPLATES** | | | |
| `ProductWalkthrough` | 1920x1080 | 1050f (35s) | A caption-led tour of a product interface, driven by a virtual camera over one still capture. |
| `FootagePromo` | 1920x1080 | 929f (30.97s) | A footage-led promo cut to a musical grid — cuts, PiP, a multi-source grid, beat-locked type, a speech-sized section and an optional treatment. |
| `SlotShort` | 1920x1080 | 726f (24.2s) | A short assembled from ordered content slots, where the order is EDITORIAL. Brand, message, image, footage, CTA. |
| `StepSequence` | 1920x1080 | 720f (24s) | Ordered steps in a process, where the order is CAUSAL. A persistent rail shows position in the sequence. |
| `VerticalAdvert` | 1080x1920, or 1920x1080 | 462f (15.4s) | A short-form social advert: safe-area aware, with a hook and a reframed landscape source. ONE registration — `--props='{"format":"16x9"}'` makes it landscape, dimensions and all. |
| **CURATED EXAMPLES** | | | |
| `CodeWalkthrough` | 1080p, auto-width | dynamic | The repo's original code-transition system: Code Hike + Twoslash over `public/code*.tsx`. The one composition that measures the DOM before rendering. |
| `NarrativeArc` | 1920x1080 | 1230f (41s) | An emotional-arc structure — setup, turn, payoff — expressed as a config of beats. |
| `BrandSting` | 1920x1080 | 180f (6s) | A short branded reveal built from a scraped BrandPack: colours and marks as data. |
| `LogoShowcase` | 1920x1080 | 730f (24.33s) | A recolourable vector wordmark: 21 colourway presets of ONE mark, plus a live recolour. |
| `AiTop5` | 1920x1080 | 3150f (105s) | The curated showcase — a data-driven ranked countdown cut to an exact 124 BPM grid. See below. |

That is the complete list; `npx remotion compositions` prints the same eleven. The durations
above are the ones the templates derive, so a number here that disagrees with the Studio means
a plan file changed and this table did not.

---

## ProductWalkthrough — the capture-first walkthrough technique

**File:** `src/templates/product_walkthrough/` · shared parts in `src/templates/shared/`

The technique: do not re-implement a product's UI in code, and do not film a screen recording.
Take ONE high-resolution capture of the real interface and move a virtual camera across it —
holding on the feature being explained, gliding to the next. The capture is correct by
construction, because it came from the real product.

### The layers, and why they are separate

| layer | file | rides the camera? |
|---|---|---|
| Ambient background — the room | `shared/AmbientBackground.tsx` | no, it sits behind |
| Virtual camera | `shared/VirtualCamera.tsx` | it *is* the camera |
| The capture, and its states | `product_walkthrough/SampleCapture.tsx` | **yes** |
| Glued marks (a ring round a feature) | `GluedHighlight` in the composition | **yes** |
| Captions and focus pulse | `shared/CaptionTrack.tsx` | no, screen space |

The capture never moves and the captions never zoom. That separation is the point: a re-capture at
a new resolution does not invalidate the script, and a caption rewrite does not require re-aiming
the camera.

### Where stages live

`src/templates/product_walkthrough/stages.ts` — **this is the file to edit.** Everything else is
machinery. Each stage declares its own length in seconds; start frames are DERIVED by
accumulation and never written down, so changing one stage shifts everything after it and no
hand-maintained frame number can drift.

### How focus regions work

A region is `{ cx, cy, scale }` where cx/cy are FRACTIONS of the capture — not pixels, and not
fractions of the video frame. For your own capture: divide the feature's pixel centre by the
capture's width and height. A button at (1740, 210) on a 2560×1440 screenshot is
`{ cx: 0.68, cy: 0.15 }`. `scale` 1.0 shows the whole capture, 2.0 shows a quarter of it.

Fractions rather than pixels is what lets a region survive a re-capture at another resolution.

⚠️ **The camera clamps its own centre** so the viewport never runs off the capture and reveals
background. Aim at a corner and the feature lands as near centre as geometry allows, rather than
centred with a blank wedge beside it. Pass `clampToSource={false}` only if you want the overshoot.

### Screen-space vs capture-space overlays

- **Capture space** (inside `<Capture>`): rides the camera and zooms with the interface. Use it to
  mark *a region of the product* — `GluedHighlight` is the example.
- **Screen space** (outside `<VirtualCamera>`): fixed size however far the camera pushes in. Use it
  to mark *a moment* — `FocusPulse` — or to carry words: `CaptionTrack`.

To place a screen-space mark over a feature the camera is looking at, convert with
`sourcePointToScreen()`. It uses the same functions the camera does, so the two cannot drift apart.

### How capture states change

`shared/CaptureState.tsx`. A narration line lands and the product visibly reacts; the viewer reads
it as cause and effect. Register the states, then trigger one:

```ts
stateChange: { atSeconds: 1.5, to: "flagged", crossfadeSeconds: 0.5 }
```

Give the trigger the same time as the caption that causes it, so re-timing one cannot silently
desynchronise the other. Every state stays mounted and is cross-faded by opacity — nothing mounts
mid-render, so there is no flash. States must be **identically registered**: same layout, same
positions, changing only colour, emphasis or values. Change the layout and the crossfade reads as
two pictures swapping rather than one interface reacting.

State is scoped to its stage. A later stage starts from the initial state again, which keeps each
stage self-contained and re-orderable.

### Replacing the sample with a real product

`SampleCapture.tsx` is a fictional interface drawn in DOM — no committed assets, crisp at any zoom,
and nobody has to wonder whose product it is. To use your own screenshot, swap it for an image and
set the real pixel size:

```tsx
export const CAPTURE_SIZE = { width: 2560, height: 1440 };   // your screenshot's real size
<ImageCapture src={staticFile("captures/my-product.png")} source={CAPTURE_SIZE} />
```

The capture does not have to match the composition size; `<Capture>` fits it, and with
`fit="contain"` the clamp tightens to the letterboxed content rect so the camera will not wander
into the bars. Then re-aim the regions in `stages.ts` at your own features.

### Per-stage accent

A stage may set `accent` to override the composition default. It drives the caption tick, the focus
pulse, the glued highlight and the ambient tint together, so a stage reads as one colour decision
rather than four unrelated ones.

## FootagePromo — cutting footage to a musical grid

**File:** `src/templates/footage_promo/` · shared parts in `src/templates/shared/`

The production grammar several historical promos independently arrived at:

```
clips -> sections -> cuts on the beat -> captions
                                      -> music bed
                                      -> speech, which ducks the bed
                                      -> SFX cues
                                      -> one frame-budgeted composition
```

### Edit the plan, not the JSX

`src/templates/footage_promo/plan.ts` is the file to change. Sections declare a length in **bars**;
cuts declare a length in **beats**; every frame number is derived. Change the BPM and the whole
edit moves with the music instead of drifting out of it.

`compilePlan()` refuses a plan that does not hold together — cuts that do not fill their section, an
unknown clip id, or a trim that reads past the end of its source file. A promo that is one beat
short does not announce itself on screen; it just feels slightly wrong.

### Musical time — `shared/MusicalTime.ts`

⚠️ **Never round a beat and then multiply it.** The obvious implementation is:

```ts
const BEAT = Math.round(fps * 60 / bpm);   // 124 BPM @30fps -> 15 (true: 14.516)
const bar  = 4 * BEAT;                     // 60 (true: 58.06)
```

Every bar then gains half a frame and it accumulates: **+31 frames — over a second — by bar 16**,
so the back half of the video is visibly off the beat while the arithmetic looks tidy.

`frameAtBeat()` computes the exact position and rounds **once**, so the error against true time is
bounded at half a frame however long the piece runs. `layoutBars()` derives section boundaries the
same way, and `beatSpan()`/`barSpan()` tile without gaps. Everything takes the composition's own
fps — never an assumed 30.

At 150 BPM and 30fps a beat is exactly 12 frames, which is why the historical adverts got away with
hardcoding it. Pick a BPM whose beat is not a whole number and the bug appears immediately.

### The mix — `shared/AudioMix.tsx`

- **`MusicBed`** — one bed, one gain, ducked automatically, faded at the tail. Set `loop` when the
  file is shorter than the video; it also sets `loopVolumeCurveBehavior="extend"`, because a looped
  `Audio` otherwise restarts the volume callback's frame at 0 on every repeat and the duck fires at
  the wrong moments.
- **Ducking** is an envelope with **attack / hold / release / depth**, and depth is **per cue**.
  Stepping the music down for a whole section reads as a mixing mistake, because the listener hears
  the level move with no cause on screen; tying the dip to the speech means it always has one.
  Ramps are smoothstep rather than linear, so the bed eases out of the way instead of cornering.
- **`SfxCues`** — a declarative table of `{src, at, gain}` rather than `<Audio>` tags buried in
  components. `gain` may be a function of the cue's index, which is how a repeated hit **escalates**
  across a run; the same hit at a fixed level reads as a metronome.

⚠️ Mount the mix **once**, at the root, outside any treatment that renders its children more than
once. Visual duplication is a look; audio duplication is comb filtering.

### Footage — `shared/FootageClip.tsx`

`OffthreadVideo` (deterministic per frame), `muted` (the mix owns the soundtrack), and `trimBefore`
(the interesting second of a shot is rarely its first).

⚠️ Footage does **not** have to match the composition. Pass `fit`: `cover` fills and crops, so it
can never show an undefined edge; `contain` letterboxes against `background`. Every historical
source hardcoded `cover` and assumed 1920×1080.

Cuts are **hard**. A dissolve on a beat fights the thing the beat is for — the eye is still
resolving the previous shot when the next hit lands. `ImpactFlash` is the frame or two of light
that sells a drop; fire it *on* the beat.

### Speech-driven section sizing

A section declares its length one of two ways:

```ts
length: { bars: 4 }                                  // music-led: you choose
length: { speech: { src, frames }, headFrames: 12,   // speech-led: the words choose
          tailFrames: 18, snap: "bar" }
```

The speech-led form takes the **measured** file length, adds breathing room, and rounds **UP** to
the next whole beat or bar. Speech is never shortened to fit a section declared first — that clips
the line. `compilePlan()` then checks the result actually fits.

⚠️ The boundary is the EXACT beat length, not the rounded one. At 124 BPM a beat is 14.516 frames,
so a 14-frame line takes one beat and a 15-frame line takes two.

### Section-local musical cues

⚠️ Anything placed musically **inside** a `<Sequence>` must use `localFrameAtBeat()`, not
`frameAtBeat()`:

```ts
frameAtBeat(m, offsetBeat)                                     // WRONG inside a section
localFrameAtBeat(m, sectionStartBeat, offsetBeat)              // right
```

Both boundaries round independently, so the naive form is a frame off the absolute grid depending
on where the section starts. At 124 BPM and 30fps, **264 of the first 1105 (start, offset) pairs
disagree by one frame** — enough for an accent meant to land with a cut to land beside it. A single
frame is inaudible alone and obvious when everything else is locked.

### Picture-in-picture, grids and beat hits — `shared/FootageLayout.tsx`

- **`FootagePiP`** — one shot inset over another. The inset's height comes from the source's own
  aspect, so a square source gives a square inset. Margins are a fraction of the shorter side, so
  it sits the same visual distance from the edge in landscape or vertical.
- **`FootageGrid`** — two to four shots at once. Each cell fits independently, so a square source
  can `contain` among covered neighbours. Cells settle by **scale, never opacity**: fading up from
  nothing means the grid's first frame is bare background, which reads as a dropped frame when the
  previous section hard-cuts into it.
- **`BeatHit`** — a word or phrase landing on a cue. Cue frames are explicit, so they sit on the
  same grid as the cuts. The overshoot is applied to **font size, not a transform**: a transform
  ignores `max-width`, so a long phrase runs off both edges on exactly the frame that has to read.
  Fully opaque on the landing frame — a hit that fades in is late.

### Optional visual treatment — `shared/RetroTreatment.tsx`

Off by default. Scanlines, vignette, approximated chroma bleed, a tracking sweep, and an optional
label/timecode. `intensity: 0` draws nothing.

⚠️ It is a pure **overlay** and wraps nothing. The implementation this was distilled from wrapped
its children and rendered them three times for a true RGB split — which triples the decode cost of
every clip and mounts any `<Audio>` inside it three times, audible as comb filtering. The chroma
here is approximated with blended gradients instead: it reads as chroma bleed rather than being it.
If you need a real channel split, apply it to one image, not to a subtree that might contain audio.

The genuinely reusable part is `glitchStrength()` — a **deterministic** event schedule, bursts on a
fixed cadence with seeded severity, so a given frame always looks the same and a distributed render
matches.

### The demo media

`scripts/make-footage-samples.mjs` generates everything the demo needs: two clips at deliberately
different sizes (960×540 and 720×720) and two voice-band placeholder tones, **219 KB in total**, all
synthesized from maths in-house and byte-for-byte reproducible. The music bed and SFX are the
existing in-house synthesized set. No stock footage, no third-party media, no paid API.

## SlotShort — a short assembled from ordered slots

**File:** `src/templates/slot_short/` · shared parts in `src/templates/shared/`

For a short promotional or explainer video: a brand, an ordered list of content slots, and a
duration that falls out of the slots rather than being typed anywhere.

```
brand -> ordered slots -> derived timing -> one finished short
```

### Where the plan lives

`src/templates/slot_short/plan.ts` — **this is the file to edit.** It holds the brand tokens and
the slot list. `slots.tsx` holds how each slot type looks; `SlotShort.tsx` only places them on the
timeline.

To add, remove or reorder a slot, edit the `SLOTS` array. Nothing else needs touching: each slot
renders inside its own `<Sequence>`, so it animates from its own frame 0 and does not know or care
where it sits.

### The five slot primitives

| kind | what it does |
|---|---|
| `brand` | the mark, entering (`intro`) or leaving (`close`), with an optional tagline |
| `message` | words on the ground — a claim, a reflection, or a result with `emphasis: "result"` |
| `image` | a picture with an optional caption; omit `src` for a generated visual needing no asset |
| `footage` | a video file, trimmed with `trimBefore` |
| `cta` | an action, plus an optional destination rendered in the mono face |

Five, not eleven. The implementation this replaced carried nine slot *type* names that turned out
to be these behaviours wearing marketing labels, and required exactly eleven slots in a fixed
order. Any number of slots in any order is fine.

### How timing is derived

Each slot declares `seconds`. `compileShort()` converts to frames, accumulates the start positions,
and returns the total. `Root.tsx` uses `SLOT_SHORT_FRAMES` — the duration is never written twice, so
changing one slot's length moves everything after it and cannot fall out of step.

### Reading-floor validation

⚠️ **A slot carrying text must be on screen long enough to read it.** `compileShort()` refuses a
plan where it is not, using the same `readingFloor()` helper the caption layer uses (1.8s plus
0.07s per character) so a slot and a caption agree about how long words take.

This is the check worth having: an under-timed slot plays correctly and simply cannot be read, which
is invisible frame by frame. It caught three slots in this template's own first draft, and a footage
trim reading past the end of its source.

### Brand tokens — `shared/BrandTokens.tsx`

Five fields: `name`, `accent`, optional `accent2`, `handle` and `logoSrc`.

⚠️ **The logo is optional and that is load-bearing.** `BrandMark` draws a wordmark from the brand
name when no logo is supplied — the initial in an accent tile beside the name, vector, correct at
any size. The slot-era version required a logo path, so its default could not render until someone
supplied a PNG. Here the logo is an upgrade, not a prerequisite.

### Images and video

Both reuse existing primitives rather than adding another fit implementation: `FittedPhoto` for
stills (fills the frame without cropping or letterbox bars) and `FootageClip` for video (the same
one the promo template uses, so trim, mute and determinism behave identically).

⚠️ A footage slot **cuts** in rather than fading. Slots do not overlap, so fading a full-frame clip
up from zero leaves the boundary frame showing bare ground — five near-flat frames, measured. It is
also the right grammar: a dissolve into moving pictures reads as a mistake.

### Device frames — `shared/DeviceFrame.tsx`

A phone or tablet drawn in CSS, for showing a screen as something someone is using rather than as a
slide. Put a **real capture** inside it: recreating a capturable product screen as styled divs is
this project's most costly recorded failure — see the `judge-video` skill's `fail-recreated-not-real`
entry.

## StepSequence — ordered steps, where the order carries meaning

**File:** `src/templates/step_sequence/` · shared parts in `src/templates/shared/`

```
context -> numbered steps -> a result -> a close,  with a rail running underneath the lot
```

### The distinction from SlotShort, which is the whole reason it exists

`SlotShort` assembles heterogeneous **promotional** content — a brand mark, a claim, a picture, a
call to action — where the order is **editorial**. Shuffle the middle and nobody is confused.

`StepSequence` is for a video where the order is **causal**: how something works, a process, a short
tutorial, a before/action/after progression. Step 3 follows step 2 because it has to, and the
numbering is information rather than decoration. If you could shuffle the middle, you want
`SlotShort`.

### The rail

A slot short shows one slot at a time and the viewer has no idea how many are left. Correct there.
Here the **sequence** has to be on screen, not just the current step — so a persistent strip of
pips, one per numbered step, fills as the sequence advances, and answers "where am I, how much is
left" on every frame.

⚠️ The rail is mounted **once at the composition root**, outside every `<Sequence>`, and reads the
**absolute** frame. Mounted per part it would restart on each cut and read as decoration on each
card rather than as one continuous progress through one process.

`railPosition()` is exported so the arithmetic can be asserted without rendering. The property
worth checking is that the rail agrees with the **timeline** — pip *i* is empty when step *i*
starts and full when it ends — not merely that it is monotonic. A monotonicity-only check passed a
deliberately reversed part list; it could not fail, which is this project's signature defect.

⚠️ The counter is hidden until step 1 is actually on screen. The first version read "1 / 3"
throughout the opening context, naming a step that had not started, beside three empty pips.

### A `result` step is not numbered

`emphasis: "result"` marks the outcome of the sequence. It gets the accent rule and larger type,
and it is deliberately **left out of the numbering** — it is what the steps produced, not another
instruction, and giving it a number invites the viewer to look for a step after it.

Steps are numbered by `compileSequence()` rather than in the plan, so inserting a step in the
middle renumbers the rest and no hand-written number can drift.

### The text column is pinned

⚠️ Every step's text starts at the same pixel — `COLUMN_LEFT_FRACTION`, one constant — and the
column width is fixed rather than shrinking to its content. Centring was the first attempt, and on
screen the label's left edge landed at three different x positions across three consecutive steps,
because each step's text is a different length. In a sequence whose point is that the parts are one
process, the eye then re-hunts the label on every cut.

### Where the plan lives

`src/templates/step_sequence/plan.ts` — **this is the file to edit.** Steps declare `seconds`, a
label, an optional body and optional media; `compileSequence()` accumulates the frames and exports
the total, so the duration is never written twice.

It also refuses a plan that does not hold together, using the same `readingFloor()` helper as the
caption layer and `SlotShort`, plus a footage-trim check. On this template's own first draft it
found **six** problems — every part was under-timed and the footage trim read 27 frames past the end
of its source. None of that is visible frame by frame.

### What it replaces

A config-driven `RecipeRenderer` with nine section types (`branded_intro`, `hero_video_clip`,
`caption_beat`, `progress_card`, `product_still`, `chapter_title`, `lower_third`, `branded_outro`,
`cta_card`), enumerations for platform, energy, caption style and transition style, and fields
carried for an external validator — `intent`, `remotion_hint`, `review_required`,
`animation_direction`. Those describe a *request being fulfilled*, not a video being made. The one
idea worth keeping was that a section declares its own length and the duration is the sum.

## VerticalAdvert — short-form social, laid out around the player's interface

**File:** `src/templates/vertical_advert/` · shared parts in `src/templates/shared/`

```
hook -> content beats -> captions inside the safe area -> CTA close
```

### Which template to reach for

| you want | use |
|---|---|
| cuts locked to music, a drop, an SFX table | `FootagePromo` |
| a brand short from ordered content slots | `SlotShort` |
| a guided tour of a product screen | `ProductWalkthrough` |
| ordered steps where the order is causal | `StepSequence` |
| **a vertical advert for a feed** | **`VerticalAdvert`** |

This is not FootagePromo rotated. Three things genuinely distinguish it, and they are why it
exists rather than being a preset of something else.

### 1. The safe area — `shared/SafeArea.tsx`

A 9:16 short is not watched on a clean canvas. The player draws a status bar and back arrow near
the top, and near the bottom a caption, a handle, action buttons and a progress bar. So a vertical
composition has **two** canvases, and confusing them is the classic mistake:

- **the visual canvas** — the whole frame. Footage and colour fill it. The player draws *over* it;
  it is not cropped.
- **the readable canvas** — the sub-rectangle where text can be trusted to be seen. Every caption,
  headline and CTA belongs inside it.

`SafeLayer` lays children out inside the readable rectangle; `safeRect()` returns it in pixels.

⚠️ The zones are **fractions**, never pixel constants for 1080×1920: the same advert is often
rendered at 720×1280, and a fraction survives that. The defaults reserve the top eighth and bottom
quarter — deliberately generous, and deliberately *not* any one platform's current measurements,
because every vendor moves its interface without notice.

Render with `--props='{"showSafeGuides":true}'` to see the zones drawn. It is a development aid and
must never ship enabled.

### 2. The hook

The first beat is short and has to land immediately — a scrolling viewer decides in about a second.
`compileAdvert()` enforces a reading floor on every beat, with a **separate allowance for the
hook**: a caption is read at a conversational pace, but a hook is *glanced* at. Holding a hook to
the caption pace would force it on screen long enough that the viewer has already gone.

The hook also does not fade out. Fading the opening headline makes it least readable on the frames
just before the cut, which reads as a hook that never landed.

### 3. Reframing — `shared/ReframedMedia.tsx`

Bringing a landscape master into a vertical frame has two honest answers, and the choice is
editorial:

- **`fit`** keeps the whole source, spanning the frame's width, floated on a blurred darkened copy
  of itself. Nothing is lost, and the bands above and below are where a title and CTA go.
- **`crop`** fills the frame edge to edge and cuts the sides away. Use it when the action is
  central. A **focal point** (0..1) decides which part survives.

⚠️ In `crop` the source is scaled to cover, so it cannot show an undefined edge, and the focal point
is **clamped** so the window stays inside the picture. Ask for the far left of a wide shot and you
get as far left as geometry allows.

`reframeGeometry()` is exported, so the arithmetic can be asserted without rendering.

### Multi-format

Beats declare **content**; a per-format policy decides layout. `FORMAT_POLICY` maps each aspect to
a safe-area spec, a reframe mode and a type scale. The same beat sheet therefore renders vertical
and landscape:

```
npx remotion render VerticalAdvert out/advert.mp4                          # 1080x1920
npx remotion render VerticalAdvert out/a.mp4 --props='{"format":"16x9"}'   # 1920x1080
```

⚠️ **One registration, not two.** The `format` prop drives `calculateMetadata`, which reads the
dimensions from the template's own `FORMAT_SIZE` table. An earlier arrangement registered the same
component twice — `VerticalAdvert` and `VerticalAdvertLandscape` — with the landscape size typed
out by hand in `Root.tsx`. Two hand-written sizes are two things that can disagree with
`FORMAT_SIZE`, and a reader could not tell whether the multi-format claim was structural or whether
the second entry had merely been configured to match. Now it is structural.

### Where the plan lives

`src/templates/vertical_advert/plan.ts`. Beats declare seconds, optional footage with a trim and
focal point, a headline or caption, an optional slam and an optional CTA. Frames accumulate and the
composition's duration is the sum, so it is never written twice.

## AiTop5 — the curated showcase

**File:** `src/templates/ai_top5/` · shared parts in `src/templates/shared/`

```
cold open -> #5 -> #4 -> #3 -> #2 -> #1 -> sign-off
```

A daily edition of an AI-news countdown: each story on the screen of a different era's television,
energy escalating toward #1, cut to a music bed. It is the one piece here that is a SHOW rather
than a template — a running order, an edition's worth of copy as data, and a regeneration path.

### Why it is kept

The generic templates each demonstrate one technique well. This demonstrates what happens when
several have to coexist for nearly two minutes: a countdown with escalating energy, a timeline
derived from a musical grid, section lengths that follow measured speech, a bed that breathes under
the narration, and a data file a script regenerates daily. None of the templates would be improved
by absorbing that, and it would not survive being split into five.

### Where the sample edition lives

`src/templates/ai_top5/data.ts` — one day's bulletin, as data, with a header explaining which
fields the render uses and which the regeneration path needs.

⚠️ **It is deliberately SILENT, and that is a decision rather than an omission.** The edition
previously named `vo/intro.mp3`, `vo/1.mp3` … `vo/signoff.mp3` while `public/vo/` did not exist, so
a fresh clone did not render a quiet video — it died on a 404 before the first frame. No
redistributable, licence-clean speech set was available to fix that honestly: a paid API would make
the shipped example require a key, and synthesized voice-band tones would be pretending to be
speech in the one example meant to show the real thing. So every VO field is a real `null`, the
render mounts no speech, and section lengths come from the reading floors of the copy on screen.
The bed and SFX remain — both synthesized in-house by `scripts/make-audio-assets.mjs`.

The voiced path is intact: populate `vo`/`voFrames` on a story, or `intro_vo`/`signoff_vo` on the
bulletin, and the mix carries them while the sections resize to the measured clips.

`npm run check:assets` also runs `check-edition-assets.mjs`, which refuses an edition naming a file
that is not committed. A static scan of the code could not have caught the original bug — those
paths come from `staticFile(TODAY.intro_vo)`, a variable — so that check reads the DATA and hits the
filesystem.

### The timeline — `src/templates/ai_top5/grid.ts`

Every frame number in the episode comes from here, in exact beat space at 124 BPM.

⚠️ **The old model rounded the beat and then multiplied it.** `Math.round(30 * 60 / 124)` is 15
frames against a true beat of 14.5161, so every beat gained 0.484 frames and, because starts
accumulate, the visual grid finished **105 frames — 3.5 seconds — ahead of the bed it claimed to be
locked to**. The #1 boundary was 79.8 frames out. The opening looked fine, which is exactly why it
survived: the drift is invisible until it is large, and by then it reads as "the edit feels loose"
rather than as an arithmetic bug.

`grid.ts` uses `shared/MusicalTime.ts` and rounds exactly once, where a beat becomes a frame.
`npm run check:grid` measures old and new against TRUE time across the whole episode and fails if
the new error exceeds half a frame.

Three rules the code follows, each of which was a bug before:

- **Phase boundaries are per story, not module constants.** Each is
  `localFrameAtBeat(story start, offset)`, and stories start on different beat phases — 9 of the 30
  phase cues differ by a frame between stories, so a shared constant was right for at most one.
- **A section is sized against the span it will actually occupy.** `beatsToCover()` checks, because
  a 38-beat span is 551 frames from some start beats and 552 from others; sizing from an average
  beat gives a section one frame too short for the voiceover it was sized to carry — on some days
  and not others, depending only on how long the earlier stories ran.
- **Anything locked to the music needs the ABSOLUTE frame.** A component inside a `<Sequence>` sees
  a clock that restarts at its own boundary, so `StoryPhases.absoluteFrom` is carried down. A beat
  pulse driven by the local frame re-phases against the bed five times an episode.

### Dynamic section length

A story's length in beats is `max(structural minimum, beats needed for the measured VO plus a
musical tail)`, clipped at a ceiling so one runaway read cannot silently stretch the episode. With
no measurement — the shipped silent edition — the minimum applies, and the fixed phases are sized
from the reading floors of the copy they carry.

### Regenerating an edition

`node scripts/make-ai-top5.mjs --ai-script --with-audio` rebuilds `data.ts` from the live feed.

⚠️ **That path spends money** — script generation, voice and images are all paid APIs. It is not
needed to render the shipped example, and nothing in `npm run lint`, `npm run hello` or
`npm run check:assets` calls it.

### Shared primitive extracted from it — `shared/ScreenLanding.tsx`

Flying a surface onto a device's screen and landing it on an exact frame. `screenBox()` turns a
screen rectangle expressed in FRACTIONS into pixels, `landingPose()` gives the transform for a
`flyin`, `catherine` or `cardflip` arrival, and `LandingSurface` carries the faces.

It takes the LAND frame rather than a start frame, which is the point: the landing is the moment
that has to coincide with a beat, so the approach is placed backwards from the moment that matters.

This replaced three registered compositions — `ScreenLandingTest`, `ScreenLandingCatherine` and
`ScreenLandingCardFlip` — development rigs that flew a "PLACEHOLDER NEWS IMAGE" card onto a device
plate for three seconds each. Their arithmetic was a **verbatim copy** of the production code, in a
second file, with nothing keeping the two equal: the rig could drift from the code it was meant to
be testing and neither would complain. `StoryVisual` and the primitive are now the same code.

### What else was retired from this cluster

- **`FinaleColourSplash`** as a separate composition. The effect is good and is kept — it IS the #1
  finale, rendered by `StoryVisual` for rank 1. Its standalone registration only ever exercised a
  placeholder branch the show never took; that branch is gone and `story` is now required.
- **`AiTop5Teaser`**, a 9:16 spoke. Everything production-worthy in it is better covered by
  `VerticalAdvert` — safe areas, hooks, reframing, short-form pacing. Its one genuinely useful
  lesson, that frame 0 must already be a finished frame because a platform uses it as the default
  thumbnail, was applied to `ColdOpen`: its first frame measured 7/255 mean luminance with a peak of
  17 (a black rectangle) and now peaks at 146 with the title legible.

## Adding a new template

1. Create `src/templates/<name>/` with the composition and an `index.ts`.
2. Put the editable surface in its own file — a `plan.ts` or equivalent — so an operator changes
   content in one obvious place rather than hunting through JSX for frame numbers.
3. Derive the duration from that plan and export it, so `Root.tsx` never repeats a number.
4. Reuse the shared primitives in `src/templates/shared/` rather than adding a second
   implementation of image fitting, video handling, captions or musical timing.
5. Register it as a `<Composition>` in `src/Root.tsx`.
6. Run `npm run lint`, then render the whole thing and **watch it**. A still at three frames is not
   a render: every defect worth finding in this repo's recent history was invisible to the numeric
   checks and obvious on screen.

## Adding code-transition steps

Add files named `codeN.<ext>` to `public/`. Duration and width recalculate automatically. For `.ts`/`.tsx` files, `//  ^?` on a line triggers a Twoslash type callout.
