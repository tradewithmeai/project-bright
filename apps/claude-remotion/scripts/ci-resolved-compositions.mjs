#!/usr/bin/env node
// ci-resolved-compositions.mjs — what Remotion actually RESOLVES must match what Root.tsx registers.
//
// check-compositions.mjs reads Root.tsx statically and is the fast contract. This one launches the
// real bundler and browser, which is slow, so it runs in CI rather than on every save.
//
// The two are not the same claim, and this project has seen them disagree. `calculateMetadata` runs
// while Remotion enumerates compositions, so ONE composition throwing there takes down the entire
// listing — `npx remotion compositions` exits with "Target closed" and reports nothing at all —
// while Root.tsx sits there looking perfectly healthy. A static check cannot see that; only asking
// Remotion can.
//
// Run: node scripts/ci-resolved-compositions.mjs

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// The contract lives in ONE place. Reading it out of the static check rather than restating it here
// means the two cannot drift apart, which is the whole point of having both.
const contract = readFileSync(join(ROOT, "scripts", "check-compositions.mjs"), "utf8");
const block = /const EXPECTED = \[([\s\S]*?)\];/.exec(contract);
if (!block) {
  console.error("could not read EXPECTED from scripts/check-compositions.mjs");
  process.exit(2);
}
const expected = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

console.log(`asking Remotion to resolve the compositions (expecting ${expected.length})...`);
let output;
try {
  output = execFileSync("npx", ["remotion", "compositions"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
    timeout: 10 * 60 * 1000,
  });
} catch (e) {
  console.error("`npx remotion compositions` failed. If it says Target closed, a composition's");
  console.error("calculateMetadata threw during enumeration — that takes down the whole listing.");
  console.error(String(e.stdout ?? "") + String(e.stderr ?? e.message));
  process.exit(1);
}

// Lines look like:  HelloWorld            30      1920x1080      150 (5.00 sec)
const resolved = output
  .split("\n")
  .map((l) => /^([A-Za-z][A-Za-z0-9_-]*)\s+\d+\s+\d+x\d+\s+\d+/.exec(l.trim()))
  .filter(Boolean)
  .map((m) => m[1]);

console.log(`resolved ${resolved.length}:`);
for (const id of resolved) console.log(`  ${expected.includes(id) ? "  " : "+ "}${id}`);

const missing = expected.filter((id) => !resolved.includes(id));
const extra = resolved.filter((id) => !expected.includes(id));

if (missing.length || extra.length) {
  if (missing.length) console.error(`\nFAIL registered but not resolved: ${missing.join(", ")}`);
  if (extra.length) console.error(`FAIL resolved but not in the contract: ${extra.join(", ")}`);
  process.exit(1);
}
console.log(`\nOK — Remotion resolves exactly the ${expected.length} the contract names.`);
