#!/usr/bin/env node
// run-claude-api.mjs — run claude with a PER-USER API key (API-billed, not the
// subscription seat login). For the headless `-p` cost tests and, later, the
// non-interactive render module.
//
// Usage: node scripts/run-claude-api.mjs <owner_email> [claude args...]
//   e.g. node scripts/run-claude-api.mjs user@example.com -p "say hi" --output-format json
//
// Keys live in /claude-accounts/api-keys.json (volume — NEVER in git):
//   { "user@example.com": { "api_key": "<key>", "seat": "user-1" }, ... }
//
// The API key is injected into the CHILD process env only — the seat's
// subscription OAuth login is untouched and persists (the key overrides it for
// this run; billing goes to the key's Anthropic account). Every run is logged
// to /app/video-records/<email>/api-runs.jsonl with duration, usage and cost.
import { spawnSync } from 'child_process';
import { appendFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const KEYS_PATH    = process.env.CLAUDE_API_KEYS_PATH || '/claude-accounts/api-keys.json';
const RECORDS_ROOT = process.env.VIDEO_RECORDS_PATH || '/app/video-records';

const [email, ...claudeArgs] = process.argv.slice(2);
if (!email || !email.includes('@') || claudeArgs.length === 0) {
  console.error('Usage: node scripts/run-claude-api.mjs <owner_email> [claude args...]');
  process.exit(1);
}

let keys;
try { keys = JSON.parse(readFileSync(KEYS_PATH, 'utf8')); }
catch (e) { console.error(`Cannot read ${KEYS_PATH}: ${e.message}`); process.exit(1); }

const entry = keys[email];
if (!entry?.api_key || entry.api_key.startsWith('PASTE')) {
  console.error(`No API key configured for ${email} in ${KEYS_PATH}`);
  process.exit(1);
}

const started = Date.now();
const res = spawnSync('claude', claudeArgs, {
  stdio: ['inherit', 'pipe', 'inherit'],
  encoding: 'utf-8',
  maxBuffer: 50 * 1024 * 1024,
  env: {
    ...process.env,
    ANTHROPIC_API_KEY: entry.api_key,
    CLAUDE_CONFIG_DIR: `/claude-accounts/${entry.seat || 'god'}`,
  },
});
process.stdout.write(res.stdout || '');

// Cost log — one line per run, in the user's record dir.
try {
  let usage = null, costUsd = null, sessionId = null;
  try {
    const out = JSON.parse(res.stdout);
    usage = out.usage ?? null;
    costUsd = out.total_cost_usd ?? null;
    sessionId = out.session_id ?? null;
  } catch { /* non-JSON output mode — duration still logged */ }
  const dir = join(RECORDS_ROOT, email);
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, 'api-runs.jsonl'), JSON.stringify({
    ts: new Date().toISOString(),
    email,
    seat: entry.seat || 'god',
    args: claudeArgs.map(a => (a.length > 200 ? a.slice(0, 200) + '…' : a)),
    exit: res.status,
    duration_seconds: Math.round((Date.now() - started) / 1000),
    session_id: sessionId,
    usage,
    cost_usd: costUsd,
  }) + '\n', 'utf8');
} catch (e) { console.error('[api-run] cost log failed:', e.message); }

process.exit(res.status ?? 1);
