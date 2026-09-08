'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { store } from '../../lib/store';
import Image from 'next/image';
import { GoogleLogin } from '@react-oauth/google';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  
  // Login Padrão (Email/Senha)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Estado Global do form
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Estados de Onboarding (Google / Vinculação CNPJ)
  const [requiresCnpj, setRequiresCnpj] = useState(false);
  const [cnpjInput, setCnpjInput] = useState('');
  const [googleUserData, setGoogleUserData] = useState<{ email: string, name: string, picture?: string } | null>(null);
  const [googleCredential, setGoogleCredential] = useState<string | null>(null);

  // Verificação em Duas Etapas (2FA)
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [lockedUser, setLockedUser] = useState<any>(null);

  useEffect(() => {
    // Sincroniza o DataStore apenas uma vez
    if (typeof window !== 'undefined') {
      const users = store.getUsers();
      console.log('Store inicializada na tela de Login com', users.length, 'usuários');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // A senha é verificada no servidor (hash) e, se for válida, ele emite um
      // cookie de sessão httpOnly — antes disso, o login comparava a senha em
      // texto puro só no navegador, contra dados já baixados localmente.
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'E-mail ou senha incorretos.');
        setLoading(false);
        return;
      }

      if (result.requiresTwoFactor) {
        setLockedUser(result.user);
        setTwoFactorToken(result.twoFactorToken);
        setLoading(false);
        return;
      }

      store.setCurrentUser(result.user);
      router.replace(result.user.role === 'consultor' || result.user.role === 'administrador' ? '/consultor/dashboard' : '/cliente/dashboard');
    } catch (err: any) {
      setError('Erro de conexão ao tentar entrar.');
      setLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorToken) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ twoFactorToken, code: twoFactorCode }),
      });
      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Código inválido.');
        setLoading(false);
        return;
      }

      store.setCurrentUser(result.user);
      router.replace(result.user.role === 'consultor' || result.user.role === 'administrador' ? '/consultor/dashboard' : '/cliente/dashboard');
    } catch (err) {
      setError('Erro de conexão ao verificar o código.');
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (!credentialResponse.credential) return;

    setError('');
    setLoading(true);

    try {
      // O token é verificado de verdade no servidor (assinatura conferida com o
      // Google) — nunca confiamos em dados decodificados só no navegador.
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });
      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Falha ao processar o login com o Google.');
        setLoading(false);
        return;
      }

      if (result.requiresCnpj) {
        // Primeiro acesso (ou conta sem empresa vinculada) — pede o CNPJ antes de concluir.
        setGoogleCredential(credentialResponse.credential);
        setGoogleUserData({ email: result.email, name: result.name, picture: result.picture });
        setRequiresCnpj(true);
        setLoading(false);
        return;
      }

      if (result.requiresTwoFactor) {
        setLockedUser(result.user);
        setTwoFactorToken(result.twoFactorToken);
        setLoading(false);
        return;
      }

      store.saveUser(result.user);
      store.setCurrentUser(result.user);
      router.replace(result.user.role === 'consultor' || result.user.role === 'administrador' ? '/consultor/dashboard' : '/cliente/dashboard');
    } catch (err) {
      setError('Falha ao processar o Login com o Google.');
      setLoading(false);
    }
  };

  const handleLinkCnpj = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleUserData || !googleCredential) return;

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: googleCredential, cnpj: cnpjInput }),
      });
      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Nenhuma empresa encontrada com este CNPJ no sistema.');
        setLoading(false);
        return;
      }

      if (result.requiresTwoFactor) {
        setRequiresCnpj(false);
        setLockedUser(result.user);
        setTwoFactorToken(result.twoFactorToken);
        setLoading(false);
        return;
      }

      store.saveUser(result.user);
      store.setCurrentUser(result.user);
      router.replace(result.user.role === 'consultor' || result.user.role === 'administrador' ? '/consultor/dashboard' : '/cliente/dashboard');
    } catch (err) {
      setError('Falha ao processar vinculação.');
      setLoading(false);
    }
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
          <div className="alert alert-danger" style={{ marginBottom: 16, color: '#dc2626', background: '#fef2f2', padding: 12, borderRadius: 8, fontSize: 14 }}>
            <span>⚠️</span> {error}
          </div>
        )}

        {/* FLUXO 0: CÓDIGO DE VERIFICAÇÃO EM DUAS ETAPAS */}
        {twoFactorToken ? (
          <form onSubmit={handleTwoFactorSubmit}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
              <h3 style={{ margin: 0, fontSize: 18, color: '#334155' }}>Verificação em duas etapas</h3>
              <p style={{ margin: '8px 0 0 0', fontSize: 14, color: '#64748b' }}>
                Digite o código de 6 dígitos do seu aplicativo autenticador, ou um dos seus códigos de backup.
              </p>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label" style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8, display: 'block' }}>Código</label>
              <input
                type="text"
                inputMode="numeric"
                className="form-control"
                placeholder="000000"
                value={twoFactorCode}
                onChange={e => setTwoFactorCode(e.target.value)}
                required
                autoFocus
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 8, border: '1.5px solid #E2E8F0',
                  fontSize: 20, letterSpacing: 4, textAlign: 'center', outline: 'none', transition: 'border 0.2s', backgroundColor: '#F8FAFC'
                }}
                onFocus={e => e.target.style.borderColor = '#600000'}
                onBlur={e => e.target.style.borderColor = '#E2E8F0'}
              />
            </div>

            <button
              type="submit"
              style={{
                width: '100%', padding: '14px', borderRadius: 8, display: 'flex', justifyContent: 'center',
                alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: '#600000', color: '#fff', transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(96,0,0,0.3)'
              }}
              disabled={loading}
            >
              {loading ? '⏳ Verificando...' : 'Confirmar →'}
            </button>

            {lockedUser && (
              <button
                type="button"
                onClick={() => {
                  store.setCurrentUser(lockedUser);
                  router.replace(lockedUser.role === 'consultor' || lockedUser.role === 'administrador' ? '/consultor/dashboard' : '/cliente/dashboard');
                }}
                style={{
                  width: '100%', padding: '12px', borderRadius: 8, display: 'flex', justifyContent: 'center',
                  alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, border: '1.5px solid #E2E8F0', cursor: 'pointer',
                  background: 'transparent', color: '#64748b', transition: 'all 0.2s', marginTop: 12
                }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Pular Verificação (Opcional)
              </button>
            )}

            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => { setTwoFactorToken(null); setTwoFactorCode(''); setError(''); setLockedUser(null); }}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14, textDecoration: 'underline' }}
              >
                Voltar para o Login
              </button>
            </div>
          </form>
        ) : requiresCnpj ? (
          <form onSubmit={handleLinkCnpj}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              {googleUserData?.picture && <img src={googleUserData.picture} alt="Avatar" style={{width: 60, height: 60, borderRadius: 30, marginBottom: 12}} />}
              <h3 style={{ margin: 0, fontSize: 18, color: '#334155' }}>Olá, {googleUserData?.name}!</h3>
              <p style={{ margin: '8px 0 0 0', fontSize: 14, color: '#64748b' }}>
                Notamos que é seu primeiro acesso. Por favor, vincule a conta da sua empresa informando o CNPJ abaixo:
              </p>
            </div>
            
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label" style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8, display: 'block' }}>CNPJ da sua Empresa</label>
              <input
                type="text"
                className="form-control"
                placeholder="00.000.000/0000-00"
                value={cnpjInput}
                onChange={e => setCnpjInput(e.target.value)}
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

            <button
              type="submit"
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
              {loading ? '⏳ Verificando...' : 'Vincular Conta →'}
            </button>
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <button 
                type="button" 
                onClick={() => { setRequiresCnpj(false); setGoogleUserData(null); }}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14, textDecoration: 'underline' }}
              >
                Voltar para o Login
              </button>
            </div>
          </form>
        ) : (
          /* FLUXO 2: LOGIN PADRÃO */
          <>
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

            <div style={{ margin: '24px 0', display: 'flex', alignItems: 'center', color: '#94a3b8' }}>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }}></div>
              <div style={{ padding: '0 12px', fontSize: 12, fontWeight: 500 }}>Ou faça login com</div>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }}></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
               <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Ocorreu um erro ao conectar com o Google.')}
                  useOneTap
                  theme="outline"
                  size="large"
                  text="signin_with"
                  shape="rectangular"
               />
            </div>

            <div style={{ textAlign: 'center' }}>
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
                        toast.success('🔑 Uma nova senha temporária foi gerada e enviada para o seu e-mail!');
                      } else {
                        toast.success(`🔑 Senha alterada com sucesso!\n\n(Aviso: Servidor de e-mail SMTP não configurado. Nova senha temporária gerada no banco: ${result.tempPassword})`);
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
          </>
        )}

      </div>
    </div>
  );
}
