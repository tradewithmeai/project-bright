#!/usr/bin/env node
// check-compositions.mjs — the Studio's registered list is exactly the eleven it claims.
//
// The studio went from 55 compositions to 11 over six consolidation passes. Most of the 44 that
// went were not deliberate additions — they accumulated, and several could not render from a clean
// clone at all. This pins the result so the next accidental registration is a failing check rather
// than something noticed months later.
//
// ⚠️ It is a CONTRACT, not a counter. Changing the list here is the deliberate act of changing what
// the studio ships; if you add a composition and this fails, add it below on purpose.
//
// This reads src/Root.tsx statically, which takes milliseconds and needs no browser. That is a
// deliberate limit: it proves what is REGISTERED, not what Remotion resolves. `npx remotion
// compositions` is the runtime confirmation, and CI runs it — the two agreeing is the actual
// guarantee, and they have disagreed before (a composition whose calculateMetadata threw took the
// whole listing down while Root.tsx looked perfectly healthy).
//
// Run: npm run check:compositions

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The eleven, in registration order: start here, generic templates, curated examples. */
const EXPECTED = [
  // START HERE
  "HelloWorld",
  // GENERIC TEMPLATES
  "ProductWalkthrough",
  "FootagePromo",
  "SlotShort",
  "StepSequence",
  "VerticalAdvert",
  // CURATED EXAMPLES
  "CodeWalkthrough",
  "NarrativeArc",
  "BrandSting",
  "LogoShowcase",
  "AiTop5",
];

const SELF_TEST = process.argv.includes("--self-test");

const source = readFileSync(join(ROOT, "src", "Root.tsx"), "utf8");
const found = [...source.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);

// The self-test injects a registration that is not in the contract, so a green run proves this can
// actually fail rather than merely counting to eleven.
const actual = SELF_TEST ? [...found, "SelfTestStrayComposition"] : found;

const missing = EXPECTED.filter((id) => !actual.includes(id));
const unexpected = actual.filter((id) => !EXPECTED.includes(id));
const orderWrong =
  missing.length === 0 &&
  unexpected.length === 0 &&
  actual.join(",") !== EXPECTED.join(",");

console.log(`src/Root.tsx registers ${actual.length} composition(s)`);
for (const id of actual) {
  const mark = EXPECTED.includes(id) ? "  " : "+ ";
  console.log(`  ${mark}${id}`);
}

const problems = [];
if (missing.length) problems.push(`missing: ${missing.join(", ")}`);
if (unexpected.length) problems.push(`not in the contract: ${unexpected.join(", ")}`);
if (orderWrong) problems.push(`registration order differs from the contract`);

if (SELF_TEST) {
  const caught = unexpected.includes("SelfTestStrayComposition");
  console.log(
    caught
      ? "\nSELF-TEST PASS — a registration outside the contract is reported."
      : "\nSELF-TEST FAIL — the injected registration went unnoticed. This check proves nothing."
  );
  process.exit(caught ? 0 : 1);
}

if (problems.length) {
  console.log("");
  for (const p of problems) console.log(`  FAIL ${p}`);
  console.log("\nIf this change was intended, update EXPECTED in this file in the same commit.");
  process.exit(1);
}

console.log(`\nOK — exactly the ${EXPECTED.length} compositions the contract names, in order.`);
