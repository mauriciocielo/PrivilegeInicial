'use client';
import { useState, useEffect } from 'react';
import { store, Empresa, User } from '../../../lib/store';
import { toast } from 'sonner';
import { confirmAsync } from '../../../components/ConfirmProvider';
import { useGoogleLogin } from '@react-oauth/google';

interface AgendaTask {
  id: string;
  title: string;
  empresaId: string;
  consultorId: string;
  horario: string;
  dateStr: string; // Formato YYYY-MM-DD
  completed: boolean;
  recurrent?: boolean;
  location?: string;
}

export default function AgendaPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<AgendaTask[]>([]);
  
  // Navigation State
  const [baseDate, setBaseDate] = useState<Date>(new Date());
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTask, setNewTask] = useState<Partial<AgendaTask>>({
    title: '',
    empresaId: '',
    consultorId: '',
    horario: '09:00',
    dateStr: new Date().toISOString().split('T')[0],
    recurrent: false
  });

  const getWeekData = (date: Date) => {
    const jsDate = new Date(date);
    const dow = jsDate.getDay();
    const diff = jsDate.getDate() - dow + (dow === 0 ? -6 : 1);
    const mon = new Date(jsDate.setDate(diff));
    
    const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
    return days.map((name, i) => {
      const dt = new Date(mon);
      dt.setDate(mon.getDate() + i);
      const iso = dt.toISOString().split('T')[0];
      const brStr = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth()+1).padStart(2, '0')}`;
      return { name, iso, brStr, raw: new Date(dt) };
    });
  };

  const currentWeekInfo = getWeekData(baseDate);

  const syncGoogleSilently = async (token: string) => {
    try {
      // Sync a window (like baseDate -2 weeks to +2 weeks)
      const min = new Date(baseDate); min.setDate(min.getDate() - 14);
      const max = new Date(baseDate); max.setDate(max.getDate() + 14);
      
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${min.toISOString()}&timeMax=${max.toISOString()}&singleEvents=true&orderBy=startTime`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.items) {
        let imported = 0;
        setTasks(prev => {
          const map = new Map(prev.map(t => [t.id, t]));
          data.items.forEach((ev: any) => {
             const start = new Date(ev.start.dateTime || ev.start.date);
             const hr = String(start.getHours()).padStart(2, '0');
             const mn = String(start.getMinutes()).padStart(2, '0');
             const evIso = start.toISOString().split('T')[0];
             const myId = `gcal-${ev.id}`;
             if (!map.has(myId)) {
               map.set(myId, {
                 id: myId, title: `📅 ${ev.summary}`, empresaId: '', consultorId: '',
                 horario: `${hr}:${mn}`, dateStr: evIso, completed: false, recurrent: false,
                 location: ev.location || 'Remoto / Online'
               });
               imported++;
             }
          });
          const newArr = Array.from(map.values());
          localStorage.setItem('cf_agenda_semanal', JSON.stringify(newArr));
          return newArr;
        });
        if (imported > 0) toast.success(`${imported} novos eventos sincronizados do Google!`);
      }
    } catch(err) {
      console.warn("Auto-sync failed", err);
    }
  };

  const loginGoogle = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    onSuccess: (tokenResponse) => {
      localStorage.setItem('cf_gcal_token', tokenResponse.access_token);
      toast.info('Credencial Google conectada! Importando base...');
      syncGoogleSilently(tokenResponse.access_token);
    }
  });

  useEffect(() => {
    const load = () => {
      setEmpresas(store.getEmpresas());
      setUsers(store.getUsers().filter(u => u.role !== 'cliente'));
      
      const saved = localStorage.getItem('cf_agenda_semanal');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setTasks(parsed.map((p: any) => ({
             ...p,
             // fallback migration from old 'day' field to specific 'dateStr'
             dateStr: p.dateStr || new Date().toISOString().split('T')[0]
          })));
        } catch (e) {}
      }
    };
    load();
  }, []);

  // Try auto-sync on load if token exists
  useEffect(() => {
    const t = localStorage.getItem('cf_gcal_token');
    if (t) { syncGoogleSilently(t); }
  }, [baseDate]);

  const saveTasks = (updated: AgendaTask[]) => {
    setTasks(updated);
    localStorage.setItem('cf_agenda_semanal', JSON.stringify(updated));
  };

  const handleSaveTask = () => {
    if (!newTask.title || !newTask.dateStr || !newTask.horario) {
      toast.error('Preencha os campos obrigatórios (Título, Data e Horário)!');
      return;
    }
    
    const task: AgendaTask = {
      id: Math.random().toString(36).substr(2, 9),
      title: newTask.title,
      empresaId: newTask.empresaId || '',
      consultorId: newTask.consultorId || '',
      horario: newTask.horario,
      dateStr: newTask.dateStr,
      completed: false,
      recurrent: newTask.recurrent || false
    };

    saveTasks([...tasks, task]);
    setIsModalOpen(false);
    setNewTask({ title: '', empresaId: '', consultorId: '', horario: '09:00', dateStr: new Date().toISOString().split('T')[0], recurrent: false });
  };

  const moveWeek = (dir: 1 | -1) => {
    const n = new Date(baseDate);
    n.setDate(n.getDate() + (dir * 7));
    setBaseDate(n);
  };

  const handleCopyMessage = async (task: AgendaTask, emp: Empresa | undefined, cons: User | undefined, evDate: string) => {
    const dataFormatada = `${evDate} às ${task.horario}`;
    const part = cons ? `${cons.name} (Consultoria)` : (task.id.startsWith('gcal') ? 'Participantes do Evento' : 'Equipe Privilege');
    const loc = task.location || (emp ? `Sede - ${emp.nomeFantasia}` : 'A Combinar / Online');
    
    const text = `*Nossa Agenda para essa semana:*\nData: ${dataFormatada}\nLocal: ${loc}\nParticipante: ${part}\n\n_Assunto: ${task.title}_`;
    
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Mensagem de agendamento copiada para a área de transferência!');
    } catch {
      toast.error('Erro ao copiar a mensagem.');
    }
  };

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="page-title">Agenda Consultiva Estratégica</div>
          <div className="page-subtitle">Página mapeada com Google Calendar (Auto-Sync) e Datas Calendário.</div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary btn-lg" onClick={() => loginGoogle()} style={{ background: '#fff', border: '1px solid #d1d5db', color: '#374151' }}>
             <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" style={{ width: 14, height: 14, marginRight: 6 }} />
             Conectar Conta Google
          </button>
          <button className="btn btn-primary btn-lg" onClick={() => setIsModalOpen(true)}>
            ➕ Agendar
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Navigational Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, background: 'var(--bg-card)', padding: '12px 24px', borderRadius: 12, border: '1px solid var(--border)' }}>
           <div style={{ display: 'flex', gap: 12 }}>
             <button className="btn btn-secondary" onClick={() => moveWeek(-1)}>← Semana Anterior</button>
             <button className="btn btn-secondary" onClick={() => setBaseDate(new Date())}>Hoje</button>
             <button className="btn btn-secondary" onClick={() => moveWeek(1)}>Próxima Semana →</button>
           </div>
           
           <div style={{ fontWeight: 800, fontSize: 16 }}>
             Mês Vigente: <span style={{ color: 'var(--accent)' }}>{['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][currentWeekInfo[0].raw.getMonth()]} de {currentWeekInfo[0].raw.getFullYear()}</span>
           </div>
        </div>

        {/* Dynamic Kanban Board with Current Dates */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', alignItems: 'start', minHeight: '600px', overflowX: 'auto' }}>
          {currentWeekInfo.map(dayObj => {
            const dayTasks = tasks.filter(t => t.dateStr === dayObj.iso).sort((a,b) => a.horario.localeCompare(b.horario));
            const isToday = new Date().toISOString().split('T')[0] === dayObj.iso;

            return (
              <div 
                key={dayObj.iso} 
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const taskId = e.dataTransfer.getData('taskId');
                  if (!taskId) return;
                  saveTasks(tasks.map(t => t.id === taskId ? { ...t, dateStr: dayObj.iso } : t));
                }}
                style={{ 
                  background: isToday ? 'rgba(59, 130, 246, 0.03)' : 'var(--bg-body)', 
                  border: isToday ? '2px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: '12px', padding: '16px', minHeight: '500px',
                  display: 'flex', flexDirection: 'column', gap: '12px'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '8px', borderBottom: isToday ? '2px solid var(--accent)' : '2px solid var(--border)', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: isToday ? 'var(--accent)' : 'var(--text-primary)' }}>
                       {dayObj.name}
                       {isToday && <span style={{ marginLeft: 6, fontSize: 10, background: 'var(--accent)', color: '#fff', padding: '2px 6px', borderRadius: 10 }}>Hoje</span>}
                    </h3>
                    <span className="badge badge-gray" style={{ fontSize: '11px' }}>{dayTasks.length}</span>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginTop: 4 }}>{dayObj.brStr} ({dayObj.iso})</div>
                </div>

                {dayTasks.length === 0 && <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '20px 0' }}>Livre</div>}

                {dayTasks.map(task => {
                  const emp = empresas.find(e => e.id === task.empresaId);
                  const cons = users.find(u => u.id === task.consultorId);
                  const isGoogle = task.id.startsWith('gcal');
                  const bg = isGoogle ? '#f0f4ff' : 'var(--bg-card)';
                  
                  return (
                    <div 
                      key={task.id} draggable onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
                      style={{ 
                        background: task.completed ? 'var(--bg-body)' : bg, padding: '12px', borderRadius: '8px',
                        border: '1px solid var(--border-light)', borderLeft: task.completed ? '4px solid var(--green)' : (isGoogle ? '4px solid #3b82f6' : '4px solid var(--accent)'),
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'grab', opacity: task.completed ? 0.6 : 1
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', textDecoration: task.completed ? 'line-through' : 'none', lineHeight: 1.3 }}>
                          <span style={{ color: isGoogle ? '#3b82f6' : 'var(--accent)', marginRight: '6px', fontWeight: 900 }}>{task.horario}</span>
                          {task.title}
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => handleCopyMessage(task, emp, cons, dayObj.brStr)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }} title="Copiar Mensagem do Agendamento">📋</button>
                          <button onClick={() => saveTasks(tasks.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>✅</button>
                          <button onClick={() => confirmAsync('Excluir?').then(y => y && saveTasks(tasks.filter(t => t.id !== task.id)))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>🗑️</button>
                        </div>
                      </div>
                      
                      {emp && <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.02)', padding: 4, borderRadius: 4 }}>🏢 {emp.nomeFantasia || emp.razaoSocial}</div>}
                      {!isGoogle && <div style={{ background: 'var(--bg-body)', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: '6px', fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', display: 'inline-block' }}>👤 {cons?.name || 'Desconhecido'}</div>}
                      {isGoogle && <div style={{ fontSize: '10px', color: '#3b82f6', fontWeight: 700, marginTop: 4 }}>🌐 Google Calendar Auto-Sync</div>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '450px', background: 'var(--bg-card)', padding: '24px', position: 'relative' }}>
            <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', right: 16, top: 16, background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            <h3 style={{ fontSize: 18, marginBottom: 20 }}>Novo Agendamento Estratégico</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Título da Ação</label>
                <input type="text" className="form-control" placeholder="Dashboard Report DRE" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} autoFocus/>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Empresa Audita (Opcional)</label>
                <select className="form-control" value={newTask.empresaId} onChange={e => setNewTask({...newTask, empresaId: e.target.value})}>
                  <option value="">Selecione...</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.nomeFantasia || e.razaoSocial}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Data Específica</label>
                  <input type="date" className="form-control" value={newTask.dateStr} onChange={e => setNewTask({...newTask, dateStr: e.target.value})}/>
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Horário</label>
                  <input type="time" className="form-control" value={newTask.horario} onChange={e => setNewTask({...newTask, horario: e.target.value})}/>
                </div>
              </div>

              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSaveTask}>💾 Criar Registro</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
