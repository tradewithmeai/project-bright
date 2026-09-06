import type { Slot, Asset } from '../types';
import { SlotCard } from './SlotCard';

interface Props {
  slots: Slot[];
  selectedSlotId: number | null;
  onSelectSlot: (slot: Slot) => void;
  assetMap?: Map<number, Asset>;
}

export function StoryboardStrip({ slots, selectedSlotId, onSelectSlot, assetMap }: Props) {
  const ordered = [...slots].sort((a, b) => a.position - b.position);

  return (
    <div data-demo="slot-strip" className="flex flex-wrap gap-2 p-4 bg-gray-900/50 rounded-xl border border-gray-800">
      {ordered.map((slot, i) => (
        <SlotCard
          key={slot.id}
          slot={slot}
          selected={selectedSlotId === slot.id}
          onClick={() => onSelectSlot(slot)}
          asset={slot.selected_asset_id ? assetMap?.get(slot.selected_asset_id) : undefined}
          {...(i === 0 ? { 'data-demo': 'slot-card' } : {})}
        />
      ))}
    </div>
  );
}
