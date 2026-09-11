'use client';
import { useState, useEffect } from 'react';
import { store, Empresa } from '../../../lib/store';
import { toast } from 'sonner';

export default function BpoDashboardPage() {
  const [activeTab, setActiveTab] = useState<'ia' | 'inbox' | 'lotes' | 'cobranca' | 'sla'>('sla');
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  useEffect(() => {
    setEmpresas(store.getEmpresas());
  }, []);

  const renderTab = () => {
    switch (activeTab) {
      case 'sla':
        return (
          <div className="fade-in">
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Visão Estratégica: SLA de Fechamento</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {empresas.slice(0, 4).map((e, index) => {
                const progresso = 100 - (index * 25);
                const isWarning = progresso < 50;
                return (
                  <div key={e.id} style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px' }}>{e.nomeFantasia || e.razaoSocial}</div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '8px', color: isWarning ? 'var(--red)' : 'var(--accent)' }}>
                      <span>Competência Vigente</span>
                      <span>{progresso}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'var(--bg-body)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${progresso}%`, height: '100%', background: isWarning ? 'var(--red)' : 'var(--accent)', transition: 'width 1s ease-in-out' }} />
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                      <span className="badge badge-gray" style={{ fontSize: 11 }}>Conciliação IA: {progresso >= 80 ? '✅ 100%' : '⏳ 60%'}</span>
                      <span className="badge badge-gray" style={{ fontSize: 11 }}>DRE Exportado: {progresso === 100 ? '✅ Feito' : '⏳ Pend.'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      
      case 'inbox':
        return (
          <div className="fade-in">
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Caixa de Entrada Inteligente</h3>
                <button className="btn btn-primary" onClick={() => toast.info('OCR Neural está processando os anexos recentes...')}>📥 Sincronizar E-mails e PDFs</button>
             </div>
             <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: 14 }}>
               Arraste PDFs de Boletos ou XMLs de NF-e para baixo. A I.A vai triar o fornecedor, data, CNPJ e preparar o Contas a Pagar.
             </p>
             
             <div style={{ padding: '40px', textAlign: 'center', background: 'var(--bg-card)', border: '2px dashed var(--border)', borderRadius: '16px', cursor: 'pointer' }}
                  onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}>
               <div style={{ fontSize: '40px', marginBottom: '16px' }}>📂</div>
               <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Nenhum documento aguardando processamento.</div>
               <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: 8 }}>Módulo de extração automática de XMLs ativo.</div>
             </div>
          </div>
        );

      case 'ia':
         return (
          <div className="fade-in">
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Motor de Categorização - ML Regras</h3>
            
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Condição Detectada (OFX)</th>
                    <th>Ação Automática (Plano de Contas)</th>
                    <th>Impacto (Matches)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Exemplo Tech</td>
                    <td><span className="badge" style={{ background: '#e0e7ff', color: '#3730a3' }}>CONTAINS: "TAR CONTA"</span></td>
                    <td style={{ fontWeight: 600 }}>Despesas c/ Tarifas Bancárias</td>
                    <td><span style={{ color: 'var(--green)', fontWeight: 800 }}>832</span> auto-conciliações</td>
                  </tr>
                  <tr>
                    <td>Exemplo Tech</td>
                    <td><span className="badge" style={{ background: '#e0e7ff', color: '#3730a3' }}>STARTS_WITH: "PGTO FORNEC"</span></td>
                    <td style={{ fontWeight: 600 }}>Pagamento a Fornecedores</td>
                    <td><span style={{ color: 'var(--green)', fontWeight: 800 }}>142</span> auto-conciliações</td>
                  </tr>
                  <tr>
                    <td>Exemplo Tech</td>
                    <td><span className="badge" style={{ background: '#ecfdf5', color: '#065f46' }}>EQUALS: "PIX RECEBIDO JOAO"</span></td>
                    <td style={{ fontWeight: 600 }}>Receita de Serviços (Vendas)</td>
                    <td><span style={{ color: 'var(--green)', fontWeight: 800 }}>45</span> auto-conciliações</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
         )
      
      case 'lotes':
         return (
          <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
               <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Lotes Bancários e Borderôs CNAB</h3>
               <button className="btn btn-primary" onClick={() => toast.success('Mapeador de Contas a Pagar ativado.')}>+ Criar Novo Lote Pagador</button>
            </div>
            
            <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
               <div>
                 <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: 4 }}>Lote Pagador 09-Alfa (Tech Solutions)</div>
                 <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>15 pagamentos • R$ 42.100,00 agrupados.</div>
               </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontSize: 13, padding: '6px 12px' }}>⏳ Aguardando Cliente Aprovar</span>
                  <button className="btn btn-secondary" style={{ background: '#fff', border: '1px solid var(--border)' }}>Exportar CNAB 240</button>
               </div>
            </div>
          </div>
         )

      case 'cobranca':
         return (
          <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
               <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Régua de Cobrança (Ativa)</h3>
               <button className="btn btn-primary" onClick={() => toast.success('Nova régua inserida.')}>+ Adicionar Estágio de Cobrança</button>
            </div>
            
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: 14 }}>
              O robô varre o módulo "Contas a Receber" dos clientes todos os dias às 08:00 e envia alertas via Zappfy (Whatsapp) conforme os dias configurados abaixo.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
               <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                   <div style={{ fontWeight: 800, marginBottom: '8px', fontSize: 15 }}>Aviso Prévio 1</div>
                   <div className="badge badge-gray" style={{ background: '#e0f2fe', color: '#0369a1' }}>- 3 DIAS DO VENCIMENTO</div>
                 </div>
                 <div style={{ fontStyle: 'italic', fontSize: '13px', background: '#f8fafc', padding: '16px', borderRadius: '8px', borderLeft: '3px solid #0369a1', marginTop: 12 }}>
                   "Olá {'{nome_sacado}'}, passando para lembrar sobre o vencimento da sua fatura no valor de R$ {'{valor}'} no dia {'{data}'}. Boletos seguem em anexo."
                 </div>
               </div>

               <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                   <div style={{ fontWeight: 800, marginBottom: '8px', fontSize: 15 }}>Cobrança Extrajudicial</div>
                   <div className="badge" style={{ background: '#fef2f2', color: '#991b1b' }}>+ 5 DIAS DE ATRASO</div>
                 </div>
                 <div style={{ fontStyle: 'italic', fontSize: '13px', background: '#f8fafc', padding: '16px', borderRadius: '8px', borderLeft: '3px solid #991b1b', marginTop: 12 }}>
                   "Olá {'{nome_sacado}'}, identificamos um atraso no título de R$ {'{valor}'}. O documento expirou em {'{data}'}. Deseja que geremos uma 2ª via atualizada?"
                 </div>
               </div>
            </div>
          </div>
         )
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-title">Plataforma BPO e Escala (CFOaaS)</div>
        <div className="page-subtitle">Central Administrativa conectada à API Neural e Bancária para automação contábil.</div>
      </div>

      <div className="page-body">
        {/* Superior Tabs Hub */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', overflowX: 'auto', paddingBottom: '12px' }}>
          {[
            { id: 'sla', title: 'SLA de Fechamento', icon: '📊' },
            { id: 'ia', title: 'Regras Inteligentes (A.I)', icon: '🤖' },
            { id: 'inbox', title: 'Caixa de Entrada NFe', icon: '📥' },
            { id: 'lotes', title: 'Painel de Pagamentos', icon: '💳' },
            { id: 'cobranca', title: 'Régua de Cobrança', icon: '🔔' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '14px 24px',
                borderRadius: '12px',
                border: activeTab === tab.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: activeTab === tab.id ? 'var(--bg-body)' : 'var(--bg-card)',
                color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: activeTab === tab.id ? 800 : 600,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: activeTab === tab.id ? '0 4px 12px rgba(96,0,0,0.1)' : 'none'
              }}
              onMouseOver={(e) => {
                if (activeTab !== tab.id) {
                   e.currentTarget.style.borderColor = '#d1d5db';
                   e.currentTarget.style.background = '#f9fafb';
                }
              }}
              onMouseOut={(e) => {
                if (activeTab !== tab.id) {
                   e.currentTarget.style.borderColor = 'var(--border)';
                   e.currentTarget.style.background = 'var(--bg-card)';
                }
              }}
            >
              <span style={{ fontSize: '18px' }}>{tab.icon}</span>
              {tab.title}
            </button>
          ))}
        </div>

        {/* Content Area */}
        {renderTab()}
      </div>
    </>
  );
}
