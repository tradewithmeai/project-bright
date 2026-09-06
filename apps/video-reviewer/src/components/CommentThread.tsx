import { useState } from 'react';
import type { ReviewEvent, Role } from '../types';
import { eventsApi } from '../api';

const ROLE_COLORS: Record<Role, string> = {
  creator: 'text-sky-400',
  reviewer: 'text-yellow-400',
  manager: 'text-orange-400',
  admin: 'text-red-400',
  superadmin: 'text-green-400',
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    comment: '',
    approve_slot: 'approved slot',
    reject_slot: 'rejected slot',
    submit_slot_for_review: 'submitted slot for review',
    approve_for_generation: 'approved for generation',
    submit_for_review: 'submitted project for review',
    request_changes: 'requested changes',
    approve_project: 'approved project',
    approve_preview: 'approved preview',
  };
  return map[action] ?? action;
}

interface Props {
  projectId: number;
  slotId?: number;
  events: ReviewEvent[];
  onNewEvent: (e: ReviewEvent) => void;
}

export function CommentThread({ projectId, slotId, events, onNewEvent }: Props) {
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const filtered = slotId
    ? events.filter(e => e.slot_id === slotId || (e.slot_id === null && false))
    : events.filter(e => e.slot_id === null || e.slot_id === undefined);

  async function post() {
    if (!text.trim()) return;
    setPosting(true);
    try {
      const event = await eventsApi.comment(projectId, text.trim(), slotId);
      onNewEvent(event);
      setText('');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-2">
      {filtered.length === 0 && (
        <p className="text-xs text-gray-600 italic">No comments yet</p>
      )}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {filtered.map(e => (
          <div key={e.id} className="text-xs">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`font-medium ${ROLE_COLORS[e.user_role]}`}>{e.user_name}</span>
              {actionLabel(e.action) && (
                <span className="text-gray-500 italic">{actionLabel(e.action)}</span>
              )}
              <span className="text-gray-600 ml-auto">{formatTime(e.created_at)}</span>
            </div>
            {e.text && <p className="text-gray-300 pl-0.5">{e.text}</p>}
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post(); }}}
          placeholder="Add a comment..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs
            focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={post}
          disabled={posting || !text.trim()}
          className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-xs font-medium
            disabled:opacity-40 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
