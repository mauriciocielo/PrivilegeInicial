'use client';
import { useEffect, useState, useMemo } from 'react';
import { store } from '../lib/store';
import { fmt } from '../lib/reports';

export default function AIInsights({ empresaId, mesSelecionado }: { empresaId: string, mesSelecionado: string }) {
  const [insights, setInsights] = useState<{ type: 'positive' | 'negative' | 'warning', title: string, desc: string, icon: string }[]>([]);

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

    const generated: { type: 'positive' | 'negative' | 'warning', title: string, desc: string, icon: string }[] = [];

    // Regra 1: Crescimento de Receita (Wow factor)
    if (recAtual > 0 && recAnt > 0) {
      const variacao = ((recAtual - recAnt) / recAnt) * 100;
      if (variacao > 5) {
        generated.push({ 
          type: 'positive', 
          icon: '🚀',
          title: 'Crescimento Acelerado', 
          desc: `O seu volume de faturamento aumentou ${variacao.toFixed(1)}% comparado ao mês anterior.` 
        });
      } else if (variacao < -10) {
        generated.push({ 
          type: 'warning', 
          icon: '📉',
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
           icon: '⚠️',
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
        icon: '💰',
        title: 'Alta Lucratividade',
        desc: `Excelente operação! A cada R$100 captados, sua empresa reteve livre R$${margemAtual.toFixed(0)} no caixa.`
      });
    } else if (margemAtual < 0) {
      generated.push({
        type: 'negative',
        icon: '🚨',
        title: 'Operação no Vermelho',
        desc: 'O fluxo de caixa deste mês gerou déficit. As saídas superaram a capacidade de geração de caixa.'
      });
    }

    // Regra 4: Custo de oportunidade (Se sobrou mt)
    if (margemAtual > 5 && generated.length < 3) {
       generated.push({
          type: 'positive',
          icon: '💡',
          title: 'Fôlego Confirmado',
          desc: 'A operação do mês apresentou superávit. Fale com seu consultor sobre estratégias de alocação segura.'
       });
    }

    // Regra 5: Boas Vindas se não tiver dados suficientes
    if (generated.length === 0) {
       generated.push({
         type: 'positive',
         icon: '🧠',
         title: 'Inteligência Financeira Ativa',
         desc: 'A inteligência artificial precisa de mais volume de dados nos últimos 2 meses para gerar insights absolutos para o seu negócio.'
       });
    }

    setInsights(generated.slice(0, 3)); // Max 3 cards
  }, [empresaId, mesSelecionado]);

  if (insights.length === 0) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 16 }}>
        ✨ Privilege Insights
      </h3>
      <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {insights.map((insight, idx) => {
          const isPos = insight.type === 'positive';
          const isWarn = insight.type === 'warning';
          return (
            <div 
              key={idx}
              className="glass-card" 
              style={{
                padding: '20px', 
                borderLeft: `4px solid ${isPos ? 'var(--green)' : isWarn ? 'var(--orange)' : 'var(--red)'}`,
                display: 'flex', gap: 14, alignItems: 'flex-start',
                background: 'linear-gradient(to right, rgba(255,255,255,0.02), transparent)'
              }}
            >
              <div style={{ fontSize: 24, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>{insight.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
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
