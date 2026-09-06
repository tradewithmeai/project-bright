import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Slot, Asset } from '../types';
import { slotsApi, assetsApi } from '../api';
import { projectsApi } from '../api';

const UPLOADS_BASE = '/uploads';

function assetUrl(path: string): string {
  if (path.startsWith('__mock__/')) return '';
  return `${UPLOADS_BASE}/${path}`;
}

interface SlotWithAsset {
  slot: Slot;
  asset: Asset | null;
}

export function PreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = Number(id);

  const [items, setItems] = useState<SlotWithAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const project = await projectsApi.get(projectId);
        if (project.status !== 'approved_for_preview') {
          setError('Project is not yet approved for preview');
          setLoading(false);
          return;
        }

        const slots = await slotsApi.list(projectId);
        const approvedSlots = slots
          .filter(s => s.enabled && s.status === 'approved' && s.selected_asset_id !== null)
          .sort((a, b) => a.position - b.position);

        const withAssets = await Promise.all(approvedSlots.map(async s => {
          const asset = s.selected_asset_id ? await assetsApi.get(s.selected_asset_id) : null;
          return { slot: s, asset };
        }));

        setItems(withAssets);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load preview');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  const advance = useCallback(() => {
    setCurrentIdx(prev => {
      if (prev + 1 >= items.length) {
        setPlaying(false);
        return prev;
      }
      return prev + 1;
    });
  }, [items.length]);

  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const current = items[currentIdx];
    if (!current) return;

    if (current.slot.slot_type === 'still' || !current.asset || current.asset.file_path.startsWith('__mock__')) {
      const duration = (current.slot.max_duration_seconds) * 1000;
      timerRef.current = setTimeout(advance, duration);
    }
    // Video slots advance via onEnded

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [playing, currentIdx, items, advance]);

  const current = items[currentIdx];

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading preview...</div>;
  if (error) return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4">
      <p className="text-red-400">{error}</p>
      <button onClick={() => navigate(`/projects/${projectId}`)} className="text-sm text-gray-400 hover:text-gray-200">
        ← Back to project
      </button>
    </div>
  );
  if (items.length === 0) return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4">
      <p className="text-gray-400">No approved assets to preview</p>
      <button onClick={() => navigate(`/projects/${projectId}`)} className="text-sm text-gray-400 hover:text-gray-200">
        ← Back to project
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Progress strip */}
      <div className="flex gap-0.5 p-2 bg-gray-950">
        {items.map((item, i) => (
          <button
            key={item.slot.id}
            onClick={() => { setCurrentIdx(i); setPlaying(false); }}
            className={`flex-1 h-1 rounded-full transition-all ${
              i < currentIdx ? 'bg-white' :
              i === currentIdx ? 'bg-indigo-400' :
              'bg-gray-700'
            }`}
            title={item.slot.role_label}
          />
        ))}
      </div>

      {/* Main viewer */}
      <div className="flex-1 flex items-center justify-center relative">
        {current && (
          <>
            {current.asset && !current.asset.file_path.startsWith('__mock__') ? (
              current.slot.slot_type === 'video' ? (
                <video
                  ref={videoRef}
                  key={current.asset.id}
                  src={assetUrl(current.asset.file_path)}
                  autoPlay={playing}
                  className="max-h-[70vh] max-w-full"
                  onEnded={advance}
                />
              ) : (
                <img
                  key={current.asset.id}
                  src={assetUrl(current.asset.file_path)}
                  alt={current.slot.role_label}
                  className="max-h-[70vh] max-w-full object-contain"
                />
              )
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 text-center">
                <div className={`w-48 h-32 rounded-lg flex items-center justify-center text-sm ${
                  current.slot.slot_type === 'video' ? 'bg-purple-900/50 text-purple-300' : 'bg-sky-900/50 text-sky-300'
                }`}>
                  {current.slot.slot_type === 'video' ? 'VIDEO' : 'IMAGE'}<br />
                  (mock asset)
                </div>
                <p className="text-gray-400 text-sm">{current.slot.role_label}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Slot info + controls */}
      <div className="bg-gray-950 px-6 py-4 flex items-center justify-between">
        <div className="flex flex-col">
          {current && (
            <>
              <span className="text-xs text-gray-500 uppercase tracking-wide">{current.slot.slot_key}</span>
              <span className="text-sm text-gray-200">{current.slot.role_label}</span>
              {current.slot.headline && (
                <span className="text-xs text-gray-400 mt-0.5">{current.slot.headline}</span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500">{currentIdx + 1} / {items.length}</span>
          <button
            onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
            className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-sm"
          >
            ←
          </button>
          <button
            onClick={() => setPlaying(p => !p)}
            className="px-4 py-1.5 rounded bg-indigo-700 hover:bg-indigo-600 text-sm font-medium"
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={() => setCurrentIdx(i => Math.min(items.length - 1, i + 1))}
            disabled={currentIdx === items.length - 1}
            className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-sm"
          >
            →
          </button>
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-sm text-gray-400"
          >
            ← Project
          </button>
        </div>
      </div>
    </div>
  );
}
