#!/usr/bin/env node
// check-edition-assets.mjs — every media path the AI Top 5 sample edition NAMES must exist.
//
// ── Why this is separate from check-assets.mjs ────────────────────────────────────────────────
//
// That gate scans the source for literal `staticFile("...")` calls. This edition's audio is not
// written that way — it is `staticFile(TODAY.bed)`, `staticFile(TODAY.intro_vo)`,
// `staticFile(story.vo)`. The path lives in DATA, so a static scan of the code cannot see it, and
// the gate would report a clean tree while the render died.
//
// That is not a hypothetical gap. It is exactly the bug that shipped: data.ts named vo/intro.mp3,
// vo/1.mp3 … vo/signoff.mp3, public/vo/ did not exist, and the repository's headline composition
// could not be rendered by anyone who cloned it —
//
//     Error while downloading .../public/vo/intro.mp3: Received a status code of 404
//
// A check that only looks at code would have stayed green through all of it. This one reads the
// edition and checks the filesystem.
//
// ⚠️ `null` is a valid, checked state — it means "silent", and the composition renders no <Audio>
// for it. A MISSING FILE and a DELIBERATE NULL are different things, and conflating them is how
// "optional audio" came to mean "a 404 nobody noticed". Only a non-null path that does not resolve
// is a failure.
//
// Run: node scripts/check-edition-assets.mjs [--self-test]

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SELF_TEST = process.argv.includes("--self-test");
const DATA = join(ROOT, "src", "templates", "ai_top5", "data.ts");

// The edition is a TypeScript module, so rather than compile it, read the fields that carry paths.
// Deliberately literal: a path is only checkable if it is written down.
const text = readFileSync(DATA, "utf8");

/** Every `field: "value"` or `field: null` for the audio-bearing fields, in source order. */
function audioFields(src) {
  const out = [];
  const re = /^\s*(bed|intro_vo|signoff_vo|vo)\s*:\s*(?:"([^"]*)"|(null))\s*,/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    out.push({ field: m[1], value: m[2] ?? null });
  }
  return out;
}

const fields = SELF_TEST
  ? [...audioFields(text), { field: "vo", value: "vo/self-test-absent.mp3" }]
  : audioFields(text);

console.log(`edition: src/templates/ai_top5/data.ts`);
if (fields.length === 0) {
  console.log("  no audio fields found — the field names in this script are out of date");
  process.exit(1);
}

const missing = [];
let silent = 0;
let present = 0;
for (const f of fields) {
  if (f.value === null) {
    silent++;
    console.log(`  ${f.field.padEnd(11)} null            (silent by design)`);
    continue;
  }
  const onDisk = existsSync(join(ROOT, "public", f.value));
  if (onDisk) present++;
  else missing.push(`${f.field}: ${f.value}`);
  console.log(`  ${f.field.padEnd(11)} ${f.value.padEnd(15)} ${onDisk ? "present" : "MISSING"}`);
}

console.log(`\n  ${present} present, ${silent} deliberately silent, ${missing.length} missing`);

if (SELF_TEST) {
  const caught = missing.some((x) => x.includes("self-test-absent.mp3"));
  console.log(
    caught
      ? "\nSELF-TEST PASS — an edition naming a file that is not there is refused."
      : "\nSELF-TEST FAIL — the injected missing path went unnoticed. This check proves nothing."
  );
  process.exit(caught ? 0 : 1);
}

if (missing.length > 0) {
  console.log("\nThe edition names files that are not committed. A fresh clone cannot render it.");
  console.log("Either commit them, or set the field to null and design the section to work silent.");
  process.exit(1);
}
console.log("\nOK — every path this edition names resolves, and every null is a deliberate silence.");
