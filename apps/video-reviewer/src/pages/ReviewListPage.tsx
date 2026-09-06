import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listVideos, type VideoSummary } from '../reviewer/api';

export function ReviewListPage() {
  const [videos, setVideos] = useState<VideoSummary[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listVideos().then(setVideos).catch((e) => setErr(String(e.message || e)));
  }, []);

  return (
    <div className="min-h-screen bg-[#05070f] text-[#e8eaf0]">
      <header className="border-b border-white/10 px-8 py-5 flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff2e88] shadow-[0_0_14px_#ff2e88]" />
        <h1 className="font-mono tracking-[0.3em] text-sm text-[#e8eaf0]/90">PROJECT BRIGHT · REVIEWER</h1>
      </header>

      <main className="px-8 py-8">
        {err && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm">
            {err} — is <code className="font-mono">serve-reviewer.mjs</code> running?
          </div>
        )}
        {!videos && !err && <p className="text-white/40">Loading…</p>}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {videos?.map((v) => {
            const body = (
              <div
                className={`rounded-xl border p-5 h-full transition ${
                  v.reviewable
                    ? 'border-white/10 bg-white/[0.03] hover:border-[#22d3ee]/60 hover:bg-white/[0.06]'
                    : 'border-white/5 bg-white/[0.01] opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{v.project}</h2>
                    <p className="font-mono text-xs text-white/40 mt-1">
                      {v.composition_id ?? '—'} {v.version ? `· ${v.version}` : ''}
                    </p>
                  </div>
                  <span className="font-mono text-xs px-2 py-1 rounded bg-white/5 text-white/60 shrink-0">
                    {v.parts_produced}/{v.sections} parts
                  </span>
                </div>

                <div className="mt-4 font-mono text-xs text-white/50 space-y-1">
                  {v.duration && <div>{v.duration.seconds.toFixed(1)}s · {v.duration.frames} frames</div>}
                  {v.dimensions && <div>{v.dimensions.width}×{v.dimensions.height}</div>}
                </div>

                {/* A video with no rendered parts is LISTED, not hidden. "Why is this not here" is a
                    worse question than "why does this have no parts", and the answer is actionable. */}
                {!v.reviewable && (
                  <p className="mt-4 text-xs text-amber-300/70 font-mono">
                    no parts rendered — run render-sections.mjs
                  </p>
                )}
              </div>
            );
            return v.reviewable
              ? <Link key={v.project} to={`/review/${v.project}`}>{body}</Link>
              : <div key={v.project}>{body}</div>;
          })}
        </div>
      </main>
    </div>
  );
}
