import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Slot, ReviewEvent, Provider, Asset } from '../types';
import { slotsApi, providersApi, assetsApi } from '../api';

import { BriefFields } from './BriefFields';
import { AssetSection } from './AssetSection';
import { CommentThread } from './CommentThread';
import { SlotStatusBadge } from './StatusBadge';
import { CostBadge } from './CostBadge';
import { RunHistoryPanel } from './RunHistoryPanel';
import { useAuth } from '../hooks/useAuth';
import { canEdit, canReview } from '../utils/permissions';


interface Props {
  slot: Slot;
  projectId: number;
  companySlug?: string | null;
  events: ReviewEvent[];
  onSlotUpdated: (slot: Slot) => void;
  onNewEvent: (e: ReviewEvent) => void;
  onClose: () => void;
}

export function SlotPanel({ slot, projectId, companySlug, events, onSlotUpdated, onNewEvent, onClose }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [providers, setProviders] = useState<Provider[]>([]);
const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [trimStart, setTrimStart] = useState<string>(slot.trim_start_seconds != null ? String(slot.trim_start_seconds) : '');
  const [trimEnd, setTrimEnd] = useState<string>(slot.trim_end_seconds != null ? String(slot.trim_end_seconds) : '');
  const [trimError, setTrimError] = useState<string | null>(null);
  const [savingTrim, setSavingTrim] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const isEditor = user ? canEdit(user.role) : false;
  const isReviewer = user ? canReview(user.role) : false;

  useEffect(() => {
    providersApi.list(slot.slot_type).then(setProviders).catch(() => {});
  }, [slot.slot_type]);

  useEffect(() => {
    if (slot.selected_asset_id) {
      assetsApi.get(slot.selected_asset_id).then(setSelectedAsset).catch(() => setSelectedAsset(null));
    } else {
      setSelectedAsset(null);
    }
  }, [slot.selected_asset_id]);

  useEffect(() => {
    setTrimStart(slot.trim_start_seconds != null ? String(slot.trim_start_seconds) : '');
    setTrimEnd(slot.trim_end_seconds != null ? String(slot.trim_end_seconds) : '');
    setTrimError(null);
  }, [slot.id, slot.trim_start_seconds, slot.trim_end_seconds]);

  async function handleBriefSave(data: {
    headline: string; description: string; notes: string; target_duration_seconds: number | null;
  }) {
    const updated = await slotsApi.update(projectId, slot.id, data);
    onSlotUpdated(updated);
  }

  async function handleProviderChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value || null;
    const updated = await slotsApi.update(projectId, slot.id, { selected_provider: val });
    onSlotUpdated(updated);
  }

  async function handleSourceModeChange(mode: 'manual' | 'generated') {
    const updated = await slotsApi.update(projectId, slot.id, { source_mode: mode });
    onSlotUpdated(updated);
  }

async function handleAction(action: 'submit' | 'approve' | 'reject') {
    setActionLoading(true);
    setActionError(null);
    try {
      let updated: Slot;
      if (action === 'submit') {
        updated = await slotsApi.submitForReview(projectId, slot.id, confirmText || undefined);
      } else if (action === 'approve') {
        updated = await slotsApi.approve(projectId, slot.id, confirmText || undefined);
      } else {
        updated = await slotsApi.reject(projectId, slot.id, confirmText || undefined);
      }
      onSlotUpdated(updated);
      setConfirmText('');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAssetSelected(assetId: number) {
    const updated = await slotsApi.selectAsset(projectId, slot.id, assetId);
    onSlotUpdated(updated);
  }

  async function handleAssetDeselected() {
    const updated = await slotsApi.deselectAsset(projectId, slot.id);
    onSlotUpdated(updated);
  }

  async function handleFitModeChange(mode: 'contain' | 'cover') {
    const updated = await slotsApi.update(projectId, slot.id, { fit_mode: mode });
    onSlotUpdated(updated);
  }

  async function handleTrimSave() {
    const start = trimStart === '' ? null : Math.max(0, parseFloat(trimStart));
    const end = trimEnd === '' ? null : parseFloat(trimEnd);

    if (start != null && isNaN(start)) { setTrimError('In-point must be a number'); return; }
    if (end != null && isNaN(end))     { setTrimError('Out-point must be a number'); return; }
    if (end != null && end < 0)        { setTrimError('Out-point must be 0 or greater'); return; }
    if (start != null && end != null && end <= start) {
      setTrimError('Out-point must be after in-point');
      return;
    }
    const clipDuration = selectedAsset?.duration_seconds;
    if (end != null && clipDuration != null && end > clipDuration) {
      setTrimError(`Out-point (${end}s) exceeds clip duration (${clipDuration.toFixed(1)}s)`);
      return;
    }
    if (start != null && clipDuration != null && start >= clipDuration) {
      setTrimError(`In-point (${start}s) must be before clip duration (${clipDuration.toFixed(1)}s)`);
      return;
    }

    setSavingTrim(true);
    setTrimError(null);
    try {
      const updated = await slotsApi.update(projectId, slot.id, {
        trim_start_seconds: start,
        trim_end_seconds: end,
      });
      onSlotUpdated(updated);
    } catch (err: unknown) {
      setTrimError(err instanceof Error ? err.message : 'Failed to save trim points');
    } finally {
      setSavingTrim(false);
    }
  }

  const canSubmitForReview = isEditor && ['briefed', 'rejected'].includes(slot.status);
  const canApprove = isReviewer && ['ready_for_review', 'generated'].includes(slot.status);
  const canReject = isReviewer && ['ready_for_review', 'generated', 'approved_for_generation'].includes(slot.status);

  return (
    <div className="h-full flex flex-col bg-gray-900 border-l border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-500 uppercase">{slot.slot_key}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              slot.slot_type === 'video' ? 'bg-purple-900 text-purple-300' : 'bg-sky-900 text-sky-300'
            }`}>
              {slot.slot_type}
            </span>
            <SlotStatusBadge status={slot.status} />
          </div>
          <h3 className="text-sm font-semibold text-gray-100">{slot.role_label}</h3>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Max {slot.max_duration_seconds}s</span>
            <CostBadge amount={slot.estimated_cost} label="est" />
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 text-xl leading-none"
        >
          ×
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Brief */}
        <section data-demo="slot-brief">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Brief</h4>
          <BriefFields slot={slot} readOnly={!isEditor} onSave={handleBriefSave} />
        </section>

        {/* Source mode + provider */}
        {isEditor && (
          <section data-demo="slot-source">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Source</h4>
            <div className="flex rounded overflow-hidden border border-gray-700 mb-3">
              {(['manual', 'generated'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => handleSourceModeChange(mode)}
                  className={`flex-1 py-1.5 text-xs font-medium capitalize transition-colors ${
                    slot.source_mode === mode
                      ? 'bg-indigo-700 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {slot.source_mode === 'generated' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Provider</label>
                <select
                  value={slot.selected_provider ?? ''}
                  onChange={handleProviderChange}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm
                    text-gray-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">— select provider —</option>
                  {providers.map(p => (
                    <option key={p.key} value={p.key}>
                      {p.label}{p.supports_mock ? ' (mock available)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </section>
        )}

        {/* Generate */}
        {slot.source_mode === 'generated' && (
          <section data-demo="slot-generation">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Generation</h4>
            {slot.slot_type === 'still' ? (
              <button
                onClick={() => { setHistoryRefresh(n => n + 1); navigate(`/projects/${projectId}/generate?slot=${slot.id}`); }}
                className="w-full py-2 rounded bg-indigo-700 hover:bg-indigo-600
                  text-sm font-medium transition-colors"
              >
                Prompt &amp; Generate
              </button>
            ) : (
              <button
                onClick={() => { setHistoryRefresh(n => n + 1); navigate(`/projects/${projectId}/video-generate?slot=${slot.id}`); }}
                className="w-full py-2 rounded bg-purple-700 hover:bg-purple-600
                  text-sm font-medium transition-colors"
              >
                Prompt &amp; Generate
              </button>
            )}
          </section>
        )}

        {/* Generation History */}
        {slot.source_mode === 'generated' && (
          <section data-demo="slot-history">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">History</h4>
            <RunHistoryPanel
              slot={slot}
              projectId={projectId}
              selectedAssetId={slot.selected_asset_id ?? null}
              onAssetSelected={(assetId) => handleAssetSelected(assetId)}
              refreshTrigger={historyRefresh}
            />
          </section>
        )}

        {/* Assets */}
        <section data-demo="slot-assets">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Assets</h4>
            <div className="flex items-center gap-3">
              {(slot.slot_type === 'still' || slot.slot_type === 'video') && (
                <>
                  <a
                    href={`/brand-assets?projectId=${projectId}&slotId=${slot.id}&slotType=${slot.slot_type}#s-images`}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Brand images →
                  </a>
                  <a
                    href={`/media-library?projectId=${projectId}&slotId=${slot.id}&slotType=${slot.slot_type}${companySlug ? `&slug=${companySlug}` : ''}`}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Media library →
                  </a>
                </>
              )}
              <a
                href={`/brand-assets?projectId=${projectId}&slotId=${slot.id}&slotType=${slot.slot_type}#s-text`}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Brand text →
              </a>
            </div>
          </div>
          <AssetSection
            slot={slot}
            canEdit={isEditor}
            onAssetSelected={handleAssetSelected}
            onAssetDeselected={handleAssetDeselected}
            onRefresh={() => {}}
          />
        </section>

        {/* ── Render settings ─────────────────────────────────────── */}
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Render</h4>

          {/* Render status badge */}
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
              slot.render_status === 'ready'    ? 'bg-green-900 text-green-300' :
              slot.render_status === 'complete' ? 'bg-blue-900 text-blue-300'  :
              slot.render_status === 'failed'   ? 'bg-red-900 text-red-300'    :
              slot.render_status === 'rendering'|| slot.render_status === 'queued'
                                                ? 'bg-yellow-900 text-yellow-300' :
              'bg-gray-800 text-gray-500'
            }`}>
              {slot.render_status ?? 'not_ready'}
            </span>
          </div>

          {/* Selected asset info */}
          {selectedAsset && (
            <div className="mb-3 p-2 bg-gray-800 rounded border border-gray-700">
              {selectedAsset.asset_type === 'video' ? (
                <video
                  src={`/uploads/${selectedAsset.file_path}`}
                  className="w-full rounded"
                  controls
                  preload="metadata"
                />
              ) : (
                <img
                  src={`/uploads/${selectedAsset.file_path}`}
                  alt=""
                  className="w-full rounded object-contain max-h-64"
                />
              )}
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`text-xs font-medium ${
                  selectedAsset.asset_type === 'video' ? 'text-purple-300' : 'text-sky-300'
                }`}>
                  {selectedAsset.asset_type === 'video' ? '▶ Video' : '◻ Still'}
                </span>
                {selectedAsset.duration_seconds != null && (
                  <span className="text-xs text-gray-400">
                    {selectedAsset.duration_seconds.toFixed(1)}s
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Still: duration label */}
          {slot.slot_type === 'still' && (
            <p className="text-xs text-gray-500 mb-2">
              {slot.target_duration_seconds
                ? `This still will be held for ${slot.target_duration_seconds}s in the output.`
                : 'Set a display duration in the Brief section above.'}
            </p>
          )}

          {/* Video: trim in/out controls */}
          {slot.slot_type === 'video' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                In-point and out-point are seconds from the start of the clip.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">In-point (s)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={trimStart}
                    onChange={e => { setTrimStart(e.target.value); setTrimError(null); }}
                    onBlur={() => {
                      if (trimStart !== '' && parseFloat(trimStart) < 0) setTrimStart('0');
                    }}
                    placeholder="start"
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm
                      text-gray-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Out-point (s)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={trimEnd}
                    onChange={e => { setTrimEnd(e.target.value); setTrimError(null); }}
                    placeholder="end"
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm
                      text-gray-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Live effective duration */}
              {trimStart !== '' && trimEnd !== '' && (() => {
                const s = parseFloat(trimStart);
                const e = parseFloat(trimEnd);
                if (!isNaN(s) && !isNaN(e) && e > s) {
                  return <p className="text-xs text-gray-400">Effective duration: {(e - s).toFixed(1)}s</p>;
                }
                return null;
              })()}

              {!selectedAsset?.duration_seconds && (trimStart !== '' || trimEnd !== '') && (
                <p className="text-xs text-yellow-500">
                  Clip duration unknown — out-point validation is limited
                </p>
              )}

              {trimError && <p className="text-xs text-red-400">{trimError}</p>}

              <button
                onClick={handleTrimSave}
                disabled={savingTrim}
                className="w-full py-1.5 rounded bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40
                  text-xs font-medium transition-colors"
              >
                {savingTrim ? 'Saving…' : 'Save trim points'}
              </button>
            </div>
          )}

          {/* Fit mode */}
          <div className="mt-3">
            <label className="block text-xs text-gray-400 mb-1">Fit mode</label>
            <div className="flex rounded overflow-hidden border border-gray-700">
              {(['contain', 'cover'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => handleFitModeChange(mode)}
                  className={`flex-1 py-1.5 text-xs font-medium capitalize transition-colors ${
                    (slot.fit_mode ?? 'contain') === mode
                      ? 'bg-indigo-700 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Review actions */}
        {isReviewer && (
          <section data-demo="slot-review" className="border-t border-gray-800 pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Review</h4>
            {(canSubmitForReview || canApprove || canReject) ? (
              <>
                <input
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="Optional note..."
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs mb-2
                    focus:outline-none focus:border-indigo-500"
                />
                <div className="flex gap-2">
                  {canSubmitForReview && (
                    <button
                      onClick={() => handleAction('submit')}
                      disabled={actionLoading || !slot.headline?.trim()}
                      className="flex-1 py-2 rounded bg-yellow-700 hover:bg-yellow-600 disabled:opacity-40
                        text-xs font-medium transition-colors"
                    >
                      Submit for review
                    </button>
                  )}
                  {canApprove && (
                    <button
                      onClick={() => handleAction('approve')}
                      disabled={actionLoading}
                      className="flex-1 py-2 rounded bg-green-700 hover:bg-green-600 disabled:opacity-40
                        text-xs font-medium transition-colors"
                    >
                      Approve
                    </button>
                  )}
                  {canReject && (
                    <button
                      onClick={() => handleAction('reject')}
                      disabled={actionLoading}
                      className="flex-1 py-2 rounded bg-red-800 hover:bg-red-700 disabled:opacity-40
                        text-xs font-medium transition-colors"
                    >
                      Reject
                    </button>
                  )}
                </div>
                {actionError && <p className="text-xs text-red-400 mt-1">{actionError}</p>}
              </>
            ) : (
              <p className="text-xs text-gray-600">Actions available once slot is briefed and submitted.</p>
            )}
          </section>
        )}

        {/* Comments */}
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Comments</h4>
          <CommentThread
            projectId={projectId}
            slotId={slot.id}
            events={events}
            onNewEvent={onNewEvent}
          />
        </section>

        {/* Enable / disable slot */}
        {isEditor && (
          <section className="border-t border-gray-800 pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Slot</h4>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={async () => {
                  try {
                    const updated = await slotsApi.update(projectId, slot.id, { enabled: !slot.enabled });
                    onSlotUpdated(updated);
                  } catch {
                    // update failed — slot state unchanged
                  }
                }}
                className={`relative w-10 h-5 rounded-full transition-colors ${slot.enabled ? 'bg-indigo-600' : 'bg-red-800'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${slot.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className={`text-sm ${slot.enabled ? 'text-gray-300' : 'text-red-400'}`}>
                {slot.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1">Disabled slots are excluded from the render.</p>
          </section>
        )}
      </div>
    </div>
  );
}

