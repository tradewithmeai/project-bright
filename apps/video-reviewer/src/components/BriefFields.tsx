import { useState, useEffect } from 'react';
import type { Slot } from '../types';

interface Props {
  slot: Slot;
  readOnly: boolean;
  onSave: (data: {
    headline: string;
    description: string;
    notes: string;
    target_duration_seconds: number | null;
  }) => Promise<void>;
}

export function BriefFields({ slot, readOnly, onSave }: Props) {
  const [headline, setHeadline] = useState(slot.headline ?? '');
  const [description, setDescription] = useState(slot.description ?? '');
  const [notes, setNotes] = useState(slot.notes ?? '');
  const [duration, setDuration] = useState<string>(
    slot.target_duration_seconds !== null && slot.target_duration_seconds !== undefined
      ? String(slot.target_duration_seconds)
      : ''
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setHeadline(slot.headline ?? '');
    setDescription(slot.description ?? '');
    setNotes(slot.notes ?? '');
    setDuration(slot.target_duration_seconds !== null && slot.target_duration_seconds !== undefined
      ? String(slot.target_duration_seconds) : '');
    setDirty(false);
  }, [slot.id]);

  function mark() { setDirty(true); }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        headline,
        description,
        notes,
        target_duration_seconds: duration ? Math.min(Number(duration), slot.max_duration_seconds) : null,
      });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  const inputClass = `w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100
    focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed`;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">
          Headline <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={headline}
          onChange={e => { setHeadline(e.target.value); mark(); }}
          disabled={readOnly}
          placeholder="What is this slot?"
          className={inputClass}
          maxLength={300}
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">
          Description
        </label>
        <textarea
          value={description}
          onChange={e => { setDescription(e.target.value); mark(); }}
          disabled={readOnly}
          placeholder="Visual description, mood, composition..."
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={e => { setNotes(e.target.value); mark(); }}
          disabled={readOnly}
          placeholder="Brand guidelines, references, constraints..."
          rows={2}
          className={`${inputClass} resize-none`}
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">
          {slot.slot_type === 'still' ? 'Display duration (s)' : 'Target duration (s)'}
          <span className="text-gray-600 ml-1">(max {slot.max_duration_seconds}s)</span>
        </label>
        <input
          type="number"
          value={duration}
          onChange={e => { setDuration(e.target.value); mark(); }}
          disabled={readOnly}
          min={slot.slot_type === 'still' ? 0.5 : 1}
          step={0.1}
          max={slot.max_duration_seconds}
          placeholder={String(slot.max_duration_seconds)}
          className={inputClass}
        />
      </div>

      {!readOnly && dirty && (
        <button
          onClick={handleSave}
          disabled={saving || !headline.trim()}
          className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40
            text-sm font-medium transition-colors"
        >
          {saving ? 'Saving...' : 'Save brief'}
        </button>
      )}
    </div>
  );
}
