'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  CreditCard,
  FileText,
  LogIn,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import BrandLogo from '../../components/BrandLogo';

export default function VendasFinancasPessoaisPage() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [senha, setSenha] = useState('');
  const [cupomInput, setCupomInput] = useState('');
  const [validandoCupom, setValidandoCupom] = useState(false);
  const [cupomAplicado, setCupomAplicado] = useState<{
    codigo: string;
    valorOriginal: number;
    desconto: number;
    valorFinal: number;
    diasTrialExtra: number;
  } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const aplicarCupom = useCallback(async (codigoRaw: string, silencioso = false) => {
    const cod = codigoRaw.trim().toUpperCase();
    if (!cod) return;
    setValidandoCupom(true);
    try {
      const res = await fetch(`/api/public/financas-pessoais/cupom?codigo=${encodeURIComponent(cod)}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.valido) {
        setCupomAplicado(null);
        if (!silencioso) toast.error(d.error || 'Cupom inválido ou expirado.');
        return;
      }
      setCupomAplicado({
        codigo: d.codigo,
        valorOriginal: d.valorOriginal,
        desconto: d.desconto,
        valorFinal: d.valorFinal,
        diasTrialExtra: d.diasTrialExtra || 0,
      });
      if (!silencioso) toast.success(`Cupom ${d.codigo} aplicado!`);
    } catch {
      if (!silencioso) toast.error('Erro ao validar cupom.');
    } finally {
      setValidandoCupom(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const codUrl = new URLSearchParams(window.location.search).get('cupom');
    if (codUrl) {
      const limpo = codUrl.trim().toUpperCase();
      setCupomInput(limpo);
      aplicarCupom(limpo, true);
    }
  }, [aplicarCupom]);

  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      const res = await fetch('/api/public/financas-pessoais/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, phone, senha, cupom: cupomAplicado?.codigo || '' }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || 'Não foi possível criar sua conta.');
        return;
      }
      toast.success('Conta criada! 7 dias grátis liberados — redirecionando...');
      router.push(d.redirectTo || '/cliente/financas-pessoais');
    } catch {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className="pf-landing"
      style={{
        minHeight: '100vh',
        background: 'var(--bg-base, #f6f5f2)',
        color: 'var(--text-primary, #141413)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style jsx global>{`
        .pf-landing-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
          gap: 32px;
          align-items: start;
        }
        .pf-features-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        @media (max-width: 900px) {
          .pf-landing-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
        }
        @media (max-width: 640px) {
          .pf-features-grid {
            grid-template-columns: 1fr;
          }
          .pf-nav-links {
            display: none !important;
          }
          .pf-landing input {
            font-size: 16px !important;
          }
        }
      `}</style>

      {/* Cabeçalho Institucional Privilege */}
      <header
        style={{
          background: '#ffffff',
          borderBottom: '1px solid var(--border, #e6e4de)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            maxWidth: 1140,
            margin: '0 auto',
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <BrandLogo size={38} />
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div className="pf-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <Link href="/" style={{ color: 'var(--text-secondary, #4a4945)', textDecoration: 'none', fontSize: 14.5, fontWeight: 500 }}>
                Início
              </Link>
              <Link href="/contato" style={{ color: 'var(--text-secondary, #4a4945)', textDecoration: 'none', fontSize: 14.5, fontWeight: 500 }}>
                Contato
              </Link>
            </div>
            <Link
              href="/login"
              style={{
                background: 'var(--accent, #600000)',
                color: '#ffffff',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 600,
                padding: '9px 16px',
                borderRadius: 10,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: 'var(--shadow-accent, 0 2px 8px rgba(96, 0, 0, 0.16))',
              }}
            >
              <LogIn size={15} /> Entrar no Painel
            </Link>
          </nav>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main style={{ maxWidth: 1140, width: '100%', margin: '0 auto', padding: '32px 20px 64px', flex: 1 }}>
        <div className="pf-landing-grid">
          {/* Coluna Editorial / Proposta de Valor */}
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                background: 'rgba(96, 0, 0, 0.06)',
                border: '1px solid rgba(96, 0, 0, 0.18)',
                color: 'var(--accent, #600000)',
                padding: '6px 13px',
                borderRadius: 99,
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: '0.02em',
                marginBottom: 16,
              }}
            >
              <Sparkles size={14} /> Privilege Finanças Pessoais · 7 dias grátis
            </div>

            <h1
              style={{
                margin: 0,
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: 'clamp(34px, 5vw, 52px)',
                fontWeight: 400,
                lineHeight: 1.08,
                color: 'var(--text-primary, #141413)',
                letterSpacing: '-0.01em',
              }}
            >
              Controle seu dinheiro pelo <span style={{ color: 'var(--accent, #600000)', fontStyle: 'italic' }}>WhatsApp</span> com inteligência financeira de verdade.
            </h1>

            <p
              style={{
                margin: '16px 0 24px',
                fontSize: 15.5,
                lineHeight: 1.65,
                color: 'var(--text-secondary, #4a4945)',
              }}
            >
              Envie um áudio, texto ou foto de cupom/PDF de recibo médico no WhatsApp. O sistema lança seus gastos, concilia seu extrato bancário com IA, controla cartões, investimentos, rendimentos e organiza sua <strong>Pasta do IRPF</strong> automaticamente.
            </p>

            {/* Benefícios em Cards no padrão Privilege */}
            <div className="pf-features-grid">
              {[
                {
                  icon: MessageSquare,
                  title: 'Lançamento por Áudio e Foto',
                  desc: 'Mande "Gastei 85 no mercado no pix" ou a foto do comprovante direto no WhatsApp.',
                },
                {
                  icon: Brain,
                  title: 'Conciliação de Extrato com IA',
                  desc: 'Sobe seu OFX/CSV: a IA identifica o que já foi lançado e categoriza usando o seu histórico.',
                },
                {
                  icon: TrendingUp,
                  title: 'Investimentos & Rendimentos',
                  desc: 'Renda Fixa, Bolsa, Day Trade (DARF 20%), Consórcios e rendimentos vinculados por ativo.',
                },
                {
                  icon: FileText,
                  title: 'Pasta IRPF com PDF',
                  desc: 'Guarda recibos de Saúde, Educação e Previdência com o documento fiscal pronto para baixar.',
                },
                {
                  icon: CreditCard,
                  title: 'Cartões & Plano anti-Dívidas',
                  desc: 'Consultor IA cria um plano prático para quitar juros caros e melhorar seus investimentos.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Segurança e Privacidade',
                  desc: 'Seus dados pessoais ficam 100% isolados, acessíveis no celular ou computador.',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    style={{
                      background: 'var(--bg-card, #ffffff)',
                      border: '1px solid var(--border, #e6e4de)',
                      borderRadius: 14,
                      padding: 16,
                      boxShadow: 'var(--shadow, 0 1px 2px rgba(20, 20, 19, 0.04))',
                    }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 9,
                        background: 'rgba(96, 0, 0, 0.07)',
                        color: 'var(--accent, #600000)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 10,
                      }}
                    >
                      <Icon size={17} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-primary, #141413)' }}>{item.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted, #6e6c66)', marginTop: 4, lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coluna Card de Assinatura / Autocadastro */}
          <div
            style={{
              background: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border, #e6e4de)',
              borderTop: '4px solid var(--accent, #600000)',
              borderRadius: 16,
              padding: '26px 24px',
              boxShadow: 'var(--shadow-lg, 0 12px 28px rgba(20, 20, 19, 0.08))',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'var(--gold, #a88948)',
                }}
              >
                Teste Grátis por 7 Dias
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  background: 'rgba(21, 128, 61, 0.08)',
                  color: '#15803d',
                  padding: '3px 9px',
                  borderRadius: 99,
                }}
              >
                Sem cartão agora
              </span>
            </div>

            <h2
              style={{
                margin: 0,
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: 28,
                fontWeight: 400,
                color: 'var(--text-primary, #141413)',
              }}
            >
              Comece agora mesmo
            </h2>

            <div
              style={{
                margin: '12px 0 18px',
                padding: '12px 14px',
                borderRadius: 12,
                background: 'var(--bg-card2, #f3f2ee)',
                border: '1px solid var(--border, #e6e4de)',
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #6e6c66)', fontWeight: 600 }}>
                  Após os {7 + (cupomAplicado?.diasTrialExtra || 0)} dias grátis
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #6e6c66)' }}>Cancele quando quiser</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {cupomAplicado && (
                  <div style={{ fontSize: 12.5, color: '#6e6c66', textDecoration: 'line-through' }}>
                    R$ {cupomAplicado.valorOriginal.toFixed(2).replace('.', ',')}
                  </div>
                )}
                <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent, #600000)' }}>
                  R$ {(cupomAplicado ? cupomAplicado.valorFinal : 29.9).toFixed(2).replace('.', ',')}
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted, #6e6c66)' }}>/mês</span>
              </div>
            </div>

            <form onSubmit={handleCadastrar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary, #4a4945)', display: 'block', marginBottom: 4 }}>
                  Nome completo
                </label>
                <input
                  className="form-control"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Maria Silva"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-dark, #d3d0c8)', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary, #4a4945)', display: 'block', marginBottom: 4 }}>
                  E-mail de acesso
                </label>
                <input
                  className="form-control"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="maria@email.com"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-dark, #d3d0c8)', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary, #4a4945)', display: 'block', marginBottom: 4 }}>
                  WhatsApp com DDD
                </label>
                <input
                  className="form-control"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(46) 99999-9999"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-dark, #d3d0c8)', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary, #4a4945)', display: 'block', marginBottom: 4 }}>
                  Crie sua senha (mín. 6 caracteres)
                </label>
                <input
                  className="form-control"
                  type="password"
                  required
                  minLength={6}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-dark, #d3d0c8)', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary, #4a4945)', display: 'block', marginBottom: 4 }}>
                  Cupom de desconto (opcional)
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="form-control"
                    value={cupomInput}
                    onChange={(e) => setCupomInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                    placeholder="Ex.: PRIVILEGE20"
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-dark, #d3d0c8)', boxSizing: 'border-box', fontFamily: 'monospace' }}
                  />
                  <button
                    type="button"
                    disabled={validandoCupom || !cupomInput.trim()}
                    onClick={() => aplicarCupom(cupomInput)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: '1px solid var(--accent, #600000)',
                      background: '#fff',
                      color: 'var(--accent, #600000)',
                      fontWeight: 700,
                      fontSize: 13.5,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {validandoCupom ? '...' : 'Aplicar'}
                  </button>
                </div>
                {cupomAplicado && (
                  <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 700, color: '#15803d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      ✓ Cupom {cupomAplicado.codigo} aplicado (economia de R$ {cupomAplicado.desconto.toFixed(2).replace('.', ',')}
                      {cupomAplicado.diasTrialExtra > 0 ? ` + ${cupomAplicado.diasTrialExtra} dias grátis` : ''})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCupomAplicado(null);
                        setCupomInput('');
                      }}
                      style={{ background: 'transparent', border: 'none', color: '#b91c1c', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={enviando}
                style={{
                  marginTop: 6,
                  width: '100%',
                  padding: '13px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--accent, #600000)',
                  color: '#ffffff',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: 'var(--shadow-accent, 0 2px 8px rgba(96, 0, 0, 0.16))',
                }}
              >
                {enviando ? 'Liberando seu acesso...' : 'Criar conta e testar 7 dias grátis'}
                {!enviando && <ArrowRight size={17} />}
              </button>
            </form>

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-light, #efede8)', display: 'flex', flexDirection: 'column', gap: 7, fontSize: 12.5, color: 'var(--text-secondary, #4a4945)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <CheckCircle2 size={14} color="#15803d" /> Acesso imediato no painel e integrado ao seu WhatsApp
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <CheckCircle2 size={14} color="#15803d" /> Layout otimizado para celular e computador
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <CheckCircle2 size={14} color="#15803d" /> Tecnologia Privilege Contabilidade e Consultoria
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Rodapé Institucional */}
      <footer
        style={{
          background: '#ffffff',
          borderTop: '1px solid var(--border, #e6e4de)',
          padding: '20px',
          textAlign: 'center',
          fontSize: 13,
          color: 'var(--text-muted, #6e6c66)',
        }}
      >
        © {new Date().getFullYear()} Privilege Contabilidade e Consultoria ·{' '}
        <Link href="/privacidade" style={{ color: 'var(--accent, #600000)', textDecoration: 'none', fontWeight: 600 }}>
          Privacidade
        </Link>{' '}
        ·{' '}
        <Link href="/termos" style={{ color: 'var(--accent, #600000)', textDecoration: 'none', fontWeight: 600 }}>
          Termos de Uso
        </Link>
      </footer>
    </div>
  );
}
