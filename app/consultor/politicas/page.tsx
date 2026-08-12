'use client';

import { useState, useEffect, useCallback } from 'react';
import { store, Empresa, InteligenciaDoc } from '../../../lib/store';
import { fmt } from '../../../lib/reports';

type PolicyType = 'receber' | 'cobranca' | 'compras' | 'pagamentos' | 'credito';

const POLICY_INFO = {
  receber: {
    title: 'Política de Contas a Receber',
    field: 'politicaReceberTexto' as const,
    icon: '💵',
    description: 'Define as regras de faturamento, prazos de pagamento aceitos, emissão de boletos, formas de recebimento (PIX, cartão, boleto) e conciliação de entradas.',
    placeholder: 'Insira aqui as diretrizes de contas a receber da empresa...'
  },
  cobranca: {
    title: 'Política de Cobrança',
    field: 'politicaCobrancaTexto' as const,
    icon: '⚖️',
    description: 'Diretrizes para tratamento de inadimplência, régua de cobrança (lembrete prévio, aviso de atraso, notificação extrajudicial), negociações, parcelamentos de dívidas e incidência de juros/multas.',
    placeholder: 'Insira aqui as diretrizes de cobrança da empresa...'
  },
  compras: {
    title: 'Política de Compras',
    field: 'politicaComprasTexto' as const,
    icon: '🛒',
    description: 'Regulamenta o processo de homologação de fornecedores, cotações obrigatórias, limites de alçadas de aprovação, prazos mínimos de pagamento exigidos e ordens de compra.',
    placeholder: 'Insira aqui as diretrizes de compras e suprimentos da empresa...'
  },
  pagamentos: {
    title: 'Política de Pagamentos',
    field: 'politicaPagamentosTexto' as const,
    icon: '💸',
    description: 'Define os dias da semana para pagamentos operacionais, fluxo de aprovação de notas fiscais, reembolso de despesas de funcionários, chaves Pix corporativas e conciliação de saídas.',
    placeholder: 'Insira aqui as diretrizes de pagamentos e desembolsos da empresa...'
  },
  credito: {
    title: 'Política de Crédito',
    field: 'politicaCreditoTexto' as const,
    icon: '🎯',
    description: 'Estabelece os critérios para análise e concessão de limite de crédito para novos clientes, score de risco aceitável, documentação exigida e garantias para faturamento parcelado.',
    placeholder: 'Insira aqui as diretrizes de concessão de crédito da empresa...'
  }
};

export default function PoliticasFinanceirasPage() {
  const [empresaId, setEmpresaId] = useState('');
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [activeTab, setActiveTab] = useState<PolicyType>('receber');
  const [policyText, setPolicyText] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiDraft, setAiDraft] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback((eId: string) => {
    if (!eId) return;
    setEmpresaId(eId);
    const all = store.getEmpresas();
    setEmpresas(all);

    const globalPols = store.getGlobalPolicies();
    const field = POLICY_INFO[activeTab].field;
    setPolicyText(globalPols[field] || '');
    setAiDraft('');
  }, [activeTab]);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || '';
    if (saved) {
      load(saved);
    } else {
      const all = store.getEmpresas();
      if (all.length > 0) {
        load(all[0].id);
      }
    }

    const handler = (e: Event) => load((e as CustomEvent).detail);
    const dataChangeHandler = () => {
      const current = sessionStorage.getItem('cf_empresa_sel') || store.getEmpresas()[0]?.id || '';
      if (current) load(current);
    };
    window.addEventListener('empresaChange', handler);
    window.addEventListener('cfDataChange', dataChangeHandler);
    return () => {
      window.removeEventListener('empresaChange', handler);
      window.removeEventListener('cfDataChange', dataChangeHandler);
    };
  }, [load]);

  // Atualiza o texto do editor quando a aba mudar
  useEffect(() => {
    const globalPols = store.getGlobalPolicies();
    const field = POLICY_INFO[activeTab].field;
    setPolicyText(globalPols[field] || '');
    setAiDraft('');
  }, [activeTab]);

  const handleSave = () => {
    const field = POLICY_INFO[activeTab].field;
    store.saveGlobalPolicy(field, policyText);
    
    if (empresaId) {
      store.logAction(empresaId, 'Edição', `Atualizou a ${POLICY_INFO[activeTab].title} (Global)`);
    }
    alert('Política salva com sucesso!');
  };

  const handleGenerateAI = async () => {
    if (!empresaId) return;
    setLoading(true);
    setAiDraft('');

    const activeCompany = empresas.find(e => e.id === empresaId);
    const companyName = activeCompany?.razaoSocial || 'Cliente';
    const segment = activeCompany?.atividade || 'Serviços/Comércio';

    // Recupera base de conhecimento de inteligência financeira
    const intelDocs = store.getInteligenciaDocs();
    const docsContext = intelDocs.length > 0
      ? `\nDIRETRIZES DA BASE DE CONHECIMENTO COMPARTILHADA:\n` + 
        intelDocs.map(doc => `- ${doc.name}: ${doc.type.includes('text') || doc.name.endsWith('.txt') || doc.name.endsWith('.json') || doc.name.endsWith('.csv') ? doc.content.slice(0, 1500) : '[Arquivo Binário/PDF Carregado]'}`).join('\n')
      : '';

    const currentTextContext = policyText 
      ? `\nRASCUNHO/POLÍTICA ATUAL EXISTENTE:\n${policyText}\n`
      : '';

    const prompt = `Você é o robô Privilege AI, consultor financeiro de elite do escritório Privilege Consultoria.
Você foi contratado para redigir ou aprimorar a "${POLICY_INFO[activeTab].title}" para a empresa "${companyName}" (Segmento: ${segment}).

INSTRUÇÕES DO CONSULTOR FINANCEIRO (O QUE A POLÍTICA DEVE CONTER):
${aiPrompt || 'Gere uma política padrão robusta, formal e completa para esta finalidade, adequada ao segmento da empresa.'}
${currentTextContext}
${docsContext}

DADOS FINANCEIROS RECENTES DE REFERÊNCIA:
- Receita Mensal Estimada: R$ ${(activeCompany?.receitaMensalEstimada || 0).toLocaleString('pt-BR')}
- Compras Mensais Estimadas: R$ ${(activeCompany?.comprasMensalEstimada || 0).toLocaleString('pt-BR')}

REGRAS DE FORMATAÇÃO E ESTRUTURA:
1. Retorne um documento profissional formal, completo, muito bem estruturado com seções numeradas (Ex: 1. Objetivo, 2. Diretrizes Gerais, 3. Processos Operacionais, 4. Alçadas e Limites, 5. Disposições Finais).
2. Não utilize cabeçalhos extras de markdown como \`\`\`markdown ou blocos de código. Comece diretamente pelo texto do documento.
3. Seja detalhado e específico. Evite termos vagos.
4. Responda em Português do Brasil de forma extremamente polida e técnica.`;

    const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyApsKGqQWqF6LeABZG2fNdzXp4G9_wTq6s';

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          setAiDraft(text.trim());
        } else {
          alert('Não foi possível obter uma resposta estruturada do Gemini AI.');
        }
      } else {
        throw new Error('Erro na chamada da API');
      }
    } catch (err) {
      console.error(err);
      // Fallback
      setAiDraft(`--- RASCUNHO AUTOMÁTICO DE SEGURANÇA (FALHA DE CONEXÃO API) ---

${POLICY_INFO[activeTab].title.toUpperCase()}
EMPRESA: ${companyName}
SEGMENTO: ${segment}

1. OBJETIVO
Definir as diretrizes gerais de ${POLICY_INFO[activeTab].title.toLowerCase()} aplicáveis à instituição, visando segurança jurídica, liquidez e controle do fluxo de caixa.

2. DIRETRIZES GERAIS
- As operações devem respeitar as alçadas financeiras pré-aprovadas.
- Todas as transações precisam ser documentalmente comprovadas com nota fiscal ou contrato.
- Devem-se aplicar as orientações gerais de controle interno do escritório Privilege Consultoria.

3. PROCESSAMENTO DE INFORMAÇÕES
Com base nas solicitações fornecidas: "${aiPrompt || 'Políticas de conformidade padrão'}".

Documento gerado em caráter contingencial.`);
    } finally {
      setLoading(false);
    }
  };

  const applyDraft = () => {
    if (!aiDraft) return;
    setPolicyText(aiDraft);
    setAiDraft('');
    setAiPrompt('');
  };

  const handlePrint = () => {
    window.print();
  };

  const activeCompany = empresas.find(e => e.id === empresaId);

  return (
    <>
      {/* Header — Oculto na Impressão */}
      <div className="page-header no-print">
        <div>
          <div className="page-title">Políticas Financeiras</div>
          <div className="page-subtitle">Rascunhe, gere com IA e documente as estratégias da empresa</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={handlePrint}>🖨️ Imprimir / PDF</button>
          <button className="btn btn-primary" onClick={handleSave}>💾 Salvar Política</button>
        </div>
      </div>

      <div className="page-body">
        {/* Layout de duas colunas (Esquerda: Abas e Editor | Direita: IA Generativa) */}
        <div className="grid-21 no-print" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1.2fr)', gap: 20 }}>
          
          {/* Coluna Esquerda: Abas e Editor */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Seletor de Abas das Políticas */}
            <div className="card" style={{ padding: '12px 20px' }}>
              <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
                {(Object.keys(POLICY_INFO) as PolicyType[]).map(key => {
                  const info = POLICY_INFO[key];
                  const isActive = activeTab === key;
                  return (
                    <button 
                      key={key} 
                      className={`tab ${isActive ? 'active' : ''}`}
                      onClick={() => setActiveTab(key)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 8, 
                        background: 'none', 
                        border: 'none', 
                        padding: '10px 14px', 
                        cursor: 'pointer' 
                      }}
                    >
                      <span style={{ fontSize: 16 }}>{info.icon}</span>
                      <span>{info.title.replace('Política de ', '')}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Document Editor Canvas */}
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '520px' }}>
              <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: 16, marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                  <span>{POLICY_INFO[activeTab].icon}</span>
                  {POLICY_INFO[activeTab].title}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {POLICY_INFO[activeTab].description}
                </p>
              </div>

              {/* Textarea de Edição */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <textarea
                  className="form-control"
                  style={{ 
                    flex: 1, 
                    width: '100%', 
                    minHeight: '400px', 
                    fontFamily: 'Courier New, Courier, monospace', 
                    fontSize: 13, 
                    lineHeight: '1.6', 
                    padding: 16, 
                    borderRadius: 8, 
                    border: '1px solid var(--border)',
                    resize: 'vertical',
                    background: 'var(--bg-card2)'
                  }}
                  value={policyText}
                  onChange={e => setPolicyText(e.target.value)}
                  placeholder={POLICY_INFO[activeTab].placeholder}
                />
              </div>
            </div>

          </div>

          {/* Coluna Direita: Privilege AI Copilot Generator */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            <div className="card" style={{ borderColor: 'var(--accent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>🤖</span>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>Privilege AI Copilot</h3>
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: '1.4' }}>
                Forneça tópicos, regras ou orientações específicas. A inteligência artificial irá redigir um documento profissional formal com base na saúde da empresa e nas diretrizes enviadas.
              </p>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Diretrizes da sua política (Opcional)</label>
                <textarea
                  className="form-control"
                  style={{ minHeight: '120px', fontSize: 12, resize: 'vertical' }}
                  placeholder="Ex: Quero estabelecer que compras acima de R$ 5.000 precisam de 3 orçamentos e aprovação do diretor financeiro. Prazos de pagamento devem ser de no mínimo 30 dias..."
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                />
              </div>

              <button 
                className="btn btn-primary" 
                onClick={handleGenerateAI}
                disabled={loading}
                style={{ width: '100%', justifyContent: 'center', background: 'var(--accent)' }}
              >
                {loading ? '⏳ Elaborando Rascunho...' : '✨ Gerar com IA'}
              </button>

              {aiDraft && (
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
                  <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>📝 Rascunho Sugerido</span>
                    <button className="badge badge-green" onClick={applyDraft} style={{ border: 'none', cursor: 'pointer' }}>
                      ✓ Aplicar no Editor
                    </button>
                  </h4>
                  <div 
                    style={{ 
                      maxHeight: '260px', 
                      overflowY: 'auto', 
                      background: 'var(--bg-card2)', 
                      border: '1px solid var(--border-light)', 
                      borderRadius: 8, 
                      padding: 12, 
                      fontSize: 11.5, 
                      lineHeight: '1.5',
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace'
                    }}
                  >
                    {aiDraft}
                  </div>
                </div>
              )}
            </div>

            {/* Dicas Rápidas Contábeis */}
            <div className="card">
              <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>💡 Dicas de Elaboração</h4>
              <ul style={{ paddingLeft: 16, fontSize: 11, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 8, lineHeight: '1.4' }}>
                <li><strong>Especificidade:</strong> Adicione valores numéricos exatos para limites de crédito ou alçadas.</li>
                <li><strong>Prazos:</strong> Alinhe o Prazo Médio de Recebimento (PMR) com o de Pagamento (PMP) para garantir capital de giro saudável.</li>
                <li><strong>Base de Conhecimento:</strong> Suba manuais corporativos ou diretrizes do banco no Painel Administrativo para a IA incorporar nos rascunhos.</li>
              </ul>
            </div>

          </div>
        </div>

        {/* Layout para Impressão (Focado exclusivamente no Papel/Visualização limpa) */}
        <div className="print-only-layout" style={{ display: 'none' }}>
          <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'var(--font-sans)', color: '#000', background: '#fff' }}>
            
            {/* Cabeçalho do Documento */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 20, marginBottom: 30 }}>
              {activeCompany?.logoData && (
                <img 
                  src={activeCompany.logoData === '__PRUNED_IN_LOCAL_STAGE__' ? `/api/empresas/file?id=${activeCompany.id}&type=logo` : activeCompany.logoData} 
                  alt="Logo Empresa" 
                  style={{ maxHeight: 60, maxWidth: 150, objectFit: 'contain', marginBottom: 12 }} 
                />
              )}
              <h1 style={{ fontSize: '20px', fontWeight: 800, textTransform: 'uppercase', margin: '0 0 6px 0' }}>
                {POLICY_INFO[activeTab].title}
              </h1>
              <p style={{ fontSize: '12px', margin: 0, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
                {activeCompany?.razaoSocial} • CNPJ {activeCompany?.cnpj}
              </p>
              <p style={{ fontSize: '11px', color: '#666', margin: '4px 0 0 0' }}>
                Emitido em: {new Date().toLocaleDateString('pt-BR')} • Privilege Consultoria Financeira
              </p>
            </div>

            {/* Corpo do Documento */}
            <div 
              style={{ 
                fontSize: '13px', 
                lineHeight: '1.7', 
                whiteSpace: 'pre-wrap', 
                color: '#000',
                fontFamily: 'Times New Roman, serif'
              }}
            >
              {policyText || 'Nenhuma diretriz ou rascunho de política financeira registrado até o momento para este documento.'}
            </div>

            {/* Assinaturas */}
            <div style={{ marginTop: 60, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, paddingTop: 30, borderTop: '1px dashed #ccc' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderTop: '1px solid #000', width: '200px', margin: '0 auto', marginTop: 30 }}></div>
                <p style={{ fontSize: '11px', fontWeight: 600, margin: '6px 0 0 0' }}>{activeCompany?.responsavel || 'Responsável Legal'}</p>
                <p style={{ fontSize: '10px', color: '#666', margin: 0 }}>Representante Corporativo</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderTop: '1px solid #000', width: '200px', margin: '0 auto', marginTop: 30 }}></div>
                <p style={{ fontSize: '11px', fontWeight: 600, margin: '6px 0 0 0' }}>Privilege Consultoria</p>
                <p style={{ fontSize: '10px', color: '#666', margin: 0 }}>Assessor Financeiro / CFO Adjunto</p>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* CSS para Impressão */}
      <style jsx global>{`
        @media print {
          /* Esconde tudo que não for o layout de impressão */
          .sidebar,
          .page-header,
          .no-print,
          .main-content > *:not(.print-only-layout),
          .mobile-menu-toggle {
            display: none !important;
          }
          
          body, html, .main-content, .app-layout {
            background: #fff !important;
            color: #000 !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            height: auto !important;
          }
          
          .print-only-layout {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: #fff !important;
          }
        }
      `}</style>
    </>
  );
}
