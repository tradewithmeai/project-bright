import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { slotsApi, runsApi } from '../api';
import type { Slot } from '../types';

// ─── Model definitions ────────────────────────────────────────────────────────
// Rates mirror backend/src/model-costs.ts — update both if Google changes pricing.

interface VideoModel {
  key: string;
  label: string;
  apiModel: string;
  supportsReferenceImages: boolean;
  supportsAudio: boolean;
  resolutions: string[];
  ratePerSecond: Record<string, number>; // resolution → USD/s
  durationRange: [number, number];       // [min, max] seconds
  notes?: string;
}

const VIDEO_MODELS: VideoModel[] = [
  {
    key: 'veo_lite',
    label: 'Veo 3.1 Lite',
    apiModel: 'veo-3.1-lite-generate-preview',
    supportsReferenceImages: false,
    supportsAudio: false,
    resolutions: ['720p', '1080p'],
    ratePerSecond: { '720p': 0.05, '1080p': 0.08 },
    durationRange: [4, 8],
    notes: 'Most cost-effective. No audio, no reference images.',
  },
  {
    key: 'veo_full',
    label: 'Veo 3.1 Full',
    apiModel: 'veo-3.1-generate-preview',
    supportsReferenceImages: true,
    supportsAudio: true,
    resolutions: ['720p', '1080p', '4K'],
    ratePerSecond: { '720p': 0.40, '1080p': 0.40, '4K': 0.60 },
    durationRange: [4, 8],
    notes: 'Includes audio. Reference images force 16:9 + 8s duration.',
  },
];

const ASPECT_RATIOS = ['16:9', '9:16', '1:1'];
const DURATIONS = [4, 5, 6, 7, 8];

interface RefImage {
  data: string;
  mimeType: string;
  preview: string;
}

interface PromptFields {
  subject: string;
  action: string;
  setting: string;
  lighting: string;
  camera: string;
  style: string;
}

function compilePrompt(fields: PromptFields): string {
  const parts: string[] = [];

  const subjectPart = [
    fields.subject ? `of ${fields.subject}` : '',
    fields.action ? `, ${fields.action}` : '',
  ].filter(Boolean).join('');

  const opener = [
    fields.camera ? `A cinematic ${fields.camera} shot` : 'A cinematic shot',
    subjectPart,
  ].filter(Boolean).join(' ');

  if (opener) parts.push(opener);
  if (fields.setting) parts.push(`Set in ${fields.setting}.`);
  if (fields.lighting) parts.push(`The scene is lit by ${fields.lighting}.`);
  if (fields.style) parts.push(fields.style);

  return parts.join(' ');
}

export function VideoGeneratePage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const slotId = Number(searchParams.get('slot'));

  const [slot, setSlot] = useState<Slot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modelKey, setModelKey] = useState<string>('veo_lite');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [duration, setDuration] = useState(4);
  const [resolution, setResolution] = useState('720p');
  const [refImages, setRefImages] = useState<(RefImage | null)[]>([null, null, null]);
  const [fields, setFields] = useState<PromptFields>({
    subject: '', action: '', setting: '', lighting: '', camera: '', style: '',
  });

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fileInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const activeModel = VIDEO_MODELS.find(m => m.key === modelKey)!;
  const hasRefImages = refImages.some(Boolean);

  // When model changes, reset resolution to first supported option
  useEffect(() => {
    if (!activeModel.resolutions.includes(resolution)) {
      setResolution(activeModel.resolutions[0]);
    }
  }, [modelKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Full model + reference images: force 16:9 and 8s
  useEffect(() => {
    if (modelKey === 'veo_full' && hasRefImages) {
      setAspectRatio('16:9');
      setDuration(8);
    }
  }, [modelKey, hasRefImages]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      refImages.forEach(img => { if (img) URL.revokeObjectURL(img.preview); });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!projectId || !slotId) return;
    slotsApi.list(Number(projectId))
      .then(slots => {
        const s = slots.find(sl => sl.id === slotId);
        if (!s) { setLoadError('Slot not found'); return; }
        setSlot(s);
      })
      .catch(() => setLoadError('Failed to load slot'));
  }, [projectId, slotId]);

  function handleFileSelect(index: number, file: File) {
    if (!file.type.match(/^image\/(jpeg|png)$/)) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = e.target?.result as string;
      const data = raw.split(',')[1];
      const preview = URL.createObjectURL(file);
      if (refImages[index]) URL.revokeObjectURL(refImages[index]!.preview);
      setRefImages(prev => {
        const next = [...prev];
        next[index] = { data, mimeType: file.type, preview };
        return next;
      });
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(index: number, e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(index, file);
  }

  function clearRefImage(index: number) {
    if (refImages[index]) URL.revokeObjectURL(refImages[index]!.preview);
    setRefImages(prev => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }

  function setField(key: keyof PromptFields, value: string) {
    setFields(prev => ({ ...prev, [key]: value }));
  }

  // ─── Cost calculation ──────────────────────────────────────────────────────
  // Mirrors model-costs.ts logic: cost = durationSeconds × ratePerSecond[resolution]
  const rate = activeModel.ratePerSecond[resolution] ?? 0;
  const effectiveDuration = (modelKey === 'veo_full' && hasRefImages) ? 8 : duration;
  const estimatedCost = effectiveDuration * rate;

  const compiledPrompt = compilePrompt(fields);
  const canSubmit = fields.subject.trim().length > 0 && !generating && !success;

  // Whether duration/aspect controls are locked (Full + ref images)
  const locked = modelKey === 'veo_full' && hasRefImages;

  async function handleGenerate() {
    if (!canSubmit || !projectId) return;
    setGenerating(true);
    setGenError(null);
    try {
      const images = refImages.filter(Boolean).map(img => img!.data);
      await runsApi.generate(Number(projectId), slotId, {
        prompt: compiledPrompt,
        aspectRatio,
        durationSeconds: effectiveDuration,
        resolution,
        referenceImages: images.length > 0 ? images : undefined,
        provider: modelKey,
      });
      setSuccess(true);
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-red-400">
        {loadError}
      </div>
    );
  }

  if (!slot) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate(`/projects/${projectId}`)}
          className="text-gray-400 hover:text-gray-200 text-sm flex items-center gap-1"
        >
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-500 uppercase">{slot.slot_key}</span>
          <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-purple-900 text-purple-300">
            video
          </span>
          <span className="text-sm font-semibold text-gray-200">{slot.role_label}</span>
        </div>
        <span className="ml-auto text-xs text-gray-500">{activeModel.label}</span>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">

        {/* Model Selection */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Model</h2>
          <div className="grid grid-cols-2 gap-3">
            {VIDEO_MODELS.map(m => (
              <button
                key={m.key}
                onClick={() => setModelKey(m.key)}
                className={`p-3 rounded border text-left transition-colors ${
                  modelKey === m.key
                    ? 'bg-purple-900/40 border-purple-600'
                    : 'bg-gray-900 border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="text-sm font-medium text-gray-100">{m.label}</div>
                <div className="text-xs text-gray-500 mt-1">{m.notes}</div>
                {/* Rate table: resolution rows × sample durations */}
                <div className="mt-2 space-y-0.5">
                  {m.resolutions.map(r => (
                    <div key={r} className="flex items-baseline gap-1.5 text-xs">
                      <span className="text-gray-500 w-10 shrink-0">{r}</span>
                      <span className="text-gray-400">${m.ratePerSecond[r].toFixed(2)}/s</span>
                      <span className="text-gray-600">·</span>
                      {[4, 8].map(d => (
                        <span key={d} className="text-gray-500">
                          {d}s=<span className="text-gray-300">${(d * m.ratePerSecond[r]).toFixed(2)}</span>
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
                {m.supportsReferenceImages && (
                  <div className="text-xs text-amber-600 mt-1.5">ref images → 8s forced = ${(8 * m.ratePerSecond['720p']).toFixed(2)}+</div>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Reference Images — Full model only */}
        {modelKey === 'veo_full' && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
              Reference Images{' '}
              <span className="text-gray-600 normal-case font-normal">(up to 3 — JPEG or PNG)</span>
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="relative">
                  {refImages[i] ? (
                    <div className="relative rounded border border-gray-700 overflow-hidden aspect-square">
                      <img
                        src={refImages[i]!.preview}
                        alt={`Reference ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => clearRefImage(i)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-gray-900/80
                          text-gray-300 hover:text-white text-xs flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div
                      onDrop={(e) => handleDrop(i, e)}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={() => fileInputRefs[i].current?.click()}
                      className="border-2 border-dashed border-gray-700 rounded aspect-square flex flex-col
                        items-center justify-center cursor-pointer hover:border-gray-500 transition-colors"
                    >
                      <span className="text-2xl text-gray-600">+</span>
                      <span className="text-xs text-gray-600 mt-1">{i + 1}</span>
                    </div>
                  )}
                  <input
                    ref={fileInputRefs[i]}
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(i, f); }}
                  />
                </div>
              ))}
            </div>
            {hasRefImages && (
              <p className="text-xs text-amber-500 mt-2">
                Reference images active — generation locked to 16:9, 8s ($3.20 at 720p / $3.20 at 1080p)
              </p>
            )}
            {!hasRefImages && (
              <p className="text-xs text-gray-600 mt-2">
                Reference images guide subject appearance. Adds constraint: forces 16:9 aspect ratio and 8s duration.
              </p>
            )}
          </section>
        )}

        {/* Duration */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Duration
            {locked && <span className="ml-2 text-amber-500 normal-case font-normal text-xs">(locked — reference images require 8s)</span>}
          </h2>
          <div className="flex gap-2">
            {DURATIONS.map(d => (
              <button
                key={d}
                onClick={() => !locked && setDuration(d)}
                disabled={locked}
                className={`px-4 py-1.5 rounded text-xs font-medium border transition-colors ${
                  effectiveDuration === d
                    ? 'bg-purple-700 border-purple-600 text-white'
                    : locked
                      ? 'bg-gray-800 border-gray-800 text-gray-600 cursor-not-allowed'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
                }`}
              >
                {d}s
              </button>
            ))}
          </div>
        </section>

        {/* Resolution */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Resolution</h2>
          <div className="flex gap-2">
            {activeModel.resolutions.map(r => (
              <button
                key={r}
                onClick={() => setResolution(r)}
                className={`px-4 py-1.5 rounded text-xs font-medium border transition-colors ${
                  resolution === r
                    ? 'bg-purple-700 border-purple-600 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-2">
            {activeModel.resolutions.map(r =>
              `${r} — $${activeModel.ratePerSecond[r].toFixed(2)}/s`
            ).join(' · ')}
          </p>
        </section>

        {/* Aspect Ratio */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Aspect Ratio
            {locked && <span className="ml-2 text-amber-500 normal-case font-normal text-xs">(locked — reference images require 16:9)</span>}
          </h2>
          <div className="flex gap-2">
            {ASPECT_RATIOS.map(ar => (
              <button
                key={ar}
                onClick={() => !locked && setAspectRatio(ar)}
                disabled={locked}
                className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                  aspectRatio === ar
                    ? 'bg-purple-700 border-purple-600 text-white'
                    : locked
                      ? 'bg-gray-800 border-gray-800 text-gray-600 cursor-not-allowed'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
                }`}
              >
                {ar}
              </button>
            ))}
          </div>
        </section>

        {/* Structured Prompt */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Prompt</h2>
          <div className="space-y-3">
            {([
              { key: 'subject',  label: 'Subject',        placeholder: 'product on a marble surface, minimal branding' },
              { key: 'action',   label: 'Action / motion', placeholder: 'slowly rotating, subtle steam rising' },
              { key: 'setting',  label: 'Setting',         placeholder: 'clean studio, warm background gradient' },
              { key: 'lighting', label: 'Lighting',        placeholder: 'soft key light left, gentle rim light' },
              { key: 'camera',   label: 'Camera',          placeholder: 'slow push-in, 85mm, shallow depth of field' },
              { key: 'style',    label: 'Style / mood',    placeholder: 'cinematic, commercial, premium feel' },
            ] as const).map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <input
                  type="text"
                  value={fields[key]}
                  onChange={(e) => setField(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm
                    text-gray-100 placeholder-gray-600 focus:outline-none focus:border-purple-500"
                />
              </div>
            ))}
          </div>

          <div className="mt-4">
            <label className="block text-xs text-gray-500 mb-1">Compiled prompt</label>
            <div className="bg-gray-900 border border-gray-800 rounded px-3 py-2 text-sm text-gray-400 min-h-[3rem]">
              {compiledPrompt || <span className="text-gray-600 italic">Fill in Subject to see the compiled prompt</span>}
            </div>
          </div>
        </section>

        {/* Cost & Generate */}
        <section className="border-t border-gray-800 pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-300">
                Estimated cost:{' '}
                <span className="font-semibold text-white">${estimatedCost.toFixed(2)}</span>
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                {effectiveDuration}s × ${rate.toFixed(2)}/s · {resolution} · {activeModel.label}
                {locked && ' · reference images active'}
              </p>
            </div>
            <span className="text-xs text-gray-600">async · 60–120s</span>
          </div>

          {success ? (
            <div className="rounded bg-green-900/30 border border-green-800 px-4 py-3 text-sm text-green-300">
              Generation started — Veo typically takes 60–120 seconds. Check the{' '}
              <button
                onClick={() => navigate(`/projects/${projectId}`)}
                className="underline hover:text-green-200"
              >
                project page
              </button>{' '}
              for results.
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={!canSubmit}
              className="w-full py-3 rounded bg-purple-700 hover:bg-purple-600 disabled:opacity-40
                disabled:cursor-not-allowed text-sm font-semibold transition-colors"
            >
              {generating ? 'Submitting...' : 'Generate Video'}
            </button>
          )}

          {!fields.subject.trim() && !success && (
            <p className="text-xs text-gray-600 mt-2 text-center">Subject is required</p>
          )}

          {genError && (
            <p className="text-xs text-red-400 mt-2">{genError}</p>
          )}

          <p className="text-xs text-gray-600 mt-3 text-center">
            Generation runs in the background. You can navigate away immediately after submitting.
          </p>
        </section>

      </div>
    </div>
  );
}
