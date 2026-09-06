import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { slotsApi, runsApi } from '../api';
import type { Slot } from '../types';

const ASPECT_RATIOS = ['21:9', '16:9', '4:3', '3:2', '1:1', '2:3', '3:4', '9:16', '4:5', '5:4'];

interface RefImage {
  data: string;       // base64
  mimeType: string;
  preview: string;    // object URL for display
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
    fields.camera ? `A photorealistic ${fields.camera} shot` : 'A photorealistic shot',
    subjectPart,
  ].filter(Boolean).join(' ');

  if (opener) parts.push(opener);
  if (fields.setting) parts.push(`Set in ${fields.setting}.`);
  if (fields.lighting) parts.push(`The scene is lit by ${fields.lighting}.`);
  if (fields.style) parts.push(fields.style);

  return parts.join(' ');
}

export function GeneratePage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const slotId = Number(searchParams.get('slot'));

  const [slot, setSlot] = useState<Slot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [refImages, setRefImages] = useState<(RefImage | null)[]>([null, null, null]);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [fields, setFields] = useState<PromptFields>({
    subject: '', action: '', setting: '', lighting: '', camera: '', style: '',
  });

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fileInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  // Load slot
  useEffect(() => {
    if (!projectId || !slotId) return;
    slotsApi.list(Number(projectId))
      .then(slots => {
        const s = slots.find(sl => sl.id === slotId);
        if (!s) { setLoadError('Slot not found'); return; }
        setSlot(s);
        setAspectRatio(s.slot_type === 'video' ? '16:9' : '1:1');
      })
      .catch(() => setLoadError('Failed to load slot'));
  }, [projectId, slotId]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      refImages.forEach(img => { if (img) URL.revokeObjectURL(img.preview); });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFileSelect(index: number, file: File) {
    if (!file.type.match(/^image\/(jpeg|png)$/)) return; // silently ignore wrong types
    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = e.target?.result as string;
      // raw is "data:image/jpeg;base64,XXXX" — extract just the base64 part
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

  const compiledPrompt = compilePrompt(fields);
  const canSubmit = fields.subject.trim().length > 0 && !generating && !success;

  async function handleGenerate() {
    if (!canSubmit || !projectId) return;
    setGenerating(true);
    setGenError(null);
    try {
      const images = refImages.filter(Boolean).map(img => img!.data);
      await runsApi.generate(Number(projectId), slotId, {
        prompt: compiledPrompt,
        aspectRatio,
        referenceImages: images.length > 0 ? images : undefined,
        provider: 'gemini_image',
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
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
            slot.slot_type === 'video' ? 'bg-purple-900 text-purple-300' : 'bg-sky-900 text-sky-300'
          }`}>
            {slot.slot_type}
          </span>
          <span className="text-sm font-semibold text-gray-200">{slot.role_label}</span>
        </div>
        <span className="ml-auto text-xs text-gray-500">Gemini 2.5 Flash Image</span>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">

        {/* Reference Images */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Reference Images <span className="text-gray-600 normal-case font-normal">(up to 3 — JPEG or PNG)</span>
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
          <p className="text-xs text-gray-600 mt-2">
            Reference images are blended into the generation. No cost premium over text-only.
          </p>
        </section>

        {/* Aspect Ratio */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Aspect Ratio</h2>
          <div className="flex flex-wrap gap-2">
            {ASPECT_RATIOS.map(ar => (
              <button
                key={ar}
                onClick={() => setAspectRatio(ar)}
                className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                  aspectRatio === ar
                    ? 'bg-indigo-700 border-indigo-600 text-white'
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
              { key: 'subject',  label: 'Subject',        placeholder: 'red ceramic mug, minimal branding' },
              { key: 'action',   label: 'Action / state',  placeholder: 'standing still, centred on surface' },
              { key: 'setting',  label: 'Setting',         placeholder: 'white marble surface, clean studio backdrop' },
              { key: 'lighting', label: 'Lighting',        placeholder: 'soft studio softbox, three-point lighting' },
              { key: 'camera',   label: 'Camera',          placeholder: '85mm lens, eye-level, slight three-quarter angle' },
              { key: 'style',    label: 'Style / mood',    placeholder: 'photorealistic, commercial product photography, clean' },
            ] as const).map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <input
                  type="text"
                  value={fields[key]}
                  onChange={(e) => setField(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm
                    text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            ))}
          </div>

          {/* Compiled preview */}
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
                Estimated cost: <span className="font-semibold text-white">$0.039</span>
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                + input token cost for reference images (&lt;$0.001 each)
              </p>
            </div>
            <span className="text-xs text-gray-600">1K resolution · synchronous</span>
          </div>

          {success ? (
            <div className="rounded bg-green-900/30 border border-green-800 px-4 py-3 text-sm text-green-300">
              Generation started. Check the{' '}
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
              className="w-full py-3 rounded bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40
                disabled:cursor-not-allowed text-sm font-semibold transition-colors"
            >
              {generating ? 'Generating...' : 'Generate Image'}
            </button>
          )}

          {!fields.subject.trim() && !success && (
            <p className="text-xs text-gray-600 mt-2 text-center">Subject is required</p>
          )}

          {genError && (
            <p className="text-xs text-red-400 mt-2">{genError}</p>
          )}
        </section>

      </div>
    </div>
  );
}
