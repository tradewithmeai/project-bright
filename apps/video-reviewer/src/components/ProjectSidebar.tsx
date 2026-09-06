import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project, ReviewEvent } from '../types';
import { projectsApi } from '../api';
import { ProjectStatusBadge } from './StatusBadge';
import { CostBadge } from './CostBadge';
import { CommentThread } from './CommentThread';
import { useAuth } from '../hooks/useAuth';
import { canManage, canReview, canEdit, canViewActualCost, canViewEstimatedCost } from '../utils/permissions';

interface Props {
  project: Project;
  events: ReviewEvent[];
  onProjectUpdated: (p: Project) => void;
  onNewEvent: (e: ReviewEvent) => void;
}

export function ProjectSidebar({ project, events, onProjectUpdated, onNewEvent }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const showEst = canViewEstimatedCost(user.role);
  const showActual = canViewActualCost(user.role);
  const isManager = canManage(user.role);
  const isReviewer = canReview(user.role);
  const isEditor = canEdit(user.role);

  async function doAction(fn: () => Promise<{ ok: boolean; status: string }>) {
    setLoading(true);
    setError(null);
    try {
      await fn();
      const updated = await projectsApi.get(project.id);
      onProjectUpdated(updated);
    } catch (err: unknown) {
      const body = (err as any)?.body;
      const msg = body?.non_compliant_slots
        ? `Not all slots ready: ${body.non_compliant_slots.join(', ')}`
        : (err instanceof Error ? err.message : 'Action failed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const st = project.status;

  return (
    <aside data-demo="project-sidebar" className="w-72 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-sm font-bold text-gray-100 mb-1 leading-tight">{project.title}</h2>
        <ProjectStatusBadge status={project.status} />
      </div>

      {/* Users */}
      {project.assigned_users && project.assigned_users.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-800">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Team</h3>
          <div className="space-y-1">
            {project.assigned_users.map(u => (
              <div key={u.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-300">{u.name}</span>
                <span className="text-gray-500 capitalize">{u.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost summary */}
      {(showEst || showActual) && (
        <div data-demo="sidebar-costs" className="px-4 py-3 border-b border-gray-800">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Costs</h3>
          <div className="space-y-1.5">
            {showEst && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Estimated</span>
                <CostBadge amount={project.total_estimated_cost} size="md" />
              </div>
            )}
            {showActual && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Actual run cost</span>
                <CostBadge amount={project.total_actual_cost} size="md" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div data-demo="sidebar-actions" className="px-4 py-3 border-b border-gray-800 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Actions</h3>

        {error && (
          <p className="text-xs text-red-400 bg-red-950/30 rounded px-2 py-1.5">{error}</p>
        )}

        {isEditor && ['draft', 'changes_requested'].includes(st) && (
          <button
            onClick={() => doAction(() => projectsApi.submit(project.id))}
            disabled={loading}
            className="w-full py-2 rounded bg-yellow-700 hover:bg-yellow-600 disabled:opacity-40 text-xs font-medium"
          >
            Submit for review
          </button>
        )}

        {isReviewer && st === 'ready_for_review' && !isManager && (
          <button
            onClick={() => doAction(() => projectsApi.requestChanges(project.id))}
            disabled={loading}
            className="w-full py-2 rounded bg-orange-800 hover:bg-orange-700 disabled:opacity-40 text-xs font-medium"
          >
            Request changes
          </button>
        )}

        {isManager && st === 'ready_for_review' && (
          <>
            <button
              onClick={() => doAction(() => projectsApi.approveGeneration(project.id))}
              disabled={loading}
              className="w-full py-2 rounded bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 text-xs font-medium"
            >
              Approve for generation
            </button>
            <button
              onClick={() => doAction(() => projectsApi.requestChanges(project.id))}
              disabled={loading}
              className="w-full py-2 rounded bg-orange-800 hover:bg-orange-700 disabled:opacity-40 text-xs font-medium"
            >
              Request changes
            </button>
          </>
        )}

        {isManager && st === 'generated' && (
          <button
            onClick={() => doAction(() => projectsApi.approvePreview(project.id))}
            disabled={loading}
            className="w-full py-2 rounded bg-green-700 hover:bg-green-600 disabled:opacity-40 text-xs font-medium"
          >
            Approve preview
          </button>
        )}

        {st === 'approved_for_preview' && (
          <button
            onClick={() => navigate(`/projects/${project.id}/preview`)}
            className="w-full py-2 rounded bg-green-800 hover:bg-green-700 text-xs font-medium"
          >
            View preview
          </button>
        )}
      </div>

      {/* Activity log */}
      <div className="px-4 py-3 flex-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Activity</h3>
        <CommentThread
          projectId={project.id}
          events={events}
          onNewEvent={onNewEvent}
        />
      </div>
    </aside>
  );
}
