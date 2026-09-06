import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { devApi } from '../api';
import { useAuth } from '../hooks/useAuth';

type Tab = 'system' | 'tables' | 'sql' | 'force' | 'users';

const TABLES = ['users', 'projects', 'slots', 'assets', 'generation_runs', 'review_events', 'project_users', 'render_jobs'];
const ALL_ROLES = ['creator', 'reviewer', 'manager', 'admin', 'superadmin'];
const PROJECT_STATUSES = ['draft', 'ready_for_review', 'changes_requested', 'approved_for_generation', 'generated', 'approved_for_preview'];
const SLOT_STATUSES = ['empty', 'briefed', 'ready_for_review', 'approved_for_generation', 'generated', 'approved', 'rejected'];

function JsonView({ data }: { data: unknown }) {
  return (
    <pre className="text-xs font-mono text-green-300 bg-gray-950 rounded p-3 overflow-auto max-h-96 whitespace-pre-wrap break-all">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export function DevPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('system');
  const [result, setResult] = useState<object | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // System tab
  const [systemData, setSystemData] = useState<object | null>(null);

  // Tables tab
  const [selectedTable, setSelectedTable] = useState('users');
  const [tableOffset, setTableOffset] = useState(0);
  const [tableData, setTableData] = useState<{ total: number; rows: unknown[] } | null>(null);

  // SQL tab
  const [sqlInput, setSqlInput] = useState('SELECT * FROM users');
  const [sqlResult, setSqlResult] = useState<object | null>(null);

  // Force tab
  const [forceType, setForceType] = useState<'project' | 'slot'>('project');
  const [forceId, setForceId] = useState('');
  const [forceStatusValue, setForceStatusValue] = useState('draft');

  // Users tab
  const [devUsers, setDevUsers] = useState<unknown[]>([]);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editRole, setEditRole] = useState('');

  useEffect(() => {
    if (user?.role !== 'superadmin') {
      navigate('/projects');
      return;
    }
    devApi.system().then(setSystemData).catch(() => {});
  }, [user, navigate]);

  async function run<T>(fn: () => Promise<T>, setter: (v: T) => void) {
    setLoading(true);
    setError(null);
    try {
      setter(await fn());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function loadTable() {
    await run(
      () => devApi.rawTable(selectedTable, tableOffset),
      (d) => setTableData({ total: d.total, rows: d.rows }),
    );
  }

  async function runSql() {
    await run(() => devApi.runSql(sqlInput), setSqlResult);
  }

  async function handleForceStatus() {
    if (!forceId) return;
    await run(
      () => devApi.forceStatus(forceType, Number(forceId), forceStatusValue),
      setResult,
    );
  }

  async function loadUsers() {
    const users = await devApi.listUsers();
    setDevUsers(users);
  }

  async function handleRoleChange(userId: number) {
    setLoading(true);
    setError(null);
    try {
      await devApi.setRole(userId, editRole);
      setEditingUserId(null);
      await loadUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = `w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm font-mono
    text-gray-200 focus:outline-none focus:border-green-500`;
  const btnCls = `px-4 py-2 rounded bg-green-800 hover:bg-green-700 text-sm font-mono font-medium
    disabled:opacity-40 transition-colors`;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-black border-b border-green-900 px-6 py-3 flex items-center gap-4">
        <button onClick={() => navigate('/projects')} className="text-xs font-mono text-green-700 hover:text-green-400">
          ← back
        </button>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="font-mono text-sm text-green-400 font-bold tracking-widest">GOD MODE</span>
        </div>
        <span className="text-xs font-mono text-gray-600 ml-2">
          {user?.name} · superadmin
        </span>
        <div className="ml-auto text-[10px] font-mono text-gray-700">
          Video-Bright Developer Console
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar nav */}
        <nav className="w-44 bg-black border-r border-gray-900 flex flex-col py-4 gap-1 px-2 flex-shrink-0">
          {([
            ['system', 'System'],
            ['tables', 'Raw Tables'],
            ['sql', 'SQL Console'],
            ['force', 'Force Status'],
            ['users', 'Users / Roles'],
          ] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-left px-3 py-2 rounded text-xs font-mono transition-colors ${
                tab === t
                  ? 'bg-green-900/40 text-green-400 border border-green-800'
                  : 'text-gray-600 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* ── System ───────────────────────────────────────────────── */}
          {tab === 'system' && (
            <div className="space-y-4">
              <h2 className="font-mono text-sm text-green-400 font-bold uppercase tracking-widest">System Diagnostics</h2>
              {systemData ? <JsonView data={systemData} /> : <p className="text-xs font-mono text-gray-600">Loading...</p>}
              <button onClick={() => devApi.system().then(setSystemData)} className={btnCls}>Refresh</button>
            </div>
          )}

          {/* ── Raw Tables ───────────────────────────────────────────── */}
          {tab === 'tables' && (
            <div className="space-y-4">
              <h2 className="font-mono text-sm text-green-400 font-bold uppercase tracking-widest">Raw Table Viewer</h2>
              <div className="flex gap-3 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono text-gray-500">Table</label>
                  <select value={selectedTable} onChange={e => setSelectedTable(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm font-mono text-gray-200 focus:outline-none focus:border-green-500">
                    {TABLES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono text-gray-500">Offset</label>
                  <input type="number" value={tableOffset} min={0} step={100}
                    onChange={e => setTableOffset(Number(e.target.value))}
                    className="w-24 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm font-mono text-gray-200 focus:outline-none focus:border-green-500" />
                </div>
                <button onClick={loadTable} disabled={loading} className={btnCls}>Load</button>
              </div>
              {tableData && (
                <div>
                  <p className="text-[10px] font-mono text-gray-500 mb-2">
                    {tableData.total} rows total · showing {tableData.rows.length}
                  </p>
                  <JsonView data={tableData.rows} />
                </div>
              )}
            </div>
          )}

          {/* ── SQL Console ──────────────────────────────────────────── */}
          {tab === 'sql' && (
            <div className="space-y-4">
              <h2 className="font-mono text-sm text-green-400 font-bold uppercase tracking-widest">SQL Console</h2>
              <p className="text-[10px] font-mono text-gray-600">Read-only. SELECT, PRAGMA, EXPLAIN only.</p>
              <textarea
                value={sqlInput}
                onChange={e => setSqlInput(e.target.value)}
                rows={5}
                className={`${inputCls} resize-none`}
                onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') runSql(); }}
                placeholder="SELECT * FROM users WHERE role = 'superadmin'"
              />
              <div className="flex items-center gap-3">
                <button onClick={runSql} disabled={loading} className={btnCls}>
                  Run (Ctrl+Enter)
                </button>
                {loading && <span className="text-xs font-mono text-green-500 animate-pulse">executing…</span>}
              </div>
              {sqlResult && <JsonView data={sqlResult} />}
            </div>
          )}

          {/* ── Force Status ─────────────────────────────────────────── */}
          {tab === 'force' && (
            <div className="space-y-4">
              <h2 className="font-mono text-sm text-green-400 font-bold uppercase tracking-widest">Force Status Override</h2>
              <p className="text-[10px] font-mono text-gray-600">Bypass workflow validation. Force any entity to any status.</p>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono text-gray-500">Type</label>
                  <select value={forceType} onChange={e => { setForceType(e.target.value as any); setForceStatusValue(e.target.value === 'project' ? 'draft' : 'empty'); }}
                    className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm font-mono text-gray-200 focus:outline-none focus:border-green-500">
                    <option value="project">Project</option>
                    <option value="slot">Slot</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono text-gray-500">ID</label>
                  <input type="number" value={forceId} onChange={e => setForceId(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm font-mono text-gray-200 focus:outline-none focus:border-green-500"
                    placeholder="e.g. 1" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono text-gray-500">Status</label>
                  <select value={forceStatusValue} onChange={e => setForceStatusValue(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm font-mono text-gray-200 focus:outline-none focus:border-green-500">
                    {(forceType === 'project' ? PROJECT_STATUSES : SLOT_STATUSES).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button onClick={handleForceStatus} disabled={loading || !forceId} className={btnCls}>
                Force Status
              </button>

              {/* Reset project */}
              <div className="border-t border-gray-800 pt-4 mt-4">
                <h3 className="font-mono text-xs text-orange-400 mb-2">Reset Project</h3>
                <p className="text-[10px] font-mono text-gray-600 mb-3">
                  Wipe all slots, assets, runs and events for a project. Returns it to clean draft.
                </p>
                <div className="flex items-end gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono text-gray-500">Project ID</label>
                    <input type="number" value={forceId} onChange={e => setForceId(e.target.value)}
                      className="w-24 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm font-mono text-gray-200 focus:outline-none focus:border-orange-500"
                      placeholder="1" />
                  </div>
                  <button
                    onClick={() => run(() => devApi.resetProject(Number(forceId)), setResult)}
                    disabled={loading || !forceId}
                    className="px-4 py-2 rounded bg-orange-900 hover:bg-orange-800 text-sm font-mono font-medium disabled:opacity-40 transition-colors"
                  >
                    Reset Project
                  </button>
                </div>
              </div>

              {result && <JsonView data={result} />}
            </div>
          )}

          {/* ── Users ────────────────────────────────────────────────── */}
          {tab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-sm text-green-400 font-bold uppercase tracking-widest">Users & Roles</h2>
                <button onClick={loadUsers} disabled={loading} className={btnCls}>Load</button>
              </div>
              <p className="text-[10px] font-mono text-gray-600">Can assign any role including superadmin.</p>

              {devUsers.length > 0 && (
                <div className="space-y-2">
                  {(devUsers as any[]).map(u => (
                    <div key={u.id}
                      className="bg-gray-900 border border-gray-800 rounded px-4 py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-mono text-sm text-gray-200">{u.name}</span>
                        <span className="font-mono text-xs text-gray-500 ml-2">{u.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {editingUserId === u.id ? (
                          <>
                            <select value={editRole} onChange={e => setEditRole(e.target.value)}
                              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs font-mono text-gray-200 focus:outline-none focus:border-green-500">
                              {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <button onClick={() => handleRoleChange(u.id)}
                              className="px-2 py-1 rounded bg-green-800 hover:bg-green-700 text-xs font-mono">Save</button>
                            <button onClick={() => setEditingUserId(null)}
                              className="px-2 py-1 rounded bg-gray-700 text-xs font-mono text-gray-400">Cancel</button>
                          </>
                        ) : (
                          <>
                            <span className={`text-xs font-mono px-2 py-1 rounded border ${
                              u.role === 'superadmin'
                                ? 'bg-green-950 border-green-800 text-green-400'
                                : 'bg-gray-800 border-gray-700 text-gray-400'
                            }`}>
                              {u.role}
                            </span>
                            <button onClick={() => { setEditingUserId(u.id); setEditRole(u.role); }}
                              className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-xs font-mono text-gray-500 hover:text-gray-200">
                              Edit
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="mt-4 p-3 rounded bg-red-950/40 border border-red-800">
              <p className="text-xs font-mono text-red-400">{error}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
