import { useState, useRef, useCallback, useEffect } from 'react';

export interface TimelineSlot {
  id: number;
  slot_key: string;
  slot_type: 'still' | 'video';
  position: number;
  role_label: string;
  max_duration_seconds: number;
  target_duration_seconds: number | null;
  status: string;
  enabled: boolean;
  render_status: string;
  // Stage 2 additions
  trim_start_seconds: number | null;
  trim_end_seconds: number | null;
  selected_asset_id: number | null;
  asset_duration_seconds: number | null;
  asset_file_path: string | null;
  asset_type: 'still' | 'video' | null;
}

interface TimelineEditorProps {
  slots: TimelineSlot[];
  selectedSlotId: number | null;
  onSlotSelect: (slotId: number) => void;
  onDurationChange: (slotId: number, newDuration: number) => void;
  onTrimChange: (slotId: number, trim: {
    trim_start_seconds?: number | null;
    trim_end_seconds?: number | null;
  }) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const BASE_PX_PER_SEC = 60;
const CARD_HEIGHT = 76;
const RULER_HEIGHT = 28;
const HANDLE_W = 10;
const ZOOM_LEVELS = [0.5, 0.75, 1, 1.5, 2];
const ZOOM_LABELS = ['50%', '75%', '100%', '150%', '200%'];

// ─── Drag types ───────────────────────────────────────────────────────────────
type DragType = 'still-right' | 'video-left' | 'video-right';

interface DragState {
  type: DragType;
  slotId: number;
  startX: number;
  startValue: number;
}

// ─── Override maps ────────────────────────────────────────────────────────────
interface DragOverrides {
  still: Map<number, number>;
  trimStart: Map<number, number>;
  trimEnd: Map<number, number>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PLACEHOLDER_DURATION = 3;

function effectiveDuration(slot: TimelineSlot, ov: DragOverrides): number {
  if (slot.slot_type === 'still') {
    return ov.still.get(slot.id) ?? slot.target_duration_seconds ?? PLACEHOLDER_DURATION;
  }
  if (!slot.selected_asset_id) return PLACEHOLDER_DURATION;
  const start = ov.trimStart.get(slot.id) ?? slot.trim_start_seconds ?? 0;
  const clipLen = slot.asset_duration_seconds ?? slot.max_duration_seconds;
  const end = ov.trimEnd.get(slot.id) ?? slot.trim_end_seconds ?? clipLen;
  return Math.max(0.1, end - start);
}

function summariseSlots(slots: TimelineSlot[]) {
  const enabled = slots.filter(s => s.enabled);
  return {
    ready:    enabled.filter(s => s.render_status === 'ready').length,
    notReady: enabled.filter(s => s.render_status === 'not_ready' && !!s.selected_asset_id).length,
    missing:  enabled.filter(s => !s.selected_asset_id).length,
    total:    enabled.length,
  };
}

function slotBaseColor(slot: TimelineSlot): string {
  return slot.slot_type === 'video'
    ? 'from-purple-950 to-purple-900 border-purple-700'
    : 'from-sky-950 to-sky-900 border-sky-700';
}

function statusOverlay(status: string): string {
  switch (status) {
    case 'approved':                  return 'bg-green-500/10';
    case 'rejected':                  return 'bg-red-500/15';
    case 'ready_for_review':          return 'bg-yellow-500/10';
    case 'approved_for_generation':   return 'bg-indigo-500/10';
    case 'generated':                 return 'bg-purple-500/10';
    case 'empty':                     return 'opacity-50';
    default:                          return '';
  }
}

function statusDot(status: string): string {
  switch (status) {
    case 'approved':                  return 'bg-green-400';
    case 'rejected':                  return 'bg-red-500';
    case 'ready_for_review':          return 'bg-yellow-400';
    case 'approved_for_generation':   return 'bg-indigo-400';
    case 'generated':                 return 'bg-purple-400';
    case 'briefed':                   return 'bg-blue-400';
    default:                          return 'bg-gray-600';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function TimelineEditor({
  slots,
  selectedSlotId,
  onSlotSelect,
  onDurationChange,
  onTrimChange,
}: TimelineEditorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [overrides, setOverrides] = useState<DragOverrides>({
    still: new Map(),
    trimStart: new Map(),
    trimEnd: new Map(),
  });
  const [dragging, setDragging] = useState<DragState | null>(null);

  const pxPerSec = BASE_PX_PER_SEC * zoom;

  // Seed overrides from slots prop — skip slots currently being dragged (preserves live drag)
  useEffect(() => {
    setOverrides(prev => {
      const still    = new Map(prev.still);
      const trimStart = new Map(prev.trimStart);
      const trimEnd   = new Map(prev.trimEnd);
      for (const s of slots) {
        const isDragging = dragging?.slotId === s.id;
        if (s.slot_type === 'still') {
          if (!isDragging) {
            still.set(s.id, s.target_duration_seconds ?? s.max_duration_seconds);
          }
        } else if (s.selected_asset_id) {
          if (!isDragging) {
            trimStart.set(s.id, s.trim_start_seconds ?? 0);
            const clipLen = s.asset_duration_seconds ?? s.max_duration_seconds;
            trimEnd.set(s.id, s.trim_end_seconds ?? clipLen);
          }
        }
      }
      return { still, trimStart, trimEnd };
    });
  }, [slots, dragging]);

  const ordered = [...slots].sort((a, b) => a.position - b.position);

  const totalDuration = ordered
    .filter(s => s.enabled)
    .reduce((sum, s) => sum + effectiveDuration(s, overrides), 0);
  const visualDuration = ordered.reduce((sum, s) => sum + effectiveDuration(s, overrides), 0);
  const totalWidth = Math.max(visualDuration * pxPerSec + 120, 800);

  const ruleTicks = (() => {
    const ticks: { sec: number; major: boolean }[] = [];
    const step = pxPerSec < 30 ? 5 : pxPerSec < 60 ? 2 : 1;
    for (let s = 0; s <= Math.ceil(totalDuration) + 2; s += step) {
      ticks.push({ sec: s, major: s % (step * 5) === 0 });
    }
    return ticks;
  })();

  // ── Drag handlers ───────────────────────────────────────────────────────────
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, slot: TimelineSlot, type: DragType) => {
      if (!slot.enabled) return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      let startValue: number;
      if (type === 'still-right') {
        startValue = overrides.still.get(slot.id) ?? slot.target_duration_seconds ?? slot.max_duration_seconds;
      } else if (type === 'video-left') {
        startValue = overrides.trimStart.get(slot.id) ?? slot.trim_start_seconds ?? 0;
      } else {
        const clipLen = slot.asset_duration_seconds ?? slot.max_duration_seconds;
        startValue = overrides.trimEnd.get(slot.id) ?? slot.trim_end_seconds ?? clipLen;
      }
      setDragging({ type, slotId: slot.id, startX: e.clientX, startValue });
    },
    [overrides],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const slot = ordered.find(s => s.id === dragging.slotId);
      if (!slot) return;
      const delta = (e.clientX - dragging.startX) / pxPerSec;
      const raw = dragging.startValue + delta;

      if (dragging.type === 'still-right') {
        const v = Math.round(Math.max(0.5, Math.min(slot.max_duration_seconds, raw)) * 10) / 10;
        setOverrides(prev => ({ ...prev, still: new Map(prev.still).set(slot.id, v) }));

      } else if (dragging.type === 'video-left') {
        const currentEnd = overrides.trimEnd.get(slot.id) ?? slot.trim_end_seconds
          ?? slot.asset_duration_seconds ?? slot.max_duration_seconds;
        const v = Math.round(Math.max(0, Math.min(currentEnd - 0.1, raw)) * 10) / 10;
        setOverrides(prev => ({ ...prev, trimStart: new Map(prev.trimStart).set(slot.id, v) }));

      } else {
        const currentStart = overrides.trimStart.get(slot.id) ?? slot.trim_start_seconds ?? 0;
        const maxEnd = slot.asset_duration_seconds ?? slot.max_duration_seconds;
        const v = Math.round(Math.max(currentStart + 0.1, Math.min(maxEnd, raw)) * 10) / 10;
        setOverrides(prev => ({ ...prev, trimEnd: new Map(prev.trimEnd).set(slot.id, v) }));
      }
    },
    [dragging, pxPerSec, ordered, overrides],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      if (dragging.type === 'still-right') {
        onDurationChange(dragging.slotId, overrides.still.get(dragging.slotId) ?? dragging.startValue);
      } else if (dragging.type === 'video-left') {
        onTrimChange(dragging.slotId, {
          trim_start_seconds: overrides.trimStart.get(dragging.slotId) ?? dragging.startValue,
        });
      } else {
        onTrimChange(dragging.slotId, {
          trim_end_seconds: overrides.trimEnd.get(dragging.slotId) ?? dragging.startValue,
        });
      }
      setDragging(null);
    },
    [dragging, overrides, onDurationChange, onTrimChange],
  );

  // ── Fit to window ───────────────────────────────────────────────────────────
  function handleFitToWindow() {
    const enabled = ordered.filter(s => s.enabled);
    if (enabled.length === 0) return;
    // Span from first slot up to (and including) the last enabled slot.
    // Disabled slots within that span are included so gaps are preserved.
    const lastEnabledIdx = ordered.indexOf(enabled[enabled.length - 1]);
    const spanDuration = ordered
      .slice(0, lastEnabledIdx + 1)
      .reduce((sum, s) => sum + effectiveDuration(s, overrides), 0);
    if (spanDuration <= 0) return;
    const w = scrollRef.current?.clientWidth ?? 800;
    const ideal = (w - 120) / spanDuration / BASE_PX_PER_SEC;
    const clamped = Math.max(ZOOM_LEVELS[0], Math.min(ZOOM_LEVELS[ZOOM_LEVELS.length - 1], ideal));
    setZoom(clamped);
  }

  const zoomIdx = ZOOM_LEVELS.findIndex(z => z >= zoom);
  const { ready, notReady, missing, total } = summariseSlots(ordered);

  return (
    <div className="flex flex-col bg-gray-950 border border-gray-800 rounded-xl overflow-hidden select-none">
      {/* ── Controls bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Timeline</span>
          <div className="h-3 w-px bg-gray-700" />
          <span className="font-mono text-sm text-gray-200 tabular-nums">
            Total <span className="text-indigo-400 font-bold">{totalDuration.toFixed(1)}s</span>
          </span>
          {dragging && (() => {
            if (dragging.type === 'still-right')
              return (
                <span className="text-[10px] font-mono text-yellow-400 animate-pulse">
                  ● {(overrides.still.get(dragging.slotId) ?? 0).toFixed(1)}s
                </span>
              );
            if (dragging.type === 'video-left')
              return (
                <span className="text-[10px] font-mono text-yellow-400 animate-pulse">
                  in → {(overrides.trimStart.get(dragging.slotId) ?? 0).toFixed(1)}s
                </span>
              );
            return (
              <span className="text-[10px] font-mono text-yellow-400 animate-pulse">
                out → {(overrides.trimEnd.get(dragging.slotId) ?? 0).toFixed(1)}s
              </span>
            );
          })()}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(ZOOM_LEVELS[Math.max(0, zoomIdx - 1)])}
            disabled={zoomIdx === 0}
            className="w-6 h-6 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30
              text-gray-300 text-sm font-mono flex items-center justify-center transition-colors"
          >−</button>

          <div className="flex rounded overflow-hidden border border-gray-700">
            {ZOOM_LEVELS.map((z, i) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`px-2 py-1 text-[10px] font-mono transition-colors ${
                  zoom === z
                    ? 'bg-indigo-700 text-white'
                    : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                }`}
              >
                {ZOOM_LABELS[i]}
              </button>
            ))}
          </div>

          <button
            onClick={() => setZoom(ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, zoomIdx + 1)])}
            disabled={zoomIdx === ZOOM_LEVELS.length - 1}
            className="w-6 h-6 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30
              text-gray-300 text-sm font-mono flex items-center justify-center transition-colors"
          >+</button>

          <div className="h-4 w-px bg-gray-700" />

          <button
            onClick={handleFitToWindow}
            className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-[10px] text-gray-400
              hover:text-gray-200 font-mono uppercase tracking-wide transition-colors"
          >
            Fit
          </button>
        </div>
      </div>

      {/* ── Readiness summary bar ────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-4 py-1 bg-gray-900/60 border-b border-gray-800 text-[10px] font-mono flex-shrink-0">
        <span className="text-green-400">● {ready} ready</span>
        {notReady > 0 && <span className="text-yellow-400">◌ {notReady} not ready</span>}
        {missing > 0  && <span className="text-orange-400">▲ {missing} missing asset</span>}
        <span className="text-gray-600 ml-auto">{total} slots · {totalDuration.toFixed(1)}s total</span>
      </div>

      {/* ── Scrollable timeline ──────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-hidden"
        style={{ cursor: dragging ? 'col-resize' : 'default' }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          ref={containerRef}
          style={{ width: totalWidth, position: 'relative' }}
        >
          {/* ── Ruler ─────────────────────────────────────────────────────── */}
          <div
            className="relative bg-gray-900 border-b border-gray-700"
            style={{ height: RULER_HEIGHT }}
          >
            {ruleTicks.filter(t => t.major).map(({ sec }) => (
              <div
                key={sec}
                className="absolute top-0 bottom-0 w-px bg-gray-800"
                style={{ left: sec * pxPerSec }}
              />
            ))}
            {ruleTicks.map(({ sec, major }) => (
              <div
                key={sec}
                className="absolute bottom-0 flex flex-col items-center"
                style={{ left: sec * pxPerSec }}
              >
                <div className={`w-px ${major ? 'h-3 bg-gray-500' : 'h-1.5 bg-gray-700'}`} />
                {major && (
                  <span
                    className="absolute bottom-full mb-0.5 text-[9px] font-mono text-gray-500 whitespace-nowrap"
                    style={{ transform: 'translateX(-50%)' }}
                  >
                    {sec}s
                  </span>
                )}
              </div>
            ))}
            <div className="absolute top-0 bottom-0 w-px bg-indigo-500/40" style={{ left: 0 }} />
          </div>

          {/* ── Track ─────────────────────────────────────────────────────── */}
          <div
            className="relative flex"
            style={{ height: CARD_HEIGHT + 16, paddingTop: 8, paddingBottom: 8 }}
          >
            {/* Background grid lines */}
            {ruleTicks.filter(t => t.major).map(({ sec }) => (
              <div
                key={sec}
                className="absolute top-0 bottom-0 w-px bg-gray-800/60 pointer-events-none"
                style={{ left: sec * pxPerSec }}
              />
            ))}

            {/* Slot cards */}
            {ordered.map(slot => {
              const dur = effectiveDuration(slot, overrides);
              const width = dur * pxPerSec;
              const isSelected = slot.id === selectedSlotId;
              const isDraggingThis = dragging?.slotId === slot.id;

              // Readiness left border
              const readinessBorder =
                slot.render_status === 'ready'    ? 'border-l-2 border-l-green-400'  :
                slot.render_status === 'complete' ? 'border-l-2 border-l-blue-400'   :
                slot.render_status === 'failed'   ? 'border-l-2 border-l-red-500'    :
                (slot.render_status === 'rendering' || slot.render_status === 'queued')
                                                  ? 'border-l-2 border-l-yellow-400' :
                !slot.selected_asset_id           ? 'border-l-2 border-l-orange-500' :
                'border-l-2 border-l-gray-700';

              return (
                <div
                  key={slot.id}
                  data-slot-id={slot.id}
                  title={`${slot.role_label} · ${dur.toFixed(1)}s`}
                  style={{
                    width,
                    height: CARD_HEIGHT,
                    position: 'relative',
                    flexShrink: 0,
                    transition: isDraggingThis ? 'none' : 'width 0.08s ease',
                  }}
                  className={`
                    relative flex flex-col justify-between overflow-hidden
                    border-r border-gray-700/50 cursor-pointer
                    bg-gradient-to-b ${slotBaseColor(slot)}
                    ${readinessBorder}
                    ${isSelected ? 'ring-2 ring-indigo-400 ring-inset z-10' : ''}
                    ${isDraggingThis ? 'brightness-110' : ''}
                  `}
                  onClick={() => onSlotSelect(slot.id)}
                >
                  {/* Status colour wash */}
                  <div className={`absolute inset-0 pointer-events-none ${statusOverlay(slot.status)}`} />

                  {/* Disabled overlay */}
                  {!slot.enabled && (
                    <div className="absolute inset-0 pointer-events-none bg-red-900/60 z-20 flex items-center justify-center">
                      <span className="text-[9px] font-mono text-red-300 uppercase tracking-widest">disabled</span>
                    </div>
                  )}

                  {/* Top stripe — type colour */}
                  <div className={`h-0.5 w-full flex-shrink-0 ${
                    slot.slot_type === 'video' ? 'bg-purple-500' : 'bg-sky-500'
                  }`} />

                  {/* Card body */}
                  <div className="flex-1 flex flex-col justify-between px-2 py-1.5 min-w-0">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex flex-col min-w-0">
                        <span className="font-mono text-[9px] text-gray-400 uppercase tracking-widest leading-none mb-0.5">
                          {slot.slot_key}
                        </span>
                        {!slot.selected_asset_id && (
                          <span className="text-[9px] text-orange-500/70 font-mono">⊘ no asset</span>
                        )}
                        {width > 90 && slot.selected_asset_id && (
                          <span className="text-[10px] text-gray-200 leading-tight truncate">
                            {slot.role_label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Thumbnail */}
                        {slot.asset_file_path && width > 80 && (
                          <img
                            src={`/uploads/${slot.asset_file_path}`}
                            alt=""
                            className="w-8 h-6 object-cover rounded flex-shrink-0 opacity-70"
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                        {/* Type icon */}
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded leading-none ${
                          slot.slot_type === 'video'
                            ? 'bg-purple-800/80 text-purple-300'
                            : 'bg-sky-800/80 text-sky-300'
                        }`}>
                          {slot.slot_type === 'video' ? '▶' : '⬛'}
                        </span>
                        {/* Status dot */}
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot(slot.status)}`} />
                      </div>
                    </div>

                    {/* Duration / trim row */}
                    <div className="flex items-end justify-between">
                      {slot.slot_type === 'still' ? (
                        <>
                          <span className="font-mono text-[10px] text-gray-300 tabular-nums">
                            {dur.toFixed(1)}s
                          </span>
                          {width > 100 && (
                            <span className="text-[9px] text-gray-500 capitalize">
                              {slot.status.replace(/_/g, ' ')}
                            </span>
                          )}
                        </>
                      ) : (() => {
                        const start = overrides.trimStart.get(slot.id) ?? slot.trim_start_seconds;
                        const clipLen = slot.asset_duration_seconds ?? slot.max_duration_seconds;
                        const end = overrides.trimEnd.get(slot.id) ?? slot.trim_end_seconds ?? clipLen;
                        const eff = effectiveDuration(slot, overrides);
                        const hasTrim = start != null || slot.trim_end_seconds != null;
                        return (
                          <div className="flex flex-col">
                            {hasTrim && width > 80 && (
                              <span className="font-mono text-[8px] text-gray-500 tabular-nums">
                                {(start ?? 0).toFixed(1)}→{end.toFixed(1)}s
                              </span>
                            )}
                            <span className="font-mono text-[10px] text-gray-300 tabular-nums">
                              {eff.toFixed(1)}s
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* ── Left drag handle (video in-point) ─────────────────── */}
                  {slot.slot_type === 'video' && (
                    <div
                      className={`absolute top-0 bottom-0 left-0 flex items-center justify-center
                        cursor-col-resize group z-20 hover:bg-indigo-500/20 transition-colors
                        ${dragging?.slotId === slot.id && dragging.type === 'video-left' ? 'bg-indigo-500/30' : ''}`}
                      style={{ width: HANDLE_W }}
                      onPointerDown={e => handlePointerDown(e, slot, 'video-left')}
                      onClick={e => e.stopPropagation()}
                      title="Drag to adjust in-point (changes effective duration)"
                    >
                      <div className={`flex flex-col gap-0.5 transition-opacity
                        ${dragging?.slotId === slot.id && dragging.type === 'video-left'
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100'}`}>
                        {[0, 1, 2].map(i => (
                          <div key={i} className="w-0.5 h-0.5 rounded-full bg-indigo-400" />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Right drag handle (still resize / video out-point) ── */}
                  {!(slot.slot_type === 'video' && !slot.asset_duration_seconds) && (
                    <div
                      className={`
                        absolute top-0 bottom-0 right-0 flex items-center justify-center
                        cursor-col-resize group z-20
                        hover:bg-indigo-500/20 transition-colors
                        ${isDraggingThis && dragging?.type !== 'video-left' ? 'bg-indigo-500/30' : ''}
                      `}
                      style={{ width: HANDLE_W }}
                      onPointerDown={e => handlePointerDown(e, slot, slot.slot_type === 'video' ? 'video-right' : 'still-right')}
                      onClick={e => e.stopPropagation()}
                      title={slot.slot_type === 'video' ? 'Drag to adjust out-point' : 'Drag to resize'}
                    >
                      <div className={`flex flex-col gap-0.5 transition-opacity ${
                        isDraggingThis && dragging?.type !== 'video-left' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}>
                        {[0, 1, 2].map(i => (
                          <div key={i} className="w-0.5 h-0.5 rounded-full bg-indigo-400" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* End cap */}
            <div
              className="flex-shrink-0 flex items-center px-4 text-gray-700"
              style={{ width: 80 }}
            >
              <span className="font-mono text-xs">∎</span>
            </div>
          </div>

          {/* ── Duration readout strip ────────────────────────────────────── */}
          <div className="flex items-center border-t border-gray-800 bg-gray-900/50 px-2 py-1">
            {ordered.map(slot => {
              const dur = effectiveDuration(slot, overrides);
              const width = dur * pxPerSec;
              return (
                <div
                  key={slot.id}
                  className="flex-shrink-0 flex items-center justify-center"
                  style={{ width }}
                >
                  {width > 50 && (
                    <span className={`font-mono text-[9px] tabular-nums ${
                      dragging?.slotId === slot.id ? 'text-yellow-400' : 'text-gray-600'
                    }`}>
                      {dur.toFixed(1)}s
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-4 py-1.5 bg-gray-900/30 border-t border-gray-800/60 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-3 rounded-sm bg-green-400" />
          <span className="text-[9px] text-gray-500 font-mono">Ready</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-3 rounded-sm bg-yellow-400" />
          <span className="text-[9px] text-gray-500 font-mono">Not ready</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-3 rounded-sm bg-orange-500" />
          <span className="text-[9px] text-gray-500 font-mono">Missing asset</span>
        </div>
        <div className="h-3 w-px bg-gray-700" />
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-sky-700" />
          <span className="text-[9px] text-gray-500 font-mono">⬛ Still</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-purple-700" />
          <span className="text-[9px] text-gray-500 font-mono">▶ Video</span>
        </div>
        <div className="h-3 w-px bg-gray-700" />
        {[
          { label: 'Approved', cls: 'bg-green-400' },
          { label: 'In Review', cls: 'bg-yellow-400' },
          { label: 'Generated', cls: 'bg-purple-400' },
          { label: 'Rejected', cls: 'bg-red-500' },
          { label: 'Empty', cls: 'bg-gray-600' },
        ].map(({ label, cls }) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${cls}`} />
            <span className="text-[9px] text-gray-600 font-mono">{label}</span>
          </div>
        ))}
        <span className="ml-auto text-[9px] text-gray-700 font-mono">drag ⟷ to edit</span>
      </div>
    </div>
  );
}
