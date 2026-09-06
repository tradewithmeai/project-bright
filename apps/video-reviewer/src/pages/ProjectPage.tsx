import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import type { Slot, ReviewEvent, RenderJob, Asset } from '../types';
import { useProject } from '../hooks/useProject';
import { TimelineEditor } from '../components/TimelineEditor';
import type { TimelineSlot } from '../components/TimelineEditor';
import { StoryboardStrip } from '../components/StoryboardStrip';
import { SlotPanel } from '../components/SlotPanel';
import { ProjectSidebar } from '../components/ProjectSidebar';
import { slotsApi, renderJobsApi, assetsApi } from '../api';
import { useAuth } from '../hooks/useAuth';
import { canManage, isSuperAdmin } from '../utils/permissions';

type ViewMode = 'timeline' | 'grid';

function toTimelineSlot(slot: Slot, assetMap: Map<number, Asset>): TimelineSlot {
  const asset = slot.selected_asset_id ? assetMap.get(slot.selected_asset_id) : undefined;
  return {
    id: slot.id,
    slot_key: slot.slot_key,
    slot_type: slot.slot_type,
    position: slot.position,
    role_label: slot.role_label,
    max_duration_seconds: slot.max_duration_seconds,
    target_duration_seconds: slot.target_duration_seconds,
    status: slot.status,
    enabled: slot.enabled,
    render_status: slot.render_status,
    trim_start_seconds: slot.trim_start_seconds,
    trim_end_seconds: slot.trim_end_seconds,
    selected_asset_id: slot.selected_asset_id,
    asset_duration_seconds: asset?.duration_seconds ?? null,
    asset_file_path: asset?.file_path ?? null,
    asset_type: asset?.asset_type ?? null,
  };
}

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = Number(id);
  const { user } = useAuth();
  const { project, slots, events, loading, error, refresh, updateSlotInState, setProject } = useProject(projectId);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [renderJobs, setRenderJobs] = useState<RenderJob[]>([]);
  const [renderLoading, setRenderLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Asset map for enriching timeline slots
  const [assetMap, setAssetMap] = useState<Map<number, Asset>>(new Map());

  const canRender = user ? canManage(user.role) : false;

  // Batch-fetch selected assets not yet in the map
  // Note: assetMap intentionally omitted from deps to prevent fetch loop
  useEffect(() => {
    const ids = slots
      .map(s => s.selected_asset_id)
      .filter((aid): aid is number => aid != null && !assetMap.has(aid));
    if (ids.length === 0) return;
    Promise.all(ids.map(aid => assetsApi.get(aid).then(a => [aid, a] as const)))
      .then(pairs => setAssetMap(prev => {
        const next = new Map(prev);
        for (const [aid, a] of pairs) next.set(aid, a);
        return next;
      }))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  const loadRenderJobs = useCallback(async () => {
    try {
      const jobs = await renderJobsApi.list(projectId);
      setRenderJobs(jobs);
    } catch { /* non-fatal */ }
  }, [projectId]);

  useEffect(() => {
    loadRenderJobs();
  }, [loadRenderJobs]);

  // Poll while active jobs exist
  useEffect(() => {
    const hasActive = renderJobs.some(j => j.status === 'queued' || j.status === 'rendering');
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(loadRenderJobs, 5000);
    } else if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [renderJobs, loadRenderJobs]);

  async function handleCreateRender(mode: 'preview' | 'final') {
    setRenderLoading(true);
    try {
      await renderJobsApi.create(projectId, mode);
      await loadRenderJobs();
    } catch (err: unknown) {
      let message = 'Failed to create render job';
      if (err instanceof Error) {
        const body = (err as any).body;
        const details: string[] = Array.isArray(body?.details) ? body.details : [];
        message = details.length ? `${err.message}: ${details.join(', ')}` : err.message;
      }
      // Add a synthetic failed entry to the job list so it appears in context
      const synthetic: RenderJob = {
        id: -Date.now(),
        project_id: projectId,
        render_mode: mode,
        status: 'failed',
        output_path: null,
        error_message: message,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setRenderJobs(prev => [synthetic, ...prev]);
    } finally {
      setRenderLoading(false);
    }
  }

  const handleSlotUpdated = useCallback((updated: Slot) => {
    updateSlotInState(updated);
    setSelectedSlot(prev => prev?.id === updated.id ? updated : prev);
  }, [updateSlotInState]);

  const handleNewEvent = useCallback((_e: ReviewEvent) => {
    refresh();
  }, [refresh]);

  // Auto-open slot panel when returning from brand assets page (?slot=N)
  useEffect(() => {
    const slotId = Number(searchParams.get('slot'));
    if (!slotId || slots.length === 0) return;
    const found = slots.find(s => s.id === slotId);
    if (found) setSelectedSlot(found);
  }, [searchParams, slots]);

  const handleSelectSlot = useCallback((slot: Slot) => {
    setSelectedSlot(prev => prev?.id === slot.id ? null : slot);
  }, []);

  const handleSelectSlotById = useCallback((slotId: number) => {
    const slot = slots.find(s => s.id === slotId) ?? null;
    setSelectedSlot(prev => prev?.id === slotId ? null : slot);
  }, [slots]);

  const handleDurationChange = useCallback(async (slotId: number, newDuration: number) => {
    try {
      const updated = await slotsApi.update(projectId, slotId, {
        target_duration_seconds: Math.round(newDuration * 10) / 10,
      });
      handleSlotUpdated(updated);
    } catch {
      // Non-critical — silently ignore
    }
  }, [projectId, handleSlotUpdated]);

  const handleTrimChange = useCallback(async (
    slotId: number,
    trim: { trim_start_seconds?: number | null; trim_end_seconds?: number | null }
  ) => {
    try {
      const updated = await slotsApi.update(projectId, slotId, trim);
      handleSlotUpdated(updated);
    } catch (err) {
      console.warn('[trim] PATCH failed, keeping local override:', err);
    }
  }, [projectId, handleSlotUpdated]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-400">
        {error || 'Project not found'}
      </div>
    );
  }

  const timelineSlots = slots.map(s => toTimelineSlot(s, assetMap));

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      {/* Top nav */}
      <header data-demo="project-header" className="bg-gray-900 border-b border-gray-800 px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => navigate('/projects')}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          ← Projects
        </button>
        {user && isSuperAdmin(user.role) && (
          <button
            onClick={() => navigate('/dev')}
            className="text-xs font-mono text-green-600 hover:text-green-400 border border-green-900 hover:border-green-700 px-2 py-0.5 rounded transition-colors"
          >
            ⚡ Dev
          </button>
        )}
        <span className="text-gray-700">/</span>
        <span className="text-sm font-medium text-gray-200 truncate">{project.title}</span>

        {/* View mode toggle */}
        <div data-demo="view-toggle" className="ml-auto flex rounded overflow-hidden border border-gray-700">
          {(['timeline', 'grid'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-xs font-medium capitalize transition-colors ${
                viewMode === mode
                  ? 'bg-indigo-700 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              {mode === 'timeline' ? '⟷ Timeline' : '⊞ Grid'}
            </button>
          ))}
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <ProjectSidebar
          project={project}
          events={events}
          onProjectUpdated={setProject}
          onNewEvent={handleNewEvent}
        />

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-4 min-w-0">
          {viewMode === 'timeline' ? (
            <div data-demo="timeline-editor">
            <TimelineEditor
              slots={timelineSlots}
              selectedSlotId={selectedSlot?.id ?? null}
              onSlotSelect={handleSelectSlotById}
              onDurationChange={handleDurationChange}
              onTrimChange={handleTrimChange}
            />
            </div>
          ) : (
            <StoryboardStrip
              slots={slots}
              selectedSlotId={selectedSlot?.id ?? null}
              onSelectSlot={handleSelectSlot}
              assetMap={assetMap}
            />
          )}

          {/* ── Render Panel ─────────────────────────────────────── */}
          {canRender && (
            <div data-demo="render-panel" className="mt-4 rounded-lg border border-gray-800 bg-gray-900 p-4">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">Render</h3>

              {(() => {
                const isActive = renderJobs.some(j => j.status === 'queued' || j.status === 'rendering');
                return (
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => handleCreateRender('preview')}
                      disabled={renderLoading || isActive}
                      className="px-4 py-2 rounded bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40
                        text-xs font-medium transition-colors"
                    >
                      Generate Preview
                    </button>
                    <button
                      onClick={() => handleCreateRender('final')}
                      disabled={renderLoading || isActive}
                      className="px-4 py-2 rounded bg-green-800 hover:bg-green-700 disabled:opacity-40
                        text-xs font-medium transition-colors"
                    >
                      Generate Final
                    </button>
                    {isActive && (
                      <span className="text-xs text-yellow-400 self-center">Render in progress…</span>
                    )}
                  </div>
                );
              })()}

              <p className="text-xs text-gray-600 mb-3">Rendering may take a minute for large projects.</p>

              {renderJobs.length > 0 && (
                <div className="space-y-2">
                  {renderJobs.slice(0, 5).map(job => (
                    <div key={job.id} className="flex items-center gap-3 p-2 bg-gray-800 rounded border border-gray-700 text-xs">
                      <span className={`px-1.5 py-0.5 rounded font-medium ${
                        job.render_mode === 'final' ? 'bg-green-900 text-green-300' : 'bg-indigo-900 text-indigo-300'
                      }`}>
                        {job.render_mode}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded font-medium ${
                        job.status === 'complete'  ? 'bg-blue-900 text-blue-300'     :
                        job.status === 'failed'    ? 'bg-red-900 text-red-300'       :
                        job.status === 'rendering' ? 'bg-yellow-900 text-yellow-300' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {job.status}
                      </span>
                      <span className="text-gray-500 flex-1">
                        {new Date(job.created_at).toLocaleString()}
                      </span>
                      {job.status === 'complete' && job.output_path && (
                        <a
                          href={`/uploads/${job.output_path}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 underline"
                        >
                          View render
                        </a>
                      )}
                      {job.status === 'failed' && job.error_message && (
                        <span className="text-red-400 truncate max-w-xs" title={job.error_message}>
                          {job.error_message.slice(0, 80)}
                        </span>
                      )}
                      {(job.status === 'complete' || job.status === 'failed') && job.id > 0 && (
                        <button
                          onClick={async () => {
                            try {
                              await renderJobsApi.delete(projectId, job.id);
                              setRenderJobs(prev => prev.filter(j => j.id !== job.id));
                            } catch { /* non-fatal */ }
                          }}
                          className="ml-1 text-gray-600 hover:text-red-400 transition-colors leading-none"
                          title="Delete this job"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* Right slot panel */}
        {selectedSlot && (
          <div className="w-80 flex-shrink-0 overflow-hidden">
            <SlotPanel
              slot={selectedSlot}
              projectId={projectId}
              companySlug={project?.company_slug}
              events={events}
              onSlotUpdated={handleSlotUpdated}
              onNewEvent={handleNewEvent}
              onClose={() => setSelectedSlot(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
