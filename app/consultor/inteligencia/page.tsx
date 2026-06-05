'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { store, type Lancamento, type PlanoConta, type Portador, type Empresa } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import dynamic from 'next/dynamic';

// Carrega os componentes do Recharts dinamicamente sem SSR para evitar erros de hidratação no Next.js
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });
const LineChart = dynamic(() => import('recharts').then(mod => mod.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(mod => mod.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then(mod => mod.Legend), { ssr: false });

type ActiveTab = 'geral' | 'dre' | 'capital' | 'chat';

export default function InteligenciaFinanceiraPage() {
  const [empresaId, setEmpresaId] = useState('e1');
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [portadores, setPortadores] = useState<Portador[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('geral');

  // Estado para o Chat de IA
  const [chatMessages, setChatMessages] = useState<{ sender: 'user' | 'ai'; text: string; timestamp: string }[]>([
    {
      sender: 'ai',
      text: 'Olá! Sou o Privilege AI Copilot. Posso simular cenários de crise, projetar o caixa futuro da sua empresa ou analisar margens. Pergunte-me algo como: "O que acontece se eu perder 20% das minhas receitas?" ou "Qual meu ponto de equilíbrio atual?"',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Sliders do Simulador de Cenários
  const [simReceitasDelta, setSimReceitasDelta] = useState(0); // em % (ex: +10%)
  const [simCustosDelta, setSimCustosDelta] = useState(0); // em %
  const [simPmrShift, setSimPmrShift] = useState(0); // em dias (ex: +5 dias)
  const [simPmpShift, setSimPmpShift] = useState(0); // em dias

  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<{ icon: string; title: string; text: string }[] | null>(null);

  const load = useCallback((eId: string) => {
    setEmpresaId(eId);
    const isGroup = eId.startsWith('grupo:');
    const grupoName = isGroup ? eId.split(':')[1] : '';
    setEmpresas(store.getEmpresas());

    if (isGroup) {
      const empsInGroup = store.getEmpresas().filter(e => e.grupoEconomico === grupoName);
      const targetLancs: Lancamento[] = [];
      const targetPorts: Portador[] = [];
      const targetPlano: PlanoConta[] = [];

      empsInGroup.forEach(emp => {
        targetLancs.push(...store.getLancamentos(emp.id));
        targetPorts.push(...store.getPortadores(emp.id));
        targetPlano.push(...store.getPlanoContas(emp.id));
      });

      setLancamentos(targetLancs);
      setPortadores(targetPorts);
      setPlanoContas(targetPlano);
    } else {
      setLancamentos(store.getLancamentos(eId));
      setPlanoContas(store.getPlanoContas(eId));
      setPortadores(store.getPortadores(eId));
    }
  }, []);

  const generateAISimulationInsights = async () => {
    setAiLoading(true);
    const e = empresas.find(x => x.id === empresaId);
    const activeCompanyName = e?.razaoSocial || 'Cliente';
    const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyApsKGqQWqF6LeABZG2fNdzXp4G9_wTq6s';

    const prompt = `Você é o robô Privilege AI, consultor financeiro de elite do escritório Privilege Consultoria.
O consultor financeiro realizou uma simulação de cenários de fluxo de caixa para a empresa "${activeCompanyName}".
Analise a viabilidade e os riscos deste cenário simulado em comparação com os números históricos da empresa:

DADOS HISTÓRICOS (BASELINE):
- Faturamento Operacional Médio Mensal: R$ ${mediasRecentes.receitaMed.toLocaleString('pt-BR')}
- Custos Operacionais Variáveis Médios Mensais: R$ ${mediasRecentes.custoMed.toLocaleString('pt-BR')}
- Despesas Operacionais Fixas Médias Mensais: R$ ${mediasRecentes.despesaMed.toLocaleString('pt-BR')}
- Prazo Médio de Recebimento (PMR): ${prazosOriginais.pmr} dias
- Prazo Médio de Pagamento (PMP): ${prazosOriginais.pmp} dias
- Necessidade de Capital de Giro (NCG) de Partida: R$ ${prazosOriginais.ncg.toLocaleString('pt-BR')}
- Saldo de Caixa de Partida: R$ ${runway.caixaTotal.toLocaleString('pt-BR')}

ALTERAÇÕES SIMULADAS PROPOSTAS:
- Ajuste de Receita: ${simReceitasDelta >= 0 ? '+' : ''}${simReceitasDelta}%
- Ajuste de Custos & Despesas: ${simCustosDelta >= 0 ? '+' : ''}${simCustosDelta}%
- Novo PMR: ${simulacoes.pmrSim} dias (variação: ${simPmrShift >= 0 ? '+' : ''}${simPmrShift} dias)
- Novo PMP: ${simulacoes.pmpSim} dias (variação: ${simPmpShift >= 0 ? '+' : ''}${simPmpShift} dias)
- Variação Necessária de Capital de Giro (NCG Delta): R$ ${simulacoes.ncgDelta.toLocaleString('pt-BR')} (Novo NCG: R$ ${simulacoes.ncgSim.toLocaleString('pt-BR')})

Forneça 3 insights ou dicas estratégicas e acionáveis específicos para este cenário simulado (ex: alertar se houver descasamento de fluxo de caixa por causa de aumento de PMR, alertar se a margem de contribuição diminuirá, sugerir formas de financiar a necessidade de giro adicional, etc.).

Retorne estritamente um array JSON válido sem blocos de código ou markdown adicionais. Cada item do array deve ter o formato exato:
[
  {
    "icon": "Emoji condizente com a dica",
    "title": "Título curto da recomendação",
    "text": "Ação prática ou análise curta e objetiva"
  }
]

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
          const parsed = JSON.parse(text.trim());
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAiInsights(parsed);
            setAiLoading(false);
            return;
          }
        }
      }
    } catch (err) {
      console.error('Gemini Simulation Insights Error:', err);
    }

    // Fallback simulado responsivo se a API falhar
    await new Promise(r => setTimeout(r, 800));
    const mockTips = [];
    const isPmrWorse = simPmrShift > 0;
    const isPmpWorse = simPmpShift < 0;
    const isRevenueUp = simReceitasDelta > 0;
    const isCustoUp = simCustosDelta > 0;

    if (isPmrWorse || isPmpWorse) {
      mockTips.push({
        icon: '⚠️',
        title: 'Alerta de Capital de Giro',
        text: `O aumento do PMR ou redução do PMP gerou uma necessidade adicional de caixa de ${fmt.currency(Math.abs(simulacoes.ncgDelta))}. Cuidado para não sofrer asfixia financeira mesmo vendendo mais.`
      });
    } else {
      mockTips.push({
        icon: '⚡',
        title: 'Eficiência de Ciclo',
        text: 'A melhora nos prazos de recebimento/pagamento liberou capital de giro. Use essa liquidez extra para obter descontos com fornecedores pagando à vista.'
      });
    }

    if (isRevenueUp && !isCustoUp) {
      mockTips.push({
        icon: '🚀',
        title: 'Aproveitamento de Margem',
        text: 'O aumento de receita sem elevação proporcional dos custos fixos maximiza o EBITDA. Considere investir o superávit na expansão da capacidade produtiva.'
      });
    } else if (isCustoUp) {
      mockTips.push({
        icon: '📉',
        title: 'Atenção ao Break-Even',
        text: `O aumento de ${simCustosDelta}% nos custos operacionais elevou seu ponto de equilíbrio para ${fmt.currency(breakEven.pontoEquilibrio * (1 + simCustosDelta / 100))}. Reveja despesas supérfluas.`
      });
    } else {
      mockTips.push({
        icon: '🎯',
        title: 'Estabilidade Operacional',
        text: 'As simulações mostram estabilidade. Recomenda-se manter o fundo de reserva ativo (Runway de ' + runway.mesesRunway.toFixed(1) + ' meses) para cobrir eventuais sazonalidades.'
      });
    }

    mockTips.push({
      icon: '🧠',
      title: 'Decisão Estratégica',
      text: `No cenário atual, o caixa projetado após 6 meses será de ${fmt.currency(projecoesData[projecoesData.length - 1]['Saldo Simulado'])}. Planeje captações ou aportes com antecedência.`
    });

    setAiInsights(mockTips);
    setAiLoading(false);
  };

  const sendChatMessage = async (msgText: string) => {
    if (!msgText.trim()) return;

    // Add user message to history
    const userMsg = {
      sender: 'user' as const,
      text: msgText,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput('');
    setChatLoading(true);

    const activeCompany = empresas.find(x => x.id === empresaId);
    const companyName = activeCompany?.razaoSocial || (empresaId.startsWith('grupo:') ? `Grupo Consolidado ${empresaId.split(':')[1]}` : 'Cliente');

    const intelDocs = store.getInteligenciaDocs() || [];
    const txtDocs = intelDocs.filter(d => d.type.startsWith('text/') || d.name.endsWith('.txt') || d.name.endsWith('.json') || d.name.endsWith('.csv') || d.name.endsWith('.md'));
    const docsContext = txtDocs.length > 0
      ? `\nDIRETRIZES DA BASE DE CONHECIMENTO COMPARTILHADA (GLOBAL):\n` + txtDocs.map(d => `- ${d.name}: ${d.content.slice(0, 1000)}`).join('\n')
      : '';

    const activeEmp = activeCompany;
    const policiesContext = activeEmp 
      ? `\nPOLÍTICAS FINANCEIRAS HOMOLOGADAS DA EMPRESA:\n` +
        [
          activeEmp.politicaReceberTexto ? `- Política de Receber: ${activeEmp.politicaReceberTexto.slice(0, 500)}` : '',
          activeEmp.politicaCobrancaTexto ? `- Política de Cobrança: ${activeEmp.politicaCobrancaTexto.slice(0, 500)}` : '',
          activeEmp.politicaComprasTexto ? `- Política de Compras: ${activeEmp.politicaComprasTexto.slice(0, 500)}` : '',
          activeEmp.politicaPagamentosTexto ? `- Política de Pagamentos: ${activeEmp.politicaPagamentosTexto.slice(0, 500)}` : '',
          activeEmp.politicaCreditoTexto ? `- Política de Crédito: ${activeEmp.politicaCreditoTexto.slice(0, 500)}` : ''
        ].filter(Boolean).join('\n')
      : '';

    // Build the monthly history string
    const dreHistoryStr = dreMeses.map(m =>
      `- Mês ${m.mes}: Receita ROB R$ ${m.receita.toLocaleString('pt-BR')}, Custos Variáveis R$ ${m.custo.toLocaleString('pt-BR')}, Despesas Fixas R$ ${m.despesa.toLocaleString('pt-BR')}, EBITDA R$ ${m.ebitda.toLocaleString('pt-BR')}, Result. Líquido R$ ${m.resultadoLiquido.toLocaleString('pt-BR')}`
    ).join('\n');

    // Get recent transactions
    const sortedLancs = [...lancamentos]
      .filter(l => l.status === 'realizado')
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 10);

    const recentLancsStr = sortedLancs.map(l => {
      const pc = planoContas.find(p => p.id === l.planoContaId);
      return `- ${fmt.date(l.data)}: [${l.tipo.toUpperCase()}] ${l.descricao} - R$ ${l.valor.toLocaleString('pt-BR')} (Categoria: ${pc?.descricao || 'Outros'})`;
    }).join('\n');

    // Compile entire financial context
    const contextPrompt = `Você é o Privilege AI Copilot, o consultor financeiro virtual e CFO de elite da Privilege Consultoria. Você está ajudando a gerir as finanças da empresa "${companyName}".
Aqui estão os dados financeiros reais e atuais da empresa para embasar suas respostas e simulações:

CONTEXTO DA EMPRESA:
- Nome da Empresa/Grupo: ${companyName}
- Saldo Atual Total em Caixa: R$ ${runway.caixaTotal.toLocaleString('pt-BR')}
- Ponto de Equilíbrio (Break-Even) Mensal: R$ ${breakEven.pontoEquilibrio.toLocaleString('pt-BR')}
- Fundo de Reserva / Runway Atual: ${runway.mesesRunway === Infinity ? 'Sem custos fixos' : runway.mesesRunway.toFixed(1) + ' meses'}
- Prazo Médio de Recebimento (PMR): ${prazosOriginais.pmr} dias
- Prazo Médio de Pagamento (PMP): ${prazosOriginais.pmp} dias
- Ciclo Financeiro (de Caixa): ${prazosOriginais.pmr - prazosOriginais.pmp} dias
- Necessidade de Capital de Giro (NCG) de Partida: R$ ${prazosOriginais.ncg.toLocaleString('pt-BR')}
${policiesContext}
${docsContext}

HISTÓRICO RECENTE DO DRE (ÚLTIMOS MESES):
${dreHistoryStr || 'Nenhum lançamento DRE histórico registrado.'}

DADOS DA SIMULAÇÃO OPERATIVA ATUAL (Ajustada nos Sliders do Painel):
- Simulação de Receita: ${simReceitasDelta >= 0 ? '+' : ''}${simReceitasDelta}%
- Simulação de Custos & Despesas: ${simCustosDelta >= 0 ? '+' : ''}${simCustosDelta}%
- Simulação PMR: ${simulacoes.pmrSim} dias (variação de ${simPmrShift >= 0 ? '+' : ''}${simPmrShift} dias)
- Simulação PMP: ${simulacoes.pmpSim} dias (variação de ${simPmpShift >= 0 ? '+' : ''}${simPmpShift} dias)
- Impacto Simulado na NCG (NCG Delta): R$ ${simulacoes.ncgDelta.toLocaleString('pt-BR')}
- Novo NCG Necessário Simulado: R$ ${simulacoes.ncgSim.toLocaleString('pt-BR')}

ÚLTIMOS LANÇAMENTOS DO EXTRATO REALIZADO:
${recentLancsStr || 'Nenhum lançamento recente.'}

INSTRUÇÕES DE COMPORTAMENTO:
1. Responda de forma extremamente focada e estratégica como um CFO profissional de elite da Privilege Consultoria.
2. Sempre use os números fornecidos acima de maneira coerente e real. Se o usuário perguntar sobre cenários de crise ou otimização, faça os cálculos mentais com base no faturamento, custos fixos e variáveis, e mostre o impacto exato no runway (em meses) e no saldo acumulado.
3. Dê conselhos e planos de ação práticos (ex: renegociar prazos com determinados tipos de fornecedores, antecipar recebíveis, reduzir custos fixos, ajustar margem de contribuição, aplicar o superávit).
4. Mantenha as respostas bem estruturadas em português, usando listas, tópicos em negrito e formatação markdown profissional. Evite termos genéricos, seja direto aos números.
5. Nunca invente dados que contradigam o contexto real fornecido.`;

    const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyApsKGqQWqF6LeABZG2fNdzXp4G9_wTq6s';

    // A API do Gemini exige que o primeiro turno de conversa comece com uma mensagem do usuário ('user').
    const firstUserMsgIndex = updatedMessages.findIndex(m => m.sender === 'user');
    const conversationHistory = firstUserMsgIndex !== -1 ? updatedMessages.slice(firstUserMsgIndex) : updatedMessages;

    const contents = conversationHistory.slice(-10).map(m => ({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: {
              parts: [{ text: contextPrompt }]
            }
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          setChatMessages(prev => [
            ...prev,
            {
              sender: 'ai',
              text: text,
              timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            }
          ]);
          setChatLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error('Gemini Chat Error:', err);
    }

    // Fallback if API fails or rate limit hit
    await new Promise(r => setTimeout(r, 1000));
    setChatMessages(prev => [
      ...prev,
      {
        sender: 'ai',
        text: 'Desculpe, ocorreu uma oscilação na conexão com os servidores Privilege AI. Deixe-me dar um parecer com base nos nossos relatórios:\n\n* **Saldo Total:** ' + fmt.currency(runway.caixaTotal) + '\n* **Necessidade de Giro:** ' + fmt.currency(simulacoes.ncgSim) + ' (Variação: ' + fmt.currency(simulacoes.ncgDelta) + ')\n* **Runway Estimado:** ' + (runway.mesesRunway === Infinity ? 'Sem custos fixos' : runway.mesesRunway.toFixed(1) + ' meses') + '.\n\nTente enviar sua pergunta novamente.',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setChatLoading(false);
  };

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || (store.getEmpresas()[0]?.id ?? '');
    load(saved);
    const handler = (e: Event) => load((e as CustomEvent).detail);
    window.addEventListener('empresaChange', handler);
    return () => window.removeEventListener('empresaChange', handler);
  }, [load]);

  // Auxiliar para classificar lançamentos nas categorias da DRE
  const getDRECategory = useCallback((planoContaId: string): 'receita' | 'custo' | 'despesa' | 'outros' => {
    const pc = planoContas.find(p => p.id === planoContaId);
    if (!pc) return 'outros';
    const rootCode = pc.codigo.split('.')[0];
    if (rootCode === '1') return 'receita';
    if (rootCode === '2') return 'custo';
    if (rootCode === '3') return 'despesa';
    return 'outros';
  }, [planoContas]);

  // --- 1. PROCESSAMENTO DA DRE POR MÊS ---
  const dreMeses = useMemo(() => {
    const dataMap: Record<string, { receita: number; custo: number; despesa: number; outros: number }> = {};
    
    // Filtra apenas lançamentos realizados para DRE histórica
    lancamentos.filter(l => l.status === 'realizado').forEach(l => {
      const mes = l.data.slice(0, 7); // Formato YYYY-MM
      if (!dataMap[mes]) {
        dataMap[mes] = { receita: 0, custo: 0, despesa: 0, outros: 0 };
      }
      const cat = getDRECategory(l.planoContaId);
      if (cat === 'receita') dataMap[mes].receita += l.valor;
      else if (cat === 'custo') dataMap[mes].custo += l.valor;
      else if (cat === 'despesa') dataMap[mes].despesa += l.valor;
      else dataMap[mes].outros += l.tipo === 'receita' ? l.valor : -l.valor;
    });

    const ordenado = Object.entries(dataMap)
      .map(([mes, valores]) => {
        const margemContrib = valores.receita - valores.custo;
        const margemContribPct = valores.receita > 0 ? (margemContrib / valores.receita) * 100 : 100;
        const ebitda = margemContrib - valores.despesa;
        const resultadoLiquido = ebitda + valores.outros;

        return {
          mes,
          receita: valores.receita,
          custo: valores.custo,
          margemContrib,
          margemContribPct,
          despesa: valores.despesa,
          ebitda,
          outros: valores.outros,
          resultadoLiquido
        };
      })
      .sort((a, b) => b.mes.localeCompare(a.mes))
      .slice(0, 6); // exibe até os últimos 6 meses

    return ordenado;
  }, [lancamentos, getDRECategory]);

  // Médias operacionais recentes (últimos 3 meses ou total)
  const mediasRecentes = useMemo(() => {
    const ultimosMeses = dreMeses.slice(0, 3);
    const len = ultimosMeses.length || 1;
    const receitaMed = ultimosMeses.reduce((acc, m) => acc + m.receita, 0) / len;
    const custoMed = ultimosMeses.reduce((acc, m) => acc + m.custo, 0) / len;
    const despesaMed = ultimosMeses.reduce((acc, m) => acc + m.despesa, 0) / len;
    return { receitaMed, custoMed, despesaMed };
  }, [dreMeses]);

  // --- 2. CÁLCULOS DE CAPITAL DE GIRO (PMR, PMP, NCG) ---
  const prazosOriginais = useMemo(() => {
    // PMR (Prazo Médio de Recebimento)
    const receitasComCriacao = lancamentos.filter(l => l.tipo === 'receita' && l.status === 'realizado' && l.createdAt);
    let totalPmrDays = 0;
    let pmrCount = 0;
    receitasComCriacao.forEach(l => {
      const created = new Date(l.createdAt.split('T')[0]);
      const payDate = new Date(l.data);
      const diff = Math.ceil((payDate.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      if (diff >= 0 && diff < 365) {
        totalPmrDays += diff;
        pmrCount++;
      }
    });
    const pmr = pmrCount > 0 ? Math.round(totalPmrDays / pmrCount) : 30; // fallback 30 dias

    // PMP (Prazo Médio de Pagamento)
    const despesasComCriacao = lancamentos.filter(l => l.tipo === 'despesa' && l.status === 'realizado' && l.createdAt);
    let totalPmpDays = 0;
    let pmpCount = 0;
    despesasComCriacao.forEach(l => {
      const created = new Date(l.createdAt.split('T')[0]);
      const payDate = new Date(l.data);
      const diff = Math.ceil((payDate.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      if (diff >= 0 && diff < 365) {
        totalPmpDays += diff;
        pmpCount++;
      }
    });
    const pmp = pmpCount > 0 ? Math.round(totalPmpDays / pmpCount) : 15; // fallback 15 dias

    // NCG (Necessidade de Capital de Giro) original
    const fatDiario = mediasRecentes.receitaMed / 30;
    const ncg = fatDiario * (pmr - pmp);

    return { pmr, pmp, ncg };
  }, [lancamentos, mediasRecentes]);

  // Cálculos simulados com base nas alterações dos sliders
  const simulacoes = useMemo(() => {
    const pmrSim = Math.max(0, prazosOriginais.pmr + simPmrShift);
    const pmpSim = Math.max(0, prazosOriginais.pmp + simPmpShift);
    const recSim = mediasRecentes.receitaMed * (1 + simReceitasDelta / 100);
    const fatDiarioSim = recSim / 30;
    
    // NCG simulado
    const ncgSim = fatDiarioSim * (pmrSim - pmpSim);
    // Variação de NCG a ser financiada imediatamente (desembolso de caixa)
    const ncgDelta = ncgSim - prazosOriginais.ncg;

    return { pmrSim, pmpSim, ncgSim, ncgDelta };
  }, [prazosOriginais, mediasRecentes, simPmrShift, simPmpShift, simReceitasDelta]);

  // --- 3. PONTO DE EQUILÍBRIO (BREAK-EVEN) ---
  const breakEven = useMemo(() => {
    const ultimosMeses = dreMeses.slice(0, 3);
    const totalRec = ultimosMeses.reduce((acc, m) => acc + m.receita, 0);
    const totalCusto = ultimosMeses.reduce((acc, m) => acc + m.custo, 0);
    
    const margemContribPct = totalRec > 0 ? ((totalRec - totalCusto) / totalRec) : 1;
    const custosFixosMed = mediasRecentes.despesaMed;

    const pontoEquilibrio = margemContribPct > 0 ? (custosFixosMed / margemContribPct) : 0;
    
    return {
      pontoEquilibrio,
      margemContribPct,
      custosFixosMed
    };
  }, [dreMeses, mediasRecentes]);

  // --- 4. RUNWAY (CUSTO FIXO DE SOBREVIVÊNCIA) ---
  const runway = useMemo(() => {
    const caixaTotal = portadores.reduce((acc, p) => acc + store.getSaldoPortador(p.id, p.empresaId), 0);
    const CFMed = breakEven.custosFixosMed || 1;
    const mesesRunway = caixaTotal / CFMed;
    return {
      caixaTotal,
      mesesRunway
    };
  }, [portadores, breakEven]);

  const companyName = useMemo(() => {
    const activeCompany = empresas.find(x => x.id === empresaId);
    return activeCompany?.razaoSocial || (empresaId.startsWith('grupo:') ? `Grupo Consolidado ${empresaId.split(':')[1]}` : 'Cliente');
  }, [empresas, empresaId]);

  // --- 5. GRÁFICO DE PROJEÇÃO DE CAIXA DE 6 MESES (BASELINE VS SIMULADO) ---
  const projecoesData = useMemo(() => {
    const dataList = [];
    let caixaBaseline = runway.caixaTotal;
    let caixaSimulado = runway.caixaTotal - simulacoes.ncgDelta; // deduz o ajuste de NCG simulado no 1º mês

    const hoje = new Date();
    
    // Operação mensal original
    const receitaOriginal = mediasRecentes.receitaMed;
    const despesasOriginal = mediasRecentes.custoMed + mediasRecentes.despesaMed;
    const resultadoOriginal = receitaOriginal - despesasOriginal;

    // Operação mensal simulada
    const receitaSimulada = mediasRecentes.receitaMed * (1 + simReceitasDelta / 100);
    const despesasSimuladas = (mediasRecentes.custoMed * (1 + simCustosDelta / 100)) + (mediasRecentes.despesaMed * (1 + simCustosDelta / 100));
    const resultadoSimulado = receitaSimulada - despesasSimuladas;

    // Mês atual
    dataList.push({
      name: 'Atual',
      'Saldo Baseline': Math.round(caixaBaseline),
      'Saldo Simulado': Math.round(caixaBaseline)
    });

    for (let i = 1; i <= 6; i++) {
      const futuro = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      const name = futuro.toLocaleString('pt-BR', { month: 'short' }) + '/' + futuro.getFullYear().toString().slice(2);
      
      caixaBaseline += resultadoOriginal;
      caixaSimulado += resultadoSimulado;

      dataList.push({
        name,
        'Saldo Baseline': Math.round(caixaBaseline),
        'Saldo Simulado': Math.round(caixaSimulado)
      });
    }

    return dataList;
  }, [runway, mediasRecentes, simulacoes, simReceitasDelta, simCustosDelta]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Inteligência Financeira</div>
          <div className="page-subtitle">Análise avançada de rentabilidade, capital de giro e simulador de cenários</div>
        </div>
      </div>

      <div className="page-body">
        {/* Abas */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border-light)', paddingBottom: 12 }}>
          <button className={`btn ${activeTab === 'geral' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('geral')}>
            📊 Projeções & Simulador
          </button>
          <button className={`btn ${activeTab === 'dre' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('dre')}>
            📋 DRE por Competência
          </button>
          <button className={`btn ${activeTab === 'capital' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('capital')}>
            ⛓️ Capital de Giro (NCG)
          </button>
          <button className={`btn ${activeTab === 'chat' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('chat')}>
            💬 Privilege AI Copilot
          </button>
        </div>

        {activeTab === 'geral' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)', gap: 20 }}>
            {/* Gráfico de Projeção */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16 }}>Simulador de Cenários (Projeção de Caixa de 6 Meses)</h3>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Projetado com base nas médias operacionais</span>
              </div>

              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={projecoesData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="name" stroke="var(--text-muted)" style={{ fontSize: 11 }} />
                    <YAxis stroke="var(--text-muted)" style={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => fmt.currency(value as number)} />
                    <Legend />
                    <Line type="monotone" dataKey="Saldo Baseline" stroke="#64748b" strokeWidth={2} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="Saldo Simulado" stroke="var(--primary)" strokeWidth={3} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div style={{ borderTop: '1px solid var(--border-light)', marginTop: 20, paddingTop: 16 }}>
                <h4 style={{ fontSize: 13, marginBottom: 16, color: 'var(--text-secondary)' }}>Ajuste os parâmetros para simular novos cenários operacionais:</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                      <span>Variação de Receitas</span>
                      <strong style={{ color: simReceitasDelta >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {simReceitasDelta >= 0 ? '+' : ''}{simReceitasDelta}%
                      </strong>
                    </div>
                    <input 
                      type="range" 
                      min="-50" 
                      max="50" 
                      value={simReceitasDelta} 
                      onChange={e => setSimReceitasDelta(Number(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--primary)' }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                      <span>Variação de Custos & Despesas</span>
                      <strong style={{ color: simCustosDelta <= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {simCustosDelta >= 0 ? '+' : ''}{simCustosDelta}%
                      </strong>
                    </div>
                    <input 
                      type="range" 
                      min="-50" 
                      max="50" 
                      value={simCustosDelta} 
                      onChange={e => setSimCustosDelta(Number(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--primary)' }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                      <span>Alteração no Recebimento (PMR)</span>
                      <strong style={{ color: simPmrShift <= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {simPmrShift >= 0 ? '+' : ''}{simPmrShift} dias
                      </strong>
                    </div>
                    <input 
                      type="range" 
                      min="-30" 
                      max="30" 
                      value={simPmrShift} 
                      onChange={e => setSimPmrShift(Number(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--primary)' }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                      <span>Alteração no Pagamento (PMP)</span>
                      <strong style={{ color: simPmpShift >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {simPmpShift >= 0 ? '+' : ''}{simPmpShift} dias
                      </strong>
                    </div>
                    <input 
                      type="range" 
                      min="-30" 
                      max="30" 
                      value={simPmpShift} 
                      onChange={e => setSimPmpShift(Number(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--primary)' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Métricas e Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Card de Runway */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 24 }}>⏳</span>
                  <div>
                    <h4 style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0 }}>Cofre de Sobrevivência (Runway)</h4>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Média baseada nas despesas fixas</span>
                  </div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: runway.mesesRunway >= 3 ? 'var(--green)' : '#d97706', margin: '8px 0' }}>
                  {runway.mesesRunway === Infinity ? 'Sem custos fixos' : runway.mesesRunway.toFixed(1) + ' meses'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  A empresa dispõe de um caixa total de <strong>{fmt.currency(runway.caixaTotal)}</strong> para cobrir sua estrutura média fixa sem novas receitas.
                </div>
              </div>

              {/* Card de Ponto de Equilíbrio */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 24 }}>⚖️</span>
                  <div>
                    <h4 style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0 }}>Ponto de Equilíbrio (Break-Even)</h4>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Faturamento operacional necessário</span>
                  </div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', margin: '8px 0' }}>
                  {fmt.currency(breakEven.pontoEquilibrio)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Margem de contribuição média de <strong>{Math.round(breakEven.margemContribPct * 100)}%</strong>. Faturamento diário necessário médio: <strong>{fmt.currency(breakEven.pontoEquilibrio / 30)}</strong>.
                </div>
              </div>

              {/* NCG Card de Impacto */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 24 }}>⛓️</span>
                  <div>
                    <h4 style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0 }}>Necessidade de Giro (Simulado)</h4>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Impacto imediato no fluxo de caixa</span>
                  </div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: simulacoes.ncgDelta <= 0 ? 'var(--green)' : 'var(--red)', margin: '8px 0' }}>
                  {simulacoes.ncgDelta > 0 ? '+' : ''}{fmt.currency(simulacoes.ncgDelta)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  A alteração proposta nos prazos de recebimento e pagamento demanda uma injeção de capital de <strong>{fmt.currency(simulacoes.ncgSim)}</strong> no caixa (anterior: {fmt.currency(prazosOriginais.ncg)}).
                </div>
              </div>
            </div>

            {/* Bloco de Inteligência Artificial para Simulação */}
            <div className="card" style={{ gridColumn: 'span 2', marginTop: 8, background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(96,0,0,0.02) 100%)', border: '1px solid rgba(96,0,0,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)' }}>
                    <span>🧠</span> Inteligência Artificial do Simulador
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                    Gere recomendações contábeis e financeiras automáticas de acordo com os parâmetros simulados nos sliders.
                  </p>
                </div>
                <button 
                  className="btn btn-primary" 
                  onClick={generateAISimulationInsights}
                  disabled={aiLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  {aiLoading ? '⏳ Analisando...' : '🔮 Analisar Cenário com IA'}
                </button>
              </div>

              {aiInsights && (
                <div className="grid-3" style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border-light)' }}>
                  {aiInsights.map((insight, idx) => (
                    <div key={idx} className="card" style={{ background: 'var(--bg-card2)', borderRadius: 8, border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: 8, padding: 16, margin: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 20 }}>{insight.icon}</span>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>{insight.title}</h4>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{insight.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {activeTab === 'dre' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 16, margin: 0 }}>Demonstrativo do Resultado do Exercício (Histórico Recente)</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Exibição baseada no regime de competência (data dos eventos realizados)</p>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Conta DRE</th>
                    {dreMeses.map(m => (
                      <th key={m.mes} style={{ textAlign: 'right' }}>{m.mes}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 600 }}>(+) Receita Operacional Bruta</td>
                    {dreMeses.map(m => (
                      <td key={m.mes} style={{ textAlign: 'right', color: 'var(--green)' }}>{fmt.currency(m.receita)}</td>
                    ))}
                  </tr>
                  <tr>
                    <td style={{ color: 'var(--text-secondary)', paddingLeft: 24 }}>(-) Custos Operacionais (Variáveis)</td>
                    {dreMeses.map(m => (
                      <td key={m.mes} style={{ textAlign: 'right', color: 'var(--red)' }}>-{fmt.currency(m.custo)}</td>
                    ))}
                  </tr>
                  <tr style={{ background: 'var(--bg-card2)', fontWeight: 600 }}>
                    <td>(=) Margem de Contribuição</td>
                    {dreMeses.map(m => (
                      <td key={m.mes} style={{ textAlign: 'right' }}>{fmt.currency(m.margemContrib)}</td>
                    ))}
                  </tr>
                  <tr style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    <td style={{ paddingLeft: 24 }}>Margem de Contribuição (%)</td>
                    {dreMeses.map(m => (
                      <td key={m.mes} style={{ textAlign: 'right' }}>{m.margemContribPct.toFixed(1)}%</td>
                    ))}
                  </tr>
                  <tr>
                    <td style={{ color: 'var(--text-secondary)', paddingLeft: 24 }}>(-) Despesas Operacionais (Fixas)</td>
                    {dreMeses.map(m => (
                      <td key={m.mes} style={{ textAlign: 'right', color: 'var(--red)' }}>-{fmt.currency(m.despesa)}</td>
                    ))}
                  </tr>
                  <tr style={{ background: 'var(--border-light)', fontWeight: 700 }}>
                    <td>(=) EBITDA</td>
                    {dreMeses.map(m => (
                      <td key={m.mes} style={{ textAlign: 'right', color: 'var(--primary)' }}>{fmt.currency(m.ebitda)}</td>
                    ))}
                  </tr>
                  <tr>
                    <td style={{ color: 'var(--text-muted)', paddingLeft: 24 }}>(+/-) Outras Receitas / Despesas (Financiamento / Investimento)</td>
                    {dreMeses.map(m => (
                      <td key={m.mes} style={{ textAlign: 'right', color: m.outros >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {m.outros >= 0 ? '+' : ''}{fmt.currency(m.outros)}
                      </td>
                    ))}
                  </tr>
                  <tr style={{ background: 'var(--bg-card)', fontWeight: 800, borderTop: '2px solid var(--primary)' }}>
                    <td>(=) Resultado Líquido</td>
                    {dreMeses.map(m => (
                      <td key={m.mes} style={{ textAlign: 'right', color: m.resultadoLiquido >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {fmt.currency(m.resultadoLiquido)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'capital' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* PMR / PMP Cards */}
            <div className="card">
              <h3 style={{ fontSize: 15, marginBottom: 16 }}>Prazos Médios Operacionais</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ padding: 16, background: 'var(--bg-card2)', borderRadius: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Prazo Médio de Recebimento (PMR)</span>
                    <strong style={{ fontSize: 15 }}>{prazosOriginais.pmr} dias</strong>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                    Média de dias entre o cadastro de uma venda/receita e o recebimento efetivo no caixa.
                  </p>
                </div>

                <div style={{ padding: 16, background: 'var(--bg-card2)', borderRadius: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Prazo Médio de Pagamento (PMP)</span>
                    <strong style={{ fontSize: 15 }}>{prazosOriginais.pmp} dias</strong>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                    Média de dias de prazo que a empresa usufrui para pagar seus fornecedores e despesas operacionais.
                  </p>
                </div>

                <div style={{ padding: 16, background: 'var(--border-light)', borderRadius: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Ciclo Financeiro (Ciclo de Caixa)</span>
                    <strong style={{ fontSize: 15, color: prazosOriginais.pmr - prazosOriginais.pmp >= 0 ? 'var(--red)' : 'var(--green)' }}>
                      {prazosOriginais.pmr - prazosOriginais.pmp} dias
                    </strong>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                    Espaço de tempo em dias que a empresa precisa financiar seus custos operacionais antes de receber o dinheiro de suas vendas.
                  </p>
                </div>
              </div>
            </div>

            {/* NCG Analysis */}
            <div className="card">
              <h3 style={{ fontSize: 15, marginBottom: 16 }}>Necessidade de Capital de Giro (NCG)</h3>
              
              <div style={{ textAlign: 'center', padding: '24px 0', borderBottom: '1px solid var(--border-light)', marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Necessidade Estimada</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: prazosOriginais.ncg >= 0 ? 'var(--red)' : 'var(--green)', margin: '8px 0' }}>
                  {fmt.currency(prazosOriginais.ncg)}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: '80%', margin: '0 auto' }}>
                  Com base no faturamento médio mensal, este é o saldo operacional de liquidez necessário para manter a empresa saudável.
                </p>
              </div>

              <div>
                <h4 style={{ fontSize: 13, marginBottom: 12 }}>Diagnóstico do Consultor:</h4>
                {prazosOriginais.ncg > 0 ? (
                  <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 8, fontSize: 12, color: '#b91c1c', lineHeight: '1.5' }}>
                    ⚠️ <strong>Atenção:</strong> Seu ciclo financeiro é positivo. A empresa precisa adiantar <strong>{prazosOriginais.pmr - prazosOriginais.pmp} dias</strong> de recursos antes do recebimento. Recomenda-se negociar prazos maiores com fornecedores ou acelerar o recebimento de clientes (ex: PIX/Antecipações).
                  </div>
                ) : (
                  <div style={{ padding: 12, background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 8, fontSize: 12, color: '#15803d', lineHeight: '1.5' }}>
                    ✓ <strong>Excelente:</strong> Ciclo financeiro negativo. Os fornecedores estão financiando a sua operação em <strong>{Math.abs(prazosOriginais.pmr - prazosOriginais.pmp)} dias</strong>. O faturamento entra em caixa antes do vencimento médio dos pagamentos.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)', gap: 20 }}>
            {/* Chat Container */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '620px', padding: 0, overflow: 'hidden', border: '1px solid var(--border-light)', background: 'var(--bg-card)' }}>
              
              {/* Chat Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-card2)' }}>
                <span style={{ fontSize: 24 }}>💬</span>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>Privilege AI Copilot</h3>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>CFO Virtual de Elite — Conectado em tempo real ao seu caixa</span>
                </div>
              </div>

              {/* Messages List */}
              <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {chatMessages.map((msg, index) => {
                  const isAi = msg.sender === 'ai';
                  return (
                    <div key={index} style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isAi ? 'flex-start' : 'flex-end',
                      maxWidth: '85%',
                      alignSelf: isAi ? 'flex-start' : 'flex-end',
                      gap: 4
                    }}>
                      <div style={{
                        padding: '12px 16px',
                        borderRadius: isAi ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
                        background: isAi ? 'var(--bg-card2)' : 'var(--primary)',
                        color: isAi ? 'var(--text-main)' : '#ffffff',
                        border: isAi ? '1px solid var(--border-light)' : 'none',
                        boxShadow: 'var(--shadow-sm)',
                        fontSize: 13,
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap'
                      }}>
                        {msg.text}
                      </div>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', margin: '0 4px' }}>
                        {msg.timestamp}
                      </span>
                    </div>
                  );
                })}
                {chatLoading && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    alignSelf: 'flex-start',
                    background: 'var(--bg-card2)',
                    padding: '12px 16px',
                    borderRadius: '16px 16px 16px 4px',
                    border: '1px solid var(--border-light)',
                    fontSize: 13,
                    color: 'var(--text-muted)'
                  }}>
                    <span className="animate-pulse">🧠 Analisando dados da empresa...</span>
                  </div>
                )}
              </div>

              {/* Chat Input Footer */}
              <div style={{ padding: 16, borderTop: '1px solid var(--border-light)', background: 'var(--bg-card2)' }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Digite sua dúvida ou simulação financeira..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    disabled={chatLoading}
                    style={{ fontSize: 13 }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !chatLoading) {
                        sendChatMessage(chatInput);
                      }
                    }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={() => sendChatMessage(chatInput)}
                    disabled={chatLoading || !chatInput.trim()}
                    style={{ padding: '0 20px', fontSize: 13 }}
                  >
                    Enviar
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar of the Chat: Key Metrics & Suggestions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Quick Suggestions */}
              <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>💡</span> Sugestões Rápidas
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ textAlign: 'left', fontSize: 12, justifyContent: 'flex-start', padding: '8px 12px' }}
                    onClick={() => {
                      setChatInput('O que acontece se eu perder 20% das minhas receitas nos próximos meses?');
                    }}
                  >
                    📉 Cenário: Perda de 20% de Receita
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ textAlign: 'left', fontSize: 12, justifyContent: 'flex-start', padding: '8px 12px' }}
                    onClick={() => {
                      setChatInput('Qual é o meu ponto de equilíbrio (Break-Even) e como posso melhorá-lo?');
                    }}
                  >
                    ⚖️ Como melhorar meu Break-Even?
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ textAlign: 'left', fontSize: 12, justifyContent: 'flex-start', padding: '8px 12px' }}
                    onClick={() => {
                      setChatInput('Analise a necessidade de capital de giro (NCG) simulada. Que ações devo tomar?');
                    }}
                  >
                    ⛓️ Diagnóstico de Capital de Giro (NCG)
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ textAlign: 'left', fontSize: 12, justifyContent: 'flex-start', padding: '8px 12px' }}
                    onClick={() => {
                      setChatInput('Qual é o runway da empresa em meses e que medidas garantem mais estabilidade?');
                    }}
                  >
                    ⏳ Análise de Sobrevivência (Runway)
                  </button>
                </div>
              </div>

              {/* Sidebar Summary Card */}
              <div className="card" style={{ background: 'linear-gradient(135deg, rgba(96,0,0,0.02) 0%, var(--bg-card) 100%)', border: '1px solid var(--border-light)' }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📊</span> Resumo de Contexto
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderBottom: '1px solid var(--border-light)', paddingBottom: 6 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Empresa Ativa:</span>
                    <strong style={{ maxWidth: '160px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={companyName}>{companyName}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderBottom: '1px solid var(--border-light)', paddingBottom: 6 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Saldo em Caixa:</span>
                    <strong>{fmt.currency(runway.caixaTotal)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderBottom: '1px solid var(--border-light)', paddingBottom: 6 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Break-Even:</span>
                    <strong>{fmt.currency(breakEven.pontoEquilibrio)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderBottom: '1px solid var(--border-light)', paddingBottom: 6 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Runway:</span>
                    <strong style={{ color: runway.mesesRunway >= 3 ? 'var(--green)' : '#d97706' }}>
                      {runway.mesesRunway === Infinity ? 'Sem custos' : runway.mesesRunway.toFixed(1) + ' meses'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderBottom: '1px solid var(--border-light)', paddingBottom: 6 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Ciclo Financeiro:</span>
                    <strong style={{ color: prazosOriginais.pmr - prazosOriginais.pmp >= 0 ? 'var(--red)' : 'var(--green)' }}>
                      {prazosOriginais.pmr - prazosOriginais.pmp} dias
                    </strong>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </>
  );
}
