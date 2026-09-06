---
name: terminal-recreation
description: Recreate real developer tool terminal/app interfaces as high-fidelity Remotion components — frame-based, animated, composable. Covers Claude Code CLI, Codex app, GPT chat, and a pattern for extending to any tool.
metadata:
  tags: remotion, terminal, claude-code, codex, gpt, ui-recreation, frame-based, video-production
---

## When to use

Use this skill when a video needs a real developer tool interface — a Claude Code terminal session streaming output, a Codex app chat thread, a GPT conversation — that must look **genuinely like the real tool**, not a generic terminal. Each component is frame-based (no CSS animation), composable, and driven by real-looking content so it reads as authentic product footage.

The broader pattern: for any tool you want to recreate, the steps are the same — study the visual language, encode it as constants, build a chrome (window frame) and a content layer (streaming code / chat bubbles / etc.), drive both from `useCurrentFrame`.

> **Ground truth:** these components live in `mygov-campaign-video/src/sections/build/`. When this skill and the code disagree, the code wins. The canonical files are named in "The real components" below — jump to them rather than re-deriving from prose.

---

## Domain facts (fixed)

- Composition is `1920×1080 @ 30 fps` (`MyGovFinal`). Time is in **frames**; 1s = 30 frames.
- Frame-based motion ONLY: `useCurrentFrame()` + `interpolate()` + `<Sequence>`. NO CSS `transition`/`animation`. Static CSS (gradients, borders, `boxShadow`, transforms computed per-frame) is fine.
- `EASE = Easing.bezier(0.16, 1, 0.3, 1)` is the house easing for every terminal/chrome component (entrances, glow, opacity ramps). (A `SPRING = bezier(0.34,1.56,0.64,1)` exists in the build folder but is used only by non-terminal cards like `SpawnJoke.tsx` — do not reach for it here.)
- These components live in the project's `src/sections/build/` alongside `WindowChrome`, `StreamingCode`, `BrandLogos`.
- `WindowChrome` (same folder) is the **one shared** outer window frame for every variant (`"claude"` | `"codex"` | `"gpt"` | `"terminal"`). It is **purely presentational** — it does NOT read the frame. The caller passes `appear` and `glow` as **0..1 props**. Use it so all windows share one entrance/glow system and one cohesive body palette.
- `StreamingCode` (same folder) reads `useCurrentFrame()` itself and streams text char-by-char from a `startFrame` at `cps` chars/sec. It is **flat single-colour** (`white-space: pre` + raw string slice) — there is no syntax highlighting. Reuse it rather than reimplementing char-reveal.

---

## The real components (jump here first)

| Component | File | Role |
|---|---|---|
| `WindowChrome` | `src/sections/build/WindowChrome.tsx` | the shared window frame; `variant` + `accent` + `appear`/`glow` (0..1) props |
| `StreamingCode` | `src/sections/build/StreamingCode.tsx` | frame-based char reveal; flat single colour |
| `ClaudeCodePanel` | `src/sections/build/ClaudeCodePanel.tsx` | **the HERO Claude terminal** (S7 beats A/B): amber, Braille spinner |
| `ClaudeCodeWindow` | `src/sections/build/ClaudeCodeWindow.tsx` | the small collage Claude window (CodexNexus / CodexSpawnScene): purple, elapsed-seconds spinner |
| `GptChatPanel` | `src/sections/build/GptChatPanel.tsx` | the GPT-5.5 Pro chat panel (S7 beat A left) |
| `CodexNexus` | `src/sections/build/CodexNexus.tsx` | the S7 finale collage that composes the windows |
| `CodexSpawnScene` | `src/sections/build/CodexSpawnScene.tsx` | chapter-07 spawn scene; also composes these windows |

> Note: a full-IDE Codex recreation, `CodexAppWindow` (sidebar + chat + editor + terminal + status bar; GitHub palette `#0d1117`/`#161b22`/`#30363d`), exists **outside** the `WindowChrome` family — it is registered as the standalone `CodexPreview` composition in `Root.tsx`, **not** in the shipping `MyGovFinal` cut. Treat it as a separate one-off, not a primitive of this skill.

---

## The tool visual languages

**Important:** the code did NOT pixel-match each tool's real background. It standardised on **one shared `WindowChrome` body** (a cohesive navy: `#0d1424`, gpt `#0b1020`) plus a **single accent per variant**. The values below are the *actual* `WindowChrome.VARIANTS` defaults and the built panels — honour the **accent + distinctive chrome elements**, not a per-tool background hex.

`WindowChrome.VARIANTS` (the source of truth):

| variant | default title | default accent | body bg | header bg |
|---|---|---|---|---|
| `claude` | `claude-code ~/mygov` | amber `#d6a560` | `#0d1424` | `#0a0f18` |
| `codex` | `codex · control` | `#38bdf8` | `#0d1424` | (nav-rail app, no titlebar) |
| `gpt` | `GPT-5.5 Pro` | `#10a37f` | `#0b1020` | `#141b27` |
| `terminal` | (none) | `#64748b` | `#0d1424` | `#0a0f18` (mac traffic lights) |

### Claude Code CLI (`variant="claude"`)
There are **two** Claude terminals — match the one your scene calls for:

- **`ClaudeCodePanel` — the HERO terminal (S7 beats A/B).** This is the house style. Amber accent `#d6a560`; repaints a near-black surface `#070a10` over the navy body; top-right tag `claude-opus` (amber pill, leading glow dot); filled `●` status lines; a streamed install block (reused `StreamingCode`); a line-numbered diff (removed red `#fca5a5`, added green `#4ade80`); an orange `✦` **Braille-glyph** working line `SPINNER[Math.floor(frame/3)%10]` with a hardcoded `Installing… (4m · ↓ {tokens}k tokens)`; a green `✓ GlobeBuild ready` payoff; bottom strip `>> auto mode on (shift+tab to cycle)`.
- **`ClaudeCodeWindow` — the small collage instance (CodexNexus / CodexSpawnScene).** Purple accent `#a78bfa`, `purpleBg #1e1b4b`; top-right tag `● claude-code`; spinner is **elapsed-seconds** `Math.floor((frame−spinStart)/fps)`. Props: `statusLines`, `diffFilename`, `diffLines`, `streamCode`, `cps`, `showSpinner`, `doneText`, `w`, `h`, `startFrame`.

Shared diff spec (both): removed lines left-border red, added lines left-border green, line-numbered gutter, unchanged muted grey.

### Claude Code TUI — CURRENT generation (chromeless) ⚠ prefer this for new work
The mygov-era Claude windows above are WINDOW-framed (titlebar, tag pill, navy body). The **real
current Claude Code TUI has no window chrome at all** — a from-memory generic mac-window fake was
rejected by the owner on sight ("looks very suspect", Splitfire advert 2026-07-18). Ground truth:
> ⚠️ **The reference implementation named below was removed during the pre-release consolidation.**
> The technique is real and is kept here; the file paths are history, not somewhere to look. The surviving statement of this rule is the `DeviceFrame.tsx` doc comment and the `fail-recreated-not-real` entry in the `judge-video` skill.

**`splitfire_advert/ClaudeCodePiP.tsx`** (retired), built from a real screenshot.
Anatomy (all of it, or it reads fake):
- Flat near-black card `#0b0e14`, no titlebar, no traffic lights.
- The user's prompt as a plain `>`-prefixed line.
- Assistant lines led by a coloured bullet `●` (green `#4ec46f` / white), plain prose after.
- Tool calls: `● Update(path/to/file.tsx)` with the path in accent `#79b8ff`, then an indented dim
  result line `⎿ Added N lines, removed M lines` (`#8b96a8`).
- Optional compact diff: numbered gutter, `-` rows on `#3a1518`, `+` rows on `#12351c`.
- Dim meta lines ("Searched for 1 pattern, ran 2 shell commands").
- Fixed footer: thin rule → `> ▌` prompt (blink via `frame % 20 < 10`) → status bar
  `▶▶ auto mode on (shift+tab to cycle)` with the arrows/label in orange `#e5a35a`.
Progressive reveal is frame-derived (`Math.floor(frame / N)` beats). When a scene calls for the
mygov collage look, the windowed components above remain valid — but a scene claiming to show
Claude Code **as it is today** uses the chromeless form.

### Codex app (`variant="codex"`)
A desktop AI app, NOT a terminal. `WindowChrome variant="codex"` renders it directly: left nav rail (~168px, bg `#0a1422`, wordmark "codex" + glyph dot + faux nav rows + a green "Full access" pill at the foot), a main thread body for `children`, and a bottom composer with placeholder `Message codex…` and a model pill **`gpt-5.5-codex`**. Accent **`#38bdf8`** (electric blue). No mac traffic lights (web-app style).

### GPT chat (`variant="gpt"`, built as `GptChatPanel`)
`WindowChrome variant="gpt"` body `#0b1020`, title **"GPT-5.5 Pro"**, accent teal `#10a37f`.
- User bubble: right-aligned, teal-tinted `rgba(16,163,127,0.14)` with a `#10a37f55` border, rounded `14px 14px 4px 14px`.
- Assistant turn: a small **"G" avatar** circle (teal) + the name **"GPT-5.5 Pro"** (NOT "ChatGPT", no OpenAI mark), conversational sans-serif lead-in, then a fenced code block.
- Code block: bg `#080d18`, language tag `tsx` top-left, a faux "Copy" affordance top-right, then `StreamingCode`. The streamed code is **flat single-colour** — `StreamingCode` does not syntax-highlight, so do not promise tinted keywords/strings.

### Generic terminal (`variant="terminal"`)
Mac traffic-light titlebar (`#ff5f57`/`#febc2e`/`#28c840`) + optional muted title. Accent `#64748b`. Used for the social/deploy windows in the collage.

---

## Phase 0 — Study the real interface

Before building, obtain a **screenshot of the CURRENT tool** — a description or your memory of the
tool is NOT a reference. This is now a hard gate: a Claude Code PiP built from memory shipped with
invented macOS chrome and was rejected on sight (Splitfire 2026-07-18); the rebuild from a real
screenshot passed immediately. Tools change generations — a faithful recreation of last year's UI
reads as fake today (see the chromeless-TUI section above vs the mygov-era windows). Document: the
accent colour, the font family, the ONE or TWO most distinctive chrome elements, and which elements
animate (the spinner, the streaming code) vs. which are static chrome. (You do NOT need a per-tool
background hex when using the shared `WindowChrome` body.)

## Phase 1 — Build the chrome layer

Use `WindowChrome` (variant matching the tool) for the outer frame. The chrome owns: the shared body background, corner radius, border (accent-tinted), the titlebar/nav-rail, and the visual entrance/glow. **But it does not own the frame clock** — the *caller* computes `appear` and `glow` as 0..1 values and passes them in (see the clock contract below). Its `children` fill the body with `overflow: hidden`.

For Claude Code's distinctive chrome (in `ClaudeCodePanel`), add the right-side tag pill + the bottom strip as **absolute children inside the body**, so they're always visible regardless of what streams inside.

## Phase 2 — Build the content layer

Stream the session content using `StreamingCode` for code/log output. Drive timing from `startFrame` + a `cps` rate. For a Claude Code session, compose:
1. A pre-stream status block (2–4 `●` lines, each with `opacity` ramping in from a staggered start).
2. A diff block (static DOM, styled per the diff spec above; appears via opacity from a trigger frame).
3. The `✦` working line (frame-driven). In the hero `ClaudeCodePanel` this is a Braille glyph + a hardcoded "Installing… (4m …)"; in the collage `ClaudeCodeWindow` it is an elapsed-seconds counter.
4. `StreamingCode` for the main streaming output (single colour).
5. A completion line (`✓ … ready` in green, appears at the stream's end).

For GPT: a user bubble + an assistant reply (avatar + name + sans-serif lead-in + a fenced `StreamingCode` block). For Codex: stream a control log into the `WindowChrome variant="codex"` body.

## Phase 3 — Drive the animation (the clock contract)

This is the mechanism that makes the components compose. It is a **Hard Rule** (see below).

- `WindowChrome` is **pure** — it never reads the frame. The caller computes `appear = interpolate(localFrame, [0,18], [0,1], {easing: EASE, …})` and a `glow` (0..1) and passes them as props.
- `StreamingCode` **reads `useCurrentFrame()` itself** and interprets its `startFrame` in its local frame context.
- To keep those two clocks consistent, wrap a whole composition in **one** `<Sequence from={startFrame}>` and do ALL child timing in **0-based local frames**. Inside that Sequence, pass `startFrame={0}` (or small local offsets) to the children — do NOT pass the outer `startFrame` again, or you double-count the offset.
- Offset elements within the local clock by constants (status → diff → spinner → stream → done), so the session builds naturally.

The trigger that *binds* a `startFrame` to a moment in the video (a caption landing, a `TriggerPulse`) is owned by the **`message-triggered-animation`** skill — see Cross-links.

## Phase 4 — How the cut composes these (worked examples)

This is already built; use it as the reference pattern, not a TODO.

- **`CodexNexus.tsx` (S7 beat C finale).** A single `<Sequence from={startFrame}>` wraps an inner `Nexus` whose `frame` is 0-based local. Six outer `ClaudeCodeWindow` instances (with real `statusLines`/`diffLines`/`streamCode`, `showSpinner={false}`) hug the edges; a larger central `WindowChrome variant="codex"` streams a `codex · orchestrating` log; an inline SVG `Lightning` primitive arcs from each outer window to the centre (the standalone `ElectricArc.tsx` file is **not** used — it is orphaned).
- **`CodexSpawnScene.tsx` (chapter 07).** A central `WindowChrome variant="codex"` (with `CodexPromptConsole` + `GrowingFileTree`) summons four windows — three `ClaudeCodeWindow`s + one `AgentPartyPanel` — with `SpawnFlash`/`SpawnArc` effects and a `TMUXPanel` strip. Played twice (base speed, then `speedFactor={1.2}`) by `CodexSpawnSequence`.
- **`S7BuildStory.tsx`.** Three beats, each in its OWN `<Sequence from={beatStart}>`: beat A `GptChatPanel` (left) + `ClaudeCodePanel` (right) over a `DiagonalSplit`; beat B `WindowChrome variant="codex"` control tower + a single `ClaudeCodePanel`; beat C `CodexNexus`. Each beat's `startFrame`s are local to its beat Sequence.

---

## Hard rules (never violate)

1. **Frame-based only.** Every animation via `useCurrentFrame()` + `interpolate()`. No CSS animation, no `setTimeout`, no `setInterval`.
2. **Deterministic spinners.** A working spinner must be a pure function of the frame — either elapsed seconds `Math.floor((frame−spinStart)/fps)` (`ClaudeCodeWindow`) or a frame-modulo glyph `SPINNER[Math.floor(frame/3)%n]` (`ClaudeCodePanel`). Both are re-renderable; never use a wall-clock timer.
3. **Reuse `StreamingCode` and `WindowChrome`** rather than reimplementing char-reveal or window chrome. `StreamingCode` is single-colour — if you need syntax tinting you must build a new primitive; do not assume it.
4. **The clock contract.** `WindowChrome` is pure (caller passes `appear`/`glow` as 0..1 props); `StreamingCode` reads the frame. Wrap a composition in ONE `<Sequence from={startFrame}>` and do all child timing in 0-based local frames. Pass `startFrame={0}` to children inside that Sequence to avoid a double offset. (See `CodexNexus.tsx` header + `S7BuildStory` beats.)
5. **Honour the accent + distinctive chrome, via the shared chrome.** The value is authenticity, but the code achieves it with **one shared `WindowChrome` body + a single per-variant accent**, NOT per-tool background hexes. Match `WindowChrome.VARIANTS` (claude amber `#d6a560`, codex `#38bdf8`, gpt `#10a37f` body `#0b1020`, terminal `#64748b`) and the distinctive elements (Claude's `●` lines + bottom strip + tag; Codex's nav rail; GPT's bubble + "G" avatar; terminal's traffic lights). Do not reintroduce per-tool backgrounds.
6. **Human review gate for "does it look like the real tool?"** — a subjective call (see `record-final-video` skill Phase 6). Render a still, show the user, do not self-certify authenticity.

## Cross-links

- **`message-triggered-animation`** — owns the trigger wiring this skill leaves out: one shared local frame drives a caption's `in_s`, a `TriggerPulse at=`, and a panel/stream `startFrame` together (see `S7BuildStory.tsx` `A_CLAUDE_TRIGGER`). Use it for "a message lands → the terminal fires."
- **`silent-caption-system`** — the caption track rides on top of these terminals; every S7 beat carries a `Captions` track. Captions are authored separately from the terminal components.
- **`record-final-video`** — Phase 6 is the look-real review gate referenced in Hard Rule #6.

## Sub-files

- [./rules/claude-code-spec.md](./rules/claude-code-spec.md) — the real `ClaudeCodeWindow.tsx` prop surface + constants (the inline sketch there is historical; the real file is richer).
- [./rules/tool-extension-pattern.md](./rules/tool-extension-pattern.md) — the pattern for adding any new tool (Cursor, VS Code, a web app) to the library.

---

## Self-evaluation

Run these against the code before trusting this skill. Each is `claim → code location → how to test`. (As of 2026-06-01 the pre-correction skill FAILED R1, R3–R11 and was PARTIAL on R2 — that is the drift this rubric exists to catch.)

1. **Claude accent matches the chrome default.** This skill's canonical Claude accent == `WindowChrome.VARIANTS.claude.accent`. → `WindowChrome.tsx` `VARIANTS` (`#d6a560`). Test: grep the variant default; it must equal the accent this skill names (amber), not purple.
2. **Every named component resolves to a file.** Every component this skill names exists in `src/sections/build/`, including the hero `ClaudeCodePanel`. → `ls src/sections/build/`. Test: each name in "The real components" table is a real file.
3. **GPT body bg matches `WindowChrome`.** This skill's GPT body == `WindowChrome` gpt body. → `WindowChrome.tsx` (`#0b1020`) + `GptChatPanel.tsx`. Test: no `#212121` appears as the GPT body in this skill.
4. **GPT identity matches the panel.** Title "GPT-5.5 Pro" + "G" avatar (not "ChatGPT"/OpenAI mark). → `GptChatPanel.tsx`. Test: grep the panel for the title and avatar glyph.
5. **Codex accent + composer pill match.** Accent `#38bdf8`, pill `gpt-5.5-codex`, placeholder `Message codex…`. → `WindowChrome.tsx` codex branch. Test: no `#58a6ff` or `codex-1` survives in this skill.
6. **No un-backed syntax-tinting promise.** This skill must NOT claim `StreamingCode` produces tinted keywords/strings. → `StreamingCode.tsx` (`white-space: pre`, raw `code.slice`). Test: grep this skill for "syntax-tinted"/`#79c0ff`; must be absent or explicitly flagged as a limitation.
7. **Clock contract present + matches code.** A Hard Rule states WindowChrome-pure / StreamingCode-reads-frame / one-Sequence-0-based. → `CodexNexus.tsx` header (lines ~22-37). Test: the rule's wording matches that header.
8. **`appear`/`glow` described as 0..1 caller-owned props.** Not "the chrome owns the entrance." → `WindowChrome.tsx` (props `appear`/`glow`, no `useCurrentFrame`). Test: this skill says the caller passes them in.
9. **Phase 4 is a worked example, not a TODO.** → `CodexNexus.tsx` / `CodexSpawnScene.tsx` already compose the windows. Test: Phase 4 contains no "Replace the current …" instruction.
10. **Spinner mechanics documented for BOTH Claude terminals.** Elapsed-seconds (`ClaudeCodeWindow`) and Braille glyph (`ClaudeCodePanel`). → both files. Test: this skill names both, and Hard Rule on spinners covers both as deterministic.
11. **No dead `SPRING` fact.** SPRING is not listed as a terminal-recreation easing (it's only in `SpawnJoke.tsx`). → grep terminal components for `1.56`: none. Test: this skill's easing fact is `EASE` only.
12. **`ElectricArc` not claimed as a live primitive.** The in-cut arcs are inline `Lightning` (`CodexNexus`) / `SpawnArc` (`SpawnFlash`); `ElectricArc.tsx` is orphaned. → grep imports of `ElectricArc`: none. Test: this skill does not present `ElectricArc` as used.

## Changelog (append-only — newest first)

- v3 (2026-07-18): **Current-generation Claude Code TUI added; screenshot gate hardened** (Splitfire
  advert build). Evidence: a from-memory TerminalPiP (generic mac window, traffic lights, invented
  layout) was rejected by the owner on sight ("looks very suspect"); a rebuild from a real
  screenshot of the live TUI passed immediately. Added the "CURRENT generation (chromeless)" section
  with the full anatomy (flat `#0b0e14`, `●` assistant bullets, `● Update(path)` + `⎿ Added N lines`
  tool-call pairs, red/green numbered diff rows, dim meta lines, `> ▌` prompt with frame-modulo
  blink, `▶▶ auto mode on` status bar) and its in-repo ground truth
  the retired `splitfire_advert/ClaudeCodePiP.tsx`. Phase 0 is a HARD gate: recreate only from
  a screenshot of the current tool — tools change generations, and last year's faithful recreation
  reads as fake today. The mygov-era windowed components remain valid for collage/period scenes.
- v2 (2026-06-01): Corrected against the v10 `MyGovFinal` cut. **Inverted:** Hard Rule #5 reframed from "match each tool's exact bg hex" to "shared `WindowChrome` body + per-variant accent" (code: `WindowChrome.VARIANTS`, `WindowChrome.tsx:38-43,100`). **Convention-mismatch:** Claude accent purple→amber `#d6a560` and documented BOTH Claude terminals (hero `ClaudeCodePanel` amber/Braille vs collage `ClaudeCodeWindow` purple/elapsed); GPT spec corrected (body `#0b1020`, "GPT-5.5 Pro", "G" avatar, fence `#080d18`); Codex accent `#38bdf8`, pill `gpt-5.5-codex`. **Never-built:** removed the "syntax-tinted" GPT claim — `StreamingCode` is flat single-colour (`StreamingCode.tsx:69`). **Architecture-miss:** added the clock contract as Hard Rule #4 (`CodexNexus.tsx:22-37`, `WindowChrome.tsx:4-18`). **Framing-stale:** Phase 4 rewritten as worked examples (`CodexNexus`, `CodexSpawnScene`, `S7BuildStory`), added file-path table, dropped dead `SPRING` fact, added `1920×1080@30`, cross-linked `message-triggered-animation` + `silent-caption-system`. Added this `## Self-evaluation` rubric (it would have caught all of the above). Noted `CodexAppWindow` (full-IDE, outside `WindowChrome`, preview-only) and that `ElectricArc.tsx` is orphaned.
- v1: Created. Specced Claude Code CLI / Codex / GPT recreations + the tool-extension pattern.
