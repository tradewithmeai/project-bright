// FootagePromo — a footage-led promotional video, cut to a musical grid.
//
// The composition is deliberately thin. Everything that decides how the video feels lives in
// plan.ts; this file only turns the compiled plan into elements:
//
//   sections -> <Sequence> per cut, each a <FootageClip> with its own trim and fit
//            -> captions in screen space, per section
//            -> an impact flash where the plan asks for one
//   audio    -> one mix mounted once at the root: bed, speech, SFX
//
// ⚠️ The audio is mounted at the ROOT and outside any visual wrapper. A treatment that renders its
// children more than once — a chromatic split, a ghost trail — would mount the audio once per
// copy. Visual duplication is a look; audio duplication is a bug you hear as comb filtering.

import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { AudioMixLanes, MusicBed, type SfxCue, type SpeechCue } from "../shared/AudioMix";
import { CaptionTrack, DEFAULT_CAPTION_THEME, type CaptionTheme } from "../shared/CaptionTrack";
import { FootageClip, ImpactFlash } from "../shared/FootageClip";
import { BeatHit, FootageGrid, FootagePiP } from "../shared/FootageLayout";
import { RetroTreatment } from "../shared/RetroTreatment";
import { staticFile } from "remotion";
import {
  DUCK,
  FOOTAGE_PROMO_FRAMES,
  FPS,
  MUSIC,
  PLAN,
  SFX,
  SFX_ESCALATION,
  SPEECH,
  cueFrame,
} from "./plan";

export { FOOTAGE_PROMO_FRAMES };

export type FootagePromoProps = {
  theme?: CaptionTheme;
  backgroundColor?: string;
};

/**
 * One shot, for its slot on the timeline.
 *
 * ⚠️ Cuts are HARD, and that is a decision rather than an omission. A dissolve on a beat fights
 * the thing the beat is for: the eye is still resolving the previous shot when the next hit
 * lands, so the edit reads as soft exactly where it should feel locked. The walkthrough template
 * crossfades its stages because they are chapters; a promo cuts because they are hits.
 *
 * Consecutive cuts tile exactly — compilePlan guarantees the beat spans sum to the section — so
 * there is no gap between them to show through, and no overlap to double-expose.
 */
const CutView: React.FC<{ cut: (typeof PLAN.sections)[number]["cuts"][number] }> = ({ cut }) => (
  <Sequence
    from={cut.from}
    durationInFrames={cut.durationInFrames}
    layout="none"
    name={`${cut.clip}@${cut.from}`}
  >
    <FootageClip
      src={staticFile(cut.src)}
      trimBefore={cut.trimBefore}
      fit={cut.fit}
      filter={cut.filter}
    />
  </Sequence>
);

export const FootagePromo: React.FC<FootagePromoProps> = ({
  theme = DEFAULT_CAPTION_THEME,
  backgroundColor = "#05070c",
}) => {
  const { fps, durationInFrames } = useVideoConfig();

  // The plan's frame numbers were computed at plan.FPS. If the composition is registered at some
  // other rate the cuts would silently land off the music, so say so rather than render it wrong.
  if (fps !== FPS) {
    throw new Error(
      `FootagePromo: the plan is compiled at ${FPS}fps but the composition is ${fps}fps. ` +
        `Set plan.ts FPS to match, or register the composition at ${FPS}.`
    );
  }
  if (PLAN.problems.length > 0) {
    throw new Error(`FootagePromo: the plan does not hold together:\n  ${PLAN.problems.join("\n  ")}`);
  }

  const speech: SpeechCue[] = SPEECH.map((s) => ({
    src: staticFile(s.src),
    at: cueFrame(s.atBar, s.atBeat ?? 0),
    dur: s.frames,
  }));

  // Repeated hits climb across the run; one-off cues keep their declared gain.
  const repeated = SFX.filter((c) => c.gain == null);
  const sfx: SfxCue[] = SFX.map((c) => {
    const at = cueFrame(c.atBar, c.atBeat ?? 0);
    if (c.gain != null) return { src: staticFile(c.src), at, gain: c.gain };
    const i = repeated.indexOf(c);
    const t = repeated.length > 1 ? i / (repeated.length - 1) : 0;
    return { src: staticFile(c.src), at, gain: SFX_ESCALATION.base + SFX_ESCALATION.climb * t };
  });


  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {/* ── PICTURE ─────────────────────────────────────────────────────────────────────── */}
      {/* A grid section replaces its cuts with cells; every other section cuts. */}
      {PLAN.sections.map((section) =>
        section.grid
          ? null
          : section.cuts.map((cut, ci) => <CutView key={`${section.id}-${ci}`} cut={cut} />)
      )}

      {/* ── PER-SECTION LAYERS ──────────────────────────────────────────────────────────── */}
      {PLAN.sections.map((section) => (
        <Sequence
          key={`ov-${section.id}`}
          from={section.from}
          durationInFrames={section.durationInFrames}
          name={section.id}
        >
          {/* The grid IS the picture for its section, so it sits at the bottom of this stack. */}
          {section.grid ? (
            <FootageGrid
              cells={section.grid.map((c) => ({
                src: staticFile(c.src),
                source: c.source,
                trimBefore: c.trimBefore,
                fit: c.fit,
                label: c.label,
              }))}
            />
          ) : null}

          {section.pip ? (
            <FootagePiP
              src={staticFile(section.pip.src)}
              source={section.pip.source}
              corner={section.pip.corner}
              width={section.pip.width}
              label={section.pip.label}
              trimBefore={section.pip.trimBefore}
              exitFrames={10}
              durationInFrames={section.durationInFrames}
            />
          ) : null}

          {section.impactAt != null ? <ImpactFlash at={section.impactAt} /> : null}

          {section.beatHits.length > 0 ? (
            <BeatHit cues={section.beatHits} accent={theme.accent} />
          ) : null}

          {/* Above the picture, below the captions — and around no audio at all. */}
          {section.treatment ? (
            <RetroTreatment
              intensity={section.treatment.intensity}
              label={section.treatment.label}
              timecode={section.treatment.timecode}
            />
          ) : null}

          <CaptionTrack
            track={section.captions}
            stageEndS={section.durationInFrames / fps}
            theme={theme}
          />
        </Sequence>
      ))}

      {/* ── AUDIO, mounted once at the root ─────────────────────────────────────────────── */}
      {/* The bed is 8 bars and the promo is 16, so it repeats. MusicBed handles the loop and the
          extended volume frame together, because getting one without the other is a silent bug. */}
      <MusicBed
        src={staticFile(MUSIC.src)}
        gain={MUSIC.gain}
        speech={speech}
        duck={DUCK}
        endFrame={durationInFrames}
        tailFade={30}
        loop
      />
      <AudioMixLanes speech={speech} sfx={sfx} />
    </AbsoluteFill>
  );
};
