'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { store, Empresa, StoreAuditLog, User } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import { toast } from 'sonner';

type AbaAtiva = 'cofre' | 'auditoria';

export default function ConfiguracoesAvancadasPage() {
  const [empresaId, setEmpresaId] = useState('e1');
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('cofre');
  const [auditLogs, setAuditLogs] = useState<StoreAuditLog[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Estados do Cofre
  const [fechamentoData, setFechamentoData] = useState('');
  const [fechamentoConfirmText, setFechamentoConfirmText] = useState('');

  const loadData = useCallback((id: string) => {
    setEmpresaId(id);
    const emp = store.getEmpresas().find(e => e.id === id) || null;
    setEmpresa(emp);
    if (emp) {
      setFechamentoData(emp.fechamentoData || '');
    }
    const user = store.getCurrentUser();
    setCurrentUser(user);

    // Carregar Logs da Empresa
    const logs = store.getAuditLogs(id);
    setAuditLogs(logs);
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || store.getEmpresas()[0]?.id || '';
    loadData(saved);

    const handler = (e: Event) => loadData((e as CustomEvent<string>).detail);
    const dataChangeHandler = () => {
      const current = sessionStorage.getItem('cf_empresa_sel') || store.getEmpresas()[0]?.id || '';
      loadData(current);
    };
    window.addEventListener('empresaChange', handler);
    window.addEventListener('cfDataChange', dataChangeHandler);
    return () => {
      window.removeEventListener('empresaChange', handler);
      window.removeEventListener('cfDataChange', dataChangeHandler);
    };
  }, [loadData]);

  const handleSalvarCofre = () => {
    if (!empresa) return;
    
    if (fechamentoData && fechamentoConfirmText.toLowerCase() !== 'bloquear') {
      toast.success('Digite "bloquear" na caixa de confirmação para poder fechar o período!');
      return;
    }

    const nextEmpresa = { ...empresa, fechamentoData: fechamentoData || undefined };
    store.saveEmpresa(nextEmpresa);
    if (fechamentoData) {
      store.logAction(empresaId, 'Cofre', `Bloqueou o sistema para movimentações até ${fmt.date(fechamentoData)}`);
    } else {
      store.logAction(empresaId, 'Cofre', `Removeu o bloqueio do fechamento de caixa`);
    }

    setFechamentoConfirmText('');
    loadData(empresaId);
    toast.success('Configuração de Cofre Mensal atualizada com sucesso!');
  };

  if (currentUser?.role === 'cliente') {
    return (
      <div className="page-body">
        <div className="alert alert-danger">
          Acesso restrito a administradores e consultores.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Configurações Avançadas</div>
          <div className="page-subtitle">Auditoria, Segurança e Fechamento — {empresa?.razaoSocial}</div>
        </div>
      </div>

      <div className="page-body">
        <div className="tabs" style={{ marginBottom: 20 }}>
          <button className={`tab ${abaAtiva === 'cofre' ? 'active' : ''}`} onClick={() => setAbaAtiva('cofre')}>
            🔒 Cofre (Fechamento)
          </button>
          <button className={`tab ${abaAtiva === 'auditoria' ? 'active' : ''}`} onClick={() => setAbaAtiva('auditoria')}>
            🕵️‍♂️ Auditoria de Logs
          </button>
        </div>

        {abaAtiva === 'cofre' && (
          <div className="card" style={{ maxWidth: 700 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Cofre de Fechamento</div>
                <div className="card-subtitle">
                  Trava o sistema para edições de períodos anteriores (proteção contra fraudes ou erro acidental)
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <strong>Data de Bloqueio</strong>
                <span className="badge badge-red">Crítico</span>
              </label>
              <input 
                type="date"
                className="form-control"
                value={fechamentoData}
                style={{ maxWidth: 200, borderColor: fechamentoData ? 'var(--red)' : '' }}
                onChange={e => setFechamentoData(e.target.value)}
              />
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                Qualquer lançamento financeiro com data ANTERIOR ou IGUAL à data escolhida, estará blindado. Ninguém (nem você nem o cliente) poderá adicionar, editar ou deletar registros nesse período.
              </p>
            </div>

            {fechamentoData && fechamentoData !== empresa?.fechamentoData && (
              <div className="form-group" style={{ marginTop: 24, padding: 16, background: '#fee2e2', borderRadius: 8, border: '1px solid #fca5a5' }}>
                <label className="form-label" style={{ color: '#991b1b' }}>Confirmação de Segurança</label>
                <p style={{ fontSize: 13, color: '#991b1b', marginBottom: 10 }}>Ao travar esse período, relatórios gerados serão definitivos. Para prosseguir, digite <strong>bloquear</strong> no campo abaixo:</p>
                <input 
                  type="text"
                  className="form-control"
                  style={{ maxWidth: 200 }}
                  placeholder="bloquear"
                  value={fechamentoConfirmText}
                  onChange={e => setFechamentoConfirmText(e.target.value)}
                />
              </div>
            )}

            <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => {
                setFechamentoData('');
                setFechamentoConfirmText('');
              }}>Desativar Bloqueio</button>
              <button className="btn btn-danger" onClick={handleSalvarCofre}>💾 Salvar Bloqueio</button>
            </div>
          </div>
        )}

        {abaAtiva === 'auditoria' && (
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Ações Realizadas (Caixa Preta)</div>
                <div className="card-subtitle">
                  Rastreamento passivo imutável sobre edições críticas na empresa
                </div>
              </div>
            </div>

            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>Data/Hora</th>
                    <th>Usuário (Autor)</th>
                    <th>Ação</th>
                    <th>Detalhes Técnicos</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Nenhum registro de auditoria gravado ainda.
                      </td>
                    </tr>
                  ) : auditLogs.map(log => (
                    <tr key={log.id}>
                      <td style={{ width: 140 }}>
                        <span style={{ fontWeight: 600 }}>{fmt.date(log.timestamp.split('T')[0])}</span><br />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.timestamp.split('T')[1].slice(0,5)}</span>
                      </td>
                      <td style={{ width: 200, fontWeight: 500 }}>
                        {log.userName}
                      </td>
                      <td style={{ width: 150 }}>
                        <span className="badge" style={{ background: log.action.includes('Edição') || log.action.includes('Cofre') ? 'var(--bg-hover)' : 'rgba(16, 185, 129, 0.1)', color: log.action.includes('Cofre') ? 'var(--red)' : 'var(--text-main)' }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
