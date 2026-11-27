'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, Lock, ShieldCheck, Upload, AlertCircle, KeyRound } from 'lucide-react';

interface ConviteInfo {
  status: 'pendente' | 'concluido' | 'expirado';
  expiresAt: string;
  certTitular: string | null;
  certValidoAte: string | null;
  empresa: {
    razaoSocial: string;
    nomeFantasia: string;
    cnpj: string;
  };
  branding: {
    nome: string;
    corPrimaria: string;
    corSecundaria: string;
    logoData: string | null;
    telefone: string;
  };
}

export default function EnviarCertificadoPublicoPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token || '');

  const [carregando, setCarregando] = useState(true);
  const [erroLoad, setErroLoad] = useState('');
  const [info, setInfo] = useState<ConviteInfo | null>(null);

  const [arquivoNome, setArquivoNome] = useState('');
  const [pfxBase64, setPfxBase64] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');
  const [sucesso, setSucesso] = useState<{ titular: string; validoAte: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    let ativo = true;
    (async () => {
      try {
        const res = await fetch(`/api/public/enviar-certificado/${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (!ativo) return;
        if (!res.ok) {
          setErroLoad(data.error || 'Link inválido ou expirado.');
        } else {
          setInfo(data);
        }
      } catch {
        if (ativo) setErroLoad('Erro de conexão ao validar o link.');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [token]);

  const handleSelecionarArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErroEnvio('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.(pfx|p12)$/i.test(file.name)) {
      setErroEnvio('Selecione um arquivo de Certificado Digital A1 válido (.pfx ou .p12).');
      return;
    }
    if (file.size > 64 * 1024) {
      setErroEnvio('Arquivo acima do limite de 64 KB.');
      return;
    }
    setArquivoNome(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setPfxBase64(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroEnvio('');
    if (!pfxBase64 || !senha.trim()) {
      setErroEnvio('Selecione o arquivo .pfx/.p12 e digite a senha do certificado.');
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch(`/api/public/enviar-certificado/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pfxBase64,
          senha,
          nomeArquivo: arquivoNome || 'certificado-a1.pfx',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErroEnvio(data.error || 'Não foi possível validar o certificado. Verifique a senha.');
        return;
      }
      setSucesso({
        titular: data.titular || '',
        validoAte: data.validoAte || '',
      });
    } catch {
      setErroEnvio('Erro de conexão ao enviar o certificado. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const corPrimaria = info?.branding?.corPrimaria || '#1d4ed8';
  const corSecundaria = info?.branding?.corSecundaria || '#1e3a8a';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 500,
          background: '#ffffff',
          borderRadius: 20,
          overflow: 'hidden',
          border: '1px solid #e5e7eb',
          boxShadow: '0 20px 50px rgba(15, 23, 42, 0.08)',
        }}
      >
        {/* Cabeçalho White-Label */}
        <div
          style={{
            background: `linear-gradient(135deg, ${corPrimaria} 0%, ${corSecundaria} 100%)`,
            padding: '26px 28px',
            color: '#ffffff',
          }}
        >
          {info?.branding?.logoData ? (
            <div style={{ display: 'inline-block', background: '#fff', padding: '8px 14px', borderRadius: 10, marginBottom: 14 }}>
              <img src={info.branding.logoData} alt={info.branding.nome} style={{ height: 34, maxWidth: 160, objectFit: 'contain', display: 'block' }} />
            </div>
          ) : (
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.9, marginBottom: 6 }}>
              {info?.branding?.nome || 'Portal Fiscal Seguro'}
            </div>
          )}
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, lineHeight: 1.25 }}>
            Envio Seguro de Certificado Digital A1
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, opacity: 0.9 }}>
            Criptografia AES-256-GCM direta no cofre fiscal do seu escritório contábil
          </p>
        </div>

        {/* Conteúdo */}
        <div style={{ padding: '26px 28px' }}>
          {carregando ? (
            <div style={{ textAlign: 'center', padding: '28px 0', color: '#6b7280', fontSize: 14 }}>
              Validando link seguro...
            </div>
          ) : erroLoad || !info ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <AlertCircle size={42} color="#dc2626" style={{ margin: '0 auto 12px' }} />
              <h2 style={{ margin: '0 0 6px', fontSize: 18, color: '#111827' }}>Link indisponível</h2>
              <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>{erroLoad}</p>
            </div>
          ) : sucesso || info.status === 'concluido' ? (
            <div style={{ textAlign: 'center', padding: '14px 0' }}>
              <CheckCircle2 size={50} color="#16a34a" style={{ margin: '0 auto 14px' }} />
              <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#111827' }}>
                Certificado A1 ativado com sucesso!
              </h2>
              <p style={{ margin: '0 0 18px', fontSize: 14, color: '#4b5563', lineHeight: 1.55 }}>
                O certificado da empresa <strong>{info.empresa.nomeFantasia || info.empresa.razaoSocial}</strong> foi validado, criptografado no cofre e já está ativo. Seu escritório contábil (<strong>{info.branding.nome}</strong>) foi notificado automaticamente.
              </p>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 14, textAlign: 'left', fontSize: 13, color: '#166534' }}>
                <div><strong>Titular:</strong> {sucesso?.titular || info.certTitular || 'Validado'}</div>
                {(sucesso?.validoAte || info.certValidoAte) && (
                  <div style={{ marginTop: 4 }}>
                    <strong>Validade:</strong>{' '}
                    {new Date(sucesso?.validoAte || info.certValidoAte || '').toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>
            </div>
          ) : info.status === 'expirado' ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <AlertCircle size={42} color="#d97706" style={{ margin: '0 auto 12px' }} />
              <h2 style={{ margin: '0 0 6px', fontSize: 18, color: '#111827' }}>Link expirado</h2>
              <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
                Por segurança, este link venceu. Solicite um novo link para <strong>{info.branding.nome}</strong>
                {info.branding.telefone ? ` (${info.branding.telefone})` : ''}.
              </p>
            </div>
          ) : (
            <form onSubmit={handleEnviar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Empresa</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                  {info.empresa.nomeFantasia || info.empresa.razaoSocial}
                </div>
                <div style={{ fontSize: 13, color: '#475569' }}>CNPJ: {info.empresa.cnpj}</div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
                  1. Selecione o arquivo do Certificado A1 (.pfx ou .p12)
                </label>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '16px 14px',
                    borderRadius: 12,
                    border: `2px dashed ${arquivoNome ? '#16a34a' : '#cbd5e1'}`,
                    background: arquivoNome ? '#f0fdf4' : '#f8fafc',
                    cursor: 'pointer',
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: arquivoNome ? '#166534' : '#334155',
                  }}
                >
                  <Upload size={17} />
                  {arquivoNome ? `Selecionado: ${arquivoNome}` : 'Clique para escolher o arquivo .pfx ou .p12'}
                  <input type="file" accept=".pfx,.p12" onChange={handleSelecionarArquivo} style={{ display: 'none' }} />
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
                  2. Senha do Certificado Digital
                </label>
                <div style={{ position: 'relative' }}>
                  <KeyRound size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                  <input
                    type="password"
                    required
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Digite a senha do arquivo .pfx"
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 36px',
                      borderRadius: 10,
                      border: '1px solid #d1d5db',
                      fontSize: 14.5,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {erroEnvio && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 600 }}>
                  {erroEnvio}
                </div>
              )}

              <button
                type="submit"
                disabled={enviando}
                style={{
                  background: corPrimaria,
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 12,
                  padding: '13px 18px',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: enviando ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <ShieldCheck size={17} />
                {enviando ? 'Validando e criptografando...' : 'Validar e Enviar Certificado com Segurança'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, color: '#6b7280' }}>
                <Lock size={13} />
                Arquivo protegido com criptografia AES-256-GCM · {info.branding.nome}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
