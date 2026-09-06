import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { brandPacksApi, assetsApi, slotsApi } from '../api';
import type { BrandPackRun, BrightyExport, SlotType } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────

function copyToClipboard(text: string, onDone: (msg: string) => void) {
  navigator.clipboard.writeText(text)
    .then(() => onDone('Copied!'))
    .catch(() => onDone('Copy failed'));
}

function tierClass(tier: string) {
  const map: Record<string, string> = {
    strong: 'bg-green-900/40 text-green-400',
    acceptable: 'bg-yellow-900/40 text-yellow-400',
    logo: 'bg-gray-800 text-gray-400',
  };
  return map[tier] ?? 'bg-purple-900/40 text-purple-400';
}

// ─── Sub-components ────────────────────────────────────────────────

function SectionRule({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-5 h-px bg-gray-800" />
      <span style={{ fontFamily: "'Azeret Mono', monospace" }}
            className="text-[10px] tracking-widest uppercase text-gray-500 whitespace-nowrap">
        {title}
        {count !== undefined && <span className="text-gray-700 ml-1">({count})</span>}
      </span>
      <div className="flex-1 h-px bg-gray-800" />
    </div>
  );
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [flash, setFlash] = useState('');
  const handle = () => copyToClipboard(text, msg => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 1800);
  });
  return (
    <button
      onClick={handle}
      style={{ fontFamily: "'Azeret Mono', monospace" }}
      className={`text-[9px] tracking-wide px-2 py-1 rounded border transition-colors whitespace-nowrap
        ${flash ? 'bg-green-900/40 border-green-800 text-green-400' : 'bg-gray-900 border-gray-700 text-gray-500 hover:text-gray-200 hover:border-gray-600'}`}
    >
      {flash || label}
    </button>
  );
}

// ─── Identity section ──────────────────────────────────────────────

function IdentitySection({ data }: { data: BrightyExport }) {
  const { brand, seed_url } = data;
  return (
    <div className="flex items-center gap-6">
      {brand.logo_url && (
        <div className="w-16 h-16 rounded-xl border border-gray-800 bg-gray-900 flex items-center justify-center overflow-hidden flex-shrink-0">
          <img src={brand.logo_url} alt="Logo" className="max-w-full max-h-full object-contain"
               onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
      )}
      <div>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}
            className="text-3xl font-bold text-gray-100 tracking-tight mb-1">
          {brand.brand_name || '—'}
        </h2>
        <a href={seed_url} target="_blank" rel="noopener noreferrer"
           style={{ fontFamily: "'Azeret Mono', monospace" }}
           className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
          {seed_url}
        </a>
      </div>
    </div>
  );
}

// ─── Colour section ────────────────────────────────────────────────

function SwatchFanout({ hex, label }: { hex: string; label: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <span style={{ fontFamily: "'Azeret Mono', monospace" }}
            className="text-[9px] tracking-widest uppercase text-gray-600">{label}</span>
      <div
        className="flex items-center rounded-lg border border-gray-800 overflow-hidden transition-all duration-300 cursor-pointer"
        style={{ height: 48, width: hovered ? 164 : 48, background: 'rgba(20,20,32,0.8)' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="flex-shrink-0 h-full" style={{ width: 48, background: hex }} />
        <div className={`flex items-center gap-1.5 px-2 transition-opacity duration-150 ${hovered ? 'opacity-100' : 'opacity-0'}`}
             style={{ transitionDelay: hovered ? '80ms' : '0ms' }}>
          <span style={{ fontFamily: "'Azeret Mono', monospace" }}
                className="text-[9px] text-gray-400 whitespace-nowrap">{hex}</span>
          <button
            onClick={() => copyToClipboard(hex, () => {})}
            style={{ fontFamily: "'Azeret Mono', monospace" }}
            className="text-[9px] bg-black/30 text-gray-300 hover:bg-blue-600 hover:text-white px-1.5 py-0.5 rounded transition-colors"
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}

function ColourSection({ data }: { data: BrightyExport }) {
  const { colours } = data.brand;
  const allValid = colours.all.filter(h => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(h));

  if (!colours.primary && allValid.length === 0) {
    return <p style={{ fontFamily: "'Azeret Mono', monospace" }} className="text-[11px] italic text-gray-700">No colours extracted.</p>;
  }

  return (
    <div>
      {/* Active palette */}
      <div className="flex gap-5 mb-8">
        {colours.primary   && <SwatchFanout hex={colours.primary}   label="Primary" />}
        {colours.secondary && colours.secondary !== colours.primary && (
          <SwatchFanout hex={colours.secondary} label="Secondary" />
        )}
        {colours.accent && colours.accent !== colours.primary && (
          <SwatchFanout hex={colours.accent} label="Accent" />
        )}
      </div>

      {/* Extended grid */}
      {allValid.length > 0 && (
        <>
          <p style={{ fontFamily: "'Azeret Mono', monospace" }}
             className="text-[9px] tracking-widest uppercase text-gray-600 mb-3">
            All extracted <span className="text-gray-700">({allValid.length})</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {allValid.map((hex, i) => (
              <div
                key={i}
                className="relative group"
                title={hex}
              >
                <div
                  className="w-8 h-8 rounded-md border border-white/5 cursor-pointer transition-transform hover:scale-110 hover:-translate-y-0.5"
                  style={{ background: hex, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 8px rgba(0,0,0,0.4)' }}
                />
                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                  <div className="flex flex-col gap-0.5 bg-gray-900 border border-gray-700 rounded-md p-1.5 shadow-xl">
                    <span style={{ fontFamily: "'Azeret Mono', monospace" }}
                          className="text-[9px] text-gray-300 whitespace-nowrap">{hex}</span>
                    <button
                      className="pointer-events-auto text-[9px] bg-gray-800 hover:bg-blue-600 text-gray-400 hover:text-white px-1.5 py-0.5 rounded transition-colors"
                      style={{ fontFamily: "'Azeret Mono', monospace" }}
                      onClick={() => copyToClipboard(hex, () => {})}
                    >
                      Copy hex
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Typography section ────────────────────────────────────────────

function TypographySection({ data }: { data: BrightyExport }) {
  const { fonts } = data.brand;
  if (!fonts.heading && !fonts.body) {
    return <p style={{ fontFamily: "'Azeret Mono', monospace" }} className="text-[11px] italic text-gray-700">No fonts detected.</p>;
  }
  const rows = [
    { role: 'Heading', font: fonts.heading },
    { role: 'Body',    font: fonts.body },
  ].filter(r => r.font);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {rows.map(({ role, font }) => (
        <div key={role} className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
          <p style={{ fontFamily: "'Azeret Mono', monospace" }}
             className="text-[9px] tracking-widest uppercase text-gray-600 mb-3">{role}</p>
          <p className="text-2xl text-gray-100 mb-2 overflow-hidden whitespace-nowrap text-ellipsis"
             style={{ fontFamily: `'${font}', serif` }}>
            {font}
          </p>
          <div className="flex items-center justify-between">
            <span style={{ fontFamily: "'Azeret Mono', monospace" }}
                  className="text-[10px] text-gray-500">{font}</span>
            <CopyButton text={font} label="Copy name" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Import panel ─────────────────────────────────────────────────

type ImportMode = 'url' | 'zip';

interface ImportPanelProps {
  selection: SelectionCtx;
}

function providerLabel(url: string): string {
  try {
    const u = new URL(url);
    const h = u.hostname;
    const p = u.pathname;
    if (h.includes('ffycdn.net') || h.includes('frontify.com')) return 'Frontify';
    if (h === 'assets.new.siemens.com') return 'Siemens DAM';
    if (h === 'cdn.sanity.io' || /\/content-images\/[a-z0-9]+\/production\//.test(p)) return 'Sanity';
    if (p.includes('/wp-content/uploads/')) return 'WordPress';
    if (p.includes('/content/dam/')) return 'Adobe AEM';
    return '';
  } catch { return ''; }
}

function ImportPanel({ selection }: ImportPanelProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ImportMode>('url');
  const [inputUrl, setInputUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [zipResults, setZipResults] = useState<import('../types').Asset[] | null>(null);
  const [pickBusy, setPickBusy] = useState<number | null>(null);
  const [err, setErr] = useState('');

  const provider = providerLabel(inputUrl);

  async function handleUrlImport() {
    if (!inputUrl.trim()) return;
    setBusy(true); setErr('');
    try {
      const asset = await assetsApi.importUrl(selection.projectId, selection.slotId, inputUrl.trim());
      await slotsApi.selectAsset(selection.projectId, selection.slotId, asset.id);
      selection.onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Import failed');
    } finally { setBusy(false); }
  }

  async function handleZipImport() {
    if (!inputUrl.trim()) return;
    setBusy(true); setErr(''); setZipResults(null);
    try {
      const assets = await assetsApi.importZip(selection.projectId, selection.slotId, inputUrl.trim());
      if (assets.length === 0) setErr('No images found in ZIP');
      else setZipResults(assets);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'ZIP import failed');
    } finally { setBusy(false); }
  }

  async function handlePick(asset: import('../types').Asset) {
    setPickBusy(asset.id);
    try {
      await slotsApi.selectAsset(selection.projectId, selection.slotId, asset.id);
      selection.onDone();
    } catch { setPickBusy(null); }
  }

  return (
    <div className="mb-6 border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        style={{ fontFamily: "'Azeret Mono', monospace" }}
        className="w-full flex items-center justify-between px-4 py-3 text-[10px] tracking-widest uppercase text-gray-500 hover:text-gray-300 hover:bg-gray-900/40 transition-colors"
      >
        <span>Import from URL or ZIP</span>
        <span className="text-gray-700">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-800 bg-gray-900/20">
          {/* Mode tabs */}
          <div className="flex gap-1 mt-3 mb-4">
            {(['url', 'zip'] as ImportMode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setZipResults(null); setErr(''); }}
                style={{ fontFamily: "'Azeret Mono', monospace" }}
                className={`px-3 py-1 rounded text-[10px] tracking-wide uppercase transition-colors ${
                  mode === m
                    ? 'bg-gray-700 text-gray-200'
                    : 'text-gray-600 hover:text-gray-400'
                }`}
              >
                {m === 'url' ? 'Single URL' : 'ZIP archive'}
              </button>
            ))}
          </div>

          {/* URL input */}
          <div className="flex gap-2 items-center">
            <div className="flex-1 relative">
              <input
                type="url"
                value={inputUrl}
                onChange={e => { setInputUrl(e.target.value); setZipResults(null); setErr(''); }}
                placeholder={mode === 'url' ? 'https://cdn.example.com/image.jpg' : 'https://example.com/press-kit.zip'}
                style={{ fontFamily: "'Azeret Mono', monospace" }}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-[11px] text-gray-200 placeholder-gray-700 focus:outline-none focus:border-gray-500 pr-24"
              />
              {provider && (
                <span
                  style={{ fontFamily: "'Azeret Mono', monospace" }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-indigo-400 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-900/60 whitespace-nowrap"
                >
                  {provider}
                </span>
              )}
            </div>
            <button
              onClick={mode === 'url' ? handleUrlImport : handleZipImport}
              disabled={busy || !inputUrl.trim()}
              style={{ fontFamily: "'Azeret Mono', monospace" }}
              className="px-4 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 text-[11px] text-white transition-colors whitespace-nowrap"
            >
              {busy ? (mode === 'zip' ? 'Extracting…' : 'Importing…') : (mode === 'zip' ? 'Extract ZIP' : 'Import')}
            </button>
          </div>

          {mode === 'url' && (
            <p style={{ fontFamily: "'Azeret Mono', monospace" }}
               className="text-[9px] text-gray-700 mt-1.5">
              CDN URLs from Frontify, WordPress, Sanity, Siemens DAM and AEM are automatically upgraded to full resolution.
            </p>
          )}
          {mode === 'zip' && (
            <p style={{ fontFamily: "'Azeret Mono', monospace" }}
               className="text-[9px] text-gray-700 mt-1.5">
              Paste a direct ZIP URL. All images inside will be extracted — pick one to use in this slot.
            </p>
          )}

          {err && (
            <p style={{ fontFamily: "'Azeret Mono', monospace" }}
               className="text-[10px] text-red-400 mt-2">{err}</p>
          )}

          {/* ZIP results grid */}
          {zipResults && zipResults.length > 0 && (
            <div className="mt-4">
              <p style={{ fontFamily: "'Azeret Mono', monospace" }}
                 className="text-[9px] tracking-widest uppercase text-gray-600 mb-3">
                {zipResults.length} image{zipResults.length !== 1 ? 's' : ''} extracted — pick one
              </p>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
                {zipResults.map(asset => (
                  <div key={asset.id} className="group relative rounded-lg border border-gray-700 bg-gray-900/60 overflow-hidden aspect-video">
                    <img
                      src={`/uploads/${asset.file_path}`}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={e => { (e.target as HTMLImageElement).style.opacity = '0.2'; }}
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => handlePick(asset)}
                        disabled={pickBusy === asset.id}
                        style={{ fontFamily: "'Azeret Mono', monospace" }}
                        className="text-[10px] px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors"
                      >
                        {pickBusy === asset.id ? '…' : 'Use this'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Images section ────────────────────────────────────────────────

interface ImagesSectionProps {
  data: BrightyExport;
  selection?: SelectionCtx;
}

function ImagesSection({ data, selection }: ImagesSectionProps) {
  const [busy, setBusy] = useState<number | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());

  const images = data.assets.filter(a => a.type === 'image' || a.type === 'video');
  const logo   = data.assets.find(a => a.type === 'logo');

  if (images.length === 0 && !logo) {
    return <p style={{ fontFamily: "'Azeret Mono', monospace" }} className="text-[11px] italic text-gray-700">No images in this brand pack.</p>;
  }

  const all = [...(logo ? [logo] : []), ...images];

  async function handleUse(i: number, url: string) {
    if (!selection) return;
    setBusy(i);
    try {
      const asset = await assetsApi.importUrl(selection.projectId, selection.slotId, url);
      await slotsApi.selectAsset(selection.projectId, selection.slotId, asset.id);
      setDone(prev => new Set([...prev, i]));
      selection.onDone();
    } catch (err) {
      alert(`Failed to import: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
      {all.map((asset, i) => (
        <div key={i} className={`group relative rounded-lg border overflow-hidden aspect-video
          ${done.has(i) ? 'border-green-600 bg-gray-900/40' : 'border-gray-800 bg-gray-900/40'}`}>
          <img
            src={asset.url}
            alt={asset.alt || asset.type}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={e => { (e.target as HTMLImageElement).parentElement!.style.background = 'rgba(255,255,255,0.03)'; }}
          />
          {done.has(i) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span style={{ fontFamily: "'Azeret Mono', monospace" }} className="text-[11px] text-green-400">Assigned</span>
            </div>
          )}
          {/* Overlay */}
          {!done.has(i) && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5 gap-1.5">
              <div className="flex gap-1 flex-wrap">
                <span style={{ fontFamily: "'Azeret Mono', monospace" }}
                      className={`text-[9px] px-1.5 py-0.5 rounded ${tierClass(asset.type)}`}>
                  {asset.type}
                </span>
              </div>
              {asset.alt && (
                <p style={{ fontFamily: "'Azeret Mono', monospace" }}
                   className="text-[10px] text-gray-300 line-clamp-2">{asset.alt}</p>
              )}
              <div className="flex gap-1.5">
                {selection ? (
                  <button
                    onClick={() => handleUse(i, asset.url)}
                    disabled={busy === i}
                    style={{ fontFamily: "'Azeret Mono', monospace" }}
                    className="text-[9px] px-2 py-1 rounded border border-indigo-600 bg-indigo-700 text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                  >
                    {busy === i ? 'Importing…' : 'Use in slot'}
                  </button>
                ) : (
                  <CopyButton text={asset.url} label="Copy URL" />
                )}
                <a
                  href={asset.url} target="_blank" rel="noopener noreferrer"
                  style={{ fontFamily: "'Azeret Mono', monospace" }}
                  className="text-[9px] px-2 py-1 rounded border border-gray-700 bg-gray-900 text-gray-500 hover:text-gray-200 hover:border-gray-600 transition-colors"
                >
                  Open ↗
                </a>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Text section ─────────────────────────────────────────────────

type TextGroup = { label: string; items: string[] };

function buildTextGroups(data: BrightyExport): TextGroup[] {
  const { content } = data;
  return [
    { label: 'Taglines',          items: content.tagline ? [content.tagline] : [] },
    { label: 'Headlines',         items: content.headline ? [content.headline] : [] },
    { label: 'Subheadlines',      items: content.subheadline ? [content.subheadline] : [] },
    { label: 'Features',          items: content.features },
    { label: 'Supporting Claims', items: content.supporting_claims.slice(0, 20) },
  ].filter(g => g.items.length > 0);
}

interface TextSectionProps {
  data: BrightyExport;
  selection?: SelectionCtx;
}

function TextSection({ data, selection }: TextSectionProps) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState<string | null>(null);
  const LIMIT = 6;

  const groups = buildTextGroups(data);
  const totalCount = groups.reduce((n, g) => n + g.items.length, 0);

  if (totalCount === 0) {
    return <p style={{ fontFamily: "'Azeret Mono', monospace" }} className="text-[11px] italic text-gray-700">No text content extracted.</p>;
  }

  const q = search.toLowerCase();
  const filteredGroups = groups.map(g => ({
    ...g,
    items: q ? g.items.filter(t => t.toLowerCase().includes(q)) : g.items,
  })).filter(g => g.items.length > 0);

  return (
    <div>
      {/* Search */}
      <input
        type="search"
        placeholder="Search text…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ fontFamily: "'Azeret Mono', monospace" }}
        className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-[12px] text-gray-200 placeholder-gray-700 focus:outline-none focus:border-gray-600 mb-6"
      />

      {filteredGroups.map(group => {
        const isExpanded = expanded.has(group.label);
        const visible = isExpanded ? group.items : group.items.slice(0, LIMIT);
        const hidden = group.items.length - LIMIT;

        return (
          <div key={group.label} className="mb-7">
            <div className="flex items-center gap-2 pb-1.5 border-b border-gray-800 mb-2">
              <span style={{ fontFamily: "'Azeret Mono', monospace" }}
                    className="text-[10px] tracking-widest uppercase text-gray-500">{group.label}</span>
              <span style={{ fontFamily: "'Azeret Mono', monospace" }}
                    className="text-[9px] text-gray-700">{group.items.length}</span>
            </div>
            {visible.map((text, i) => {
              const rowKey = `${group.label}-${i}`;
              return (
                <div key={i} className="flex items-start gap-2 px-2 py-2 rounded-md odd:bg-gray-900/30 hover:bg-gray-800/40 transition-colors group/row">
                  <p style={{ fontFamily: "'Azeret Mono', monospace" }}
                     className="flex-1 text-[12px] text-gray-200 leading-relaxed"
                     dangerouslySetInnerHTML={{ __html: q ? highlightText(text, q) : escHtml(text) }} />
                  <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                    {selection ? (
                      <>
                        <button
                          disabled={applying === rowKey + '-h'}
                          onClick={async () => {
                            setApplying(rowKey + '-h');
                            try {
                              await slotsApi.update(selection.projectId, selection.slotId, { headline: text });
                              selection.onDone();
                            } catch { /* ignore */ } finally { setApplying(null); }
                          }}
                          style={{ fontFamily: "'Azeret Mono', monospace" }}
                          className="text-[9px] px-2 py-1 rounded border border-indigo-700 bg-indigo-900/60 text-indigo-300 hover:bg-indigo-700 hover:text-white disabled:opacity-40 transition-colors whitespace-nowrap"
                        >
                          → Headline
                        </button>
                        <button
                          disabled={applying === rowKey + '-d'}
                          onClick={async () => {
                            setApplying(rowKey + '-d');
                            try {
                              await slotsApi.update(selection.projectId, selection.slotId, { description: text });
                              selection.onDone();
                            } catch { /* ignore */ } finally { setApplying(null); }
                          }}
                          style={{ fontFamily: "'Azeret Mono', monospace" }}
                          className="text-[9px] px-2 py-1 rounded border border-gray-700 bg-gray-900 text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-40 transition-colors whitespace-nowrap"
                        >
                          → Desc
                        </button>
                      </>
                    ) : (
                      <CopyButton text={text} />
                    )}
                  </div>
                </div>
              );
            })}
            {!isExpanded && hidden > 0 && (
              <button
                onClick={() => setExpanded(prev => new Set([...prev, group.label]))}
                style={{ fontFamily: "'Azeret Mono', monospace" }}
                className="text-[10px] text-gray-600 hover:text-gray-400 underline underline-offset-2 mt-1 ml-2 transition-colors"
              >
                Show {hidden} more
              </button>
            )}
            {isExpanded && group.items.length > LIMIT && (
              <button
                onClick={() => setExpanded(prev => { const s = new Set(prev); s.delete(group.label); return s; })}
                style={{ fontFamily: "'Azeret Mono', monospace" }}
                className="text-[10px] text-gray-600 hover:text-gray-400 underline underline-offset-2 mt-1 ml-2 transition-colors"
              >
                Show less
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function highlightText(text: string, query: string): string {
  const escaped = escHtml(text);
  const escapedQ = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(new RegExp(`(${escapedQ})`, 'gi'), '<mark class="bg-blue-900/40 text-blue-300 rounded px-0.5">$1</mark>');
}

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Selection context ─────────────────────────────────────────────

interface SelectionCtx {
  projectId: number;
  slotId: number;
  slotType: SlotType;
  onDone: () => void;
}

// ─── Main page ─────────────────────────────────────────────────────

export function BrandAssetsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [runs, setRuns] = useState<BrandPackRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [exportData, setExportData] = useState<BrightyExport | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingExport, setLoadingExport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load run list
  useEffect(() => {
    brandPacksApi.list()
      .then(data => {
        setRuns(data);
        const latest = data.find(r => r.status === 'complete');
        if (latest) setSelectedRunId(latest.id);
      })
      .catch(() => setError('Failed to load brand pack runs'))
      .finally(() => setLoadingRuns(false));
  }, []);

  // Load export when selection changes
  const loadExport = useCallback((id: number) => {
    setLoadingExport(true);
    setExportData(null);
    setError(null);
    brandPacksApi.brightyExport(id)
      .then(setExportData)
      .catch(() => setError('Failed to load brand pack — it may not be complete yet'))
      .finally(() => setLoadingExport(false));
  }, []);

  useEffect(() => {
    if (selectedRunId != null) loadExport(selectedRunId);
  }, [selectedRunId, loadExport]);

  // Apply accent colour to page once data loads
  useEffect(() => {
    if (exportData?.brand.colours.accent) {
      document.documentElement.style.setProperty('--ba-accent', exportData.brand.colours.accent);
    }
  }, [exportData]);

  // Scroll to hash section once data is ready (supports links from slot panel)
  useEffect(() => {
    if (!exportData) return;
    const hash = window.location.hash;
    if (!hash) return;
    const timer = setTimeout(() => {
      document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(timer);
  }, [exportData]);

  const completeRuns = runs.filter(r => r.status === 'complete');

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

  return (
    <div className="min-h-screen bg-gray-950" data-demo="brand-assets-page">

      {/* Selection mode banner */}
      {selection && (
        <div className="sticky top-0 z-20 bg-indigo-950 border-b border-indigo-800 px-6 py-2 flex items-center gap-3">
          <span style={{ fontFamily: "'Azeret Mono', monospace" }}
                className="text-[11px] text-indigo-300">
            Selecting for slot — choose an asset below, or
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
          <h1 style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}
              className="text-lg font-semibold text-gray-100 tracking-tight">
            {exportData?.brand.brand_name ? `${exportData.brand.brand_name} — Brand Assets` : 'Brand Assets'}
          </h1>
        </div>
        {/* Run selector */}
        {completeRuns.length > 1 && (
          <select
            value={selectedRunId ?? ''}
            onChange={e => setSelectedRunId(Number(e.target.value))}
            style={{ fontFamily: "'Azeret Mono', monospace" }}
            className="bg-gray-900 border border-gray-700 rounded-lg text-[11px] text-gray-300 px-3 py-1.5 focus:outline-none focus:border-gray-500"
          >
            {completeRuns.map(r => (
              <option key={r.id} value={r.id}>
                {r.brand_name || r.seed_url} · {new Date(r.created_at).toLocaleDateString()}
              </option>
            ))}
          </select>
        )}
        <span style={{ fontFamily: "'Azeret Mono', monospace" }}
              className="text-[10px] text-gray-600">
          {user?.name}
        </span>
      </header>

      <div className="flex">

        {/* Sidebar nav */}
        <nav className="hidden lg:flex flex-col gap-1 w-52 flex-shrink-0 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto px-5 py-8 border-r border-gray-800/60">
          {(['identity','colour','typography','images','text'] as const).map(key => {
            const labels: Record<string, string> = {
              identity: 'Identity', colour: 'Colour', typography: 'Typography',
              images: 'Images', text: 'Text',
            };
            return (
              <a key={key} href={`#s-${key}`}
                 style={{ fontFamily: "'Azeret Mono', monospace" }}
                 className="flex items-center gap-3 py-2 text-[10px] tracking-widest uppercase text-gray-600 hover:text-gray-300 transition-colors group"
                 onClick={e => { e.preventDefault(); document.getElementById(`s-${key}`)?.scrollIntoView({ behavior: 'smooth' }); }}
              >
                <span className="h-px w-4 bg-gray-700 group-hover:w-8 group-hover:bg-blue-500 transition-all duration-200" />
                {labels[key]}
              </a>
            );
          })}
        </nav>

        {/* Content */}
        <main className="flex-1 px-6 lg:px-10 py-8 max-w-4xl">

          {/* Loading / error states */}
          {loadingRuns && (
            <p style={{ fontFamily: "'Azeret Mono', monospace" }}
               className="text-[11px] text-gray-600 italic">Loading brand packs…</p>
          )}
          {!loadingRuns && completeRuns.length === 0 && (
            <div className="text-center py-20">
              <p style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}
                 className="text-2xl text-gray-700 mb-3">No brand packs yet</p>
              <p style={{ fontFamily: "'Azeret Mono', monospace" }}
                 className="text-[11px] text-gray-600">Run the brand extraction pipeline to get started.</p>
            </div>
          )}
          {error && (
            <div className="mb-6 px-4 py-3 bg-red-950/40 border border-red-900/50 rounded-lg">
              <p style={{ fontFamily: "'Azeret Mono', monospace" }}
                 className="text-[11px] text-red-400">{error}</p>
            </div>
          )}

          {loadingExport && (
            <p style={{ fontFamily: "'Azeret Mono', monospace" }}
               className="text-[11px] text-gray-600 italic">Loading…</p>
          )}

          {exportData && (
            <div className="space-y-14">

              {/* Identity */}
              <section id="s-identity">
                <SectionRule title="Identity" />
                <IdentitySection data={exportData} />
              </section>

              {/* Colour */}
              <section id="s-colour">
                <SectionRule title="Colour Palette"
                  count={exportData.brand.colours.all.filter(h => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(h)).length} />
                <ColourSection data={exportData} />
              </section>

              {/* Typography */}
              <section id="s-typography">
                <SectionRule title="Typography" />
                <TypographySection data={exportData} />
              </section>

              {/* Images */}
              <section id="s-images">
                <SectionRule title="Images" count={exportData.assets.length} />
                {selection && <ImportPanel selection={selection} />}
                <ImagesSection data={exportData} selection={selection} />
              </section>

              {/* Text */}
              <section id="s-text">
                <SectionRule title="Text &amp; Claims" />
                <TextSection data={exportData} selection={selection} />
              </section>

            </div>
          )}
        </main>
      </div>
    </div>
  );
}
