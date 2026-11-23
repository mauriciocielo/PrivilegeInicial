'use client';
import { useEffect, useMemo, useState } from 'react';
import { store, Empresa, User, AgendaTask } from '../../../lib/store';
import { toast } from 'sonner';
import { confirmAsync } from '../../../components/ConfirmProvider';
import { useGoogleLogin } from '@react-oauth/google';
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Check, Copy, X, Edit2, MessageSquare, Users,
  Calendar, Clock, MapPin, Search, List, LayoutGrid, Columns, RefreshCw, CheckCircle2, Building2,
} from 'lucide-react';

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

  const [view, setView] = useState<'month' | 'week' | 'list'>('month');
  const [baseDate, setBaseDate] = useState<Date>(new Date());
  const [selectedDayIso, setSelectedDayIso] = useState<string>(hojeIso());

  const [buscaTexto, setBuscaTexto] = useState('');
  const [filtroEmpresaId, setFiltroEmpresaId] = useState('');
  const [filtroConsultorId, setFiltroConsultorId] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendentes' | 'concluidos'>('todos');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTask, setNewTask] = useState<Partial<AgendaTask>>({
    title: '', empresaId: '', consultorId: '', horario: '09:00', dateStr: hojeIso(), recurrent: false,
  });

  const [googleConectado, setGoogleConectado] = useState(false);
  const [googlePermanentSupported, setGooglePermanentSupported] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);

  // Envio configurável da agenda no WhatsApp via (46) 99980-0010
  const [enviarWppAgenda, setEnviarWppAgenda] = useState(false);
  const [wppAgendaNumero, setWppAgendaNumero] = useState('');
  const [enviandoWppTaskId, setEnviandoWppTaskId] = useState<string | null>(null);

  // Grupos de WhatsApp vinculados por empresa (envio no grupo: criação, alteração, 1 dia e 1 hora antes)
  const [vinculosGrupos, setVinculosGrupos] = useState<
    Record<string, { empresaId: string; groupJid: string; groupName: string; notificarAgenda: boolean }>
  >({});
  const [showGruposModal, setShowGruposModal] = useState(false);
  const [carregandoGrupos, setCarregandoGrupos] = useState(false);
  const [gruposWppDisponiveis, setGruposWppDisponiveis] = useState<Array<{ jid: string; nome: string; participantes: number }>>([]);
  const [sessaoGruposOk, setSessaoGruposOk] = useState(true);
  const [grupoEmpresaSel, setGrupoEmpresaSel] = useState('');
  const [grupoJidSel, setGrupoJidSel] = useState('');
  const [salvandoGrupo, setSalvandoGrupo] = useState(false);
  const [avisarGrupoAoSalvar, setAvisarGrupoAoSalvar] = useState(true);

  const carregarVinculosGrupos = async (live = false) => {
    if (live) setCarregandoGrupos(true);
    try {
      const res = await fetch(`/api/agenda/grupos?live=${live ? '1' : '0'}`);
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, { empresaId: string; groupJid: string; groupName: string; notificarAgenda: boolean }> = {};
      for (const v of data.vinculos || []) {
        map[v.empresaId] = v;
      }
      setVinculosGrupos(map);
      if (live) {
        setSessaoGruposOk(Boolean(data.sessaoConectada));
        setGruposWppDisponiveis(Array.isArray(data.gruposWhatsApp) ? data.gruposWhatsApp : []);
      }
    } catch {
      // ignora
    } finally {
      if (live) setCarregandoGrupos(false);
    }
  };

  const salvarVinculoGrupo = async () => {
    if (!grupoEmpresaSel || !grupoJidSel) {
      toast.error('Selecione a empresa e o grupo do WhatsApp.');
      return;
    }
    const g = gruposWppDisponiveis.find(x => x.jid === grupoJidSel);
    setSalvandoGrupo(true);
    try {
      const res = await fetch('/api/agenda/grupos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId: grupoEmpresaSel,
          groupJid: grupoJidSel,
          groupName: g?.nome || grupoJidSel,
          notificarAgenda: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Erro ao vincular grupo.');
      toast.success('Grupo do cliente vinculado! Avisos de criação, alteração, 1 dia e 1 hora antes ativados.');
      setGrupoEmpresaSel('');
      setGrupoJidSel('');
      await carregarVinculosGrupos(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvandoGrupo(false);
    }
  };

  const removerVinculoGrupo = async (empId: string) => {
    try {
      await fetch(`/api/agenda/grupos?empresaId=${encodeURIComponent(empId)}`, { method: 'DELETE' });
      toast.success('Vínculo de grupo removido.');
      await carregarVinculosGrupos(false);
    } catch {
      toast.error('Falha ao remover vínculo.');
    }
  };

  const salvarPrefWppAgenda = (ativo: boolean, telefone: string) => {
    setEnviarWppAgenda(ativo);
    setWppAgendaNumero(telefone);
    if (typeof window === 'undefined') return;
    try {
      const uidAtual = store.getCurrentUser()?.id || 'padrao';
      localStorage.setItem(`agenda_wpp_pref_${uidAtual}`, JSON.stringify({ ativo, telefone }));
    } catch {
      // ignora
    }
  };

  /**
   * Busca um access_token válido: primeiro tenta o servidor (refresh_token permanente no PostgreSQL);
   * se não existir, usa o token local ainda dentro da validade.
   */
  const obterTokenGoogleValido = async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/google-calendar/token');
      if (res.ok) {
        const data = await res.json();
        setGooglePermanentSupported(Boolean(data.permanentSupported));
        if (data.connected && data.accessToken) {
          localStorage.setItem('cf_gcal_token', data.accessToken);
          if (data.expiresAt) localStorage.setItem('cf_gcal_expires_at', String(data.expiresAt));
          setGoogleConectado(true);
          return data.accessToken as string;
        }
      }
    } catch {
      // fallback local
    }

    const localToken = localStorage.getItem('cf_gcal_token');
    const localExp = Number(localStorage.getItem('cf_gcal_expires_at') || 0);
    if (localToken && (!localExp || localExp > Date.now() + 60_000)) {
      setGoogleConectado(true);
      return localToken;
    }
    return null;
  };

  useEffect(() => {
    setMounted(true);
    try {
      const uidAtual = store.getCurrentUser()?.id || 'padrao';
      const raw = localStorage.getItem(`agenda_wpp_pref_${uidAtual}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        setEnviarWppAgenda(Boolean(parsed?.ativo));
        setWppAgendaNumero(typeof parsed?.telefone === 'string' ? parsed.telefone : '');
      }
    } catch {
      // ignora
    }
    obterTokenGoogleValido().then(t => {
      if (t) syncGoogle(t, baseDate, true);
    });
    carregarVinculosGrupos(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          // Tenta renovar automaticamente pelo servidor (refresh_token permanente) antes de desconectar
          localStorage.removeItem('cf_gcal_token');
          localStorage.removeItem('cf_gcal_expires_at');
          const novoToken = await obterTokenGoogleValido();
          if (novoToken && novoToken !== token) {
            await syncGoogle(novoToken, ref, silencioso);
            return;
          }
          setGoogleConectado(false);
          if (!silencioso) toast.error('Sua conexão com o Google expirou. Clique em "Conectar Google" para renovar.');
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

  // Fluxo permanente (auth-code -> refresh_token salvo no PostgreSQL, nunca mais expira em 1h)
  const loginGoogleAuthCode = useGoogleLogin({
    flow: 'auth-code',
    scope: 'https://www.googleapis.com/auth/calendar.events',
    onSuccess: async (codeResponse) => {
      try {
        toast.info('Conectando Google Calendar de forma permanente...');
        const res = await fetch('/api/google-calendar/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: codeResponse.code }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.accessToken) {
          throw new Error(data.error || 'Falha ao ativar sincronização permanente.');
        }
        localStorage.setItem('cf_gcal_token', data.accessToken);
        if (data.expiresAt) localStorage.setItem('cf_gcal_expires_at', String(data.expiresAt));
        setGoogleConectado(true);
        toast.success('Google Calendar conectado com renovação automática permanente!');
        syncGoogle(data.accessToken, baseDate, false);
      } catch (e) {
        toast.error((e as Error).message || 'Erro ao salvar conexão permanente com o Google.');
      }
    },
    onError: (error) => {
      console.error('Login Google (auth-code) falhou:', error);
      toast.error('Erro ao conectar com o Google Calendar. Verifique os pop-ups do navegador.');
    },
  });

  // Fallback implicit flow (caso GOOGLE_CLIENT_SECRET ainda não esteja no servidor)
  const loginGoogleImplicit = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/calendar.events',
    onSuccess: (tokenResponse) => {
      const expiresAt = Date.now() + Number(tokenResponse.expires_in || 3600) * 1000;
      localStorage.setItem('cf_gcal_token', tokenResponse.access_token);
      localStorage.setItem('cf_gcal_expires_at', String(expiresAt));
      setGoogleConectado(true);
      toast.info('Conta Google conectada — importando eventos...');
      syncGoogle(tokenResponse.access_token, baseDate, false);
    },
    onError: (error) => {
      console.error('Login Google falhou:', error);
      toast.error('Erro ao conectar com o Google Calendar. Verifique os pop-ups do navegador.');
    },
  });

  const loginGoogle = () => {
    if (googlePermanentSupported) {
      loginGoogleAuthCode();
    } else {
      loginGoogleImplicit();
    }
  };

  const sincronizarAgora = async () => {
    const t = await obterTokenGoogleValido();
    if (!t) {
      toast.info('Renovando conexão com o Google Calendar...');
      loginGoogle();
      return;
    }
    syncGoogle(t, baseDate, false);
  };

  const desconectarGoogle = async () => {
    localStorage.removeItem('cf_gcal_token');
    localStorage.removeItem('cf_gcal_expires_at');
    await fetch('/api/google-calendar/token', { method: 'DELETE' }).catch(() => {});
    setGoogleConectado(false);
    toast.success('Conta Google desconectada.');
  };

  // Auto-sync ao trocar de mês/semana e renovação periódica a cada 10 minutos
  useEffect(() => {
    if (!mounted) return;
    obterTokenGoogleValido().then(t => {
      if (t) syncGoogle(t, baseDate, true);
    });
    const timer = setInterval(() => {
      obterTokenGoogleValido().then(t => {
        if (t) syncGoogle(t, baseDate, true);
      });
    }, 10 * 60 * 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, baseDate]);

  const tasksFiltradas = useMemo(() => {
    const q = buscaTexto.trim().toLowerCase();
    return tasks.filter(t => {
      if (filtroEmpresaId && t.empresaId !== filtroEmpresaId) return false;
      if (filtroConsultorId) {
        const multiIds: string[] = (t as any).consultoresIds || (t.consultorId ? [t.consultorId] : []);
        if (!multiIds.includes(filtroConsultorId)) return false;
      }
      if (filtroStatus === 'pendentes' && t.completed) return false;
      if (filtroStatus === 'concluidos' && !t.completed) return false;
      if (q) {
        const emp = empresas.find(e => e.id === t.empresaId);
        const alvo = [
          t.title,
          emp?.nomeFantasia,
          emp?.razaoSocial,
          (t as any).clienteParticipante,
          t.location,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, buscaTexto, filtroEmpresaId, filtroConsultorId, filtroStatus, empresas]);

  const tasksPorDia = useMemo(() => {
    const map = new Map<string, AgendaTask[]>();
    for (const t of tasksFiltradas) {
      const arr = map.get(t.dateStr) || [];
      arr.push(t);
      map.set(t.dateStr, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => String(a.horario || '').localeCompare(String(b.horario || '')));
    return map;
  }, [tasksFiltradas]);

  const resumoKpis = useMemo(() => {
    const hoje = hojeIso();
    const em7d = toIsoLocal(new Date(Date.now() + 7 * 86400000));
    const mesPrefix = `${baseDate.getFullYear()}-${pad2(baseDate.getMonth() + 1)}`;
    let hojeTotal = 0;
    let hojePendentes = 0;
    let prox7Dias = 0;
    let mesPendentes = 0;
    let mesConcluidos = 0;
    for (const t of tasks) {
      if (t.dateStr === hoje) {
        hojeTotal++;
        if (!t.completed) hojePendentes++;
      }
      if (t.dateStr >= hoje && t.dateStr <= em7d && !t.completed) {
        prox7Dias++;
      }
      if (t.dateStr.startsWith(mesPrefix)) {
        if (t.completed) mesConcluidos++;
        else mesPendentes++;
      }
    }
    return { hojeTotal, hojePendentes, prox7Dias, mesPendentes, mesConcluidos };
  }, [tasks, baseDate]);

  const diasListaPauta = useMemo(() => {
    const mesPrefix = `${baseDate.getFullYear()}-${pad2(baseDate.getMonth() + 1)}`;
    const entries = Array.from(tasksPorDia.entries())
      .filter(([iso]) => iso.startsWith(mesPrefix) || buscaTexto.trim().length > 0 || Boolean(filtroEmpresaId))
      .sort(([a], [b]) => a.localeCompare(b));
    return entries;
  }, [tasksPorDia, baseDate, buscaTexto, filtroEmpresaId]);

  const dias = useMemo(
    () => (view === 'week' ? gerarGradeDaSemana(baseDate) : gerarGradeDoMes(baseDate)),
    [view, baseDate]
  );

  const saveTasks = (updated: AgendaTask[]) => {
    setTasks(updated);
    store.saveAgendaTasks(updated);

    // Salva direto no Postgres além do ciclo de sync geral (debounced 1s,
    // via components/TransitionProvider.tsx) — a agenda ficava só no
    // navegador de quem criou o compromisso e nunca aparecia em outro
    // aparelho/sessão (nem no portal do cliente). Reusa a mesma rota que o
    // sync automático já usa (POST /api/migrate-backup com `collection`),
    // só que na hora, sem esperar o debounce nem depender dele funcionar.
    fetch('/api/migrate-backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection: 'cf_agenda_semanal', data: updated }),
    }).catch(err => {
      console.error('Falha ao salvar a agenda direto no servidor (fica pendente pelo sync geral):', err);
    });
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
    const anterior = isEdit ? tasks.find(t => t.id === newTask.id) : undefined;
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

    // Auto-sincronizar imediatamente para empurrar pro Google (renovando token se necessário)
    obterTokenGoogleValido().then(gToken => {
      if (gToken) setTimeout(() => syncGoogle(gToken, baseDate, true), 100);
    });

    const partes = task.dateStr.split('-');
    const dataFmt = partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : task.dateStr;

    // 1. Envio automático no GRUPO DO CLIENTE (criação ou alteração de data/horário/assunto)
    const grupoEmp = task.empresaId ? vinculosGrupos[task.empresaId] : undefined;
    if (grupoEmp?.groupJid && grupoEmp.notificarAgenda && avisarGrupoAoSalvar) {
      const mudou =
        isEdit &&
        anterior &&
        (anterior.dateStr !== task.dateStr ||
          anterior.horario !== task.horario ||
          anterior.title !== task.title);

      if (!isEdit || mudou) {
        const msgGrupo = montarMensagemCompromisso(task, dataFmt, isEdit ? anterior : undefined);
        fetch('/api/agenda/enviar-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupJid: grupoEmp.groupJid,
            groupName: grupoEmp.groupName,
            mensagem: msgGrupo,
          }),
        })
          .then(r => r.json().then(j => ({ ok: r.ok, j })))
          .then(({ ok, j }) => {
            if (ok) {
              toast.success(
                isEdit
                  ? `Alteração de agenda enviada no grupo "${grupoEmp.groupName}"!`
                  : `Compromisso enviado no grupo "${grupoEmp.groupName}"! Lembretes de 1 dia e 1 hora antes armados.`
              );
            } else {
              toast.warning(`Compromisso salvo, mas não foi possível avisar no grupo: ${j?.error || 'WhatsApp offline'}`);
            }
          })
          .catch(() => {});
      }
    }

    // 2. Envio automático no WhatsApp individual configurado (opcional)
    if (enviarWppAgenda && wppAgendaNumero.replace(/\D/g, '').length >= 10) {
      enviarCompromissoWhatsApp(task, dataFmt, wppAgendaNumero, true, isEdit ? anterior : undefined);
    }
  };

  const handleDelete = async (task: AgendaTask) => {
    if (!(await confirmAsync('Excluir este compromisso?'))) return;
    saveTasks(tasks.filter(t => t.id !== task.id));
  };

  const handleToggleComplete = (task: AgendaTask) => {
    saveTasks(tasks.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t));
  };

  const montarMensagemCompromisso = (task: AgendaTask, dataFormatada: string, anterior?: AgendaTask) => {
    const emp = empresas.find(e => e.id === task.empresaId);
    const multiIds = (task as any).consultoresIds || (task.consultorId ? [task.consultorId] : []);
    const nomes = multiIds.map((id: string) => users.find(u => u.id === id)?.name).filter(Boolean).join(', ');
    const partCli = (task as any).clienteParticipante || '';
    const partCons = nomes ? nomes : 'Equipe Privilege';
    const loc = task.location || (emp ? `Sede - ${emp.nomeFantasia || emp.razaoSocial}` : 'A combinar / Online');
    const empNome = emp ? (emp.nomeFantasia || emp.razaoSocial) : 'Privilege';

    if (anterior) {
      const pAnt = anterior.dateStr.split('-');
      const dataAnt = pAnt.length === 3 ? `${pAnt[2]}/${pAnt[1]}/${pAnt[0]}` : anterior.dateStr;
      return [
        `🗓️ *Reagendamento — ${empNome}*`,
        ``,
        `Olá, equipe! Informamos que houve uma alteração no nosso compromisso:`,
        ``,
        `• *Horário anterior:* ${dataAnt} às ${anterior.horario}`,
        `• *Novo horário:* ${dataFormatada} às ${task.horario}`,
        `• *Assunto:* ${task.title}`,
        `• *Local:* ${loc}`,
        `• *Consultor(a):* ${partCons}`,
        ...(partCli ? [`• *Participantes:* ${partCli}`] : []),
        ``,
        `Qualquer dúvida ou imprevisto, estamos à disposição por aqui.`,
        ``,
        `_Privilege Contabilidade e Consultoria_`,
      ].join('\n');
    }

    return [
      `🗓️ *Agendamento Confirmado — ${empNome}*`,
      ``,
      `Olá, equipe! Seguem os detalhes do nosso próximo compromisso:`,
      ``,
      `• *Assunto:* ${task.title}`,
      `• *Data:* ${dataFormatada}`,
      `• *Horário:* ${task.horario}`,
      `• *Local:* ${loc}`,
      `• *Consultor(a):* ${partCons}`,
      ...(partCli ? [`• *Participantes:* ${partCli}`] : []),
      ``,
      `Caso precise de algum ajuste, é só nos avisar por aqui.`,
      ``,
      `_Privilege Contabilidade e Consultoria_`,
    ].join('\n');
  };

  const enviarCompromissoWhatsApp = async (
    task: AgendaTask,
    dataFormatada: string,
    telefoneAlvo?: string,
    silencioso = false,
    anterior?: AgendaTask
  ) => {
    const grupoEmp = !telefoneAlvo && task.empresaId ? vinculosGrupos[task.empresaId] : undefined;
    let tel = (telefoneAlvo || wppAgendaNumero || '').trim();

    if (!grupoEmp?.groupJid && tel.replace(/\D/g, '').length < 10) {
      if (silencioso) return;
      const digitado = window.prompt('Informe o WhatsApp com DDD para enviar este compromisso (ex.: 46999016003):', tel);
      if (!digitado || digitado.replace(/\D/g, '').length < 10) return;
      tel = digitado.trim();
      salvarPrefWppAgenda(enviarWppAgenda, tel);
    }

    setEnviandoWppTaskId(task.id);
    try {
      const mensagem = montarMensagemCompromisso(task, dataFormatada, anterior);
      const payload = grupoEmp?.groupJid
        ? { groupJid: grupoEmp.groupJid, groupName: grupoEmp.groupName, mensagem }
        : { telefone: tel, mensagem };
      const res = await fetch('/api/agenda/enviar-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Falha ao enviar compromisso no WhatsApp.');
      toast.success(
        json.isGrupo
          ? `Compromisso enviado no grupo "${json.destinoNome}" via 46 99980-0010!`
          : `Compromisso enviado no WhatsApp (${tel}) via 46 99980-0010!`
      );
    } catch (e) {
      if (!silencioso) toast.error((e as Error).message);
      else toast.warning(`Compromisso salvo, mas o WhatsApp não foi enviado: ${(e as Error).message}`);
    } finally {
      setEnviandoWppTaskId(null);
    }
  };

  const handleCopyMessage = async (task: AgendaTask, dataFormatada: string) => {
    const text = montarMensagemCompromisso(task, dataFormatada);
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Mensagem copiada para a área de transferência.');
    } catch {
      toast.error('Erro ao copiar a mensagem.');
    }
  };

  const mover = (dir: 1 | -1) => {
    const n = new Date(baseDate);
    if (view === 'week') n.setDate(n.getDate() + dir * 7);
    else n.setMonth(n.getMonth() + dir);
    setBaseDate(n);
  };

  if (!mounted) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando agenda...</div>;

  const tituloTopo = view === 'week'
    ? (() => {
        const semana = gerarGradeDaSemana(baseDate);
        const ini = semana[0].date, fim = semana[6].date;
        return ini.getMonth() === fim.getMonth()
          ? `${ini.getDate()} – ${fim.getDate()} de ${MESES[ini.getMonth()]}, ${ini.getFullYear()}`
          : `${ini.getDate()} de ${MESES[ini.getMonth()]} – ${fim.getDate()} de ${MESES[fim.getMonth()]}`;
      })()
    : `${MESES[baseDate.getMonth()]} de ${baseDate.getFullYear()}`;

  const dataSelecionadaObj = (() => {
    const [a, m, d] = (selectedDayIso || hojeIso()).split('-').map(Number);
    return new Date(a, (m || 1) - 1, d || 1);
  })();
  const tarefasDoDiaSelecionado = tasksPorDia.get(selectedDayIso) || [];
  const temFiltroAtivo = Boolean(buscaTexto.trim() || filtroEmpresaId || filtroConsultorId || filtroStatus !== 'todos');
  const hojeStr = hojeIso();
  const amanhaStr = toIsoLocal(new Date(Date.now() + 86400000));

  const renderCardCompromisso = (task: AgendaTask, dataBrCurta: string) => {
    const emp = empresas.find(e => e.id === task.empresaId);
    const multiIds: string[] = (task as any).consultoresIds || (task.consultorId ? [task.consultorId] : []);
    const consNomes = multiIds.map((id: string) => users.find(u => u.id === id)?.name).filter(Boolean).join(', ');
    const isGoogle = task.id.startsWith('gcal');
    const grupoEmp = task.empresaId ? vinculosGrupos[task.empresaId] : undefined;
    const participante = (task as any).clienteParticipante;

    return (
      <div
        key={task.id}
        className="agenda-task-card"
        style={{
          padding: '13px 14px',
          borderRadius: 12,
          border: '1px solid var(--border-light)',
          borderLeft: `4px solid ${task.completed ? '#16a34a' : isGoogle ? '#2563eb' : '#600000'}`,
          background: task.completed ? 'var(--bg-base)' : 'var(--bg-card)',
          opacity: task.completed ? 0.72 : 1,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11.5,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: task.completed ? '#dcfce7' : isGoogle ? '#eff6ff' : '#fef2f2',
                  color: task.completed ? '#15803d' : isGoogle ? '#1d4ed8' : '#7f1d1d',
                }}
              >
                <Clock size={11} /> {task.horario || '--:--'}
              </span>
              {isGoogle && (
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '2px 7px', borderRadius: 6 }}>
                  Google
                </span>
              )}
              {grupoEmp && (
                <span
                  title={`Grupo vinculado: ${grupoEmp.groupName}`}
                  style={{ fontSize: 10.5, fontWeight: 700, color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1px 7px', borderRadius: 6 }}
                >
                  Grupo WPP
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 700,
                color: 'var(--text-primary)',
                textDecoration: task.completed ? 'line-through' : 'none',
                lineHeight: 1.35,
              }}
            >
              {task.title}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            <button
              className="agenda-icon-btn"
              title={grupoEmp ? `Enviar no grupo "${grupoEmp.groupName}"` : 'Enviar no WhatsApp (via 46 99980-0010)'}
              disabled={enviandoWppTaskId === task.id}
              onClick={() => enviarCompromissoWhatsApp(task, dataBrCurta)}
              style={{ color: '#15803d', opacity: enviandoWppTaskId === task.id ? 0.45 : 1 }}
            >
              <MessageSquare size={14} />
            </button>
            <button className="agenda-icon-btn" title="Editar compromisso" onClick={() => abrirEditar(task)}>
              <Edit2 size={14} />
            </button>
            <button className="agenda-icon-btn" title="Copiar mensagem" onClick={() => handleCopyMessage(task, dataBrCurta)}>
              <Copy size={14} />
            </button>
            <button
              className="agenda-icon-btn"
              title={task.completed ? 'Marcar como pendente' : 'Concluir compromisso'}
              onClick={() => handleToggleComplete(task)}
              style={{ color: task.completed ? '#16a34a' : undefined }}
            >
              <Check size={14} />
            </button>
            <button className="agenda-icon-btn" title="Excluir" onClick={() => handleDelete(task)} style={{ color: '#dc2626' }}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {(emp || consNomes || participante || task.location) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-light)', fontSize: 11.5, color: 'var(--text-secondary)' }}>
            {emp && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
                <Building2 size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.nomeFantasia || emp.razaoSocial}</span>
              </div>
            )}
            {consNomes && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
                <Users size={12} style={{ flexShrink: 0 }} />
                <span>{consNomes}{participante ? ` • Cliente: ${participante}` : ''}</span>
              </div>
            )}
            {!consNomes && participante && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
                <Users size={12} style={{ flexShrink: 0 }} />
                <span>Cliente: {participante}</span>
              </div>
            )}
            {task.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
                <MapPin size={12} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.location}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes springPop { 0% { transform: scale(0.95) translateY(12px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }

        .agenda-kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
        .agenda-kpi-card {
          background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 12px;
          padding: 13px 15px; display: flex; align-items: center; justify-content: space-between; gap: 10px;
          cursor: pointer; transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
        }
        .agenda-kpi-card:hover { border-color: #600000; box-shadow: 0 6px 18px rgba(96,0,0,0.06); transform: translateY(-1px); }

        .agenda-layout { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 16px; align-items: start; }
        .agenda-side-panel { position: sticky; top: 16px; }

        .agenda-cell {
          background: var(--bg-card); padding: 7px 7px 8px; cursor: pointer;
          display: flex; flex-direction: column; gap: 4px; min-width: 0;
          transition: background .15s ease, box-shadow .15s ease;
        }
        .agenda-cell:hover { background: var(--bg-base); }
        .agenda-cell.is-selected { box-shadow: inset 0 0 0 2px #600000; background: rgba(96, 0, 0, 0.025); }

        .agenda-chip {
          font-size: 11px; font-weight: 600; padding: 3px 6px; border-radius: 6px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          transition: filter .15s ease;
        }
        .agenda-chip:hover { filter: brightness(0.94); }

        .agenda-task-card { transition: box-shadow .18s ease, border-color .18s ease; }
        .agenda-task-card:hover { box-shadow: 0 6px 18px rgba(0,0,0,0.06); }

        .agenda-icon-btn {
          width: 28px; height: 28px; border-radius: 7px; border: 1px solid transparent;
          background: transparent; color: var(--text-muted); cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center;
          transition: background .15s ease, color .15s ease;
        }
        .agenda-icon-btn:hover { background: var(--bg-card2); color: var(--text-primary); }

        .modal-overlay { animation: fadeIn 0.2s ease-out; }
        .modal-create { animation: springPop 0.25s ease-out forwards; }

        @media (max-width: 1120px) {
          .agenda-layout { grid-template-columns: 1fr; }
          .agenda-side-panel { position: static; }
        }
        @media (max-width: 820px) {
          .agenda-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Calendar size={22} style={{ color: '#600000' }} />
            Agenda Executiva
          </div>
          <div className="page-subtitle">Compromissos da consultoria com sincronização Google Calendar e avisos automáticos nos grupos dos clientes.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {googleConectado ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '4px 10px' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d' }}>Google</span>
              <button
                type="button"
                onClick={sincronizarAgora}
                disabled={sincronizando}
                title="Sincronizar Google Calendar agora"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#15803d', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, padding: '2px 4px' }}
              >
                <RefreshCw size={12} className={sincronizando ? 'animate-spin' : ''} />
                {sincronizando ? 'Sincronizando...' : 'Sincronizar'}
              </button>
              <button
                type="button"
                onClick={desconectarGoogle}
                title="Desconectar conta Google"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 11, padding: '2px 4px' }}
              >
                Sair
              </button>
            </div>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={() => loginGoogle()} style={{ background: '#fff', border: '1px solid #d1d5db', color: '#374151' }}>
              <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="" style={{ width: 14, height: 14, marginRight: 6, verticalAlign: -2 }} />
              Conectar Google
            </button>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setShowGruposModal(true);
              carregarVinculosGrupos(true);
            }}
            style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontWeight: 600 }}
          >
            <Users size={14} style={{ marginRight: 5, verticalAlign: -2 }} />
            Grupos ({Object.keys(vinculosGrupos).length})
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => abrirNovo(selectedDayIso)}
            style={{ background: '#600000', borderColor: '#600000', fontWeight: 700 }}
          >
            <Plus size={15} style={{ marginRight: 4, verticalAlign: -3 }} /> Novo Compromisso
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* KPIs Executivos */}
        <div className="agenda-kpi-grid">
          <div
            className="agenda-kpi-card"
            onClick={() => {
              setBaseDate(new Date());
              setSelectedDayIso(hojeStr);
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Hoje</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, marginTop: 2 }}>{resumoKpis.hojeTotal}</div>
              <div style={{ fontSize: 11.5, color: resumoKpis.hojePendentes > 0 ? '#600000' : '#16a34a', fontWeight: 600 }}>
                {resumoKpis.hojePendentes > 0 ? `${resumoKpis.hojePendentes} pendente(s)` : 'Dia em dia'}
              </div>
            </div>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fef2f2', color: '#600000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={18} />
            </div>
          </div>

          <div
            className="agenda-kpi-card"
            onClick={() => {
              setBaseDate(new Date());
              setView('week');
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Próximos 7 dias</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, marginTop: 2 }}>{resumoKpis.prox7Dias}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Pendentes na semana</div>
            </div>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={18} />
            </div>
          </div>

          <div
            className="agenda-kpi-card"
            onClick={() => setFiltroStatus(filtroStatus === 'concluidos' ? 'todos' : 'concluidos')}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Mês Atual</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, marginTop: 2 }}>
                {resumoKpis.mesPendentes + resumoKpis.mesConcluidos}
              </div>
              <div style={{ fontSize: 11.5, color: '#16a34a', fontWeight: 600 }}>
                {resumoKpis.mesConcluidos} concluído(s)
              </div>
            </div>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>

          <div
            className="agenda-kpi-card"
            onClick={() => {
              setShowGruposModal(true);
              carregarVinculosGrupos(true);
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Grupos WhatsApp</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, marginTop: 2 }}>{Object.keys(vinculosGrupos).length}</div>
              <div style={{ fontSize: 11.5, color: '#15803d', fontWeight: 600 }}>Lembretes 1d / 1h ativos</div>
            </div>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f0fdf4', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} />
            </div>
          </div>
        </div>

        {/* Barra de Navegação + Filtros */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setBaseDate(new Date());
                  setSelectedDayIso(hojeStr);
                }}
              >
                Hoje
              </button>
              <button className="agenda-icon-btn" onClick={() => mover(-1)} title="Anterior" style={{ border: '1px solid var(--border-light)' }}>
                <ChevronLeft size={16} />
              </button>
              <button className="agenda-icon-btn" onClick={() => mover(1)} title="Próximo" style={{ border: '1px solid var(--border-light)' }}>
                <ChevronRight size={16} />
              </button>
              <div style={{ fontWeight: 800, fontSize: 16.5, marginLeft: 4, textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                {tituloTopo}
              </div>
            </div>

            <div style={{ display: 'flex', background: 'var(--bg-base)', borderRadius: 9, padding: 3, border: '1px solid var(--border-light)' }}>
              {[
                { id: 'month' as const, label: 'Mês', icon: <LayoutGrid size={13} /> },
                { id: 'week' as const, label: 'Semana', icon: <Columns size={13} /> },
                { id: 'list' as const, label: 'Lista', icon: <List size={13} /> },
              ].map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setView(v.id)}
                  style={{
                    border: 'none',
                    borderRadius: 7,
                    padding: '5px 12px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 12.5,
                    background: view === v.id ? 'var(--bg-card)' : 'transparent',
                    boxShadow: view === v.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    fontWeight: view === v.id ? 700 : 500,
                    color: view === v.id ? '#600000' : 'var(--text-muted)',
                  }}
                >
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Linha de Filtros */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--border-light)' }}>
            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Buscar por assunto, cliente ou local..."
                value={buscaTexto}
                onChange={e => setBuscaTexto(e.target.value)}
                style={{ paddingLeft: 32, height: 34, fontSize: 12.5 }}
              />
            </div>

            <select
              className="form-control"
              value={filtroEmpresaId}
              onChange={e => setFiltroEmpresaId(e.target.value)}
              style={{ width: 'auto', minWidth: 165, maxWidth: 220, height: 34, fontSize: 12.5 }}
            >
              <option value="">Todas as empresas</option>
              {empresas.map(e => (
                <option key={e.id} value={e.id}>{e.nomeFantasia || e.razaoSocial}</option>
              ))}
            </select>

            <select
              className="form-control"
              value={filtroConsultorId}
              onChange={e => setFiltroConsultorId(e.target.value)}
              style={{ width: 'auto', minWidth: 150, maxWidth: 200, height: 34, fontSize: 12.5 }}
            >
              <option value="">Toda a equipe</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>

            <div style={{ display: 'inline-flex', gap: 4 }}>
              {([
                { id: 'todos', label: 'Todos' },
                { id: 'pendentes', label: 'Pendentes' },
                { id: 'concluidos', label: 'Concluídos' },
              ] as const).map(st => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setFiltroStatus(st.id)}
                  style={{
                    height: 32,
                    padding: '0 10px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: filtroStatus === st.id ? '#600000' : 'var(--border-light)',
                    background: filtroStatus === st.id ? '#600000' : 'var(--bg-base)',
                    color: filtroStatus === st.id ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {temFiltroAtivo && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setBuscaTexto('');
                  setFiltroEmpresaId('');
                  setFiltroConsultorId('');
                  setFiltroStatus('todos');
                }}
                style={{ fontSize: 12, color: '#dc2626' }}
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Layout Principal: Calendário/Lista + Painel Lateral do Dia */}
        <div className="agenda-layout">
          <div>
            {view === 'list' ? (
              <div className="card" style={{ padding: 16 }}>
                {diasListaPauta.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '44px 16px', color: 'var(--text-muted)' }}>
                    <Calendar size={34} style={{ opacity: 0.35, marginBottom: 10 }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                      Nenhum compromisso encontrado
                    </div>
                    <div style={{ fontSize: 12.5, marginBottom: 14 }}>
                      Ajuste os filtros ou crie um novo agendamento para este período.
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => abrirNovo(selectedDayIso)} style={{ background: '#600000', borderColor: '#600000' }}>
                      <Plus size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> Agendar compromisso
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {diasListaPauta.map(([iso, lista]) => {
                      const [ano, mes, diaNum] = iso.split('-').map(Number);
                      const dt = new Date(ano, mes - 1, diaNum);
                      const dataBrCurta = `${pad2(diaNum)}/${pad2(mes)}`;
                      const badgeDia = iso === hojeStr ? 'Hoje' : iso === amanhaStr ? 'Amanhã' : null;
                      return (
                        <div key={iso}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: 8,
                              paddingBottom: 6,
                              borderBottom: '1px solid var(--border-light)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 13.5, fontWeight: 800, color: iso === hojeStr ? '#600000' : 'var(--text-primary)' }}>
                                {DIAS_SEMANA[dt.getDay()]} · {diaNum} de {MESES[mes - 1]}
                              </span>
                              {badgeDia && (
                                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: iso === hojeStr ? '#600000' : '#eff6ff', color: iso === hojeStr ? '#fff' : '#2563eb' }}>
                                  {badgeDia}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => abrirNovo(iso)}
                              style={{ fontSize: 11.5, color: '#600000' }}
                            >
                              + Adicionar
                            </button>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {lista.map(t => renderCardCompromisso(t, dataBrCurta))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0, marginBottom: 4 }}>
                  {DIAS_SEMANA.map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, letterSpacing: '.06em', color: 'var(--text-muted)', padding: '4px 0' }}>
                      {d}
                    </div>
                  ))}
                </div>

                <div
                  className="card"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gridAutoRows: view === 'month' ? 'minmax(108px, 1fr)' : 'minmax(360px, 1fr)',
                    gap: 1,
                    padding: 0,
                    overflow: 'hidden',
                    background: 'var(--border-light)',
                  }}
                >
                  {dias.map(dia => {
                    const doDia = tasksPorDia.get(dia.iso) || [];
                    const visiveis = doDia.slice(0, view === 'month' ? 3 : 20);
                    const resto = doDia.length - visiveis.length;
                    const isSelected = selectedDayIso === dia.iso;

                    return (
                      <div
                        key={dia.iso}
                        className={`agenda-cell${isSelected ? ' is-selected' : ''}`}
                        onClick={() => setSelectedDayIso(dia.iso)}
                        onDoubleClick={() => abrirNovo(dia.iso)}
                        style={{ opacity: view === 'month' && !dia.noMes ? 0.42 : 1 }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          {doDia.length > 0 ? (
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', paddingLeft: 2 }}>
                              {doDia.length}
                            </span>
                          ) : <span />}
                          <span
                            style={{
                              width: 26,
                              height: 26,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '50%',
                              fontSize: 12.5,
                              fontWeight: dia.isHoje || isSelected ? 800 : 600,
                              background: dia.isHoje ? '#600000' : isSelected ? 'rgba(96,0,0,0.12)' : 'transparent',
                              color: dia.isHoje ? '#fff' : isSelected ? '#600000' : 'var(--text-primary)',
                            }}
                          >
                            {dia.date.getDate()}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden' }}>
                          {visiveis.map(t => {
                            const isGoogle = t.id.startsWith('gcal');
                            return (
                              <div
                                key={t.id}
                                className="agenda-chip"
                                title={`${t.horario} · ${t.title}`}
                                style={{
                                  background: t.completed
                                    ? 'rgba(22,163,74,0.12)'
                                    : isGoogle
                                      ? 'rgba(37,99,235,0.11)'
                                      : 'rgba(96,0,0,0.1)',
                                  color: t.completed ? '#15803d' : isGoogle ? '#1d4ed8' : '#7f1d1d',
                                  textDecoration: t.completed ? 'line-through' : 'none',
                                  opacity: t.completed ? 0.65 : 1,
                                }}
                              >
                                <span style={{ fontWeight: 800, marginRight: 3 }}>{t.horario}</span>
                                {t.title}
                              </div>
                            );
                          })}
                          {resto > 0 && (
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#600000', padding: '1px 5px' }}>
                              +{resto} mais
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Painel Lateral Fixo: Compromissos do Dia Selecionado */}
          <div className="card agenda-side-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '15px 16px',
                borderBottom: '1px solid var(--border-light)',
                background: 'var(--bg-base)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: selectedDayIso === hojeStr ? '#600000' : 'var(--text-muted)' }}>
                  {DIAS_SEMANA[dataSelecionadaObj.getDay()]} {selectedDayIso === hojeStr ? '• HOJE' : selectedDayIso === amanhaStr ? '• AMANHÃ' : ''}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {dataSelecionadaObj.getDate()} de {MESES[dataSelecionadaObj.getMonth()]}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => abrirNovo(selectedDayIso)}
                style={{ background: '#600000', borderColor: '#600000' }}
              >
                <Plus size={14} style={{ marginRight: 3, verticalAlign: -2 }} /> Novo
              </button>
            </div>

            <div style={{ padding: 14, maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
              {tarefasDoDiaSelecionado.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 12px', color: 'var(--text-muted)' }}>
                  <Calendar size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Dia livre
                  </div>
                  <div style={{ fontSize: 12, marginBottom: 12 }}>
                    Nenhum compromisso agendado para esta data.
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => abrirNovo(selectedDayIso)}
                    style={{ fontSize: 12 }}
                  >
                    + Agendar neste dia
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {tarefasDoDiaSelecionado.map(task =>
                    renderCardCompromisso(task, `${pad2(dataSelecionadaObj.getDate())}/${pad2(dataSelecionadaObj.getMonth() + 1)}`)
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de criação / edição */}
      {isModalOpen && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.52)', zIndex: 1100, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(6px)', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setIsModalOpen(false)}
        >
          <div className="card modal-create" style={{ width: 500, maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto', padding: 24, position: 'relative' }}>
            <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', right: 16, top: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={18} />
            </button>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>{newTask.id ? 'Editar compromisso' : 'Novo compromisso'}</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 18px' }}>
              Preencha os detalhes abaixo. Se a empresa tiver grupo vinculado, o aviso sai automaticamente.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Assunto / Título *</label>
                <input type="text" className="form-control" placeholder="Ex.: Reunião de fechamento mensal" value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} autoFocus />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Data *</label>
                  <input type="date" className="form-control" value={newTask.dateStr} onChange={e => setNewTask({ ...newTask, dateStr: e.target.value })} />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Horário *</label>
                  <input type="time" className="form-control" value={newTask.horario} onChange={e => setNewTask({ ...newTask, horario: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Empresa (opcional)</label>
                  <select className="form-control" value={newTask.empresaId} onChange={e => setNewTask({ ...newTask, empresaId: e.target.value })}>
                    <option value="">Selecione...</option>
                    {empresas.map(e => <option key={e.id} value={e.id}>{e.nomeFantasia || e.razaoSocial}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Participantes do Cliente</label>
                  <input type="text" className="form-control" placeholder="Ex.: João, Financeiro" value={(newTask as any).clienteParticipante || ''} onChange={e => setNewTask({ ...newTask, clienteParticipante: e.target.value } as any)} />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Local ou Link da Reunião</label>
                <input type="text" className="form-control" placeholder="Ex.: Google Meet, Presencial no escritório..." value={newTask.location || ''} onChange={e => setNewTask({ ...newTask, location: e.target.value })} />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Equipe Responsável</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {users.map(u => {
                    const ids: string[] = (newTask as any).consultoresIds || [];
                    const ativo = ids.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          if (ativo) setNewTask({ ...newTask, consultoresIds: ids.filter(i => i !== u.id) } as any);
                          else setNewTask({ ...newTask, consultoresIds: [...ids, u.id] } as any);
                        }}
                        style={{
                          padding: '5px 11px',
                          borderRadius: 99,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: '1px solid',
                          borderColor: ativo ? '#600000' : 'var(--border)',
                          background: ativo ? '#600000' : 'var(--bg-base)',
                          color: ativo ? '#fff' : 'var(--text-secondary)',
                        }}
                      >
                        {ativo ? '✓ ' : ''}{u.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {newTask.empresaId && vinculosGrupos[newTask.empresaId] && (
                <div style={{ padding: '10px 12px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: '#15803d', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={avisarGrupoAoSalvar}
                      onChange={e => setAvisarGrupoAoSalvar(e.target.checked)}
                    />
                    <span>
                      {newTask.id ? 'Avisar alteração no grupo:' : 'Enviar no grupo do cliente:'}{' '}
                      <strong>{vinculosGrupos[newTask.empresaId].groupName}</strong>
                    </span>
                  </label>
                  <div style={{ fontSize: 11, color: '#166534', marginTop: 4 }}>
                    Lembretes automáticos de <strong>1 dia antes</strong> e <strong>1 hora antes</strong> serão disparados 24h pelo servidor.
                  </div>
                </div>
              )}

              <div style={{ padding: '10px 12px', borderRadius: 10, background: enviarWppAgenda ? '#f0fdf4' : 'var(--bg-base)', border: `1px solid ${enviarWppAgenda ? '#bbf7d0' : 'var(--border)'}` }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={enviarWppAgenda}
                    onChange={e => salvarPrefWppAgenda(e.target.checked, wppAgendaNumero)}
                  />
                  <span>Enviar também em um WhatsApp individual (via 46 99980-0010)</span>
                </label>
                {enviarWppAgenda && (
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="WhatsApp com DDD (ex.: 46999016003)"
                    value={wppAgendaNumero}
                    onChange={e => salvarPrefWppAgenda(true, e.target.value)}
                    style={{ marginTop: 8 }}
                  />
                )}
              </div>

              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSaveTask} style={{ background: '#600000', borderColor: '#600000' }}>
                  {newTask.id ? 'Salvar alterações' : 'Agendar compromisso'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Vínculo Empresa <-> Grupo WhatsApp */}
      {showGruposModal && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(6px)', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowGruposModal(false)}
        >
          <div className="card" style={{ width: 620, maxWidth: '96vw', maxHeight: '88vh', overflowY: 'auto', padding: 24, position: 'relative' }}>
            <button onClick={() => setShowGruposModal(false)} style={{ position: 'absolute', right: 16, top: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={18} />
            </button>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>👥 Grupos de WhatsApp dos Clientes</h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.45 }}>
              Vincule cada empresa ao seu grupo no WhatsApp <strong>(46) 99980-0010</strong>. O sistema enviará automaticamente no grupo: <strong>novo agendamento</strong>, <strong>alteração de data/horário</strong>, <strong>confirmação 1 dia antes</strong> e <strong>lembrete 1 hora antes</strong> (24h/dia no servidor).
            </p>

            {!sessaoGruposOk && !carregandoGrupos && (
              <div style={{ padding: '10px 12px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: 12.5, marginBottom: 14 }}>
                A sessão do WhatsApp <strong>(46) 99980-0010</strong> não está conectada no momento. Conecte em WhatsApp &amp; Bot IA para carregar a lista de grupos.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 12 }}>
              <div>
                <label className="form-label" style={{ fontSize: 12 }}>Empresa</label>
                <select className="form-control" value={grupoEmpresaSel} onChange={e => setGrupoEmpresaSel(e.target.value)}>
                  <option value="">Selecione a empresa...</option>
                  {empresas.map(e => (
                    <option key={e.id} value={e.id}>{e.nomeFantasia || e.razaoSocial}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 12 }}>
                  Grupo no WhatsApp {carregandoGrupos ? '(carregando...)' : `(${gruposWppDisponiveis.length})`}
                </label>
                <select className="form-control" value={grupoJidSel} onChange={e => setGrupoJidSel(e.target.value)} disabled={carregandoGrupos}>
                  <option value="">Selecione o grupo...</option>
                  {gruposWppDisponiveis.map(g => (
                    <option key={g.jid} value={g.jid}>{g.nome} ({g.participantes} membros)</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => carregarVinculosGrupos(true)} disabled={carregandoGrupos}>
                {carregandoGrupos ? 'Carregando grupos...' : '↻ Atualizar grupos do WhatsApp'}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={salvarVinculoGrupo}
                disabled={salvandoGrupo || !grupoEmpresaSel || !grupoJidSel}
                style={{ background: '#15803d', borderColor: '#15803d' }}
              >
                {salvandoGrupo ? 'Salvando...' : '+ Vincular Grupo'}
              </button>
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 8 }}>
              Empresas Vinculadas ({Object.keys(vinculosGrupos).length})
            </div>

            {Object.keys(vinculosGrupos).length === 0 ? (
              <div style={{ padding: 18, textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 10 }}>
                Nenhuma empresa vinculada a um grupo ainda.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.values(vinculosGrupos).map(v => {
                  const emp = empresas.find(e => e.id === v.empresaId);
                  return (
                    <div
                      key={v.empresaId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{emp?.nomeFantasia || emp?.razaoSocial || v.empresaId}</div>
                        <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>👥 {v.groupName}</div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#dc2626', borderColor: '#fecaca' }}
                        onClick={() => removerVinculoGrupo(v.empresaId)}
                      >
                        Remover
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
