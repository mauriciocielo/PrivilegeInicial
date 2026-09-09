'use client';
import { useState, useEffect } from 'react';
import { store, Empresa } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import { toast } from 'sonner';
import { confirmAsync } from '../../../components/ConfirmProvider';

interface AtividadeLog {
  id: string;
  empresaId: string;
  descricao: string;
  tempoSegundos: number;
  data: string;
  localizacao: { lat: number; lng: number } | null;
  fotoInicio?: string | null;
  fotoFim?: string | null;
}

interface AgendaTask {
  id: string;
  title: string;
  empresaId: string;
  consultorId: string;
  horario: string;
  day: string;
  completed: boolean;
}

export default function AtividadesTempoPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('');
  const [atividades, setAtividades] = useState<AtividadeLog[]>([]);
  const [agendaTasks, setAgendaTasks] = useState<AgendaTask[]>([]);
  
  // Cronômetro
  const [isRunning, setIsRunning] = useState(false);
  const [timePassed, setTimePassed] = useState(0);
  const [atividadeDesc, setAtividadeDesc] = useState('');
  const [modoAtividade, setModoAtividade] = useState<'avulsa' | 'agenda'>('avulsa');
  const [selectedAgendaTaskId, setSelectedAgendaTaskId] = useState<string | null>(null);
  
  // Fotos de Comprovação
  const [fotoInicio, setFotoInicio] = useState<string | null>(null);
  const [fotoFim, setFotoFim] = useState<string | null>(null);
  
  // Geolocalização
  const [position, setPosition] = useState<{ lat: number, lng: number } | null>(null);
  const [geoError, setGeoError] = useState('');

  // PWA Install Prompt
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const loadFromLocal = () => {
    try {
      setAtividades(store.getAtividadesLog());
    } catch (e) {}

    const savedTasks = localStorage.getItem('cf_agenda_semanal');
    if (savedTasks) {
      try {
        const parsed = JSON.parse(savedTasks);
        // Exibe todas as tarefas não concluídas para que quem estiver logado possa selecioná-las
        setAgendaTasks(parsed.filter((t: AgendaTask) => !t.completed));
      } catch (e) {}
    }
  };

  useEffect(() => {
    setEmpresas(store.getEmpresas());
    loadFromLocal();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        err => setGeoError('Não foi possível obter a localização. Verifique as permissões de GPS do navegador.')
      );
    } else {
      setGeoError('Geolocalização não suportada no seu navegador.');
    }

    // Busca o estado real das atividades em andamento no servidor — garante que
    // atividades iniciadas em outro dispositivo (ex: celular) apareçam aqui também.
    fetch('/api/atividades-ativas')
      .then(res => res.ok ? res.json() : null)
      .then(list => {
        if (Array.isArray(list)) {
          localStorage.setItem('cf_atividades_ativas', JSON.stringify(list));
          window.dispatchEvent(new Event('cfMapDataReceived'));
        }
      })
      .catch(() => {});

    // Mantém a lista de atividades registradas em tempo real quando outro
    // usuário/dispositivo salva ou exclui um registro (via sync/WebSocket).
    window.addEventListener('cfDataChange', loadFromLocal);
    return () => window.removeEventListener('cfDataChange', loadFromLocal);
  }, []);

  // --- BACKGROUND TIMER REFACTOR ---
  const [startTimeMs, setStartTimeMs] = useState<number | null>(null);

  useEffect(() => {
    // Restaurar estado do timer no carregamento
    const savedState = localStorage.getItem('cf_user_timer_state');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        if (state.isRunning && state.startTimeMs) {
          setStartTimeMs(state.startTimeMs);
          setSelectedEmpresaId(state.empresaId || '');
          setAtividadeDesc(state.descricao || '');
          if (state.fotoInicio) setFotoInicio(state.fotoInicio);
          setIsRunning(true);
          setTimePassed(Math.floor((Date.now() - state.startTimeMs) / 1000));
        }
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const syncTime = () => {
      if (isRunning && startTimeMs) {
        setTimePassed(Math.floor((Date.now() - startTimeMs) / 1000));
      }
    };

    if (isRunning && startTimeMs) {
      syncTime(); // Sincroniza de imediato
      interval = setInterval(syncTime, 1000);
      
      // Quando dispositivo móvel "acordar" tela ou sair de minimização
      document.addEventListener('visibilitychange', syncTime);
    }
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', syncTime);
    };
  }, [isRunning, startTimeMs]);
  // ---------------------------------

  const handleSelectAgendaTask = (taskId: string) => {
    const task = agendaTasks.find(t => t.id === taskId);
    if (task) {
      setSelectedEmpresaId(task.empresaId);
      setAtividadeDesc(task.title);
    }
  };

  const processFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  };

  const handleCaptureFotoInicio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFotoInicio(await processFileToBase64(file));
  };

  const handleCaptureFotoFim = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFotoFim(await processFileToBase64(file));
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const updateEstadoEmAndamento = async (ativo: boolean) => {
    const me = store.getCurrentUser();
    if (!me) return;
    
    let list = [];
    try { 
      list = JSON.parse(localStorage.getItem('cf_atividades_ativas') || '[]'); 
    } catch (e) {}
    
    list = list.filter((a: any) => a.consultorId !== me.id);
    
    if (ativo) {
      list.push({
        consultorId: me.id,
        consultorNome: me.name,
        empresaId: selectedEmpresaId,
        descricao: atividadeDesc.trim() || 'Atividade não detalhada',
        dataInicio: new Date().toISOString(),
        localizacao: position,
        fotoInicio
      });
    }
    localStorage.setItem('cf_atividades_ativas', JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('cfMapBroadcast', { detail: list }));

    // Persiste no servidor para que outros dispositivos/usuários vejam o estado
    // atual ao carregar a página (não dependam apenas do WebSocket estar aberto).
    try {
      await fetch('/api/atividades-ativas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(list),
      });
    } catch (e) {
      console.error('Erro ao sincronizar atividades ativas com o servidor:', e);
    }
  };

  const handleStart = () => {
    if (!fotoInicio) {
      toast.error('Bloqueado: É obrigatório anexar a Foto de Início para comprovar sua presença antes de iniciar a tarefa.');
      return;
    }
    if (!selectedEmpresaId) {
      toast.error('Selecione uma empresa antes de iniciar o tempo.');
      return;
    }
    
    // Background Persistency setup
    const now = Date.now();
    setStartTimeMs(now);
    setTimePassed(0);
    setIsRunning(true);
    
    localStorage.setItem('cf_user_timer_state', JSON.stringify({
      isRunning: true,
      startTimeMs: now,
      empresaId: selectedEmpresaId,
      descricao: atividadeDesc,
      fotoInicio: fotoInicio
    }));

    updateEstadoEmAndamento(true);
  };
  
  const handleStopOperation = () => {
    setIsRunning(false);
    localStorage.removeItem('cf_user_timer_state'); 
    updateEstadoEmAndamento(false);
  };
  
  const handleReset = async () => {
    if ((await confirmAsync('Deseja realmente zerar o cronômetro e remover as fotos?'))) {
      setIsRunning(false);
      setTimePassed(0);
      setStartTimeMs(null);
      setFotoInicio(null);
      setFotoFim(null);
      setSelectedAgendaTaskId(null);
      localStorage.removeItem('cf_user_timer_state');
      updateEstadoEmAndamento(false);
    }
  };

  const handleStopAndSave = () => {
    if (!atividadeDesc.trim()) {
      toast.error('Por favor, informe a descrição da atividade antes de salvar.');
      return;
    }
    if (!selectedEmpresaId) {
      toast.error('Por favor, selecione uma empresa.');
      return;
    }
    if (timePassed === 0) {
      toast.success('O tempo registrado está zerado.');
      return;
    }
    if (!fotoFim) {
      toast.error('Bloqueado: É obrigatório anexar a Foto de Fim para comprovar a conclusão antes de salvar a tarefa.');
      return;
    }
    
    setIsRunning(false);
    localStorage.removeItem('cf_user_timer_state');
    updateEstadoEmAndamento(false);
    
    const novaAtividade: AtividadeLog = {
      id: Math.random().toString(36).substr(2, 9),
      empresaId: selectedEmpresaId,
      descricao: atividadeDesc,
      tempoSegundos: timePassed,
      data: new Date().toISOString(),
      localizacao: position,
      fotoInicio,
      fotoFim
    };
    
    // Conclui na agenda se selecionado
    if (selectedAgendaTaskId) {
      const savedTasks = localStorage.getItem('cf_agenda_semanal');
      if (savedTasks) {
        try {
          const parsed = JSON.parse(savedTasks);
          const updatedTasks = parsed.map((t: any) => {
            if (t.id === selectedAgendaTaskId) {
              return { ...t, completed: true };
            }
            return t;
          });
          store.saveAgendaTasks(updatedTasks);
          setAgendaTasks(agendaTasks.filter(t => t.id !== selectedAgendaTaskId));
        } catch (e) {}
      }
    }
    
    store.saveAtividadeLog(novaAtividade);
    setAtividades(store.getAtividadesLog());
    window.dispatchEvent(new CustomEvent('cfDataChange', { detail: { key: 'cf_atividades_log' } }));

    setAtividadeDesc('');
    setTimePassed(0);
    setSelectedEmpresaId('');
    setFotoInicio(null);
    setFotoFim(null);
    setSelectedAgendaTaskId(null);
    
    toast.success('✅ Atividade registrada com sucesso!');
  };

  const handleDelete = async (id: string) => {
    if ((await confirmAsync('Deseja excluir este registro de atividade?'))) {
      // Pelo store: além da proteção contra armazenamento cheio, registra a
      // exclusão para o servidor — antes o item era apagado só aqui e voltava
      // na sincronização seguinte, vindo do banco.
      store.deleteAtividadeLog(id);
      setAtividades(store.getAtividadesLog());
    }
  };

  const mapUrl = position 
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${position.lng - 0.005}%2C${position.lat - 0.005}%2C${position.lng + 0.005}%2C${position.lat + 0.005}&layer=mapnik&marker=${position.lat}%2C${position.lng}`
    : '';

  return (
    <>
      <style>{`
        @keyframes handSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .clock-hand-spin {
          transform-origin: 12px 12px;
          animation: handSpin 1.5s linear infinite;
        }
        .atividades-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(300px, 1fr);
          gap: 24px;
        }
        .photos-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 24px;
        }
        .btn-group-timer {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .btn-mobile-full {
          flex: 1;
        }
        .history-item {
          padding: 16px;
          background: var(--bg-card2);
          border: 1px solid var(--border);
          border-radius: 8px;
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }
        .history-time {
          background: var(--border-light);
          padding: 12px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 18px;
          color: var(--text-primary);
          min-width: 95px;
          text-align: center;
        }
        
        @media (max-width: 768px) {
          .atividades-layout {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .photos-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .btn-group-timer {
            flex-direction: column;
          }
          .btn-mobile-full {
            width: 100% !important;
            flex: none !important;
            padding: 24px !important;
            font-size: 18px !important;
            border-radius: 12px;
          }
          .time-display {
            font-size: 56px !important;
            margin-bottom: 8px;
          }
          .history-item {
            flex-direction: column !important;
          }
          .history-time {
            width: 100% !important;
          }
          .history-action {
            width: 100% !important;
            padding: 12px !important;
          }
          .page-header {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 16px !important;
          }
          .header-actions {
            width: 100% !important;
            margin-top: 8px;
          }
          .header-actions button {
            width: 100% !important;
            padding: 12px !important;
          }
        }
      `}</style>

      <div className="page-header">
        <div>
          <div className="page-title">Atividades e Tempos</div>
          <div className="page-subtitle">Controle suas horas de consultoria, tarefas e localização</div>
        </div>
        <div className="header-actions">
           {deferredPrompt && (
              <button 
                className="btn" 
                style={{ background: '#ec4899', color: '#fff', border: 'none', fontWeight: 700 }}
                onClick={() => {
                  deferredPrompt.prompt();
                  deferredPrompt.userChoice.then(() => setDeferredPrompt(null));
                }}
              >
                📲 Instalar no Celular (Modo Offline)
              </button>
           )}
        </div>
      </div>

      <div className="page-body">
        <div className="atividades-layout">
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card">
              <h3 style={{ fontSize: 16, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                ⏱️ Tracker de Tempo
              </h3>
              
              <div style={{ 
                background: isRunning ? '#0f172a' : 'var(--bg-body)', 
                padding: '48px 24px', 
                borderRadius: '24px', 
                textAlign: 'center', 
                marginBottom: '32px', 
                color: isRunning ? '#fff' : 'var(--text-primary)',
                boxShadow: isRunning ? '0 20px 50px rgba(59, 130, 246, 0.4)' : 'inset 0 4px 20px rgba(0,0,0,0.05)',
                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                border: isRunning ? '1px solid #1e293b' : '1px solid var(--border-light)'
              }}>
                <div className="time-display" style={{ 
                   fontSize: '84px', 
                   fontWeight: 900, 
                   fontFamily: '"SF Mono", "Roboto Mono", monospace', 
                   letterSpacing: '2px', 
                   textShadow: isRunning ? '0 0 40px #3b82f6' : 'none', 
                   lineHeight: 1,
                   display: 'flex',
                   alignItems: 'center',
                   justifyContent: 'center',
                   gap: 16
                }}>
                   {isRunning && (
                     <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible' }}>
                       {/* Clock Body */}
                       <circle cx="12" cy="12" r="10" stroke="#3b82f6" fill="rgba(59, 130, 246, 0.1)"></circle>
                       <circle cx="12" cy="12" r="1" fill="#60a5fa" stroke="none"></circle>
                       {/* Top Button / StopWatch visual components */}
                       <line x1="12" y1="2" x2="12" y2="0" stroke="#3b82f6" strokeWidth="3"></line>
                       <line x1="16.24" y1="3.76" x2="18" y2="2" stroke="#3b82f6"></line>
                       {/* Spinning Minute Hand */}
                       <line x1="12" y1="12" x2="12" y2="6" className="clock-hand-spin"></line>
                     </svg>
                   )}
                   {formatTime(timePassed)}
                </div>
                {isRunning ? (
                  <div style={{ fontSize: 14, color: '#60a5fa', marginTop: 24, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase' }} className="pulse-glow">
                    🔵 GRAVANDO TEMPO DE CONSULTORIA
                  </div>
                ) : (
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 24, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
                    SISTEMA EM MODO DE ESPERA
                  </div>
                )}
              </div>

              {(!isRunning && timePassed === 0) ? (
                <>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'var(--bg-body)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <button 
                      className="btn"
                      style={{ flex: 1, background: modoAtividade === 'avulsa' ? 'var(--accent)' : 'transparent', color: modoAtividade === 'avulsa' ? '#fff' : 'var(--text-primary)', border: 'none', fontWeight: 600, padding: '12px' }}
                      onClick={() => setModoAtividade('avulsa')}
                    >
                      ⚡ Nova Rápida
                    </button>
                    <button 
                      className="btn"
                      style={{ flex: 1, background: modoAtividade === 'agenda' ? 'var(--accent)' : 'transparent', color: modoAtividade === 'agenda' ? '#fff' : 'var(--text-primary)', border: 'none', fontWeight: 600, padding: '12px' }}
                      onClick={() => setModoAtividade('agenda')}
                    >
                      📅 Agendadas
                    </button>
                  </div>

                  {modoAtividade === 'agenda' ? (
                    <div style={{ marginBottom: '24px' }}>
                      {agendaTasks.length === 0 ? (
                        <div style={{ background: 'var(--bg-body)', padding: '24px', borderRadius: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          Você não tem tarefas agendadas pendentes na sua agenda semanal.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 300, overflowY: 'auto' }}>
                          {agendaTasks.map(t => {
                            const et = empresas.find(em => em.id === t.empresaId);
                            const isSelected = selectedAgendaTaskId === t.id;
                            return (
                              <div 
                                key={t.id} 
                                onClick={() => { setSelectedAgendaTaskId(t.id); setSelectedEmpresaId(t.empresaId); setAtividadeDesc(t.title); }}
                                style={{ 
                                  padding: '16px', 
                                  borderRadius: '8px', 
                                  border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                                  background: isSelected ? 'var(--accent-light)' : 'var(--bg-body)',
                                  cursor: 'pointer',
                                  display: 'flex', gap: 12, alignItems: 'center'
                                }}
                              >
                                <div style={{ fontSize: 24 }}>{isSelected ? '☑️' : '🗓️'}</div>
                                <div>
                                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t.title}</div>
                                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                    {t.day} às {t.horario} - {et?.nomeFantasia || et?.razaoSocial}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '24px' }}>
                      <div>
                        <label className="form-label" style={{ fontWeight: 600 }}>Empresa / Cliente *</label>
                        <select 
                          className="form-control form-control-lg"
                          value={selectedEmpresaId} 
                          onChange={e => setSelectedEmpresaId(e.target.value)}
                        >
                          <option value="">-- Selecione a Empresa --</option>
                          {empresas.map(e => (
                            <option key={e.id} value={e.id}>{e.nomeFantasia || e.razaoSocial}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '24px', opacity: 0.8 }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600 }}>Empresa / Cliente</label>
                    <select 
                      className="form-control form-control-lg"
                      value={selectedEmpresaId} 
                      disabled
                    >
                      <option value="">-- Selecione a Empresa --</option>
                      {empresas.map(e => (
                        <option key={e.id} value={e.id}>{e.nomeFantasia || e.razaoSocial}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600 }}>Resumo da Atividade Concluída *</label>
                    <textarea 
                      className="form-control form-control-lg"
                      rows={3} 
                      placeholder="Descreva o que foi feito nesta operação..."
                      value={atividadeDesc} 
                      onChange={e => setAtividadeDesc(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Photos Panel */}
              <div className="photos-grid" style={{ gridTemplateColumns: (!isRunning && timePassed > 0) ? '1fr 1fr' : '1fr' }}>
                {timePassed === 0 && (
                  <div style={{ border: '1px dashed var(--border)', padding: '16px', borderRadius: '8px', textAlign: 'center', background: 'var(--bg-body)' }}>
                    <h4 style={{ fontSize: 13, marginBottom: 12 }}>📷 Comprovação de Início (Obrigatória)</h4>
                    {fotoInicio ? (
                      <div style={{ position: 'relative' }}>
                        <img src={fotoInicio} alt="Início" style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '4px' }} />
                        <button className="btn btn-sm btn-danger" style={{ position: 'absolute', top: 4, right: 4 }} onClick={() => setFotoInicio(null)}>X</button>
                      </div>
                    ) : (
                      <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-block' }}>
                        Anexar/Tirar Foto
                        <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleCaptureFotoInicio} />
                      </label>
                    )}
                  </div>
                )}
                
                {(!isRunning && timePassed > 0) && (
                  <>
                    <div style={{ border: '1px solid var(--border-light)', padding: '16px', borderRadius: '8px', textAlign: 'center', background: 'var(--bg-body)' }}>
                      <h4 style={{ fontSize: 13, marginBottom: 12 }}>📷 Início (Concluída)</h4>
                      {fotoInicio && <img src={fotoInicio} alt="Início" style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '4px', opacity: 0.8 }} />}
                    </div>
                    <div style={{ border: '1px dashed var(--accent)', padding: '16px', borderRadius: '8px', textAlign: 'center', background: 'var(--accent-light)' }}>
                      <h4 style={{ fontSize: 13, marginBottom: 12, color: 'var(--accent)' }}>📷 Finalizar Tarefa (Obrigatória)</h4>
                      {fotoFim ? (
                        <div style={{ position: 'relative' }}>
                          <img src={fotoFim} alt="Fim" style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '4px' }} />
                          <button className="btn btn-sm btn-danger" style={{ position: 'absolute', top: 4, right: 4 }} onClick={() => setFotoFim(null)}>X</button>
                        </div>
                      ) : (
                        <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer', display: 'inline-block', fontWeight: 600 }}>
                          Anexar/Tirar Foto
                          <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleCaptureFotoFim} />
                        </label>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="btn-group-timer">
                {(!isRunning && timePassed === 0) ? (
                  <button 
                    className="btn btn-primary btn-lg btn-mobile-full pulse-bg" 
                    onClick={handleStart} 
                    style={{ fontWeight: 800, fontSize: '18px', padding: '24px', borderRadius: '16px', background: '#3b82f6', border: 'none', color: '#fff', boxShadow: '0 8px 30px rgba(59, 130, 246, 0.4)', transition: 'all 0.3s' }}
                  >
                    ▶ INICIAR OPERAÇÃO AGORA
                  </button>
                ) : isRunning ? (
                  <button 
                    className="btn btn-danger btn-lg btn-mobile-full" 
                    onClick={handleStopOperation} 
                    style={{ background: 'var(--red)', border: 'none', color: '#fff', fontWeight: 800, fontSize: '18px', padding: '24px', borderRadius: '16px', boxShadow: '0 8px 30px rgba(239, 68, 68, 0.4)', transition: 'all 0.3s' }}
                  >
                    ⏹ PARAR O TEMPO E ENCERRAR
                  </button>
                ) : (
                  <button 
                    className="btn btn-success btn-lg btn-mobile-full" 
                    onClick={handleStopAndSave} 
                    style={{ background: 'var(--green)', border: 'none', color: '#fff', fontWeight: 800, fontSize: '18px', padding: '24px', borderRadius: '16px', boxShadow: '0 8px 30px rgba(16, 185, 129, 0.4)', transition: 'all 0.3s' }}
                  >
                    💾 FINALIZAR CHECK-OUT E SALVAR
                  </button>
                )}
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                📋 Histórico Recente de Atividades
              </h3>
              
              {atividades.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontStyle: 'italic', background: 'var(--bg-body)', borderRadius: '8px' }}>
                  Nenhum registro de atividade salvo ainda.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {atividades.map((ativ) => {
                    const emp = empresas.find(e => e.id === ativ.empresaId);
                    return (
                      <div key={ativ.id} className="history-item">
                        <div className="history-time">
                          {formatTime(ativ.tempoSegundos)}
                        </div>
                        <div style={{ flex: 1, width: '100%' }}>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: 'var(--text-primary)' }}>{emp?.nomeFantasia || emp?.razaoSocial || 'Empresa não encontrada'}</h4>
                          <p style={{ margin: '0 0 6px 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>{ativ.descricao}</p>
                          
                          {(ativ.fotoInicio || ativ.fotoFim) && (
                            <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 8 }}>
                              {ativ.fotoInicio && (
                                <img 
                                  src={ativ.fotoInicio === '__PRUNED_IN_LOCAL_STAGE__' ? `/api/atividades/foto?id=${ativ.id}&tipo=inicio` : ativ.fotoInicio} 
                                  alt="Início" 
                                  style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border)' }} 
                                  onClick={() => window.open(ativ.fotoInicio === '__PRUNED_IN_LOCAL_STAGE__' ? `/api/atividades/foto?id=${ativ.id}&tipo=inicio` : ativ.fotoInicio!, '_blank')} 
                                />
                              )}
                              {ativ.fotoFim && (
                                <img 
                                  src={ativ.fotoFim === '__PRUNED_IN_LOCAL_STAGE__' ? `/api/atividades/foto?id=${ativ.id}&tipo=fim` : ativ.fotoFim} 
                                  alt="Fim" 
                                  style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border)' }} 
                                  onClick={() => window.open(ativ.fotoFim === '__PRUNED_IN_LOCAL_STAGE__' ? `/api/atividades/foto?id=${ativ.id}&tipo=fim` : ativ.fotoFim!, '_blank')} 
                                />
                              )}
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: 12, fontSize: '11px', color: 'var(--text-muted)' }}>
                            <span>📅 {fmt.date(ativ.data)} às {new Date(ativ.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                            {ativ.localizacao && (
                              <span title={`Lat: ${ativ.localizacao.lat}, Lng: ${ativ.localizacao.lng}`}>📍 GPS Salvo</span>
                            )}
                          </div>
                        </div>
                        <button className="btn btn-secondary btn-sm history-action" onClick={() => handleDelete(ativ.id)}>
                          Excluir
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card" style={{ height: 'fit-content' }}>
              <h3 style={{ fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                📍 Sua Localização Atual
              </h3>
              
              {geoError ? (
                <div style={{ padding: '20px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: '8px', fontSize: '13px', textAlign: 'center', fontWeight: 600 }}>
                  ⚠️ {geoError}
                </div>
              ) : !position ? (
                <div style={{ padding: '40px', background: 'var(--bg-body)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  ⏳ Obtendo coordenadas do GPS...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ 
                    borderRadius: '12px', 
                    overflow: 'hidden', 
                    border: '1px solid var(--border)',
                    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)' 
                  }}>
                    <iframe
                      width="100%"
                      height="350"
                      style={{ border: 0, display: 'block' }}
                      src={mapUrl}
                      title="Localização do Consultor"
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-body)', padding: '10px 14px', borderRadius: '8px' }}>
                    <span>**Latitude:** {position.lat.toFixed(6)}</span>
                    <span>**Longitude:** {position.lng.toFixed(6)}</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, padding: '0 4px' }}>
                    O GPS está ativo. Ao salvar uma atividade, estas coordenadas serão ancoradas ao registro para auditoria de visita ao cliente.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
