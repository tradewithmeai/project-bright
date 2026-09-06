import { useState, useEffect, useRef } from 'react';
import type { Asset, Slot } from '../types';
import { assetsApi } from '../api';

const API_BASE = '/uploads';

function assetUrl(path: string): string {
  if (path.startsWith('__mock__/')) return '/placeholder-asset.png';
  return `${API_BASE}/${path}`;
}

interface AssetCardProps {
  asset: Asset;
  onSelect?: () => void;
  onDelete?: () => void;
  isSelected: boolean;
}

function AssetCard({ asset, onSelect, onDelete, isSelected }: AssetCardProps) {
  const isMock = asset.file_path.startsWith('__mock__/');

  return (
    <div className={`relative rounded border p-2 flex flex-col gap-1 ${
      isSelected ? 'border-green-500 bg-green-950/20' : 'border-gray-700 bg-gray-800'
    }`}>
      {/* Thumbnail */}
      <div className="w-full h-20 bg-gray-700 rounded overflow-hidden flex items-center justify-center">
        {asset.asset_type === 'video' ? (
          isMock ? (
            <div className="text-xs text-gray-400 text-center p-2">Mock video<br/>{asset.file_path.split('/').pop()}</div>
          ) : (
            <video src={assetUrl(asset.file_path)} className="w-full h-full object-cover" />
          )
        ) : (
          isMock ? (
            <div className="text-xs text-gray-400 text-center p-2">Mock image<br/>{asset.file_path.split('/').pop()}</div>
          ) : (
            <img src={assetUrl(asset.file_path)} alt="" className="w-full h-full object-cover" />
          )
        )}
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
          asset.asset_role === 'selected' ? 'bg-green-800 text-green-200' :
          asset.asset_role === 'candidate' ? 'bg-purple-900 text-purple-300' :
          'bg-gray-700 text-gray-400'
        }`}>
          {asset.asset_role}
        </span>
        {asset.provider && (
          <span className="text-[10px] text-gray-500">{asset.provider}</span>
        )}
      </div>

      <div className="flex gap-1 mt-1">
        {onSelect && !isSelected && (
          <button
            onClick={onSelect}
            className="flex-1 py-1 text-xs rounded bg-indigo-700 hover:bg-indigo-600 text-white transition-colors"
          >
            Use this
          </button>
        )}
        {isSelected && !onSelect && (
          <span className="flex-1 py-1 text-xs rounded bg-green-800 text-green-200 text-center">
            Selected
          </span>
        )}
        {isSelected && onSelect && (
          <button
            onClick={onSelect}
            className="flex-1 py-1 text-xs rounded bg-green-800 hover:bg-gray-700 text-green-200 hover:text-gray-300 transition-colors"
          >
            Deselect
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-red-900 text-gray-400 hover:text-red-300 transition-colors"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

interface Props {
  slot: Slot;
  canEdit: boolean;
  onAssetSelected: (assetId: number) => Promise<void>;
  onAssetDeselected?: () => Promise<void>;
  onRefresh: () => void;
}

export function AssetSection({ slot, canEdit, onAssetSelected, onAssetDeselected, onRefresh }: Props) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAssets();
  }, [slot.id]);

  async function loadAssets() {
    try {
      const list = await assetsApi.listForSlot(slot.project_id, slot.id);
      setAssets(list);
    } catch {
      // slot might have no assets endpoint returning empty — ignore
      setAssets([]);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await assetsApi.upload(slot.project_id, slot.id, file);
      await loadAssets();
      onRefresh();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleSelect(assetId: number) {
    await onAssetSelected(assetId);
    await loadAssets();
  }

  async function handleDeselect() {
    if (onAssetDeselected) {
      await onAssetDeselected();
      await loadAssets();
    }
  }

  async function handleDelete(assetId: number) {
    try {
      setDeleteError(null);
      await assetsApi.delete(slot.project_id, slot.id, assetId);
      await loadAssets();
      onRefresh();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete asset');
    }
  }

  const reference = assets.filter(a => a.asset_role === 'reference');
  const candidates = assets.filter(a => a.asset_role === 'candidate');
  const selected = assets.filter(a => a.asset_role === 'selected');

  return (
    <div className="space-y-4">
      {/* Selected */}
      {selected.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-green-400 mb-2">
            Selected asset
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {selected.map(a => (
              <AssetCard key={a.id} asset={a} isSelected={true}
                onSelect={canEdit && onAssetDeselected ? handleDeselect : undefined}
                onDelete={canEdit ? () => handleDelete(a.id) : undefined} />
            ))}
          </div>
        </div>
      )}

      {/* Candidates */}
      {candidates.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-purple-400 mb-2">
            Generation candidates
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {candidates.map(a => (
              <AssetCard key={a.id} asset={a} isSelected={false}
                onSelect={canEdit ? () => handleSelect(a.id) : undefined}
                onDelete={canEdit ? () => handleDelete(a.id) : undefined} />
            ))}
          </div>
        </div>
      )}

      {/* References */}
      {reference.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
            Reference uploads
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {reference.map(a => (
              <AssetCard key={a.id} asset={a} isSelected={false}
                onSelect={canEdit ? () => handleSelect(a.id) : undefined}
                onDelete={canEdit ? () => handleDelete(a.id) : undefined} />
            ))}
          </div>
        </div>
      )}

      {/* Upload */}
      {canEdit && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full py-2 rounded border border-dashed border-gray-600 text-sm text-gray-400
              hover:border-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
          >
            {uploading ? 'Uploading...' : '+ Upload reference asset'}
          </button>
        </div>
      )}

      {deleteError && (
        <p className="text-xs text-red-400">{deleteError}</p>
      )}

      {assets.length === 0 && !canEdit && (
        <p className="text-sm text-gray-500 text-center py-4">No assets yet</p>
      )}
    </div>
  );
}
