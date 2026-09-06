import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../types';
import { adminApi } from '../api';
import { useAuth } from '../hooks/useAuth';

const ROLES = ['creator', 'reviewer', 'manager', 'admin', 'superadmin'] as const;

export function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'creator' as const });
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRole, setEditRole] = useState('');

  useEffect(() => {
    if (user?.role !== 'admin' && user?.role !== 'superadmin') { navigate('/projects'); return; }
    adminApi.listUsers()
      .then(setUsers)
      .catch(() => setError('Failed to load users'))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const u = await adminApi.createUser(form);
      setUsers(prev => [...prev, u]);
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', role: 'creator' });
    } catch {
      setError('Failed to create user — email may be taken');
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleChange(userId: number) {
    try {
      const updated = await adminApi.updateUser(userId, { role: editRole });
      setUsers(prev => prev.map(u => u.id === userId ? updated : u));
      setEditingId(null);
    } catch {
      setError('Failed to update role');
    }
  }

  const inputClass = `bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100
    focus:outline-none focus:border-indigo-500`;

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/projects')} className="text-xs text-gray-400 hover:text-gray-200">
          ← Projects
        </button>
        <span className="text-gray-700">/</span>
        <span className="text-sm font-medium text-gray-200">Admin</span>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-100">Users</h2>
          <button
            onClick={() => setShowCreate(v => !v)}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium"
          >
            + New user
          </button>
        </div>

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        {showCreate && (
          <form onSubmit={handleCreate} className="mb-6 bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-200">Create user</h3>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Full name" required className={inputClass} />
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="Email" required className={inputClass} />
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Password (min 8)" required minLength={8} className={inputClass} />
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as any }))}
                className={inputClass}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={creating}
                className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-sm font-medium">
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm text-gray-400">
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : (
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-200">{u.name}</span>
                  <span className="text-xs text-gray-500 ml-2">{u.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  {editingId === u.id ? (
                    <>
                      <select
                        value={editRole}
                        onChange={e => setEditRole(e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100"
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button onClick={() => handleRoleChange(u.id)}
                        className="px-2 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-xs">Save</button>
                      <button onClick={() => setEditingId(null)}
                        className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-400">Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs capitalize text-gray-400 px-2 py-1 bg-gray-800 rounded">
                        {u.role}
                      </span>
                      {u.id !== user?.id && (
                        <button
                          onClick={() => { setEditingId(u.id); setEditRole(u.role); }}
                          className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-xs text-gray-400"
                        >
                          Edit role
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
