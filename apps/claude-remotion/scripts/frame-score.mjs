/**
 * frame-score.mjs — score candidate frames of a video so a picker can choose on CONTENT.
 *
 * Extracted from publish-handoff.mjs so the thumbnail picker and the section-still exporter share
 * ONE implementation. They ask the same question — "which of these frames is worth showing?" — and
 * two copies would drift the moment one was tuned.
 *
 * WHY IT IS BUILT THIS WAY: the compositor's ffmpeg is a MINIMAL build. 42 filters, no
 * `signalstats`, no `silenceremove`, and no rawvideo/pgm/image2-to-stdout muxer — so it cannot pipe
 * pixels and cannot measure them itself. It CAN write a JPEG to a file. So: dump tiny JPEGs, measure
 * them in one python/PIL call (already a dependency — the motion toolchain uses it), delete them.
 *
 * Returns null rather than throwing when python or PIL is unavailable. A picker must always be able
 * to fall back; a still is never worth failing a build over.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { resolveFfmpeg } from './ffmpeg-bin.mjs';

/**
 * @param {string} videoPath
 * @param {number[]} times       seconds to sample
 * @param {string}   tmpDir      scratch dir (created and removed)
 * @returns {{t:number,avg:number,std:number}[] | null}
 */
export function scoreFrames(videoPath, times, tmpDir) {
  mkdirSync(tmpDir, { recursive: true });
  const files = [];
  try {
    times.forEach((t, i) => {
      const f = join(tmpDir, `c${i}.jpg`);
      const r = spawnSync(resolveFfmpeg(), [
        '-hide_banner', '-v', 'error', '-y', '-ss', String(t), '-i', videoPath,
        '-frames:v', '1', '-vf', 'scale=64:-2', '-q:v', '5', f,
      ], { encoding: 'utf8', timeout: 30000 });
      if (r.status === 0 && existsSync(f)) files.push({ t, f });
    });
    if (!files.length) return null;

    const py = spawnSync('py', ['-c', [
      'import sys, json',
      'from PIL import Image',
      'out=[]',
      'for a in sys.argv[1:]:',
      '    g=Image.open(a).convert("L")',
      '    px=list(g.getdata()); n=len(px)',
      '    m=sum(px)/n',
      '    v=(sum((p-m)**2 for p in px)/n)**0.5',
      '    out.append([round(m,2), round(v,2)])',
      'print(json.dumps(out))',
    ].join('\n'), ...files.map((x) => x.f)], { encoding: 'utf8', timeout: 60000 });

    if (py.status !== 0) return null;
    const stats = JSON.parse(String(py.stdout).trim());
    return files.map((x, k) => ({ t: x.t, avg: stats[k][0], std: stats[k][1] }));
  } catch {
    return null;
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* noop */ }
  }
}

/**
 * Choose the most SHOWABLE candidate.
 *
 * Detail-led, brightness only sufficient and capped. Learned the hard way: summing brightness and
 * spread picked the #1 white flash on the 130s AI Top 5 cut — washed out, tablet blank, text
 * ghosted. "Brightest wins" is trivially gamed by a flash, and these films are full of them. Spread
 * is what says there is something ON the frame; brightness only has to clear a floor.
 *
 * @param {{t:number,avg:number,std:number}[]} cands
 * `bright` weights the brightness term. 0.25 suits a THUMBNAIL, where a brighter frame genuinely
 * performs better. It is wrong for a SECTION STILL: on the promo's engine scene it scored the white
 * sting flash (mean 109, sd 23 -> 50.3) above the code-dense frames the section is actually about
 * (sd ~40 -> 47.5), which is the very failure the detail-led scoring exists to prevent. Pass a low
 * weight when you want "what does this section look like" rather than "what will get clicked".
 *
 * @param {{floor?:number, ceil?:number, bright?:number}} opts
 */
export function pickFrame(cands, { floor = 25, ceil = 150, bright = 0.25 } = {}) {
  if (!cands || !cands.length) return null;
  const usable = cands.filter((c) => c.avg >= floor && c.avg <= ceil);
  const pool = usable.length ? usable : cands;
  const score = (c) => c.std + bright * Math.min(c.avg, 120);
  return pool.reduce((a, b) => {
    const sa = score(a), sb = score(b);
    return sb > sa || (sb === sa && b.t > a.t) ? b : a;   // ties break late
  });
}

/** Evenly spaced sample times across [lo, hi]. */
export const spread = (lo, hi, n) =>
  Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / Math.max(1, n - 1));
