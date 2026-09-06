#!/usr/bin/env node
/**
 * serve-reviewer.mjs — the reviewer's data + media server.
 *
 *   node scripts/serve-reviewer.mjs [--port 5199]
 *
 * There is no database and no auth. The reviewer's whole world is:
 *   GET /api/videos            every VIDEO_RECORD.json under studio/projects/
 *   GET /api/videos/:project   one record
 *   POST /api/videos/:project/review   append a verdict to that record
 *   GET /media/*               the rendered parts, and the full film
 *   GET /                      the built reviewer app (if built)
 *
 * Media is served with RANGE support because a browser will not scrub an mp4 without it — it sends
 * `Range: bytes=…` and expects 206. Ignore that and every part plays from the start only, which
 * looks like a broken player rather than a missing header.
 *
 * Bound to 127.0.0.1. This serves the whole studio output tree by path; it must not listen publicly.
 */
import { createReadStream, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(APP, '..', '..');
const PROJECTS = join(REPO, 'studio', 'projects');
const DIST = join(REPO, 'apps', 'video-reviewer', 'dist');
const argv = process.argv.slice(2);
const PORT = Number(argv.includes('--port') ? argv[argv.indexOf('--port') + 1] : 5199);

// Media may live under the app's out/ (rendered parts) or studio/output (stored finals). Both are
// inside the repo; every request is resolved and then checked to be under one of them.
const MEDIA_ROOTS = [APP, join(REPO, 'studio', 'output')];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

/** Every record on disk, newest render first. */
function findRecords() {
  if (!existsSync(PROJECTS)) return [];
  const out = [];
  for (const project of readdirSync(PROJECTS)) {
    const p = join(PROJECTS, project, 'records', 'VIDEO_RECORD.json');
    if (!existsSync(p)) continue;
    try {
      const rec = JSON.parse(readFileSync(p, 'utf8'));
      const parts = (rec.sections || []).filter((s) => s.render?.status === 'produced').length;
      out.push({
        project,
        recordPath: p,
        composition_id: rec.composition_id ?? null,
        version: rec.version ?? null,
        duration: rec.duration ?? null,
        dimensions: rec.dimensions ?? null,
        sections: (rec.sections || []).length,
        parts_produced: parts,
        // A record whose parts were never rendered can still be listed — the reviewer says so
        // rather than hiding it, because "why is this video not here" is a worse question than
        // "why does this video have no parts".
        reviewable: parts > 0,
        mtime: statSync(p).mtimeMs,
      });
    } catch (e) {
      out.push({ project, recordPath: p, error: String(e.message || e), reviewable: false });
    }
  }
  return out.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
}

const send = (res, code, body, type = 'application/json') => {
  const b = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(b);
};

/** Serve a file with Range support. Without 206 a browser cannot seek an mp4. */
function sendFile(res, file, range) {
  const size = statSync(file).size;
  const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? parseInt(m[2], 10) : size - 1;
    if (start >= size) {
      res.writeHead(416, { 'Content-Range': `bytes */${size}` });
      return res.end();
    }
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
    });
    return createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size });
  return createReadStream(file).pipe(res);
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = decodeURIComponent(url.pathname);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return send(res, 204, '');

  try {
    if (path === '/api/videos') return send(res, 200, findRecords());

    const one = /^\/api\/videos\/([^/]+)$/.exec(path);
    if (one) {
      const p = join(PROJECTS, one[1], 'records', 'VIDEO_RECORD.json');
      if (!existsSync(p)) return send(res, 404, { error: 'no record for ' + one[1] });
      return send(res, 200, readFileSync(p, 'utf8'));
    }

    // The reviewer's ONLY write. A verdict is appended to the record, never overwriting one —
    // review history is the point (it is what judge-video calibrates against).
    const rev = /^\/api\/videos\/([^/]+)\/review$/.exec(path);
    if (rev && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        try {
          const p = join(PROJECTS, rev[1], 'records', 'VIDEO_RECORD.json');
          if (!existsSync(p)) return send(res, 404, { error: 'no record' });
          const rec = JSON.parse(readFileSync(p, 'utf8'));
          const v = JSON.parse(body || '{}');
          rec.review = rec.review || [];
          rec.review.push({
            at: new Date().toISOString(),
            version: rec.version ?? null,
            section: v.section ?? null,     // null = a verdict on the whole film
            verdict: v.verdict ?? 'note',
            words: v.words ?? '',
            reviewer: v.reviewer ?? 'operator',
          });
          writeFileSync(p, `${JSON.stringify(rec, null, 2)}\n`);
          send(res, 200, { ok: true, count: rec.review.length });
        } catch (e) { send(res, 500, { error: String(e.message || e) }); }
      });
      return undefined;
    }

    if (path.startsWith('/media/')) {
      const rel = normalize(path.slice('/media/'.length)).replace(/^(\.\.[/\\])+/, '');
      for (const root of MEDIA_ROOTS) {
        const file = resolve(root, rel);
        if (!file.startsWith(root + sep)) continue;      // no escaping the root
        if (existsSync(file) && statSync(file).isFile()) {
          return sendFile(res, file, req.headers.range);
        }
      }
      return send(res, 404, { error: 'no media at ' + rel });
    }

    // the built app
    const file = path === '/' ? join(DIST, 'index.html') : join(DIST, path);
    if (existsSync(DIST) && existsSync(file) && statSync(file).isFile()) return sendFile(res, file);
    if (existsSync(DIST)) return sendFile(res, join(DIST, 'index.html'));   // SPA fallback
    return send(res, 200,
      '<h1>reviewer API is up</h1><p>The app is not built yet. From apps/video-reviewer: '
      + '<code>npm install &amp;&amp; npm run dev</code> (dev server proxies here), or '
      + '<code>npm run build</code> to serve it from this port.</p>'
      + `<p><a href="/api/videos">/api/videos</a></p>`, 'text/html; charset=utf-8');
  } catch (e) {
    return send(res, 500, { error: String(e.message || e) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const recs = findRecords();
  console.log(`[reviewer] http://127.0.0.1:${PORT}`);
  console.log(`[reviewer] ${recs.length} record(s); ${recs.filter((r) => r.reviewable).length} with rendered parts`);
  for (const r of recs) {
    console.log(`  ${r.project.padEnd(24)} ${String(r.parts_produced ?? 0).padStart(2)}/${r.sections ?? 0} parts` +
      (r.reviewable ? '' : '   (no parts rendered — run render-sections.mjs)'));
  }
});
