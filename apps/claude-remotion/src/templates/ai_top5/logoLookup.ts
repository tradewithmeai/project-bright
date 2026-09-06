import manifest from "./logos.json";

// resolveLogo — the AI Top 5 story background logo tier (Phase 3). Maps a story's `entities[]` (API v4,
// canonical org names) to a REAL, committed logo asset. Logos are never generated: a name that has no
// vendored file resolves to null and the caller falls back (gen backdrop later, else plain gradient).
//
// Pure + deterministic: the manifest is a static import, resolution is a table lookup, no render-time I/O.
// The FIRST entity (API order — index 0 is the primary org) that maps to a real file wins.

export type LogoAsset = { file: string; hex: string };

const LOGOS: Record<string, LogoAsset> = manifest.logos;
const ALIASES: Record<string, string> = manifest.aliases;

// Normalise an entity name to a manifest key: lowercase, & → "and", strip non-alphanumerics, de-alias.
function keyOf(entity: string): string {
  const norm = String(entity).toLowerCase().trim().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
  return ALIASES[norm] ?? norm;
}

export function resolveLogo(entities: string[] | undefined): LogoAsset | null {
  if (!Array.isArray(entities)) return null;
  for (const e of entities) {
    const asset = LOGOS[keyOf(e)];
    if (asset) return asset;
  }
  return null;
}

// The manifest↔disk file-existence guard (a missing file would reach render as a broken <Img> and
// throw via delayRender, killing the daily) lives OUTSIDE the render bundle in scripts/check-logos.mjs
// (a node fs check, run before render / in CI). It cannot run here — getStaticFiles() is studio-only
// and empty in a headless render, and this module is browser-bundled with no fs access.
