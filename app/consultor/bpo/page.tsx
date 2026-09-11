'use client';
import { useCallback, useEffect, useState } from 'react';
import { store, Empresa } from '../../../lib/store';
import { toast } from 'sonner';

const STATUS_SLA = ['ABERTO', 'EM_ANDAMENTO', 'ATRASADO', 'CONCLUIDO'] as const;
type StatusSla = typeof STATUS_SLA[number];
const STATUS_SLA_LABEL: Record<StatusSla, string> = {
  ABERTO: 'Aberto', EM_ANDAMENTO: 'Em andamento', ATRASADO: 'Atrasado', CONCLUIDO: 'Concluído',
};
const STATUS_SLA_COR: Record<StatusSla, string> = {
  ABERTO: '#6b7280', EM_ANDAMENTO: '#3b82f6', ATRASADO: '#ef4444', CONCLUIDO: '#10b981',
};

interface LinhaSla {
  empresaId: string;
  nomeFantasia: string;
  competencia: string;
  status: StatusSla;
  percentualProgresso: number;
  responsavelId: string | null;
  updatedAt: string | null;
}

const mesAtualStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function BpoDashboardPage() {
  const [activeTab, setActiveTab] = useState<'ia' | 'inbox' | 'lotes' | 'cobranca' | 'sla'>('sla');
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  useEffect(() => {
    setEmpresas(store.getEmpresas());
  }, []);

  // Monitor de SLA — antes era uma barra de progresso fake (100 - index*25);
  // agora lê/grava de verdade em SLAFechamento via /api/bpo/sla.
  const [competenciaSla, setCompetenciaSla] = useState(mesAtualStr());
  const [linhasSla, setLinhasSla] = useState<LinhaSla[]>([]);
  const [carregandoSla, setCarregandoSla] = useState(false);
  const [salvandoSla, setSalvandoSla] = useState<string | null>(null);

  const carregarSla = useCallback(async (competencia: string) => {
    setCarregandoSla(true);
    try {
      const res = await fetch(`/api/bpo/sla?competencia=${competencia}`);
      const json = await res.json();
      if (res.ok) setLinhasSla(json.linhas || []);
      else toast.error(json.error || 'Erro ao carregar o SLA.');
    } catch {
      toast.error('Erro de conexão ao carregar o SLA.');
    } finally {
      setCarregandoSla(false);
    }
  }, []);

  useEffect(() => { carregarSla(competenciaSla); }, [competenciaSla, carregarSla]);

  const atualizarSla = async (linha: LinhaSla, patch: Partial<Pick<LinhaSla, 'status' | 'percentualProgresso'>>) => {
    const atualizada = { ...linha, ...patch };
    setLinhasSla(prev => prev.map(l => l.empresaId === linha.empresaId ? atualizada : l));
    setSalvandoSla(linha.empresaId);
    try {
      const res = await fetch('/api/bpo/sla', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId: linha.empresaId, competencia: linha.competencia, ...patch }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error || 'Erro ao salvar.');
        carregarSla(competenciaSla); // desfaz a atualização otimista em caso de erro
      }
    } catch {
      toast.error('Erro de conexão ao salvar.');
      carregarSla(competenciaSla);
    } finally {
      setSalvandoSla(null);
    }
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'sla':
        return (
          <div className="fade-in animate-slide-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: 12 }}>
              <h3 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px', margin: 0 }}>
                 <span className="text-gradient">Visão Estratégica:</span> SLA de Fechamento Contábil e BPO
              </h3>
              <input
                type="month" className="form-control" style={{ width: 160 }}
                value={competenciaSla} onChange={e => setCompetenciaSla(e.target.value)}
              />
            </div>

            {carregandoSla ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
            ) : linhasSla.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <h3>Nenhuma empresa no seu escopo</h3>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
                {linhasSla.map((linha, index) => {
                  const cor = STATUS_SLA_COR[linha.status];
                  const salvandoEsta = salvandoSla === linha.empresaId;
                  return (
                    <div key={linha.empresaId} className="glass-card card-dynamic animate-slide-up" style={{
                      padding: '28px',
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
                      borderRadius: '20px',
                      border: '1px solid rgba(255,255,255,0.9)',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
                      animationDelay: `${index * 60}ms`,
                      opacity: salvandoEsta ? 0.7 : 1,
                      transition: 'opacity .15s',
                    }}>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px' }}>{linha.nomeFantasia}</div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '8px', color: cor }}>
                        <span>Progresso do fechamento</span>
                        <span>{linha.percentualProgresso}%</span>
                      </div>
                      <div style={{ width: '100%', height: '10px', background: 'rgba(0,0,0,0.04)', borderRadius: '10px', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)', marginBottom: 4 }}>
                        <div style={{ width: `${linha.percentualProgresso}%`, height: '100%', background: cor, transition: 'width .4s ease' }} />
                      </div>
                      <input
                        type="range" min={0} max={100} step={5} value={linha.percentualProgresso}
                        onChange={e => atualizarSla(linha, { percentualProgresso: Number(e.target.value) })}
                        style={{ width: '100%', marginTop: 8, accentColor: cor }}
                        disabled={salvandoEsta}
                      />

                      <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                        {STATUS_SLA.map(s => (
                          <button
                            key={s}
                            onClick={() => atualizarSla(linha, { status: s })}
                            disabled={salvandoEsta}
                            className="badge"
                            style={{
                              fontSize: 11, fontWeight: 800, border: 'none', cursor: 'pointer',
                              background: linha.status === s ? STATUS_SLA_COR[s] : 'rgba(0,0,0,0.05)',
                              color: linha.status === s ? '#fff' : 'var(--text-muted)',
                            }}
                          >
                            {STATUS_SLA_LABEL[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      
      case 'inbox':
        return (
          <div className="fade-in animate-slide-up">
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Caixa de Entrada Inteligente (OCR/IA)</h3>
                <button className="btn btn-primary" onClick={() => toast.info('OCR Neural está processando os anexos recentes...')} style={{ boxShadow: '0 4px 15px rgba(140,26,34,0.3)' }}>📥 Sincronizar E-mails e PDFs</button>
             </div>
             
             <div className="glass-card card-dynamic" style={{ padding: '40px', textAlign: 'center', background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)', border: '2px dashed rgba(0,0,0,0.1)', borderRadius: '24px', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'scale(1.01)'; e.currentTarget.style.boxShadow = '0 15px 30px rgba(0,0,0,0.05)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}>
               <div style={{ fontSize: '48px', marginBottom: '16px', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}>📂</div>
               <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 18 }}>Nenhum documento aguardando processamento.</div>
               <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: 8, maxWidth: 500, margin: '8px auto 0' }}>Arraste PDFs de Boletos ou XMLs de NF-e para essa área. O Modelo Neural vai triar o fornecedor, data e CNPJ e preencher o Contas a Pagar automaticamente.</div>
             </div>
          </div>
        );

      case 'ia':
         return (
          <div className="fade-in animate-slide-up">
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Motor de Categorização - Algoritmos Preditivos</h3>
                <button className="btn btn-secondary" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)' }}>🤖 Treinar Nova Regra</button>
             </div>
            
            <div className="glass-card card-dynamic" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.9)', boxShadow: '0 10px 30px rgba(0,0,0,0.04)', padding: 16 }}>
              <div className="table-responsive" style={{ margin: 0 }}>
                <table className="table" style={{ margin: 0 }}>
                  <thead style={{ background: 'rgba(0,0,0,0.02)' }}>
                    <tr>
                      <th style={{ color: 'var(--text-secondary)', fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Empresa Alvo</th>
                      <th style={{ color: 'var(--text-secondary)', fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Condição Detectada (OFX)</th>
                      <th style={{ color: 'var(--text-secondary)', fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Ação Automática (Plano de Contas)</th>
                      <th style={{ color: 'var(--text-secondary)', fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Impacto Estratégico</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ background: 'transparent' }}>
                      <td style={{ fontWeight: 700 }}>Privilege Global</td>
                      <td><span className="badge" style={{ background: '#e0e7ff', color: '#3730a3', fontSize: 12, fontWeight: 800 }}>⚡ CONTAINS: "TAR CONTA"</span></td>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Despesas c/ Tarifas Bancárias</td>
                      <td><span style={{ color: 'var(--green)', fontWeight: 900, fontSize: 15 }}>832</span> auto-conciliações</td>
                    </tr>
                    <tr style={{ background: 'transparent' }}>
                      <td style={{ fontWeight: 700 }}>Privilege Global</td>
                      <td><span className="badge" style={{ background: '#e0e7ff', color: '#3730a3', fontSize: 12, fontWeight: 800 }}>⚡ STARTS_WITH: "PGTO FORNEC"</span></td>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Pagamento a Fornecedores</td>
                      <td><span style={{ color: 'var(--green)', fontWeight: 900, fontSize: 15 }}>142</span> auto-conciliações</td>
                    </tr>
                    <tr style={{ background: 'transparent' }}>
                      <td style={{ fontWeight: 700 }}>Privilege Global</td>
                      <td><span className="badge" style={{ background: '#ecfdf5', color: '#065f46', fontSize: 12, fontWeight: 800 }}>🎯 EQUALS: "PIX RECEBIDO"</span></td>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Receita de Serviços (Vendas)</td>
                      <td><span style={{ color: 'var(--green)', fontWeight: 900, fontSize: 15 }}>45</span> auto-conciliações</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
         )
      
      case 'lotes':
         return (
          <div className="fade-in animate-slide-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
               <h3 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Lotes Bancários e Integração CNAB</h3>
               <button className="btn btn-primary" onClick={() => toast.success('Mapeador de Contas a Pagar ativado.')} style={{ boxShadow: '0 4px 15px rgba(140,26,34,0.3)' }}>+ Criar Novo Lote Pagador</button>
            </div>
            
            <div className="glass-card card-dynamic animate-slide-up" style={{ 
               padding: '28px', 
               background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)', 
               borderRadius: '20px', 
               border: '1px solid rgba(255,255,255,0.9)', 
               boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
               display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
               <div>
                 <div style={{ fontWeight: 900, fontSize: '18px', marginBottom: 6, color: 'var(--text-primary)' }}>Lote Pagador 09-Alfa (Tech Solutions)</div>
                 <div style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600 }}>15 pagamentos processados • R$ 42.100,00 agrupados.</div>
               </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontSize: 13, padding: '8px 16px', fontWeight: 800, border: '1px solid rgba(146, 64, 14, 0.2)' }}>⏳ Aguardando Cliente Aprovar</span>
                  <button className="btn btn-secondary" style={{ background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)', color: '#fff', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>Exportar CNAB 240</button>
               </div>
            </div>
          </div>
         )

      case 'cobranca':
         return (
          <div className="fade-in animate-slide-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
               <h3 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Régua de Cobrança Neural (Zappfy/E-mail)</h3>
               <button className="btn btn-primary" onClick={() => toast.success('Nova régua inserida.')} style={{ boxShadow: '0 4px 15px rgba(140,26,34,0.3)' }}>+ Adicionar Estágio de Cobrança</button>
            </div>
            
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: 14, fontWeight: 600 }}>
              O motor estrutural varre o módulo "Contas a Receber" diariamente às 08:00 BRT e envia alertas de liquidez via Zappfy (Whatsapp Oficial) conforme o mapa abaixo.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '24px' }}>
               <div className="glass-card card-dynamic animate-slide-up" style={{ padding: '28px', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', borderRadius: '20px', border: '1px solid #bae6fd', boxShadow: '0 10px 30px rgba(0,0,0,0.04)', animationDelay: '100ms' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div style={{ fontWeight: 900, marginBottom: '8px', fontSize: 17, color: '#0369a1' }}>Aviso Prévio (Lembrete Saudável)</div>
                   <div className="badge" style={{ background: '#0284c7', color: '#fff', fontWeight: 800, padding: '6px 12px' }}>- 3 DIAS DO VENCIMENTO</div>
                 </div>
                 <div style={{ fontStyle: 'italic', fontSize: '13.5px', background: 'rgba(255,255,255,0.7)', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #0369a1', marginTop: 16, color: '#0c4a6e', fontWeight: 500, lineHeight: 1.5 }}>
                   "Olá <strong>{'{nome_sacado}'}</strong>, passando para lembrar com carinho sobre o vencimento da fatura no valor de <strong>R$ {'{valor}'}</strong> dia <strong>{'{data}'}</strong>. Documentos bancários seguem no anexo abaixo."
                 </div>
               </div>

               <div className="glass-card card-dynamic animate-slide-up" style={{ padding: '28px', background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)', borderRadius: '20px', border: '1px solid #fecaca', boxShadow: '0 10px 30px rgba(0,0,0,0.04)', animationDelay: '200ms' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div style={{ fontWeight: 900, marginBottom: '8px', fontSize: 17, color: '#b91c1c' }}>Cobrança Extrajudicial</div>
                   <div className="badge" style={{ background: '#dc2626', color: '#fff', fontWeight: 800, padding: '6px 12px' }}>+ 5 DIAS DE ATRASO</div>
                 </div>
                 <div style={{ fontStyle: 'italic', fontSize: '13.5px', background: 'rgba(255,255,255,0.7)', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #b91c1c', marginTop: 16, color: '#7f1d1d', fontWeight: 500, lineHeight: 1.5 }}>
                   "Olá <strong>{'{nome_sacado}'}</strong>, identificamos um atraso sistêmico no título de <strong>R$ {'{valor}'}</strong>, expirado em <strong>{'{data}'}</strong>. Deseja que eu emita urgentemente uma 2ª via com os juros calculados?"
                 </div>
               </div>
            </div>
          </div>
         )
    }
  };

  return (
    <>
      <style>{`
        .glass-header {
          background: rgba(255, 255, 255, 0.6);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-bottom: 1px solid rgba(255,255,255,0.4);
          box-shadow: 0 4px 30px rgba(0, 0, 0, 0.05);
        }
        .bpo-tab {
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          border: 1px solid transparent;
        }
        .bpo-tab.active {
          background: #fff;
          border-color: rgba(0,0,0,0.1);
          box-shadow: 0 8px 20px rgba(0,0,0,0.06);
          transform: translateY(-2px) scale(1.02);
          color: var(--accent) !important;
          font-weight: 800 !important;
        }
        .bpo-tab:hover:not(.active) {
          background: rgba(255,255,255,0.8);
          transform: translateY(-1px);
        }
      `}</style>
      <div className="page-header glass-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, position: 'sticky', top: 0, zIndex: 50 }}>
        <div>
          <div className="page-title text-gradient" style={{ fontSize: '24px', fontWeight: 900 }}>BPO Financeiro & Automação Inteligente</div>
          <div className="page-subtitle" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Central de processamento massivo, integração bancária e cobrança IA.</div>
        </div>
      </div>

      <div className="page-body" style={{ minHeight: '100%', background: 'radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.03) 0%, transparent 60%)' }}>
        {/* Superior Tabs Hub */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 32, background: 'rgba(0,0,0,0.03)', padding: 6, borderRadius: 16, overflowX: 'auto', flexWrap: 'nowrap', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
          {[
            { id: 'sla', icon: '📊', label: 'Monitor de SLA' },
            { id: 'inbox', icon: '📥', label: 'Robô de E-mails / Notas' },
            { id: 'ia', icon: '🧠', label: 'Categorização IA (Regras)' },
            { id: 'lotes', icon: '🏦', label: 'Lotes de Pagamento (CNAB)' },
            { id: 'cobranca', icon: '📱', label: 'Motor de Cobrança Zappfy' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`bpo-tab ${activeTab === tab.id ? 'active' : ''}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px',
                borderRadius: 12, background: 'transparent',
                fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap'
              }}
            >
              <span style={{ fontSize: 16 }}>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        {renderTab()}
      </div>
    </>
  );
}
