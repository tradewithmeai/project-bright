#!/usr/bin/env node
/**
 * preflight-render.mjs — refuse to start a render the machine cannot finish.
 *
 *   node scripts/preflight-render.mjs            # exits 0 if it is safe to render
 *   node scripts/preflight-render.mjs --json
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-07-29 an AI Top 5 render failed six times over ~16 minutes and produced six
 * DIFFERENT errors, none of which named the real problem:
 *
 *   1. webpack        RangeError: Array buffer allocation failed
 *   2. webpack        identical, after raising --max-old-space-size to 12 GB
 *   3. Chrome         ERR_INSUFFICIENT_RESOURCES loading a 1.9 MB png at frame ~196
 *   4. Chrome         EPIPE — renderer died at frame 148
 *   5. Chrome         EPIPE — renderer died at frame 149
 *   6. x264           malloc of size 7088704 failed
 *
 * Every one was the same cause: the system had **0.9 GB of free commit** left, because a
 * browser was holding 51.8 GB across 31 processes and C: had 4.8 GB free so the pagefile
 * could not grow. Physical RAM was never short — 9.5 GB free throughout — which is exactly
 * why lowering --concurrency did not help and why x264 could not obtain 7 MB.
 *
 * The diagnosis cost far more than the render. Worse, it sent the operator chasing the era-
 * device PNGs and a supposedly corrupt webpack cache, both innocent. Then the machine crashed.
 *
 * So this checks the one number that actually predicts the failure — FREE COMMIT, not free
 * RAM — and says so in one line before anything expensive starts.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 * It does not kill anything. A browser holding 50 GB is somebody's working session, and
 * whether to close it is the operator's call, not a script's. It names the top consumers and
 * stops.
 */
import { execFileSync } from 'node:child_process';
import { statfsSync } from 'node:fs';

const JSON_OUT = process.argv.includes('--json');
const log = (...a) => { if (!JSON_OUT) console.log(...a); };

// A 1080p Remotion render peaks around 6-8 GB of commit across the bundler, the Chrome
// renderer processes and the x264 encoder. 8 GB is the floor below which it reliably dies
// somewhere unhelpful; 12 GB leaves room for the browser to grow mid-render.
const NEED_GB = 8;
const WANT_GB = 12;
const NEED_DISK_GB = 5;     // pagefile headroom on the system drive

const ps = (script) => {
  try {
    return execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script],
                        { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

const out = { platform: process.platform, ok: true, blockers: [], warnings: [] };

if (process.platform !== 'win32') {
  // Only the Windows commit model is characterised here; elsewhere just report and pass.
  log('  preflight: non-Windows — commit check skipped');
  process.exit(0);
}

const nums = ps(`
$l=(Get-Counter '\\Memory\\Commit Limit').CounterSamples[0].CookedValue
$c=(Get-Counter '\\Memory\\Committed Bytes').CounterSamples[0].CookedValue
$p=(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory*1KB
$d=(Get-PSDrive C).Free
"{0};{1};{2};{3}" -f $l,$c,$p,$d
`).split(';').map(Number);

if (nums.length !== 4 || nums.some(Number.isNaN)) {
  log('  preflight: could not read memory counters — proceeding without the check');
  process.exit(0);
}
const [limit, committed, physFree, cFree] = nums;
const freeCommitGB = (limit - committed) / 2 ** 30;
const physFreeGB = physFree / 2 ** 30;
const cFreeGB = cFree / 2 ** 30;

Object.assign(out, {
  free_commit_gb: +freeCommitGB.toFixed(1),
  physical_free_gb: +physFreeGB.toFixed(1),
  c_free_gb: +cFreeGB.toFixed(1),
  need_gb: NEED_GB,
});

log('  render preflight');
log(`    free commit      : ${freeCommitGB.toFixed(1)} GB   (need ${NEED_GB}, want ${WANT_GB})`);
log(`    physical free    : ${physFreeGB.toFixed(1)} GB   (not the binding constraint)`);
log(`    C: free          : ${cFreeGB.toFixed(1)} GB   (pagefile headroom)`);

if (freeCommitGB < NEED_GB) {
  out.ok = false;
  out.blockers.push(`only ${freeCommitGB.toFixed(1)} GB of free commit, need ${NEED_GB} GB`);
} else if (freeCommitGB < WANT_GB) {
  out.warnings.push(`${freeCommitGB.toFixed(1)} GB free commit is thin — a render may still die if something grows`);
}
if (cFreeGB < NEED_DISK_GB) {
  out.ok = false;
  out.blockers.push(`C: has ${cFreeGB.toFixed(1)} GB free, so the pagefile cannot grow to absorb demand`);
}

if (!out.ok) {
  // Name the culprits. This is the information that was missing for 16 minutes.
  const hogs = ps(`Get-Process | Sort-Object PrivateMemorySize64 -Descending |
    Select-Object -First 5 | ForEach-Object { "{0} {1:N1}" -f $_.ProcessName,($_.PrivateMemorySize64/1GB) }`);
  const grouped = ps(`Get-Process | Group-Object ProcessName |
    Sort-Object { ($_.Group | Measure-Object PrivateMemorySize64 -Sum).Sum } -Descending |
    Select-Object -First 3 | ForEach-Object {
      "{0} x{1} = {2:N1} GB" -f $_.Name,$_.Count,(($_.Group|Measure-Object PrivateMemorySize64 -Sum).Sum/1GB) }`);
  out.top_consumers = grouped.split('\n').map((s) => s.trim()).filter(Boolean);

  log('');
  log('  BLOCKED — do not start the render:');
  for (const b of out.blockers) log(`    ! ${b}`);
  log('');
  log('  holding the most commit:');
  for (const g of out.top_consumers) log(`    ${g}`);
  log('');
  log('  Physical RAM is probably fine — this is the COMMIT limit, which is why');
  log('  --concurrency=1 will not help and the render will die somewhere confusing');
  log('  (webpack RangeError, Chrome EPIPE, or x264 failing to malloc 7 MB).');
  log('');
  log('  Free it by closing the browser above, or by freeing space on C: so the');
  log('  pagefile can grow. Nothing is killed automatically — that is your call.');
  if (JSON_OUT) console.log(JSON.stringify(out, null, 1));
  process.exit(1);
}

for (const w of out.warnings) log(`    ! ${w}`);
log(`    verdict          : OK to render`);
if (JSON_OUT) console.log(JSON.stringify(out, null, 1));
process.exit(0);
