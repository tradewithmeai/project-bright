#!/usr/bin/env node
/**
 * files.mjs — implements studio/FILE_PROTOCOL.md.
 *
 *   index    rebuild studio/output/INDEX.md (read-only, always safe)
 *   collect  move finished videos out of the scattered render dirs into studio/output/
 *   archive  move OLD deliverables out of the library into the Google Drive archive
 *   sweep    report reclaimable space; delete it with --apply
 *
 * archive vs sweep — the distinction matters:
 *   archive = finished videos we may want again one day. They MOVE to Drive, never deleted.
 *   sweep   = regenerable junk (build output, frame sequences, scratch). Deleted outright;
 *             putting it in Drive would just burn quota on things a command can rebuild.
 *
 * Everything destructive is DRY RUN unless --apply is passed. sweep never touches source
 * footage, records, logs, or anything already in studio/output/.
 */
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUTPUT = join(REPO, 'studio', 'output');
const APP = join(REPO, 'apps', 'claude-remotion');

const argv = process.argv.slice(2);
const CMD = argv[0] || 'index';
const APPLY = argv.includes('--apply');
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OLDER_THAN = parseInt(arg('--older-than', '30'), 10);

// Archive destination. Google Drive for desktop mounts the user's drive as a normal folder, so
// archiving is a plain move — the Drive client uploads it in the background. No API, no tokens.
const HOME = process.env.USERPROFILE || process.env.HOME || '';
const ARCHIVE_ROOT = resolve(
  arg('--to', process.env.STUDIO_ARCHIVE_DIR || join(HOME, 'My Drive', 'project-bright-archive')),
);

const VIDEO = new Set(['.mp4', '.mov', '.webm']);
const MB = (b) => b / 1048576;
const fmt = (b) => (MB(b) >= 1024 ? `${(MB(b) / 1024).toFixed(2)} GB` : `${MB(b).toFixed(0)} MB`);

// ── directories we will NEVER delete from ────────────────────────────────────
const PROTECTED = [
  /[\\/]studio[\\/]output[\\/]/i,          // the library itself
  /[\\/]source[\\/]/i, /[\\/]_incoming[\\/]/i, /[\\/]raw[\\/]/i,   // irreplaceable footage
  /[\\/]records?[\\/]/i, /[\\/]logs?[\\/]/i,                       // provenance
  /[\\/]node_modules[\\/]/i, /[\\/]\.git[\\/]/i,
];
const isProtected = (p) => PROTECTED.some((r) => r.test(p));

// intermediates produced by footage triage / rendering — safe to prune once a cut has shipped
const INTERMEDIATE = /[\\/](chunks|proxies|candidates|candidates-new|fine|coarse|segments|analysis)[\\/]/i;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      walk(p, out);
    } else out.push(p);
  }
  return out;
}

const ageDays = (p) => (Date.now() - statSync(p).mtimeMs) / 86400000;

// ── naming ───────────────────────────────────────────────────────────────────
// Infer project + variant + date so scattered ad-hoc names become protocol names.
const PROJECT_HINTS = [
  [/ai-?top-?5/i, 'ai-top5'], [/yourgov|^yg-/i, 'yourgov'], [/bangbop/i, 'bangbop'],
  [/splitfire/i, 'splitfire'],
  [/blue-?robot|sentinel|hero-|bridge-/i, 'bridge'], [/solvx/i, 'solvx'], [/mygov/i, 'mygov'],
];

function inferProject(file) {
  const hay = file.replace(REPO, '');
  for (const [re, name] of PROJECT_HINTS) if (re.test(hay)) return name;
  const m = hay.match(/studio[\\/]projects[\\/]([^\\/]+)/i);
  return m ? m[1].toLowerCase() : 'misc';
}

function inferDate(file) {
  const m = basename(file).match(/(20\d{2})[-_]?(\d{2})[-_]?(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return new Date(statSync(file).mtimeMs).toISOString().slice(0, 10);
}

function inferVariant(file, project, date) {
  let v = basename(file, extname(file));
  v = v.replace(/(20\d{2})[-_]?\d{2}[-_]?\d{2}/g, '');            // strip dates
  v = v.replace(new RegExp(project.replace(/[-]/g, '[-_]?'), 'ig'), '');
  v = v.replace(/[_\-\s]+/g, '-').replace(/^-+|-+$/g, '');
  return v || 'main';
}

function protocolName(file) {
  const project = inferProject(file);
  const date = inferDate(file);
  const variant = inferVariant(file, project, date);
  return { project, date, name: `${date}_${project}_${variant}${extname(file)}` };
}

// ── candidate deliverables: videos in render/preview/renders dirs ────────────
function deliverableCandidates() {
  const roots = [
    join(APP, 'out'), join(APP, 'previews'), join(REPO, 'out'),
    ...walk(join(REPO, 'studio', 'projects'))
      .filter((p) => /[\\/]renders?[\\/]/i.test(p)).map(dirname),
  ];
  const seen = new Set();
  const files = [];
  for (const r of new Set(roots)) {
    for (const f of walk(r)) {
      if (!VIDEO.has(extname(f).toLowerCase())) continue;
      if (INTERMEDIATE.test(f) || isProtected(f)) continue;
      if (seen.has(f)) continue;
      seen.add(f); files.push(f);
    }
  }
  return files;
}

// ── commands ─────────────────────────────────────────────────────────────────
function cmdIndex() {
  mkdirSync(OUTPUT, { recursive: true });
  const files = walk(OUTPUT).filter((f) => VIDEO.has(extname(f).toLowerCase()));
  files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  const total = files.reduce((s, f) => s + statSync(f).size, 0);

  const byProject = new Map();
  for (const f of files) {
    const proj = relative(OUTPUT, f).split(sep)[0];
    if (!byProject.has(proj)) byProject.set(proj, []);
    byProject.get(proj).push(f);
  }

  let md = `# Studio output — video catalogue\n\n`;
  md += `_Auto-generated by \`studio/tools/studio-files/files.mjs index\`. Do not hand-edit._\n\n`;
  md += `**${files.length} videos · ${fmt(total)}** · newest first. Paths are full and paste-ready.\n\n`;
  md += `## Newest 25\n\n| Date | Project | File | Size | Full path |\n|---|---|---|---|---|\n`;
  for (const f of files.slice(0, 25)) {
    const st = statSync(f);
    const proj = relative(OUTPUT, f).split(sep)[0];
    md += `| ${new Date(st.mtimeMs).toISOString().slice(0, 10)} | ${proj} | ${basename(f)} | ${fmt(st.size)} | \`${f}\` |\n`;
  }
  md += `\n## By project\n\n`;
  for (const [proj, fs] of [...byProject].sort()) {
    const sz = fs.reduce((s, f) => s + statSync(f).size, 0);
    md += `### ${proj} — ${fs.length} videos, ${fmt(sz)}\n\n`;
    for (const f of fs) md += `- \`${f}\`\n`;
    md += `\n`;
  }
  writeFileSync(join(OUTPUT, 'INDEX.md'), md, 'utf8');
  console.log(`[index] ${files.length} videos (${fmt(total)}) -> ${join(OUTPUT, 'INDEX.md')}`);
  if (!files.length) console.log(`[index] library is empty — run "collect --apply" to populate it`);
}

function cmdCollect() {
  const cands = deliverableCandidates();
  const plan = [];
  const clashes = new Map();
  const taken = new Set(walk(OUTPUT).map((f) => f.toLowerCase()));
  for (const f of cands) {
    const { project, name } = protocolName(f);
    // Two scratch files can infer the same protocol name (e.g. both variants read as "main").
    // Suffix rather than skip — dropping one silently leaves an orphan outside the library.
    const ext = extname(name);
    const stem = name.slice(0, -ext.length);
    const size = statSync(f).size;
    let dest = join(OUTPUT, project, name);
    // Already in the library, same bytes? It's a leftover copy, not a second deliverable.
    if (existsSync(dest) && statSync(dest).size === size) {
      plan.push({ from: f, to: dest, size, dupe: true });
      continue;
    }
    let n = 1;
    while (clashes.has(dest.toLowerCase()) || taken.has(dest.toLowerCase())) {
      dest = join(OUTPUT, project, `${stem}-${++n}${ext}`);
    }
    clashes.set(dest.toLowerCase(), [f]);
    plan.push({ from: f, to: dest, size });
  }
  const dupes = [];
  const total = plan.reduce((s, p) => s + p.size, 0);

  console.log(`[collect] ${plan.length} deliverables (${fmt(total)}) -> studio/output/`);
  const byProj = new Map();
  for (const p of plan) {
    const proj = relative(OUTPUT, p.to).split(sep)[0];
    byProj.set(proj, (byProj.get(proj) || 0) + 1);
  }
  for (const [proj, n] of [...byProj].sort()) console.log(`   ${proj.padEnd(12)} ${n}`);
  for (const p of plan.slice(0, 12)) {
    console.log(`   ${relative(REPO, p.from)}\n     -> ${p.dupe ? 'ALREADY IN LIBRARY (drop copy)' : relative(REPO, p.to)}`);
  }
  if (plan.length > 12) console.log(`   ... and ${plan.length - 12} more`);
  if (dupes.length) {
    console.log(`\n[collect] ${dupes.length} name clashes (only the first of each is moved):`);
    for (const d of dupes.slice(0, 5)) console.log(`   ${d.map((x) => basename(x)).join('  ==  ')}`);
  }

  if (!APPLY) { console.log(`\nDRY RUN — nothing moved. Re-run with --apply.`); return; }
  let moved = 0, dropped = 0;
  for (const p of plan) {
    if (p.dupe) { unlinkSync(p.from); dropped++; continue; }
    mkdirSync(dirname(p.to), { recursive: true });
    if (existsSync(p.to)) continue;
    try { renameSync(p.from, p.to); } catch { copyFileSync(p.from, p.to); unlinkSync(p.from); }
    moved++;
  }
  console.log(`\n[collect] moved ${moved} files into studio/output/${dropped ? `, dropped ${dropped} duplicate copies` : ''}`);
  cmdIndex();
}

function cmdArchive() {
  const files = walk(OUTPUT)
    .filter((f) => VIDEO.has(extname(f).toLowerCase()))
    .filter((f) => ageDays(f) > OLDER_THAN);
  files.sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);
  const total = files.reduce((s, f) => s + statSync(f).size, 0);

  const driveParent = dirname(ARCHIVE_ROOT);
  const driveReady = existsSync(driveParent);

  console.log(`[archive] destination: ${ARCHIVE_ROOT}`);
  if (!driveReady) {
    console.log(`[archive] !! that folder's parent does not exist.`);
    console.log(`[archive]    Install/sign in to Google Drive for desktop so "${driveParent}" appears,`);
    console.log(`[archive]    or point somewhere else:  --to <dir>  /  STUDIO_ARCHIVE_DIR=<dir>`);
  }
  console.log(`[archive] ${files.length} deliverables older than ${OLDER_THAN}d (${fmt(total)})\n`);
  if (!files.length) { console.log(`  nothing that old — library is current.`); return; }

  const byProj = new Map();
  for (const f of files) {
    const proj = relative(OUTPUT, f).split(sep)[0];
    byProj.set(proj, (byProj.get(proj) || { n: 0, b: 0 }));
    byProj.get(proj).n++; byProj.get(proj).b += statSync(f).size;
  }
  for (const [proj, v] of [...byProj].sort()) {
    console.log(`  ${fmt(v.b).padStart(9)}  ${v.n.toString().padStart(4)}  ${proj}`);
  }
  for (const f of files.slice(0, 8)) {
    console.log(`   ${relative(OUTPUT, f)}  (${Math.round(ageDays(f))}d)`);
  }
  if (files.length > 8) console.log(`   ... and ${files.length - 8} more`);

  if (!APPLY) { console.log(`\nDRY RUN — nothing moved. Re-run with --apply --older-than ${OLDER_THAN}.`); return; }
  if (!driveReady) { console.log(`\n[archive] refusing to --apply: destination parent is missing.`); process.exit(1); }

  let moved = 0, bytes = 0;
  const done = [];
  for (const f of files) {
    const rel = relative(OUTPUT, f);
    const dest = join(ARCHIVE_ROOT, rel);
    mkdirSync(dirname(dest), { recursive: true });
    if (existsSync(dest)) { unlinkSync(f); continue; }   // already archived — drop the local copy
    const size = statSync(f).size;
    // Cross-volume (D: -> C:/Drive) so rename usually fails; copy+unlink is the real path.
    try { renameSync(f, dest); } catch { copyFileSync(f, dest); unlinkSync(f); }
    moved++; bytes += size; done.push({ rel, size });
  }

  // A manifest in the archive itself, so the Drive folder is self-describing.
  const manifest = join(ARCHIVE_ROOT, 'ARCHIVE_INDEX.md');
  const all = walk(ARCHIVE_ROOT).filter((f) => VIDEO.has(extname(f).toLowerCase()));
  all.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  let md = `# Project Bright — archived video library\n\n`;
  md += `_Moved out of \`studio/output/\` by \`files.mjs archive\`. ${all.length} videos, `;
  md += `${fmt(all.reduce((s, f) => s + statSync(f).size, 0))}._\n\n`;
  md += `| Date | Project | File | Size |\n|---|---|---|---|\n`;
  for (const f of all) {
    const st = statSync(f);
    md += `| ${new Date(st.mtimeMs).toISOString().slice(0, 10)} | ${relative(ARCHIVE_ROOT, f).split(sep)[0]} `;
    md += `| ${basename(f)} | ${fmt(st.size)} |\n`;
  }
  writeFileSync(manifest, md, 'utf8');

  console.log(`\n[archive] moved ${moved} files (${fmt(bytes)}) -> ${ARCHIVE_ROOT}`);
  console.log(`[archive] manifest: ${manifest}`);
  cmdIndex();
}

function cmdSweep() {
  const groups = [];

  const build = join(APP, 'build');
  if (existsSync(build)) {
    const fs = walk(build);
    groups.push({ label: 'remotion build output (npm run build regenerates)', dir: build,
                  files: fs, bytes: fs.reduce((s, f) => s + statSync(f).size, 0) });
  }

  const frameDirs = [];
  const bridge = join(APP, 'public', 'bridge');
  if (existsSync(bridge)) {
    for (const d of readdirSync(bridge, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const p = join(bridge, d.name);
      const fs = walk(p).filter((f) => /frame_\d+\.png$/i.test(f));
      if (fs.length) frameDirs.push({ p, fs });
    }
  }
  if (frameDirs.length) {
    const all = frameDirs.flatMap((x) => x.fs);
    groups.push({ label: `rendered frame sequences, ${frameDirs.length} dirs (tools regenerate)`,
                  files: all, bytes: all.reduce((s, f) => s + statSync(f).size, 0) });
  }

  const inter = walk(join(REPO, 'studio', 'projects'))
    .filter((f) => INTERMEDIATE.test(f) && !isProtected(f) && VIDEO.has(extname(f).toLowerCase()))
    .filter((f) => ageDays(f) > OLDER_THAN);
  if (inter.length) {
    groups.push({ label: `footage-triage intermediates older than ${OLDER_THAN}d`,
                  files: inter, bytes: inter.reduce((s, f) => s + statSync(f).size, 0) });
  }

  const stale = [join(APP, 'out'), join(APP, 'previews'), join(REPO, 'out')]
    .flatMap((d) => walk(d))
    .filter((f) => VIDEO.has(extname(f).toLowerCase()) && !isProtected(f))
    .filter((f) => ageDays(f) > OLDER_THAN);
  if (stale.length) {
    groups.push({ label: `render scratch older than ${OLDER_THAN}d (collect first if any are keepers!)`,
                  files: stale, bytes: stale.reduce((s, f) => s + statSync(f).size, 0) });
  }

  const total = groups.reduce((s, g) => s + g.bytes, 0);
  console.log(`[sweep] reclaimable: ${fmt(total)}\n`);
  for (const g of groups) {
    console.log(`  ${fmt(g.bytes).padStart(9)}  ${g.files.length.toString().padStart(5)} files  ${g.label}`);
    for (const f of g.files.slice(0, 3)) console.log(`             ${relative(REPO, f)}`);
    if (g.files.length > 3) console.log(`             ... +${g.files.length - 3} more`);
  }
  if (!APPLY) { console.log(`\nDRY RUN — nothing deleted. Re-run with --apply --older-than ${OLDER_THAN}.`); return; }

  let n = 0, freed = 0;
  for (const g of groups) for (const f of g.files) {
    if (isProtected(f)) continue;
    try { freed += statSync(f).size; rmSync(f, { force: true }); n++; } catch { /* ignore */ }
  }
  if (existsSync(build)) rmSync(build, { recursive: true, force: true });
  console.log(`\n[sweep] deleted ${n} files, freed ${fmt(freed)}`);
}

if (CMD === 'index') cmdIndex();
else if (CMD === 'collect') cmdCollect();
else if (CMD === 'archive') cmdArchive();
else if (CMD === 'sweep') cmdSweep();
else {
  console.log(`usage: files.mjs <index|collect|archive|sweep> [--apply] [--older-than N] [--to DIR]`);
  process.exit(2);
}
