#!/usr/bin/env node
// build-brand-sting.mjs — turn a scraped BrandPack into a brand-sting render config (studio, no API).
//
// Reads a brand_pack.json (from video-bright's run-brand-pack CLI) → assigns colour roles from the
// captured palette → writes public/brand-sting/config.json for the BrandSting Remotion composition.
// This is the scrape → repeatable-asset seam: any brand pack becomes a short branded reveal.
//
// Usage (from apps/claude-remotion):
//   node scripts/build-brand-sting.mjs --pack <brand_pack.json> [--tagline "..."] [--out public/brand-sting/config.json]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HERE, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };

const packPath = resolve(arg('--pack', ''));
if (!packPath) { console.error('usage: build-brand-sting.mjs --pack <brand_pack.json>'); process.exit(2); }
const pack = JSON.parse(readFileSync(packPath, 'utf8'));
const val = (x) => (x && x.value !== undefined ? x.value : x);

// name
const name = val(pack.identity?.primary_name) || val(pack.identity?.name) || 'BRAND';

// palette — classified first, then captured vocabulary
const hexes = [
  ...(pack.colours?.classified_tokens || []).map((t) => t.value),
  ...(pack.colours?.captured_vocabulary || []).map((t) => t.value),
].filter((h) => /^#[0-9a-f]{6}$/i.test(h || ''));

// role assignment from luminance + saturation (no deps)
function rgb(h) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); }
function lum(h) { const [r, g, b] = rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
function sat(h) { const [r, g, b] = rgb(h).map((v) => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; }

const uniq = [...new Set(hexes.map((h) => h.toLowerCase()))];
const darks = uniq.filter((h) => lum(h) < 0.25).sort((a, b) => lum(a) - lum(b));
const vivid = uniq.filter((h) => sat(h) > 0.5 && lum(h) > 0.25).sort((a, b) => sat(b) - sat(a));

const bg = darks[0] || '#0a0d10';
const primary = vivid[0] || '#00bfff';
const accent = vivid[1] || vivid[0] || '#00ff88';
const text = '#ffffff';

const tagline = arg('--tagline', '') || (pack.claims?.taglines || []).map(val)[0] || '';
const logo = val(pack.marks?.primary) || null; // usually null on the strict path (unresolved)

const config = {
  name, tagline, logo,
  colors: { bg, primary, accent, text },
  palette: uniq,
  source: { brand_pack: packPath, captured_at: pack.pack_metadata?.captured_at || null },
  fps: 30, width: 1920, height: 1080, total_frames: 180, // 6s
};

const out = resolve(arg('--out', join(APP_ROOT, 'public/brand-sting/config.json')));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(config, null, 2));
console.log(`[brand-sting] ${name} · bg=${bg} primary=${primary} accent=${accent} · ${uniq.length} colours → ${out}`);
