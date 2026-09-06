import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * HelloWorld — the zero-dependency proof that your install renders.
 *
 * Deliberate constraints, all of them load-bearing:
 *   - no API key      — nothing here calls a paid service
 *   - no staticFile   — nothing here reads from public/, so a clean clone has everything it needs
 *   - no web font     — a system font stack, so no fetch to fonts.gstatic.com at render time
 *   - no audio        — silent, so it renders the same with or without ffmpeg audio codecs
 *
 * If this renders, your install works. If it does not, the problem is your install and not
 * your project. That is the entire job of this file — do not add assets or keys to it.
 *
 * It is also the template to copy when you start a real piece. See README.md, "Day one".
 */

export const HELLO_WORLD_FRAMES = 150;

// System stack: resolves locally on every platform, fetches nothing.
const FONT_STACK =
  '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

const BACKGROUND = "#0b0d12";
const INK = "#f4f6fb";
const ACCENT = "#5b8cff";

export const HelloWorld: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  // Scale type to the canvas so this reads correctly at any resolution, including the
  // --scale=0.25 thumbnail used by the smoke test.
  const unit = width / 1920;

  const titleIn = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 30 });
  const subtitleIn = spring({
    frame: frame - 18,
    fps,
    config: { damping: 200 },
    durationInFrames: 30,
  });
  const ruleIn = spring({
    frame: frame - 10,
    fps,
    config: { damping: 200 },
    durationInFrames: 40,
  });

  // Hold, then fade the last half-second so the tail is not an abrupt cut.
  const fadeOut = interpolate(frame, [HELLO_WORLD_FRAMES - 15, HELLO_WORLD_FRAMES], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BACKGROUND,
        fontFamily: FONT_STACK,
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeOut,
      }}
    >
      <div style={{ textAlign: "center", padding: `0 ${120 * unit}px` }}>
        <div
          style={{
            fontSize: 128 * unit,
            fontWeight: 700,
            letterSpacing: -4 * unit,
            color: INK,
            opacity: titleIn,
            transform: `translateY(${interpolate(titleIn, [0, 1], [28 * unit, 0])}px)`,
          }}
        >
          Hello, world.
        </div>

        <div
          style={{
            height: 4 * unit,
            width: interpolate(ruleIn, [0, 1], [0, 420 * unit]),
            backgroundColor: ACCENT,
            margin: `${44 * unit}px auto`,
            borderRadius: 2 * unit,
          }}
        />

        <div
          style={{
            fontSize: 40 * unit,
            fontWeight: 400,
            lineHeight: 1.45,
            color: INK,
            opacity: subtitleIn * 0.82,
            transform: `translateY(${interpolate(subtitleIn, [0, 1], [18 * unit, 0])}px)`,
          }}
        >
          Your install renders. Nothing here needed a key,
          <br />
          an asset, or a network call.
        </div>
      </div>
    </AbsoluteFill>
  );
};
