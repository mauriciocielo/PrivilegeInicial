'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { store } from '../../lib/store';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    const user = store.login(email, password);
    if (user) {
      store.setCurrentUser(user);
      router.replace(user.role === 'consultor' ? '/consultor/dashboard' : '/cliente/dashboard');
    } else {
      setError('E-mail ou senha incorretos.');
      setLoading(false);
    }
  };

  const quickLogin = (role: 'consultor' | 'cliente') => {
    if (role === 'consultor') { setEmail('consultor@sistema.com'); setPassword('123456'); }
    else { setEmail('cliente@empresa.com'); setPassword('123456'); }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <svg viewBox="0 0 100 100" width="64" height="64">
            <circle cx="50" cy="50" r="46" fill="#f8fafc" />
            <rect x="36" y="44" width="8" height="24" rx="1" fill="#600000" />
            <rect x="49" y="33" width="8" height="35" rx="1" fill="#600000" />
            <rect x="62" y="22" width="8" height="46" rx="1" fill="#600000" />
            <path d="M 28 72 L 40 55 L 49 60 L 76 26" fill="none" stroke="#600000" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 66 26 L 76 26 L 76 36" fill="none" stroke="#600000" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="login-title" style={{ letterSpacing: '4px', textTransform: 'uppercase', fontSize: '22px', fontWeight: 800 }}>PRIVILEGE</h1>
        <p className="login-sub">Consultoria Financeira • Fluxo de Caixa</p>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 16 }}>
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input
              type="email"
              className="form-control"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Senha</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? '⏳ Entrando...' : '→  Entrar no Sistema'}
          </button>
        </form>

        <div className="login-hint">
          <div style={{ marginBottom: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Acesso rápido (demo):</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => quickLogin('consultor')}>
              👔 Consultor
            </button>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => quickLogin('cliente')}>
              🏢 Cliente
            </button>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>Senha para ambos: <strong>123456</strong></div>
        </div>
      </div>
    </div>
  );
}
