---
name: silent-caption-system
description: The discipline and component contract for telling a SILENT MyGov video entirely through on-screen captions — every narration idea becomes a readable Title / Kicker / Subtitle / Label on a per-scene caption track, frame-based, accent-aware, and legible enough that a muted viewer follows the whole film.
metadata:
  tags: captions, subtitles, silent, narration, remotion, frame-based, legibility, reading-pace, mygov, title-card
---

## When to use

Use this skill whenever you author or edit captions for the MyGov film. The film has **no audio** —
there is no voice-over, no music bed, nothing on the soundtrack. That makes captioning **load-bearing,
not decorative**: every idea the narration *would* have spoken must instead be a caption the viewer can
read. Audio may be added later, so the caption track has to be the **complete narration** on its own.

This skill is an **authoring** skill: it produces a per-scene **caption track** (data) and the small set
of reusable Remotion components that render it. It covers three jobs:

1. Turning a scene's narration intent into a timed caption track of Titles, Kickers, Subtitles, and Labels.
2. The `<Captions>` dispatcher contract (and its internal per-style blocks) that reads the track and draws it.
3. The legibility and pacing QA that proves a muted viewer can follow the whole story.

It does **not** design the footage or product capture underneath — it sits the captions on top of whatever
scene is already there. It also does **not** render the per-chapter title cards: chapter opening is now the
job of a separate `SectionTitle` component (see "Relationship to `SectionTitle`" below), which is out of
this skill's scope.

---

## Domain facts (fixed)

- **Frame-based motion only.** Every fade and move is driven by `useCurrentFrame()` + `interpolate()` +
  `<Sequence>`. **No CSS `transition`, no CSS `animation`, no Tailwind `animate-*`** — they do not render
  in Remotion. Static CSS (gradients, `clip-path`, `filter: blur()`, `backdrop-filter`, scrim backgrounds)
  is fine.
- **1920×1080 @ 30 fps.** Convert frames↔seconds at 30: `seconds = frames / 30`. Track times are written
  in **seconds**; the component converts them to frames at render (`inF = in_s * fps`).
- **Standard ease:** `EASE = Easing.bezier(0.16, 1, 0.3, 1)`. Fades use it, clamped both ends.
- **Four caption styles** — every caption is exactly one of these:
  1. **title** — a large centred serif one-liner. The in-scene **emphasis beat** (a "station" the cut
     lingers on, a question, a thesis line): "One person. One path.", "Democracy with receipts.",
     "This isn't a mockup." It is **not** the chapter opener — that is `SectionTitle`'s job. Centre stage,
     briefly; gets a small extra **title-hang** (see below).
  2. **kicker** — a small centred mono accent line, uppercase, with a short accent rule beside it. A quiet
     framing line shown over the centre ("A buildability map — not a government score."). It shares the
     centre band with `title`, and the renderer keeps the two from colliding.
  3. **subtitle** — the **narration bar**. Inter 36px, bottom-centre, on a dark scrim
     `rgba(7,9,15,0.78)` with `backdrop-filter: blur(8px)`, with an accent **left-tick** in the chapter
     colour. 1–2 short lines. This is where the spoken story lives.
  4. **label** — small UI **pointer pills** ("Search", "Four lenses", "Live · Planned · Researching")
     placed near the cursor or target at a **fractional** `(x, y)`. They annotate the product, not narrate
     the story.
- **Reading-pace rule (the floor).** A caption must stay on screen for at least
  `hold_seconds ≥ max(1.8, chars × 0.07)`. Fades are ~6 frames in and ~6 frames out (inside the hold).
  Never more than **~9 words** on screen at once — split into a second line or a second caption instead.
  (The component enforces the floor only softly, via the fade clamp; authors must honour it explicitly.)
- **Z-order.** Captions sit **above all footage** via `zIndex: 100` on the dispatcher's `AbsoluteFill`
  (`Caption.tsx:156`). Subtitles must clear the product footage's own lower-third UI — reserve a safe band
  (see Phase 3).
- **Base palette:** BG `#07090f` · TEXT `#e8eaf0` · MUTED `#475569` · ACCENT `#7dd3fc`.
- **Chapter accents** (one per chapter; the Kicker rule/text and the Subtitle left-tick of a chapter use
  the **same** accent): pink `#e4407a` · cyan `#38bdf8` · purple `#7c3aed` · green `#02a95b` ·
  lime `#a3e635` · yellow `#f59e0b` · orange `#f97316` · blue `#2563eb`. These live in `accents.ts` as the
  `ACCENTS` map (`sourceLens`, `map`, `explain`, `global`, `agentParty`, `buildSystem`, `distribution`,
  `mobile`, plus `hub` = base cyan `#7dd3fc`).
- **The track is data.** A scene declares a `track` array of `CaptionLine` objects
  `{ in_s, out_s, text, style, accent?, x?, y? }`. Times are **seconds relative to scene start**. The
  `<Captions>` component reads `useCurrentFrame()` / `fps`, converts to seconds, and renders whichever
  entries are active — see [./rules/caption-track-schema.md](./rules/caption-track-schema.md).

---

## Phase 0 — Confirm the silent constraint & gather narration intent

1. Restate the constraint out loud before writing anything: **this scene has no audio.** If a thought
   only exists as "the voice-over says…", it does not exist for the viewer until it is a caption.
2. Gather the scene's **narration intent**: the ordered list of things that must be *said* in this scene —
   the claims, the instructions, the emphasis beat. Write them as plain prose first ("state the thesis",
   "one click recolours the whole map", "tell them to switch to the Gender lens").
3. Note the scene's **chapter accent** (one of the eight in `ACCENTS`) and its duration in seconds. Each
   caption that wants the accent (kicker, subtitle left-tick, label) passes it explicitly via the `accent`
   field — there is **no** scene-wide `accent` prop on the dispatcher; accent rides on each line.
4. If the scene has no narration intent at all, it still may need Labels to point at the UI — but a scene
   that advances the story with **nothing** on screen to read is a gap; flag it.

---

## Phase 1 — Write the caption track

Convert each narration idea from Phase 0 into a typed, timed caption entry.

1. **Choose the style per idea:** a centred emphasis/station beat → **title**; a quiet centred framing line
   → **kicker**; a spoken claim / sentence of the story → **subtitle**; an instruction pointing at the UI →
   **label**.
2. **Write the text tight.** ≤ ~9 words on screen at once. If a Subtitle needs more, split it into two
   short lines (use `\n`) or into two consecutive Subtitles. Prefer plain words over jargon — the viewer
   reads, they do not re-listen.
3. **Set `in_s` / `out_s` in seconds relative to scene start.** Enforce the reading-pace floor on every
   entry: `out_s − in_s ≥ max(1.8, chars × 0.07)`. Compute `chars` from the full visible text. If two
   captions must not overlap in the same band (e.g. a title then its subtitle), butt them end-to-start, not
   on top. Note `title` lines get a small clamped **title-hang** past their authored `out_s` (see Phase 2).
4. **Sequence the scene:** typically a `title` opens the emphasis beat (centre), then Subtitles carry the
   narration along the bottom, with Labels appearing only while the relevant UI action is happening; a
   `kicker` can frame the centre between beats.
5. **One track per scene, or one global track per multi-beat section.** Most sections pass one `TRACK` per
   scene component. Fast multi-beat cuts (e.g. `RapidFlow`) deliberately use a **single global track at the
   root in absolute seconds** so a late line's reading-floor can bleed across beat boundaries
   (`RapidFlow.tsx:32`, `:200`). Both are valid; pick per the cut's rhythm.
6. The exact field shape and a fully worked scene track are in
   [./rules/caption-track-schema.md](./rules/caption-track-schema.md).

---

## Phase 2 — Component contract

Build (or reuse) one small, frame-based component set the track drives. The track is the only input that
changes per scene; the components are fixed. The real module is `src/captions/Caption.tsx`.

- **`<Captions track sceneEndS? />`** — the dispatcher (note the **plural** name). Reads `useCurrentFrame()`
  and `fps`, computes `t = frame / fps` (seconds since scene start), and for each line computes its opacity
  envelope and renders it via the block for its `style`. It sets `zIndex: 100` on its `AbsoluteFill` so it
  is always topmost. **There is no `accent` prop** — accent is per-line. The optional `sceneEndS` (seconds)
  lets end-adjacent `title` lines hang without bleeding past the section cut.
- **Internal per-style blocks (not exported):** `TitleBlock` (large Georgia serif, centred, ~92px/700),
  `KickerBlock` (centred mono uppercase + a short accent rule), `SubtitleBlock` (bottom-centre Inter 36px
  bar, scrim + blur + accent left-tick), `LabelBlock` (a small **filled accent pill with dark text** at a
  fractional `(x, y)`). Authors never render these directly — they only write the track.
- **Fades are frames, times are seconds — show the bridge.** Each line's opacity is
  `interpolate(frame, [inF, inF+6, outF-6, outF], [0,1,1,0], { easing: EASE, extrapolateLeft: "clamp",
  extrapolateRight: "clamp" })` where `inF = in_s * fps`. **No CSS transition.**
- **Title-hang.** A `title`'s effective fade-out is extended by `TITLE_HANG_S = 0.4s` so the hero line reads
  — but clamped so it never runs into the next centred caption (`TITLE_GAP_S = 0.25s` before the next
  `title`/`kicker`) and never bleeds past `sceneEndS`. So a `title`'s real visible window can be slightly
  longer than its authored `out_s`. Pass `sceneEndS={FRAMES / 30}` whenever the last caption in a section
  is a `title`, or it can fade past the cut (`Caption.tsx:37-51`; passed in `S4MassAction.tsx:89`,
  `S8Close.tsx:79`).

```tsx
// Captions dispatcher — frame-based, topmost via zIndex:100. Times are seconds since scene start.
// Source of truth: src/captions/Caption.tsx
const FADE = 6; // frames
const EASE = Easing.bezier(0.16, 1, 0.3, 1);

export const Captions: React.FC<{ track: CaptionLine[]; sceneEndS?: number }> = ({ track, sceneEndS }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ zIndex: 100 }}>
      {track.map((line, i) => {
        const op = lineOpacity(frame, fps, line.in_s, effectiveOut(line, track, sceneEndS));
        if (op <= 0.001) return null;
        const rise = interpolate(op, [0, 1], [12, 0]);
        switch (line.style) {
          case "title":    return <TitleBlock    key={i} line={line} op={op} rise={rise} />;
          case "kicker":   return <KickerBlock   key={i} line={line} op={op} />;
          case "subtitle": return <SubtitleBlock key={i} line={line} op={op} rise={rise} />;
          case "label":    return <LabelBlock    key={i} line={line} op={op} />;
          default:         return null;
        }
      })}
    </AbsoluteFill>
  );
};
```

Full per-style sizes, weights, and the scrim spec are in
[./rules/timing-and-legibility.md](./rules/timing-and-legibility.md).

---

## Phase 3 — Layout & z-order

1. **Captions are always on top.** `<Captions>` sets `zIndex: 100` on its `AbsoluteFill`, so render it
   anywhere in the scene tree and it stays above every footage and graphic layer. (It does **not** set
   `pointerEvents: "none"` today — in a rendered video there is nothing to click, so this is moot; do not
   rely on pointer-events as the mechanism.)
2. **title** sits centred (vertically and horizontally), large serif — it owns the screen for its short
   hold, so it does not need to dodge the footage UI.
3. **kicker** also sits centred but lower (a small offset below centre), so a `title` and a `kicker` can
   share the centre band sequentially. The renderer's title-hang clamp (Phase 2) keeps a `title` from
   overrunning a following centred `kicker`.
4. **subtitle** sits **bottom-centre inside the safe band `y ≈ 880–1010`** (1920×1080), within the side
   margins. The product footage often has its own lower-third UI; the subtitle band must **clear it** — if
   the footage's controls live below ~y=860, raise the subtitle or scrim wider, never overlap.
5. **label** sits at its fractional `(x, y)` (centre of the pill; `left/top = x*100% / y*100%`,
   `translate(-50%,-50%)`), nudged so the pill does not cover the thing it points at. Keep labels inside the
   safe margins too.
6. Never let two captions occupy the same band at the same time. A title/kicker (centre) and a Subtitle
   (bottom) may coexist; two Subtitles may not, and two centred captions are kept apart by the title-hang
   clamp.

---

## Phase 4 — Legibility & pace QA (the silent test)

Before signing off a scene's track, prove it reads:

1. **Read every caption at its stated duration, at 1080p.** Hold each for `out_s − in_s` and actually read
   it. If you cannot read it calmly in that window, it fails the reading-pace floor — extend the hold or cut
   words. Re-check `out_s − in_s ≥ max(1.8, chars × 0.07)` for each entry.
2. **Contrast & clipping.** TEXT `#e8eaf0` on the scrim `rgba(7,9,15,0.78)` (with blur) must stay crisp over
   the footage. No line clips the frame edge or the safe margins; no glyph is cut by the scrim.
3. **No overlap, no rush.** No two captions share a band; nothing flashes shorter than its floor; fades are
   ~6 frames, not instant pops.
4. **The silent test — the thesis of this skill.** Mute everything and watch the scene (or read the track
   top to bottom with the footage). **Does the story still make complete sense with zero audio?** A viewer
   who can hear nothing must be able to follow the whole film from the captions alone. If a beat only lands
   with imagined narration, that narration is missing — add the caption. The track, by itself, is the film's
   complete narration.

> **Automated check has a blind spot — verify dynamic captions by hand.** `scripts/video-checks.cjs`
> enforces the reading floor only on **literal** `text: "..."` strings (its `TEXT_RE` matches quoted
> literals). A caption whose text is **dynamic** — `text: story.cue`, `text: beat`, any variable or
> template — registers as empty, so its floor is computed as `max(1.8, 0) = 1.8s` and **always passes**,
> even if the real text needs 4.8s. Templates that map captions from data (bulletins, anything
> data-driven) MUST verify floors manually against the longest possible runtime value: for each dynamic
> field, take the longest string the data can hold and confirm `out_s − in_s ≥ max(1.8, chars×0.07)`.
> A green `video-checks` run does **not** clear dynamic captions.

---

## Hard rules (never violate)

1. **Every spoken idea is a caption.** If the narration would say it, it appears on screen as a title,
   kicker, subtitle, or label. Nothing in the story is left to audio that does not exist.
2. **Reading-pace floor is non-negotiable.** Every caption holds `≥ max(1.8s, chars × 0.07s)`. Never flash
   text shorter than its floor; never put more than ~9 words on screen at once.
3. **Frame-based motion only.** Fades and moves via `useCurrentFrame()` + `interpolate()` + `<Sequence>`,
   clamped. No CSS `transition` / `animation` / Tailwind `animate-*` — they will not render.
4. **Captions sit above all footage.** `<Captions>` sets `zIndex: 100`; render it anywhere in the scene
   tree and it stays topmost. Subtitles must clear the product footage's own lower-third.
5. **Chapter-accent consistency.** Within a chapter, the Kicker accent, the Subtitle left-tick, and the
   chapter's labels use the **same** chapter accent (passed per-line via `accent`). Do not mix accents
   inside one chapter.
6. **The track is the complete narration.** A deaf viewer — or anyone watching muted — must follow the whole
   film from captions alone. The silent test (Phase 4) must pass before a scene is done.

## Relationship to `SectionTitle` (chapter opening is out of scope)

Chapters are opened by a **separate** `SectionTitle` component (`src/sections/build/SectionTitle.tsx`), not
by a caption-track entry. `MyGovFinal.tsx` attaches one `SectionTitle` (props `index` / `title` / `subtitle`
/ `accent` / `holdExtra`) before each section as a quick black interstitial card. A caption-track `title`
entry is therefore an **in-scene** emphasis beat, never the chapter card. Do not duplicate the chapter card
inside a track.

## Sub-files

- [./rules/caption-track-schema.md](./rules/caption-track-schema.md) — the `CaptionLine`
  `{ in_s, out_s, text, style, accent?, x?, y? }` track schema (four styles incl. `kicker`),
  scene-relative timing, fractional label coords, and a fully worked scene track.
- [./rules/timing-and-legibility.md](./rules/timing-and-legibility.md) — the reading-pace formula, fade
  timings, title-hang, max words, per-style fonts/sizes/weights, scrim & contrast spec, safe-area margins,
  and the silent test in detail.

> **NOTE TO REVIEWER — corrected sub-file sections (inlined so the render-breaking fixes are not lost).**
> The two `rules/` files must be updated alongside this SKILL.md. The corrected sections are reproduced
> here for the approval diff; apply them to the live sub-files when this proposal is accepted.

### Corrected `rules/caption-track-schema.md` — the entry shape

```ts
export type CaptionStyle = "title" | "kicker" | "subtitle" | "label";

export type CaptionLine = {
  in_s: number;     // seconds since SCENE start — when the caption appears
  out_s: number;    // seconds since SCENE start — when it disappears (title gets a clamped hang past this)
  text: string;     // the visible words; "\n" splits a Subtitle into two lines
  style: CaptionStyle;
  accent?: string;  // chapter accent for the kicker rule / subtitle left-tick / label pill fill
  x?: number;       // label only — FRACTIONAL 0..1 of frame width  (left = x*100%)
  y?: number;       // label only — FRACTIONAL 0..1 of frame height (top  = y*100%)
};

export type CaptionTrack = CaptionLine[];
```

Field rules (corrected):
- **`in_s` / `out_s` are seconds, relative to the scene's own start.** Converted at 30 fps
  (`inF = in_s * 30`); never hand-write frame numbers. A `title`'s effective end is extended by a clamped
  `TITLE_HANG_S = 0.4s` (see SKILL Phase 2 / timing sub-file).
- **`out_s − in_s` must satisfy the reading-pace floor:** `≥ max(1.8, chars × 0.07)`.
- **`style`** is one of **four**: `"title"` (centred serif emphasis beat), `"kicker"` (centred mono accent
  line), `"subtitle"` (bottom narration bar), `"label"` (pointer pill at fractional `(x, y)`).
- **`accent`** is per-line and optional; the dispatcher has **no** scene-wide accent. Pass the chapter
  accent on each kicker / subtitle / label that should carry it.
- **`x` / `y` for labels are FRACTIONS 0..1**, not pixels. The renderer does `left: \`${(x ?? 0.5)*100}%\``
  (`Caption.tsx:130`). Every shipped label is fractional (S3 `x:0.86,y:0.74`; S6 `x:0.5,y:0.86`).

### Corrected worked example (fractional label, four styles in play)

```ts
// Scene: "Map recolour". Chapter accent #38bdf8 (cyan, ACCENTS.map). Times are seconds since scene start.
const mapRecolourTrack: CaptionTrack = [
  { in_s: 0.0, out_s: 2.2, style: "title",
    text: "Click a vote." },                                       // 13 ch → floor 1.8s; hold 2.2s ✓

  { in_s: 2.2, out_s: 5.4, style: "subtitle", accent: "#38bdf8",
    text: "One click. The whole country answers." },               // 37 ch → 2.59s; hold 3.2s ✓

  { in_s: 2.6, out_s: 5.4, style: "label", accent: "#38bdf8", x: 0.78, y: 0.86,
    text: "Aye · No · Absent" },                                   // 16 ch → floor 1.8s; hold 2.8s ✓
];
```

Note on label vocabulary: write the word **for the viewer**, not for the data key — the shipped S3 label
reads **"Aye · No · Absent"** even though `accents.ts` `VOTE_FILL` keys the unresolved fill as `Unknown`.
The caption text is what the viewer reads; this divergence is intentional and per-chapter label wording is a
human taste call.

### Corrected `rules/timing-and-legibility.md` — per-style type spec

| Style | Font | Size | Weight | Colour | Placement |
|-------|------|------|--------|--------|-----------|
| **title** | serif — `Georgia, 'Times New Roman', serif` | 92px | 700 | TEXT `#e8eaf0` | centred, mid-frame |
| **kicker** | mono — `ui-monospace, 'SF Mono', Menlo` | 22px, +3 letter-spacing, uppercase | 400 | chapter **accent** | centred, below centre, with a 26px accent rule |
| **subtitle** | `'Inter', system-ui, sans-serif` | **36px** | (default) line-height 1.32 | TEXT `#e8eaf0` | bottom-centre, on scrim |
| **label** | `'Inter', system-ui, sans-serif` | 22px | 600 | BG `#07090f` (dark text on the accent pill) | pill near target `(x, y)` |

- The **label is a filled accent pill** (`background: accent`, `color: BG`, `border-radius: 999`, dark
  drop-shadow) — not a scrim chip with an accent stem. (`Caption.tsx:126-147`.)
- Subtitle **scrim:** `rgba(7,9,15,0.78)` with **`backdrop-filter: blur(8px)`**, `border-radius: 10`,
  padding `18px 28px`, `max-width: 1280`, and a 4px accent **left-tick** down the left edge
  (`Caption.tsx:93-124`).

## Self-evaluation

Run each check against `src/captions/Caption.tsx` (+ the section tracks). A FAIL is drift; correct the skill
to the code, never the reverse.

1. **Dispatcher name & signature.** Claim: the exported component is `<Captions>` (plural) with
   `{ track: CaptionLine[]; sceneEndS?: number }` and **no** `accent` prop. → `Caption.tsx:152`. Test:
   `grep "export const Captions" src/captions/Caption.tsx`; assert no `accent` in the dispatcher props.
   FAIL if the skill names `<Caption>` (singular) or a dispatcher `accent` prop.
2. **Four caption styles.** Claim: `CaptionStyle = "title" | "kicker" | "subtitle" | "label"`. →
   `Caption.tsx:7`. Test: grep the type; confirm `kicker` is present in both the type and the dispatcher
   switch (`Caption.tsx:164`). FAIL if the schema lists only three.
3. **Label coords are fractional 0..1, not pixels.** Claim: `x`/`y` are fractions of frame size. →
   `Caption.tsx:130` (`left: ${(line.x ?? 0.5)*100}%`). Test: grep section tracks for `style: "label"` and
   assert every `x`/`y` is `< 1` (S3:103/108/111, S6:13). FAIL if any worked example uses pixel values
   (e.g. `x: 1500`).
4. **Label is a filled accent pill with dark text.** Claim: `background: accent`, `color: BG`, pill radius.
   → `Caption.tsx:136-142`. Test: read `LabelBlock`. FAIL if the skill describes the label as a scrim chip
   whose accent is only a stem/dot.
5. **`title` is an in-scene beat, not the chapter opener.** Claim: chapter cards are `SectionTitle`;
   track `title` entries are emphasis beats. → `MyGovFinal.tsx:13,40` (SectionTitle per section) vs `title`
   lines in S1/S2/S4/S5/S6/S8 tracks. Test: grep `style: "title"` across sections — every one is an in-scene
   line, none is a chapter card. FAIL if the skill calls `title` "a chapter-open headline".
6. **Title-hang + `sceneEndS` exist and matter.** Claim: a `title`'s fade-out extends by `TITLE_HANG_S=0.4`,
   clamped against the next centred caption (`TITLE_GAP_S=0.25`) and `sceneEndS`. → `Caption.tsx:23-24,38-51`;
   passed in `S4MassAction.tsx:89`, `S8Close.tsx:79`. Test: grep `TITLE_HANG_S` and `sceneEndS`. FAIL if the
   skill is silent on either.
7. **Z-order mechanism is `zIndex:100`.** Claim: the dispatcher sets `zIndex: 100` (not "render last", not
   `pointerEvents:none`). → `Caption.tsx:156`. Test: read the dispatcher's `AbsoluteFill` style; confirm
   `zIndex: 100` and that `pointerEvents` is absent. FAIL if the skill makes pointer-events the load-bearing
   mechanism.
8. **Title font is Georgia (system serif), not a webfont.** Claim: `fontFamily: "Georgia, 'Times New
   Roman', serif"`, `fontSize: 92`, `700`. → `Caption.tsx:59-62`. Test: read `TitleBlock`. FAIL if the spec
   says Fraunces/Playfair without a matching `@remotion/google-fonts` load in code.
9. **Subtitle spec.** Claim: Inter 36px, scrim `rgba(7,9,15,0.78)` **+ blur(8px)**, 4px accent left-tick,
   bottom-centre, max-width 1280. → `Caption.tsx:93-124`. Test: read `SubtitleBlock`. FAIL on any mismatch
   (esp. a missing `backdrop-filter`).
10. **Reading-pace floor.** Claim: `hold ≥ max(1.8, chars × 0.07)`. → enforced in author comments
    (S4:64,66 annotate "floor 4.48s"/"floor 4.76s"). Test: pick three subtitle lines, compute the floor,
    confirm `out_s − in_s ≥ floor`. FAIL if any worked example violates it.
11. **Fade model & ease.** Claim: `FADE = 6`, envelope `[inF, inF+6, outF-6, outF] → [0,1,1,0]`, clamped,
    `EASE = bezier(0.16,1,0.3,1)`. → `Caption.tsx:5,26-35`. Test: read `lineOpacity` + `EASE`. FAIL on any
    divergence.
12. **Palette & accents.** Claim: BG `#07090f`, TEXT `#e8eaf0`, MUTED `#475569`, ACCENT `#7dd3fc`; eight
    chapter accents. → `tokens.ts:1-8`, `accents.ts:4-14`. Test: byte-compare. FAIL on any hex mismatch.

## Changelog (append-only — newest first)

- v3 (2026-06-05): **Documented the `video-checks.cjs` dynamic-caption blind spot** (candidate from the
  AI TOP 5 ed.001 build, cc; code-verified). The checker's `TEXT_RE` matches only literal quoted `text:
  "..."`, so data-driven captions (`text: story.cue`) compute as empty → floor `max(1.8,0)=1.8s` → always
  pass. Added a caveat to Phase 4 QA: a green run does NOT clear dynamic captions; verify floors by hand
  against the longest possible runtime value of each dynamic field. No spec change — clarifies a real
  limitation of the automated gate.
- v2 (2026-06-01): Re-synced the contract layer to `src/captions/Caption.tsx` (SECTIONS cut). **Convention-mismatch:** label `x`/`y` corrected from pixels to **fractional 0..1** (`Caption.tsx:130`; render-breaking — old `x:1500` put the pill at 150000%); title font corrected to **Georgia/system-serif** (`Caption.tsx:59`); label corrected to a **filled accent pill** with dark text, not a scrim stem (`Caption.tsx:136-142`); stale vote word `Unknown`→`Absent` in the worked example (S3:108) while keeping the "write for the viewer" principle. **Never-built:** dispatcher renamed `<Caption>`→`<Captions>` (plural, no `accent` prop, `Caption.tsx:152`); per-style renderers documented as internal blocks; removed the non-existent TitleCard `kicker` prop. **Architecture-miss:** added the **`kicker`** style (`Caption.tsx:7`, used in S6/S7); documented the **`sceneEndS` + title-hang** machinery (`Caption.tsx:23-51`, passed in S4/S8); documented the **single global track** pattern for fast cuts (`RapidFlow.tsx:32`); added `backdrop-filter: blur(8px)` to the scrim spec (`Caption.tsx:104`). **Framing-stale:** `title` reframed from "chapter-open headline" to an **in-scene emphasis beat**, with chapter opening pointed at the separate `SectionTitle` component (`MyGovFinal.tsx:13,40`). **Z-order:** corrected the mechanism to `zIndex:100` (`Caption.tsx:156`), dropped `pointerEvents:none` as load-bearing (moot for render). Added a 12-check `## Self-evaluation` rubric. Spine kept intact: palette, 8 accents, reading-pace floor, fade model, EASE bezier, subtitle spec, 1920×1080@30, phase structure, silent-test thesis (all verified accurate).
