#!/usr/bin/env node
/**
 * capture-screens.mjs — capture-first step for product/UI videos.
 *
 * Screenshots the LIVE product UI into a JOB-SCOPED dir as full-frame PNGs, so a fluid build
 * composes REAL screens with GuidedZoom/ClickFlash (see src/templates/mygov_explainer) instead of
 * recreating the UI as cards. Two modes, picked per shot:
 *   - SIMPLE (no `actions`): system chromium --headless --screenshot (fast, no debug port).
 *   - INTERACTIVE (`actions` present): drive the page over CDP (chromium --remote-debugging-port +
 *     node's built-in WebSocket — no playwright/puppeteer). Needed for SPAs where features are
 *     reached by CLICKS, not URLs (e.g. yourgov: click the dial / start the tour) — so each beat
 *     gets a DISTINCT screen instead of the same home shell.
 *
 * Manifest:
 *   { "out_dir": "public/captures/<jobid>", "viewport": [1080,1920], "default_wait_ms": 4000,
 *     "shots": [
 *       { "name":"home", "url":"https://site", "desc":"home — map + dial", "wait_ms":6000 },
 *       { "name":"search", "url":"https://site", "desc":"search open",
 *         "actions": ["document.querySelector('[data-tour=\"search\"]')?.click()"], "wait_ms":3000 }
 *     ] }
 * Each `actions` entry is JS evaluated in the page (clicks, etc.), in order, with a short settle
 * between. Output: <out_dir>/<name>.png + captures-manifest.json (name/file/bytes/dims/url/description).
 * Exits non-zero if any shot fails.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';

const CHROMIUM = process.env.CHROMIUM_BIN || '/usr/bin/chromium';
const ROOT = process.env.APP_ROOT || '/app';
const DBG_PORT = parseInt(process.env.CDP_PORT || '9223', 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const a = argv.slice(2);
  if (a[0] && !a[0].startsWith('--')) return JSON.parse(readFileSync(a[0], 'utf8'));
  const get = (f) => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : undefined; };
  const url = get('--url'), name = get('--name');
  if (!url || !name) { console.error('Usage: capture-screens.mjs <manifest.json> | --url <u> --name <n> [--wait ms]'); process.exit(2); }
  return { shots: [{ name, url, wait_ms: get('--wait') ? parseInt(get('--wait'), 10) : undefined }] };
}

// ── one-shot (no interaction) ───────────────────────────────────────────────
function shotSimple(shot, outPath, vw, vh, wait) {
  const args = ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', `--window-size=${vw},${vh}`, `--virtual-time-budget=${wait}`,
    `--screenshot=${outPath}`, shot.url];
  spawnSync(CHROMIUM, args, { encoding: 'utf8', timeout: Math.max(30000, wait + 25000) });
}

// ── interactive (CDP over the debug port) ───────────────────────────────────
let _chrome = null;
async function ensureChrome(vw, vh) {
  if (_chrome) return;
  _chrome = spawn(CHROMIUM, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', `--window-size=${vw},${vh}`, `--remote-debugging-port=${DBG_PORT}`,
    'about:blank'], { detached: true, stdio: 'ignore' });
  _chrome.unref();
  // wait for the debug endpoint
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`http://127.0.0.1:${DBG_PORT}/json/version`); if (r.ok) return; } catch {}
    await sleep(500);
  }
  throw new Error('chromium debug port did not come up');
}
async function cdpSession() {
  const r = await fetch(`http://127.0.0.1:${DBG_PORT}/json/new?about:blank`, { method: 'PUT' })
    .catch(() => fetch(`http://127.0.0.1:${DBG_PORT}/json/new`, { method: 'PUT' }));
  const tgt = await r.json();
  const ws = new WebSocket(tgt.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  return { send, close: () => ws.close(), targetId: tgt.id };
}
async function shotInteractive(shot, outPath, wait) {
  const s = await cdpSession();
  try {
    await s.send('Page.enable');
    await s.send('Page.navigate', { url: shot.url });
    await sleep(wait);
    for (const act of (shot.actions || [])) {
      await s.send('Runtime.evaluate', { expression: act, awaitPromise: true, returnByValue: true });
      await sleep(shot.action_wait_ms ?? 1500);
    }
    const cap = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    if (cap?.result?.data) writeFileSync(outPath, Buffer.from(cap.result.data, 'base64'));
  } finally { s.close(); }
}

// ── main ─────────────────────────────────────────────────────────────────────
const m = parseArgs(process.argv);
const [vw, vh] = m.viewport || [1920, 1080];
const defWait = m.default_wait_ms ?? 4000;
const outDir = isAbsolute(m.out_dir || '') ? m.out_dir : join(ROOT, m.out_dir || 'public/captures');
mkdirSync(outDir, { recursive: true });
if (!Array.isArray(m.shots) || !m.shots.length) { console.error('No shots.'); process.exit(2); }

console.log(`[capture] chromium=${CHROMIUM} viewport=${vw}x${vh} out=${outDir} shots=${m.shots.length}`);
const results = []; let failures = 0;
const needsCdp = m.shots.some((sh) => Array.isArray(sh.actions) && sh.actions.length);
if (needsCdp) { try { await ensureChrome(vw, vh); } catch (e) { console.error('[capture] CDP launch failed:', e.message); } }

for (const shot of m.shots) {
  if (!shot.name || !shot.url) { console.error(`[capture] skip — missing name/url: ${JSON.stringify(shot)}`); failures++; continue; }
  const wait = shot.wait_ms ?? defWait;
  const outPath = join(outDir, `${shot.name}.png`);
  try {
    if (Array.isArray(shot.actions) && shot.actions.length) await shotInteractive(shot, outPath, wait);
    else shotSimple(shot, outPath, vw, vh, wait);
  } catch (e) { console.error(`[capture] ${shot.name} threw: ${e.message}`); }
  const ok = existsSync(outPath) && statSync(outPath).size > 1000;
  if (ok) {
    const bytes = statSync(outPath).size;
    console.log(`[capture] OK  ${shot.name}  (${bytes} bytes)  <- ${shot.url}${shot.actions ? ' [interactive]' : ''}`);
    results.push({ name: shot.name, file: `${shot.name}.png`, bytes, width: vw, height: vh, url: shot.url, description: shot.description || shot.desc || '' });
  } else { console.error(`[capture] FAIL ${shot.name} <- ${shot.url}`); failures++; }
}
if (_chrome) { try { process.kill(-_chrome.pid); } catch {} try { _chrome.kill(); } catch {} }

writeFileSync(join(outDir, 'captures-manifest.json'),
  JSON.stringify({ generated_for: 'capture-first', viewport: [vw, vh], out_dir: outDir, captures: results }, null, 2) + '\n', 'utf8');
console.log(`[capture] done — ${results.length}/${m.shots.length} captured to ${outDir}`);
if (failures > 0) { console.error(`[capture] ${failures} shot(s) failed.`); process.exit(1); }
