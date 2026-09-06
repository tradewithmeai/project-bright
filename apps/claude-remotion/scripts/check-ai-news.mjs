#!/usr/bin/env node
/**
 * check-ai-news.mjs — validate the AI Top 5 facts API before a pipeline run.
 *
 * The upstream gate for the daily AI Top 5 pipeline: confirm the facts API is reachable, fresh,
 * complete, and well-formed BEFORE spending on script/TTS/render. Prints a per-story table + a
 * checks summary. Exits 0 on PASS, 1 on FAIL (hard problems), 2 on WARN-only.
 *
 * Usage: node check-ai-news.mjs [--url https://solvx.uk/api/ai-news.json] [--json out.json]
 *
 * Caps mirror the on-screen budgets the ai_top5 template can display (tokens.ts):
 *   headline <= 40 chars, each beat <= 42, takeaway <= 56.  Over-cap = WARN (truncates on screen).
 */
const argUrl = (() => { const i = process.argv.indexOf('--url'); return i >= 0 ? process.argv[i + 1] : null; })();
const outJson = (() => { const i = process.argv.indexOf('--json'); return i >= 0 ? process.argv[i + 1] : null; })();
const URL = argUrl || 'https://solvx.uk/api/ai-news.json';

const CAP = { headline: 40, beat: 42, takeaway: 56 };
const REQUIRED = ['rank', 'headline', 'beats', 'takeaway', 'summary', 'source', 'category'];

const fails = [];
const warns = [];
const fail = (m) => fails.push(m);
const warn = (m) => warns.push(m);

let res;
try {
  res = await fetch(URL, { headers: { 'Accept': 'application/json' } });
} catch (e) { console.error(`[check] UNREACHABLE: ${URL} — ${e.message}`); process.exit(1); }
if (!res.ok) { console.error(`[check] HTTP ${res.status} from ${URL}`); process.exit(1); }

let d;
try { d = await res.json(); } catch (e) { console.error(`[check] invalid JSON — ${e.message}`); process.exit(1); }

const stories = Array.isArray(d) ? d : (d.stories || d.items || d.data || []);
const date = d.date || '(none)';
const gen = d.generatedAt || d.generated_at || '(none)';
const count = stories.length;

// Envelope checks
if (count === 0) { console.error('[check] no stories in payload'); process.exit(1); }
if (count !== 5) warn(`story count is ${count} (AI Top 5 expects 5)`);
if (d.date) {
  const ageDays = Math.floor((Date.now() - new Date(d.date + 'T00:00:00Z').getTime()) / 86400000);
  if (Number.isFinite(ageDays) && ageDays > 1) warn(`data date ${date} is ${ageDays} days old`);
}

// Per-story checks
const rows = [];
const cats = [];
for (const s of stories) {
  const rank = s.rank ?? s.n ?? '?';
  for (const f of REQUIRED) {
    const v = s[f];
    const empty = v == null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
    if (empty) fail(`#${rank}: missing/empty "${f}"`);
  }
  const beats = Array.isArray(s.beats) ? s.beats.filter(Boolean) : [];
  if (beats.length < 2) fail(`#${rank}: needs >=2 beats (has ${beats.length})`);
  const hl = (s.headline || '').length, tk = (s.takeaway || '').length;
  if (hl > CAP.headline) warn(`#${rank}: headline ${hl}c > ${CAP.headline} (will truncate on screen)`);
  if (tk > CAP.takeaway) warn(`#${rank}: takeaway ${tk}c > ${CAP.takeaway}`);
  beats.forEach((b, i) => { if (b.length > CAP.beat) warn(`#${rank}: beat ${i + 1} ${b.length}c > ${CAP.beat}`); });
  const cat = (s.category || '').trim();
  cats.push(cat.toLowerCase());
  rows.push({ rank, category: cat || '(none)', hl, beats: beats.length, tk, headline: s.headline || '' });
}

// Category-fix check: the known bug was every story = "news-analysis".
const uniqCats = new Set(cats.filter(Boolean));
if (cats.every((c) => c === 'news-analysis')) fail('every category is "news-analysis" — the category fix is NOT live');
else if (uniqCats.size === 1) warn(`all ${count} stories share one category "${[...uniqCats][0]}"`);

// Report
console.log(`\n  AI NEWS API CHECK — ${URL}`);
console.log(`  date=${date}  generatedAt=${gen}  stories=${count}  distinct categories=${uniqCats.size}`);
console.log('  ─────────────────────────────────────────────────────────────');
rows.sort((a, b) => a.rank - b.rank);
for (const r of rows) {
  console.log(`  #${r.rank}  ${String(r.category).padEnd(14)} hl=${String(r.hl).padStart(2)}c beats=${r.beats} tk=${String(r.tk).padStart(2)}c  ${r.headline}`);
}
console.log('  ─────────────────────────────────────────────────────────────');
if (fails.length) { console.log('  FAILS:'); fails.forEach((m) => console.log(`    ✗ ${m}`)); }
if (warns.length) { console.log('  WARNINGS:'); warns.forEach((m) => console.log(`    ! ${m}`)); }
if (!fails.length && !warns.length) console.log('  ✓ all checks passed — API is pipeline-ready.');
else if (!fails.length) console.log(`  ✓ no hard failures (${warns.length} warning${warns.length > 1 ? 's' : ''}).`);
else console.log(`  ✗ ${fails.length} failure${fails.length > 1 ? 's' : ''} — do NOT run the pipeline until fixed.`);

if (outJson) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(outJson, JSON.stringify({ url: URL, date, generatedAt: gen, count, distinctCategories: uniqCats.size, fails, warns, stories: rows }, null, 2));
  console.log(`  wrote ${outJson}`);
}

process.exit(fails.length ? 1 : warns.length ? 2 : 0);
