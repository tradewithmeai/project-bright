import type { ProjectStatus, SlotStatus } from '../types';

const slotColors: Record<SlotStatus, string> = {
  empty: 'bg-gray-700 text-gray-400',
  briefed: 'bg-blue-900 text-blue-300',
  ready_for_review: 'bg-yellow-900 text-yellow-300',
  approved_for_generation: 'bg-indigo-900 text-indigo-300',
  generated: 'bg-purple-900 text-purple-300',
  approved: 'bg-green-900 text-green-300',
  rejected: 'bg-red-900 text-red-400',
};

const slotLabels: Record<SlotStatus, string> = {
  empty: 'Empty',
  briefed: 'Briefed',
  ready_for_review: 'In Review',
  approved_for_generation: 'Gen Approved',
  generated: 'Generated',
  approved: 'Approved',
  rejected: 'Rejected',
};

const projectColors: Record<ProjectStatus, string> = {
  draft: 'bg-gray-700 text-gray-300',
  ready_for_review: 'bg-yellow-900 text-yellow-300',
  changes_requested: 'bg-orange-900 text-orange-300',
  approved_for_generation: 'bg-indigo-900 text-indigo-300',
  generated: 'bg-purple-900 text-purple-300',
  approved_for_preview: 'bg-green-900 text-green-300',
};

const projectLabels: Record<ProjectStatus, string> = {
  draft: 'Draft',
  ready_for_review: 'In Review',
  changes_requested: 'Changes Requested',
  approved_for_generation: 'Approved for Gen',
  generated: 'Generated',
  approved_for_preview: 'Preview Approved',
};

export function SlotStatusBadge({ status }: { status: SlotStatus }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${slotColors[status]}`}>
      {slotLabels[status]}
    </span>
  );
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${projectColors[status]}`}>
      {projectLabels[status]}
    </span>
  );
}
