'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { store, Empresa, Lancamento, User, StoreAuditLog, InteligenciaDoc } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import { syncBackupInChunks } from '../../../lib/sync-helper';

export default function AdministrativoPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [migrating, setMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState('');

  // Estados de Auditoria e Fechamento
  const [selectedAuditEmpresaId, setSelectedAuditEmpresaId] = useState('');
  const [fechamentoDateInput, setFechamentoDateInput] = useState('');
  const [auditLogs, setAuditLogs] = useState<StoreAuditLog[]>([]);
  const [auditSearch, setAuditSearch] = useState('');

  // Estados do Google Drive Backup
  const [gdriveToken, setGdriveToken] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [autoBackup, setAutoBackup] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [intelDocs, setIntelDocs] = useState<InteligenciaDoc[]>([]);

  // Estados do Google Calendar
  const [gcalToken, setGcalToken] = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarSearch, setCalendarSearch] = useState('');
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [worklog, setWorklog] = useState<any[]>([]);

  const handleMigrateToPostgres = async () => {
    if (!confirm('Deseja enviar todos os seus dados locais (empresas, lançamentos, contas, etc.) para o banco de dados PostgreSQL no Railway?')) return;
    setMigrating(true);
    setMigrationProgress('Preparando dados (removendo anexos pesados para sincronização)...');
    try {
      const backupData = store.exportBackupForSync();
      setMigrationProgress('Iniciando envio...');
      const result = await syncBackupInChunks(backupData, (msg) => {
        setMigrationProgress(msg);
      });
      if (result.success) {
        alert('🎉 Migração concluída com sucesso! Todos os dados locais foram salvos no PostgreSQL no Railway.');
      } else {
        alert('❌ Erro na migração: ' + result.error);
      }
    } catch (e) {
      alert('❌ Erro de rede na migração: ' + (e as Error).message);
    } finally {
      setMigrating(false);
      setMigrationProgress('');
    }
  };

  const load = useCallback(() => {
    const list = store.getEmpresas();
    setEmpresas(list);
    setUsers(store.getUsers());
    setLancamentos(store.getLancamentos());
    setIntelDocs(store.getInteligenciaDocs());

    let targetEmpId = selectedAuditEmpresaId;
    if (!targetEmpId && list.length > 0) {
      targetEmpId = list[0].id;
      setSelectedAuditEmpresaId(targetEmpId);
    }

    if (targetEmpId) {
      const emp = list.find(e => e.id === targetEmpId);
      setFechamentoDateInput(emp?.fechamentoData || '');
      setAuditLogs(store.getAuditLogs(targetEmpId));
    }
    try {
      setWorklog(JSON.parse(localStorage.getItem('cf_atividades_log') || '[]'));
    } catch(e){}
  }, [selectedAuditEmpresaId]);

  const handleSaveFechamento = () => {
    if (!selectedAuditEmpresaId) return;
    const emp = empresas.find(e => e.id === selectedAuditEmpresaId);
    if (!emp) return;
    try {
      const updated = { ...emp, fechamentoData: fechamentoDateInput };
      store.saveEmpresa(updated);
      store.logAction(selectedAuditEmpresaId, 'Bloqueio', `Definiu limite de fechamento de caixa para ${fechamentoDateInput ? fmt.date(fechamentoDateInput) : 'nenhuma data'}`);
      alert('Período de fechamento de caixa atualizado com sucesso!');
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleClearFechamento = () => {
    if (!selectedAuditEmpresaId) return;
    const emp = empresas.find(e => e.id === selectedAuditEmpresaId);
    if (!emp) return;
    try {
      const updated = { ...emp, fechamentoData: '' };
      store.saveEmpresa(updated);
      store.logAction(selectedAuditEmpresaId, 'Bloqueio', 'Removeu limite de fechamento de caixa (período totalmente desbloqueado).');
      setFechamentoDateInput('');
      alert('Período de fechamento de caixa totalmente liberado!');
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const filteredLogs = useMemo(() => {
    return auditLogs.filter(l => {
      if (!auditSearch) return true;
      const term = auditSearch.toLowerCase();
      return (
        l.action.toLowerCase().includes(term) ||
        l.details.toLowerCase().includes(term) ||
        l.userName.toLowerCase().includes(term)
      );
    });
  }, [auditLogs, auditSearch]);

  useEffect(() => {
    load();
    window.addEventListener('cfDataChange', load);
    return () => window.removeEventListener('cfDataChange', load);
  }, [load]);

  // Carrega configurações salvas do Google Drive
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setClientId(localStorage.getItem('cf_gdrive_client_id') || '310782991079-2puqblm2vf16bprje07ksrtf4fbsasoh.apps.googleusercontent.com');
      setAutoBackup(localStorage.getItem('cf_gdrive_auto') === 'true');
      setLastSyncTime(localStorage.getItem('cf_gdrive_last_sync') || null);
      const token = sessionStorage.getItem('cf_gdrive_token');
      if (token) setGdriveToken(token);
      const calToken = sessionStorage.getItem('cf_gcal_token');
      if (calToken) setGcalToken(calToken);
    }
  }, []);

  // Mapa de Geolocalização (Leaflet via CDN para rastreamento da equipe)
  useEffect(() => {
    let mapInstance: any = null;
    const initMap = () => {
      const L = (window as any).L;
      if (!L) return;
      const container = document.getElementById('admin-map');
      if (!container) return;
      
      if (container.getAttribute('data-loaded')) {
         container.innerHTML = '';
      }
      container.setAttribute('data-loaded', 'true');
      
      mapInstance = L.map('admin-map').setView([-15.7801, -47.9292], 4);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(mapInstance);

      const bounds = L.latLngBounds();
      let hasPoints = false;
      const ativs = JSON.parse(localStorage.getItem('cf_atividades_ativas') || '[]').filter((a:any) => a.localizacao);
      const emps = store.getEmpresas();

      ativs.forEach((ativ: any) => {
        const emp = emps.find(e => e.id === ativ.empresaId);
        const marker = L.marker([ativ.localizacao.lat, ativ.localizacao.lng]).addTo(mapInstance);
        const img = ativ.fotoInicio ? `<div style="margin-top:8px"><img src="${ativ.fotoInicio}" style="width:100%;height:80px;object-fit:cover;border-radius:4px" /></div>` : '';
        marker.bindPopup(`
          <div style="font-family:sans-serif;font-size:12px">
            <strong style="font-size:14px;color:#600000">📍 ${emp?.nomeFantasia || emp?.razaoSocial || 'Cliente'}</strong><br/>
            <div style="color:var(--green);font-weight:700;margin:4px 0">⏳ Em andamento...</div>
            <b>Consultor:</b> ${ativ.consultorNome || 'Equipe'}<br/>
            ${ativ.descricao}<br/>
            <span style="color:#666">Iniciou: ${new Date(ativ.dataInicio).toLocaleTimeString('pt-BR')}</span>
            ${img}
          </div>
        `);
        bounds.extend([ativ.localizacao.lat, ativ.localizacao.lng]);
        hasPoints = true;
      });

      if (hasPoints) {
        mapInstance.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
      }
    };

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => setTimeout(initMap, 100);
      document.head.appendChild(script);
    } else {
      setTimeout(initMap, 200);
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

  const handleIntelDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const isText = file.type.startsWith('text/') || 
                   file.name.endsWith('.txt') || 
                   file.name.endsWith('.json') || 
                   file.name.endsWith('.csv') || 
                   file.name.endsWith('.md');

    reader.onload = (event) => {
      let content = '';
      if (isText) {
        content = event.target?.result as string;
      } else {
        content = (event.target?.result as string).split(',')[1];
      }

      const newDoc: InteligenciaDoc = {
        id: 'doc_' + Math.random().toString(36).slice(2, 9),
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        content,
        createdAt: new Date().toISOString()
      };

      store.saveInteligenciaDoc(newDoc);
      alert('Documento de inteligência financeira enviado com sucesso!');
      load();
    };

    if (isText) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleIntelDocDelete = (id: string) => {
    if (!confirm('Deseja excluir este documento da base de inteligência financeira?')) return;
    store.deleteInteligenciaDoc(id);
    load();
  };

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
        client_id: clientId.trim(),
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

  const fetchCalendarEvents = async (token: string) => {
    setCalendarLoading(true);
    setCalendarError(null);
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const nextWeekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59).toISOString();
      
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${todayStart}&timeMax=${nextWeekEnd}&orderBy=startTime&singleEvents=true&maxResults=50`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.removeItem('cf_gcal_token');
          setGcalToken(null);
          throw new Error('Sessão expirada. Por favor, conecte novamente.');
        }
        let detailedError = 'Falha ao buscar compromissos do Google Calendar.';
        try {
          const errJson = await res.json();
          if (errJson.error?.message) {
            detailedError = `Erro do Google: ${errJson.error.message}`;
          }
        } catch (_) {}
        throw new Error(detailedError);
      }
      const data = await res.json();
      setCalendarEvents(data.items || []);
    } catch (err: any) {
      console.error(err);
      setCalendarError(err.message || 'Erro ao carregar agenda.');
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleConnectGCal = () => {
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
        client_id: clientId.trim(),
        scope: 'https://www.googleapis.com/auth/calendar.events.readonly',
        callback: (response: any) => {
          if (response.access_token) {
            setGcalToken(response.access_token);
            sessionStorage.setItem('cf_gcal_token', response.access_token);
            alert('Google Calendar conectado com sucesso!');
          } else {
            alert('Falha na autenticação do Google Calendar.');
          }
        },
      });
      client.requestAccessToken();
    } catch (err) {
      console.error(err);
      alert('Erro ao iniciar fluxo do Google Calendar. Verifique se o Client ID está correto.');
    }
  };

  useEffect(() => {
    if (gcalToken) {
      fetchCalendarEvents(gcalToken);
    }
  }, [gcalToken]);

  const filteredEvents = useMemo(() => {
    if (!calendarSearch.trim()) return calendarEvents;
    const term = calendarSearch.toLowerCase();
    return calendarEvents.filter(event => {
      const summary = (event.summary || '').toLowerCase();
      const description = (event.description || '').toLowerCase();
      const attendees = (event.attendees || []).map((a: any) => (a.email || '').toLowerCase()).join(' ');
      return summary.includes(term) || description.includes(term) || attendees.includes(term);
    });
  }, [calendarEvents, calendarSearch]);

  // Helper para agrupar compromissos da semana por dia
  const groupedEvents = useMemo(() => {
    const groups: Record<string, { date: Date; label: string; events: any[] }> = {};
    
    // Inicializa os próximos 7 dias (incluindo hoje)
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const key = d.toISOString().split('T')[0];
      const dayLabel = i === 0 
        ? 'Hoje' 
        : i === 1 
          ? 'Amanhã' 
          : d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
      
      const formattedLabel = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
      
      groups[key] = {
        date: d,
        label: formattedLabel,
        events: []
      };
    }
    
    // Distribui os eventos do calendário nos dias correspondentes
    filteredEvents.forEach(event => {
      const start = event.start?.dateTime ? new Date(event.start.dateTime) : event.start?.date ? new Date(event.start.date) : null;
      if (start) {
        const key = start.toISOString().split('T')[0];
        if (groups[key]) {
          groups[key].events.push(event);
        }
      }
    });
    
    return Object.values(groups);
  }, [filteredEvents]);

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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

            {/* Agenda do Google Calendar */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                  📅 Agenda de Compromissos (Google Calendar)
                </h3>
                {gcalToken && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => fetchCalendarEvents(gcalToken)}
                      disabled={calendarLoading}
                    >
                      {calendarLoading ? '⏳ Atualizando...' : '🔄 Sincronizar'}
                    </button>
                    <button 
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        sessionStorage.removeItem('cf_gcal_token');
                        setGcalToken(null);
                        setCalendarEvents([]);
                      }}
                    >
                      🔌 Desconectar
                    </button>
                  </div>
                )}
              </div>

              {!gcalToken ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                    Conecte sua conta do Google Calendar para visualizar e buscar compromissos de clientes diretamente por aqui.
                  </p>
                  <button className="btn btn-primary" onClick={handleConnectGCal}>
                    🔌 Conectar Google Calendar
                  </button>
                </div>
              ) : (
                <>
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <input 
                      className="form-control" 
                      placeholder="Pesquisar por cliente, título ou e-mail de participante..."
                      value={calendarSearch}
                      onChange={e => setCalendarSearch(e.target.value)}
                      style={{ fontSize: 13 }}
                    />
                  </div>

                  {calendarLoading && calendarEvents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>
                      Carregando compromissos do Google Calendar...
                    </div>
                  ) : calendarError ? (
                    <div style={{ color: 'var(--red)', fontSize: 13, background: 'var(--red-bg)', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                      {calendarError}
                    </div>
                  ) : filteredEvents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                      {calendarSearch ? 'Nenhum compromisso corresponde à pesquisa.' : 'Nenhum compromisso agendado para os próximos dias.'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxHeight: '420px', overflowY: 'auto', paddingRight: 4 }}>
                      {groupedEvents.map((group) => {
                        const hasEvents = group.events.length > 0;
                        const isGroupToday = group.label.startsWith('Hoje');
                        
                        return (
                          <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-light)', marginBottom: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: isGroupToday ? 'var(--accent)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {isGroupToday && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }}></span>}
                                {group.label}
                              </span>
                              <span className="badge badge-gray" style={{ fontSize: 9, padding: '2px 6px', fontWeight: 600 }}>
                                {group.events.length} {group.events.length === 1 ? 'evento' : 'eventos'}
                              </span>
                            </div>
                            
                            {hasEvents ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {group.events.map((event) => {
                                  const start = event.start?.dateTime ? new Date(event.start.dateTime) : event.start?.date ? new Date(event.start.date) : null;
                                  const end = event.end?.dateTime ? new Date(event.end.dateTime) : event.end?.date ? new Date(event.end.date) : null;
                                  
                                  const timeString = start && event.start?.dateTime 
                                    ? `${start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${end ? end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}` 
                                    : 'Dia Inteiro';

                                  return (
                                    <div 
                                      key={event.id}
                                      style={{ 
                                        display: 'flex', 
                                        gap: 12, 
                                        padding: '10px 12px', 
                                        background: 'var(--bg-card2)', 
                                        border: '1px solid var(--border-light)', 
                                        borderRadius: 'var(--radius-sm)',
                                        alignItems: 'center',
                                        transition: 'all 0.2s ease'
                                      }}
                                      className="calendar-event-item"
                                    >
                                      <div style={{ 
                                        background: 'var(--accent-glow)', 
                                        color: 'var(--accent-light)', 
                                        padding: '4px 8px', 
                                        borderRadius: 6, 
                                        fontSize: 10,
                                        fontWeight: 700,
                                        whiteSpace: 'nowrap'
                                      }}>
                                        ⏰ {timeString}
                                      </div>

                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <h4 style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {event.summary || 'Sem título'}
                                        </h4>
                                        {event.description && (
                                          <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {event.description}
                                          </p>
                                        )}
                                      </div>

                                      {event.htmlLink && (
                                        <a 
                                          href={event.htmlLink} 
                                          target="_blank" 
                                          rel="noopener noreferrer" 
                                          className="btn btn-secondary btn-sm"
                                          style={{ padding: '3px 8px', fontSize: 10, alignSelf: 'center', whiteSpace: 'nowrap' }}
                                        >
                                          Ver ↗
                                        </a>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 4, fontStyle: 'italic', marginBottom: 4 }}>
                                Nenhum compromisso.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Card de Auditoria e Fechamento de Caixa */}
            <div className="card">
              <h3 style={{ fontSize: 15, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                🛡️ Controle de Fechamento & Auditoria
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20, borderBottom: '1px solid var(--border-light)', paddingBottom: 16 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 12 }}>Empresa Selecionada</label>
                  <select 
                    className="form-control" 
                    value={selectedAuditEmpresaId} 
                    onChange={e => setSelectedAuditEmpresaId(e.target.value)}
                    style={{ fontSize: 13 }}
                  >
                    <option value="">Selecione uma empresa...</option>
                    {empresas.map(e => (
                      <option key={e.id} value={e.id}>{e.nomeFantasia || e.razaoSocial}</option>
                    ))}
                  </select>
                </div>
                
                {selectedAuditEmpresaId && (
                  <div>
                    <label className="form-label" style={{ fontSize: 12 }}>Bloquear Lançamentos Até</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input 
                        type="date" 
                        className="form-control" 
                        value={fechamentoDateInput} 
                        onChange={e => setFechamentoDateInput(e.target.value)}
                        style={{ fontSize: 13 }}
                      />
                      <button className="btn btn-primary btn-sm" onClick={handleSaveFechamento} style={{ fontSize: 12, padding: '4px 10px' }}>✓ Salvar</button>
                      {fechamentoDateInput && (
                        <button className="btn btn-danger btn-sm" onClick={handleClearFechamento} style={{ fontSize: 12, padding: '4px 10px' }} title="Desbloquear período">🔓</button>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                      Nenhum lançamento poderá ser criado, editado ou excluído igual ou antes desta data.
                    </span>
                  </div>
                )}
              </div>

              {selectedAuditEmpresaId ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Histórico de Auditoria (Últimos 1000 logs)</h4>
                    <input 
                      className="form-control" 
                      placeholder="🔍 Filtrar logs..." 
                      value={auditSearch} 
                      onChange={e => setAuditSearch(e.target.value)} 
                      style={{ fontSize: 12, padding: '4px 10px', width: 200 }}
                    />
                  </div>
                  
                  <div className="table-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
                    <table style={{ fontSize: 11.5 }}>
                      <thead>
                        <tr>
                          <th>Data/Hora</th>
                          <th>Usuário</th>
                          <th>Ação</th>
                          <th>Detalhes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLogs.map(l => (
                          <tr key={l.id}>
                            <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{new Date(l.timestamp).toLocaleString('pt-BR')}</td>
                            <td style={{ fontWeight: 600 }}>{l.userName}</td>
                            <td>
                              <span className={`badge ${
                                l.action === 'Criação' ? 'badge-green' : 
                                l.action === 'Edição' ? 'badge-yellow' : 
                                l.action === 'Exclusão' ? 'badge-red' : 
                                l.action === 'Bloqueio' ? 'badge-purple' : 'badge-blue'
                              }`}>
                                {l.action}
                              </span>
                            </td>
                            <td>{l.details}</td>
                          </tr>
                        ))}
                        {filteredLogs.length === 0 && (
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                              Nenhum log de auditoria registrado para esta empresa.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>
                  Selecione uma empresa acima para visualizar os logs de auditoria e configurar bloqueios.
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: 16, borderBottom: '1px solid var(--border-light)' }}>
                <h3 style={{ fontSize: 15, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>🗺️ Radar da Equipe em Campo</h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Monitoramento de geolocalização e atividades (tempo real)</p>
              </div>
              <div id="admin-map" style={{ width: '100%', height: '350px', background: '#e5e7eb' }}>
                <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', paddingTop: '140px' }}>Carregando mapa...</div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontSize: 15, marginBottom: 16 }}>📋 Worklog da Equipe</h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: '1.4' }}>
                Histórico detalhado de todas as atividades realizadas pelos consultores.
              </p>
              
              <div className="table-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
                <table style={{ fontSize: 11.5 }}>
                  <thead>
                    <tr>
                      <th>Data/Hora</th>
                      <th>Consultor</th>
                      <th>Empresa</th>
                      <th>Atividade</th>
                      <th>Duração</th>
                    </tr>
                  </thead>
                  <tbody>
                    {worklog.slice().reverse().map((l: any) => {
                      const emp = empresas.find(e => e.id === l.empresaId);
                      return (
                        <tr key={l.id}>
                          <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{new Date(l.dataFim || l.dataInicio).toLocaleString('pt-BR')}</td>
                          <td style={{ fontWeight: 600 }}>{l.consultorNome}</td>
                          <td>{emp?.nomeFantasia || emp?.razaoSocial || 'N/A'}</td>
                          <td>{l.descricao}</td>
                          <td style={{ fontWeight: 500, color: 'var(--accent)' }}>{l.duracaoMinutos ? `${l.duracaoMinutos} min` : '-'}</td>
                        </tr>
                      );
                    })}
                    {worklog.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          Nenhuma atividade registrada no histórico.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

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
              <h3 style={{ fontSize: 15, marginBottom: 16 }}>🧠 Base de Conhecimento Copilot</h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: '1.4' }}>
                Suba documentos contábeis, estratégias ou planilhas (TXT, PDF, JSON). Eles serão analisados pelo robô Privilege AI Copilot para inteligência avançada.
              </p>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <input 
                  type="file" 
                  accept=".txt,.pdf,.json,.csv,.md"
                  onChange={handleIntelDocUpload} 
                  id="intel-upload-file" 
                  style={{ display: 'none' }} 
                />
                <label 
                  htmlFor="intel-upload-file" 
                  className="btn btn-primary" 
                  style={{ 
                    width: '100%', 
                    justifyContent: 'center', 
                    gap: 8, 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: 13
                  }}
                >
                  ＋ Subir Arquivo de Inteligência
                </label>
              </div>

              {intelDocs.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, padding: '12px 0', border: '1px dashed var(--border-light)', borderRadius: 8 }}>
                  Nenhum documento carregado na base de conhecimento.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 220, overflowY: 'auto' }}>
                  {intelDocs.map(doc => {
                    const sizeKB = (doc.size / 1024).toFixed(1);
                    const isTxt = doc.type.startsWith('text/') || doc.name.endsWith('.txt') || doc.name.endsWith('.json') || doc.name.endsWith('.csv') || doc.name.endsWith('.md');
                    const downloadUrl = isTxt 
                      ? `data:text/plain;charset=utf-8,${encodeURIComponent(doc.content)}`
                      : `data:${doc.type};base64,${doc.content}`;

                    return (
                      <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--bg-card2)', borderRadius: 8, border: '1px solid var(--border-light)' }}>
                        <div style={{ minWidth: 0, flex: 1, marginRight: 8 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }} title={doc.name}>
                            📄 {doc.name}
                          </div>
                          <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>
                            {sizeKB} KB • {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <a 
                            href={downloadUrl} 
                            download={doc.name}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 10, padding: '3px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            ⬇️
                          </a>
                          <button 
                            onClick={() => handleIntelDocDelete(doc.id)}
                            className="btn btn-danger btn-sm"
                            style={{ fontSize: 10, padding: '3px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
                  {migrating ? `⏳ ${migrationProgress || 'Enviando Dados...'}` : '☁️ Enviar Dados Locais para PostgreSQL'}
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
