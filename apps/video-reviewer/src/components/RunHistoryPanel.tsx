import { useState, useEffect } from 'react';
import { runsApi, slotsApi } from '../api';
import type { GenerationRun, Slot } from '../types';

const PROVIDER_LABELS: Record<string, string> = {
  gemini_image: 'Gemini 2.5 Flash',
  veo_lite:     'Veo 3.1 Lite',
  veo_full:     'Veo 3.1 Full',
  fal_ai_flux:  'Fal.ai Flux',
  runway_gen3:  'Runway Gen-3',
  manual:       'Manual',
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr + 'Z').getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface Props {
  slot: Slot;
  projectId: number;
  selectedAssetId: number | null;
  onAssetSelected: (assetId: number) => void;
  refreshTrigger?: number;
}

export function RunHistoryPanel({ slot, projectId, selectedAssetId, onAssetSelected, refreshTrigger }: Props) {
  const [runs, setRuns] = useState<GenerationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    runsApi.list(projectId, slot.id)
      .then(setRuns)
      .catch(() => setRuns([]))
      .finally(() => setLoading(false));
  }, [projectId, slot.id, refreshTrigger]);

  async function handleUse(run: GenerationRun) {
    if (!run.asset) return;
    setSelecting(run.id);
    try {
      await slotsApi.selectAsset(projectId, slot.id, run.asset.id);
      onAssetSelected(run.asset.id);
    } finally {
      setSelecting(null);
    }
  }

  if (loading) {
    return (
      <div className="text-xs text-gray-600 py-2">Loading history...</div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="text-xs text-gray-600 py-2">No generation runs yet.</div>
    );
  }

  return (
    <div className="space-y-2">
      {runs.map(run => {
        const isSelected = run.asset ? run.asset.id === selectedAssetId : false;
        const canUse = run.status === 'succeeded' && run.asset !== null;
        const thumbSrc = run.asset?.thumbnail_path
          ? `/uploads/${run.asset.thumbnail_path}`
          : run.asset?.file_path
            ? `/uploads/${run.asset.file_path}`
            : null;

        return (
          <div
            key={run.id}
            className={`rounded border p-2.5 transition-colors ${
              isSelected
                ? 'border-indigo-600 bg-indigo-900/20'
                : 'border-gray-700 bg-gray-900'
            }`}
          >
            <div className="flex gap-3">
              {/* Thumbnail */}
              <div className="w-14 h-10 flex-shrink-0 rounded overflow-hidden bg-gray-800 flex items-center justify-center">
                {thumbSrc ? (
                  run.asset?.asset_type === 'video' ? (
                    <video
                      src={thumbSrc}
                      className="w-full h-full object-cover"
                      muted
                    />
                  ) : (
                    <img
                      src={thumbSrc}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )
                ) : (
                  <span className="text-gray-600 text-xs">
                    {run.status === 'running' ? '...' : run.status === 'failed' ? '✕' : '?'}
                  </span>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-gray-500">#{run.attempt_number}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    run.status === 'succeeded' ? 'bg-green-900 text-green-300' :
                    run.status === 'failed'    ? 'bg-red-900 text-red-400' :
                    run.status === 'running'   ? 'bg-yellow-900 text-yellow-300' :
                    'bg-gray-800 text-gray-500'
                  }`}>
                    {run.status}
                  </span>
                  {isSelected && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-800 text-indigo-300 font-medium">
                      active
                    </span>
                  )}
                  <span className="text-xs text-gray-600 ml-auto">{timeAgo(run.created_at)}</span>
                </div>

                <div className="text-xs text-gray-400 truncate mb-1">
                  {PROVIDER_LABELS[run.provider] ?? run.provider}
                  {run.actual_cost !== undefined && (
                    <span className="text-gray-600 ml-2">${run.actual_cost.toFixed(4)}</span>
                  )}
                </div>

                {typeof run.compiled_input.prompt === 'string' && (() => {
                  const p = run.compiled_input.prompt as string;
                  return (
                    <div className="text-xs text-gray-500 truncate">
                      {p.slice(0, 90)}{p.length > 90 ? '…' : ''}
                    </div>
                  );
                })()}

                {run.status === 'failed' && run.error_message && (
                  <div className="text-xs text-red-400 mt-1 truncate">{run.error_message}</div>
                )}
              </div>
            </div>

            {/* Use button */}
            {canUse && !isSelected && (
              <button
                onClick={() => handleUse(run)}
                disabled={selecting === run.id}
                className="mt-2 w-full py-1 rounded text-xs font-medium bg-gray-800 hover:bg-gray-700
                  border border-gray-700 hover:border-gray-600 text-gray-300 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {selecting === run.id ? 'Selecting...' : 'Use this result'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
