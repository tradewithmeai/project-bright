#!/usr/bin/env node
/**
 * token-report.mjs — Claude Code token/cost accounting for a run (studio tool).
 *
 * Reads the current session transcript (the Claude Code JSONL), sums input/output/cache tokens per
 * model, estimates USD cost, and (with --label) appends a per-run entry to a run-costs log — with the
 * DELTA since the last logged entry, so each build/edit/re-render is recorded as its own cost.
 *
 * This is the AGENT-SIDE cost (Claude tokens). Paid provider APIs (ElevenLabs, OpenAI) are logged
 * separately in studio/logs/api-usage.log. Both together = the full cost metadata for a video run.
 *
 * Usage:
 *   node studio/tools/token-report.mjs                          # print cumulative + delta since last log
 *   node studio/tools/token-report.mjs --label "yourgov-story build (2 formats)"   # + append a run entry
 *   node studio/tools/token-report.mjs --session <path.jsonl>   # explicit transcript
 */
import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };

// Per-1M-token USD rates. cacheRead ≈ 0.1× input, cacheWrite ≈ 1.25× input (standard Anthropic ratios).
const PRICING = {
  'claude-opus-4-8': { in: 5, out: 25, cr: 0.5, cw: 6.25 },
  'claude-opus-4-7': { in: 5, out: 25, cr: 0.5, cw: 6.25 },
  'claude-opus-4-6': { in: 5, out: 25, cr: 0.5, cw: 6.25 },
  'claude-fable-5': { in: 10, out: 50, cr: 1.0, cw: 12.5 },
  'claude-mythos-5': { in: 10, out: 50, cr: 1.0, cw: 12.5 },
  'claude-sonnet-4-6': { in: 3, out: 15, cr: 0.3, cw: 3.75 },
  'claude-haiku-4-5': { in: 1, out: 5, cr: 0.1, cw: 1.25 },
};
const rate = (model) => PRICING[model] || null; // unknown/synthetic → not billed

const HOME = process.env.USERPROFILE || process.env.HOME || '';
// Claude Code keys its session directory to the checkout's absolute path, with separators
// flattened to dashes — so this is derived from where the repo actually sits rather than
// hardcoded to one machine's layout.
const REPO_ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), '..', '..'));
// Each separator becomes its own dash — "D:\Documents\x" -> "D--Documents-x" — so runs are
// NOT collapsed. Collapsing them yields "D-Documents-x", which matches no real directory.
const SESSION_SLUG = REPO_ROOT.replace(/[\\/:]/g, '-');
const DEFAULT_SESSION_DIR = join(HOME, '.claude', 'projects', SESSION_SLUG);

function newestJsonl(dir) {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => join(dir, f));
  if (!files.length) return null;
  return files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

const sessionPath = arg('--session', newestJsonl(DEFAULT_SESSION_DIR));
if (!sessionPath || !existsSync(sessionPath)) {
  console.error('[token-report] no session transcript found. Pass --session <path.jsonl>.');
  process.exit(2);
}

// Sum tokens per model across every assistant message that carries usage.
const byModel = {};
let totalCost = 0;
const src = readFileSync(sessionPath, 'utf8').split('\n');
for (const line of src) {
  if (!line.includes('"usage"')) continue;
  let obj;
  try { obj = JSON.parse(line); } catch { continue; }
  const msg = obj.message || obj;
  const u = msg && msg.usage;
  const model = msg && msg.model;
  if (!u || !model) continue;
  const m = (byModel[model] ||= { in: 0, out: 0, cr: 0, cw: 0, cost: 0 });
  const i = u.input_tokens || 0, o = u.output_tokens || 0;
  const cr = u.cache_read_input_tokens || 0, cw = u.cache_creation_input_tokens || 0;
  m.in += i; m.out += o; m.cr += cr; m.cw += cw;
  const r = rate(model);
  if (r) {
    const c = (i * r.in + o * r.out + cr * r.cr + cw * r.cw) / 1e6;
    m.cost += c; totalCost += c;
  }
}

const sum = (k) => Object.values(byModel).reduce((n, m) => n + m[k], 0);
const cumulative = {
  input: sum('in'), output: sum('out'), cache_read: sum('cr'), cache_write: sum('cw'),
  total_tokens: sum('in') + sum('out') + sum('cr') + sum('cw'),
  cost_usd: Math.round(totalCost * 10000) / 10000,
};

// Delta since the last logged token entry. Records into the tracked, committed run roll-up
// (studio/logs/runs.jsonl) so agent-token cost is durable metadata alongside the paid-API entries.
const LOG = arg('--log', join(process.cwd(), 'studio', 'logs', 'runs.jsonl'));
let prev = null;
if (existsSync(LOG)) {
  const lines = readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean);
  for (let k = lines.length - 1; k >= 0; k--) {
    try { const e = JSON.parse(lines[k]); if (e.cc_cumulative) { prev = e.cc_cumulative; break; } } catch { /* skip */ }
  }
}
const delta = prev
  ? {
      input: cumulative.input - prev.input, output: cumulative.output - prev.output,
      cache_read: cumulative.cache_read - prev.cache_read, cache_write: cumulative.cache_write - prev.cache_write,
      total_tokens: cumulative.total_tokens - prev.total_tokens,
      cost_usd: Math.round((cumulative.cost_usd - prev.cost_usd) * 10000) / 10000,
    }
  : null;

const fmt = (n) => n.toLocaleString('en-US');
console.log(`[token-report] session: ${sessionPath}`);
for (const [model, m] of Object.entries(byModel)) {
  console.log(`  ${model.padEnd(20)} in ${fmt(m.in)}  out ${fmt(m.out)}  cacheR ${fmt(m.cr)}  cacheW ${fmt(m.cw)}  ~$${m.cost.toFixed(4)}`);
}
console.log(`  CUMULATIVE total ${fmt(cumulative.total_tokens)} tokens  ~$${cumulative.cost_usd.toFixed(4)}`);
if (delta) console.log(`  DELTA this run   ${fmt(delta.total_tokens)} tokens  ~$${delta.cost_usd.toFixed(4)}  (out ${fmt(delta.output)})`);

const label = arg('--label', '');
if (label) {
  mkdirSync(dirname(LOG), { recursive: true });
  // Matches the runs.jsonl schema (input_tokens/output_tokens/cost_usd = THIS run = the delta when
  // available, else the cumulative baseline), plus cc_cumulative for the next delta and a breakdown.
  const run = delta || cumulative;
  const entry = {
    ts: new Date().toISOString().slice(0, 19) + 'Z',
    job: 'claude-code',
    tool: 'token-report.mjs',
    model: Object.keys(byModel).filter((m) => rate(m)).join('+') || 'claude',
    input_tokens: run.input,
    output_tokens: run.output,
    cache_read_tokens: run.cache_read,
    cache_write_tokens: run.cache_write,
    cost_usd: run.cost_usd,
    note: label + (delta ? '' : ' [BASELINE — cumulative session-to-date, not a single run]'),
    cc_cumulative: cumulative,
  };
  appendFileSync(LOG, JSON.stringify(entry) + '\n');
  console.log(`[token-report] ✔ logged run "${label}" (${delta ? 'delta' : 'baseline'}) → ${LOG}`);
}
