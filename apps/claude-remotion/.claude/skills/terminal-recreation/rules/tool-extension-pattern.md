# Tool extension pattern — adding any new tool to the library

The terminal-recreation skill is designed to grow. Each new tool follows the same pattern so the library stays consistent and every component is immediately composable.

## The five-step pattern

### 1. Study the real interface
Take a screenshot or study the tool deeply. Capture:
- Background colour (exact hex — sample it)
- Font family, size, line-height
- The ONE or TWO most distinctive chrome elements (Claude Code: the `●` bullets + bottom strip. Codex: the left nav rail. GPT: the chat bubbles. Cursor: the file-tree + diff viewer)
- Which elements animate vs. which are static chrome
- The accent colour(s)

### 2. Encode the visual language as constants
Create a `const TOOL = { bg, text, accent, font, ... }` block. Every colour, spacing, and font comes from here — never hardcoded in JSX. This is the "spec" that can be updated when the tool's UI changes.

### 3. Build the chrome component
Extend or wrap `WindowChrome` with the tool-specific outer frame:
- Add the distinctive static chrome elements (nav rail, bottom strip, tag, header) as `position: absolute` children
- Keep the `children` prop flowing into the body
- Keep `appear` (entrance) and `glow` props from `WindowChrome`

### 4. Build the content layer
Compose the streaming/animated content from existing primitives:
- `StreamingCode` for code/log output (char-by-char, frame-based)
- Staggered opacity ramps for bullet points / status lines
- Chat bubbles as static DOM that fade in on a trigger frame
- Code blocks as static styled divs (the syntax tinting is CSS, but the APPEARANCE is frame-driven opacity)
- All timing relative to a single `startFrame` prop

### 5. Register in the skill index
Update this skill's `SKILL.md` "The tool visual languages" section with the new tool's spec. Add a worked example in a new `rules/<tool-name>-spec.md`.

## The library so far

| Tool | Status | Key component | Variant |
|------|--------|--------------|---------|
| Claude Code CLI | ✅ specced | `ClaudeCodeWindow` | `"claude"` |
| Codex app | ✅ variant built (WindowChrome) | `WindowChrome variant="codex"` | `"codex"` |
| GPT-5.5 Pro chat | ✅ built | `GptChatPanel` | `"gpt"` |
| Generic terminal | ✅ built | `WindowChrome variant="terminal"` | `"terminal"` |
| Cursor | ⬜ not yet | — | — |
| VS Code | ⬜ not yet | — | — |

## The vision: skill-creator skill
Once the library is large enough, a `skill-creator` skill can take a brief ("recreate the Vercel deploy log screen") and:
1. Ask for a screenshot or describe the visual language
2. Apply this pattern (constants → chrome → content → register)
3. Output a new skill file + a working Remotion component
4. Add it to the index

The library then grows without manual authoring. Each skill is a reusable primitive; a video scene just composes them.

## Lighting + atmosphere skills (next)
The other major skill category is **environmental effects** — the things that make a composition feel premium:
- `LightLeak` — warm/cool light sweep over a dark scene
- `ChromaticAberration` — RGB split on an impact frame
- `FilmGrain` — deterministic noise overlay
- `VignetteLayer` — radial darkening
- `NeonGlow` — per-element SVG glow animation
- `Scanline` — CRT horizontal lines (for the terminal aesthetic)

Each follows the same frame-based, no-CSS-animation rule. Combined with the terminal recreation components, they close the gap between "Remotion composition" and "looks like a real production".
