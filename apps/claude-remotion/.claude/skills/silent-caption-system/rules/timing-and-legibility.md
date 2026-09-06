# Timing & Legibility

The numbers that make a silent film readable. Because the MyGov film has no audio, a caption that is too
fast, too small, or too low-contrast is a line of narration the viewer simply never receives. These specs
are the floor — meet or beat them.

## Reading-pace formula (the floor)

A caption must stay on screen long enough to read calmly:

```
hold_seconds = out_s − in_s
hold_seconds ≥ max(1.8, chars × 0.07)
```

- `chars` = every visible character of the caption's `text` (count both lines of a two-line Subtitle;
  ignore the `\n` itself).
- `1.8s` is the absolute minimum even for a two-word caption — anything shorter reads as a flash.
- `0.07s per character` ≈ a relaxed reading speed for on-screen text; it scales the hold with length so a
  long line gets the time it needs.
- The hold is the **full visible window**, fades included — the ~6-frame fade-in and ~6-frame fade-out
  happen *inside* `[in_s, out_s]`, they do not extend it.

Worked: `"One click. The whole country answers."` is 37 chars → `max(1.8, 37 × 0.07) = max(1.8, 2.59) =
2.59s`. So `out_s − in_s` must be **≥ 2.59s**. (In the worked track it holds 3.2s.)

## Fades

- **Fade in:** `interpolate(frame, [inF, inF + 6], [0, 1], { easing: EASE_OUT, extrapolateLeft: "clamp",
  extrapolateRight: "clamp" })`, where `inF = in_s × 30`.
- **Fade out:** mirror over the last 6 frames before `outF = out_s × 30`.
- **6 frames ≈ 0.2s** at 30 fps. Never instant (a pop is jarring); never long (a slow crossfade steals
  reading time). TitleCards may add a small `translateY` rise on the same window; Subtitles fade only.
- **No CSS transitions or animations.** All of this is `useCurrentFrame()` + `interpolate()`.

## Word & line limits

- **≤ ~9 words on screen at once**, across all active captions of a band.
- **Subtitle:** 1 line preferred, 2 lines maximum (`\n`). Two lines still count toward the 9-word limit.
- If an idea needs more than 9 words, **split it into consecutive captions** (each with its own hold that
  passes the formula) rather than cramming or speeding up.
- **Label:** 1 short line, ≤ 4 words ("switch to Gender", "copy this", "click once").

## Per-style type spec

| Style | Font | Size | Weight | Colour | Placement |
|-------|------|------|--------|--------|-----------|
| **TitleCard** headline | serif — Fraunces / Playfair | ~96–120px | 600–700 | TEXT `#e8eaf0` | centred, mid-frame |
| **TitleCard** kicker | mono | ~22–26px, +2px letter-spacing, uppercase | 500 | chapter **accent** | above the headline |
| **Subtitle** | Inter | **~36px** | 500–600 | TEXT `#e8eaf0` | bottom-centre, on scrim |
| **Label** | Inter / system sans | ~22–26px | 600 | TEXT `#e8eaf0` | chip near target `(x, y)` |

- Line height ~1.25 for multi-line Subtitles. Keep Subtitle line length under ~38 characters so it never
  runs the full width.
- The **chapter accent** colours the TitleCard kicker and the Subtitle's left-tick — and nothing else of the
  body text, so the words stay maximally legible.

## Scrim & contrast

- **Subtitle scrim:** a panel behind the text filled `rgba(7,9,15,0.78)` (the BG `#07090f` at 78% alpha),
  ~14px corner radius, padded ~18px×28px so no glyph touches the edge. The scrim guarantees `#e8eaf0` text
  stays readable over bright or busy footage.
- **Accent left-tick:** a ~4px-wide bar in the chapter accent down the scrim's left edge — a quiet chapter
  marker, not a highlight on the words.
- **Label chip:** same scrim fill at a smaller radius; the accent appears only as the chip's small stem /
  dot pointing at the target.
- **TitleCard:** no full scrim needed (it owns the centre over a calmer moment), but if the footage behind
  is bright, add a soft radial darken behind the headline rather than a hard box.
- Target contrast: TEXT on scrim should read clearly at 1080p from across a room — if in doubt, raise the
  scrim alpha, never lower the text colour.

## Safe-area margins

- **Side / top / bottom safe margin: 120px.** No caption text, chip, or scrim edge crosses it.
- **Subtitle safe band:** `y ≈ 880–1010` (the scrim sits in this band, text centred within it).
- **Clear the product's lower-third.** Product footage frequently has its own UI along the bottom. If the
  footage's controls sit below ~`y=860`, the subtitle band conflicts — **raise the subtitle** (or widen the
  scrim upward) so the caption never overlaps the footage UI. Captions on top must not hide the very thing
  they describe.

## The silent test

The single check that defines this skill. Mute everything — there is no audio anyway — and watch the scene,
or read its track top to bottom alongside the footage:

> **Can a viewer who hears nothing follow the entire story from the captions alone?**

- If a beat only makes sense with imagined narration, that narration is **missing** — add the caption.
- If a caption flashes before it can be read, it is **not received** — extend the hold to its floor.
- If two captions fight for the same band, one is **lost** — re-time or re-place them.

A scene passes only when the caption track, by itself, is the complete narration of that scene. The whole
film passes only when every scene does — that is the bar for a silent film whose audio may never arrive.
