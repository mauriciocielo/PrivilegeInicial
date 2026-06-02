'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { store, Empresa, Lancamento, User } from '../../../lib/store';
import { fmt } from '../../../lib/reports';

export default function AdministrativoPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [migrating, setMigrating] = useState(false);

  // Estados do Google Drive Backup
  const [gdriveToken, setGdriveToken] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [autoBackup, setAutoBackup] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const handleMigrateToPostgres = async () => {
    if (!confirm('Deseja enviar todos os seus dados locais (empresas, lançamentos, contas, etc.) para o banco de dados PostgreSQL no Railway?')) return;
    setMigrating(true);
    try {
      const backupData = store.exportBackup();
      const res = await fetch('/api/migrate-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: backupData
      });
      const result = await res.json();
      if (result.success) {
        alert('🎉 Migração concluída com sucesso! Todos os dados locais foram salvos no PostgreSQL no Railway.');
      } else {
        alert('❌ Erro na migração: ' + result.error);
      }
    } catch (e) {
      alert('❌ Erro de rede na migração: ' + (e as Error).message);
    } finally {
      setMigrating(false);
    }
  };

  const load = useCallback(() => {
    setEmpresas(store.getEmpresas());
    setUsers(store.getUsers());
    setLancamentos(store.getLancamentos());
  }, []);

  useEffect(() => {
    load();
    window.addEventListener('cfDataChange', load);
    return () => window.removeEventListener('cfDataChange', load);
  }, [load]);

  // Carrega configurações salvas do Google Drive
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setClientId(localStorage.getItem('cf_gdrive_client_id') || '310782991079-f1diunnjeknqtk29btuqotrop23nlfvd.apps.googleusercontent.com');
      setAutoBackup(localStorage.getItem('cf_gdrive_auto') === 'true');
      setLastSyncTime(localStorage.getItem('cf_gdrive_last_sync') || null);
      const token = sessionStorage.getItem('cf_gdrive_token');
      if (token) setGdriveToken(token);
    }
  }, []);

  // Carrega dinamicamente o script do Google Identity Services
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    return () => {
      try {
        document.body.removeChild(script);
      } catch (e) {}
    };
  }, []);

  const handleExportBackup = () => {
    try {
      const backupData = store.exportBackup();
      const blob = new Blob([backupData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `cashflow_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Erro ao exportar backup: ' + (e as Error).message);
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Atenção: Ao restaurar este backup, TODOS OS DADOS ATUAIS do sistema serão substituídos pelos dados do arquivo. Deseja continuar?')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const res = store.importBackup(text);
      if (res.success) {
        alert('Backup restaurado com sucesso! Os dados foram atualizados.');
        load();
      } else {
        alert('Erro ao restaurar backup: ' + res.error);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const triggerGDriveBackup = async (token: string) => {
    setSyncStatus('syncing');
    try {
      const backupData = store.exportBackup();
      
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='cashflow_system_backup.json' and trashed=false&fields=files(id)`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (!searchRes.ok) throw new Error('Falha ao buscar arquivos no Google Drive.');
      
      const searchData = await searchRes.json();
      let fileId = searchData.files?.[0]?.id;
      
      if (!fileId) {
        const createRes = await fetch(
          'https://www.googleapis.com/drive/v3/files',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: 'cashflow_system_backup.json',
              mimeType: 'application/json'
            })
          }
        );
        if (!createRes.ok) throw new Error('Falha ao criar arquivo de backup no Google Drive.');
        const createData = await createRes.json();
        fileId = createData.id;
      }
      
      const uploadRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: backupData
        }
      );
      if (!uploadRes.ok) throw new Error('Falha ao enviar dados de backup para o Google Drive.');
      
      const now = new Date().toLocaleString('pt-BR');
      setLastSyncTime(now);
      localStorage.setItem('cf_gdrive_last_sync', now);
      setSyncStatus('success');
    } catch (err) {
      console.error(err);
      setSyncStatus('error');
    }
  };

  const handleConnectGDrive = () => {
    if (!clientId) {
      alert('Por favor, informe seu Google Client ID nas configurações de backup para conectar.');
      return;
    }
    try {
      const win = window as any;
      if (!win.google?.accounts?.oauth2) {
        alert('O SDK do Google ainda não foi carregado. Aguarde alguns instantes e tente novamente.');
        return;
      }
      const client = win.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (response: any) => {
          if (response.access_token) {
            setGdriveToken(response.access_token);
            sessionStorage.setItem('cf_gdrive_token', response.access_token);
            alert('Google Drive conectado com sucesso!');
            triggerGDriveBackup(response.access_token);
          } else {
            alert('Falha na autenticação do Google Drive.');
          }
        },
      });
      client.requestAccessToken();
    } catch (err) {
      console.error(err);
      alert('Erro ao iniciar fluxo do Google Drive. Verifique se o Client ID está correto.');
    }
  };

  const handleToggleAutoBackup = (checked: boolean) => {
    setAutoBackup(checked);
    localStorage.setItem('cf_gdrive_auto', String(checked));
    if (checked && !gdriveToken) {
      handleConnectGDrive();
    }
  };

  // Debounced backup automático ao alterar lançamentos, empresas ou usuários
  useEffect(() => {
    if (!autoBackup || !gdriveToken) return;
    
    const delay = setTimeout(() => {
      triggerGDriveBackup(gdriveToken);
    }, 5000);
    
    return () => clearTimeout(delay);
  }, [lancamentos, empresas, users, autoBackup, gdriveToken]);

  const data = useMemo(() => {
    const mes = new Date().toISOString().slice(0, 7);
    const realizadosMes = lancamentos.filter(l => l.status === 'realizado' && l.data.startsWith(mes));
    const receitas = realizadosMes.filter(l => l.tipo === 'receita').reduce((acc, l) => acc + l.valor, 0);
    const despesas = realizadosMes.filter(l => l.tipo === 'despesa').reduce((acc, l) => acc + l.valor, 0);
    const endividamentos = empresas.flatMap(e => store.getEndividamentos(e.id));
    const dividaTotal = endividamentos.reduce((acc, e) => acc + Math.max(0, e.valorAPagar - e.pagamentoMes), 0);
    const portadoresTotal = empresas.reduce((acc, empresa) => {
      return acc + store.getPortadores(empresa.id).reduce((sum, p) => sum + store.getSaldoPortador(p.id, empresa.id), 0);
    }, 0);

    const porEmpresa = empresas.map(empresa => {
      const lancs = realizadosMes.filter(l => l.empresaId === empresa.id);
      const rec = lancs.filter(l => l.tipo === 'receita').reduce((acc, l) => acc + l.valor, 0);
      const desp = lancs.filter(l => l.tipo === 'despesa').reduce((acc, l) => acc + l.valor, 0);
      return { empresa, receitas: rec, despesas: desp, saldo: rec - desp, registros: lancs.length };
    }).sort((a, b) => b.receitas - a.receitas);

    const atividades = empresas.reduce<Record<string, number>>((acc, e) => {
      const key = e.atividade || 'Não informado';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return { receitas, despesas, resultado: receitas - despesas, dividaTotal, portadoresTotal, porEmpresa, atividades };
  }, [empresas, lancamentos]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Painel Administrativo</div>
          <div className="page-subtitle">Visão global do escritório e da carteira de clientes</div>
        </div>
      </div>

      <div className="page-body">
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card blue">
            <div className="stat-icon blue">🏢</div>
            <div className="stat-label">Empresas Ativas</div>
            <div className="stat-value">{empresas.length}</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-icon purple">👥</div>
            <div className="stat-label">Usuários</div>
            <div className="stat-value">{users.length}</div>
          </div>
          <div className="stat-card green">
            <div className="stat-icon green">↑</div>
            <div className="stat-label">Receitas do Mês</div>
            <div className="stat-value">{fmt.currency(data.receitas)}</div>
          </div>
          <div className="stat-card red">
            <div className="stat-icon red">↓</div>
            <div className="stat-label">Despesas do Mês</div>
            <div className="stat-value">{fmt.currency(data.despesas)}</div>
          </div>
          <div className={`stat-card ${data.resultado >= 0 ? 'green' : 'red'}`}>
            <div className={`stat-icon ${data.resultado >= 0 ? 'green' : 'red'}`}>≈</div>
            <div className="stat-label">Resultado Global</div>
            <div className="stat-value">{fmt.currency(data.resultado)}</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-icon purple">🏦</div>
            <div className="stat-label">Saldo em Portadores</div>
            <div className="stat-value" style={{ color: data.portadoresTotal >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt.currency(data.portadoresTotal)}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: 20 }}>
          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 16 }}>Ranking de Empresas no Mês</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Atividade</th>
                    <th style={{ textAlign: 'right' }}>Receitas</th>
                    <th style={{ textAlign: 'right' }}>Despesas</th>
                    <th style={{ textAlign: 'right' }}>Resultado</th>
                    <th>Registros</th>
                  </tr>
                </thead>
                <tbody>
                  {data.porEmpresa.map(item => (
                    <tr key={item.empresa.id}>
                      <td style={{ fontWeight: 600 }}>{item.empresa.nomeFantasia || item.empresa.razaoSocial}</td>
                      <td>{item.empresa.atividade || '-'}</td>
                      <td style={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>{fmt.currency(item.receitas)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--red)', fontWeight: 600 }}>{fmt.currency(item.despesas)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: item.saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt.currency(item.saldo)}</td>
                      <td>{item.registros}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <h3 style={{ fontSize: 15, marginBottom: 16 }}>Carteira por Atividade</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(data.atividades).map(([atividade, total]) => (
                  <div key={atividade} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <span>{atividade}</span>
                    <strong>{total}</strong>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Endividamento global em aberto</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#b45309', marginTop: 4 }}>{fmt.currency(data.dividaTotal)}</div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontSize: 15, marginBottom: 16 }}>📦 Backup e Restauração</h3>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: '1.4' }}>
                Salve e restaure uma cópia dos seus dados localmente ou ative a sincronização com o Google Drive.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleExportBackup}
                  style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  📥 Exportar Backup Local
                </button>

                <button 
                  className="btn btn-primary" 
                  onClick={handleMigrateToPostgres}
                  disabled={migrating}
                  style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  {migrating ? '⏳ Enviando Dados...' : '☁️ Enviar Dados Locais para PostgreSQL'}
                </button>
                
                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 12, marginTop: 4 }}>
                  <input 
                    type="file" 
                    accept=".json" 
                    onChange={handleImportBackup} 
                    id="import-backup-file" 
                    style={{ display: 'none' }} 
                  />
                  <label 
                    htmlFor="import-backup-file" 
                    className="btn btn-ghost" 
                    style={{ 
                      width: '100%', 
                      justifyContent: 'center', 
                      gap: 8, 
                      cursor: 'pointer', 
                      border: '1px dashed var(--border)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius)',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: 13,
                      transition: 'all 0.2s'
                    }}
                  >
                    📤 Restaurar de Arquivo Local
                  </label>
                </div>

                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 12, marginTop: 12 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 8px 0' }}>
                    🤖 Sincronização Google Drive
                  </h4>
                  
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Client ID Google OAuth</label>
                    <input 
                      className="form-control" 
                      placeholder="Cole seu Client ID..." 
                      style={{ fontSize: 12, padding: '6px 10px' }}
                      value={clientId} 
                      onChange={e => {
                        setClientId(e.target.value);
                        localStorage.setItem('cf_gdrive_client_id', e.target.value);
                      }} 
                    />
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.3 }}>
                      Configurações OAuth autorizadas para o seu domínio no Cloud Console.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <button 
                      className={`btn ${gdriveToken ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={handleConnectGDrive}
                      style={{ flex: 1, fontSize: 12, padding: '8px 12px', justifyContent: 'center' }}
                    >
                      {gdriveToken ? '🔄 Reconectar Drive' : '🔌 Conectar Drive'}
                    </button>
                    {gdriveToken && (
                      <button 
                        className="btn btn-ghost"
                        onClick={() => triggerGDriveBackup(gdriveToken)}
                        disabled={syncStatus === 'syncing'}
                        style={{ border: '1px solid var(--border)', fontSize: 12, padding: '8px 12px' }}
                      >
                        {syncStatus === 'syncing' ? '⏳...' : '☁️ Backup Já'}
                      </button>
                    )}
                  </div>

                  <div style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-light)', padding: 10, borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>Status:</span>
                      <strong style={{ color: gdriveToken ? 'var(--green)' : 'var(--red)' }}>
                        {gdriveToken ? 'Conectado' : 'Desconectado'}
                      </strong>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0' }}>
                      <span>Backup Automático:</span>
                      <input 
                        type="checkbox" 
                        checked={autoBackup} 
                        onChange={e => handleToggleAutoBackup(e.target.checked)} 
                        style={{ cursor: 'pointer' }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>Sincronização:</span>
                      <strong style={{ color: syncStatus === 'success' ? 'var(--green)' : syncStatus === 'error' ? 'var(--red)' : 'var(--text-main)' }}>
                        {syncStatus === 'syncing' ? 'Sincronizando...' : syncStatus === 'success' ? 'Sincronizado' : syncStatus === 'error' ? 'Falha' : 'Aguardando'}
                      </strong>
                    </div>

                    {lastSyncTime && (
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
                        Último backup: {lastSyncTime}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
