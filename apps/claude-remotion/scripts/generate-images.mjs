#!/usr/bin/env node
/**
 * generate-images.mjs — per-story gen-AI images for AI Top 5 (structured-creative, gpt-image-2).
 *
 * Mirrors the script engine: a FIXED prompt skeleton (retro 70s Top-of-the-Pops TV set) + a
 * per-rank COLOUR scheme (aligned to the video's RANK_ACCENT ramp) + a per-story CREATIVE concept
 * that an LLM writes from the news facts. Formulaic frame, fresh image each day.
 *
 * Steps: (1) gpt-4o-mini writes ONE on-screen visual concept per story from the facts;
 *        (2) gpt-image-2 renders skeleton+colour+concept → public/images/<n>.png (medium, landscape).
 *
 * Env: OPENAI_API_KEY (billed — real image cost).
 * Usage: node generate-images.mjs [--url ...] [--only <rank>] [--quality medium|high|low]
 */
import '../../../scripts/load-env.mjs';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.APP_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const IMG_DIR = join(ROOT, 'public', 'images');
const KEY = process.env.OPENAI_API_KEY || '';
const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const URL = arg('url', 'https://solvx.uk/api/ai-news.json');
const ONLY = arg('only') ? parseInt(arg('only'), 10) : null;
const QUALITY = arg('quality', 'medium');
const SIZE = '1536x1024'; // landscape (3:2) — closest gpt-image-2 native size to the 16:9 comp

const IMG_MODEL = 'gpt-image-2';
const CONCEPT_MODEL = 'gpt-4o-mini';
// gpt-image-2 per-image (landscape 1536x1024): low $0.005 / medium $0.041 / high $0.165.
const IMG_COST = { low: 0.005, medium: 0.041, high: 0.165 };

// Per-rank colour scheme — matches the video's RANK_ACCENT cool→hot ramp, named for the image model.
const RANK_COLOUR = {
  5: 'bold sky-blue and deep navy',
  4: 'electric cyan and teal',
  3: 'vivid emerald green on black',
  2: 'warm amber and orange',
  1: 'hot magenta-pink and purple',
};

// The FIXED skeleton. ONLY {colour} and {concept} vary — everything else is the template.
function buildImagePrompt(colour, concept) {
  return [
    'A stylised retro 1970s "Top of the Pops" television broadcast graphic, wide landscape composition.',
    `A bold, chunky vintage TV set sits centre-frame in a ${colour} colour scheme —`,
    'glossy retro plastic, chrome dials, a soft CRT scanline glow, and 70s starburst accents around it.',
    `Filling the TV screen: a clean, professional, high-contrast symbolic illustration of ${concept}.`,
    'Flat bold graphic-design style, vibrant saturated colour, cinematic studio lighting,',
    'no text, no letters, no words, no logos. Polished and premium.',
  ].join(' ');
}

async function writeConcepts(stories) {
  const sys = 'You write ONE short vivid VISUAL concept per AI-news story — a concrete, symbolic illustration to appear ON a retro TV screen that represents the story. Rules: a noun phrase ~8-14 words; concrete and visual (objects, scenes, symbols); NO text, letters, words, logos, or brand names in the described image; professional, not cheesy. Return JSON only: {"concepts":[{"rank":number,"concept":string}]}';
  const facts = stories.map((s) => `#${s.rank} ${s.headline || s.title}: ${s.summary || ''}`).join('\n');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: CONCEPT_MODEL, messages: [{ role: 'system', content: sys }, { role: 'user', content: facts }], response_format: { type: 'json_object' }, temperature: 0.9 }),
  });
  if (!res.ok) throw new Error(`concept HTTP ${res.status} — ${(await res.text().catch(() => '')).slice(0, 200)}`);
  const d = await res.json();
  const parsed = JSON.parse(d.choices?.[0]?.message?.content || '{}');
  const byN = {};
  for (const c of parsed.concepts || []) byN[c.rank ?? c.n] = c.concept;
  console.log(`[img] concepts written (gpt-4o-mini, ${d.usage?.total_tokens ?? '?'} tok)`);
  return byN;
}

async function genImage(prompt, n) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: IMG_MODEL, prompt, size: SIZE, quality: QUALITY, n: 1 }),
  });
  if (!res.ok) throw new Error(`image HTTP ${res.status} — ${(await res.text().catch(() => '')).slice(0, 400)}`);
  const d = await res.json();
  const item = d.data?.[0] || {};
  let buf;
  if (item.b64_json) buf = Buffer.from(item.b64_json, 'base64');
  else if (item.url) buf = Buffer.from(await (await fetch(item.url)).arrayBuffer());
  else throw new Error('no image data in response');
  writeFileSync(join(IMG_DIR, `${n}.png`), buf);
  return { bytes: buf.length, usage: d.usage };
}

async function main() {
  if (!KEY) { console.error('[img] OPENAI_API_KEY not set'); process.exit(1); }
  mkdirSync(IMG_DIR, { recursive: true });
  const res = await fetch(URL);
  if (!res.ok) { console.error(`[img] API ${URL} -> HTTP ${res.status}`); process.exit(1); }
  const d = await res.json();
  let stories = (Array.isArray(d) ? d : d.stories || []).map((s) => ({ rank: s.rank ?? s.n, headline: s.headline || s.title, summary: s.summary }));
  if (ONLY != null) stories = stories.filter((s) => s.rank === ONLY);
  if (!stories.length) { console.error('[img] no stories to render'); process.exit(1); }

  const concepts = await writeConcepts(stories);
  let ok = 0;
  for (const s of stories) {
    const concept = concepts[s.rank] || s.headline;
    const prompt = buildImagePrompt(RANK_COLOUR[s.rank] || 'bold cyan', concept);
    console.log(`[img] #${s.rank} concept: ${concept}`);
    try {
      const r = await genImage(prompt, s.rank);
      ok++;
      console.log(`[img] #${s.rank} → images/${s.rank}.png (${Math.round(r.bytes / 1024)} KB)`);
    } catch (e) { console.error(`[img] #${s.rank} FAILED: ${e.message}`); }
  }
  const est = (ok * (IMG_COST[QUALITY] ?? IMG_COST.medium)).toFixed(3);
  console.log(`[img] done — ${ok}/${stories.length} images (${IMG_MODEL} ${QUALITY} ${SIZE}) est cost ~$${est}`);
}

main();
