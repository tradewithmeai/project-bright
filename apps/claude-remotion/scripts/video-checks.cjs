#!/usr/bin/env node
// Deterministic video check suite — the OBJECTIVE half of the judge-video (Lock 1).
// These have a right answer, so they are lint, not AI. Run before any taste judgement.
//   node scripts/video-checks.cjs [srcDir]
// Exit 0 = all PASS; exit 1 = at least one FAIL. Prints a PASS/FAIL table with evidence.
//
// Checks:
//   1. determinism      — no Math.random / Date.now / new Date / performance.now in render code
//   2. css-animation    — no CSS `transition:`/`animation:` props, @keyframes, or Tailwind animate-* (don't render in Remotion)
//   3. caption-floor     — every caption window >= max(1.8s, chars*0.07s)
//   4. caption-overlap   — no two same-style captions overlap in the same on-screen slot (per section file)

const fs = require("fs");
const path = require("path");

const SRC = process.argv[2] || path.join(__dirname, "..", "src");
const FLOOR_MIN = 1.8;
const FLOOR_PER_CHAR = 0.07;

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}

// Strip line/block comments and string literals so greps don't false-positive on prose.
function stripCommentsAndStrings(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")           // block comments
    .replace(/\/\/[^\n]*/g, " ")                  // line comments
    .replace(/`(?:\\.|[^`\\])*`/g, '""')          // template strings
    .replace(/"(?:\\.|[^"\\])*"/g, '""')          // double-quoted
    .replace(/'(?:\\.|[^'\\])*'/g, '""');         // single-quoted
}

function lineOf(src, idx) {
  return src.slice(0, idx).split("\n").length;
}

const files = walk(SRC);
const findings = []; // {check, severity, file, line, detail}

// ── Check 1 + 2: determinism + css-animation (on comment/string-stripped code) ──
const DETERMINISM = [
  { re: /\bMath\.random\s*\(/g, name: "Math.random()" },
  { re: /\bDate\.now\s*\(/g, name: "Date.now()" },
  { re: /\bnew\s+Date\s*\(/g, name: "new Date()" },
  { re: /\bperformance\.now\s*\(/g, name: "performance.now()" },
];
const CSS_ANIM = [
  { re: /\btransition\s*:/g, name: "CSS transition:" },
  { re: /\banimation\s*:/g, name: "CSS animation:" },
  { re: /\banimationName\s*:/g, name: "animationName" },
  { re: /@keyframes\b/g, name: "@keyframes" },
  { re: /className\s*=\s*\{?["'`][^"'`]*\banimate-/g, name: "Tailwind animate-*" },
];

for (const f of files) {
  const raw = fs.readFileSync(f, "utf8");
  const code = stripCommentsAndStrings(raw);
  for (const { re, name } of DETERMINISM) {
    re.lastIndex = 0; let m;
    while ((m = re.exec(code))) findings.push({ check: "determinism", severity: "FAIL", file: f, line: lineOf(code, m.index), detail: `${name} in render code (breaks Remotion's out-of-order rendering — use a seeded hash)` });
  }
  for (const { re, name } of CSS_ANIM) {
    re.lastIndex = 0; let m;
    while ((m = re.exec(code))) findings.push({ check: "css-animation", severity: "FAIL", file: f, line: lineOf(code, m.index), detail: `${name} does not render in Remotion (drive motion from useCurrentFrame+interpolate)` });
  }
}

// ── Check 3 + 4: caption floor + same-style overlap, per file ──
// Extract caption objects of the shape { in_s: N, out_s: N, text: "...", style: "..." }
// LIMITATION (by design): TEXT_RE matches only LITERAL quoted strings. A dynamic
// caption (text: story.cue, text: beat, templates) does not match → text="" →
// floor = max(1.8,0) = 1.8s → always passes. Data-driven templates MUST verify
// reading floors by hand against the longest runtime value. A green run here does
// NOT clear dynamic captions. (See silent-caption-system SKILL.md Phase 4.)
const CAP_RE = /\{[^{}]*?\bin_s\s*:\s*([\d.]+)[^{}]*?\bout_s\s*:\s*([\d.]+)[^{}]*?\}/g;
const TEXT_RE = /\btext\s*:\s*"((?:\\.|[^"\\])*)"/;
const STYLE_RE = /\bstyle\s*:\s*"([a-zA-Z]+)"/;

for (const f of files) {
  const raw = fs.readFileSync(f, "utf8");
  const caps = [];
  let m;
  CAP_RE.lastIndex = 0;
  while ((m = CAP_RE.exec(raw))) {
    const block = m[0];
    const in_s = parseFloat(m[1]);
    const out_s = parseFloat(m[2]);
    const tm = block.match(TEXT_RE);
    const sm = block.match(STYLE_RE);
    if (!sm) continue; // not a caption line
    const text = tm ? tm[1] : "";
    caps.push({ in_s, out_s, text, style: sm[1], line: lineOf(raw, m.index) });
  }
  if (!caps.length) continue;

  // floor
  for (const c of caps) {
    const floor = Math.max(FLOOR_MIN, c.text.length * FLOOR_PER_CHAR);
    const win = +(c.out_s - c.in_s).toFixed(3);
    if (win + 1e-9 < floor) {
      findings.push({ check: "caption-floor", severity: "FAIL", file: f, line: c.line, detail: `"${c.text.slice(0, 40)}" window ${win}s < reading floor ${floor.toFixed(2)}s (${c.text.length} chars)` });
    }
  }
  // same-style overlap (same on-screen slot). title & kicker both centre → treated as one slot.
  const slot = (s) => (s === "kicker" ? "title" : s);
  const bySlot = {};
  for (const c of caps) (bySlot[slot(c.style)] ??= []).push(c);
  for (const [s, list] of Object.entries(bySlot)) {
    list.sort((a, b) => a.in_s - b.in_s);
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1], cur = list[i];
      if (cur.in_s < prev.out_s - 1e-9) {
        findings.push({ check: "caption-overlap", severity: "FAIL", file: f, line: cur.line, detail: `${s} captions overlap in the same slot: "${prev.text.slice(0, 24)}" (${prev.in_s}-${prev.out_s}) vs "${cur.text.slice(0, 24)}" (${cur.in_s}-${cur.out_s})` });
      }
    }
  }
}

// ── Report ──
const checks = ["determinism", "css-animation", "caption-floor", "caption-overlap"];
const rel = (p) => path.relative(path.join(SRC, ".."), p).replace(/\\/g, "/");
console.log(`\nvideo-checks — ${files.length} files under ${rel(SRC)}\n`);
let failed = 0;
for (const ch of checks) {
  const hits = findings.filter((x) => x.check === ch);
  if (!hits.length) { console.log(`  PASS  ${ch}`); continue; }
  failed += hits.length;
  console.log(`  FAIL  ${ch}  (${hits.length})`);
  for (const h of hits) console.log(`         ${rel(h.file)}:${h.line} — ${h.detail}`);
}
console.log("");
if (failed) { console.log(`RESULT: FAIL — ${failed} issue(s)\n`); process.exit(1); }
console.log("RESULT: PASS — all deterministic checks clean\n"); process.exit(0);
