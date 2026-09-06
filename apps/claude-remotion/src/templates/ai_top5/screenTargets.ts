// Screen landing targets — the measured cyan-screen rectangle for each era-device plate.
//
// Produced by detect_screen.py on the ACCEPTED plate (see the JSON sidecars in
// studio/projects/ai-top5/image-tests/<device>_screen.json). Stored as a FRACTION of the
// frame so the rect maps cleanly onto any output size (the plates are 1672×941 ≈ 16:9,
// the video is 1920×1080 ≈ 16:9 — same aspect, so fractions land true).
//
// This is the news-image LANDING TARGET: the DVE flies a per-story image in and settles it
// onto rect. The cyan screen in the plate is only a measurement placeholder — the landed
// image covers it, so cyan never renders.

export type Rect = { x: number; y: number; w: number; h: number }; // fraction of frame

export type ScreenTarget = {
  key: string;
  label: string;
  /**
   * The device photograph, as a staticFile path.
   *
   * ⚠️ Optional, and the 20s tablet deliberately has none. Rank 1 renders the finale set-piece,
   * which draws `20s_tablet_fg.png` (a keyed foreground) over its own background instead — so the
   * 20s entry is here for its RECT and corner radius only. It did name a plate, and
   * `20s_tablet_plate.png` sat in public/ at 1.3 MB shipping to every clone without any surviving
   * scene drawing it. A filename appearing in the source is not proof that a frame renders it.
   */
  plate?: string;
  rect: Rect;
  // Each device's screen is a DIFFERENT SHAPE: content must fit its aspect AND its corner
  // rounding (a 50s CRT is soft-cornered; a projector wall is sharp). radiusFrac = corner
  // radius as a fraction of the screen rect height. The rect's aspect (w/h) is likewise what
  // the future gen-AI news images must be generated/cropped to, per device.
  radiusFrac: number;
};

export const SCREEN_TARGETS: Record<string, ScreenTarget> = {
  "50s": {
    key: "50s",
    label: "50s TV",
    plate: "era-devices/50s_tv_plate.jpg",
    rect: { x: 0.3026, y: 0.1785, w: 0.4049, h: 0.4623 },
    radiusFrac: 0.1,
  },
  "80s": {
    key: "80s",
    label: "80s super system",
    plate: "era-devices/80s_tv_plate.jpg",
    rect: { x: 0.3319, y: 0.067, w: 0.4492, h: 0.441 },
    radiusFrac: 0.06,
  },
  "90s": {
    key: "90s",
    label: "90s flatscreen",
    plate: "era-devices/90s_flatscreen_plate.jpg",
    rect: { x: 0.2016, y: 0.1211, w: 0.5957, h: 0.4867 },
    radiusFrac: 0.025,
  },
  "00s": {
    key: "00s",
    label: "00s projector",
    plate: "era-devices/00s_projector_plate.jpg",
    rect: { x: 0.1944, y: 0.1668, w: 0.6083, h: 0.4346 },
    radiusFrac: 0.008,
  },
  "20s": {
    key: "20s",
    label: "20s tablet",
    rect: { x: 0.2231, y: 0.186, w: 0.5544, h: 0.6196 },
    radiusFrac: 0.035,
  },
};

export const DEFAULT_DEVICE = "90s";
