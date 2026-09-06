export type Role = 'creator' | 'reviewer' | 'manager' | 'admin' | 'superadmin';

export interface BrandPackRun {
  id: number;
  seed_url: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  brand_name: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface BrightyExport {
  pack_id: string;
  seed_url: string;
  brand: {
    brand_name: string;
    colours: { primary: string; secondary: string; accent: string; all: string[] };
    fonts: { heading: string; body: string };
    logo_url: string | null;
  };
  content: {
    tagline: string;
    headline: string;
    subheadline: string;
    features: string[];
    supporting_claims: string[];
  };
  assets: Array<{ url: string; type: string; alt: string }>;
}
export type ProjectStatus = 'draft' | 'ready_for_review' | 'changes_requested' | 'approved_for_generation' | 'generated' | 'approved_for_preview';
export type SlotStatus = 'empty' | 'briefed' | 'ready_for_review' | 'approved_for_generation' | 'generated' | 'approved' | 'rejected';
export type AssetRole = 'reference' | 'candidate' | 'selected';
export type SlotType = 'still' | 'video';
export type SourceMode = 'manual' | 'generated';
export type RunStatus = 'pending' | 'running' | 'succeeded' | 'failed';
export type RenderJobStatus = 'queued' | 'rendering' | 'complete' | 'failed';
export type RenderMode = 'preview' | 'final';
export type FitMode = 'contain' | 'cover';
export type RenderStatus = 'not_ready' | 'ready' | 'queued' | 'rendering' | 'complete' | 'failed';
export type AssetSource = 'manual' | 'scraped' | 'generated' | 'transformed';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  promptLogout?: boolean; // set by /me when the active human's project just finished
}

export interface AssignedUser {
  id: number;
  name: string;
  role: Role;
}

export interface Project {
  id: number;
  title: string;
  template_type: string;
  status: ProjectStatus;
  created_by: number;
  company_slug: string | null;
  total_estimated_cost?: number;
  total_actual_cost?: number;
  created_at: string;
  updated_at: string;
  assigned_users?: AssignedUser[];
  slot_progress?: { total: number; briefed: number };
}

export interface Slot {
  id: number;
  project_id: number;
  slot_key: string;
  slot_type: SlotType;
  position: number;
  role_label: string;
  max_duration_seconds: number;
  enabled: boolean;
  headline: string | null;
  description: string | null;
  notes: string | null;
  target_duration_seconds: number | null;
  source_mode: SourceMode;
  selected_provider: string | null;
  estimated_cost?: number;
  actual_cost?: number;
  status: SlotStatus;
  selected_asset_id: number | null;
  trim_start_seconds: number | null;
  trim_end_seconds: number | null;
  fit_mode: FitMode;
  render_status: RenderStatus;
  updated_at: string;
}

export interface Asset {
  id: number;
  slot_id: number;
  project_id: number;
  generation_run_id: number | null;
  asset_type: SlotType;
  asset_role: AssetRole;
  provider: string | null;
  file_path: string;
  thumbnail_path: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  source: AssetSource;
  mime_type: string | null;
  file_size_bytes: number | null;
  created_at: string;
}

export interface RunAsset {
  id: number;
  file_path: string;
  thumbnail_path: string | null;
  asset_type: string;
}

export interface GenerationRun {
  id: number;
  slot_id: number;
  provider: string;
  compiled_input: Record<string, unknown>;
  estimated_cost?: number;
  actual_cost?: number;
  status: RunStatus;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  attempt_number: number;
  asset: RunAsset | null;
}

export interface ReviewEvent {
  id: number;
  project_id: number;
  slot_id: number | null;
  user_id: number;
  action: string;
  text: string | null;
  created_at: string;
  user_name: string;
  user_role: Role;
}

export interface Provider {
  key: string;
  label: string;
  accepted_slot_types?: SlotType[];
  supports_mock: boolean;
  default_duration_limit_seconds: number | null;
}

export interface RenderJob {
  id: number;
  project_id: number;
  render_mode: RenderMode;
  status: RenderJobStatus;
  output_path: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}
