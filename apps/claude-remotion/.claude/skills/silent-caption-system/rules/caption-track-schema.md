# Caption Track Schema

A scene's narration lives in one array: its **caption track**. Each entry is one caption with a start, an
end, its text, and its style. The `<Caption>` component (see `../SKILL.md` Phase 2) reads the track and
renders whichever entries are active at the current frame.

## The entry shape

```ts
type CaptionStyle = "title" | "subtitle" | "label";

interface Caption {
  in_s: number;     // seconds since SCENE start — when the caption appears
  out_s: number;    // seconds since SCENE start — when it disappears
  text: string;     // the visible words; "\n" splits a Subtitle into two lines
  style: CaptionStyle;
  // Label only — where the chip points (px, 1920×1080 frame):
  x?: number;
  y?: number;
  // Optional override; defaults to the SCENE's chapter accent:
  accent?: string;
}

type CaptionTrack = Caption[];
```

Field rules:

- **`in_s` / `out_s` are seconds, and they are relative to the scene's own start — not the film's
  timeline.** A scene that begins 40s into the film still numbers its first caption from `0`. The renderer
  converts to frames at 30 fps (`inF = in_s * 30`); never hand-write frame numbers in a track.
- **`out_s − in_s` must satisfy the reading-pace floor:** `≥ max(1.8, chars × 0.07)`, where `chars` counts
  every visible character of `text` (newline excluded). See
  [./timing-and-legibility.md](./timing-and-legibility.md).
- **`text` holds ≤ ~9 words on screen at once.** For a two-line Subtitle, split with `\n`; the two lines
  together still count as one caption against the word limit.
- **`style`** picks the renderer: `"title"` → TitleCard (centre, serif + mono kicker), `"subtitle"` → the
  bottom narration bar, `"label"` → a pointer chip at `(x, y)`.
- **`accent`** is optional; omit it and the caption inherits the **scene's chapter accent**. A TitleCard
  kicker and the Subtitle left-tick of the same chapter therefore match automatically.
- A TitleCard may carry an optional `kicker` string (the small mono line above the headline); if absent the
  renderer uses the chapter name.

## Worked example — the map-recolour beat (cyan chapter, `#38bdf8`)

The "across the whole country" beat: the UK constituency map resolves into vote colours on one click. The
chapter accent is **cyan `#38bdf8`**, so the TitleCard kicker and the Subtitle left-tick both use it.
Narration intent (Phase 0): *open the beat → state what one click does → name the three vote colours the
viewer is about to see sweep across the map.*

```ts
// Scene: "Map recolour". Chapter accent #38bdf8 (cyan). Times are seconds since scene start.
const mapRecolourTrack: CaptionTrack = [
  { in_s: 0.0, out_s: 2.2, style: "title",
    text: "Click a vote." },                                   // 13 ch → floor 1.8s; hold 2.2s ✓

  { in_s: 2.2, out_s: 5.4, style: "subtitle",
    text: "One click. The whole country answers." },           // 37 ch → 2.59s; hold 3.2s ✓

  { in_s: 2.6, out_s: 5.4, style: "label", x: 1500, y: 300,
    text: "Aye · No · Unknown" },                              // 18 ch → floor 1.8s; hold 2.8s ✓
];
```

Reading-pace check (every entry passes `out_s − in_s ≥ max(1.8, chars × 0.07)`):

| caption | chars | floor = max(1.8, chars×0.07) | hold (out−in) | verdict |
|---------|-------|------------------------------|---------------|---------|
| `"Click a vote."` (title) | 13 | 1.80s | 2.2s | PASS |
| `"One click. The whole country answers."` (subtitle) | 37 | **2.59s** | 3.2s | PASS |
| `"Aye · No · Unknown"` (label) | 18 | 1.80s | 2.8s | PASS |

How it plays: the **TitleCard** "Click a vote." opens the beat centre-screen (0.0–2.2s), then hands off to
the **Subtitle** "One click. The whole country answers." along the bottom (2.2–5.4s). Just after the click
lands, the **Label** "Aye · No · Unknown" appears near the legend (2.6s) to name the three colours sweeping
across the map, and holds until the subtitle clears. The TitleCard (centre) and Subtitle (bottom) do not
share a band; the two captions that run together — Subtitle and Label — live in different regions, so they
never overlap.

Note the example uses the chapter's vote vocabulary as the task prescribes — **"Unknown"** for the
unresolved seats — even where underlying scene-data may key that result differently. The caption text is
what the viewer reads; write it for the viewer.
