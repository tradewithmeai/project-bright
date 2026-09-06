import { useState, useEffect, useCallback } from 'react';
import type { Project, Slot, ReviewEvent } from '../types';
import { projectsApi, slotsApi, eventsApi } from '../api';

export function useProject(projectId: number) {
  const [project, setProject] = useState<Project | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [events, setEvents] = useState<ReviewEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [p, s, e] = await Promise.all([
        projectsApi.get(projectId),
        slotsApi.list(projectId),
        eventsApi.list(projectId),
      ]);
      setProject(p);
      setSlots(s);
      setEvents(e);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  function updateSlotInState(updated: Slot) {
    setSlots(prev => prev.map(s => s.id === updated.id ? updated : s));
  }

  return { project, slots, events, loading, error, refresh, updateSlotInState, setProject };
}
