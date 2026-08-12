'use client';
import { useState, useEffect } from 'react';
import { store, Empresa, User } from '../../../lib/store';

interface AgendaTask {
  id: string;
  title: string;
  empresaId: string;
  consultorId: string;
  horario: string;
  day: 'Segunda' | 'Terça' | 'Quarta' | 'Quinta' | 'Sexta';
  completed: boolean;
  recurrent?: boolean;
}

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'] as const;

export default function AgendaPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<AgendaTask[]>([]);
  
  // States para nova tarefa
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTask, setNewTask] = useState<Partial<AgendaTask>>({
    day: 'Segunda',
    title: '',
    empresaId: '',
    consultorId: '',
    horario: '09:00',
    recurrent: false
  });

  useEffect(() => {
    const load = () => {
      setEmpresas(store.getEmpresas());
      setUsers(store.getUsers().filter(u => u.role !== 'cliente')); // Mostrar apenas equipe

      const saved = localStorage.getItem('cf_agenda_semanal');
      if (saved) {
        try {
          setTasks(JSON.parse(saved));
        } catch (e) {}
      }
    };
    load();
    window.addEventListener('cfDataChange', load);
    return () => window.removeEventListener('cfDataChange', load);
  }, []);

  const saveTasks = (updated: AgendaTask[]) => {
    setTasks(updated);
    localStorage.setItem('cf_agenda_semanal', JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('cfDataChange', { detail: { key: 'cf_agenda_semanal' } }));
  };

  const handleSaveTask = () => {
    if (!newTask.title || !newTask.empresaId || !newTask.consultorId || !newTask.day || !newTask.horario) {
      alert('Preencha os campos obrigatórios (Título, Empresa, Consultor, Horário e Dia)!');
      return;
    }
    
    const task: AgendaTask = {
      id: Math.random().toString(36).substr(2, 9),
      title: newTask.title,
      empresaId: newTask.empresaId,
      consultorId: newTask.consultorId,
      horario: newTask.horario,
      day: newTask.day as any,
      completed: false,
      recurrent: newTask.recurrent || false
    };

    saveTasks([...tasks, task]);
    setIsModalOpen(false);
    setNewTask({ day: 'Segunda', title: '', empresaId: '', consultorId: '', horario: '09:00', recurrent: false });
  };

  const handleDelete = (id: string) => {
    if (confirm('Deseja excluir este agendamento?')) {
      saveTasks(tasks.filter(t => t.id !== id));
    }
  };

  const handleToggleComplete = (id: string) => {
    saveTasks(tasks.map(t => {
      if (t.id === id) return { ...t, completed: !t.completed };
      return t;
    }));
  };

  // HTML5 Drag and Drop events
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('taskId', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetDay: 'Segunda' | 'Terça' | 'Quarta' | 'Quinta' | 'Sexta') => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId) return;

    saveTasks(tasks.map(t => {
      if (t.id === taskId) return { ...t, day: targetDay };
      return t;
    }));
  };

  const handleStartNewWeek = () => {
    if (confirm('Deseja iniciar uma nova semana? As tarefas não-recorrentes já concluídas serão removidas e as recorrentes serão desmarcadas como concluídas para se repetir.')) {
      const updated = tasks
        .filter(t => !t.completed || t.recurrent)
        .map(t => {
          if (t.recurrent) return { ...t, completed: false };
          return t;
        });
      saveTasks(updated);
    }
  };

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="page-title">Agenda Semanal</div>
          <div className="page-subtitle">Organize e distribua os atendimentos a clientes na semana</div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary btn-lg" onClick={handleStartNewWeek} title="Inicia uma nova semana limpando agendas passadas.">
            🔄 Nova Semana
          </button>
          <button className="btn btn-primary btn-lg" onClick={() => setIsModalOpen(true)}>
            ➕ Novo Agendamento
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Kanban Board Container */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(5, 1fr)', 
          gap: '16px', 
          alignItems: 'start',
          minHeight: '600px',
          overflowX: 'auto'
        }}>
          {DAYS.map(day => {
            const dayTasks = tasks.filter(t => t.day === day).sort((a,b) => a.horario.localeCompare(b.horario));
            return (
              <div 
                key={day} 
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, day)}
                style={{ 
                  background: 'var(--bg-body)', 
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '16px',
                  minHeight: '400px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '2px solid var(--accent)', paddingBottom: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>{day}</h3>
                  <span className="badge badge-gray" style={{ fontSize: '11px' }}>{dayTasks.length}</span>
                </div>

                {dayTasks.length === 0 && (
                  <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '20px 0' }}>
                    Solte uma tarefa aqui
                  </div>
                )}

                {dayTasks.map(task => {
                  const emp = empresas.find(e => e.id === task.empresaId);
                  const cons = users.find(u => u.id === task.consultorId);
                  
                  return (
                    <div 
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      style={{ 
                        background: 'var(--bg-card)', 
                        padding: '12px', 
                        borderRadius: '8px',
                        border: '1px solid var(--border-light)',
                        borderLeft: task.completed ? '4px solid var(--green)' : '4px solid var(--accent)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        cursor: 'grab',
                        opacity: task.completed ? 0.6 : 1,
                        transition: 'opacity 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', textDecoration: task.completed ? 'line-through' : 'none' }}>
                          <span style={{ color: 'var(--accent)', marginRight: '6px' }}>{task.horario}</span>
                          {task.recurrent && <span style={{ marginRight: '4px' }} title="Recorrente Semanal">🔁</span>}
                          {task.title}
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button 
                            onClick={() => handleToggleComplete(task.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                            title="Marcar Concluído"
                          >
                            {task.completed ? '✅' : '⬜'}
                          </button>
                          <button 
                            onClick={() => handleDelete(task.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                            title="Excluir"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>🏢</span> {emp?.nomeFantasia || emp?.razaoSocial || 'Empresa removida'}
                      </div>
                      
                      <div style={{ background: 'var(--bg-body)', padding: '4px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', display: 'inline-block' }}>
                        👤 {cons?.name || 'Desconhecido'}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal para Nova Tarefa */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.5)', zIndex: 1000, 
          display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '450px', background: 'var(--bg-card)', padding: '24px', position: 'relative' }}>
            <button 
              onClick={() => setIsModalOpen(false)}
              style={{ position: 'absolute', right: 16, top: 16, background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              ✕
            </button>
            
            <h3 style={{ fontSize: 18, marginBottom: 20 }}>Novo Agendamento</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>O que será feito?</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Ex: Reunião DRE, Fechamento mensal..."
                  value={newTask.title} 
                  onChange={e => setNewTask({...newTask, title: e.target.value})}
                  autoFocus
                />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Empresa / Cliente</label>
                <select 
                  className="form-control" 
                  value={newTask.empresaId} 
                  onChange={e => setNewTask({...newTask, empresaId: e.target.value})}
                >
                  <option value="">Selecione...</option>
                  {empresas.map(e => (
                    <option key={e.id} value={e.id}>{e.nomeFantasia || e.razaoSocial}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Consultor Responsável</label>
                <select 
                  className="form-control" 
                  value={newTask.consultorId} 
                  onChange={e => setNewTask({...newTask, consultorId: e.target.value})}
                >
                  <option value="">Selecione...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Dia da Semana</label>
                  <select 
                    className="form-control" 
                    value={newTask.day} 
                    onChange={e => setNewTask({...newTask, day: e.target.value as any})}
                  >
                    {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Horário</label>
                  <input 
                    type="time" 
                    className="form-control" 
                    value={newTask.horario} 
                    onChange={e => setNewTask({...newTask, horario: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '12px', background: 'var(--bg-body)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <input 
                    type="checkbox" 
                    checked={newTask.recurrent || false}
                    onChange={e => setNewTask({...newTask, recurrent: e.target.checked})}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span>🔁 <b>Atividade Recorrente</b> (Limpar a semana manterá esta)</span>
                </label>
              </div>

              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSaveTask}>💾 Criar Tarefa</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
