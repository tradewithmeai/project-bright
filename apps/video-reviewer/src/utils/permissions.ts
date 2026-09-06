import type { Role } from '../types';

export function isSuperAdmin(role: Role): boolean {
  return role === 'superadmin';
}

export function canEdit(role: Role): boolean {
  return ['creator', 'manager', 'admin', 'superadmin'].includes(role);
}

export function canReview(role: Role): boolean {
  return ['reviewer', 'manager', 'admin', 'superadmin'].includes(role);
}

export function canManage(role: Role): boolean {
  return ['manager', 'admin', 'superadmin'].includes(role);
}

export function canViewActualCost(role: Role): boolean {
  return ['manager', 'admin', 'superadmin'].includes(role);
}

export function canViewEstimatedCost(role: Role): boolean {
  return ['creator', 'manager', 'admin', 'superadmin'].includes(role);
}
