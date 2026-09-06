import { AbsoluteFill, Img, staticFile } from "remotion";
import { Story } from "./data";
import { accentFor } from "./tokens";
import { resolveLogo } from "./logoLookup";

// StoryBackground — the backmost layer of the device SCREEN (Phase 3). Resolution order per story:
//   1. newsImage (deferred gen tier) → cover-fit image
//   2. a REAL logo for story.entities  → gradient + low-opacity accent-tinted logo watermark + frame
//   3. plain gradient                  → EXACTLY the pre-Phase-3 look (zero-regression floor)
// Pure/deterministic, no render-time I/O. All timed story text renders ABOVE this, unchanged.

const PLAIN_GRADIENT = "linear-gradient(135deg, #16264a 0%, #0a0f1e 100%)";

type Props = { story: Story; sw: number; sh: number; newsImage?: string };

export const StoryBackground: React.FC<Props> = ({ story, sw, sh, newsImage }) => {
  // (1) Deferred gen-image tier — kept wired so it's a drop-in when gen ships (heavy scrim added then).
  if (newsImage) {
    return <Img src={staticFile(newsImage)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
  }

  const logo = resolveLogo(story.entities);

  // (3) No real logo → the exact current gradient. Byte-for-byte identical to Phase 2 (the floor).
  if (!logo) {
    return <AbsoluteFill style={{ background: PLAIN_GRADIENT }} />;
  }

  // (2) Logo mode — gradient base + a large accent-tinted logo silhouette (CSS mask so the monochrome
  // SVG takes the rank accent), held low so the on-screen text stays dominant ("text explains").
  const accent = accentFor(story.n);
  const url = `url(${staticFile(logo.file)})`;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: PLAIN_GRADIENT }} />
      {/* accent-tinted logo watermark */}
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: sw * 0.52,
            height: sh * 0.52,
            backgroundColor: accent,
            opacity: 0.16,
            WebkitMaskImage: url,
            maskImage: url,
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskSize: "contain",
            maskSize: "contain",
          }}
        />
      </AbsoluteFill>
      {/* picture-frame treatment: centre-heavy scrim keeps the reading band dark, + inset accent ring + vignette */}
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse 72% 56% at 50% 50%, rgba(5,7,15,0.74) 0%, rgba(5,7,15,0.45) 72%, rgba(5,7,15,0.25) 100%)" }}
      />
      <AbsoluteFill style={{ boxShadow: `inset 0 0 0 1px ${accent}33, inset 0 0 120px rgba(0,0,0,0.5)` }} />
    </AbsoluteFill>
  );
};
