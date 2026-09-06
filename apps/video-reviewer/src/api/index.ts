import { api } from './client';
import type { Project, Slot, Asset, GenerationRun, ReviewEvent, User, Provider, RenderJob, BrandPackRun, BrightyExport } from '../types';

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post<User>('/auth/login', { email, password }),
  logout: () => api.post<{ ok: boolean }>('/auth/logout'),
  me: () => api.get<User>('/auth/me'),
};

// Projects
export const projectsApi = {
  list: () => api.get<Project[]>('/projects'),
  get: (id: number) => api.get<Project>(`/projects/${id}`),
  create: (data: { title: string; template_type?: string; user_ids?: number[]; company_slug?: string }) =>
    api.post<Project>('/projects', data),
  update: (id: number, data: { title: string }) =>
    api.patch<Project>(`/projects/${id}`, data),
  submit: (id: number, text?: string) =>
    api.post<{ ok: boolean; status: string }>(`/projects/${id}/submit`, { text }),
  requestChanges: (id: number, text?: string) =>
    api.post<{ ok: boolean; status: string }>(`/projects/${id}/request-changes`, { text }),
  approveGeneration: (id: number, text?: string) =>
    api.post<{ ok: boolean; status: string }>(`/projects/${id}/approve-generation`, { text }),
  approvePreview: (id: number, text?: string) =>
    api.post<{ ok: boolean; status: string }>(`/projects/${id}/approve-preview`, { text }),
};

// Slots
export const slotsApi = {
  list: (projectId: number) =>
    api.get<Slot[]>(`/projects/${projectId}/slots`),
  update: (projectId: number, slotId: number, data: Partial<{
    headline: string;
    description: string;
    notes: string;
    target_duration_seconds: number | null;
    source_mode: 'manual' | 'generated';
    selected_provider: string | null;
    enabled: boolean;
    trim_start_seconds: number | null;
    trim_end_seconds: number | null;
    fit_mode: 'contain' | 'cover';
  }>) => api.patch<Slot>(`/projects/${projectId}/slots/${slotId}`, data),
  submitForReview: (projectId: number, slotId: number, text?: string) =>
    api.post<Slot>(`/projects/${projectId}/slots/${slotId}/submit-for-review`, { text }),
  approve: (projectId: number, slotId: number, text?: string) =>
    api.post<Slot>(`/projects/${projectId}/slots/${slotId}/approve`, { text }),
  reject: (projectId: number, slotId: number, text?: string) =>
    api.post<Slot>(`/projects/${projectId}/slots/${slotId}/reject`, { text }),
  selectAsset: (projectId: number, slotId: number, assetId: number) =>
    api.post<Slot>(`/projects/${projectId}/slots/${slotId}/select-asset`, { asset_id: assetId }),
  deselectAsset: (projectId: number, slotId: number) =>
    api.post<Slot>(`/projects/${projectId}/slots/${slotId}/deselect-asset`, {}),
};

// Assets
export const assetsApi = {
  upload: (projectId: number, slotId: number, file: File) =>
    api.upload<Asset>(`/projects/${projectId}/slots/${slotId}/assets`, file),
  get: (assetId: number) => api.get<Asset>(`/assets/${assetId}`),
  delete: (projectId: number, slotId: number, assetId: number) =>
    api.delete<{ ok: boolean }>(`/projects/${projectId}/slots/${slotId}/assets/${assetId}`),
  listForSlot: (projectId: number, slotId: number) =>
    api.get<Asset[]>(`/projects/${projectId}/slots/${slotId}/assets`),
  importUrl: (projectId: number, slotId: number, url: string) =>
    api.post<Asset>(`/projects/${projectId}/slots/${slotId}/assets/import-url`, { url }),
  importZip: (projectId: number, slotId: number, url: string) =>
    api.post<Asset[]>(`/projects/${projectId}/slots/${slotId}/assets/import-zip`, { url }),
};

// Runs
export const runsApi = {
  generate: (
    projectId: number,
    slotId: number,
    body?: { prompt: string; aspectRatio: string; referenceImages?: string[]; provider?: string; durationSeconds?: number; resolution?: string }
  ) =>
    api.post<{ run_id: number; status: string }>(`/projects/${projectId}/slots/${slotId}/runs`, body),
  list: (projectId: number, slotId: number) =>
    api.get<GenerationRun[]>(`/projects/${projectId}/slots/${slotId}/runs`),
};

// Events
export const eventsApi = {
  list: (projectId: number) =>
    api.get<ReviewEvent[]>(`/projects/${projectId}/events`),
  comment: (projectId: number, text: string, slotId?: number) =>
    api.post<ReviewEvent>(`/projects/${projectId}/events`, { text, slot_id: slotId }),
};

// Providers
export const providersApi = {
  list: (slotType?: 'still' | 'video') =>
    api.get<Provider[]>(`/providers${slotType ? `?slot_type=${slotType}` : ''}`),
};

// Admin
export const adminApi = {
  listUsers: () => api.get<User[]>('/admin/users'),
  createUser: (data: { name: string; email: string; password: string; role: string }) =>
    api.post<User>('/admin/users', data),
  updateUser: (id: number, data: { name?: string; role?: string }) =>
    api.patch<User>(`/admin/users/${id}`, data),
};

// Render Jobs
export const renderJobsApi = {
  create: (projectId: number, render_mode: 'preview' | 'final') =>
    api.post<{ job_id: number }>(`/projects/${projectId}/render-jobs`, { render_mode }),
  list: (projectId: number) =>
    api.get<RenderJob[]>(`/projects/${projectId}/render-jobs`),
  get: (jobId: number) =>
    api.get<RenderJob>(`/render-jobs/${jobId}`),
  delete: (projectId: number, jobId: number) =>
    api.delete<{ ok: boolean }>(`/projects/${projectId}/render-jobs/${jobId}`),
};

// Scrapes
export const scrapesApi = {
  list: () => api.get<Array<{ slug: string; company: string; sector: string | null; hq: string | null; scrape_date: string | null }>>('/scrapes'),
  get: (slug: string) => api.get<Record<string, unknown>>(`/scrapes/${slug}`),
  trigger: (url: string) => api.post<{ run_id: number; slug: string; status: string }>('/scrapes', { url }),
  runStatus: (runId: number) => api.get<{ id: number; slug: string; url: string; status: string; error: string | null; created_at: string; completed_at: string | null }>(`/scrapes/runs/${runId}`),
};

// Brand Packs
export const brandPacksApi = {
  list: () => api.get<BrandPackRun[]>('/brand-packs'),
  create: (seed_url: string) => api.post<{ run_id: number }>('/brand-packs', { seed_url }),
  brightyExport: (id: number) => api.get<BrightyExport>(`/brand-packs/${id}/brighty-export`),
};

// Dev / God Mode
export const devApi = {
  system: () => api.get<Record<string, unknown>>('/dev/system'),
  rawTable: (table: string, offset = 0, limit = 100) =>
    api.get<{ table: string; total: number; offset: number; limit: number; rows: unknown[] }>(
      `/dev/raw/${table}?offset=${offset}&limit=${limit}`
    ),
  runSql: (sql: string) =>
    api.post<{ rows: unknown[]; count: number }>('/dev/sql', { sql }),
  forceStatus: (type: 'project' | 'slot', id: number, status: string) =>
    api.post<{ ok: boolean; entity: unknown }>('/dev/force-status', { type, id, status }),
  resetProject: (id: number) =>
    api.delete<{ ok: boolean; message: string }>(`/dev/reset-project/${id}`),
  listUsers: () => api.get<User[]>('/dev/users'),
  setRole: (id: number, role: string) =>
    api.patch<User>(`/dev/users/${id}`, { role }),
};
