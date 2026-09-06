---
name: message-triggered-animation
description: In a silent caption-driven Remotion video, bind a chosen IMPORTANT caption's drop frame to fire both a small TriggerPulse flash on/near the caption AND the start of a target animation (code stream, panel reveal, electric arc) at the SAME frame — so the on-screen text visibly CAUSES the action. One shared local-frame constant per key message drives the caption's in_s, the pulse `at`, and the target's startFrame together, so they cannot drift apart. Includes the seconds↔frames bridge to the silent-caption track and the local-clock (per-beat <Sequence>) timing model that keeps them locked.
metadata:
  tags: triggers, causality, captions, silent, remotion, frame-based, streaming-code, pulse, mygov, build-story
---

## When to use

Use this skill when a **silent, caption-driven** MyGov scene needs a caption to *cause* something — a
key message drops and, at that exact moment, a code stream begins, a panel reveals, or an electric arc
fires. The viewer reads the line and sees it trigger the action, so narration and motion read as cause
and effect rather than two coincident things.

It sits **on top of** the `silent-caption-system` skill: that skill renders the narration track; this
skill picks the **few** captions that name an on-screen build action and wires each to (a) a small
`TriggerPulse` flash on/beside the caption and (b) the start frame of a target animation — both driven
from **one shared frame constant** so they cannot drift apart. The shipping example is the hero build
scene `S7BuildStory.tsx` (three beats), where pulses fire as "Built the globe with GPT-5.5 Pro." and
"Codex hands off — Claude Code, rapid implementation." land.

It is **not** a captioning skill (write the track with `silent-caption-system`) and **not** a renderer
of the target (a stream is `StreamingCode`, a window is `WindowChrome`). It is the wiring that makes one
fire the other on the same frame.

---

## Domain facts (fixed)

- **1920×1080 @ 30 fps.** Convert frames↔seconds at 30: `seconds = frames / 30`.
- **Frame-based motion only.** Everything derives from `useCurrentFrame()` + `interpolate()` +
  `<Sequence>`. **No CSS `transition` / `animation` / Tailwind `animate-*`** — they do not render in
  Remotion. Static CSS (gradients, `box-shadow`, `filter: blur()`, transforms computed from the frame)
  is fine.
- **Standard ease:** `Easing.bezier(0.16, 1, 0.3, 1)`, clamped both ends (the house "ease-out"; in
  `MessageTrigger.tsx` it is the local `BEZIER_OUT`).
- **Caption track speaks seconds; triggers speak frames.** The `silent-caption-system` track is a
  `CaptionLine` — `{ in_s, out_s, text, style }` plus optional `accent?`, `x?`, `y?` — in **seconds**.
  `style` is one of `"title" | "kicker" | "subtitle" | "label"`. A trigger is a plain **frame number**
  (`const X_TRIGGER = Math.round(s * FPS)`). The trigger frame is the authority (see Phase 1, the bridge).
- **Trigger accent = the tool/target it points at, NOT one chapter colour.** The build story deliberately
  uses three accents in the same scene: GPT teal `#10a37f`, Claude amber `#d6a560`, and Codex/electric
  blue `#38bdf8` (`ACCENTS.map`). Each pulse takes the colour of the thing it fires (see Hard Rule 6).
  Do **not** assume one accent per scene.
- **Runtime:** the wiring lives in `mygov-campaign-video/src/sections/build/MessageTrigger.tsx`. It
  exports:
  - `TriggerPulse: React.FC<{ at: number; x: number; y: number; accent?: string }>` — a ~16-frame
    electric flash at fractional `(x, y)` of the 1920×1080 canvas, firing when the playhead crosses
    frame `at`. **`x`/`y` are fractions 0..1** (the component renders `left: ${x*100}%`), not pixels.
  - `useTrigger(at: number, durationFrames = 30): number` — a 0..1 eased ramp from frame `at` (0 before
    `at`, 1 after). Use it to drive a **panel-reveal** target's opacity/translate.
  - `Triggered: React.FC<{ at; durationFrames?; children: (p: number) => ReactNode }>` — render-prop
    wrapper over `useTrigger`. (Currently exported but unused in `src`; it is the intended panel-reveal
    path — see Phase 2.3.)
  The target stream is `StreamingCode` from the same folder, props
  `{ code, startFrame?, cps?, fontSize?, color?, showCaret?, lineHeight? }`.

---

## Phase 0 — Pick only the key messages

Triggering is a spotlight; spend it on the few lines that name an action the viewer then watches happen.

1. List the scene's captions (the `silent-caption-system` track). For each ask: **does this line name an
   on-screen build action that starts right now?** ("Built the globe with GPT-5.5 Pro." → the GPT chat
   panel begins streaming: YES. "One person, three tools — building together." → narration, nothing
   starts: NO.)
2. Keep only the YES lines as triggers — typically **1–3 per beat**. Everything else stays plain
   silent-caption narration with no pulse. Over-trigger and the flash is meaningless; under-trigger and
   the causality still reads. (Beat A of `S7BuildStory` fires three; Beat B fires two.)
3. For each kept line, name a stable trigger constant (`A_TITLE_TRIGGER`, `A_CLAUDE_TRIGGER`,
   `B_CTRL_TRIGGER`) and the single target it fires (one stream, one reveal, one arc). One trigger → one
   target stays legible.

---

## Phase 1 — One shared frame constant (the bridge + the single source of truth)

For each key message, author **one** local frame constant in the scene file. The caption's `in_s`, the
`TriggerPulse` `at`, and the target's `startFrame` all read **that same constant** — so the three cannot
desync.

1. Declare the trigger frames once, frames as the authority:
   ```tsx
   // scene file — the single source of truth, LOCAL to this beat's <Sequence>
   const FPS = 30;
   const A_TITLE_TRIGGER  = Math.round(0.8 * FPS); // 24  — title fires the GPT stream
   const A_CLAUDE_TRIGGER = Math.round(6.5 * FPS); // 195 — fires the Claude terminal
   ```
   (Pattern from `S7BuildStory.tsx` lines 58–61.)
2. **The seconds↔frames bridge — the non-obvious bit.** The caption track is in seconds; the trigger is
   a frame. Make the **trigger frame `T` canonical** and author the key caption so it drops on the same
   frame: set its `in_s = T / FPS`. (For `T = 24` at 30 fps, `in_s = 0.8`.) Now the caption drop, the
   pulse, and the target start all resolve to the **same frame `T`** — no rounding drift, one number to
   change. (Real: `in_s: A_TITLE_TRIGGER / FPS`, `S7BuildStory.tsx` line 71.)
3. **Local-clock contract (correctness trap).** Each beat lives in its own `<Sequence from={beatStart}>`
   (`S7BuildStory.tsx` lines 283–305). Inside a `<Sequence>`, frame 0 = the beat's start, so **every
   trigger constant is local 0-based**, and `in_s = T / FPS` is **relative to the beat**, not the master
   timeline. Author all triggers, caption times, and `startFrame`s in the beat's local clock; let the
   parent `<Sequence from=...>` place the beat.
4. **Three consumers, one constant.** The caption layer renders a `TriggerPulse at={T}`; the target uses
   `startFrame={T}` (or `at={T}` via `useTrigger`). Editing `T` once moves caption, pulse, and target
   together.

---

## Phase 2 — Fire the pulse and the target on the same frame

The whole point is simultaneity: at frame `T` the caption is fully in, the pulse fires, and the target
begins. Use this timing model (state it; do not hand-wave a "lead").

1. **`T` = caption drop = pulse fire = target start (default).** Author the caption's `in_s = T / FPS` so
   its ~6-frame fade-in begins at `T`. The pulse blooms across its own ~16-frame envelope starting at `T`
   (it owns the curve — see 2.2). The target defaults to **`startFrame={T}`** — same frame
   (`<GptChatPanel startFrame={A_TITLE_TRIGGER} />`, `S7BuildStory.tsx` line 122). The eye reads the
   caption + flash + start as one event.
2. **The pulse owns its envelope — you only pass `at`.** `TriggerPulse` is fully frame-derived: it
   renders only while `0 <= frame - at <= 16` and blooms a dot + ring + sparks that peak just after `at`
   (dot opacity `interpolate(t,[0,0.12,0.55,1],[0,1,0.85,0])`, dot scale peaking at `t≈0.18`, where
   `t = (frame-at)/16`). You do **not** author a `[T-3, T, T+10]` curve — you pass `at={T}` and the
   component does the rest (`MessageTrigger.tsx` lines 69–146).
3. **A panel-reveal target uses `useTrigger`/`Triggered`** (the 0..1 ramp), not a hand-written
   interpolate: `<Triggered at={T}>{(p) => <Panel style={{ opacity: p, transform: \`translateY(${(1-p)*20}px)\` }} />}</Triggered>`.
   A code-stream target uses `<StreamingCode startFrame={T} .../>`; an arc uses `T` as its first-strike
   frame.
4. **Offset only when the target needs its container first.** Default is `+0` (same frame). Add a small
   `+N` (the shipping value is **`+6`**) **only** when the target must let its window chrome appear before
   text streams inside it: `<WindowChrome ...><StreamingCode startFrame={B_CTRL_TRIGGER + 6} ... /></WindowChrome>`
   (`S7BuildStory.tsx` line 192). Apply the offset at the consumer, not in the shared constant. There is
   no universal lead — it is `+0` for a bare target, `+6` when it lives inside a chrome that must arrive
   first.
5. **Position the pulse on or beside the caption / target**, not floating: `x, y` (fractions 0..1) sit
   near the caption or the target's edge so the flash visibly connects the words to the thing that starts.

---

## Worked example — "Built the globe with GPT-5.5 Pro." fires a GPT chat panel (Beat A)

A GPT-5.5 chat panel is on screen (left of a DiagonalSplit). The title caption "Built the globe with
GPT-5.5 Pro." drops at local frame `24`; on the same frame a teal pulse flashes by it and the panel
begins streaming. (This is the real Beat A wiring of `S7BuildStory.tsx`.)

```tsx
import { AbsoluteFill, Sequence } from "remotion";
import { Captions, CaptionLine } from "../../captions/Caption";
import { TriggerPulse } from "./MessageTrigger";
import { GptChatPanel } from "./GptChatPanel";

const FPS = 30;
const GPT_TEAL = "#10a37f"; // the GPT panel's tool colour — the pulse matches it

// 1 — the single source of truth (one LOCAL frame, three consumers)
const A_TITLE_TRIGGER = Math.round(0.8 * FPS); // 24

// 2 — caption track (silent-caption-system) — bridged to the SAME frame.
//   in_s = 24 / 30 = 0.8  → drops exactly on T.  A "title" line carries NO accent
//   (titles render centred, no tick); subtitle/kicker lines carry accent.
const CAPTIONS: CaptionLine[] = [
  { in_s: A_TITLE_TRIGGER / FPS, out_s: 4.4, text: "Built the globe with GPT-5.5 Pro.", style: "title" },
];

const BeatA: React.FC = () => (
  <AbsoluteFill>
    {/* TARGET — starts on the SAME frame as the trigger (no lead) */}
    <div style={{ position: "absolute", left: 96, top: 150 }}>
      <GptChatPanel startFrame={A_TITLE_TRIGGER} />
    </div>

    {/* PULSE — same constant; fractional (x,y); accent = the GPT panel it points at */}
    <TriggerPulse at={A_TITLE_TRIGGER} x={0.27} y={0.32} accent={GPT_TEAL} />

    <Captions track={CAPTIONS} />
  </AbsoluteFill>
);

// The beat is placed by its own <Sequence>; A_TITLE_TRIGGER is LOCAL to it.
export const Scene: React.FC = () => (
  <Sequence from={0} durationInFrames={16 * FPS} name="BeatA">
    <BeatA />
  </Sequence>
);
```

The caption, the pulse, and the panel all key off `A_TITLE_TRIGGER`. Change `24` once and all three move
together; the caption reads as *causing* the stream because the flash fires on the same frame.

---

## Hard rules (never violate)

1. **Only key messages trigger.** A caption becomes a trigger **only** if it names an on-screen action
   that starts at that moment — typically 1–3 per beat. Everything else is plain silent-caption
   narration with no pulse. Over-triggering kills the effect.
2. **One shared frame constant; three consumers read it.** Declare `const X_TRIGGER = Math.round(s * FPS)`
   once. The caption (`in_s = X_TRIGGER / FPS`), the pulse (`at={X_TRIGGER}`), and the target
   (`startFrame={X_TRIGGER}` or `at={X_TRIGGER}`) all read the same constant; none hard-codes a separate
   frame — that is why they cannot desync. (There is no `TriggerEvent`/`TRIGGERS[]` id-keyed list in the
   code; a shared `const` is the pattern.)
3. **The trigger frame is canonical; bridge the caption to it; clocks are LOCAL.** Triggers are frames;
   the caption track is seconds. Author `in_s = X_TRIGGER / FPS`. Every constant is **local 0-based**
   within the beat's `<Sequence from=...>`. Never let the two systems carry independent timing for the
   same beat.
4. **Same-frame model by default; `+6` only to let a container arrive first.** `T` = caption drop = pulse
   fire = target start. Default `startFrame={T}`. Add `+6` **only** when the target streams inside a
   `WindowChrome` that must appear first. Apply any offset at the consumer, not in the shared constant.
   There is no universal `+3`.
5. **Frame-based only; the pulse owns its curve.** Pass `at={T}` to `TriggerPulse` — it renders its own
   ~16-frame dot/ring/spark envelope; do not author a `[T-3, T, T+10]` interpolate yourself. Targets are
   a `startFrame`/`useTrigger` from `T`. **No CSS `transition` / `animation` / Tailwind `animate-*`** —
   they will not render.
6. **Accent = the tool/target the pulse points at — accents are deliberately MIXED within a beat.** The
   pulse's `accent` is the colour of the thing it fires: GPT teal `#10a37f`, Claude amber `#d6a560`,
   Codex/electric blue `#38bdf8`. A subtitle/kicker caption for the same beat carries the **same** value
   in its `accent` field (e.g. the Claude caption uses `accent: CLAUDE_AMBER`); **title** lines carry no
   accent (they render centred without a tick). Beat A fires three different accents on purpose
   (`S7BuildStory.tsx` lines 145–147). Do **not** force one accent across a scene.
7. **Pulse sits on the caption / target, target where the action happens.** Place `x, y` as **fractions
   0..1** of the 1920×1080 canvas, on/beside the caption or the target's edge so the flash visibly links
   the words to what starts. A pulse floating in empty space — or fed pixel coordinates (which become
   `left: 12800%`, off-screen) — does not read as a cause.

---

## Self-evaluation (regression test — run these against the code before trusting the skill)

Each check is `claim → code location that confirms it → how to test`. A FAIL means the skill has drifted.

1. **`TriggerPulse` prop is `at`, not `frame`** → `MessageTrigger.tsx` line 74 (`{ at, x, y, accent }`).
   Test: grep the worked example for `<TriggerPulse`; every call must pass `at=`, never `frame=`.
2. **`x`/`y` are fractions 0..1, not pixels** → `MessageTrigger.tsx` lines 152–153 (`left: ${x*100}%`).
   Test: every `x`/`y` in the skill is `<= 1`; the skill never labels them "(px)". A value like `1280`
   would render off-screen.
3. **No `TriggerEvent` type / `TRIGGERS[]` / `useTrigger(id)` lookup** → grep `src` for `TriggerEvent` and
   `TRIGGERS` returns nothing; `useTrigger` takes a **frame** `at`, not an id (`MessageTrigger.tsx`
   line 37). Test: the skill's "single source of truth" must be a shared `const` frame, not an id-keyed
   event object.
4. **Target offset is `+0` (default) or `+6` (inside chrome), never a universal `+3`** → `S7BuildStory.tsx`
   line 122 (`startFrame={A_TITLE_TRIGGER}`, +0) and line 192 (`startFrame={B_CTRL_TRIGGER + 6}`). Test:
   grep the skill for `+ 3`/`T + 3`; it must not be presented as the rule.
5. **The pulse owns a ~16-frame envelope you don't author** → `MessageTrigger.tsx` line 28
   (`PULSE_FRAMES = 16`) and lines 79, 87–92 (peaks just after `at`). Test: the skill must not tell the
   author to write `interpolate(frame, [T-3, T, T+10], …)` for the pulse.
6. **Accents are mixed per-tool within a beat (no one-accent-per-scene rule)** → `S7BuildStory.tsx` lines
   145–147 fire GPT_TEAL, CLAUDE_AMBER, CODEX_BLUE in one beat. Test: the skill must not contain a "do not
   mix accents within a beat" rule; its accent rule must say "match the target's tool colour."
7. **Caption accent lives on subtitle/kicker lines, not title lines** → `S7BuildStory.tsx` lines 73–75
   (title, no `accent`) vs lines 84–89 (subtitle, `accent: CLAUDE_AMBER`); `CaptionLine.accent` is
   optional (`Caption.tsx` line 14). Test: the skill must not claim every caption carries the accent.
8. **Trigger constants are LOCAL to the beat's `<Sequence>`** → `S7BuildStory.tsx` lines 283–305 (three
   `<Sequence from=...>`), constants declared per-beat (lines 58–61, 158–159). Test: the skill must state
   `in_s = T / FPS` is beat-relative, not master-timeline.
9. **`CaptionLine` schema is `{ in_s, out_s, text, style, accent?, x?, y? }` with
   `style ∈ title|kicker|subtitle|label`** → `Caption.tsx` lines 7–17. Test: the skill must not claim
   `style` is only `"subtitle"` or omit `kicker`/`label`.
10. **The mechanic still ships** → `MyGovFinal.tsx` line 31 + `VIDEO_RECORD.md` item 16 (S7BuildStory,
    global 4097–5357). Test: if `S7BuildStory` is removed from `SECTIONS` and `TriggerPulse` has zero
    consumers, re-evaluate prune (Phase 5).
11. **`useTrigger`/`Triggered` are the panel-reveal path, currently with zero call sites** →
    `MessageTrigger.tsx` lines 37, 51; grep `src` finds no consumer. Test: if the skill documents a panel
    reveal, it must point at `useTrigger`/`Triggered`, and flag them as exported-but-unused (not invent a
    bespoke interpolate).

---

## Changelog (append-only — newest first)

- **v2 (2026-06-01):** Rewrote to match the shipped contract in `MessageTrigger.tsx` + `S7BuildStory.tsx`
  (the only consumer of `TriggerPulse`). Fixes: **never-built** — removed the fictional `TriggerEvent`
  type, `TRIGGERS[]` id-keyed list, `useTrigger(id)` lookup, `<TriggerPulse frame=...>` prop, and the
  universal `+3` target lead (real prop is `at`; real source-of-truth is a shared local `const`; real
  offsets are `+0`/`+6`; `MessageTrigger.tsx` 37/69–74, `S7BuildStory.tsx` 58–61/122/192).
  **convention-mismatch** — changed all `x,y` from pixels to fractions 0..1 (`left: ${x*100}%`,
  `MessageTrigger.tsx` 152–153). **inverted** — replaced Hard Rule 6 "do not mix accents within a beat"
  with "accent = the tool the pulse points at; accents are mixed by design" (`S7BuildStory.tsx` 145–147).
  **never-built** — corrected the pulse-curve claim: `TriggerPulse` owns its own 16-frame envelope; the
  author passes only `at` (`MessageTrigger.tsx` 28/79–92). **architecture-miss** — added the local-clock
  contract (constants are local to each beat's `<Sequence from=...>`, `S7BuildStory.tsx` 283–305) and the
  `useTrigger`/`Triggered` panel-reveal path. **convention-mismatch** — corrected the `CaptionLine`
  schema (`title|kicker|subtitle|label`, optional `accent`/`x`/`y`, `Caption.tsx` 7–17). **framing-stale**
  — the Claude-Code stream is in **Beat A**, not "beat B"; the build accent is per-tool, not one
  `#38bdf8`. Added the `## Self-evaluation` regression rubric that would have caught all of the above.
- v1: Created. Described an id-keyed `TriggerEvent`/`TRIGGERS` design that was never built; documented a
  `frame=` prop and pixel coordinates that do not match `MessageTrigger.tsx`.
