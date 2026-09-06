// Shared, template-agnostic building blocks.
//
// Anything here must be generic: no client, project or campaign specifics, no committed assets
// of its own. A template imports from here; nothing here imports from a template.

export { FittedPhoto, PhotoCard, CARD_SCATTER } from "./PhotoFit";
export type { FittedPhotoProps, PhotoCardProps } from "./PhotoFit";

export { FX, Firework, Pistil, MultiBreak, FireworkFinale, FIREWORK_FINALE_FRAMES } from "./Fireworks";
export type { FireworkProps } from "./Fireworks";

export {
  VirtualCamera,
  Capture,
  ImageCapture,
  CAMERA_EASE,
  clampRegion,
  contentRect,
  regionAtFrame,
  sourcePointToScreen,
} from "./VirtualCamera";
export type { FocusRegion, CameraMove, SourceSize, VirtualCameraProps } from "./VirtualCamera";

export {
  CaptionTrack,
  FocusPulse,
  DEFAULT_CAPTION_THEME,
  CAPTION_FONT,
  CAPTION_FADE_FRAMES,
  TITLE_HANG_S,
  TITLE_GAP_S,
  readingFloor,
  READING_FLOOR_MIN_S,
  READING_FLOOR_PER_CHAR_S,
} from "./CaptionTrack";
export type { CaptionLine, CaptionStyle, CaptionTheme } from "./CaptionTrack";

export { AmbientBackground, AmbientSheen, breathe, hash01, stageEnvelope } from "./AmbientBackground";
export type { AmbientBackgroundProps } from "./AmbientBackground";

export { CaptureStateSwitch, stateOpacities } from "./CaptureState";
export type { CaptureStateDef, CaptureStateTrigger } from "./CaptureState";

export {
  meter,
  beatFrames,
  barFrames,
  frameAtBeat,
  frameAtBar,
  frameAt,
  beatSpan,
  barSpan,
  beatAtFrame,
  layoutBars,
  snapToBeat,
  localFrameAtBeat,
  musicalUnitsForDuration,
} from "./MusicalTime";
export type { Meter } from "./MusicalTime";

export { MusicBed, SfxCues, SpeechCues, AudioMixLanes, duckAt, DEFAULT_DUCK } from "./AudioMix";
export type { DuckShape, SpeechCue, SfxCue, MusicBedProps } from "./AudioMix";

export { FootageClip, ImpactFlash } from "./FootageClip";
export type { FitMode, FootageClipProps } from "./FootageClip";

export { FootagePiP, FootageGrid, BeatHit } from "./FootageLayout";
export type { FootagePiPProps, GridCell, BeatHitCue, PiPCorner } from "./FootageLayout";

export { RetroTreatment, glitchStrength } from "./RetroTreatment";
export type { RetroTreatmentProps } from "./RetroTreatment";

export { DeviceFrame } from "./DeviceFrame";
export type { DeviceFrameProps, DeviceKind } from "./DeviceFrame";

export { BrandMark, DEFAULT_BRAND_THEME } from "./BrandTokens";
export type { Brand, BrandTheme } from "./BrandTokens";

export { SafeLayer, SafeAreaGuides, safeRect, useSafeRect, DEFAULT_SAFE, LANDSCAPE_SAFE } from "./SafeArea";
export type { SafeAreaSpec, SafeRect } from "./SafeArea";

export { ReframedMedia, reframeGeometry } from "./ReframedMedia";
export type { ReframedMediaProps, ReframeMode, ReframeGeometry } from "./ReframedMedia";
