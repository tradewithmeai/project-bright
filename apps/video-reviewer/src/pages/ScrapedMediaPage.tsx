import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { scrapesApi, assetsApi, slotsApi } from '../api';
import type { SlotType } from '../types';

// ─── Scrape data types ─────────────────────────────────────────────

interface BrandImage {
  brand: string;
  webp?: string;
  png?: string;
  width_px?: number;
}

interface PressSample {
  description?: string;
  full_res?: string;
  resized?: string;
}

interface MediaScrape {
  company: string;
  website?: string;
  sector?: string;
  hq?: string;
  scrape_date?: string;
  logo?: { white_svg?: string };
  brand_images?: BrandImage[];
  website_videos?: { count?: number; urls?: string[]; notes?: string };
  press_images?: { notes?: string; samples?: PressSample[] };
  sponsorship_images?: Record<string, string>;
  sponsorships?: { active?: Array<{ partner: string; type: string }> };
  social?: {
    linkedin?: { url?: string; followers?: number; posting_frequency?: string };
    youtube?: { url?: string };
  };
  linkedin_post_images?: string[];
  content_themes?: string[];
}

// ─── Normalised item/section types ────────────────────────────────

type MediaType = 'video' | 'image';

interface MediaItem {
  url: string;
  label: string;
  mediaType: MediaType;
  description?: string;
  expiring?: boolean; // LinkedIn images expire
}

interface MediaSection {
  id: string;
  title: string;
  items: MediaItem[];
  note?: string;
  defaultLimit?: number;
}

function buildSections(data: MediaScrape): MediaSection[] {
  const sections: MediaSection[] = [];

  // 1. Videos — highest uniqueness rank
  if (data.website_videos?.urls?.length) {
    sections.push({
      id: 'videos',
      title: 'Videos',
      note: data.website_videos.notes,
      items: data.website_videos.urls.map((url, i) => ({
        url,
        label: `Clip ${i + 1}`,
        mediaType: 'video',
      })),
    });
  }

  // 2. Brand images — one per brand, prefer webp (smaller, same quality)
  if (data.brand_images?.length) {
    sections.push({
      id: 'brand',
      title: 'Brand Images',
      items: data.brand_images
        .map(b => ({ url: b.webp || b.png || '', label: b.brand, mediaType: 'image' as MediaType }))
        .filter(i => i.url),
    });
  }

  // 3. Press & Editorial — full-res from OSS/CDN
  const pressItems: MediaItem[] = [];
  for (const s of data.press_images?.samples ?? []) {
    const url = s.full_res || s.resized;
    if (url) pressItems.push({ url, label: s.description || 'Press image', mediaType: 'image' });
  }
  if (pressItems.length) {
    sections.push({
      id: 'press',
      title: 'Press & Editorial',
      note: data.press_images?.notes,
      items: pressItems,
    });
  }

  // 4. Sponsorships
  const sponsorItems: MediaItem[] = [];
  for (const [key, url] of Object.entries(data.sponsorship_images ?? {})) {
    if (typeof url === 'string' && url.startsWith('http')) {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      sponsorItems.push({ url, label, mediaType: 'image' });
    }
  }
  if (sponsorItems.length) {
    const partners = data.sponsorships?.active?.map(s => s.partner) ?? [];
    sections.push({
      id: 'sponsorship',
      title: 'Sponsorships',
      note: partners.length ? partners.join(' · ') : undefined,
      items: sponsorItems,
    });
  }

  // 5. Social (LinkedIn post images) — collapse to 4, note expiry
  if (data.linkedin_post_images?.length) {
    sections.push({
      id: 'social',
      title: 'Social',
      note: 'LinkedIn post images — URLs expire. Import promptly.',
      defaultLimit: 4,
      items: data.linkedin_post_images.map((url, i) => ({
        url,
        label: `LinkedIn post ${i + 1}`,
        mediaType: 'image',
        expiring: true,
      })),
    });
  }

  return sections;
}

// ─── Selection context ─────────────────────────────────────────────

interface SelectionCtx {
  projectId: number;
  slotId: number;
  slotType: SlotType;
  onDone: () => void;
}

// ─── Shared helpers ────────────────────────────────────────────────


function SectionRule({ title, count, note }: { title: string; count?: number; note?: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-5 h-px bg-gray-800" />
        <span
          style={{ fontFamily: "'Azeret Mono', monospace" }}
          className="text-[10px] tracking-widest uppercase text-gray-500 whitespace-nowrap"
        >
          {title}
          {count !== undefined && <span className="text-gray-700 ml-1">({count})</span>}
        </span>
        <div className="flex-1 h-px bg-gray-800" />
      </div>
      {note && (
        <p style={{ fontFamily: "'Azeret Mono', monospace" }} className="text-[9px] text-gray-700 ml-8">
          {note}
        </p>
      )}
    </div>
  );
}

function CopyButton({ text, label = 'Copy URL' }: { text: string; label?: string }) {
  const [flash, setFlash] = useState('');
  const handle = () => {
    navigator.clipboard.writeText(text)
      .then(() => { setFlash('Copied!'); setTimeout(() => setFlash(''), 1800); })
      .catch(() => { setFlash('Failed'); setTimeout(() => setFlash(''), 1800); });
  };
  return (
    <button
      onClick={handle}
      style={{ fontFamily: "'Azeret Mono', monospace" }}
      className={`text-[9px] tracking-wide px-2 py-1 rounded border transition-colors whitespace-nowrap
        ${flash
          ? 'bg-green-900/40 border-green-800 text-green-400'
          : 'bg-gray-900 border-gray-700 text-gray-500 hover:text-gray-200 hover:border-gray-600'}`}
    >
      {flash || label}
    </button>
  );
}

// ─── Use-in-slot button ────────────────────────────────────────────

function UseButton({
  url, mediaType, selection,
}: {
  url: string;
  mediaType: MediaType;
  selection: SelectionCtx;
}) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'err'>('idle');
  const incompatible = selection.slotType !== mediaType;

  async function handleUse() {
    if (incompatible || state !== 'idle') return;
    setState('busy');
    try {
      const asset = await assetsApi.importUrl(selection.projectId, selection.slotId, url);
      await slotsApi.selectAsset(selection.projectId, selection.slotId, asset.id);
      setState('done');
      selection.onDone();
    } catch {
      setState('err');
      setTimeout(() => setState('idle'), 3000);
    }
  }

  if (incompatible) {
    return (
      <span
        style={{ fontFamily: "'Azeret Mono', monospace" }}
        className="text-[9px] text-gray-700 px-2 py-1"
        title={`Slot expects ${selection.slotType}, this is a ${mediaType}`}
      >
        Wrong type
      </span>
    );
  }

  return (
    <button
      onClick={handleUse}
      disabled={state !== 'idle'}
      style={{ fontFamily: "'Azeret Mono', monospace" }}
      className={`text-[9px] px-2 py-1 rounded border transition-colors whitespace-nowrap disabled:opacity-50
        ${state === 'done'
          ? 'bg-green-900/40 border-green-800 text-green-400'
          : state === 'err'
          ? 'bg-red-900/40 border-red-800 text-red-400'
          : 'border-indigo-600 bg-indigo-700 text-white hover:bg-indigo-600'}`}
    >
      {state === 'busy' ? 'Importing…' : state === 'done' ? 'Assigned' : state === 'err' ? 'Failed' : 'Use in slot'}
    </button>
  );
}

// ─── Video card ────────────────────────────────────────────────────

function VideoCard({ item, selection }: { item: MediaItem; selection?: SelectionCtx }) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/40 overflow-hidden">
      {playing ? (
        <video
          ref={videoRef}
          src={item.url}
          controls
          autoPlay
          preload="auto"
          className="w-full aspect-video bg-black"
        />
      ) : (
        <button
          onClick={() => setPlaying(true)}
          className="w-full aspect-video flex items-center justify-center bg-gray-900 group hover:bg-gray-800 transition-colors"
          title="Play clip"
        >
          <div className="w-11 h-11 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors border border-white/15">
            <svg width="14" height="16" viewBox="0 0 14 16" fill="none" className="ml-0.5">
              <path d="M1 1L13 8L1 15V1Z" fill="white" fillOpacity="0.85" />
            </svg>
          </div>
        </button>
      )}
      <div className="px-3 py-2.5 flex items-center gap-2">
        <span
          style={{ fontFamily: "'Azeret Mono', monospace" }}
          className="flex-1 text-[9px] text-gray-600 truncate"
          title={item.url}
        >
          {item.label}
        </span>
        {selection
          ? <UseButton url={item.url} mediaType="video" selection={selection} />
          : <CopyButton text={item.url} />}
        <a
          href={item.url} target="_blank" rel="noopener noreferrer"
          style={{ fontFamily: "'Azeret Mono', monospace" }}
          className="text-[9px] px-2 py-1 rounded border border-gray-700 bg-gray-900 text-gray-500 hover:text-gray-200 hover:border-gray-600 transition-colors"
        >
          ↗
        </a>
      </div>
    </div>
  );
}

// ─── Image card ────────────────────────────────────────────────────

function ImageCard({ item, selection }: { item: MediaItem; selection?: SelectionCtx; idx?: number }) {
  return (
    <div
      className={`group relative rounded-lg border overflow-hidden aspect-video
        ${item.expiring ? 'border-amber-900/40' : 'border-gray-800'} bg-gray-900/40`}
    >
      <img
        src={item.url}
        alt={item.label}
        loading="lazy"
        className="w-full h-full object-cover"
        onError={e => {
          const el = e.target as HTMLImageElement;
          el.style.opacity = '0.15';
          el.parentElement?.classList.add('bg-red-950/10');
        }}
      />

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5 gap-1.5">
        {item.label && (
          <p
            style={{ fontFamily: "'Azeret Mono', monospace" }}
            className="text-[9px] text-gray-300 leading-snug line-clamp-2"
          >
            {item.label}
          </p>
        )}
        <div className="flex gap-1.5 flex-wrap">
          {selection
            ? <UseButton url={item.url} mediaType="image" selection={selection} />
            : <CopyButton text={item.url} />}
          <a
            href={item.url} target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: "'Azeret Mono', monospace" }}
            className="text-[9px] px-2 py-1 rounded border border-gray-700 bg-gray-900/80 text-gray-500 hover:text-gray-200 hover:border-gray-600 transition-colors"
          >
            Open ↗
          </a>
        </div>
      </div>

      {item.expiring && (
        <div
          style={{ fontFamily: "'Azeret Mono', monospace" }}
          className="absolute top-1.5 right-1.5 text-[8px] text-amber-500 bg-amber-950/60 border border-amber-800/40 rounded px-1 py-0.5 pointer-events-none"
        >
          expires
        </div>
      )}
    </div>
  );
}

// ─── ZIP download button ───────────────────────────────────────────

function DownloadZipButton({ section }: { section: MediaSection }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'err'>('idle');
  const imageItems = section.items.filter(i => i.mediaType === 'image');
  if (imageItems.length === 0) return null;

  async function handleDownload() {
    if (state === 'busy') return;
    setState('busy');
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      let included = 0;
      await Promise.allSettled(imageItems.map(async (item, i) => {
        try {
          const res = await fetch(item.url, { mode: 'cors' });
          if (!res.ok) return;
          const blob = await res.blob();
          const ext = item.url.split('?')[0].split('.').pop()?.toLowerCase() || 'jpg';
          zip.file(`${String(i + 1).padStart(3, '0')}_${item.label.replace(/[^a-z0-9]/gi, '_').slice(0, 40)}.${ext}`, blob);
          included++;
        } catch {
          // CORS or network error — skip
        }
      }));
      if (included === 0) { setState('err'); setTimeout(() => setState('idle'), 3000); return; }
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${section.id}_${included}-of-${imageItems.length}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setState('done');
      setTimeout(() => setState('idle'), 3000);
    } catch {
      setState('err');
      setTimeout(() => setState('idle'), 3000);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={state === 'busy'}
      style={{ fontFamily: "'Azeret Mono', monospace" }}
      className={`text-[9px] tracking-wide px-2 py-1 rounded border transition-colors whitespace-nowrap disabled:opacity-50
        ${state === 'done'
          ? 'bg-green-900/40 border-green-800 text-green-400'
          : state === 'err'
          ? 'bg-red-900/40 border-red-800 text-red-400'
          : 'bg-gray-900 border-gray-700 text-gray-500 hover:text-gray-200 hover:border-gray-600'}`}
    >
      {state === 'busy' ? 'Zipping…' : state === 'done' ? 'Downloaded' : state === 'err' ? 'Failed (CORS?)' : 'Download ZIP'}
    </button>
  );
}

// ─── Section renderer ──────────────────────────────────────────────

function MediaSectionBlock({
  section, selection,
}: {
  section: MediaSection;
  selection?: SelectionCtx;
}) {
  const [expanded, setExpanded] = useState(!section.defaultLimit);
  const limit = section.defaultLimit ?? Infinity;
  const visible = expanded ? section.items : section.items.slice(0, limit);
  const hidden = section.items.length - visible.length;

  return (
    <section id={`s-${section.id}`} className="mb-12">
      <SectionRule title={section.title} count={section.items.length} note={section.note} />
      {!selection && section.id !== 'videos' && (
        <div className="-mt-3 mb-4 flex justify-end">
          <DownloadZipButton section={section} />
        </div>
      )}

      {section.items.length === 0 ? (
        <p style={{ fontFamily: "'Azeret Mono', monospace" }} className="text-[11px] italic text-gray-700">
          No items in this section.
        </p>
      ) : section.id === 'videos' ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {visible.map((item, i) => (
            <VideoCard key={i} item={item} selection={selection} />
          ))}
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {visible.map((item, i) => (
            <ImageCard key={i} item={item} selection={selection} idx={i} />
          ))}
        </div>
      )}

      {hidden > 0 && (
        <button
          onClick={() => setExpanded(true)}
          style={{ fontFamily: "'Azeret Mono', monospace" }}
          className="mt-3 text-[10px] text-gray-600 hover:text-gray-400 underline underline-offset-2 transition-colors"
        >
          Show {hidden} more
        </button>
      )}
      {expanded && section.defaultLimit && section.items.length > section.defaultLimit && (
        <button
          onClick={() => setExpanded(false)}
          style={{ fontFamily: "'Azeret Mono', monospace" }}
          className="mt-3 text-[10px] text-gray-600 hover:text-gray-400 underline underline-offset-2 transition-colors"
        >
          Show less
        </button>
      )}
    </section>
  );
}

// ─── Main page ─────────────────────────────────────────────────────

interface ScrapeListItem {
  slug: string;
  company: string;
  sector: string | null;
  hq: string | null;
  scrape_date: string | null;
}

export function ScrapedMediaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [scrapeList, setScrapeList] = useState<ScrapeListItem[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [data, setData] = useState<MediaScrape | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection mode — activated when arriving from slot panel
  const selectionProjectId = Number(searchParams.get('projectId')) || null;
  const selectionSlotId    = Number(searchParams.get('slotId'))    || null;
  const selectionSlotType  = (searchParams.get('slotType') as SlotType | null);

  const selection: SelectionCtx | undefined =
    selectionProjectId && selectionSlotId && selectionSlotType
      ? {
          projectId: selectionProjectId,
          slotId:    selectionSlotId,
          slotType:  selectionSlotType,
          onDone: () => navigate(`/projects/${selectionProjectId}?slot=${selectionSlotId}`),
        }
      : undefined;

  // Persist + restore selected slug across visits
  const LS_KEY = 'media-library-slug';

  function pickSlug(list: ScrapeListItem[]): string | null {
    if (list.length === 0) return null;
    // 1. Honour explicit ?slug= param
    const param = searchParams.get('slug');
    if (param && list.find(s => s.slug === param)) return param;
    // 2. Restore last selection from localStorage
    const stored = localStorage.getItem(LS_KEY);
    if (stored && list.find(s => s.slug === stored)) return stored;
    // 3. First in list (already sorted by date descending on backend)
    return list[0].slug;
  }

  // Load scrape list
  useEffect(() => {
    scrapesApi.list()
      .then(list => {
        setScrapeList(list);
        setSelectedSlug(pickSlug(list));
      })
      .catch(() => setError('Failed to load media library — no scrape files found'))
      .finally(() => setLoadingList(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist slug whenever it changes
  useEffect(() => {
    if (selectedSlug) localStorage.setItem(LS_KEY, selectedSlug);
  }, [selectedSlug]);

  // Load selected scrape data
  const loadScrape = useCallback((slug: string) => {
    setLoadingData(true);
    setData(null);
    setError(null);
    scrapesApi.get(slug)
      .then(raw => setData(raw as unknown as MediaScrape))
      .catch(() => setError('Failed to load scrape data'))
      .finally(() => setLoadingData(false));
  }, []);

  useEffect(() => {
    if (selectedSlug) loadScrape(selectedSlug);
  }, [selectedSlug, loadScrape]);

  const sections = data ? buildSections(data) : [];
  const activeScrape = scrapeList.find(s => s.slug === selectedSlug);

  return (
    <div className="min-h-screen bg-gray-950" data-demo="media-library-page">

      {/* Selection mode banner */}
      {selection && (
        <div className="sticky top-0 z-20 bg-indigo-950 border-b border-indigo-800 px-6 py-2 flex items-center gap-3">
          <span style={{ fontFamily: "'Azeret Mono', monospace" }} className="text-[11px] text-indigo-300">
            Selecting {selection.slotType} for slot — choose an asset below, or
          </span>
          <button
            onClick={() => navigate(`/projects/${selection.projectId}`)}
            style={{ fontFamily: "'Azeret Mono', monospace" }}
            className="text-[11px] text-indigo-400 hover:text-white underline underline-offset-2 transition-colors"
          >
            cancel
          </button>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-6 py-3 flex items-center gap-4">
        <button
          onClick={() => navigate('/projects')}
          style={{ fontFamily: "'Azeret Mono', monospace" }}
          className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors tracking-wide"
        >
          ← Projects
        </button>
        <div className="flex-1">
          <h1
            style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}
            className="text-lg font-semibold text-gray-100 tracking-tight"
          >
            {data ? `${data.company} — Media Library` : 'Media Library'}
          </h1>
          {activeScrape?.sector && (
            <p style={{ fontFamily: "'Azeret Mono', monospace" }} className="text-[9px] text-gray-600 mt-0.5">
              {activeScrape.sector}{activeScrape.hq ? ` · ${activeScrape.hq}` : ''}
              {activeScrape.scrape_date ? ` · scraped ${activeScrape.scrape_date}` : ''}
            </p>
          )}
        </div>

        {/* Company selector */}
        {scrapeList.length > 1 && (
          <select
            value={selectedSlug ?? ''}
            onChange={e => {
              setSelectedSlug(e.target.value);
              localStorage.setItem(LS_KEY, e.target.value);
            }}
            style={{ fontFamily: "'Azeret Mono', monospace" }}
            className="bg-gray-900 border border-gray-700 rounded-lg text-[11px] text-gray-300 px-3 py-1.5 focus:outline-none focus:border-gray-500"
          >
            {scrapeList.map(s => (
              <option key={s.slug} value={s.slug}>{s.company}</option>
            ))}
          </select>
        )}

        <span style={{ fontFamily: "'Azeret Mono', monospace" }} className="text-[10px] text-gray-600">
          {user?.name}
        </span>
      </header>

      <div className="flex">

        {/* Sidebar nav */}
        <nav className="hidden lg:flex flex-col gap-1 w-52 flex-shrink-0 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto px-5 py-8 border-r border-gray-800/60">
          {/* Logo */}
          {data?.logo?.white_svg && (
            <div className="mb-6 px-1">
              <img
                src={data.logo.white_svg}
                alt={`${data.company} logo`}
                className="h-7 w-auto object-contain opacity-70"
                loading="lazy"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}

          {sections.map(section => (
            <a
              key={section.id}
              href={`#s-${section.id}`}
              style={{ fontFamily: "'Azeret Mono', monospace" }}
              className="flex items-center gap-3 py-2 text-[10px] tracking-widest uppercase text-gray-600 hover:text-gray-300 transition-colors group"
              onClick={e => {
                e.preventDefault();
                document.getElementById(`s-${section.id}`)?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <span className="h-px w-4 bg-gray-700 group-hover:w-8 group-hover:bg-blue-500 transition-all duration-200" />
              {section.title}
              <span className="text-gray-700 ml-auto">{section.items.length}</span>
            </a>
          ))}

          {/* Content themes */}
          {data?.content_themes && data.content_themes.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-800/60">
              <p style={{ fontFamily: "'Azeret Mono', monospace" }}
                 className="text-[8px] tracking-widest uppercase text-gray-700 mb-3">Themes</p>
              <div className="flex flex-col gap-1.5">
                {data.content_themes.map((t, i) => (
                  <span key={i} style={{ fontFamily: "'Azeret Mono', monospace" }}
                        className="text-[9px] text-gray-700 leading-snug">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Content */}
        <main className="flex-1 px-6 lg:px-10 py-8 max-w-4xl">

          {loadingList || loadingData ? (
            <div className="flex items-center gap-3 text-gray-600 mt-16">
              <div className="w-4 h-4 border-2 border-gray-700 border-t-gray-400 rounded-full animate-spin" />
              <span style={{ fontFamily: "'Azeret Mono', monospace" }} className="text-[11px]">
                {loadingList ? 'Loading library…' : 'Loading media…'}
              </span>
            </div>
          ) : error ? (
            <div className="mt-16">
              <p style={{ fontFamily: "'Azeret Mono', monospace" }}
                 className="text-[11px] text-red-400 mb-2">{error}</p>
              <p style={{ fontFamily: "'Azeret Mono', monospace" }}
                 className="text-[10px] text-gray-600">
                Add a scrape JSON file to <code className="text-gray-500">backend/data/</code> to get started.
              </p>
            </div>
          ) : !data ? null : (
            <>
              {sections.length === 0 ? (
                <p style={{ fontFamily: "'Azeret Mono', monospace" }}
                   className="text-[11px] text-gray-600 mt-16 italic">
                  No media found in this scrape.
                </p>
              ) : (
                sections.map(section => (
                  <MediaSectionBlock
                    key={section.id}
                    section={section}
                    selection={selection}
                  />
                ))
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
