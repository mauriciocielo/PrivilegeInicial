'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { store } from '../../lib/store';
import BrandLogo from '../../components/BrandLogo';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      router.replace(user.role === 'consultor' || user.role === 'administrador' ? '/consultor/dashboard' : '/cliente/dashboard');
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
          <BrandLogo size={72} showText={false} />
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
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '16px',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--text-secondary)'
                }}
              >
                {showPassword ? '👁️' : '🙈'}
              </button>
            </div>
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

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              alert('Um link de recuperação de senha será enviado para o seu e-mail caso ele esteja cadastrado em nossa base.');
            }}
            style={{ color: 'var(--primary-color)', fontSize: '13px', textDecoration: 'none', fontWeight: 500 }}
          >
            Esqueceu sua senha? Recuperar acesso
          </a>
        </div>
      </div>
    </div>
  );
}
