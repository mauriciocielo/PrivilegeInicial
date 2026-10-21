'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { store } from '../../lib/store';
import Image from 'next/image';
import BrandLogo from '../../components/BrandLogo';
import { GoogleLogin } from '@react-oauth/google';
import { toast } from 'sonner';
import { Inter, Instrument_Serif } from 'next/font/google';

const sans = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600'] });
const serif = Instrument_Serif({ subsets: ['latin'], weight: ['400'], style: ['normal', 'italic'] });

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
    <div className={`login-page ${sans.className}`} style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: '#fdfdfd', color: '#171717'
    }}>
      <style>{`
        h3, h2, h1 { font-family: ${serif.style.fontFamily}; }
        .login-card {
          background: #fff;
          border: 1px solid #e5e5e5;
          border-radius: 28px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
          transition: all 0.4s ease;
        }
        .login-card:hover {
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.08);
          border-color: #600000;
        }
        .form-control-custom {
          width: 100%;
          padding: 14px 16px;
          border-radius: 12px;
          border: 1.5px solid #e5e5e5;
          font-size: 15px;
          outline: none;
          transition: all 0.2s ease;
          background: #fff;
          color: #171717;
        }
        .form-control-custom:focus {
          border-color: #600000;
          box-shadow: 0 0 0 3px rgba(96,0,0,0.08);
        }
        .btn-primary-custom {
          background: #600000;
          color: #fff;
          padding: 16px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 15px;
          border: none;
          cursor: pointer;
          transition: background 0.3s, transform 0.2s;
          box-shadow: 0 4px 12px rgba(96,0,0,0.2);
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
        }
        .btn-primary-custom:hover {
          background: #3b0000;
          transform: translateY(-1px);
        }
        .nav-link {
          text-decoration: none;
          color: #171717;
          font-weight: 500;
          font-size: 15px;
          transition: color 0.2s;
        }
        .nav-link:hover {
          color: #600000;
        }
      `}</style>

      {/* Top Header matching landing page */}
      <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '0 40px' }}>
        <nav style={{ padding: '30px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e5e5e5' }}>
          <Link href="/novo-layout" style={{ textDecoration: 'none' }}>
            <BrandLogo size={55} subtitle="PORTAL DE INTELIGÊNCIA" />
          </Link>
          <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
            <Link href="/novo-layout" className="nav-link">Início</Link>
            <Link href="/novo-layout#servicos" className="nav-link">Serviços</Link>
            <Link href="/novo-layout#quem-somos" className="nav-link">Quem Somos</Link>
            <Link href="/novo-layout#contato" className="nav-link">Contato</Link>
            <Link href="/novo-layout" style={{ background: '#600000', color: '#fff', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', fontWeight: 500, fontSize: 14, transition: 'background 0.2s' }}>
              ← Voltar ao Site
            </Link>
          </div>
        </nav>
      </div>

      {/* Main Login Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
        <div className="login-card" style={{ width: '100%', maxWidth: '480px', padding: '48px' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 className="serif" style={{ fontSize: 40, marginBottom: 8, color: '#000', letterSpacing: '-0.02em' }}>Área do Cliente</h1>
            <p style={{ fontSize: 15, color: '#525252' }}>Acesse sua conta para gerenciar relatórios, documentos e BPO.</p>
          </div>

          {error && (
            <div style={{ marginBottom: 20, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 16px', borderRadius: '12px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚠️</span> {error}
            </div>
          )}

          {/* FLUXO 0: CÓDIGO DE VERIFICAÇÃO EM DUAS ETAPAS */}
          {twoFactorToken ? (
            <form onSubmit={handleTwoFactorSubmit}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
                <h3 className="serif" style={{ fontSize: 24, marginBottom: 8, color: '#000' }}>Verificação em duas etapas</h3>
                <p style={{ fontSize: 14, color: '#525252' }}>
                  Digite o código de 6 dígitos do seu aplicativo autenticador ou código de backup.
                </p>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#171717', marginBottom: 8, display: 'block' }}>Código de Acesso</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="form-control-custom"
                  placeholder="000000"
                  value={twoFactorCode}
                  onChange={e => setTwoFactorCode(e.target.value)}
                  required
                  autoFocus
                  style={{ textAlign: 'center', letterSpacing: '6px', fontSize: '22px' }}
                />
              </div>

              <button type="submit" className="btn-primary-custom" disabled={loading}>
                {loading ? '⏳ Verificando...' : 'Confirmar Código →'}
              </button>

              {lockedUser && (
                <button
                  type="button"
                  onClick={() => {
                    store.setCurrentUser(lockedUser);
                    router.replace(lockedUser.role === 'consultor' || lockedUser.role === 'administrador' ? '/consultor/dashboard' : '/cliente/dashboard');
                  }}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '12px', display: 'flex', justifyContent: 'center',
                    alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, border: '1.5px solid #e5e5e5', cursor: 'pointer',
                    background: 'transparent', color: '#525252', transition: 'all 0.2s', marginTop: 12
                  }}
                >
                  Pular Verificação (Opcional)
                </button>
              )}

              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => { setTwoFactorToken(null); setTwoFactorCode(''); setError(''); setLockedUser(null); }}
                  style={{ background: 'none', border: 'none', color: '#525252', cursor: 'pointer', fontSize: 14, textDecoration: 'underline' }}
                >
                  Voltar para o Login
                </button>
              </div>
            </form>
          ) : requiresCnpj ? (
            <form onSubmit={handleLinkCnpj}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                {googleUserData?.picture && <img src={googleUserData.picture} alt="Avatar" style={{width: 60, height: 60, borderRadius: 30, marginBottom: 12}} />}
                <h3 className="serif" style={{ fontSize: 24, marginBottom: 8, color: '#000' }}>Olá, {googleUserData?.name}!</h3>
                <p style={{ fontSize: 14, color: '#525252' }}>
                  Primeiro acesso detectado. Por favor, informe o CNPJ da sua empresa para vincular:
                </p>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#171717', marginBottom: 8, display: 'block' }}>CNPJ da Empresa</label>
                <input
                  type="text"
                  className="form-control-custom"
                  placeholder="00.000.000/0000-00"
                  value={cnpjInput}
                  onChange={e => setCnpjInput(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <button type="submit" className="btn-primary-custom" disabled={loading}>
                {loading ? '⏳ Verificando...' : 'Vincular Conta →'}
              </button>

              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => { setRequiresCnpj(false); setGoogleUserData(null); }}
                  style={{ background: 'none', border: 'none', color: '#525252', cursor: 'pointer', fontSize: 14, textDecoration: 'underline' }}
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
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#171717', marginBottom: 8, display: 'block' }}>E-mail corporativo</label>
                  <input
                    type="email"
                    className="form-control-custom"
                    placeholder="nome@empresa.com.br"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 28 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#171717', marginBottom: 8, display: 'block' }}>Senha</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-control-custom"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      style={{ paddingRight: '48px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px',
                        color: '#737373', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      {showPassword ? '👁️' : '🙈'}
                    </button>
                  </div>
                </div>
                <button type="submit" className="btn-primary-custom" disabled={loading}>
                  {loading ? '⏳ Conectando...' : 'Entrar no Sistema →'}
                </button>
              </form>

              <div style={{ margin: '28px 0', display: 'flex', alignItems: 'center', color: '#a3a3a3' }}>
                <div style={{ flex: 1, height: 1, background: '#e5e5e5' }}></div>
                <div style={{ padding: '0 12px', fontSize: 12, fontWeight: 500, color: '#737373' }}>Ou continue com</div>
                <div style={{ flex: 1, height: 1, background: '#e5e5e5' }}></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                 <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError('Ocorreu um erro ao conectar com o Google.')}
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
                  style={{ color: '#600000', fontSize: '13px', textDecoration: 'none', fontWeight: 600 }}
                  onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
                  onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
                >
                  Esqueceu sua senha? Recuperar acesso
                </a>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
