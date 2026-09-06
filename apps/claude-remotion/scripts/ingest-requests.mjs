#!/usr/bin/env node
// ingest-requests.mjs — the RETURN-bridge intake: socials-studio → project-bright.
//
// socials-studio drops a `video_production_request_v1` package into
// <project-bright>/studio/requests/incoming/<id>/request.json (a commission: what to make + why).
// This surfaces every pending request into a managed block in studio/requests/QUEUE.md for the
// operator/Claude to action. It NEVER auto-produces — a human picks what to build.
//
// Contract: studio/contracts/video_production_request_v1.md
//
// Usage (from repo root or apps/claude-remotion):
//   node apps/claude-remotion/scripts/ingest-requests.mjs           # list + refresh QUEUE.md
//   node apps/claude-remotion/scripts/ingest-requests.mjs --list    # list only
//   node apps/claude-remotion/scripts/ingest-requests.mjs --json     # pending requests as JSON

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.PROJECT_BRIGHT_DIR || join(HERE, '..', '..', '..');
const INCOMING = join(ROOT, 'studio', 'requests', 'incoming');
const QUEUE = join(ROOT, 'studio', 'requests', 'QUEUE.md');
const SCHEMA = 'video_production_request_v1';
const START = '<!-- REQUESTS:START -->';
const END = '<!-- REQUESTS:END -->';

const argv = process.argv.slice(2);
const has = (k) => argv.includes(k);

function load() {
  const out = [];
  if (!existsSync(INCOMING)) return out;
  for (const name of readdirSync(INCOMING)) {
    const dir = join(INCOMING, name);
    const rj = join(dir, 'request.json');
    if (!(statSync(dir).isDirectory() && existsSync(rj))) continue;
    try {
      const data = JSON.parse(readFileSync(rj, 'utf8'));
      if (data.schema !== SCHEMA) { console.error(`  ! skip ${name}: unexpected schema ${data.schema}`); continue; }
      out.push({ name, data });
    } catch (e) { console.error(`  ! skip ${name}: unreadable request.json (${e.message})`); }
  }
  return out;
}

// edit.style values project-bright commits to (OUTPUTS_CONTRACT_ACCEPTANCE Term 2). Anything else is
// surfaced with a ⚠ so the operator sees it will fall back to full-show, not silently render wrong.
const SUPPORTED_STYLES = ['full-show', 'hook-first'];

// Normalise v2 `outputs[]` and v1 singular `format` to one array of output jobs.
function outputsOf(data) {
  if (Array.isArray(data.outputs) && data.outputs.length) return data.outputs;
  const f = data.format || {};
  if (f.aspect || (f.platforms || []).length) {
    return [{ output_id: null, role: 'equal', aspect: f.aspect, duration_s: f.target_duration_s, platforms: f.platforms, edit: {}, _v1: true }];
  }
  return [];
}

// One line per requested output — the render job the operator/Claude actions.
function outputLine(o) {
  const p = o._profile || {};
  const dims = p.dimensions ? `${p.dimensions.w}×${p.dimensions.h}` : (o.aspect || '?');
  const fps = p.fps ? `@${p.fps}` : '';
  const dur = o.duration_s != null ? `~${o.duration_s}s`
    : o.max_duration_s != null ? `≤${o.max_duration_s}s`
    : p.duration?.ideal_s ? `~${p.duration.ideal_s}s` : '?';
  const style = o.edit?.style || 'full-show';
  const styleTag = SUPPORTED_STYLES.includes(style) ? `**${style}**` : `**${style}** ⚠ unsupported → falls back to full-show`;
  const promo = o.promotes ? ` → promotes \`${o.promotes}\`` : '';
  const voHint = o.edit?.vo_hint ? ` · vo-hint: ${o.edit.vo_hint}` : '';
  const oid = o._v1 ? '(v1 single)' : `\`${o.output_id || 'output'}\``;
  return `  - ${oid} **${(o.role || 'equal')}** · ${o.platform_profile || o.aspect || '?'} ${dims}${fps} · ${dur} · style ${styleTag} · platforms: ${(o.platforms || []).join(', ') || '—'}${promo}${voHint}`;
}

function card({ name, data }) {
  const c = data.campaign || {};
  const v = data.video || {};
  const status = (data.status || 'requested').toUpperCase();
  const prio = (data.priority || 'normal').toUpperCase();
  const rid = data.request_id || name;
  const outputs = outputsOf(data);
  const brief = v.brief || {};
  return [
    `### ▶ ${v.working_title || name} · \`${name}\` · **${status}** · prio ${prio}`,
    `- campaign: **${c.name || '?'}** — goal: **${c.goal || '?'}**${c.kpi ? ` · KPI: ${c.kpi}` : ''}`,
    `- video: type=**${v.type || '?'}** · angle: ${v.angle || '—'} · request_id \`${rid}\``,
    `- **outputs (${outputs.length}):**`,
    ...(outputs.length ? outputs.map(outputLine) : ['  - _no outputs[] or format in request_']),
    v.key_message ? `- key message: ${v.key_message}` : null,
    brief.build_guide ? `- build guide: ${brief.build_guide}` : null,
    brief.voiceover_notes ? `- VO notes (campaign-level): ${brief.voiceover_notes}` : null,
    c.stakeholder_notes ? `- stakeholder: ${c.stakeholder_notes}` : null,
    v.must_include?.length ? `- must include: ${v.must_include.join('; ')}` : null,
    `- source: ${(data.source || {}).kind || '?'}${(data.source || {}).assets?.length ? ` (${data.source.assets.length} asset ref)` : ''} · audience: ${(data.audience || {}).owner || 'own'}${(data.audience || {}).client ? ` (client ${data.audience.client})` : ''}`,
    `- needed by: ${data.needed_by || '—'} · requested ${data.requested_at || '?'}`,
    `- ▶ **Action:** render each output (route by video.type + edit.style), then deliver EACH via \`finished_video_publish_v1\` with \`request_id: ${rid}\` + its \`output_id\`/\`role\`.`,
    '',
  ].filter(Boolean).join('\n');
}

function refresh(pkgs) {
  const body = [
    START,
    '## 📥 Production requests from socials-studio (auto — regenerated by `ingest-requests.mjs`)',
    '',
    'Commissions from the marketing side: what to make + why. Route each by `video.type`, produce framed to '
      + 'the campaign goal, then deliver via the publish bridge (`finished_video_publish_v1`, set `request_id`). '
      + 'Delete the `studio/requests/incoming/<id>/` folder once delivered.',
    '',
    pkgs.length ? pkgs.map(card).join('\n') : '_No open production requests._\n',
    END,
  ].join('\n');
  let text = existsSync(QUEUE) ? readFileSync(QUEUE, 'utf8') : '# Production queue\n\nCommissions from socials-studio (see `studio/contracts/video_production_request_v1.md`).\n\n---\n';
  if (text.includes(START) && text.includes(END)) {
    text = text.split(START)[0] + body + text.split(END, 2)[1];
  } else {
    text = text.replace(/\n---\n/, `\n---\n\n${body}\n\n`) === text ? text.trimEnd() + '\n\n' + body + '\n' : text.replace(/\n---\n/, `\n---\n\n${body}\n\n`);
  }
  mkdirSync(dirname(QUEUE), { recursive: true });
  writeFileSync(QUEUE, text, 'utf8');
}

const pkgs = load();
if (has('--json')) { console.log(JSON.stringify(pkgs.map((p) => p.data), null, 2)); process.exit(0); }

if (!pkgs.length) console.log('No production requests in studio/requests/incoming/.');
else {
  console.log(`${pkgs.length} production request(s):`);
  for (const p of pkgs) console.log(`  - ${p.name.padEnd(30)} ${(p.data.status || 'requested').padEnd(12)} ${p.data.video?.working_title || ''}`);
}
if (!has('--list')) { refresh(pkgs); console.log('\nstudio/requests/QUEUE.md refreshed.'); }
