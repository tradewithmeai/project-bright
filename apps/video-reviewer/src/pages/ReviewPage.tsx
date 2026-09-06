import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getVideo, partUrl, postReview, type Section, type VideoRecord } from '../reviewer/api';

const ACCENT = '#22d3ee';
const PASS = '#4ade80';
const REVISE = '#fbbf24';

/**
 * Reviewing renders is a REPETITIVE JOB, not a browsing experience. The operator watches a part two
 * or three times, decides, and moves on — thirteen times. So the UI is built around that loop:
 *
 *  - parts LOOP by default, because you never judge a 5-second cut on one viewing
 *  - the keyboard drives everything, so hands stay off the mouse between parts
 *  - a verdict advances to the next UNREVIEWED part, so the session has a direction and an end
 *  - the frame counter is absolute (film frame, not part frame), because that is the number you
 *    quote when reporting a fault, and the record's frames are authoritative
 *  - progress is always visible, so "am I nearly done" never requires counting
 */
export function ReviewPage() {
  const { project = '' } = useParams();
  const [rec, setRec] = useState<VideoRecord | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [words, setWords] = useState('');
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(true);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(
    () => getVideo(project).then(setRec).catch((e) => setErr(String(e.message || e))),
    [project],
  );
  useEffect(() => { load(); }, [load]);

  const parts = useMemo(
    () => (rec?.sections ?? []).filter((s) => s.render?.status === 'produced'),
    [rec],
  );
  const active: Section | undefined = parts[idx];
  const fps = rec?.fps ?? 30;

  const verdictFor = useCallback(
    (id: string) => {
      const all = (rec?.review ?? []).filter((r) => r.section === id);
      return all.length ? all[all.length - 1] : null;
    },
    [rec],
  );
  const decided = parts.filter((s) => ['pass', 'revise'].includes(verdictFor(s.id)?.verdict ?? '')).length;

  const go = useCallback((n: number) => {
    setIdx(() => Math.max(0, Math.min(parts.length - 1, n)));
    setWords('');
  }, [parts.length]);

  const nextUndecided = useCallback(() => {
    const from = idx + 1;
    const order = [...parts.slice(from), ...parts.slice(0, from)];
    const next = order.find((s) => !['pass', 'revise'].includes(verdictFor(s.id)?.verdict ?? ''));
    if (next) go(parts.indexOf(next));
    else setFlash('every part decided');
  }, [idx, parts, verdictFor, go]);

  const submit = useCallback(async (verdict: string) => {
    if (!active) return;
    await postReview(project, { section: active.id, verdict, words });
    setFlash(`${active.id} → ${verdict}`);
    setWords('');
    await load();
    if (verdict !== 'note') nextUndecided();
  }, [active, project, words, load, nextUndecided]);

  // Frame stepping needs the video paused; browsers only guarantee a repaint after a seek.
  const step = useCallback((n: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = Math.max(0, v.currentTime + n / fps);
  }, [fps]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = document.activeElement === noteRef.current;
      if (typing && e.key !== 'Escape') return;
      const v = videoRef.current;
      switch (e.key) {
        case ' ': e.preventDefault(); if (v) (v.paused ? v.play() : v.pause()); break;
        case 'j': case 'ArrowUp': e.preventDefault(); go(idx - 1); break;
        case 'k': case 'ArrowDown': e.preventDefault(); go(idx + 1); break;
        case ',': e.preventDefault(); step(-1); break;
        case '.': e.preventDefault(); step(1); break;
        case 'p': submit('pass'); break;
        case 'r': submit('revise'); break;
        case 'l': setLoop((x) => !x); break;
        case 'n': e.preventDefault(); noteRef.current?.focus(); break;
        case 'u': e.preventDefault(); nextUndecided(); break;
        case 'Escape': (document.activeElement as HTMLElement)?.blur(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, go, step, submit, nextUndecided]);

  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 1800); return () => clearTimeout(t); }, [flash]);
  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = rate; }, [rate, idx]);

  if (err) return <Frame><p className="text-red-300 font-mono text-sm">{err}</p></Frame>;
  if (!rec || !active) return <Frame><p className="text-white/40 font-mono text-sm">Loading…</p></Frame>;

  const absFrame = active.start + frame;

  return (
    <Frame
      title={project}
      right={
        <div className="flex items-center gap-4 font-mono text-xs">
          <span className="text-white/40">{decided}/{parts.length} decided</span>
          <div className="w-32 h-1.5 rounded bg-white/10 overflow-hidden">
            <div className="h-full transition-all" style={{ width: `${(decided / parts.length) * 100}%`, background: ACCENT }} />
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)_300px] gap-4">

        {/* ── parts ────────────────────────────────────────────────────── */}
        <aside className="xl:max-h-[calc(100vh-150px)] xl:overflow-y-auto space-y-1 pr-1">
          {parts.map((s, i) => {
            const v = verdictFor(s.id);
            const on = i === idx;
            return (
              <button
                key={s.id} onClick={() => go(i)}
                className={`w-full text-left rounded px-3 py-2 border transition ${
                  on ? 'border-[#22d3ee] bg-[#22d3ee]/10' : 'border-transparent bg-white/[0.03] hover:bg-white/[0.07]'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{
                    background: v?.verdict === 'pass' ? PASS : v?.verdict === 'revise' ? REVISE : '#3a4152',
                  }} />
                  <span className="font-mono text-[11px] text-white/70 truncate flex-1">{s.id}</span>
                  <span className="font-mono text-[10px] text-white/30">{s.frames}f</span>
                </div>
                {v?.words && <div className="mt-1 pl-3.5 text-[11px] text-white/45 truncate">{v.words}</div>}
              </button>
            );
          })}
        </aside>

        {/* ── the part ─────────────────────────────────────────────────── */}
        <section className="min-w-0">
          <div className="bg-black rounded border border-white/10 overflow-hidden">
            <video
              key={active.id}
              ref={videoRef}
              src={partUrl(active) ?? undefined}
              controls loop={loop} autoPlay
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(e) => setFrame(Math.round(e.currentTarget.currentTime * fps))}
              className="w-full block"
            />
          </div>

          {/* transport — the numbers you actually quote when reporting a fault */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs">
            <span className="text-white/80">
              frame <span style={{ color: ACCENT }}>{absFrame}</span>
              <span className="text-white/30"> / {rec.duration.frames}</span>
            </span>
            <span className="text-white/40">part {frame}/{active.frames}</span>
            <span className="text-white/40">{(absFrame / fps).toFixed(2)}s</span>
            <div className="flex items-center gap-1">
              <Key onClick={() => step(-1)}>,</Key>
              <span className="text-white/30">step</span>
              <Key onClick={() => step(1)}>.</Key>
            </div>
            <div className="flex items-center gap-1">
              {[0.25, 0.5, 1, 2].map((r) => (
                <button key={r} onClick={() => setRate(r)}
                  className={`px-2 py-0.5 rounded border ${rate === r
                    ? 'border-[#22d3ee] text-[#22d3ee]' : 'border-white/10 text-white/40 hover:text-white/70'}`}>
                  {r}×
                </button>
              ))}
            </div>
            <button onClick={() => setLoop((x) => !x)}
              className={`px-2 py-0.5 rounded border ${loop
                ? 'border-[#22d3ee] text-[#22d3ee]' : 'border-white/10 text-white/40'}`}>
              loop
            </button>
            <span className="text-white/25">{playing ? 'playing' : 'paused'}</span>
          </div>

          {/* verdict */}
          <div className="mt-3 rounded border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-baseline justify-between mb-2">
              <span className="font-mono text-[11px] tracking-widest" style={{ color: ACCENT }}>
                {active.id.toUpperCase()}
              </span>
              <span className="font-mono text-[11px] text-white/30">
                {active.label} · frames {active.start}–{active.end}
              </span>
            </div>
            <textarea
              ref={noteRef} value={words} onChange={(e) => setWords(e.target.value)}
              placeholder="what is wrong with this part  (n to focus, esc to leave)"
              className="w-full bg-black/50 border border-white/10 rounded p-2 text-sm outline-none focus:border-[#22d3ee] min-h-[56px] resize-y"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              <Btn colour={PASS} onClick={() => submit('pass')}>pass <kbd className="opacity-50">p</kbd></Btn>
              <Btn colour={REVISE} onClick={() => submit('revise')}>revise <kbd className="opacity-50">r</kbd></Btn>
              <Btn colour="#8b93a3" onClick={() => submit('note')} disabled={!words.trim()}>note only</Btn>
              <button onClick={nextUndecided}
                className="ml-auto px-3 py-1.5 rounded border border-white/15 text-white/60 text-sm hover:bg-white/5">
                next undecided <kbd className="opacity-50">u</kbd>
              </button>
            </div>
          </div>
        </section>

        {/* ── what this part is supposed to contain ────────────────────── */}
        <aside className="space-y-3 xl:max-h-[calc(100vh-150px)] xl:overflow-y-auto">
          <Box label="ON SCREEN">
            {active.text?.length
              ? <ul className="space-y-1">{active.text.map((t, i) =>
                  <li key={i} className="text-[13px] text-white/75 leading-snug">{t}</li>)}</ul>
              : <Dim>no text</Dim>}
          </Box>
          <Box label="AUDIO">
            <div className="font-mono text-[11px] text-white/60 space-y-0.5">
              <div>vo · {active.audio?.vo?.split('/').pop() ?? 'none'}
                {active.audio?.vo_frames ? ` (${active.audio.vo_frames}f)` : ''}</div>
              <div>bed · {active.audio?.bed?.split('/').pop() ?? 'none'}</div>
            </div>
          </Box>
          {!!active.clips?.length && (
            <Box label="CLIPS">
              <div className="flex flex-wrap gap-1">{active.clips.map((c) =>
                <span key={c} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/55">{c}</span>)}</div>
            </Box>
          )}
          {active.budget?.designed != null && (
            <Box label="BUDGET">
              <div className="font-mono text-[11px] text-white/60">
                {active.frames}f rendered · {active.budget.designed}f designed
                {active.budget.grew_for_read && <div style={{ color: ACCENT }}>grew to fit the read</div>}
                {active.budget.fixed && <div className="text-white/40">fixed length</div>}
              </div>
            </Box>
          )}
          <Box label="KEYS">
            <div className="font-mono text-[11px] text-white/45 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <b className="text-white/70">space</b><span>play / pause</span>
              <b className="text-white/70">j k</b><span>previous / next part</span>
              <b className="text-white/70">, .</b><span>step one frame</span>
              <b className="text-white/70">p r</b><span>pass / revise</span>
              <b className="text-white/70">n</b><span>write a note</span>
              <b className="text-white/70">u</b><span>next undecided</span>
              <b className="text-white/70">l</b><span>toggle loop</span>
            </div>
          </Box>
        </aside>
      </div>

      {flash && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded bg-black border border-[#22d3ee]/50 font-mono text-xs text-[#22d3ee]">
          {flash}
        </div>
      )}
    </Frame>
  );
}

function Frame({ children, title, right }: { children: React.ReactNode; title?: string; right?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#05070f] text-[#e8eaf0]">
      <header className="border-b border-white/10 px-5 py-2.5 flex items-center gap-4">
        <Link to="/" className="font-mono text-[11px] tracking-widest text-white/40 hover:text-white">← ALL</Link>
        <span className="font-semibold text-sm">{title ?? 'Reviewer'}</span>
        <div className="ml-auto">{right}</div>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}

const Box = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="rounded border border-white/10 bg-white/[0.03] p-3">
    <div className="font-mono text-[10px] tracking-[0.18em] text-white/35 mb-2">{label}</div>
    {children}
  </div>
);
const Dim = ({ children }: { children: React.ReactNode }) => (
  <p className="font-mono text-[11px] text-white/25">{children}</p>
);
const Key = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button onClick={onClick} className="px-1.5 py-0.5 rounded border border-white/15 text-white/60 hover:bg-white/10">{children}</button>
);
const Btn = ({ children, colour, onClick, disabled }: {
  children: React.ReactNode; colour: string; onClick: () => void; disabled?: boolean;
}) => (
  <button onClick={onClick} disabled={disabled}
    className="px-3 py-1.5 rounded border text-sm font-semibold disabled:opacity-30 transition"
    style={{ borderColor: `${colour}66`, color: colour, background: `${colour}14` }}>
    {children}
  </button>
);
