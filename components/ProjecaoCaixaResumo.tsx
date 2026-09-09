'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { store, Endividamento, Lancamento, PlanoConta, Portador } from '../lib/store';
import { fmt } from '../lib/reports';
import { projetarCaixa } from '../lib/projecao-caixa';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

/**
 * Leitura rápida da projeção de caixa para o dashboard: a curva dos próximos
 * meses e o aviso do mês em que o dinheiro acaba. O detalhamento e o simulador
 * de financiamento ficam na tela dedicada.
 */
export default function ProjecaoCaixaResumo({
  empresaId,
  meses = 6,
  /** Passe null para omitir o link — o portal do cliente não tem a tela detalhada. */
  href = '/consultor/projecao-caixa',
}: { empresaId: string; meses?: number; href?: string | null }) {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [endividamentos, setEndividamentos] = useState<Endividamento[]>([]);
  const [portadores, setPortadores] = useState<Portador[]>([]);

  useEffect(() => {
    if (!empresaId) return;
    const carregar = () => {
      setLancamentos(store.getLancamentos(empresaId));
      setPlanoContas(store.getPlanoContas(empresaId));
      setEndividamentos(store.getEndividamentos(empresaId));
      setPortadores(store.getPortadores(empresaId));
    };
    carregar();
    window.addEventListener('cfDataChange', carregar);
    return () => window.removeEventListener('cfDataChange', carregar);
  }, [empresaId]);

  const saldoInicial = useMemo(() => {
    if (!empresaId) return 0;
    const hoje = new Date().toISOString().split('T')[0];
    return portadores.reduce((s, p) => s + store.getSaldoPortador(p.id, empresaId, hoje), 0);
  }, [portadores, empresaId]);

  const proj = useMemo(
    () => projetarCaixa({ meses, saldoInicial, lancamentos, planoContas, endividamentos }),
    [meses, saldoInicial, lancamentos, planoContas, endividamentos]
  );

  const dados = proj.meses.map(m => ({ mes: m.label.slice(0, 5), Saldo: Math.round(m.saldoFinal) }));
  const mesCritico = proj.meses.find(m => m.competencia === proj.primeiroMesNegativo);
  const temPrevistos = proj.meses.some(m => m.entradas > 0 || m.saidasOperacionais > 0);

  return (
    <div className="card glass-card card-dynamic animate-slide-up" style={{ marginBottom: 32, animationDelay: '150ms' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div className="card-title">Projeção de caixa — próximos {meses} meses</div>
        {href && (
          <Link href={href} style={{ fontSize: 12.5, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
            Ver detalhes e simular financiamento →
          </Link>
        )}
      </div>

      {/* Três números que resumem a situação */}
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text-muted)', marginBottom: 3 }}>
            Em conta hoje
          </div>
          <div style={{ fontSize: 21, fontWeight: 800 }}>{fmt.currency(saldoInicial)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text-muted)', marginBottom: 3 }}>
            Menor saldo previsto
          </div>
          <div style={{ fontSize: 21, fontWeight: 800, color: proj.menorSaldo < 0 ? 'var(--red)' : 'var(--green)' }}>
            {fmt.currency(proj.menorSaldo)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text-muted)', marginBottom: 3 }}>
            Cobertura da dívida
          </div>
          <div style={{
            fontSize: 21, fontWeight: 800,
            color: proj.coberturaServicoDivida === null ? 'var(--text-secondary)'
              : proj.coberturaServicoDivida < 1 ? 'var(--red)' : 'var(--green)',
          }}>
            {proj.coberturaServicoDivida === null ? '—' : `${proj.coberturaServicoDivida.toFixed(2)}x`}
          </div>
        </div>
      </div>

      {mesCritico && (
        <div style={{
          background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 8,
          padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--text-primary)',
        }}>
          ⚠️ O caixa fica negativo em <strong>{mesCritico.label}</strong>, chegando a{' '}
          <strong>{fmt.currency(proj.menorSaldo)}</strong>.
        </div>
      )}

      <ResponsiveContainer width="100%" height={170}>
        <AreaChart data={dados} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="grad-projecao" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={46}
                 tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip formatter={(v: any) => fmt.currency(Number(v))} />
          <ReferenceLine y={0} stroke="var(--red)" strokeDasharray="4 4" />
          <Area type="monotone" dataKey="Saldo" stroke="#3b82f6" strokeWidth={2} fill="url(#grad-projecao)" />
        </AreaChart>
      </ResponsiveContainer>

      {!temPrevistos && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.6 }}>
          Não há lançamentos previstos no período — a curva mostra apenas o efeito das parcelas de dívida.
          Cadastrar contas a pagar e a receber torna a projeção confiável.
        </div>
      )}
    </div>
  );
}
