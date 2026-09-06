#!/usr/bin/env node
/**
 * run-ai-top5-daily.mjs — Stage-1 headless orchestrator for the daily AI Top 5.
 *
 * Chains the proven producer scripts (the `produce-v2-request` sequence) with NO human agent and NO
 * LLM in the hot path — plain deterministic node, per "Design vs Replicate". It reads the kill-switch
 * config first; if automation is disabled it exits 0 without doing anything.
 *
 * HARD SAFETY RAIL: this STOPS at socials-studio POST_QUEUE `pending_review`. It runs
 * ingest -> gate -> make -> render hero -> make+render spoke -> record -> deliver both -> cost-log ->
 * ingest handoffs, and then STOPS. It NEVER publishes. Publishing stays 100% human.
 *
 * Flow (aborts + alerts on ANY non-zero step):
 *   1. node scripts/ingest-requests.mjs
 *   2. node scripts/check-ai-news.mjs            (news GATE — exit code honored, see gate_warn_policy)
 *   3. node scripts/make-ai-top5.mjs --ai-script --with-audio
 *   4. npx remotion render AiTop5 out/ai-top5_<date>_ed1.mp4
 *   5. node scripts/make-ai-top5-teaser.mjs
 *   6. npx remotion render AiTop5Teaser out/ai-top5-teaser_<date>.mp4
 *   7. node scripts/record-ai-top5.mjs --video out/ai-top5_<date>_ed1.mp4
 *   8. node scripts/publish-handoff.mjs (hero)  --output-id yt-hero --role hero
 *   9. node scripts/publish-handoff.mjs (spoke) --output-id ig-spoke --role spoke --promotes yt-hero --id-suffix ig-spoke
 *  10. node ../../studio/tools/token-report.mjs --label "..."   (per video: hero, then spoke)
 *  11. cd <socials-studio> && py ingest_handoffs.py   (routes media, refreshes POST_QUEUE pending_review) — STOP.
 *
 * Usage:
 *   node studio/tools/run-ai-top5-daily.mjs             # honors the kill-switch; real run if enabled
 *   node studio/tools/run-ai-top5-daily.mjs --dry-run   # prints the exact command chain; executes nothing (bypasses switch)
 *   node studio/tools/run-ai-top5-daily.mjs --date 2026-07-19
 *
 * Runtime working dirs matter (cwd does not persist between spawns) — each step declares its own cwd.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PB_ROOT = resolve(__dirname, '..', '..');                 // project-bright root
const APP_DIR = join(PB_ROOT, 'apps', 'claude-remotion');       // producer scripts live here
const SOCIALS_DIR = resolve(PB_ROOT, '..', 'socials-studio');   // sibling repo
const CONFIG_PATH = join(PB_ROOT, 'studio', 'automation', 'config.json');
const LOG_DIR = join(PB_ROOT, 'studio', 'logs', 'automation');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const DRY_RUN = argv.includes('--dry-run');
const DATE = arg('--date', new Date().toISOString().slice(0, 10));  // UTC yyyy-mm-dd

const HERO_MP4 = `out/ai-top5_${DATE}_ed1.mp4`;
const SPOKE_MP4 = `out/ai-top5-teaser_${DATE}.mp4`;
const REQUEST_ID = `ai-top5-${DATE}`;

// ---- logging -------------------------------------------------------------------------------------
mkdirSync(LOG_DIR, { recursive: true });
const RUN_TS = new Date().toISOString().replace(/[:.]/g, '-');
const LOG_FILE = join(LOG_DIR, `run-${DATE}-${RUN_TS}.log`);
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { appendFileSync(LOG_FILE, line + '\n'); } catch { /* best-effort */ }
}

// ---- alerting hook (Stage-1 v1: failure record file + loud log + non-zero exit) ------------------
function alertFailure(step, detail) {
  const alertPath = join(LOG_DIR, `FAILURE-${DATE}-${RUN_TS}.txt`);
  const body = [
    `AI Top 5 automation FAILED`,
    `date:   ${DATE}`,
    `step:   ${step}`,
    `detail: ${detail}`,
    `log:    ${LOG_FILE}`,
    `time:   ${new Date().toISOString()}`,
    ``,
    `No edition was delivered. Nothing was published (Stage 1 never publishes). Investigate, then`,
    `re-run: node studio/tools/run-ai-top5-daily.mjs --date ${DATE}`,
  ].join('\n');
  try { writeFileSync(alertPath, body + '\n'); } catch { /* best-effort */ }
  log(`!! ALERT written -> ${alertPath}`);
  // NOTE: socials-studio has report.write_telegram_summary(snap) but it needs a social snapshot, not a
  // generic notify(text) — there is no plain notify entry point today. Wiring a telegram/notify push is
  // a follow-up (see completion report "unknowns"). For v1, the failure record file + non-zero exit is
  // the alert.
}

// ---- config / kill-switch ------------------------------------------------------------------------
function readConfig() {
  if (!existsSync(CONFIG_PATH)) return { enabled: false, _missing: true };
  try { return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')); }
  catch (e) { log(`config parse error (${e.message}) — treating as DISABLED`); return { enabled: false }; }
}

// ---- the command chain (single source of truth for real-run AND dry-run) -------------------------
function buildSteps() {
  return [
    // Hop 1 — socials-studio commissions today's request (idempotent: skips if it already exists,
    // e.g. a human created it). Wiring this in makes the scheduler run the WHOLE chain, not just
    // the producer half. Fatal if it can't emit — don't produce an un-commissioned edition.
    { label: 'emit request (socials)', cmd: 'py',   args: ['emit_daily_ai_top5.py', '--date', DATE], cwd: SOCIALS_DIR },
    { label: 'ingest requests',       cmd: 'node', args: ['scripts/ingest-requests.mjs'], cwd: APP_DIR },
    { label: 'news gate',             cmd: 'node', args: ['scripts/check-ai-news.mjs'], cwd: APP_DIR, gate: true },
    { label: 'make edition (script+VO)', cmd: 'node', args: ['scripts/make-ai-top5.mjs', '--ai-script', '--with-audio'], cwd: APP_DIR },
    { label: 'render hero',           cmd: 'npx',  args: ['remotion', 'render', 'AiTop5', HERO_MP4], cwd: APP_DIR },
    { label: 'make spoke (teaser)',   cmd: 'node', args: ['scripts/make-ai-top5-teaser.mjs'], cwd: APP_DIR },
    { label: 'render spoke',          cmd: 'npx',  args: ['remotion', 'render', 'AiTop5Teaser', SPOKE_MP4], cwd: APP_DIR },
    { label: 'record video',          cmd: 'node', args: ['scripts/record-ai-top5.mjs', '--video', HERO_MP4], cwd: APP_DIR },
    { label: 'deliver hero',          cmd: 'node', args: ['scripts/publish-handoff.mjs', '--video', HERO_MP4, '--request-id', REQUEST_ID, '--output-id', 'yt-hero', '--role', 'hero'], cwd: APP_DIR },
    { label: 'deliver spoke',         cmd: 'node', args: ['scripts/publish-handoff.mjs', '--video', SPOKE_MP4, '--request-id', REQUEST_ID, '--output-id', 'ig-spoke', '--role', 'spoke', '--promotes', 'yt-hero', '--id-suffix', 'ig-spoke'], cwd: APP_DIR },
    { label: 'cost-log hero',         cmd: 'node', args: ['../../studio/tools/token-report.mjs', '--label', `ai-top5 ${DATE} hero (yt-hero)`], cwd: APP_DIR },
    { label: 'cost-log spoke',        cmd: 'node', args: ['../../studio/tools/token-report.mjs', '--label', `ai-top5 ${DATE} spoke (ig-spoke)`], cwd: APP_DIR },
    { label: 'ingest handoffs (STOP at pending_review)', cmd: 'py', args: ['ingest_handoffs.py'], cwd: SOCIALS_DIR },
  ];
}

function fmt(step) {
  const q = (a) => (/\s/.test(a) ? JSON.stringify(a) : a);
  return `(cd ${step.cwd} && ${step.cmd} ${step.args.map(q).join(' ')})`;
}

// ---- run one step; returns {code, stdout} --------------------------------------------------------
function runStep(step, { capture = false } = {}) {
  log(`>> ${step.label}: ${fmt(step)}`);
  const r = spawnSync(step.cmd, step.args, {
    cwd: step.cwd,
    stdio: capture ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    shell: process.platform === 'win32',   // resolve node/npx/py .cmd shims on Windows
    encoding: 'utf8',
  });
  if (capture) {
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
  }
  const code = r.status == null ? 1 : r.status;
  return { code, stdout: (r.stdout || '') + (r.stderr || '') };
}

// ---- gate policy: honor check-ai-news exit codes -------------------------------------------------
// 0 = PASS (proceed). 1 = FAIL (abort). 2 = WARN-only: apply gate_warn_policy.
//   abort_on_stale_proceed_on_cosmetic -> abort if the warnings include a stale/old-date freshness
//   warning; proceed (log) on cosmetic over-cap warnings only.
function evaluateGate(code, output, policy) {
  if (code === 0) return { proceed: true, reason: 'PASS' };
  if (code === 1) return { proceed: false, reason: 'FAIL (hard problems in feed)' };
  if (code === 2) {
    if (policy === 'proceed_on_all') return { proceed: true, reason: 'WARN (policy: proceed_on_all)' };
    if (policy === 'abort_on_all') return { proceed: false, reason: 'WARN (policy: abort_on_all)' };
    // default: abort_on_stale_proceed_on_cosmetic
    const stale = /days old|stale|data date|story count is/i.test(output);
    return stale
      ? { proceed: false, reason: 'WARN incl. stale/freshness — abort per policy' }
      : { proceed: true, reason: 'WARN cosmetic only (over-cap) — proceed per policy' };
  }
  return { proceed: false, reason: `unexpected gate exit ${code}` };
}

// ---- main ----------------------------------------------------------------------------------------
function main() {
  const steps = buildSteps();

  if (DRY_RUN) {
    log(`DRY RUN — date=${DATE}, request_id=${REQUEST_ID}. The command chain (NOTHING executed):`);
    steps.forEach((s, i) => log(`  ${String(i + 1).padStart(2, '0')}. ${s.label}${s.gate ? '  [GATE: honor exit code]' : ''}\n        ${fmt(s)}`));
    log(`Chain STOPS after "ingest handoffs" at POST_QUEUE pending_review. No publish step exists.`);
    log(`Kill-switch is bypassed by --dry-run for wiring validation only; a real run checks config.enabled first.`);
    return 0;
  }

  const cfg = readConfig();
  if (cfg.enabled !== true) {
    log(`automation disabled (config.enabled=${JSON.stringify(cfg.enabled)}${cfg._missing ? ', config file missing' : ''}) — exiting 0 without doing anything.`);
    log(`To enable: set "enabled": true in ${CONFIG_PATH}`);
    return 0;
  }

  log(`=== AI Top 5 daily run start === date=${DATE} request_id=${REQUEST_ID}`);
  log(`gate_warn_policy=${cfg.gate_warn_policy || 'abort_on_stale_proceed_on_cosmetic'}  cost_note=${cfg.cost_note || '(none)'}`);

  for (const step of steps) {
    if (step.gate) {
      const { code, stdout } = runStep(step, { capture: true });
      const verdict = evaluateGate(code, stdout, cfg.gate_warn_policy || 'abort_on_stale_proceed_on_cosmetic');
      log(`news gate exit=${code} -> ${verdict.reason}`);
      if (!verdict.proceed) {
        alertFailure(step.label, `news gate blocked the run: ${verdict.reason}`);
        log(`=== ABORTED at news gate === no edition produced, nothing published.`);
        return 1;
      }
      // Independent staleness guard: check-ai-news only WARNS when the feed is >1 day old, so a feed
      // that's exactly one day stale (the 06:30 refresh silently failed) sails through as exit 0. A
      // human eyeballs the printed date; automation can't. Refuse to produce unless the live feed IS
      // today's — this also correctly blocks nonsensical --date backfill against the live feed.
      const fm = stdout.match(/date=(\d{4}-\d{2}-\d{2})/);
      const feedDate = fm ? fm[1] : null;
      if (feedDate !== DATE) {
        alertFailure(step.label, `feed date ${feedDate ?? '(unparsed)'} != run date ${DATE} — stale/unreleased feed; refusing to produce a mis-dated edition`);
        log(`=== ABORTED: feed date ${feedDate ?? '(unparsed)'} != run date ${DATE} === nothing produced.`);
        return 1;
      }
      log(`feed date ${feedDate} matches run date ${DATE} — proceeding.`);
      continue;
    }
    const { code } = runStep(step);
    if (code !== 0) {
      alertFailure(step.label, `step exited ${code}`);
      log(`=== ABORTED at "${step.label}" (exit ${code}) === nothing published.`);
      return 1;
    }
  }

  log(`=== run complete === edition ${REQUEST_ID} delivered to socials-studio POST_QUEUE as pending_review.`);
  log(`STOP: a human reviews and taps publish. Stage 1 never publishes.`);
  return 0;
}

process.exit(main());
