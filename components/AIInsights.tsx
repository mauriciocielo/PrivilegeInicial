'use client';
import { useEffect, useState, useMemo } from 'react';
import { store } from '../lib/store';
import { fmt } from '../lib/reports';
import { Sparkles, Rocket, TrendingDown, AlertTriangle, Wallet, AlertOctagon, Lightbulb, BrainCircuit, type LucideIcon } from 'lucide-react';

export default function AIInsights({ empresaId, mesSelecionado }: { empresaId: string, mesSelecionado: string }) {
  const [insights, setInsights] = useState<{ type: 'positive' | 'negative' | 'warning', title: string, desc: string, icon: LucideIcon }[]>([]);

  useEffect(() => {
    if (!empresaId || !mesSelecionado) return;

    // Load last 2 months for comparisons
    const [ano, mes] = mesSelecionado.split('-').map(Number);
    
    // Mes atual (Selecionado)
    const dAtual = new Date(ano, mes - 1, 1);
    const mAtualStr = `${dAtual.getFullYear()}-${String(dAtual.getMonth() + 1).padStart(2, '0')}`;
    
    // Mes anterior
    const dAnt = new Date(ano, mes - 2, 1);
    const mAntStr = `${dAnt.getFullYear()}-${String(dAnt.getMonth() + 1).padStart(2, '0')}`;

    const lancs = store.getLancamentos(empresaId).filter(l => l.status === 'realizado');
    
    const recAtual = lancs.filter(l => l.tipo === 'receita' && l.data.startsWith(mAtualStr)).reduce((a, l) => a + l.valor, 0);
    const despAtual = lancs.filter(l => l.tipo === 'despesa' && l.data.startsWith(mAtualStr)).reduce((a, l) => a + l.valor, 0);
    
    const recAnt = lancs.filter(l => l.tipo === 'receita' && l.data.startsWith(mAntStr)).reduce((a, l) => a + l.valor, 0);
    const despAnt = lancs.filter(l => l.tipo === 'despesa' && l.data.startsWith(mAntStr)).reduce((a, l) => a + l.valor, 0);

    const generated: { type: 'positive' | 'negative' | 'warning', title: string, desc: string, icon: LucideIcon }[] = [];

    // Regra 1: Crescimento de Receita (Wow factor)
    if (recAtual > 0 && recAnt > 0) {
      const variacao = ((recAtual - recAnt) / recAnt) * 100;
      if (variacao > 5) {
        generated.push({
          type: 'positive',
          icon: Rocket,
          title: 'Crescimento Acelerado',
          desc: `O seu volume de faturamento aumentou ${variacao.toFixed(1)}% comparado ao mês anterior.`
        });
      } else if (variacao < -10) {
        generated.push({
          type: 'warning',
          icon: TrendingDown,
          title: 'Queda de Receita',
          desc: `Atenção: Houve uma retração de ${Math.abs(variacao).toFixed(1)}% nas suas entradas deste mês.`
        });
      }
    }

    // Regra 2: Alerta de Despesas Perigosas
    if (despAtual > 0 && despAnt > 0) {
      const variacaoDesp = ((despAtual - despAnt) / despAnt) * 100;
      if (variacaoDesp > 10) {
         generated.push({
           type: 'negative',
           icon: AlertTriangle,
           title: 'Despesas Infladas',
           desc: `Os gastos da empresa subiram ${variacaoDesp.toFixed(1)}% (R$ ${fmt.currency(despAtual - despAnt)} a mais que no mês anterior).`
         });
      }
    }

    // Regra 3: Fôlego Financeiro (Margem Liquida)
    const margemAtual = recAtual > 0 ? ((recAtual - despAtual) / recAtual) * 100 : 0;
    if (margemAtual > 20) {
      generated.push({
        type: 'positive',
        icon: Wallet,
        title: 'Alta Lucratividade',
        desc: `Excelente operação! A cada R$100 captados, sua empresa reteve livre R$${margemAtual.toFixed(0)} no caixa.`
      });
    } else if (margemAtual < 0) {
      generated.push({
        type: 'negative',
        icon: AlertOctagon,
        title: 'Operação no Vermelho',
        desc: 'O fluxo de caixa deste mês gerou déficit. As saídas superaram a capacidade de geração de caixa.'
      });
    }

    // Regra 4: Custo de oportunidade (Se sobrou mt)
    if (margemAtual > 5 && generated.length < 3) {
       generated.push({
          type: 'positive',
          icon: Lightbulb,
          title: 'Fôlego Confirmado',
          desc: 'A operação do mês apresentou superávit. Fale com seu consultor sobre estratégias de alocação segura.'
       });
    }

    // Regra 5: Boas Vindas se não tiver dados suficientes
    if (generated.length === 0) {
       generated.push({
         type: 'positive',
         icon: BrainCircuit,
         title: 'Inteligência Financeira Ativa',
         desc: 'A inteligência artificial precisa de mais volume de dados nos últimos 2 meses para gerar insights absolutos para o seu negócio.'
       });
    }

    setInsights(generated.slice(0, 3)); // Max 3 cards
  }, [empresaId, mesSelecionado]);

  if (insights.length === 0) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      <h3 className="ai-insights-title" style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
        <Sparkles size={14} className="pulse-glow" /> Privilege Insights
      </h3>
      <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
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
                padding: '18px',
                borderLeft: `3px solid ${accentColor}`,
                display: 'flex', gap: 14, alignItems: 'flex-start',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: accentBg, color: accentColor,
              }}>
                <Icon size={17} strokeWidth={2.2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13, letterSpacing: 0.2, marginBottom: 4 }}>
                  {insight.title}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {insight.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
