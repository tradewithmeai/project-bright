import { staticFile } from "remotion";
import { BrandSting, BrandStingConfig } from "./BrandSting";

export { BrandSting };
export type { BrandStingConfig };

export const BRAND_STING_DEFAULT: BrandStingConfig = {
  name: "BRAND",
  tagline: "",
  logo: null,
  colors: { bg: "#0a0d10", primary: "#00bfff", accent: "#00ff88", text: "#ffffff" },
  fps: 30, width: 1920, height: 1080, total_frames: 180,
};

// Reads the config produced by build-brand-sting.mjs from a scraped BrandPack.
export const calculateMetadata = async () => {
  let config = BRAND_STING_DEFAULT;
  try {
    const res = await fetch(staticFile("brand-sting/config.json"));
    if (res.ok) config = { ...BRAND_STING_DEFAULT, ...(await res.json()) };
  } catch { /* use default */ }
  return {
    durationInFrames: config.total_frames || 180,
    fps: config.fps || 30,
    width: config.width || 1920,
    height: config.height || 1080,
    props: { config },
  };
};
