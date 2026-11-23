'use client';
import { useEffect, useMemo, useState } from 'react';
import { store, Empresa, User, AgendaTask } from '../../../lib/store';
import { toast } from 'sonner';
import { confirmAsync } from '../../../components/ConfirmProvider';
import { useGoogleLogin } from '@react-oauth/google';
import { ChevronLeft, ChevronRight, Plus, Trash2, Check, Copy, X, Edit2, MessageSquare, Users } from 'lucide-react';

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
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes springPop { 0% { transform: scale(0.7) translateY(30px); opacity: 0; } 60% { transform: scale(1.04) translateY(-3px); opacity: 1; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
        
        .calendar-cell { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .calendar-cell:hover { transform: scale(1.06); box-shadow: 0 18px 45px rgba(0,0,0,0.15); z-index: 20; border-radius: 12px; position: relative; border-color: transparent !important; }
        
        .event-chip { transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); cursor: pointer; }
        .event-chip:hover { transform: translateX(5px) scale(1.03); filter: brightness(0.9); box-shadow: 0 6px 14px rgba(0,0,0,0.12); }
        
        .task-card { animation: slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) backwards; transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .task-card:hover { transform: translateY(-5px) scale(1.02); box-shadow: 0 12px 28px rgba(0,0,0,0.12); }
        
        .modal-overlay { animation: fadeIn 0.3s ease-out; }
        .modal-slide { animation: slideInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        .modal-create { animation: springPop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
      `}</style>

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, animation: 'fadeIn 0.5s ease-out' }}>
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
          <button
            className="btn btn-secondary"
            onClick={() => {
              setShowGruposModal(true);
              carregarVinculosGrupos(true);
            }}
            style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontWeight: 600 }}
          >
            <Users size={15} style={{ marginRight: 5, verticalAlign: -3 }} />
            Grupos dos Clientes ({Object.keys(vinculosGrupos).length})
          </button>
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
                className="calendar-cell"
                onClick={() => setSelectedDayIso(dia.iso)}
                style={{
                  background: 'var(--bg-card)', padding: '6px 6px 8px', cursor: 'pointer',
                  opacity: view === 'month' && !dia.noMes ? 0.45 : 1,
                  display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0,
                  animation: `slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) backwards`,
                  animationDelay: `${Math.min(20, dia.date.getDate() % 7) * 0.03}s` // staggered animation
                }}
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
                        className="event-chip"
                        title={`${t.horario} · ${t.title}`}
                        style={{
                          fontSize: 10.5, fontWeight: 600, padding: '2px 6px', borderRadius: 5,
                          background: isGoogle ? 'rgba(59,130,246,0.12)' : 'rgba(140,26,34,0.1)',
                          color: isGoogle ? '#2563eb' : 'var(--accent)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          textDecoration: t.completed ? 'line-through' : 'none',
                          opacity: t.completed ? 0.55 : 1,
                          animation: 'fadeIn 0.4s ease-out'
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
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end', backdropFilter: 'blur(3px)' }}
          onClick={() => setSelectedDayIso(null)}
        >
          <div
            className="card modal-slide"
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
                {tarefasDoDiaSelecionado.map((task, index) => {
                  const emp = empresas.find(e => e.id === task.empresaId);
                  const multiIds = (task as any).consultoresIds || (task.consultorId ? [task.consultorId] : []);
                  const consNomes = multiIds.map((id: string) => users.find(u => u.id === id)?.name).filter(Boolean).join(', ');
                  const isGoogle = task.id.startsWith('gcal');
                  return (
                    <div key={task.id} className="task-card" style={{
                      padding: 14, borderRadius: 12, border: '1px solid var(--border-light)',
                      borderLeft: `5px solid ${isGoogle ? '#3b82f6' : 'var(--accent)'}`,
                      opacity: task.completed ? 0.6 : 1,
                      animationDelay: `${index * 0.08}s`
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, textDecoration: task.completed ? 'line-through' : 'none' }}>
                          <span style={{ color: isGoogle ? '#3b82f6' : 'var(--accent)', marginRight: 6 }}>{task.horario}</span>
                          {task.title}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button
                            title="Enviar compromisso no WhatsApp (via 46 99980-0010)"
                            disabled={enviandoWppTaskId === task.id}
                            onClick={() => enviarCompromissoWhatsApp(task, `${diaSelecionado.date.getDate()}/${pad2(diaSelecionado.date.getMonth() + 1)}`)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#15803d', opacity: enviandoWppTaskId === task.id ? 0.5 : 1 }}
                          >
                            <MessageSquare size={14} />
                          </button>
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
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(8px)' }}>
          <div className="card modal-create" style={{ width: 440, maxWidth: '92vw', padding: 24, position: 'relative' }}>
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
                    Confirmações automáticas de <strong>1 dia antes</strong> e <strong>1 hora antes</strong> também serão disparadas 24h pelo servidor.
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
                  <span>Enviar no WhatsApp ao agendar (via 46 99980-0010)</span>
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

              <div style={{ marginTop: 4, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSaveTask}>Salvar</button>
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
