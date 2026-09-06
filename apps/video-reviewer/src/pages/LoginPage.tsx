import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/projects');
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = `w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm
    text-gray-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-100 mb-1">Video-Bright</h1>
          <p className="text-sm text-gray-500">Structured short-form video workflow</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              className={inputClass}
              placeholder="alice@vb.local"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className={inputClass}
              placeholder="password1"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/40 rounded px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
              text-sm font-semibold transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-600 mt-4">
          Demo: alice/bob/carol/dave @vb.local — all use password1
        </p>
      </div>
    </div>
  );
}
