---
name: video-tempo
description: Pace a silent, caption-driven video with a varied "train" rhythm — steady cadence that eases off into important moments and accelerates away — instead of uniform slowness. Sets per-message dwell from reading time and per-section duration from a rhythm map, so the cut shows progress without dragging or machine-gunning.
metadata:
  tags: remotion, timing, tempo, pacing, rhythm, captions, silent-video, editing
---

## When to use

Use this in **two** situations:

- **Authoring tempo up front** (now the dominant case): while writing a section's `TRACK` of
  `CaptionLine[]`, set each beat's dwell and pick the section's stations *as you write*, so tempo
  is designed in rather than fixed later. The live cut does this — see `S2Problem.tsx:9-20`, whose
  comment plans "quick-quick (~2.2s each) … then two slower lines settle" *before* a frame renders.
- **Re-pacing an existing cut** (remedial): whenever a video "drags", feels too long, or has uniform
  pacing. It fixes the most common silent-video failure: every message held for the same long beat,
  so nothing has rhythm and the non-action stretches feel slow.

It pairs with [silent-caption-system](../silent-caption-system/SKILL.md) (which owns the per-caption
reading-time floor) — this skill owns the **rhythm across the whole cut**.

Core principle (the user's brief, verbatim intent): *"A good video has similar tempo in text/speech and
images. A slow reading time is all a message should spend on screen. Not machine-gun fire, but show
progress. Like a train on a track: steady pace, slow a little as something interesting approaches, then
back off again. Quick, slow, quick-quick, slow."*

---

## Domain facts (fixed)

- 30 fps. Frame-based timing only.
- **Reading-time floor (from silent-caption-system):** a caption must hold ≥ `max(1.8s, chars × 0.07s)`.
  That floor is the *minimum* — tempo decides how much (if any) to add on top. (Commented at
  `Caption.tsx:19`.)
- **The floor is also the target.** A message should spend *a single slow read* on screen, then leave.
  Holding longer than ~floor + 1s with nothing else changing is what makes a cut drag.
- Text tempo and image tempo must MATCH. If captions change every ~3s, the visuals should have a beat on
  roughly that cadence too (a reveal, a recolour, a push) — never a long static hold under changing text,
  never rapid captions under a frozen image.
- **`title`-style captions auto-extend by +0.4s.** `Caption.tsx` (`TITLE_HANG_S = 0.4`, `effectiveOut`
  at lines 23, 38–51) silently hangs every `title` line a little past its authored `out_s` — clamped so
  it never overlaps the next centred caption (`TITLE_GAP_S = 0.25`) or bleeds past `sceneEndS`. **The
  on-screen dwell of a `title` beat is therefore `out_s − in_s + ~0.4s`, not the raw arithmetic.** Account
  for this when computing total runtime (see Procedure step 5).

---

## The train-tempo model

Think of the cut as a train on a track at a confident cruising speed, easing into stations
(the moments that matter) and accelerating out of them.

- **Cruise (steady):** ordinary explanatory beats run at reading-floor pace — caption in, read, out, next.
  No dead air after the read. This is most of the video.
- **Brake (slow) — approaching something interesting:** just before a payoff (a recolour, the globe
  building, the Codex nexus, a thesis line), *ease off*: give the setup caption a touch more dwell and let
  the visual breathe so the viewer feels the arrival. Slowing signals "watch this".
- **Station (the held beat):** the payoff itself gets the longest single hold of its neighbourhood — but
  ONE beat, not many. This is where you spend time, because it earns it.
- **Accelerate (quick / quick-quick):** straight after a payoff, move briskly — two or three short beats
  back-to-back — to carry momentum and avoid a post-climax sag. This is the "quick quick" in the rhythm.

So a section reads as **quick · slow · quick-quick · slow**, not a flat line. Per video, the *stations*
(the few payoffs) are the only places that may run long; everything between them cruises.

### Practical cadence
- Cruise caption dwell ≈ reading floor (no padding). Fades 6f in / 6f out (`Caption.tsx` `FADE = 6`),
  ~6-10f gap between.
- Brake: +0.3–0.6s on the approach caption; let the incoming visual start ~6-10f before its caption.
- Station hold: the payoff visual holds ~1.5–2.5s at full state (the one place to linger).
- Accelerate: 2–3 captions at floor pace with minimal gaps right after the station.
- **A caption that only restates the visual gets the floor and no more. A caption that advances the
  story can take a brake beat.**

---

## The editing surface (where tempo actually lives)

Tempo is two numbers per section file:

1. **The caption track** — `const TRACK: CaptionLine[]` (times in **seconds**, relative to scene start;
   `{ in_s, out_s, text, style }`). "Re-time to the floor" / "set the dwell" literally means editing
   `out_s − in_s` for a beat here. (`S2Problem.tsx:13-20` is the canonical worked example.)
2. **The section frame budget** — `export const S*_FRAMES = <n>` (`S2Problem.tsx:7` = `500`). This is the
   length the section occupies in the master `<Series>`; it must be ≥ the last `out_s × 30` plus exit.

Worked example — `S2Problem` (the train braking into a station):

```ts
export const S2_FRAMES = 500; // ~16.7s @ 30fps
const TRACK: CaptionLine[] = [
  { in_s: 0.5, out_s: 2.4, text: "Who represents me?",            style: "title" }, // quick
  { in_s: 2.5, out_s: 4.4, text: "How did they vote?",            style: "title" }, // quick
  { in_s: 4.5, out_s: 6.4, text: "What did it mean?",             style: "title" }, // quick
  { in_s: 6.5, out_s: 8.6, text: "And what could I do about it?", style: "title" }, // quick-quick
  { in_s: 9.0, out_s: 13.4, text: "Four simple questions…",       style: "subtitle" }, // settle (station)
  { in_s: 13.6, out_s: 16.5, text: "MyGov is built around the whole journey.", style: "subtitle" }, // settle
];
```

(Note: each `title` line above also hangs +~0.4s on screen — see Domain facts.)

---

## Procedure — pacing a NEW section from scratch

1. **Draft the beats as text.** List the messages in story order. Mark the 1–2 that are the *station*
   (the payoff the section exists for); everything else is cruise or a connective brake.
2. **Set each cruise beat to the floor.** `in_s` butted ~0.1–0.3s after the previous `out_s`; dwell ≈
   `max(1.8, chars×0.07)`. Quick-quick runs sit end-to-start (see S2's four questions).
   - **Never plan from a flat per-beat estimate.** A guessed duration (e.g. "3s a beat" from a brief)
     under-runs long beats and silently breaks the budget: a 69-char beat needs **4.83s**, not 3s.
     Compute `max(1.8, chars×0.07)` on the *actual text of every beat* **before** you fix any
     `*_FRAMES`, total, or section budget — the floor sets the duration, your estimate does not.
     (Validated on AI TOP 5 ed.001: a 3s/beat plan came out 97s; recomputing floors gave the honest
     147.5s. Especially true for text-only / silent bulletins where reading dominates the runtime.)
3. **Give the station the long hold** (~1.5–2.5s at full visual state), with a brake beat (+0.3–0.6s)
   on the approach line just before it.
4. **Land a visual event on each caption cadence** (reveal / recolour / push), so image tempo matches
   text tempo. No long static hold under changing captions.
5. **Set `S*_FRAMES`** = `ceil(last out_s × 30)` + exit, and **account for the `title` +0.4s hang** so the
   last beat fades before the cut. Confirm the section is registered in `MyGovFinal.tsx`'s `SECTIONS`.

## Procedure — re-pacing an existing cut

1. **Measure.** For each section, list every caption `[in_s, out_s]` and its on-screen dwell (remember
   `title` lines carry +~0.4s), and the section's total frames/seconds. Flag any dwell that exceeds
   `floor + ~1.0s` with no visual change — that's drag.
2. **Classify each beat:** cruise / brake / station / accelerate. Most are cruise. Identify the 1–2
   *stations* per section (the real payoffs) — only they may run long.
3. **Re-time captions to the floor** for all cruise beats (cut padding). Apply brake/station/accelerate
   only where the content earns it. Tighten inter-caption gaps so beats connect.
4. **Match the image tempo:** ensure a visual event lands on roughly each caption cadence; move section
   visual keyframes so reveals/recolours/pushes align to the new caption beats. Kill long static holds
   that sit under changing captions.
5. **Recompute section duration** = sum of re-timed beats + entrance/exit. Update `S*_FRAMES`. Expect a
   dragging cut to roughly **halve**. **Then recompute the FILM total correctly** (see below) — the
   master timeline is more than the sum of sections.
6. **Sequence-level rhythm:** across the whole film, alternate denser and lighter sections so the macro
   shape is also quick/slow/quick-quick/slow — don't put two slow "station" sections back to back. The
   ~58-frame chapter cards between sections (see below) are themselves a deliberate macro-breath — count
   them as part of this shape.
7. **Narrative check:** pacing alone isn't engagement. Each beat should *advance a story*, not just label
   the screen. Where a section only states the official line, add a beat that carries the narrative
   forward (tension → resolution), then pace that beat as a brake/station. See "Narrative" below.

---

## The master timeline is INTERLEAVED (read before computing the total)

The master `<Series>` in `MyGovFinal.tsx` does **not** play the sections directly. It flattens
`SECTIONS` into an `ITEMS` list — **a chapter card before every section** — then appends an `EndCard`,
and the **film total is reduced from `ITEMS`, not `SECTIONS`** (`MyGovFinal.tsx:38-45`):

```ts
const ITEMS: Item[] = [];
SECTIONS.forEach(({ C, f, title }, i) => {
  if (title) ITEMS.push({ key: `t${i}`, node: <SectionTitle {...title} />, f: titleCardFrames(title.holdExtra) });
  ITEMS.push({ key: `s${i}`, node: <C />, f });
});
ITEMS.push({ key: "endcard", node: <EndCard />, f: ENDCARD_FRAMES });
export const MYGOV_TOTAL_FRAMES = ITEMS.reduce((a, it) => a + it.f, 0); // sums ALL items
```

So the played order is `[card, section, card, section, …, finale, endcard]`. Consequences for tempo:

- Each chapter card is **`titleCardFrames(holdExtra)` ≈ 58f (~1.4s)** (`SectionTitle.tsx:16,22`), holding
  long enough for a judge to read "number + title + what-this-proves" — except the opener, which holds
  `holdExtra: 15` longer (`MyGovFinal.tsx:24`). The finale (`FireworksFinale`) deliberately carries **no
  card**; the run ends on `EndCard` (`ENDCARD_FRAMES = 150`, ~5s).
- **A re-pacer who only sums `S*_FRAMES` will under-count the film** by ~9 cards × ~58f + the opener's
  extra hold + the EndCard. The live total is **6315 frames / 3:30.5** (VIDEO_RECORD v10), of which the
  cards + EndCard are a real fraction.
- The ~1.4s black cards are a **macro-rhythm / breath device** — the very "don't stack two slow stations"
  concern step 6 owns. Treat them as cruise breaths in the macro shape, not as overhead to be ignored.

---

## Narrative (keeps someone engaged)

Tempo stops a video dragging; narrative is what makes it worth watching. The official feature line
("search, visualise, explain, act") is the *spine*, not the *story*. Layer a human throughline on top:
a problem felt → a tool that answers it → the surprise of how far it goes → the honest build behind it.
Give the interesting turns a brake/station beat; let the connective facts cruise. Vary sentence length
and weight the way you vary tempo — a short punchy line lands harder after a longer one.

---

## Hard rules (never violate)

1. **Reading floor is the minimum AND the working target.** Cruise beats hold ≈ floor, no padding.
2. **Spend time only at stations.** One long hold per payoff, not many; everything between cruises.
3. **Match text and image tempo.** A visual beat lands on roughly each caption cadence — no long static
   image under changing captions, no rapid captions under a frozen image.
4. **Vary the rhythm — quick, slow, quick-quick, slow.** A flat uniform pace is the failure being fixed.
5. **Never machine-gun.** Brisk ≠ unreadable; even "quick" beats meet the reading floor.
6. **Frame-based only;** recompute `S*_FRAMES` after re-timing. The master `<Series>` plays the flattened
   `ITEMS` list (`[card, section, …, finale, EndCard]`) and `MYGOV_TOTAL_FRAMES` sums **all** of them
   (`MyGovFinal.tsx:38-45`) — keep both the section budget and the film total in sync.
7. **`title` captions hang +~0.4s** (`Caption.tsx` `TITLE_HANG_S`) — fold that into any dwell/total math.
8. **Pacing serves narrative.** If a beat doesn't advance the story or reward the eye, cut it rather than
   hold it.

---

## Self-evaluation (regression checks — code is ground truth)

Each check is `claim → code location that confirms it → how to test`. A FAIL means the skill has drifted
from the live cut and must be corrected (code wins).

1. **Reading floor is `max(1.8s, chars×0.07s)`.** → `Caption.tsx:19` (the floor comment). → Grep
   `chars*0.07` in `captions/Caption.tsx`; the skill's Domain-facts floor must match exactly.
2. **Fades are 6f.** → `Caption.tsx:20` (`const FADE = 6`). → The "Practical cadence" 6f-in/6f-out must
   equal `FADE`.
3. **`title` lines auto-hang +0.4s.** → `Caption.tsx:23` (`TITLE_HANG_S = 0.4`) + `effectiveOut`
   (`:38-51`). → If the skill ever says a `title` dwell is simply `out_s − in_s`, it has drifted.
4. **The master timeline is interleaved and the total sums ITEMS.** → `MyGovFinal.tsx:38-45` (ITEMS built
   `[card, section, …]`, `MYGOV_TOTAL_FRAMES = ITEMS.reduce(...)`). → Grep the `.reduce(` source: it must
   be `ITEMS`, not `SECTIONS`. If the skill implies the film total = Σ `S*_FRAMES`, FAIL.
5. **Chapter cards are ~58f.** → `SectionTitle.tsx:16` (`TITLE_FRAMES = 58`) + `:22` (`titleCardFrames`).
   → The card duration the skill quotes must equal `TITLE_FRAMES`.
6. **Per-section `S*_FRAMES` exports exist and feed the Series.** → `S2Problem.tsx:7` (`S2_FRAMES = 500`),
   `FireworksFinale.tsx:23`. → Each section in `SECTIONS` exports an `*_FRAMES`; Hard Rule 6 names the
   right surface.
7. **The train beat is encoded, not aspirational.** → `S2Problem.tsx:9-20` (quick-quick questions →
   settle lines, with the floor restated inline). → The worked example must match this `TRACK`.
8. **Determinism: no clock, no `Math.random`, no CSS transition/animation.** → repo-wide grep returns only
   *prohibiting* comments (e.g. `Fireworks.tsx:18-23`), zero real usages. → If any section adds a CSS
   `transition`/`animation` or `Math.random` in render, that is a code bug, not a skill correction.
9. **Stations named by the skill are live files.** → "globe building" = `surfaces/globe/GlobeBuild.tsx`;
   "the Codex nexus" = `sections/build/CodexNexus.tsx` (BeatC of `S7BuildStory.tsx`). → Both resolve in
   the tree; if a named station's file is gone, update the example.
10. **silent-caption-system still owns the per-caption floor.** → its `rules/` subdir + `<Caption>`
    contract. → The "pairs with … which owns the floor" cross-reference must still point at a live skill.

---

## Changelog (append-only — newest first)

- v3 (2026-06-05): **Beat-floor planning discipline** (candidate from the AI TOP 5 ed.001 build, cc).
  Added a sub-point to "pacing a NEW section from scratch": never carry a flat per-beat estimate into
  the frame budget — compute `max(1.8, chars×0.07)` on the actual beat text first, because for
  text-only/silent cuts the reading floor (not the estimate) sets the runtime. Evidence: a 3s/beat plan
  rendered 97s vs the honest 147.5s once floors were computed. Code-true (matches `Caption.tsx:19` floor).
  Watch-item (NOT yet a skill change, single data point): a human verdict that the cold-open/countdown
  "feels a bit fast at the start" — candidate "ease into the opening before accelerating"; confirm if it
  recurs before editing.
- v2 (2026-06-01): **Corrected three drift items against the live v10 cut** (ground truth:
  `mygov-campaign-video/src`, corroborated by VIDEO_RECORD v8/v9/v10 reconciling to 6315 frames).
  (a) **Architecture-miss** — added "The master timeline is INTERLEAVED" section and amended Procedure
  step 5 + Hard Rule 6: the master `<Series>` plays a flattened `ITEMS` list `[card, section, …, finale,
  EndCard]` and `MYGOV_TOTAL_FRAMES` reduces from ITEMS, not from `SECTIONS` (`MyGovFinal.tsx:38-45`); the
  ~58f cards (`SectionTitle.tsx:16,22`) are a deliberate macro-breath, so step 6's sequence-rhythm rule
  now counts them. (b) **Framing-stale** — reframed "When to use" + added a "pacing a NEW section from
  scratch" procedure so authoring-up-front (the now-dominant mode, `S2Problem.tsx:9-20`) is co-equal with
  remedial re-pacing. (c) **Convention/correctness** — documented that `title` captions auto-hang +0.4s
  (`Caption.tsx:23,38-51` `TITLE_HANG_S`), so dwell ≠ `out_s − in_s` for titles; added Hard Rule 7. Also
  named the editing surface (`TRACK` seconds + `S*_FRAMES`) with a worked `S2Problem` example, and added a
  10-check `## Self-evaluation` rubric that would have caught all three drifts. No voice/scope changes
  beyond what the code forces.
- v1: Initial authored skill — train-tempo model, reading-floor target, remedial re-pacing procedure.
