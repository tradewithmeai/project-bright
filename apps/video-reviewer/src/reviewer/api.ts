/**
 * The reviewer's entire data layer.
 *
 * There is no database, no auth and no ORM. A finished video is a VIDEO_RECORD.json plus a folder of
 * rendered parts, and this reads exactly that. `serve-reviewer.mjs` supplies it.
 */

// In dev, vite proxies /api and /media to the server. In a build served BY that server, same origin.
const BASE = '';

export type SectionRender = {
  status: 'produced' | 'length-mismatch' | 'failed';
  file: string;
  frames_declared: number;
  frames_actual: number | null;
  bytes: number;
  range: string;
  at: string;
};

export type Section = {
  id: string;
  label: string;
  name?: string;
  start: number;
  frames: number;
  end: number;
  seconds: { start: number; end: number; duration: number };
  text?: string[];
  clips?: string[];
  audio?: { vo: string | null; vo_frames: number | null; bed: string | null };
  budget?: { designed: number | null; grew_for_read: boolean; fixed: boolean };
  station?: boolean;
  render?: SectionRender;
};

export type Review = {
  at: string; version: string | null; section: string | null;
  verdict: string; words: string; reviewer: string;
};

export type VideoRecord = {
  schema?: string;
  project?: string;
  composition_id: string;
  version?: string;
  dimensions?: { width: number; height: number };
  fps: number;
  duration: { frames: number; seconds: number };
  output?: { file: string; bytes: number; rendered: string };
  sections: Section[];
  sections_rendered?: { at: string; dir: string; produced: number; of: number };
  review?: Review[];
  focal_element?: { what: string; abs_frame: number; why: string };
};

export type VideoSummary = {
  project: string;
  composition_id: string | null;
  version: string | null;
  duration: { frames: number; seconds: number } | null;
  dimensions: { width: number; height: number } | null;
  sections: number;
  parts_produced: number;
  reviewable: boolean;
  error?: string;
};

const json = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const r = await fetch(BASE + url, init);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json() as Promise<T>;
};

export const listVideos = () => json<VideoSummary[]>('/api/videos');

export const getVideo = (project: string) => json<VideoRecord>(`/api/videos/${project}`);

export const postReview = (
  project: string,
  body: { section: string | null; verdict: string; words: string },
) =>
  json<{ ok: boolean; count: number }>(`/api/videos/${project}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

/** A rendered part's playable URL. Parts are served from the repo, not copied anywhere. */
export const partUrl = (s: Section) => (s.render?.file ? `${BASE}/media/${s.render.file}` : null);

/** The full film, if the record names one. */
export const fullUrl = (rec: VideoRecord) =>
  rec.output?.file ? `${BASE}/media/${rec.output.file.replace(/^studio\/output\//, '')}` : null;

export const fmt = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
};
