'use client';
import { useEffect, useMemo, useState } from 'react';
import { store, Empresa, User, AgendaTask } from '../../../lib/store';
import { toast } from 'sonner';
import { confirmAsync } from '../../../components/ConfirmProvider';
import { useGoogleLogin } from '@react-oauth/google';
import { ChevronLeft, ChevronRight, Plus, Trash2, Check, Copy, X, Edit2 } from 'lucide-react';

// A interface AgendaTask vive em lib/store.ts, junto com os métodos que
// persistem a agenda — manter uma cópia local aqui já causou divergência de
// tipos entre as duas.

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

const pad2 = (n: number) => String(n).padStart(2, '0');
/**
 * Data local no formato YYYY-MM-DD. Nunca usar `toISOString()` para isso —
 * ela converte pra UTC, e no fuso do Brasil (UTC-3) isso pode devolver o dia
 * seguinte perto da meia-noite, desalinhando "hoje" e os cliques no calendário.
 */
const toIsoLocal = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const hojeIso = () => toIsoLocal(new Date());

interface DiaGrade {
  date: Date;
  iso: string;
  noMes: boolean;
  isHoje: boolean;
}

function gerarGradeDoMes(base: Date): DiaGrade[] {
  const ano = base.getFullYear();
  const mes = base.getMonth();
  const primeiroDoMes = new Date(ano, mes, 1);
  const inicioGrade = new Date(ano, mes, 1 - primeiroDoMes.getDay());
  const hoje = hojeIso();
  const dias: DiaGrade[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicioGrade.getFullYear(), inicioGrade.getMonth(), inicioGrade.getDate() + i);
    const iso = toIsoLocal(d);
    dias.push({ date: d, iso, noMes: d.getMonth() === mes, isHoje: iso === hoje });
  }
  return dias;
}

function gerarGradeDaSemana(base: Date): DiaGrade[] {
  const inicio = new Date(base);
  inicio.setDate(inicio.getDate() - inicio.getDay());
  const hoje = hojeIso();
  const dias: DiaGrade[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
    const iso = toIsoLocal(d);
    dias.push({ date: d, iso, noMes: true, isHoje: iso === hoje });
  }
  return dias;
}

export default function AgendaPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<AgendaTask[]>([]);
  const [mounted, setMounted] = useState(false);

  const [view, setView] = useState<'month' | 'week'>('month');
  const [baseDate, setBaseDate] = useState<Date>(new Date());
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTask, setNewTask] = useState<Partial<AgendaTask>>({
    title: '', empresaId: '', consultorId: '', horario: '09:00', dateStr: hojeIso(), recurrent: false,
  });

  const [googleConectado, setGoogleConectado] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);

  useEffect(() => {
    setMounted(true);
    setGoogleConectado(!!localStorage.getItem('cf_gcal_token'));
  }, []);

  useEffect(() => {
    const load = () => {
      setEmpresas(store.getEmpresas());
      setUsers(store.getUsers().filter(u => u.role !== 'cliente'));
      setTasks(store.getAgendaTasks());
    };
    load();
    window.addEventListener('cfDataChange', load);
    return () => window.removeEventListener('cfDataChange', load);
  }, []);

  /**
   * `silencioso=true` é usado no auto-sync ao trocar de mês (não incomoda o
   * usuário se falhar); `silencioso=false` é o clique manual em "Sincronizar
   * agora" — aí o erro real do Google precisa aparecer, porque antes essa
   * função só dava `return` em qualquer falha (token expirado, Calendar API
   * desabilitada no projeto do Google Cloud, escopo insuficiente...) sem
   * avisar nada — parecia que "não sincroniza" quando na verdade a chamada
   * estava sendo rejeitada silenciosamente.
   */
  const syncGoogle = async (token: string, ref: Date, silencioso: boolean) => {
    if (!silencioso) setSincronizando(true);
    try {
      const min = new Date(ref); min.setDate(min.getDate() - 31);
      const max = new Date(ref); max.setDate(max.getDate() + 31);

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${min.toISOString()}&timeMax=${max.toISOString()}&singleEvents=true&orderBy=startTime`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        const corpoErro = await res.json().catch(() => null);
        const msgGoogle: string = corpoErro?.error?.message || '';
        console.error('Erro ao consultar o Google Calendar:', res.status, corpoErro);

        if (res.status === 401) {
          // Token expirado/revogado — limpa e pede pra reconectar.
          localStorage.removeItem('cf_gcal_token');
          setGoogleConectado(false);
          if (!silencioso) toast.error('Sua conexão com o Google expirou. Clique em "Conectar Google" de novo.');
        } else if (res.status === 403 && /Calendar API|disabled|accessNotConfigured/i.test(msgGoogle)) {
          if (!silencioso) toast.error('A Google Calendar API não está habilitada no projeto do Google Cloud. Ative-a em "APIs e Serviços" e tente de novo.', { duration: 8000 });
        } else if (!silencioso) {
          toast.error(`Erro ao sincronizar com o Google (${res.status}): ${msgGoogle || 'motivo não informado'}`);
        }
        return;
      }

      const data = await res.json();
      const eventos = data.items || [];

      // O cálculo acontece FORA do atualizador de estado — o React pode
      // executar o atualizador mais de uma vez durante a renderização, e uma
      // exceção ali (ex.: armazenamento cheio) derrubava a página inteira
      // sem chance de recuperação ("This page couldn't load").
      const map = new Map(store.getAgendaTasks().map(t => [t.id, t]));
      const existingGoogleIds = new Set(Array.from(map.values()).map(t => (t as any).googleEventId).filter(Boolean));
      let importados = 0;

      for (const ev of eventos) {
        if (!ev?.start) continue;
        const start = new Date(ev.start.dateTime || ev.start.date);
        if (isNaN(start.getTime())) continue;
        const myId = `gcal-${ev.id}`;
        if (map.has(myId) || existingGoogleIds.has(ev.id)) continue;
        
        map.set(myId, {
          id: myId,
          title: ev.summary || 'Sem título',
          empresaId: '', consultorId: '',
          horario: `${pad2(start.getHours())}:${pad2(start.getMinutes())}`,
          dateStr: toIsoLocal(start),
          completed: false, recurrent: false,
          location: ev.location || 'Remoto / Online',
        });
        importados++;
      }

      let exportados = 0;
      const locaisParaExportar = Array.from(map.values()).filter(t => !t.id.startsWith('gcal-') && !(t as any).googleEventId && t.dateStr >= min.toISOString().split('T')[0] && t.dateStr <= max.toISOString().split('T')[0]);
      const todasEmpresas = store.getEmpresas();

      for (const lt of locaisParaExportar) {
        try {
          const emp = todasEmpresas.find(e => e.id === lt.empresaId);
          const prefixoEmpresa = emp ? `[${emp.nomeFantasia || emp.razaoSocial}] ` : '';
          const enderecoEmpresa = emp ? [emp.endereco, emp.cidade, emp.uf].filter(Boolean).join(', ') : '';

          // Extraindo HH e MM para gerar o fim (1 hora depois por default)
          const hh = parseInt(lt.horario.split(':')[0]) || 9;
          const mm = lt.horario.split(':')[1] || '00';
          const evData = {
            summary: `${prefixoEmpresa}${lt.title}`,
            start: { dateTime: `${lt.dateStr}T${pad2(hh)}:${mm}:00-03:00` },
            end: { dateTime: `${lt.dateStr}T${pad2(hh + 1)}:${mm}:00-03:00` },
            location: lt.location || enderecoEmpresa || 'Consultoria / Remoto',
          };
          const postRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(evData)
          });
          if (postRes.ok) {
            const novoEv = await postRes.json();
            (lt as any).googleEventId = novoEv.id;
            exportados++;
          }
        } catch(e) {}
      }

      if (importados > 0 || exportados > 0) {
        const arr = Array.from(map.values());
        store.saveAgendaTasks(arr);
        setTasks(arr);
        toast.success(`Google Calendar: ${importados} importado(s), ${exportados} exportado(s).`);
      } else if (!silencioso) {
        toast.info(eventos.length > 0
          ? 'Nenhum evento novo — sincronização bidirecional já atualizada.'
          : 'Nenhum evento encontrado no seu Google Calendar (calendário "primary") para este período.');
      }
    } catch (err) {
      console.error('Sincronização com Google Calendar falhou:', err);
      if (!silencioso) toast.error('Erro de conexão ao sincronizar com o Google Calendar.');
    } finally {
      if (!silencioso) setSincronizando(false);
    }
  };

  const loginGoogle = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/calendar.events',
    onSuccess: (tokenResponse) => {
      localStorage.setItem('cf_gcal_token', tokenResponse.access_token);
      setGoogleConectado(true);
      toast.info('Conta Google conectada — importando eventos...');
      syncGoogle(tokenResponse.access_token, baseDate, false);
    },
    onError: (error) => {
      console.error('Login Google falhou:', error);
      toast.error('Erro ao conectar com o Google Calendar. Verifique os pop-ups do navegador.');
    },
  });

  const sincronizarAgora = () => {
    const t = localStorage.getItem('cf_gcal_token');
    if (!t) { toast.error('Conecte sua conta Google primeiro.'); return; }
    syncGoogle(t, baseDate, false);
  };

  const desconectarGoogle = () => {
    localStorage.removeItem('cf_gcal_token');
    setGoogleConectado(false);
    toast.success('Conta Google desconectada.');
  };

  // Tenta sincronizar sozinho ao trocar de mês/semana, se já houver um token salvo.
  useEffect(() => {
    if (!mounted) return;
    const t = localStorage.getItem('cf_gcal_token');
    if (t) syncGoogle(t, baseDate, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, baseDate]);

  const tasksPorDia = useMemo(() => {
    const map = new Map<string, AgendaTask[]>();
    for (const t of tasks) {
      const arr = map.get(t.dateStr) || [];
      arr.push(t);
      map.set(t.dateStr, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => String(a.horario || '').localeCompare(String(b.horario || '')));
    return map;
  }, [tasks]);

  const dias = useMemo(
    () => (view === 'month' ? gerarGradeDoMes(baseDate) : gerarGradeDaSemana(baseDate)),
    [view, baseDate]
  );

  const saveTasks = (updated: AgendaTask[]) => {
    setTasks(updated);
    store.saveAgendaTasks(updated);
  };

  const abrirNovo = (dateStr?: string) => {
    setNewTask({ title: '', empresaId: '', horario: '09:00', dateStr: dateStr || selectedDayIso || hojeIso(), recurrent: false, consultoresIds: [] } as any);
    setIsModalOpen(true);
  };

  const abrirEditar = (task: AgendaTask) => {
    setNewTask({
      ...task,
      consultoresIds: (task as any).consultoresIds || (task.consultorId ? [task.consultorId] : []),
      clienteParticipante: (task as any).clienteParticipante || '',
    } as any);
    setIsModalOpen(true);
  };

  const handleSaveTask = () => {
    if (!newTask.title || !newTask.dateStr || !newTask.horario) {
      toast.error('Preencha título, data e horário.');
      return;
    }
    
    // Se o newTask já tiver um ID, estamos editando. Senão, cria novo.
    const isEdit = !!newTask.id;
    const task: AgendaTask = {
      id: newTask.id || Math.random().toString(36).slice(2, 11),
      title: newTask.title,
      empresaId: newTask.empresaId || '',
      consultorId: ((newTask as any).consultoresIds || [])[0] || '',
      horario: newTask.horario,
      dateStr: newTask.dateStr,
      completed: false,
      recurrent: newTask.recurrent || false,
      clienteParticipante: (newTask as any).clienteParticipante || '',
      consultoresIds: (newTask as any).consultoresIds || [],
    } as any;

    if (isEdit) {
      saveTasks(tasks.map(t => (t.id === task.id ? task : t)));
      toast.success('Compromisso atualizado!');
    } else {
      saveTasks([...tasks, task]);
      toast.success('Compromisso criado!');
    }
    setIsModalOpen(false);

    // Auto-sincronizar imediatamente para empurrar pro Google
    const gToken = localStorage.getItem('cf_gcal_token');
    if (gToken) {
      setTimeout(() => syncGoogle(gToken, baseDate, true), 100);
    }
  };

  const handleDelete = async (task: AgendaTask) => {
    if (!(await confirmAsync('Excluir este compromisso?'))) return;
    saveTasks(tasks.filter(t => t.id !== task.id));
  };

  const handleToggleComplete = (task: AgendaTask) => {
    saveTasks(tasks.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t));
  };

  const handleCopyMessage = async (task: AgendaTask, dataFormatada: string) => {
    const emp = empresas.find(e => e.id === task.empresaId);
    const multiIds = (task as any).consultoresIds || (task.consultorId ? [task.consultorId] : []);
    const nomes = multiIds.map((id: string) => users.find(u => u.id === id)?.name).filter(Boolean).join(', ');
    
    const partCli = (task as any).clienteParticipante || '';
    const partCons = nomes ? nomes : 'Equipe Privilege';
    const loc = task.location || (emp ? `Sede - ${emp.nomeFantasia || emp.razaoSocial}` : 'A combinar / Online');

    const empNome = emp ? (emp.nomeFantasia || emp.razaoSocial) : 'Privilege';
    
    let text = `Olá! 🌟 Tudo bem?\nPassando para confirmar nosso compromisso. Aqui estão os detalhes:\n\n`;
    text += `📅 *Data:* ${dataFormatada}\n`;
    text += `⏰ *Horário:* ${task.horario}\n`;
    text += `📍 *Local:* ${loc}\n`;
    text += `🏢 *Empresa:* ${empNome}\n`;
    text += `👔 *Consultor:* ${partCons}\n`;
    if (partCli) text += `🗣️ *Participante(s) do Cliente:* ${partCli}\n`;
    text += `\n📌 *Assunto:* ${task.title}\n`;
    text += `\nQualquer imprevisto, é só me avisar. Até lá! 👋`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Mensagem copiada para a área de transferência.');
    } catch {
      toast.error('Erro ao copiar a mensagem.');
    }
  };

  const mover = (dir: 1 | -1) => {
    const n = new Date(baseDate);
    if (view === 'month') n.setMonth(n.getMonth() + dir);
    else n.setDate(n.getDate() + dir * 7);
    setBaseDate(n);
  };

  if (!mounted) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando agenda...</div>;

  const tituloTopo = view === 'month'
    ? `${MESES[baseDate.getMonth()]} de ${baseDate.getFullYear()}`
    : (() => {
        const semana = gerarGradeDaSemana(baseDate);
        const ini = semana[0].date, fim = semana[6].date;
        return ini.getMonth() === fim.getMonth()
          ? `${ini.getDate()} – ${fim.getDate()} de ${MESES[ini.getMonth()]}, ${ini.getFullYear()}`
          : `${ini.getDate()} de ${MESES[ini.getMonth()]} – ${fim.getDate()} de ${MESES[fim.getMonth()]}`;
      })();

  const diaSelecionado = selectedDayIso ? dias.find(d => d.iso === selectedDayIso) : null;
  const tarefasDoDiaSelecionado = selectedDayIso ? (tasksPorDia.get(selectedDayIso) || []) : [];

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="page-title">Agenda</div>
          <div className="page-subtitle">Compromissos da consultoria, com sincronização opcional do Google Calendar.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {googleConectado ? (
            <>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                Google conectado
              </span>
              <button className="btn btn-secondary" onClick={sincronizarAgora} disabled={sincronizando} style={{ background: '#fff', border: '1px solid #d1d5db', color: '#374151' }}>
                {sincronizando ? 'Sincronizando...' : '🔄 Sincronizar agora'}
              </button>
              <button className="btn btn-ghost" onClick={desconectarGoogle} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Desconectar
              </button>
            </>
          ) : (
            <button className="btn btn-secondary" onClick={() => loginGoogle()} style={{ background: '#fff', border: '1px solid #d1d5db', color: '#374151' }}>
              <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="" style={{ width: 14, height: 14, marginRight: 6, verticalAlign: -2 }} />
              Conectar Google
            </button>
          )}
          <button className="btn btn-primary" onClick={() => abrirNovo()}>
            <Plus size={15} style={{ marginRight: 4, verticalAlign: -3 }} /> Agendar
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Barra estilo Google Calendar: navegação + título do período + troca Mês/Semana */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
          marginBottom: 18, background: 'var(--bg-card)', padding: '12px 18px', borderRadius: 12, border: '1px solid var(--border-light)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setBaseDate(new Date())}>Hoje</button>
            <button className="btn btn-ghost btn-sm" onClick={() => mover(-1)} title="Anterior" style={{ padding: '4px 8px' }}><ChevronLeft size={18} /></button>
            <button className="btn btn-ghost btn-sm" onClick={() => mover(1)} title="Próximo" style={{ padding: '4px 8px' }}><ChevronRight size={18} /></button>
            <div style={{ fontWeight: 800, fontSize: 17, marginLeft: 4, textTransform: 'capitalize' }}>{tituloTopo}</div>
          </div>

          <div style={{ display: 'flex', background: 'var(--bg-card2)', borderRadius: 8, padding: 3 }}>
            {(['month', 'week'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="btn btn-sm"
                style={{
                  border: 'none', padding: '6px 14px',
                  background: view === v ? 'var(--bg-card)' : 'transparent',
                  boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                  fontWeight: view === v ? 700 : 500,
                  color: view === v ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                {v === 'month' ? 'Mês' : 'Semana'}
              </button>
            ))}
          </div>
        </div>

        {/* Cabeçalho dos dias da semana */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0, marginBottom: 2 }}>
          {DIAS_SEMANA.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, letterSpacing: '.05em', color: 'var(--text-muted)', padding: '4px 0' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Grade do calendário */}
        <div
          className="card"
          style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            gridAutoRows: view === 'month' ? 'minmax(104px, 1fr)' : 'minmax(320px, 1fr)',
            gap: 1, padding: 0, overflow: 'hidden', background: 'var(--border-light)',
          }}
        >
          {dias.map(dia => {
            const doDia = tasksPorDia.get(dia.iso) || [];
            const visiveis = doDia.slice(0, view === 'month' ? 3 : 20);
            const resto = doDia.length - visiveis.length;

            return (
              <div
                key={dia.iso}
                onClick={() => setSelectedDayIso(dia.iso)}
                style={{
                  background: 'var(--bg-card)', padding: '6px 6px 8px', cursor: 'pointer',
                  opacity: view === 'month' && !dia.noMes ? 0.45 : 1,
                  display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0,
                  transition: 'background .15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-card)')}
              >
                <div style={{ display: 'flex', justifyContent: view === 'month' ? 'flex-end' : 'center' }}>
                  <span style={{
                    width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '50%', fontSize: 12.5, fontWeight: dia.isHoje ? 800 : 600,
                    background: dia.isHoje ? 'var(--accent)' : 'transparent',
                    color: dia.isHoje ? '#fff' : 'var(--text-primary)',
                  }}>
                    {dia.date.getDate()}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden' }}>
                  {visiveis.map(t => {
                    const isGoogle = t.id.startsWith('gcal');
                    return (
                      <div
                        key={t.id}
                        title={`${t.horario} · ${t.title}`}
                        style={{
                          fontSize: 10.5, fontWeight: 600, padding: '2px 6px', borderRadius: 5,
                          background: isGoogle ? 'rgba(59,130,246,0.12)' : 'rgba(140,26,34,0.1)',
                          color: isGoogle ? '#2563eb' : 'var(--accent)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          textDecoration: t.completed ? 'line-through' : 'none',
                          opacity: t.completed ? 0.55 : 1,
                        }}
                      >
                        {t.horario} {t.title}
                      </div>
                    );
                  })}
                  {resto > 0 && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', padding: '0 6px' }}>
                      +{resto} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Painel do dia — lista completa + adicionar, ao clicar numa célula */}
      {diaSelecionado && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}
          onClick={() => setSelectedDayIso(null)}
        >
          <div
            className="card"
            style={{ width: 380, maxWidth: '92vw', height: '100vh', borderRadius: 0, overflowY: 'auto', padding: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid var(--border-light)' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {DIAS_SEMANA[diaSelecionado.date.getDay()]}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {diaSelecionado.date.getDate()} de {MESES[diaSelecionado.date.getMonth()]}
                </div>
              </div>
              <button onClick={() => setSelectedDayIso(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 16 }}>
              <button className="btn btn-primary btn-sm" style={{ width: '100%', marginBottom: 16 }} onClick={() => abrirNovo(diaSelecionado.iso)}>
                <Plus size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> Novo compromisso neste dia
              </button>

              {tarefasDoDiaSelecionado.length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  Nenhum compromisso neste dia.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tarefasDoDiaSelecionado.map(task => {
                  const emp = empresas.find(e => e.id === task.empresaId);
                  const multiIds = (task as any).consultoresIds || (task.consultorId ? [task.consultorId] : []);
                  const consNomes = multiIds.map((id: string) => users.find(u => u.id === id)?.name).filter(Boolean).join(', ');
                  const isGoogle = task.id.startsWith('gcal');
                  return (
                    <div key={task.id} style={{
                      padding: 12, borderRadius: 10, border: '1px solid var(--border-light)',
                      borderLeft: `4px solid ${isGoogle ? '#3b82f6' : 'var(--accent)'}`,
                      opacity: task.completed ? 0.6 : 1,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, textDecoration: task.completed ? 'line-through' : 'none' }}>
                          <span style={{ color: isGoogle ? '#3b82f6' : 'var(--accent)', marginRight: 6 }}>{task.horario}</span>
                          {task.title}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button title="Editar compromisso" onClick={() => abrirEditar(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                            <Edit2 size={14} />
                          </button>
                          <button title="Copiar mensagem" onClick={() => handleCopyMessage(task, `${diaSelecionado.date.getDate()}/${pad2(diaSelecionado.date.getMonth() + 1)}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                            <Copy size={14} />
                          </button>
                          <button title={task.completed ? 'Marcar como pendente' : 'Marcar como concluído'} onClick={() => handleToggleComplete(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: task.completed ? 'var(--green)' : 'var(--text-muted)' }}>
                            <Check size={14} />
                          </button>
                          <button title="Excluir" onClick={() => handleDelete(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      {emp && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>🏢 {emp.nomeFantasia || emp.razaoSocial}</div>}
                      {!isGoogle && consNomes && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>👥 {consNomes}</div>}
                      {isGoogle && <div style={{ fontSize: 10.5, color: '#3b82f6', fontWeight: 700, marginTop: 4 }}>🌐 Google Calendar</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de criação */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: 440, maxWidth: '92vw', padding: 24, position: 'relative' }}>
            <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', right: 16, top: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={18} />
            </button>
            <h3 style={{ fontSize: 18, marginBottom: 20 }}>{newTask.id ? 'Editar compromisso' : 'Novo compromisso'}</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Título</label>
                <input type="text" className="form-control" placeholder="Reunião de fechamento mensal" value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} autoFocus />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Empresa (opcional)</label>
                <select className="form-control" value={newTask.empresaId} onChange={e => setNewTask({ ...newTask, empresaId: e.target.value })}>
                  <option value="">Selecione...</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.nomeFantasia || e.razaoSocial}</option>)}
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Equipe Responsável (Selecione um ou mais)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 110, overflowY: 'auto', border: '1px solid var(--border)', padding: '10px 12px', borderRadius: 8 }}>
                  {users.map(u => (
                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={((newTask as any).consultoresIds || []).includes(u.id)} 
                        onChange={e => {
                          const ids = (newTask as any).consultoresIds || [];
                          if (e.target.checked) setNewTask({ ...newTask, consultoresIds: [...ids, u.id] } as any);
                          else setNewTask({ ...newTask, consultoresIds: ids.filter((i: string) => i !== u.id) } as any);
                        }} 
                      />
                      {u.name}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Participantes do Cliente (opcional)</label>
                <input type="text" className="form-control" placeholder="Quem vai participar? (Ex: João, Financeiro)" value={(newTask as any).clienteParticipante || ''} onChange={e => setNewTask({ ...newTask, clienteParticipante: e.target.value } as any)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Data</label>
                  <input type="date" className="form-control" value={newTask.dateStr} onChange={e => setNewTask({ ...newTask, dateStr: e.target.value })} />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Horário</label>
                  <input type="time" className="form-control" value={newTask.horario} onChange={e => setNewTask({ ...newTask, horario: e.target.value })} />
                </div>
              </div>

              <div style={{ marginTop: 4, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSaveTask}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
