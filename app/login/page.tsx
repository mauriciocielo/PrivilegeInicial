'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { store } from '../../lib/store';
import Image from 'next/image';

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
    <div className="login-page" style={{ 
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', 
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', padding: 20 
    }}>
      <div className="login-card" style={{ 
        width: '100%', maxWidth: 440, background: '#fff', borderRadius: 20, 
        padding: '48px 40px', boxShadow: '0 20px 40px rgba(0,0,0,0.06)' 
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <Image src="/logo.png" alt="Privilege Contabilidade e Consultoria" width={220} height={60} style={{ objectFit: 'contain' }} priority />
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 16 }}>
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8, display: 'block' }}>E-mail corporativo</label>
            <input
              type="email"
              className="form-control"
              placeholder="nome@empresa.com.br"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 8, border: '1.5px solid #E2E8F0',
                fontSize: 14, outline: 'none', transition: 'border 0.2s', backgroundColor: '#F8FAFC'
              }}
              onFocus={e => e.target.style.borderColor = '#600000'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 28 }}>
            <label className="form-label" style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8, display: 'block' }}>Senha</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{
                  width: '100%', padding: '12px 48px 12px 16px', borderRadius: 8, border: '1.5px solid #E2E8F0',
                  fontSize: 14, outline: 'none', transition: 'border 0.2s', backgroundColor: '#F8FAFC'
                }}
                onFocus={e => e.target.style.borderColor = '#600000'}
                onBlur={e => e.target.style.borderColor = '#E2E8F0'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px',
                  color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                {showPassword ? '👁️' : '🙈'}
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="btn-primary"
            style={{ 
              width: '100%', padding: '14px', borderRadius: 8, display: 'flex', justifyContent: 'center', 
              alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: '#600000', color: '#fff', transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(96,0,0,0.3)'
            }}
            disabled={loading}
            onMouseOver={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseOut={e => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            {loading ? '⏳ Conectando...' : 'Entrar no Sistema →'}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <a
            href="#"
            onClick={async (e) => {
              e.preventDefault();
              const emailToRecover = email || prompt('Digite o seu e-mail cadastrado para recuperar o acesso:');
              if (!emailToRecover) return;

              setLoading(true);
              setError('');
              try {
                const res = await fetch('/api/recover-password', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: emailToRecover })
                });
                
                const result = await res.json();
                if (res.ok && result.success) {
                  // Sincroniza imediatamente o LocalStorage com o banco
                  if (result.backup) {
                    store.importBackup(JSON.stringify(result.backup));
                  }
                  
                  if (result.emailSent) {
                    alert('🔑 Uma nova senha temporária foi gerada e enviada para o seu e-mail!');
                  } else {
                    alert(`🔑 Senha alterada com sucesso!\n\n(Aviso: Servidor de e-mail SMTP não configurado. Nova senha temporária gerada no banco: ${result.tempPassword})`);
                  }
                } else {
                  setError(result.error || 'Erro ao recuperar senha.');
                }
              } catch (err) {
                setError('Erro de conexão ao tentar recuperar senha.');
              } finally {
                setLoading(false);
              }
            }}
            style={{ color: '#600000', fontSize: '13px', textDecoration: 'none', fontWeight: 600, opacity: 0.8 }}
            onMouseOver={e => e.currentTarget.style.opacity = '1'}
            onMouseOut={e => e.currentTarget.style.opacity = '0.8'}
          >
            Esqueceu a senha? Recuperar acesso
          </a>
        </div>
      </div>
    </div>
  );
}
