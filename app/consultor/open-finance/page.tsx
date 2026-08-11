'use client';
import { useState, useEffect } from 'react';
import { store, Empresa, Portador } from '../../../lib/store';
import { useRouter } from 'next/navigation';

export default function OpenFinancePage() {
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState('');
  const [activeCompany, setActiveCompany] = useState<Empresa | null>(null);
  const [portadores, setPortadores] = useState<Portador[]>([]);
  
  // UI states
  const [syncingBank, setSyncingBank] = useState<string | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedBank, setSelectedBank] = useState<{ id: string, name: string, color: string } | null>(null);
  const [step, setStep] = useState(1);

  const BANCOS_INTEGRACAO = [
    { id: 'bb', name: 'Banco do Brasil', color: '#facc15' },
    { id: 'itau', name: 'Itaú Unibanco', color: '#f97316' },
    { id: 'sicoob', name: 'Sicoob', color: '#10b981' },
    { id: 'sicredi', name: 'Sicredi', color: '#22c55e' },
    { id: 'nubank', name: 'Nubank (PJ)', color: '#a855f7' },
    { id: 'c6', name: 'C6 Bank', color: '#000000' }
  ];

  const load = (eId: string) => {
    setEmpresaId(eId);
    setPortadores(store.getPortadores(eId));
    setActiveCompany(store.getEmpresas().find(e => e.id === eId) || null);
  };

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || (store.getEmpresas()[0]?.id ?? '');
    load(saved);

    const handler = (e: Event) => load((e as CustomEvent).detail);
    window.addEventListener('empresaChange', handler);
    return () => window.removeEventListener('empresaChange', handler);
  }, []);

  const handleConnectClick = (bank: any) => {
    setSelectedBank(bank);
    setStep(1);
    setShowConnectModal(true);
  };

  const simulateIntegration = () => {
    setStep(2); // Connecting...
    setTimeout(() => {
      setStep(3); // Success
      setTimeout(() => {
        setShowConnectModal(false);
        alert(`O Banco ${selectedBank?.name} foi sincronizado com sucesso! A partir de hoje, 100% dos lançamentos serão importados no painel de OFX automaticamente de madrugada.`);
      }, 3000);
    }, 4000);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">
            Central Open Finance
            <span className="badge badge-purple" style={{ marginLeft: 12 }}>BETA</span>
          </div>
          <div className="page-subtitle">{activeCompany?.nomeFantasia} — Sincronização Bancária Direta</div>
        </div>
      </div>

      <div className="page-body">
         <div className="card" style={{ padding: 24, marginBottom: 24, background: 'linear-gradient(135deg, #1f253d 0%, #171c2f 100%)', color: '#fff', border: 'none' }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: '#fff' }}>Diga Adeus Aos Arquivos OFX</h2>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, maxWidth: 600, lineHeight: 1.6 }}>
               Através do protocolo oficial do Banco Central (Open Finance Brasil), o Privilege OS se conecta diretamente nas contas do seu cliente. Puxamos o extrato D-1 de forma nativa e <strong>totalmente automatizada</strong> todas as madrugadas, sem qualquer intervenção humana. Apenas modo-leitura comercial, segurança criptográfica 256-bits.
            </div>
         </div>

         <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>Integrações Disponíveis Instantaneamente (D-1)</h3>
         <div className="grid-3" style={{ marginBottom: 40 }}>
            {BANCOS_INTEGRACAO.map(b => {
               // Verifica se o cliente tem esse banco ativado na string de nome (simulação)
               const isConnected = portadores.some(p => p.nome.toLowerCase().includes(b.name.toLowerCase().split(' ')[0]));
               
               return (
                 <div className="glass-card" key={b.id} style={{ padding: 24, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                       <div style={{ width: 40, height: 40, borderRadius: 8, background: b.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#fff', fontWeight: 900 }}>
                          {b.name.charAt(0)}
                       </div>
                       {isConnected && (
                         <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--green)', fontWeight: 700, background: 'var(--green-bg)', padding: '4px 10px', borderRadius: 20 }}>
                           <span className="pulse-glow" style={{ background: 'var(--green)', width: 6, height: 6, borderRadius: '50%' }}></span> ATIVO
                         </div>
                       )}
                    </div>
                    
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{b.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, marginBottom: 20, minHeight: 34 }}>
                       Sincronização Pix, Transferências, Tarifas Bancárias e Pagamentos com código de barras.
                    </div>

                    {isConnected ? (
                       <button className="btn btn-secondary" style={{ width: '100%', border: '1px solid var(--border)' }} onClick={() => alert('Sincronização já está ativa para esta instituição e os logs estão normais.')}>
                          Gerenciar Credenciais
                       </button>
                    ) : (
                       <button className="btn btn-primary" style={{ width: '100%', background: 'var(--text-primary)', color: 'var(--bg-base)', border: 'none' }} onClick={() => handleConnectClick(b)}>
                          + Conectar Banco
                       </button>
                    )}
                 </div>
               );
            })}
         </div>
      </div>

      {showConnectModal && selectedBank && (
         <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
            <div className="modal" style={{ maxWidth: 440, background: '#030712', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
               {step === 1 && (
                  <div style={{ padding: 32, textAlign: 'center' }}>
                     <div style={{ width: 64, height: 64, borderRadius: 16, background: selectedBank.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#fff', fontWeight: 900, margin: '0 auto 24px' }}>
                         {selectedBank.name.charAt(0)}
                     </div>
                     <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 12px 0' }}>Autenticação {selectedBank.name}</h2>
                     <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.5, marginBottom: 32 }}>
                        Para conectar esta instituição via Banco Central, você será redirecionado para o ambiente seguro do banco. Autentique usando token PJ ou assinatura Gov.br.
                     </p>
                     
                     <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <button className="btn btn-primary" style={{ background: selectedBank.color, color: selectedBank.color === '#facc15' ? '#000' : '#fff', border: 'none', height: 48, fontSize: 14 }} onClick={simulateIntegration}>
                           Prosseguir para o Banco →
                        </button>
                        <button className="btn btn-ghost" style={{ color: '#6b7280' }} onClick={() => setShowConnectModal(false)}>
                           Cancelar Operação
                        </button>
                     </div>
                  </div>
               )}

               {step === 2 && (
                  <div style={{ padding: '60px 32px', textAlign: 'center' }}>
                     <div className="spinner" style={{ width: 48, height: 48, border: `4px solid rgba(255,255,255,0.1)`, borderTopColor: selectedBank.color, margin: '0 auto 24px' }}></div>
                     <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px 0' }}>Estabelecendo Túnel Seguro...</h3>
                     <div style={{ fontSize: 13, color: '#6b7280' }}>Trocando chaves criptográficas com a API do {selectedBank.name} (OAuth 2.0).</div>
                  </div>
               )}

               {step === 3 && (
                  <div style={{ padding: '60px 32px', textAlign: 'center' }}>
                     <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#22c55e', margin: '0 auto 24px' }}>
                        ✓
                     </div>
                     <h3 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px 0', color: '#22c55e' }}>Integração Estabelecida!</h3>
                     <div style={{ fontSize: 13, color: '#9ca3af' }}>As contas correntes ativas já estão mapeadas no sistema. Sincronização agendada para 02:00 AM diárias.</div>
                  </div>
               )}
            </div>
         </div>
      )}
    </>
  );
}
