'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckSquare, Plus, LayoutGrid, List, Search, Calendar, Clock, AlertTriangle,
  Building2, User as UserIcon, Repeat, Paperclip, MessageSquare, Send, Trash2,
  X, CheckCircle2, Circle, Download, Upload, Bell, Eye, EyeOff, RefreshCw,
  Sparkles, Users, Timer, Flag, FolderKanban,
} from 'lucide-react';
import { store, type Empresa, type User } from '../lib/store';
import { toast } from 'sonner';
import type {
  TarefaAnexo,
  TarefaDestinoTipo,
  TarefaPrioridade,
  TarefaRecord,
  TarefaStatus,
  TarefaSubtarefa,
} from '../lib/tarefas-db';

interface Props {
  modo: 'consultor' | 'cliente';
}

const COLUNAS: Array<{ id: TarefaStatus; label: string; cor: string; bg: string; border: string }> = [
  { id: 'a_fazer', label: 'A Fazer', cor: '#475569', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.22)' },
  { id: 'em_andamento', label: 'Em Andamento', cor: '#2563eb', bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.22)' },
  { id: 'aguardando', label: 'Aguardando', cor: '#d97706', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.24)' },
  { id: 'concluida', label: 'Concluída', cor: '#16a34a', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.22)' },
];

const PRIORIDADE_META: Record<TarefaPrioridade, { label: string; cor: string; bg: string }> = {
  baixa: { label: 'Baixa', cor: '#64748b', bg: 'rgba(100,116,139,0.12)' },
  media: { label: 'Média', cor: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
  alta: { label: 'Alta', cor: '#d97706', bg: 'rgba(217,119,6,0.14)' },
  urgente: { label: 'Urgente', cor: '#dc2626', bg: 'rgba(220,38,38,0.14)' },
};

const CATEGORIAS_PADRAO = [
  'Financeiro',
  'Fiscal / NF-e',
  'Contábil',
  'DP / RH',
  'Documentos / Extratos',
  'Reunião / Alinhamento',
  'Administrativo',
  'Outro',
];

const MODELOS_RAPIDOS: Array<{
  label: string;
  titulo: string;
  categoria: string;
  prioridade: TarefaPrioridade;
  destinoTipo: TarefaDestinoTipo;
  recorrente: boolean;
  descricao: string;
  subtarefas: string[];
}> = [
  {
    label: 'Extratos Mensais',
    titulo: 'Enviar extratos bancários e comprovantes do mês',
    categoria: 'Documentos / Extratos',
    prioridade: 'alta',
    destinoTipo: 'cliente',
    recorrente: true,
    descricao: 'Por favor, anexe os extratos bancários em OFX/PDF e os comprovantes de pagamento referentes ao fechamento do mês.',
    subtarefas: ['Extrato bancário (OFX ou PDF)', 'Comprovantes de pagamentos', 'Relatório de cartões / recebíveis'],
  },
  {
    label: 'Emissão NFS-e',
    titulo: 'Conferir e emitir notas fiscais de serviço do período',
    categoria: 'Fiscal / NF-e',
    prioridade: 'alta',
    destinoTipo: 'ambos',
    recorrente: true,
    descricao: 'Validar a relação de clientes/valores do mês e emitir as NFS-e no Portal Nacional.',
    subtarefas: ['Validar lista de clientes e valores', 'Transmitir lote no Emissor Nacional', 'Enviar PDF/XML aos tomadores'],
  },
  {
    label: 'Pendência Financeira',
    titulo: 'Regularizar pendência de contas a pagar / receber',
    categoria: 'Financeiro',
    prioridade: 'urgente',
    destinoTipo: 'cliente',
    recorrente: false,
    descricao: 'Verificar os títulos em aberto e retornar com o comprovante ou previsão de quitação.',
    subtarefas: ['Conferir títulos pendentes', 'Anexar comprovante de pagamento'],
  },
  {
    label: 'Rotina Interna',
    titulo: 'Fechamento contábil e conciliação bancária',
    categoria: 'Contábil',
    prioridade: 'media',
    destinoTipo: 'usuario',
    recorrente: true,
    descricao: 'Executar conciliação bancária, revisão de plano de contas e fechamento do DRE mensal.',
    subtarefas: ['Importar e conciliar OFX', 'Revisar classificações', 'Validar DRE e Fluxo de Caixa'],
  },
];

function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function somarDiasIso(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDataBr(iso: string | null): string {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

function fmtDataHoraBr(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function fmtTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatarDuracaoMs(ms: number): string {
  const seguro = Math.max(0, ms);
  const minTotal = Math.floor(seguro / 60000);
  if (minTotal < 1) return 'agora';
  if (minTotal < 60) return `${minTotal}min`;
  const horasTotal = Math.floor(minTotal / 60);
  const mins = minTotal % 60;
  if (horasTotal < 24) return mins > 0 ? `${horasTotal}h ${mins}m` : `${horasTotal}h`;
  const dias = Math.floor(horasTotal / 24);
  const horas = horasTotal % 24;
  return horas > 0 ? `${dias}d ${horas}h` : `${dias}d`;
}

function calcularTempoAberto(t: TarefaRecord, agoraMs: number): { texto: string; ms: number; concluida: boolean } {
  const inicio = new Date(t.createdAt).getTime();
  if (Number.isNaN(inicio)) return { texto: '—', ms: 0, concluida: t.status === 'concluida' };
  if (t.status === 'concluida') {
    const fim = t.concluidaEm ? new Date(t.concluidaEm).getTime() : new Date(t.updatedAt).getTime();
    const diff = Math.max(0, (Number.isNaN(fim) ? agoraMs : fim) - inicio);
    return { texto: `Concluída em ${formatarDuracaoMs(diff)}`, ms: diff, concluida: true };
  }
  const diff = Math.max(0, agoraMs - inicio);
  return {
    texto: diff < 60000 ? 'Aberta agora' : `Aberta há ${formatarDuracaoMs(diff)}`,
    ms: diff,
    concluida: false,
  };
}

export default function TarefasPainel({ modo }: Props) {
  const isConsultor = modo === 'consultor';

  const [tarefas, setTarefas] = useState<TarefaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [empresaSelecionadaCliente, setEmpresaSelecionadaCliente] = useState('');
  const [agoraMs, setAgoraMs] = useState(() => Date.now());

  // Visualização e filtros
  const [view, setView] = useState<'kanban' | 'lista'>('kanban');
  const [busca, setBusca] = useState('');
  const [chipFiltro, setChipFiltro] = useState<'todas' | 'minhas' | 'clientes' | 'equipe' | 'atrasadas' | 'recorrentes'>('todas');
  const [filtroEmpresaId, setFiltroEmpresaId] = useState('');
  const [filtroResponsavelId, setFiltroResponsavelId] = useState('');
  const [filtroPrioridade, setFiltroPrioridade] = useState('');

  // Drag & Drop Kanban
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TarefaStatus | null>(null);

  // Modal de criação / detalhe
  const [modalAberto, setModalAberto] = useState(false);
  const [tarefaAtiva, setTarefaAtiva] = useState<TarefaRecord | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [enviandoWppId, setEnviandoWppId] = useState<string | null>(null);

  // Campos do formulário
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [statusForm, setStatusForm] = useState<TarefaStatus>('a_fazer');
  const [prioridadeForm, setPrioridadeForm] = useState<TarefaPrioridade>('media');
  const [categoriaForm, setCategoriaForm] = useState('Financeiro');
  const [destinoTipoForm, setDestinoTipoForm] = useState<TarefaDestinoTipo>('cliente');
  const [empresaIdForm, setEmpresaIdForm] = useState('');
  const [responsavelUserIdForm, setResponsavelUserIdForm] = useState('');
  const [prazoForm, setPrazoForm] = useState('');
  const [recorrenteForm, setRecorrenteForm] = useState(false);
  const [recorrenciaDiaForm, setRecorrenciaDiaForm] = useState(5);
  const [visivelClienteForm, setVisivelClienteForm] = useState(true);
  const [notificarWppAoCriar, setNotificarWppAoCriar] = useState(true);
  const [subtarefasForm, setSubtarefasForm] = useState<TarefaSubtarefa[]>([]);
  const [novaSubtarefaTexto, setNovaSubtarefaTexto] = useState('');
  const [novoComentarioTexto, setNovoComentarioTexto] = useState('');
  const [anexosPendentes, setAnexosPendentes] = useState<Array<{ nome: string; tipo: string; tamanho: number; dataUrl: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Atualiza o relógio de "tempo aberto" a cada minuto
  useEffect(() => {
    const id = setInterval(() => setAgoraMs(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const carregarDados = async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    try {
      const res = await fetch('/api/tarefas', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.tarefas)) {
        setTarefas(data.tarefas);
        setAgoraMs(Date.now());
        if (tarefaAtiva) {
          const atualizada = data.tarefas.find((t: TarefaRecord) => t.id === tarefaAtiva.id);
          if (atualizada) setTarefaAtiva(atualizada);
        }
      }
    } catch {
      if (!silencioso) toast.error('Não foi possível carregar as tarefas.');
    } finally {
      if (!silencioso) setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentUser(store.getCurrentUser());
    setEmpresas(store.getEmpresas().sort((a, b) => (a.nomeFantasia || a.razaoSocial).localeCompare(b.nomeFantasia || b.razaoSocial)));
    setUsuarios(store.getUsers().sort((a, b) => a.name.localeCompare(b.name)));

    if (!isConsultor) {
      const saved = sessionStorage.getItem('cf_empresa_sel');
      setEmpresaSelecionadaCliente(store.getSafeEmpresaId(saved));
      const onEmp = (e: Event) => setEmpresaSelecionadaCliente(store.getSafeEmpresaId((e as CustomEvent).detail));
      window.addEventListener('empresaChange', onEmp);
      carregarDados();
      return () => window.removeEventListener('empresaChange', onEmp);
    }

    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConsultor]);

  const hoje = hojeIso();
  const isAtrasada = (t: TarefaRecord) => Boolean(t.prazo && t.status !== 'concluida' && t.prazo < hoje);

  const tarefasVisiveisBase = useMemo(() => {
    if (isConsultor) return tarefas;
    if (!empresaSelecionadaCliente) return tarefas;
    return tarefas.filter(
      (t) => t.empresaId === empresaSelecionadaCliente || t.responsavelUserId === currentUser?.id
    );
  }, [tarefas, isConsultor, empresaSelecionadaCliente, currentUser]);

  const kpis = useMemo(() => {
    let abertas = 0;
    let andamento = 0;
    let atrasadas = 0;
    let concluidas = 0;
    let somaResolucaoMs = 0;
    let qtdComTempo = 0;

    for (const t of tarefasVisiveisBase) {
      if (t.status === 'concluida') {
        concluidas++;
        const tempo = calcularTempoAberto(t, agoraMs);
        if (tempo.ms > 0) {
          somaResolucaoMs += tempo.ms;
          qtdComTempo++;
        }
      } else {
        abertas++;
        if (t.status === 'em_andamento') andamento++;
        if (isAtrasada(t)) atrasadas++;
      }
    }
    const tempoMedioTexto = qtdComTempo > 0 ? formatarDuracaoMs(somaResolucaoMs / qtdComTempo) : '—';
    return { abertas, andamento, atrasadas, concluidas, tempoMedioTexto };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefasVisiveisBase, hoje, agoraMs]);

  const tarefasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return tarefasVisiveisBase.filter((t) => {
      if (chipFiltro === 'minhas' && currentUser && t.responsavelUserId !== currentUser.id) return false;
      if (chipFiltro === 'clientes' && t.destinoTipo === 'usuario') return false;
      if (chipFiltro === 'equipe' && t.destinoTipo === 'cliente') return false;
      if (chipFiltro === 'atrasadas' && !isAtrasada(t)) return false;
      if (chipFiltro === 'recorrentes' && !t.recorrente) return false;
      if (filtroEmpresaId && t.empresaId !== filtroEmpresaId) return false;
      if (filtroResponsavelId && t.responsavelUserId !== filtroResponsavelId) return false;
      if (filtroPrioridade && t.prioridade !== filtroPrioridade) return false;
      if (q) {
        const hay = `${t.titulo} ${t.descricao} ${t.empresaNome || ''} ${t.responsavelNome || ''} ${t.categoria}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefasVisiveisBase, chipFiltro, filtroEmpresaId, filtroResponsavelId, filtroPrioridade, busca, currentUser, hoje]);

  const abrirNovaTarefa = (statusInicial: TarefaStatus = 'a_fazer') => {
    setTarefaAtiva(null);
    setTitulo('');
    setDescricao('');
    setStatusForm(statusInicial);
    setPrioridadeForm('media');
    setCategoriaForm('Financeiro');
    setDestinoTipoForm('cliente');
    setEmpresaIdForm(filtroEmpresaId || '');
    setResponsavelUserIdForm(filtroResponsavelId || '');
    setPrazoForm(somarDiasIso(3));
    setRecorrenteForm(false);
    setRecorrenciaDiaForm(5);
    setVisivelClienteForm(true);
    setNotificarWppAoCriar(true);
    setSubtarefasForm([]);
    setNovaSubtarefaTexto('');
    setNovoComentarioTexto('');
    setAnexosPendentes([]);
    setModalAberto(true);
  };

  const aplicarModeloRapido = (m: (typeof MODELOS_RAPIDOS)[number]) => {
    setTitulo(m.titulo);
    setCategoriaForm(m.categoria);
    setPrioridadeForm(m.prioridade);
    setDestinoTipoForm(m.destinoTipo);
    setVisivelClienteForm(m.destinoTipo !== 'usuario');
    setRecorrenteForm(m.recorrente);
    setDescricao(m.descricao);
    setSubtarefasForm(
      m.subtarefas.map((txt) => ({
        id: Math.random().toString(36).slice(2, 10),
        titulo: txt,
        concluida: false,
      }))
    );
    toast.info(`Modelo "${m.label}" aplicado — ajuste o destinatário e o prazo.`);
  };

  const abrirDetalheTarefa = (t: TarefaRecord) => {
    setTarefaAtiva(t);
    setTitulo(t.titulo);
    setDescricao(t.descricao);
    setStatusForm(t.status);
    setPrioridadeForm(t.prioridade);
    setCategoriaForm(t.categoria || 'Financeiro');
    setDestinoTipoForm(t.destinoTipo);
    setEmpresaIdForm(t.empresaId || '');
    setResponsavelUserIdForm(t.responsavelUserId || '');
    setPrazoForm(t.prazo || '');
    setRecorrenteForm(t.recorrente);
    setRecorrenciaDiaForm(t.recorrenciaDia || 5);
    setVisivelClienteForm(t.visivelCliente);
    setSubtarefasForm(t.subtarefas || []);
    setNovaSubtarefaTexto('');
    setNovoComentarioTexto('');
    setAnexosPendentes([]);
    setModalAberto(true);
  };

  const atualizarStatusRapido = async (t: TarefaRecord, novoStatus: TarefaStatus) => {
    if (t.status === novoStatus) return;
    setTarefas((prev) => prev.map((item) => (item.id === t.id ? { ...item, status: novoStatus } : item)));
    try {
      const res = await fetch(`/api/tarefas/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao mover tarefa.');
      setTarefas((prev) => {
        const mapped = prev.map((item) => (item.id === t.id ? data.tarefa : item));
        return data.proximaRecorrencia ? [data.proximaRecorrencia, ...mapped] : mapped;
      });
      if (data.proximaRecorrencia) {
        toast.success(`Tarefa concluída! Próxima ocorrência mensal criada para ${fmtDataBr(data.proximaRecorrencia.prazo)}.`);
      } else if (novoStatus === 'concluida') {
        toast.success('Tarefa marcada como concluída!');
      }
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao atualizar status.');
      carregarDados(true);
    }
  };

  const salvarModal = async () => {
    if (!titulo.trim()) {
      toast.error('Informe o título da tarefa.');
      return;
    }
    if (isConsultor && destinoTipoForm === 'cliente' && !empresaIdForm) {
      toast.error('Selecione a empresa cliente destinatária.');
      return;
    }
    if (isConsultor && destinoTipoForm === 'usuario' && !responsavelUserIdForm) {
      toast.error('Selecione o usuário responsável.');
      return;
    }

    setSalvando(true);
    try {
      if (!tarefaAtiva) {
        const res = await fetch('/api/tarefas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            titulo: titulo.trim(),
            descricao: descricao.trim(),
            status: statusForm,
            prioridade: prioridadeForm,
            categoria: categoriaForm,
            destinoTipo: destinoTipoForm,
            empresaId: destinoTipoForm === 'usuario' ? (empresaIdForm || null) : empresaIdForm || null,
            responsavelUserId: destinoTipoForm === 'cliente' ? null : (responsavelUserIdForm || null),
            prazo: prazoForm || null,
            recorrente: recorrenteForm,
            recorrenciaDia: recorrenteForm ? recorrenciaDiaForm : null,
            visivelCliente: visivelClienteForm,
            subtarefas: subtarefasForm,
            anexos: anexosPendentes,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Erro ao criar tarefa.');

        setTarefas((prev) => [data.tarefa, ...prev]);
        toast.success('Tarefa criada com sucesso!');
        setModalAberto(false);

        if (isConsultor && notificarWppAoCriar && data.tarefa?.id) {
          dispararWhatsApp(data.tarefa.id, 'nova', true);
        }
      } else {
        const payload: any = {
          status: statusForm,
          subtarefas: subtarefasForm,
        };
        if (isConsultor) {
          payload.titulo = titulo.trim();
          payload.descricao = descricao.trim();
          payload.prioridade = prioridadeForm;
          payload.categoria = categoriaForm;
          payload.destinoTipo = destinoTipoForm;
          payload.empresaId = empresaIdForm || null;
          payload.responsavelUserId = destinoTipoForm === 'cliente' ? null : (responsavelUserIdForm || null);
          payload.prazo = prazoForm || null;
          payload.recorrente = recorrenteForm;
          payload.recorrenciaDia = recorrenteForm ? recorrenciaDiaForm : null;
          payload.visivelCliente = visivelClienteForm;
        }
        const res = await fetch(`/api/tarefas/${tarefaAtiva.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Erro ao salvar alterações.');

        setTarefas((prev) => {
          const mapped = prev.map((item) => (item.id === tarefaAtiva.id ? data.tarefa : item));
          return data.proximaRecorrencia ? [data.proximaRecorrencia, ...mapped] : mapped;
        });
        setTarefaAtiva(data.tarefa);
        if (data.proximaRecorrencia) {
          toast.success(`Salvo! Próxima ocorrência mensal criada para ${fmtDataBr(data.proximaRecorrencia.prazo)}.`);
        } else {
          toast.success('Tarefa atualizada!');
        }
        setModalAberto(false);
      }
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao salvar tarefa.');
    } finally {
      setSalvando(false);
    }
  };

  const excluirTarefa = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta tarefa?')) return;
    try {
      const res = await fetch(`/api/tarefas/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao excluir tarefa.');
      setTarefas((prev) => prev.filter((t) => t.id !== id));
      if (tarefaAtiva?.id === id) setModalAberto(false);
      toast.success('Tarefa excluída.');
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao excluir tarefa.');
    }
  };

  const dispararWhatsApp = async (id: string, tipo: 'nova' | 'lembrete', silenciosoSeSemDestino = false) => {
    setEnviandoWppId(id);
    try {
      const res = await fetch(`/api/tarefas/${id}/notificar-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (silenciosoSeSemDestino && res.status === 400) return;
        throw new Error(data.error || 'Não foi possível enviar no WhatsApp.');
      }
      toast.success(`Aviso enviado no WhatsApp (${data.destinoNome})!`);
      carregarDados(true);
    } catch (err) {
      toast.warning((err as Error).message || 'WhatsApp indisponível.');
    } finally {
      setEnviandoWppId(null);
    }
  };

  const adicionarSubtarefa = () => {
    const txt = novaSubtarefaTexto.trim();
    if (!txt) return;
    setSubtarefasForm((prev) => [
      ...prev,
      { id: Math.random().toString(36).slice(2, 10), titulo: txt, concluida: false },
    ]);
    setNovaSubtarefaTexto('');
  };

  const toggleSubtarefa = (subId: string) => {
    setSubtarefasForm((prev) => prev.map((s) => (s.id === subId ? { ...s, concluida: !s.concluida } : s)));
  };

  const enviarComentario = async () => {
    if (!tarefaAtiva || !novoComentarioTexto.trim()) return;
    const texto = novoComentarioTexto.trim();
    setNovoComentarioTexto('');
    try {
      const res = await fetch(`/api/tarefas/${tarefaAtiva.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ novoComentario: texto }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar comentário.');
      setTarefaAtiva(data.tarefa);
      setTarefas((prev) => prev.map((t) => (t.id === tarefaAtiva.id ? data.tarefa : t)));
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao comentar.');
      setNovoComentarioTexto(texto);
    }
  };

  const handleUploadArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error('Arquivo muito grande (limite de 4 MB por anexo).');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      const novoAnexo = { nome: file.name, tipo: file.type || 'application/octet-stream', tamanho: file.size, dataUrl };
      if (!tarefaAtiva) {
        setAnexosPendentes((prev) => [...prev, novoAnexo]);
        toast.success(`Arquivo "${file.name}" anexado.`);
        return;
      }
      try {
        const res = await fetch(`/api/tarefas/${tarefaAtiva.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ novoAnexo }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Erro ao enviar anexo.');
        setTarefaAtiva(data.tarefa);
        setTarefas((prev) => prev.map((t) => (t.id === tarefaAtiva.id ? data.tarefa : t)));
        toast.success(`Arquivo "${file.name}" anexado!`);
      } catch (err) {
        toast.error((err as Error).message || 'Erro ao anexar arquivo.');
      }
    };
    reader.readAsDataURL(file);
  };

  const removerAnexoExistente = async (anexoId: string) => {
    if (!tarefaAtiva) return;
    try {
      const res = await fetch(`/api/tarefas/${tarefaAtiva.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removerAnexoId: anexoId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error('Erro ao remover anexo.');
      setTarefaAtiva(data.tarefa);
      setTarefas((prev) => prev.map((t) => (t.id === tarefaAtiva.id ? data.tarefa : t)));
    } catch {
      toast.error('Não foi possível remover o anexo.');
    }
  };

  const renderBadgeTempo = (t: TarefaRecord) => {
    const info = calcularTempoAberto(t, agoraMs);
    const maisDe5Dias = !info.concluida && info.ms > 5 * 86400000;
    return (
      <span
        title={`Criada em ${fmtDataHoraBr(t.createdAt)}${t.concluidaEm ? ` · Concluída em ${fmtDataHoraBr(t.concluidaEm)}` : ''}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 10.5,
          fontWeight: 700,
          padding: '2px 7px',
          borderRadius: 999,
          background: info.concluida
            ? 'rgba(22,163,74,0.12)'
            : maisDe5Dias
              ? 'rgba(220,38,38,0.12)'
              : 'rgba(100,116,139,0.12)',
          color: info.concluida ? '#15803d' : maisDe5Dias ? '#dc2626' : 'var(--text-secondary)',
          whiteSpace: 'nowrap',
        }}
      >
        <Timer size={11} /> {info.texto}
      </span>
    );
  };

  const renderCard = (t: TarefaRecord) => {
    const prio = PRIORIDADE_META[t.prioridade] || PRIORIDADE_META.media;
    const atrasada = isAtrasada(t);
    const venceHoje = Boolean(t.prazo && t.status !== 'concluida' && t.prazo === hoje);
    const totalSubs = t.subtarefas.length;
    const feitasSubs = t.subtarefas.filter((s) => s.concluida).length;

    return (
      <div
        key={t.id}
        draggable
        onDragStart={() => setDragId(t.id)}
        onDragEnd={() => {
          setDragId(null);
          setDragOverCol(null);
        }}
        onClick={() => abrirDetalheTarefa(t)}
        style={{
          background: 'var(--bg-card)',
          border: `1px solid ${atrasada ? 'rgba(220,38,38,0.45)' : 'var(--border)'}`,
          borderRadius: 12,
          padding: 13,
          cursor: 'pointer',
          transition: 'transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease',
          opacity: dragId === t.id ? 0.55 : 1,
          boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
        }}
      >
        {/* Linha superior: prioridade + categoria + recorrência */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, color: prio.cor, background: prio.bg }}>
              {prio.label}
            </span>
            {t.categoria && (
              <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 999, color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}>
                {t.categoria}
              </span>
            )}
          </div>
          {t.recorrente && (
            <span title={`Recorrente mensal (todo dia ${t.recorrenciaDia || '--'})`} style={{ color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 700 }}>
              <Repeat size={12} /> Mensal
            </span>
          )}
        </div>

        {/* Título */}
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35, marginBottom: 6 }}>
          {t.titulo}
        </div>

        {/* Destinatários: Empresa e/ou Usuário */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          {t.empresaNome && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-secondary)' }}>
              <Building2 size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.empresaNome}</span>
            </div>
          )}
          {t.responsavelNome && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-secondary)' }}>
              <UserIcon size={12} style={{ color: '#6366f1', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.responsavelNome}</span>
            </div>
          )}
        </div>

        {/* Tempo aberto / resolvido */}
        <div style={{ marginBottom: 8 }}>{renderBadgeTempo(t)}</div>

        {/* Progresso de subtarefas */}
        {totalSubs > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 3 }}>
              <span>Checklist</span>
              <span style={{ fontWeight: 700 }}>{feitasSubs}/{totalSubs}</span>
            </div>
            <div style={{ height: 5, borderRadius: 99, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((feitasSubs / totalSubs) * 100)}%`, height: '100%', background: feitasSubs === totalSubs ? '#16a34a' : 'var(--accent)', transition: 'width 200ms' }} />
            </div>
          </div>
        )}

        {/* Rodapé do card */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 700,
              color: atrasada ? '#dc2626' : venceHoje ? '#d97706' : 'var(--text-muted)',
            }}
          >
            {atrasada ? <AlertTriangle size={12} /> : <Calendar size={12} />}
            <span>{t.prazo ? fmtDataBr(t.prazo) : 'Sem prazo'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 11 }}>
            {t.comentarios.length > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <MessageSquare size={12} /> {t.comentarios.length}
              </span>
            )}
            {t.anexos.length > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Paperclip size={12} /> {t.anexos.length}
              </span>
            )}
            {isConsultor && t.status !== 'concluida' && (
              <button
                type="button"
                title="Enviar lembrete no WhatsApp"
                disabled={enviandoWppId === t.id}
                onClick={(e) => {
                  e.stopPropagation();
                  dispararWhatsApp(t.id, 'lembrete');
                }}
                style={{
                  border: 'none',
                  background: 'rgba(22,163,74,0.12)',
                  color: '#15803d',
                  borderRadius: 6,
                  padding: '3px 6px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                <Bell size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckSquare size={22} style={{ color: 'var(--accent)' }} />
            {isConsultor ? 'Central de Tarefas' : 'Minhas Tarefas'}
          </div>
          <div className="page-subtitle">
            {isConsultor
              ? 'Delegue e acompanhe tarefas para sua equipe interna e para os clientes em tempo real.'
              : 'Acompanhe as solicitações da consultoria, atualize o andamento e envie comprovantes.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn btn-secondary" onClick={() => carregarDados()} title="Atualizar tarefas">
            <RefreshCw size={15} /> Atualizar
          </button>
          {isConsultor && (
            <button type="button" className="btn btn-primary" onClick={() => abrirNovaTarefa('a_fazer')}>
              <Plus size={16} /> Nova Tarefa
            </button>
          )}
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 12 }}>
          <div className="card" onClick={() => setChipFiltro('todas')} style={{ padding: '14px 16px', cursor: 'pointer' }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>Em Aberto</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{kpis.abertas}</div>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11.5, color: '#2563eb', fontWeight: 600 }}>Em Andamento</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#2563eb', marginTop: 4 }}>{kpis.andamento}</div>
          </div>
          <div
            className="card"
            onClick={() => setChipFiltro(chipFiltro === 'atrasadas' ? 'todas' : 'atrasadas')}
            style={{
              padding: '14px 16px',
              cursor: 'pointer',
              borderColor: kpis.atrasadas > 0 ? 'rgba(220,38,38,0.4)' : undefined,
            }}
          >
            <div style={{ fontSize: 11.5, color: '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
              <AlertTriangle size={13} /> Atrasadas
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626', marginTop: 4 }}>{kpis.atrasadas}</div>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11.5, color: '#16a34a', fontWeight: 600 }}>Concluídas</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>{kpis.concluidas}</div>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Clock size={13} /> Tempo Médio
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginTop: 5 }}>{kpis.tempoMedioTexto}</div>
          </div>
        </div>

        {/* Barra de filtros + toggle Kanban / Lista */}
        <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(isConsultor
                ? [
                    { id: 'todas', label: 'Todas' },
                    { id: 'minhas', label: 'Minhas' },
                    { id: 'clientes', label: 'Para Clientes' },
                    { id: 'equipe', label: 'Para Equipe' },
                    { id: 'atrasadas', label: 'Atrasadas' },
                    { id: 'recorrentes', label: 'Recorrentes' },
                  ]
                : [
                    { id: 'todas', label: 'Todas' },
                    { id: 'atrasadas', label: 'Atrasadas' },
                    { id: 'recorrentes', label: 'Recorrentes' },
                  ]
              ).map((c) => {
                const ativo = chipFiltro === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChipFiltro(c.id as any)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: `1px solid ${ativo ? 'var(--accent)' : 'var(--border)'}`,
                      background: ativo ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: ativo ? '#fff' : 'var(--text-secondary)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'inline-flex', background: 'var(--bg-secondary)', padding: 3, borderRadius: 10, border: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setView('kanban')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700,
                  background: view === 'kanban' ? 'var(--bg-card)' : 'transparent',
                  color: view === 'kanban' ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                <LayoutGrid size={14} /> Kanban
              </button>
              <button
                type="button"
                onClick={() => setView('lista')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700,
                  background: view === 'lista' ? 'var(--bg-card)' : 'transparent',
                  color: view === 'lista' ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                <List size={14} /> Lista
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isConsultor ? '2fr 1.2fr 1.2fr 0.9fr' : '2fr 1fr', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Buscar por título, empresa, responsável ou categoria..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                style={{ paddingLeft: 34, width: '100%' }}
              />
            </div>

            {isConsultor && (
              <select className="form-select" value={filtroEmpresaId} onChange={(e) => setFiltroEmpresaId(e.target.value)}>
                <option value="">Todas as empresas</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>{e.nomeFantasia || e.razaoSocial}</option>
                ))}
              </select>
            )}

            {isConsultor && (
              <select className="form-select" value={filtroResponsavelId} onChange={(e) => setFiltroResponsavelId(e.target.value)}>
                <option value="">Todos os usuários</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            )}

            <select className="form-select" value={filtroPrioridade} onChange={(e) => setFiltroPrioridade(e.target.value)}>
              <option value="">Prioridade: Todas</option>
              <option value="urgente">Urgente</option>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </div>
        </div>

        {/* Conteúdo Principal */}
        {loading ? (
          <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            Carregando tarefas...
          </div>
        ) : view === 'kanban' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, alignItems: 'start' }}>
            {COLUNAS.map((col) => {
              const itens = tarefasFiltradas.filter((t) => t.status === col.id);
              const isOver = dragOverCol === col.id;
              return (
                <div
                  key={col.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverCol !== col.id) setDragOverCol(col.id);
                  }}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverCol(null);
                    if (dragId) {
                      const t = tarefas.find((x) => x.id === dragId);
                      if (t) atualizarStatusRapido(t, col.id);
                    }
                    setDragId(null);
                  }}
                  style={{
                    background: isOver ? col.bg : 'var(--bg-secondary)',
                    border: `1.5px ${isOver ? 'dashed' : 'solid'} ${isOver ? col.cor : 'var(--border)'}`,
                    borderRadius: 14,
                    padding: 12,
                    minHeight: 340,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    transition: 'background 150ms, border-color 150ms',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: col.cor }} />
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{col.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: col.bg, color: col.cor }}>
                        {itens.length}
                      </span>
                    </div>
                    {isConsultor && col.id !== 'concluida' && (
                      <button
                        type="button"
                        onClick={() => abrirNovaTarefa(col.id)}
                        title={`Adicionar em ${col.label}`}
                        style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                      >
                        <Plus size={15} />
                      </button>
                    )}
                  </div>

                  {itens.length === 0 ? (
                    <div style={{ padding: '28px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                      Arraste uma tarefa para cá
                    </div>
                  ) : (
                    itens.map(renderCard)
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Visualização em Lista */
          <div className="card" style={{ overflowX: 'auto' }}>
            {tarefasFiltradas.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                Nenhuma tarefa encontrada com os filtros selecionados.
              </div>
            ) : (
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '11px 14px', fontSize: 11.5 }}>Tarefa</th>
                    <th style={{ textAlign: 'left', padding: '11px 14px', fontSize: 11.5 }}>Destinatário</th>
                    <th style={{ textAlign: 'left', padding: '11px 14px', fontSize: 11.5 }}>Prioridade</th>
                    <th style={{ textAlign: 'left', padding: '11px 14px', fontSize: 11.5 }}>Tempo Aberto</th>
                    <th style={{ textAlign: 'left', padding: '11px 14px', fontSize: 11.5 }}>Prazo</th>
                    <th style={{ textAlign: 'left', padding: '11px 14px', fontSize: 11.5 }}>Status</th>
                    <th style={{ textAlign: 'right', padding: '11px 14px', fontSize: 11.5 }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {tarefasFiltradas.map((t) => {
                    const prio = PRIORIDADE_META[t.prioridade] || PRIORIDADE_META.media;
                    const atrasada = isAtrasada(t);
                    return (
                      <tr key={t.id} onClick={() => abrirDetalheTarefa(t)} style={{ cursor: 'pointer', borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '11px 14px' }}>
                          <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {t.titulo}
                            {t.recorrente && <Repeat size={13} style={{ color: '#2563eb' }} />}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', gap: 10, marginTop: 3 }}>
                            {t.categoria && <span>{t.categoria}</span>}
                            {t.subtarefas.length > 0 && (
                              <span>Checklist: {t.subtarefas.filter((s) => s.concluida).length}/{t.subtarefas.length}</span>
                            )}
                            {t.comentarios.length > 0 && <span>{t.comentarios.length} coment.</span>}
                            {t.anexos.length > 0 && <span>{t.anexos.length} anexo(s)</span>}
                          </div>
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 12.5 }}>
                          {t.empresaNome && <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.empresaNome}</div>}
                          {t.responsavelNome && <div style={{ color: 'var(--text-secondary)', fontSize: 11.5 }}>{t.responsavelNome}</div>}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, color: prio.cor, background: prio.bg }}>
                            {prio.label}
                          </span>
                        </td>
                        <td style={{ padding: '11px 14px' }}>{renderBadgeTempo(t)}</td>
                        <td style={{ padding: '11px 14px', fontSize: 12.5, fontWeight: atrasada ? 700 : 500, color: atrasada ? '#dc2626' : 'var(--text-primary)' }}>
                          {fmtDataBr(t.prazo)}
                        </td>
                        <td style={{ padding: '11px 14px' }} onClick={(e) => e.stopPropagation()}>
                          <select
                            className="form-select"
                            value={t.status}
                            onChange={(e) => atualizarStatusRapido(t, e.target.value as TarefaStatus)}
                            style={{ fontSize: 12, padding: '5px 8px', minWidth: 132 }}
                          >
                            {COLUNAS.map((c) => (
                              <option key={c.id} value={c.id}>{c.label}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            {isConsultor && (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '5px 8px', fontSize: 12 }}
                                disabled={enviandoWppId === t.id}
                                onClick={() => dispararWhatsApp(t.id, 'lembrete')}
                                title="Enviar lembrete no WhatsApp"
                              >
                                <Bell size={13} />
                              </button>
                            )}
                            {isConsultor && (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '5px 8px', fontSize: 12, color: '#dc2626' }}
                                onClick={() => excluirTarefa(t.id)}
                                title="Excluir tarefa"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Modal Executivo 2 Colunas — Criar / Detalhes da Tarefa */}
      {modalAberto && (
        <div
          onClick={() => setModalAberto(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.62)', backdropFilter: 'blur(3px)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 18,
              width: '100%',
              maxWidth: 960,
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 28px 70px rgba(0,0,0,0.32)',
            }}
          >
            {/* Header Premium */}
            <div
              style={{
                padding: '16px 22px',
                borderBottom: '1px solid var(--border)',
                background: 'linear-gradient(135deg, rgba(140,26,34,0.06) 0%, rgba(15,23,42,0.02) 100%)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: 'var(--accent)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <CheckSquare size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: 17.5, fontWeight: 800, color: 'var(--text-primary)' }}>
                      {tarefaAtiva ? 'Detalhes da Tarefa' : 'Criar Nova Tarefa'}
                    </h3>
                    {tarefaAtiva && renderBadgeTempo(tarefaAtiva)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {tarefaAtiva
                      ? `Aberta por ${tarefaAtiva.criadoPorNome} em ${fmtDataHoraBr(tarefaAtiva.createdAt)}${
                          tarefaAtiva.concluidaEm ? ` · Concluída em ${fmtDataHoraBr(tarefaAtiva.concluidaEm)}` : ''
                        }${tarefaAtiva.notificadoWhatsappEm ? ` · WhatsApp em ${fmtDataHoraBr(tarefaAtiva.notificadoWhatsappEm)}` : ''}`
                      : 'Defina o objetivo, o destinatário e o prazo. O cliente ou usuário acompanha tudo em tempo real.'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalAberto(false)}
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  borderRadius: 10,
                  padding: 7,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Corpo em 2 colunas com scroll interno */}
            <div
              style={{
                padding: 22,
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 20,
                alignItems: 'start',
              }}
            >
              {/* COLUNA ESQUERDA: Conteúdo, Modelos, Checklist, Anexos, Comentários */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Modelos Rápidos (somente na criação) */}
                {!tarefaAtiva && isConsultor && (
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <Sparkles size={13} style={{ color: 'var(--accent)' }} /> Modelos rápidos (preenche em 1 clique)
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {MODELOS_RAPIDOS.map((m) => (
                        <button
                          key={m.label}
                          type="button"
                          onClick={() => aplicarModeloRapido(m)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            background: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          + {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Título */}
                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: 12.5 }}>Título da tarefa *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ex.: Enviar extratos bancários e notas fiscais do mês"
                    value={titulo}
                    disabled={!isConsultor}
                    onChange={(e) => setTitulo(e.target.value)}
                    style={{ width: '100%', fontSize: 14.5, fontWeight: 600, padding: '10px 12px' }}
                  />
                </div>

                {/* Descrição */}
                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: 12.5 }}>Descrição e orientações</label>
                  <textarea
                    className="form-input"
                    rows={4}
                    disabled={!isConsultor}
                    placeholder="Explique o que precisa ser feito, documentos esperados ou observações importantes..."
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    style={{ width: '100%', resize: 'vertical', lineHeight: 1.5 }}
                  />
                </div>

                {/* Checklist / Subtarefas */}
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, background: 'var(--bg-secondary)' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <CheckSquare size={14} style={{ color: 'var(--accent)' }} /> Checklist / Subtarefas
                    </span>
                    {subtarefasForm.length > 0 && (
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 700 }}>
                        {subtarefasForm.filter((s) => s.concluida).length}/{subtarefasForm.length} concluídas
                      </span>
                    )}
                  </div>

                  {subtarefasForm.length > 0 && (
                    <div style={{ height: 5, borderRadius: 99, background: 'var(--bg-card)', overflow: 'hidden', marginBottom: 10 }}>
                      <div
                        style={{
                          width: `${Math.round((subtarefasForm.filter((s) => s.concluida).length / subtarefasForm.length) * 100)}%`,
                          height: '100%',
                          background: '#16a34a',
                          transition: 'width 200ms',
                        }}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: isConsultor ? 10 : 0 }}>
                    {subtarefasForm.map((sub) => (
                      <div key={sub.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 10px', borderRadius: 9, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <button
                          type="button"
                          onClick={() => toggleSubtarefa(sub.id)}
                          style={{ border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: sub.concluida ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: sub.concluida ? 'line-through' : 'none', fontSize: 13, textAlign: 'left', flex: 1 }}
                        >
                          {sub.concluida ? <CheckCircle2 size={16} style={{ color: '#16a34a', flexShrink: 0 }} /> : <Circle size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                          <span>{sub.titulo}</span>
                        </button>
                        {isConsultor && (
                          <button
                            type="button"
                            onClick={() => setSubtarefasForm((prev) => prev.filter((s) => s.id !== sub.id))}
                            style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {isConsultor && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Digite um item e pressione Enter..."
                        value={novaSubtarefaTexto}
                        onChange={(e) => setNovaSubtarefaTexto(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            adicionarSubtarefa();
                          }
                        }}
                        style={{ flex: 1, background: 'var(--bg-card)' }}
                      />
                      <button type="button" className="btn btn-secondary" onClick={adicionarSubtarefa}>
                        <Plus size={14} /> Item
                      </button>
                    </div>
                  )}
                </div>

                {/* Anexos / Comprovantes */}
                <div style={{ border: '1px dashed var(--border)', borderRadius: 12, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Paperclip size={14} style={{ color: 'var(--accent)' }} /> Anexos e Comprovantes
                    </span>
                    <button type="button" className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => fileInputRef.current?.click()}>
                      <Upload size={13} /> Enviar arquivo
                    </button>
                    <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleUploadArquivo} />
                  </div>

                  {(() => {
                    const listaAnexos: Array<Partial<TarefaAnexo> & { nome: string; tamanho: number; dataUrl: string }> = tarefaAtiva
                      ? tarefaAtiva.anexos
                      : anexosPendentes;
                    if (listaAnexos.length === 0) {
                      return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Anexe PDFs, extratos, planilhas ou comprovantes (até 4 MB por arquivo).</div>;
                    }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {listaAnexos.map((a, idx) => (
                          <div key={a.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 10px', borderRadius: 8, background: 'var(--bg-secondary)', fontSize: 12.5 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <strong>{a.nome}</strong> <span style={{ color: 'var(--text-muted)' }}>({fmtTamanho(a.tamanho)})</span>
                              {a.enviadoPor && <span style={{ color: 'var(--text-muted)' }}> · {a.enviadoPor}</span>}
                            </div>
                            <div style={{ display: 'inline-flex', gap: 6, flexShrink: 0 }}>
                              <a href={a.dataUrl} download={a.nome} className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: 11.5, textDecoration: 'none' }}>
                                <Download size={12} /> Baixar
                              </a>
                              <button
                                type="button"
                                onClick={() => {
                                  if (tarefaAtiva && a.id) removerAnexoExistente(a.id);
                                  else setAnexosPendentes((prev) => prev.filter((_, i) => i !== idx));
                                }}
                                style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Comentários (tarefa existente) */}
                {tarefaAtiva && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <MessageSquare size={14} style={{ color: 'var(--accent)' }} /> Comentários ({tarefaAtiva.comentarios.length})
                    </div>

                    {tarefaAtiva.comentarios.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10, maxHeight: 200, overflowY: 'auto' }}>
                        {tarefaAtiva.comentarios.map((c) => (
                          <div key={c.id} style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                              <strong style={{ color: 'var(--text-primary)' }}>{c.autorNome}</strong>
                              <span>{fmtDataHoraBr(c.criadoEm)}</span>
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{c.texto}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Escreva um comentário ou atualização..."
                        value={novoComentarioTexto}
                        onChange={(e) => setNovoComentarioTexto(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            enviarComentario();
                          }
                        }}
                        style={{ flex: 1 }}
                      />
                      <button type="button" className="btn btn-secondary" onClick={enviarComentario}>
                        <Send size={14} /> Enviar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* COLUNA DIREITA: Destinatário, Prioridade, Prazo, Recorrência, WhatsApp */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--bg-secondary)', padding: 16, borderRadius: 14, border: '1px solid var(--border)' }}>
                {/* Destinatário */}
                {isConsultor && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Users size={14} style={{ color: 'var(--accent)' }} /> Destinar para
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                      {[
                        { id: 'cliente', label: 'Cliente', icon: Building2 },
                        { id: 'usuario', label: 'Equipe', icon: UserIcon },
                        { id: 'ambos', label: 'Ambos', icon: Users },
                      ].map((opt) => {
                        const Icon = opt.icon;
                        const sel = destinoTipoForm === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              const v = opt.id as TarefaDestinoTipo;
                              setDestinoTipoForm(v);
                              setVisivelClienteForm(v !== 'usuario');
                            }}
                            style={{
                              padding: '8px 6px',
                              borderRadius: 10,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 5,
                              border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                              background: sel ? 'var(--accent)' : 'var(--bg-card)',
                              color: sel ? '#fff' : 'var(--text-secondary)',
                            }}
                          >
                            <Icon size={13} /> {opt.label}
                          </button>
                        );
                      })}
                    </div>

                    {(destinoTipoForm === 'cliente' || destinoTipoForm === 'ambos') && (
                      <div>
                        <label className="form-label">Empresa Cliente *</label>
                        <select className="form-select" value={empresaIdForm} onChange={(e) => setEmpresaIdForm(e.target.value)} style={{ width: '100%', background: 'var(--bg-card)' }}>
                          <option value="">Selecione a empresa...</option>
                          {empresas.map((e) => (
                            <option key={e.id} value={e.id}>{e.nomeFantasia || e.razaoSocial}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {(destinoTipoForm === 'usuario' || destinoTipoForm === 'ambos') && (
                      <div>
                        <label className="form-label">Usuário Responsável *</label>
                        <select className="form-select" value={responsavelUserIdForm} onChange={(e) => setResponsavelUserIdForm(e.target.value)} style={{ width: '100%', background: 'var(--bg-card)' }}>
                          <option value="">Selecione o usuário...</option>
                          {usuarios.map((u) => (
                            <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={visivelClienteForm} onChange={(e) => setVisivelClienteForm(e.target.checked)} />
                      {visivelClienteForm ? <Eye size={14} style={{ color: '#16a34a' }} /> : <EyeOff size={14} />}
                      Visível no Portal do Cliente
                    </label>
                  </div>
                )}

                <div style={{ height: 1, background: 'var(--border)' }} />

                {/* Prioridade visual */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Flag size={13} style={{ color: 'var(--accent)' }} /> Prioridade
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                    {(['baixa', 'media', 'alta', 'urgente'] as TarefaPrioridade[]).map((pKey) => {
                      const meta = PRIORIDADE_META[pKey];
                      const sel = prioridadeForm === pKey;
                      return (
                        <button
                          key={pKey}
                          type="button"
                          disabled={!isConsultor}
                          onClick={() => setPrioridadeForm(pKey)}
                          style={{
                            padding: '6px 4px',
                            borderRadius: 8,
                            fontSize: 11.5,
                            fontWeight: 700,
                            cursor: isConsultor ? 'pointer' : 'default',
                            border: `1.5px solid ${sel ? meta.cor : 'var(--border)'}`,
                            background: sel ? meta.bg : 'var(--bg-card)',
                            color: sel ? meta.cor : 'var(--text-secondary)',
                          }}
                        >
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Status + Categoria */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="form-label">Status</label>
                    <select className="form-select" value={statusForm} onChange={(e) => setStatusForm(e.target.value as TarefaStatus)} style={{ width: '100%', background: 'var(--bg-card)' }}>
                      {COLUNAS.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <FolderKanban size={12} /> Categoria
                    </label>
                    <select className="form-select" disabled={!isConsultor} value={categoriaForm} onChange={(e) => setCategoriaForm(e.target.value)} style={{ width: '100%', background: 'var(--bg-card)' }}>
                      {CATEGORIAS_PADRAO.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Prazo + Atalhos rápidos */}
                <div>
                  <label className="form-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Calendar size={12} /> Prazo de entrega
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    disabled={!isConsultor}
                    value={prazoForm}
                    onChange={(e) => setPrazoForm(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-card)' }}
                  />
                  {isConsultor && (
                    <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                      {[
                        { label: 'Hoje', dias: 0 },
                        { label: 'Amanhã', dias: 1 },
                        { label: '+3 dias', dias: 3 },
                        { label: '+7 dias', dias: 7 },
                      ].map((at) => (
                        <button
                          key={at.label}
                          type="button"
                          onClick={() => setPrazoForm(somarDiasIso(at.dias))}
                          style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            border: '1px solid var(--border)',
                            background: 'var(--bg-card)',
                            color: 'var(--text-secondary)',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {at.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recorrência mensal */}
                {isConsultor && (
                  <div style={{ padding: 10, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={recorrenteForm} onChange={(e) => setRecorrenteForm(e.target.checked)} />
                      <Repeat size={13} style={{ color: '#2563eb' }} /> Recorrência mensal automática
                    </label>
                    {recorrenteForm && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                        <span>Repetir todo dia</span>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          className="form-input"
                          value={recorrenciaDiaForm}
                          onChange={(e) => setRecorrenciaDiaForm(Math.max(1, Math.min(31, Number(e.target.value) || 5)))}
                          style={{ width: 62, padding: '4px 8px' }}
                        />
                        <span>ao concluir</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Notificação WhatsApp */}
                {isConsultor && !tarefaAtiva && (
                  <label
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      background: 'rgba(22,163,74,0.08)',
                      border: '1px solid rgba(22,163,74,0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#15803d',
                      cursor: 'pointer',
                    }}
                  >
                    <input type="checkbox" checked={notificarWppAoCriar} onChange={(e) => setNotificarWppAoCriar(e.target.checked)} />
                    <Bell size={14} /> Avisar automaticamente no WhatsApp ao criar
                  </label>
                )}
              </div>
            </div>

            {/* Rodapé fixo do Modal */}
            <div
              style={{
                padding: '14px 22px',
                borderTop: '1px solid var(--border)',
                background: 'var(--bg-card)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {tarefaAtiva && isConsultor && (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={enviandoWppId === tarefaAtiva.id}
                      onClick={() => dispararWhatsApp(tarefaAtiva.id, 'lembrete')}
                      style={{ color: '#15803d' }}
                    >
                      <Bell size={14} /> {enviandoWppId === tarefaAtiva.id ? 'Enviando...' : 'Cobrar / Avisar no WhatsApp'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => excluirTarefa(tarefaAtiva.id)}
                      style={{ color: '#dc2626' }}
                    >
                      <Trash2 size={14} /> Excluir
                    </button>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalAberto(false)}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-primary" disabled={salvando} onClick={salvarModal}>
                  {salvando ? 'Salvando...' : tarefaAtiva ? 'Salvar Alterações' : 'Criar Tarefa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
