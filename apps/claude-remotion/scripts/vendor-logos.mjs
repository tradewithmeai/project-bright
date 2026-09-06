#!/usr/bin/env node
/**
 * vendor-logos.mjs — fetch the real brand logo glyphs for the AI Top 5 background logo tier into
 * public/logos/, once (they're static committed assets, $0/render). Real assets only — never generated.
 *
 * Source: Simple Icons (CC0-1.0) via jsDelivr, pinned per-slug. The 10 CC0 marks come from
 * simple-icons@16.25.0; OpenAI was removed in v16, so it's pulled from a pre-removal version (the
 * genuine historical Simple Icons mark) into logos/brand/ with its own provenance. Each fetch is
 * validated as real SVG before writing. Broadcom is HELD (custom non-CC0 licence) — not vendored.
 *
 * Usage: node scripts/vendor-logos.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const cdn = (ver, slug) => `https://cdn.jsdelivr.net/npm/simple-icons@${ver}/icons/${slug}.svg`;

// { slug, version, dir, license, provenance }
const SI = '16.25.0';
const TARGETS = [
  { slug: 'anthropic',       ver: SI, dir: 'si' },
  { slug: 'google',          ver: SI, dir: 'si' },
  { slug: 'deepmind',        ver: SI, dir: 'si' },
  { slug: 'nvidia',          ver: SI, dir: 'si' },
  { slug: 'meta',            ver: SI, dir: 'si' },
  { slug: 'cloudflare',      ver: SI, dir: 'si' },
  { slug: 'coinbase',        ver: SI, dir: 'si' },
  { slug: 'baidu',           ver: SI, dir: 'si' },
  { slug: 'github',          ver: SI, dir: 'si' },
  { slug: 'linuxfoundation', ver: SI, dir: 'si' },
  // OpenAI — removed from Simple Icons v16; pull the genuine pre-removal mark (owner-approved hand-source).
  { slug: 'openai',          ver: '13.21.0', dir: 'brand', provenance: 'simple-icons@13.21.0 (pre-v16 removal)' },
];

async function fetchSvg(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const txt = await r.text();
  if (!txt.trimStart().startsWith('<svg')) throw new Error(`not an SVG (starts "${txt.slice(0, 40)}")`);
  return txt;
}

const ok = [];
const failed = [];
for (const t of TARGETS) {
  const outDir = join(ROOT, 'public', 'logos', t.dir);
  mkdirSync(outDir, { recursive: true });
  try {
    const svg = await fetchSvg(cdn(t.ver, t.slug));
    writeFileSync(join(outDir, `${t.slug}.svg`), svg, 'utf8');
    ok.push(`${t.dir}/${t.slug}.svg  (simple-icons@${t.ver}${t.provenance ? ` — ${t.provenance}` : ''})`);
    console.log(`  ✔ ${t.dir}/${t.slug}.svg`);
  } catch (e) {
    failed.push(`${t.slug}: ${e.message}`);
    console.error(`  ✗ ${t.slug}: ${e.message}`);
  }
}
console.log(`\n[vendor-logos] ${ok.length} ok, ${failed.length} failed`);
if (failed.length) { console.error('FAILED:', failed.join('; ')); process.exit(1); }
