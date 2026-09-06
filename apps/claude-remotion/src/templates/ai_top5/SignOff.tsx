import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate } from "remotion";
import { TEXT, FONT_BODY, FONT_MONO, FONT_BUBBLE, MUTED, EASE, BRAND_ACCENT, accentFor } from "./tokens";
import { SIGN_OFF_FRAMES } from "./grid";
import { Wordmark } from "./Brand";
import { Bulletin } from "./data";

type Props = { bulletin: Bulletin };

const ACCENT = BRAND_ACCENT; // signature ident colour (palette single-source, tokens.ts)
const TITLE_IN_START = 8; // title entrance window (existing sign-off timing, unchanged)
const TITLE_IN_END = 22;
const TITLE_FONT_SIZE = 110; // sign-off Wordmark (smaller — shares the card with the round-up)

// Round-up rundown — tonight's five, recapped 5→1 (the ending the show was missing).
const RECAP_START = 26; // first row enters after the wordmark lands
const RECAP_STEP = 5;   // per-row stagger
const RECAP_IN = 8;     // per-row fade/rise window

// Act 2 — the brand close: solvx build-in-public mark + the YouTube QR CTA (channel @solvXuk).
// The sign-off runs SIGN_OFF_FRAMES; the close holds long enough to scan the QR.
const CLOSE_START = 138;   // round-up card fades out into the brand close
const CLOSE_XFADE = 12;    // crossfade window
const CLOSE_OUT = SIGN_OFF_FRAMES - 12; // final fade to black begins (derived from the grid)
const YT_QR = staticFile("brand/youtube-qr.png");
const SOLVX_MARK = staticFile("solvx-logo-outline.png"); // the evolving build-in-public mark
const YT_HANDLE = "@solvXuk";

export function SignOff({ bulletin }: Props) {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [TITLE_IN_START, TITLE_IN_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const titleScale = interpolate(frame, [TITLE_IN_START, TITLE_IN_END], [0.9, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  // Glow envelope 0→1 on the same entrance ramp — the sine pulse lives in the Wordmark
  const titleGlow = interpolate(frame, [TITLE_IN_START, TITLE_IN_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const taglineOpacity = interpolate(frame, [54, 66], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const metaOpacity = interpolate(frame, [60, 72], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  // Act 1 (round-up card) crossfades into Act 2 (brand close).
  const act1Opacity = interpolate(frame, [CLOSE_START, CLOSE_START + CLOSE_XFADE], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const act2Opacity = interpolate(
    frame,
    [CLOSE_START + CLOSE_XFADE, CLOSE_START + CLOSE_XFADE * 2, CLOSE_OUT, CLOSE_OUT + 12],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE },
  );
  const closeUrlScale = interpolate(frame, [CLOSE_START + CLOSE_XFADE, CLOSE_START + CLOSE_XFADE * 2], [0.92, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const socialsOpacity = interpolate(frame, [CLOSE_START + CLOSE_XFADE * 2 + 4, CLOSE_START + CLOSE_XFADE * 2 + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

  return (
    <AbsoluteFill>
      {/* ── Act 2: solvx.uk brand close + socials ── */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 30,
          opacity: act2Opacity,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse 55% 45% at 50% 50%, ${ACCENT}12 0%, transparent 70%)`,
            pointerEvents: "none",
          }}
        />
        {/* the build-in-public solvx mark (basic form; treatment evolves per video) */}
        <div style={{ transform: `scale(${closeUrlScale})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          {/* white on the dark stage */}
          <Img src={SOLVX_MARK} style={{ width: 430, filter: "brightness(0) invert(1)", opacity: 0.95 }} />
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 20,
              color: `${TEXT}99`,
              letterSpacing: 6,
              textTransform: "uppercase" as const,
            }}
          >
            AI TOP 5 · EVERY DAY
          </div>
        </div>

        {/* the YouTube CTA — QR + channel (the QR holds to the fade so it can be scanned) */}
        <div style={{ display: "flex", alignItems: "center", gap: 44, opacity: socialsOpacity, marginTop: 8 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 14, boxShadow: `0 12px 48px rgba(0,0,0,0.55), 0 0 60px ${ACCENT}22` }}>
            <Img src={YT_QR} style={{ width: 240, display: "block" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
            <div style={{ fontFamily: FONT_BUBBLE, fontSize: 46, fontWeight: 700, color: TEXT, lineHeight: 1.1 }}>
              ▶ Watch every day
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 30, fontWeight: 700, color: ACCENT, letterSpacing: 2 }}>
              youtube.com/{YT_HANDLE}
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 16, color: MUTED, letterSpacing: 4 }}>
              ALSO ON TIKTOK · INSTAGRAM · X
            </div>
          </div>
        </div>
      </AbsoluteFill>

      {/* ── Act 1: round-up card ── */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          opacity: act1Opacity,
        }}
      >
      {/* Accent glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${ACCENT}14 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Brand title — the locked Wordmark (Brand.tsx); entrance owned here */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
        }}
      >
        <Wordmark glow={titleGlow} accent={ACCENT} fontSize={TITLE_FONT_SIZE} />
      </div>

      {/* Round-up rundown — tonight's five headlines, 5→1 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
        {bulletin.stories.map((s, i) => {
          const start = RECAP_START + i * RECAP_STEP;
          const rowOpacity = interpolate(frame, [start, start + RECAP_IN], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE,
          });
          const rowX = interpolate(frame, [start, start + RECAP_IN], [24, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE,
          });
          const rowAccent = accentFor(s.n);
          return (
            <div
              key={s.n}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 18,
                opacity: rowOpacity,
                transform: `translateX(${rowX}px)`,
              }}
            >
              <span
                style={{
                  fontFamily: FONT_BUBBLE,
                  fontSize: 30,
                  fontWeight: 700,
                  color: rowAccent,
                  width: 58,
                  textAlign: "right",
                }}
              >
                #{s.n}
              </span>
              <span
                style={{
                  fontFamily: FONT_BUBBLE,
                  fontSize: 27,
                  fontWeight: 500,
                  color: `${TEXT}dd`,
                }}
              >
                {s.headline}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tagline */}
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 22,
          color: `${TEXT}88`,
          letterSpacing: 4,
          textTransform: "uppercase" as const,
          opacity: taglineOpacity,
        }}
      >
        {bulletin.tagline}
      </div>

      {/* Edition / date */}
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 16,
          color: MUTED,
          letterSpacing: 4,
          marginTop: 12,
          opacity: metaOpacity,
        }}
      >
        {bulletin.date} · EDITION {bulletin.edition}
      </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
