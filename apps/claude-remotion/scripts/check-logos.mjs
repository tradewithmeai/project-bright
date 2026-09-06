#!/usr/bin/env node
/**
 * check-logos.mjs — build-time guard for the AI Top 5 logo tier. Asserts every file listed in
 * src/templates/ai_top5/logos.json exists on disk under public/. A manifest entry with no committed
 * file would reach the render as a broken <Img> and throw via delayRender, killing the daily.
 * Run before a render / in CI. Exits non-zero on any mismatch.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'src/templates/ai_top5/logos.json'), 'utf8'));
const missing = Object.entries(manifest.logos)
  .filter(([, v]) => !existsSync(join(ROOT, 'public', v.file)))
  .map(([k, v]) => `${k} → public/${v.file}`);

if (missing.length) {
  console.error(`[check-logos] ${missing.length} manifest file(s) NOT on disk:\n  ` + missing.join('\n  '));
  console.error('Vendor the SVG (scripts/vendor-logos.mjs) or remove the manifest entry.');
  process.exit(1);
}
console.log(`[check-logos] ✔ all ${Object.keys(manifest.logos).length} logo files present`);
