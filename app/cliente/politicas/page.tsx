'use client';

import { useState, useEffect, useCallback } from 'react';
import { store, Empresa } from '../../../lib/store';

type PolicyType = 'receber' | 'cobranca' | 'compras' | 'pagamentos' | 'credito';

const POLICY_INFO = {
  receber: {
    title: 'Política de Contas a Receber',
    field: 'politicaReceberTexto' as const,
    icon: '💵',
    description: 'Define as regras de faturamento, prazos de pagamento aceitos, emissão de boletos, formas de recebimento e conciliação de entradas.'
  },
  cobranca: {
    title: 'Política de Cobrança',
    field: 'politicaCobrancaTexto' as const,
    icon: '⚖️',
    description: 'Diretrizes para tratamento de inadimplência, régua de cobrança, negociações, parcelamentos de dívidas e incidência de juros/multas.'
  },
  compras: {
    title: 'Política de Compras',
    field: 'politicaComprasTexto' as const,
    icon: '🛒',
    description: 'Regulamenta o processo de homologação de fornecedores, cotações obrigatórias, limites de alçadas de aprovação e prazos de pagamento.'
  },
  pagamentos: {
    title: 'Política de Pagamentos',
    field: 'politicaPagamentosTexto' as const,
    icon: '💸',
    description: 'Define os dias da semana para pagamentos operacionais, fluxo de aprovação de notas fiscais e reembolso de despesas.'
  },
  credito: {
    title: 'Política de Crédito',
    field: 'politicaCreditoTexto' as const,
    icon: '🎯',
    description: 'Estabelece os critérios para análise e concessão de limite de crédito para novos clientes e garantias exigidas.'
  }
};

export default function ClientePoliticasPage() {
  const [empresaId, setEmpresaId] = useState('');
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [activeTab, setActiveTab] = useState<PolicyType>('receber');
  const [policyText, setPolicyText] = useState('');

  const load = useCallback((eId: string) => {
    if (!eId) return;
    setEmpresaId(eId);
    const all = store.getEmpresas();
    const emp = all.find(e => e.id === eId);
    if (emp) {
      setEmpresa(emp);
    } else {
      setEmpresa(null);
    }
    const globalPols = store.getGlobalPolicies();
    const field = POLICY_INFO[activeTab].field;
    setPolicyText(globalPols[field] || '');
  }, [activeTab]);

  useEffect(() => {
    const user = store.getCurrentUser();
    const defaultEmpresaId = user?.empresaIds?.[0] || store.getEmpresas()[0]?.id || '';
    const saved = sessionStorage.getItem('cf_empresa_sel') || defaultEmpresaId;
    load(saved);

    const handler = (e: Event) => load((e as CustomEvent).detail);
    const dataChangeHandler = () => {
      const current = sessionStorage.getItem('cf_empresa_sel') || defaultEmpresaId;
      load(current);
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
    if (empresaId) {
      const all = store.getEmpresas();
      const emp = all.find(e => e.id === empresaId);
      if (emp) {
        setEmpresa(emp);
      }
    }
    const globalPols = store.getGlobalPolicies();
    const field = POLICY_INFO[activeTab].field;
    setPolicyText(globalPols[field] || '');
  }, [activeTab, empresaId]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Header — Oculto na Impressão */}
      <div className="page-header no-print">
        <div>
          <div className="page-title">Políticas Financeiras</div>
          <div className="page-subtitle">Consulte as diretrizes e regras corporativas homologadas</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handlePrint}>🖨️ Imprimir / PDF</button>
        </div>
      </div>

      <div className="page-body">
        {/* Layout de Leitura (Esquerda: Abas | Direita: Visualizador de Documento) */}
        <div className="grid-21 no-print" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 3fr)', gap: 20 }}>
          
          {/* Coluna Esquerda: Abas Verticais */}
          <div className="card" style={{ padding: 12, height: 'fit-content' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                      gap: 12, 
                      background: isActive ? 'var(--accent-glow)' : 'none', 
                      border: 'none', 
                      padding: '12px 16px', 
                      cursor: 'pointer',
                      borderRadius: 8,
                      textAlign: 'left',
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? 'var(--accent-light)' : 'var(--text-secondary)'
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{info.icon}</span>
                    <span>{info.title.replace('Política de ', '')}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Coluna Direita: Canvas de Leitura de Documento */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: '520px' }}>
            <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: 16, marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                <span>{POLICY_INFO[activeTab].icon}</span>
                {POLICY_INFO[activeTab].title}
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {POLICY_INFO[activeTab].description}
              </p>
            </div>

            {/* Conteúdo do Documento */}
            {policyText ? (
              <div 
                style={{ 
                  flex: 1,
                  background: 'var(--bg-card2)', 
                  border: '1px solid var(--border-light)', 
                  borderRadius: 8, 
                  padding: '24px 30px', 
                  fontSize: 13.5, 
                  lineHeight: '1.8',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'Georgia, serif',
                  color: 'var(--text-primary)',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                {policyText}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-light)', borderRadius: 8, padding: 40, color: 'var(--text-muted)' }}>
                <span style={{ fontSize: 40, marginBottom: 12 }}>📋</span>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Sem Diretriz Homologada</h4>
                <p style={{ fontSize: 12, textAlign: 'center', maxWidth: '300px' }}>
                  Sua assessoria financeira Privilege Consultoria ainda não rascunhou a política de {POLICY_INFO[activeTab].title.toLowerCase()} para sua empresa.
                </p>
              </div>
            )}
          </div>

        </div>

        {/* Layout de Impressão Limpo */}
        <div className="print-only-layout" style={{ display: 'none' }}>
          <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'var(--font-sans)', color: '#000', background: '#fff' }}>
            
            {/* Cabeçalho de Impressão */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 20, marginBottom: 30 }}>
              {empresa?.logoData && (
                <img 
                  src={empresa.logoData === '__PRUNED_IN_LOCAL_STAGE__' ? `/api/empresas/file?id=${empresa.id}&type=logo` : empresa.logoData} 
                  alt="Logo Empresa" 
                  style={{ maxHeight: 60, maxWidth: 150, objectFit: 'contain', marginBottom: 12 }} 
                />
              )}
              <h1 style={{ fontSize: '20px', fontWeight: 800, textTransform: 'uppercase', margin: '0 0 6px 0' }}>
                {POLICY_INFO[activeTab].title}
              </h1>
              <p style={{ fontSize: '12px', margin: 0, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
                {empresa?.razaoSocial} • CNPJ {empresa?.cnpj}
              </p>
              <p style={{ fontSize: '11px', color: '#666', margin: '4px 0 0 0' }}>
                Emitido em: {new Date().toLocaleDateString('pt-BR')} • Privilege Consultoria Financeira
              </p>
            </div>

            {/* Texto */}
            <div 
              style={{ 
                fontSize: '13px', 
                lineHeight: '1.7', 
                whiteSpace: 'pre-wrap', 
                color: '#000',
                fontFamily: 'Times New Roman, serif'
              }}
            >
              {policyText || 'Nenhuma diretriz homologada para este documento.'}
            </div>

            {/* Assinaturas */}
            <div style={{ marginTop: 60, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, paddingTop: 30, borderTop: '1px dashed #ccc' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderTop: '1px solid #000', width: '200px', margin: '0 auto', marginTop: 30 }}></div>
                <p style={{ fontSize: '11px', fontWeight: 600, margin: '6px 0 0 0' }}>{empresa?.responsavel || 'Responsável Legal'}</p>
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
