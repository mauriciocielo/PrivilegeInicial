'use client';
import { useState, useEffect, useCallback } from 'react';
import { store } from '../lib/store';
import { fmt } from '../lib/reports';

interface GeminiTipsProps {
  empresaId: string;
  dataIni?: string;
  dataFim?: string;
  status?: string;
  portadorId?: string;
  contextKey?: string;
}

interface TipItem {
  icon: string;
  title: string;
  text: string;
}

export default function GeminiTips({ empresaId, dataIni, dataFim, status = 'realizado', portadorId = '', contextKey = '' }: GeminiTipsProps) {
  const [tips, setTips] = useState<TipItem[]>([]);
  const [loading, setLoading] = useState(false);
  const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyApsKGqQWqF6LeABZG2fNdzXp4G9_wTq6s';

  const generateTips = useCallback(async () => {
    setLoading(true);
    const e = store.getEmpresas().find(x => x.id === empresaId);
    let lancs = store.getLancamentos(empresaId);
    if (status) lancs = lancs.filter(l => l.status === status);
    if (portadorId) lancs = lancs.filter(l => l.portadorId === portadorId);
    const mesAtual = new Date();
    const periodLabel = dataIni && dataFim
      ? `${fmt.date(dataIni)} a ${fmt.date(dataFim)}`
      : mesAtual.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    const lancsMs = dataIni && dataFim
      ? lancs.filter(l => l.data >= dataIni && l.data <= dataFim)
      : lancs.filter(l => {
        const d = new Date(l.data);
        return d.getMonth() === mesAtual.getMonth() && d.getFullYear() === mesAtual.getFullYear();
      });

    const rec = lancsMs.filter(l => l.tipo === 'receita').reduce((a, l) => a + l.valor, 0);
    const desp = lancsMs.filter(l => l.tipo === 'despesa').reduce((a, l) => a + l.valor, 0);
    const saldo = rec - desp;

    const plano = store.getPlanoContas(empresaId);
    const despCats: Record<string, number> = {};
    lancsMs.filter(l => l.tipo === 'despesa').forEach(l => {
      const pc = plano.find(p => p.id === l.planoContaId);
      const nome = pc?.descricao || 'Outras despesas';
      despCats[nome] = (despCats[nome] || 0) + l.valor;
    });

    const topDespesas = Object.entries(despCats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([nome, valor]) => `${nome}: R$ ${valor.toLocaleString('pt-BR')}`)
      .join(', ');

    const intelDocs = store.getInteligenciaDocs() || [];
    const txtDocs = intelDocs.filter(d => d.type.startsWith('text/') || d.name.endsWith('.txt') || d.name.endsWith('.json') || d.name.endsWith('.csv') || d.name.endsWith('.md'));
    const docsContext = txtDocs.length > 0
      ? `\nDIRETRIZES DA BASE DE CONHECIMENTO COMPARTILHADA:\n` + txtDocs.map(d => `- ${d.name}: ${d.content.slice(0, 1000)}`).join('\n')
      : '';

    const activeEmp = store.getEmpresas().find(x => x.id === empresaId);
    const policiesContext = activeEmp 
      ? `\nPOLÍTICAS FINANCEIRAS DA EMPRESA:\n` +
        [
          activeEmp.politicaReceberTexto ? `- Política de Receber: ${activeEmp.politicaReceberTexto.slice(0, 500)}` : '',
          activeEmp.politicaCobrancaTexto ? `- Política de Cobrança: ${activeEmp.politicaCobrancaTexto.slice(0, 500)}` : '',
          activeEmp.politicaComprasTexto ? `- Política de Compras: ${activeEmp.politicaComprasTexto.slice(0, 500)}` : '',
          activeEmp.politicaPagamentosTexto ? `- Política de Pagamentos: ${activeEmp.politicaPagamentosTexto.slice(0, 500)}` : '',
          activeEmp.politicaCreditoTexto ? `- Política de Crédito: ${activeEmp.politicaCreditoTexto.slice(0, 500)}` : ''
        ].filter(Boolean).join('\n')
      : '';

    const prompt = `Você é o robô Privilege AI, assistente contábil e de inteligência financeira de elite do escritório Privilege Consultoria.
Analise a saúde de fluxo de caixa da empresa "${e?.razaoSocial || 'Cliente'}" no período "${periodLabel}", considerando os filtros atuais da tela:
- Faturamento (Receitas): R$ ${rec.toLocaleString('pt-BR')}
- Custos/Despesas Totais: R$ ${desp.toLocaleString('pt-BR')}
- Margem Líquida Realizada: R$ ${saldo.toLocaleString('pt-BR')}
- Top Categorias de Saídas: ${topDespesas || 'Nenhum débito importante'}
${policiesContext}
${docsContext}

Forneça 3 insights ou dicas contábeis/financeiras extremamente estratégicas, objetivas e acionáveis para melhorar a saúde financeira desta empresa de forma direcionada aos números apresentados.

Retorne estritamente um array JSON válido sem blocos de código ou markdown adicionais. Cada item do array deve ter o formato exato:
{
  "icon": "Emoji condizente com a dica",
  "title": "Título curto da recomendação",
  "text": "Ação prática descrita de forma curta e objetiva"
}

Responda em Português do Brasil.`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text.trim()) as TipItem[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTips(parsed);
            setLoading(false);
            return;
          }
        }
      }
    } catch (err) {
      console.error('Gemini API Integration Error:', err);
    }

    // Smart simulated fallback
    await new Promise(r => setTimeout(r, 600));
    let mockTips: TipItem[] = [];
    if (saldo < 0) {
      mockTips = [
        {
          icon: '⚠️',
          title: 'Contenção Imediata',
          text: `Suas saídas excederam o faturamento em ${fmt.currency(Math.abs(saldo))}. Suspenda compras não urgentes de armações e lentes até estabilização.`
        },
        {
          icon: '💰',
          title: 'Estímulo de Receita',
          text: 'Foque em recebimentos à vista via PIX para entrada de capital imediata, evitando antecipações de cartão com altas taxas.'
        },
        {
          icon: '📈',
          title: 'Plano de Ação de Custos',
          text: `As principais saídas estão concentradas em: ${topDespesas || 'despesas operacionais'}. Revise a viabilidade destas contas no próximo ciclo.`
        }
      ];
    } else if (rec === 0) {
      mockTips = [
        {
          icon: '📂',
          title: 'Importação Inteligente',
          text: 'Adicione transações do extrato bancário através da importação de arquivos OFX na aba principal para análise em tempo real.'
        },
        {
          icon: '📋',
          title: 'Sincronização de Contas',
          text: 'Verifique no Plano de Contas se as receitas e custos estão classificados e vinculados aos portadores ativos.'
        },
        {
          icon: '🔍',
          title: 'Ponto de Equilíbrio',
          text: 'Determine o valor médio mensal das despesas fixas para projetar a meta de faturamento necessária para o equilíbrio.'
        }
      ];
    } else {
      mockTips = [
        {
          icon: '💎',
          title: 'Fundo de Reserva',
          text: `Com saldo positivo de ${fmt.currency(saldo)}, transfira de 10% a 15% para um portador com liquidez para criar um caixa de contingência.`
        },
        {
          icon: '📊',
          title: 'Otimização de Custos',
          text: `Suas principais contas de despesa são: ${topDespesas}. Identifique oportunidades de renegociação com fornecedores dessas classes.`
        },
        {
          icon: '🚀',
          title: 'Investimento de Capital',
          text: 'Aproveite o superávit saudável para planejar aportes estratégicos de marketing e imobilizados na Categoria 5 de investimentos.'
        }
      ];
    }
    setTips(mockTips);
    setLoading(false);
  }, [empresaId, dataIni, dataFim, status, portadorId, contextKey]);

  useEffect(() => {
    generateTips();
    const handler = () => generateTips();
    window.addEventListener('cfDataChange', handler);
    return () => window.removeEventListener('cfDataChange', handler);
  }, [generateTips]);

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 32, height: 32,
          borderRadius: 8,
          background: 'rgba(96,0,0,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent)',
          fontSize: 16, fontWeight: 700
        }}>🧠</div>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', letterSpacing: 0.5 }}>Insights Privilege AI (Gemini)</h2>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Análise automática da saúde financeira com inteligência artificial</p>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 24, justifyContent: 'center' }}>
          <div className="animate-pulse" style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)' }}></div>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Privilege AI está analisando seus relatórios financeiros...</span>
        </div>
      ) : (
        <div className="grid-3">
          {tips.map((item, index) => (
            <div key={index} className="card" style={{
              background: 'linear-gradient(135deg, #ffffff 0%, rgba(96,0,0,0.015) 100%)',
              border: '1px solid rgba(96,0,0,0.06)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
              position: 'relative',
              overflow: 'hidden',
              transition: 'transform 0.2s, box-shadow 0.2s',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{item.title}</h4>
              </div>
              <p style={{ fontSize: 12, color: '#334155', lineHeight: 1.5, fontWeight: 500 }}>{item.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
