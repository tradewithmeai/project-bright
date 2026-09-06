#!/usr/bin/env node
// Bridge-v2 producer for the editor review pipeline (Increment 3 / Work Item D).
//
// Maps a recipe_v0 spec's sections → FlexSlot[] and emits the
// video_bright_flexible_cut_v2_project bridge document that Increment 4
// (the vb-backend bridge-v2 importer) consumes. Each slot points at the still
// that export-recipe-stills.mjs produced for it (previews/<position>-<slot_key>.png).
//
// Usage:
//   node scripts/produce-bridge-v2.mjs <recipe_json_path> <output_bridge_json_path>
//
// Slug + unique slot_key + unique position are REQUIRED (the importer and its DB
// unique index enforce them) — this script validates and fails loudly otherwise.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SLUG_RE = /^[A-Za-z0-9_-]+$/;

function fail(msg) {
  console.error(`\n[produce-bridge-v2] ERROR: ${msg}`);
  process.exit(1);
}

// Human role label from the section (section_type / label / intent). Matches export-recipe-stills.mjs.
function roleLabel(section) {
  if (section.role_label) return section.role_label;
  if (section.label) return section.label;
  if (section.section_type) {
    return String(section.section_type)
      .split(/[_-]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return section.intent ?? 'Section';
}

// slot_key = section id / section_id / slug (verbatim — NO transform). Matches export-recipe-stills.mjs.
function slotKeyOf(section, i) {
  return section.id ?? section.section_id ?? section.slug ?? `section-${i + 1}`;
}

// Primary on-screen line (headline) from text_beats.
function headlineOf(section) {
  const b = Array.isArray(section.text_beats) ? section.text_beats : [];
  if (b.length && b[0]?.beat) return String(b[0].beat);
  return undefined;
}

// editor_description for the first cut: the section's caption/text. Recorder flexible
// mode (Increment 5) replaces this later. Prefer the joined text_beats; fall back to
// intent / visual_treatment so the description is never empty.
function descriptionOf(section) {
  const b = Array.isArray(section.text_beats) ? section.text_beats : [];
  const beats = b.map((x) => x?.beat).filter(Boolean);
  if (beats.length) return beats.join(' / ');
  return section.intent ?? section.visual_treatment ?? undefined;
}

// ── Args ──────────────────────────────────────────────────────────────────────
const [, , recipeArg, outArg] = process.argv;
if (!recipeArg || !outArg) {
  console.error('Usage: node scripts/produce-bridge-v2.mjs <recipe_json_path> <output_bridge_json_path>');
  process.exit(1);
}
const recipePath = resolve(recipeArg);
const outPath = resolve(outArg);
if (!existsSync(recipePath)) fail(`Recipe file not found: ${recipePath}`);

let recipe;
try {
  recipe = JSON.parse(readFileSync(recipePath, 'utf8'));
} catch (e) {
  fail(`Invalid JSON in recipe file: ${e.message}`);
}
if (!recipe || !Array.isArray(recipe.sections) || recipe.sections.length === 0) {
  fail('recipe.sections must be a non-empty array');
}

// ── Map sections → FlexSlot[] ───────────────────────────────────────────────────
const seenKeys = new Set();
const seenPositions = new Set();
const slots = recipe.sections.map((section, i) => {
  const slot_key = slotKeyOf(section, i);
  const position = i + 1;

  if (!SLUG_RE.test(slot_key)) fail(`sections[${i}] slot_key "${slot_key}" is not slug-safe (^[A-Za-z0-9_-]+$)`);
  if (seenKeys.has(slot_key)) fail(`duplicate slot_key "${slot_key}" — slot keys must be unique`);
  seenKeys.add(slot_key);
  if (seenPositions.has(position)) fail(`duplicate position ${position}`);
  seenPositions.add(position);

  if (typeof section.duration_s !== 'number' || section.duration_s <= 0) {
    fail(`sections[${i}] "${slot_key}": duration_s must be a positive number`);
  }

  const slot = {
    slot_key,
    slot_type: 'still',
    position,
    role_label: roleLabel(section),
    max_duration_seconds: Math.ceil(section.duration_s),
    asset: {
      source: 'local_file',
      // Points at the still export-recipe-stills.mjs produced for this slot.
      local_file: `previews/${position}-${slot_key}.png`,
    },
  };
  const headline = headlineOf(section);
  const description = descriptionOf(section);
  if (headline !== undefined) slot.headline = headline;
  if (description !== undefined) slot.description = description;
  return slot;
});

// ── Bridge document ─────────────────────────────────────────────────────────────
const title =
  recipe.meta?.title ??
  recipe.title ??
  recipe.request_summary ??
  recipe.recipe_id ??
  'Untitled cut';

const bridge = {
  schema: 'video_bright_flexible_cut_v2_project',
  version: '2',
  meta: {
    title,
    template_type: 'flexible_cut_v2', // sentinel — Increment 4 importer routes on this
  },
  slots,
};

writeFileSync(outPath, JSON.stringify(bridge, null, 2), 'utf8');

console.log('');
console.log('[produce-bridge-v2] Bridge written:');
console.log(`  ${outPath}`);
console.log(`  schema       : ${bridge.schema}`);
console.log(`  template_type: ${bridge.meta.template_type}`);
console.log(`  slots        : ${slots.length} (positions 1..${slots.length})`);
console.log(`  slot_keys    : ${slots.map((s) => s.slot_key).join(', ')}`);
console.log('');
