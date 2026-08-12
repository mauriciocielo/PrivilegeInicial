'use client';
import { useMemo } from 'react';
import type { Lancamento, PlanoConta } from '../lib/store';
import { fmt } from '../lib/reports';
import { Sparkles, CopyCheck, Tag, CalendarClock, PieChart, CheckCircle2, type LucideIcon } from 'lucide-react';

type Insight = {
  type: 'positive' | 'negative' | 'warning';
  icon: LucideIcon;
  title: string;
  desc: string;
  onClick?: () => void;
  actionLabel?: string;
};

export default function LancamentosInsights({
  lancamentos,
  planoContas,
  onSelectMissing,
}: {
  lancamentos: Lancamento[];
  planoContas: PlanoConta[];
  onSelectMissing?: () => void;
}) {
  const insights = useMemo<Insight[]>(() => {
    const generated: Insight[] = [];
    const hoje = new Date().toISOString().split('T')[0];

    // 1. Lançamentos sem categoria — atrapalha relatórios e o DRE.
    const semCategoria = lancamentos.filter(l =>
      l.planoContaId !== 'transf' && (!l.planoContaId || !planoContas.some(pc => pc.id === l.planoContaId))
    );
    if (semCategoria.length > 0) {
      generated.push({
        type: 'negative',
        icon: Tag,
        title: 'Lançamentos Sem Categoria',
        desc: `${semCategoria.length} lançamento${semCategoria.length > 1 ? 's' : ''} sem plano de contas — isso distorce os relatórios. Clique para selecionar e corrigir em lote.`,
        onClick: onSelectMissing,
        actionLabel: 'Selecionar agora',
      });
    }

    // 2. Possíveis duplicidades — mesma data, valor e tipo.
    const groups = new Map<string, Lancamento[]>();
    lancamentos.forEach(l => {
      const key = `${l.data}|${l.valor.toFixed(2)}|${l.tipo}`;
      const arr = groups.get(key) || [];
      arr.push(l);
      groups.set(key, arr);
    });
    const duplicateGroups = Array.from(groups.values()).filter(g => g.length > 1);
    if (duplicateGroups.length > 0) {
      const totalDup = duplicateGroups.reduce((a, g) => a + g.length, 0);
      const sample = duplicateGroups[0][0];
      generated.push({
        type: 'warning',
        icon: CopyCheck,
        title: 'Possível Duplicidade',
        desc: `${totalDup} lançamentos com a mesma data e valor (ex: "${sample.descricao}" em ${fmt.date(sample.data)}). Vale conferir se não é um lançamento repetido.`,
      });
    }

    // 3. Vencendo em breve — despesas previstas nos próximos 7 dias.
    const em7dias = new Date();
    em7dias.setDate(em7dias.getDate() + 7);
    const em7diasStr = em7dias.toISOString().split('T')[0];
    const vencendo = lancamentos.filter(l =>
      l.tipo === 'despesa' && l.status === 'previsto' && l.data >= hoje && l.data <= em7diasStr
    );
    if (vencendo.length > 0) {
      const total = vencendo.reduce((a, l) => a + l.valor, 0);
      generated.push({
        type: 'warning',
        icon: CalendarClock,
        title: 'Vencendo nos Próximos 7 Dias',
        desc: `${vencendo.length} conta${vencendo.length > 1 ? 's' : ''} a pagar somando ${fmt.currency(total)} — fique de olho no caixa disponível.`,
      });
    }

    // 4. Maior categoria de despesa do período em análise.
    const despesas = lancamentos.filter(l => l.tipo === 'despesa' && l.status === 'realizado' && l.planoContaId !== 'transf');
    if (despesas.length > 0) {
      const porCategoria = new Map<string, number>();
      despesas.forEach(l => {
        porCategoria.set(l.planoContaId, (porCategoria.get(l.planoContaId) || 0) + l.valor);
      });
      const [topId, topValor] = Array.from(porCategoria.entries()).sort((a, b) => b[1] - a[1])[0];
      const totalDesp = despesas.reduce((a, l) => a + l.valor, 0);
      const pc = planoContas.find(p => p.id === topId);
      if (pc && totalDesp > 0) {
        const pct = (topValor / totalDesp) * 100;
        generated.push({
          type: 'positive',
          icon: PieChart,
          title: 'Maior Categoria de Despesa',
          desc: `"${pc.descricao}" concentra ${fmt.currency(topValor)} (${pct.toFixed(0)}% do total gasto no período filtrado).`,
        });
      }
    }

    // 5. Tudo em ordem.
    if (generated.length === 0) {
      generated.push({
        type: 'positive',
        icon: CheckCircle2,
        title: 'Tudo Organizado',
        desc: 'Nenhuma pendência encontrada nos lançamentos filtrados: sem duplicidades, sem itens sem categoria e nada vencendo nos próximos 7 dias.',
      });
    }

    return generated.slice(0, 3);
  }, [lancamentos, planoContas, onSelectMissing]);

  return (
    <div style={{ marginBottom: 20 }}>
      <h3 className="ai-insights-title" style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
        <Sparkles size={14} className="pulse-glow" /> Insights da IA
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
        {insights.map((insight, idx) => {
          const isPos = insight.type === 'positive';
          const isWarn = insight.type === 'warning';
          const accentColor = isPos ? 'var(--green)' : isWarn ? 'var(--yellow)' : 'var(--red)';
          const accentBg = isPos ? 'var(--green-bg)' : isWarn ? 'var(--yellow-bg)' : 'var(--red-bg)';
          const Icon = insight.icon;
          return (
            <div
              key={idx}
              className="glass-card ai-insight-card"
              style={{
                padding: '16px',
                borderLeft: `3px solid ${accentColor}`,
                display: 'flex', gap: 12, alignItems: 'flex-start',
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: accentBg, color: accentColor,
              }}>
                <Icon size={16} strokeWidth={2.2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 12.5, letterSpacing: 0.2, marginBottom: 3 }}>
                  {insight.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {insight.desc}
                </div>
                {insight.onClick && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 8, padding: '3px 10px', fontSize: 11 }}
                    onClick={insight.onClick}
                  >
                    {insight.actionLabel || 'Ver'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
