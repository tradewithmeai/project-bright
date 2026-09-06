# Claude Code CLI — pixel-level spec + component sketch

## Visual constants

```ts
const CC = {
  bg:           "#0b0d12",
  bgStrip:      "#0d1117",   // bottom strip
  bgDiffAdd:    "rgba(74,222,128,0.10)",
  bgDiffRem:    "rgba(248,113,113,0.12)",
  text:         "#e2e8f0",
  muted:        "#475569",
  green:        "#4ade80",
  amber:        "#fbbf24",
  orange:       "#f97316",   // spinner / working
  red:          "#f87171",
  purple:       "#a78bfa",
  purpleBg:     "#1e1b4b",
  font:         "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  fontSize:     15,
  lineH:        1.5,
};
```

## Component sketch (~80 lines, illustrative)

```tsx
// ClaudeCodeWindow.tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import { WindowChrome } from "./WindowChrome";
import { StreamingCode } from "./StreamingCode";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);

// A Claude Code CLI session: status bullets → diff block → streaming output → done.
export const ClaudeCodeWindow: React.FC<{
  startFrame?: number;
  title?: string;
  statusLines?: { text: string; color?: string }[];
  diffLines?: { sign: "+" | "-" | " "; text: string; n?: number }[];
  streamCode?: string;
  cps?: number;
  w?: number; h?: number;
}> = ({
  startFrame = 0, title = "claude-code ~/mygov",
  statusLines = [], diffLines = [], streamCode = "", cps = 48,
  w = 760, h = 480,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - startFrame;

  // Window entrance
  const appear = interpolate(t, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });

  // Status bullets staggered (one per ~10f)
  // Diff block appears at t=statusLines.length*10
  // Stream begins at diff end + 8f

  const totalStatusFrames = statusLines.length * 10;
  const diffAppear = interpolate(t, [totalStatusFrames, totalStatusFrames + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const streamStart = startFrame + totalStatusFrames + 8;

  // Spinner: elapsed seconds after the diff appears
  const spinStart = totalStatusFrames + 8;
  const elapsed = Math.max(0, t - spinStart);
  const secs = Math.floor(elapsed / fps);
  const mins = Math.floor(secs / 60);
  const secRem = secs % 60;
  const spinStr = `✦  Working…  (${mins}m ${String(secRem).padStart(2,"0")}s · ↓ ${(elapsed * 0.4).toFixed(1)}k tokens)`;
  const spinOp = interpolate(t, [spinStart, spinStart + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <WindowChrome variant="claude" title={title} accent="#a78bfa" w={w} h={h} appear={appear} glow={0.4}>
      <div style={{ padding: "16px 20px 48px", fontFamily: CC.font, fontSize: CC.fontSize, lineHeight: CC.lineH, color: CC.text, height: "100%", overflow: "hidden", position: "relative" }}>
        {/* Status bullets */}
        {statusLines.map((sl, i) => {
          const op = interpolate(t, [i * 10, i * 10 + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
          return (
            <div key={i} style={{ opacity: op, marginBottom: 6, color: sl.color ?? CC.green }}>
              <span style={{ marginRight: 10 }}>●</span>{sl.text}
            </div>
          );
        })}
        {/* Diff block */}
        {diffLines.length > 0 && (
          <div style={{ opacity: diffAppear, margin: "10px 0", borderRadius: 6, overflow: "hidden", border: "1px solid #1e2d4a" }}>
            {diffLines.map((dl, i) => (
              <div key={i} style={{
                display: "flex", gap: 12,
                background: dl.sign === "+" ? CC.bgDiffAdd : dl.sign === "-" ? CC.bgDiffRem : "transparent",
                padding: "1px 10px",
                borderLeft: `3px solid ${dl.sign === "+" ? CC.green : dl.sign === "-" ? CC.red : "transparent"}`,
              }}>
                <span style={{ color: CC.muted, userSelect: "none", minWidth: 20, textAlign: "right" }}>{dl.n ?? i + 1}</span>
                <span style={{ color: dl.sign === "+" ? CC.green : dl.sign === "-" ? CC.red : CC.muted }}>{dl.sign} </span>
                <span>{dl.text}</span>
              </div>
            ))}
          </div>
        )}
        {/* Streaming output */}
        {streamCode && <StreamingCode code={streamCode} startFrame={streamStart} cps={cps} fontSize={CC.fontSize} color={CC.text} />}
        {/* Spinner */}
        {spinOp > 0.01 && <div style={{ opacity: spinOp, color: CC.orange, marginTop: 8 }}>{spinStr}</div>}
        {/* Right tag */}
        <div style={{ position: "absolute", top: 10, right: 12, background: CC.purpleBg, color: CC.purple, fontSize: 12, fontWeight: 600, padding: "2px 10px", borderRadius: 999 }}>● claude-code</div>
        {/* Allowed note */}
        <div style={{ color: CC.muted, fontSize: 12, marginTop: 6 }}>L  Allowed by auto mode classifier</div>
      </div>
      {/* Bottom strip */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 32, background: CC.bgStrip, display: "flex", alignItems: "center", padding: "0 18px", borderTop: "1px solid #1e2d4a" }}>
        <span style={{ fontFamily: CC.font, fontSize: 13, color: CC.green }}>{">> auto mode on  (shift+tab to cycle)"}</span>
      </div>
    </WindowChrome>
  );
};
```

## Usage in CodexNexus / S7
Replace the current `ClaudeCodePanel` usages in the outer windows of `CodexNexus.tsx` with `ClaudeCodeWindow`, wiring realistic status lines + a short diff + a brief stream. The central Codex window uses `WindowChrome variant="codex"` with its own chat-style content.

## Key authenticity rules
- The `●` bullet must be a FILLED circle (U+25CF), not an emoji or SVG — it matches the real CLI exactly.
- The spinner elapsed time must increment frame-by-frame (use `Math.floor((frame - spinStart) / fps)`) so every render is deterministic and identical on re-render.
- The bottom strip must be FIXED inside the window body — it never scrolls with the content.
- The right tag must be present — it's one of the most recognisable elements.
