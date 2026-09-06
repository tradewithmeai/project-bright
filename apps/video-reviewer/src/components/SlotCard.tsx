import type { Slot, Asset } from '../types';
import { SlotStatusBadge } from './StatusBadge';
import { CostBadge } from './CostBadge';

interface Props {
  slot: Slot;
  selected: boolean;
  onClick: () => void;
  asset?: Asset;
  'data-demo'?: string;
}

export function SlotCard({ slot, selected, onClick, asset, 'data-demo': dataDemo }: Props) {
  const typeLabel = slot.slot_type === 'video' ? 'VID' : 'IMG';
  const typeColor = slot.slot_type === 'video' ? 'bg-purple-800 text-purple-200' : 'bg-sky-800 text-sky-200';
  const isMock = asset?.file_path?.startsWith('__mock__');
  const hasRealAsset = asset && !isMock;

  return (
    <button
      onClick={onClick}
      data-demo={dataDemo}
      className={`
        relative flex flex-col w-28 min-h-[120px] rounded-lg border-2 overflow-hidden text-left
        transition-all duration-150 hover:border-indigo-500
        ${selected ? 'border-indigo-400 ring-2 ring-indigo-400/30' : 'border-gray-700'}
        bg-gray-900
      `}
    >
      {/* Thumbnail area */}
      <div className="relative w-full h-16 bg-gray-800 flex items-center justify-center overflow-hidden">
        {hasRealAsset ? (
          asset.asset_type === 'video' ? (
            <video
              src={`/uploads/${asset.file_path}`}
              className="w-full h-full object-cover"
              muted
              preload="metadata"
            />
          ) : (
            <img
              src={`/uploads/${asset.file_path}`}
              alt=""
              className="w-full h-full object-cover"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          )
        ) : (
          <span className="text-gray-600 text-xs">{slot.selected_asset_id ? 'Mock asset' : 'No asset'}</span>
        )}
        {/* Type badge */}
        <span className={`absolute top-1 left-1 text-[10px] font-bold px-1 rounded ${typeColor}`}>
          {typeLabel}
        </span>
      </div>

      {/* Info */}
      <div className="p-1.5 flex flex-col gap-1 flex-1">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide leading-tight">
          {slot.slot_key}
        </span>
        <span className="text-[11px] text-gray-300 leading-tight line-clamp-2">
          {slot.role_label}
        </span>
        <div className="mt-auto flex flex-col gap-0.5">
          <SlotStatusBadge status={slot.status} />
          <CostBadge amount={slot.estimated_cost} />
        </div>
      </div>
    </button>
  );
}
