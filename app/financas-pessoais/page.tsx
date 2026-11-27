'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  CreditCard,
  FileText,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';

export default function VendasFinancasPessoaisPage() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);

  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      const res = await fetch('/api/public/financas-pessoais/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, phone, senha }),
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
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Topo */}
      <header style={{ maxWidth: 1120, margin: '0 auto', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #16a34a, #0d9488)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wallet size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em' }}>Minhas Finanças PF</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>WhatsApp + Inteligência Artificial</div>
          </div>
        </div>
        <a
          href="/login"
          style={{
            color: '#e2e8f0',
            textDecoration: 'none',
            fontSize: 13.5,
            fontWeight: 700,
            padding: '8px 14px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.16)',
          }}
        >
          Já tenho conta
        </a>
      </header>

      {/* Hero + Formulário */}
      <main style={{ maxWidth: 1120, margin: '0 auto', padding: '20px 20px 64px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 32,
            alignItems: 'center',
          }}
        >
          {/* Coluna Texto */}
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(22, 163, 74, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                color: '#86efac',
                padding: '6px 12px',
                borderRadius: 99,
                fontSize: 12.5,
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              <Sparkles size={14} /> 7 dias grátis · Sem precisar cadastrar cartão
            </div>

            <h1 style={{ margin: 0, fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 900, lineHeight: 1.12, letterSpacing: '-0.03em' }}>
              Controle seu dinheiro pelo <span style={{ color: '#4ade80' }}>WhatsApp</span> com uma IA cuidando do seu bolso.
            </h1>

            <p style={{ margin: '16px 0 22px', fontSize: 16, lineHeight: 1.6, color: '#cbd5e1' }}>
              Mande um áudio, foto de cupom ou PDF de recibo médico no WhatsApp. O sistema lança, concilia seu extrato bancário, organiza cartões, investimentos, rendimentos e monta sua <strong>Pasta do IRPF</strong> automaticamente.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
              {[
                { icon: MessageSquare, title: 'Lançamento por Áudio e Foto', desc: '"Gastei 85 no mercado" ou foto do cupom direto no WhatsApp.' },
                { icon: Brain, title: 'Conciliação de Extrato com IA', desc: 'Sobe o OFX/CSV: a IA detecta o que já foi lançado e categoriza pelo seu histórico.' },
                { icon: TrendingUp, title: 'Investimentos & Rendimentos', desc: 'Renda Fixa, Bolsa, Day Trade (DARF 20%), Consórcios e Dividendos.' },
                { icon: FileText, title: 'Pasta IRPF com PDF', desc: 'Guarda recibos de Saúde e Educação com PDF pronto para baixar na declaração.' },
                { icon: CreditCard, title: 'Cartões & Plano anti-Dívidas', desc: 'Consultor IA cria um plano prático para quitar juros caros e investir melhor.' },
                { icon: ShieldCheck, title: 'Privado e 100% seu', desc: 'Seus dados ficam isolados e acessíveis no celular ou computador.' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.09)',
                      borderRadius: 14,
                      padding: 14,
                    }}
                  >
                    <Icon size={18} color="#4ade80" style={{ marginBottom: 6 }} />
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{item.title}</div>
                    <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 3, lineHeight: 1.45 }}>{item.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coluna Formulário de Autocadastro */}
          <div
            style={{
              background: '#ffffff',
              color: '#0f172a',
              borderRadius: 20,
              padding: '26px 24px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#15803d' }}>
              Acesso Imediato
            </div>
            <h2 style={{ margin: '4px 0 6px', fontSize: 22, fontWeight: 900 }}>
              Comece seu teste grátis de 7 dias
            </h2>
            <p style={{ margin: '0 0 18px', fontSize: 13.5, color: '#64748b' }}>
              Depois do teste: <strong>R$ 29,90/mês</strong> ou <strong>R$ 297/ano</strong> (2 meses grátis). Cancele quando quiser.
            </p>

            <form onSubmit={handleCadastrar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, display: 'block', marginBottom: 4 }}>Seu nome</label>
                <input
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Maria Silva"
                  style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, display: 'block', marginBottom: 4 }}>Seu melhor e-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="maria@email.com"
                  style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, display: 'block', marginBottom: 4 }}>WhatsApp com DDD</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(46) 99999-9999"
                  style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, display: 'block', marginBottom: 4 }}>Crie uma senha (mín. 6 caracteres)</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••"
                  style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box' }}
                />
              </div>

              <button
                type="submit"
                disabled={enviando}
                style={{
                  marginTop: 6,
                  width: '100%',
                  padding: '13px 16px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #16a34a, #15803d)',
                  color: '#fff',
                  fontSize: 15.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {enviando ? 'Liberando seu acesso...' : 'Criar conta e testar grátis'}
                {!enviando && <ArrowRight size={17} />}
              </button>
            </form>

            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: '#475569' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={14} color="#16a34a" /> Liberação instantânea no painel e no WhatsApp
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={14} color="#16a34a" /> Funciona direto no navegador do celular e computador
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
