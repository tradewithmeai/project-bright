import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project } from '../types';
import { projectsApi, scrapesApi, brandPacksApi } from '../api';
import { ProjectStatusBadge } from '../components/StatusBadge';
import { CostBadge } from '../components/CostBadge';
import { useAuth } from '../hooks/useAuth';
import { canEdit, canManage, isSuperAdmin } from '../utils/permissions';

interface ScrapeOption { slug: string; company: string; }

type CompanyMode = 'existing' | 'new';

// Derive a media-scrape slug from a URL (mirrors backend slugFromUrl)
function slugFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const withoutTld = hostname.replace(/\.(co\.uk|com\.au|co\.jp|com\.br|co\.nz|co\.in|com\.hk|co\.za|co\.th|co\.id|com|org|net|io|group|ai|co|uk|de|fr|nl|sg|hk|cn|jp|edu|gov|us|ca|au)$/i, '');
    return withoutTld.replace(/\./g, '-').toLowerCase() + '-media-scrape';
  } catch {
    return '';
  }
}

export function ProjectListPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [companyMode, setCompanyMode] = useState<CompanyMode>('existing');
  const [newUrl, setNewUrl] = useState('');
  const [runBrandPack, setRunBrandPack] = useState(true);
  const [runMediaScrape, setRunMediaScrape] = useState(true);
  const [scrapeOptions, setScrapeOptions] = useState<ScrapeOption[]>([]);
  const [extractionStatus, setExtractionStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canCreate = user && canEdit(user.role);
  const canTriggerExtraction = user && canManage(user.role);

  useEffect(() => {
    projectsApi.list()
      .then(setProjects)
      .catch(() => setError('Failed to load projects'))
      .finally(() => setLoading(false));
  }, []);

  // Load company options when the form opens
  useEffect(() => {
    if (!showForm || scrapeOptions.length > 0) return;
    scrapesApi.list()
      .then(list => {
        setScrapeOptions(list.map(s => ({ slug: s.slug, company: s.company })));
        if (list.length > 0) setNewSlug(list[0].slug);
      })
      .catch(() => {});
  }, [showForm, scrapeOptions.length]);

  function openForm() {
    setNewTitle('');
    setNewUrl('');
    setCompanyMode('existing');
    setExtractionStatus(null);
    setError(null);
    setShowForm(true);
  }

  const derivedSlug = companyMode === 'new' ? slugFromUrl(newUrl) : newSlug;

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    if (companyMode === 'new' && !derivedSlug) return;

    setCreating(true);
    setError(null);

    try {
      const p = await projectsApi.create({
        title: newTitle.trim(),
        company_slug: derivedSlug || undefined,
      });

      // Trigger extractions in background (fire-and-forget)
      if (companyMode === 'new' && newUrl) {
        const tasks: Promise<unknown>[] = [];

        if (runMediaScrape && canTriggerExtraction) {
          tasks.push(
            scrapesApi.trigger(newUrl).catch(err => {
              console.warn('[media-scrape] trigger failed:', err);
            })
          );
        }

        if (runBrandPack && canTriggerExtraction) {
          tasks.push(
            brandPacksApi.create(newUrl).catch(err => {
              console.warn('[brand-pack] trigger failed:', err);
            })
          );
        }

        if (tasks.length) {
          setExtractionStatus('Extraction running in background…');
          Promise.all(tasks).catch(() => {});
        }
      }

      navigate(`/projects/${p.id}`);
    } catch {
      setError('Failed to create project');
      setCreating(false);
    }
  }, [newTitle, companyMode, derivedSlug, newUrl, runMediaScrape, runBrandPack, canTriggerExtraction, navigate]);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Nav */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-100">Video-Bright</h1>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400">
            {user?.name} ·{' '}
            <span className={`capitalize ${user?.role === 'superadmin' ? 'text-green-400 font-bold' : ''}`}>
              {user?.role}
            </span>
          </span>
          <button onClick={() => navigate('/brand-assets')} className="text-xs text-gray-400 hover:text-gray-200">Brand Assets</button>
          <button onClick={() => navigate('/media-library')} className="text-xs text-gray-400 hover:text-gray-200">Media Library</button>
          {(user?.role === 'admin' || user?.role === 'superadmin') && (
            <button onClick={() => navigate('/admin')} className="text-xs text-gray-400 hover:text-gray-200">Admin</button>
          )}
          {user && isSuperAdmin(user.role) && (
            <button
              onClick={() => navigate('/dev')}
              className="text-xs font-mono text-green-600 hover:text-green-400 border border-green-900 hover:border-green-700 px-2 py-0.5 rounded transition-colors"
            >
              ⚡ God Mode
            </button>
          )}
          <button onClick={logout} className="text-xs text-gray-400 hover:text-red-400">Sign out</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-100">Projects</h2>
          {canCreate && (
            <button
              onClick={openForm}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors"
            >
              + New project
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="mb-6 bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-4">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-500 uppercase tracking-wide">Project title</label>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="e.g. Ant International — Q2 Product Launch"
                autoFocus
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm
                  text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Company mode toggle */}
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-500 uppercase tracking-wide">Company</label>
              <div className="flex rounded-lg overflow-hidden border border-gray-700 self-start">
                {(['existing', 'new'] as CompanyMode[]).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setCompanyMode(mode)}
                    className={`px-4 py-1.5 text-xs font-medium transition-colors ${
                      companyMode === mode
                        ? 'bg-indigo-700 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {mode === 'existing' ? 'Existing' : 'New company'}
                  </button>
                ))}
              </div>

              {companyMode === 'existing' ? (
                <div className="flex flex-col gap-1.5">
                  <select
                    value={newSlug}
                    onChange={e => setNewSlug(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm
                      text-gray-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">— none —</option>
                    {scrapeOptions.map(s => (
                      <option key={s.slug} value={s.slug}>{s.company}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-600">
                    Links this project to a company's media library so the right assets load automatically.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <input
                    type="url"
                    value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                    placeholder="https://www.example.com"
                    className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm
                      text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                  />
                  {derivedSlug && (
                    <p className="text-[11px] text-gray-500">
                      Slug: <span className="font-mono text-gray-400">{derivedSlug}</span>
                    </p>
                  )}

                  {canTriggerExtraction && (
                    <div className="flex flex-col gap-2 p-3 bg-gray-800/60 rounded-lg border border-gray-700">
                      <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium mb-1">Run extractions</p>
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={runMediaScrape}
                          onChange={e => setRunMediaScrape(e.target.checked)}
                          className="mt-0.5 accent-indigo-500"
                        />
                        <span className="flex flex-col gap-0.5">
                          <span className="text-xs text-gray-200 font-medium">Media library scrape</span>
                          <span className="text-[11px] text-gray-500">Collects images and videos from the website for use in the media library</span>
                        </span>
                      </label>
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={runBrandPack}
                          onChange={e => setRunBrandPack(e.target.checked)}
                          className="mt-0.5 accent-indigo-500"
                        />
                        <span className="flex flex-col gap-0.5">
                          <span className="text-xs text-gray-200 font-medium">Brand pack extraction</span>
                          <span className="text-[11px] text-gray-500">Extracts colours, fonts, and brand identity for the brand assets panel</span>
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            {extractionStatus && (
              <p className="text-[11px] text-indigo-400">{extractionStatus}</p>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating || !newTitle.trim() || (companyMode === 'new' && !derivedSlug)}
                className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40
                  text-sm font-medium transition-colors"
              >
                {creating ? 'Creating…' : 'Create project'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">Loading...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p>No projects yet.</p>
            {canCreate && <p className="mt-1 text-sm">Create your first project above.</p>}
          </div>
        ) : (
          <div data-demo="project-list" className="grid gap-3">
            {projects.map((p, i) => (
              <button
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                data-demo={i === 0 ? 'project-card' : undefined}
                className="w-full text-left bg-gray-900 border border-gray-800 rounded-xl p-4
                  hover:border-indigo-600 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-100 group-hover:text-white truncate">
                      {p.title}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <ProjectStatusBadge status={p.status} />
                      {p.company_slug && (
                        <span className="text-[10px] text-indigo-400 border border-indigo-900/60 bg-indigo-950/40 rounded px-1.5 py-0.5">
                          {p.company_slug.replace(/-media-scrape$/, '').replace(/-/g, ' ')}
                        </span>
                      )}
                      {p.slot_progress && (
                        <span className="text-xs text-gray-500">
                          {p.slot_progress.briefed}/{p.slot_progress.total} slots briefed
                        </span>
                      )}
                      {p.assigned_users && p.assigned_users.length > 0 && (
                        <span className="text-xs text-gray-500">
                          {p.assigned_users.map(u => u.name).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {p.total_estimated_cost !== undefined && (
                      <CostBadge amount={p.total_estimated_cost} label="est" />
                    )}
                    <span className="text-xs text-gray-600">
                      {new Date(p.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
