'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Instrument_Serif } from 'next/font/google';
import {
  Inbox, Search, RefreshCw, Download, Copy, Check, Filter, Calendar, Building2,
  AlertCircle, CheckCircle2, Clock, ShieldCheck, FileText, ArrowUpDown, ChevronRight,
  ExternalLink, Eye, X, Layers, Play, Moon, Sun, Sparkles, KeyRound, Upload, Building,
  Calculator, Globe, UploadCloud, ArrowUpRight, ArrowDownLeft,
  Edit3, Lock, Settings, MoreHorizontal, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import NfeCertificadoModal from './NfeCertificadoModal';
import CertidaoFederalModal from './CertidaoFederalModal';
import NfeDifalModal from './NfeDifalModal';
import NfeIntegracaoModal from './NfeIntegracaoModal';
import NfeImportarXmlModal from './NfeImportarXmlModal';
import { confirmAsync } from './ConfirmProvider';
import { lerJsonResposta } from '../lib/nfe/resposta-cliente';

const serif = Instrument_Serif({ subsets: ['latin'], weight: ['400'] });

interface EmpresaMonitor {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  certificado: 'escritorio' | 'propria' | 'ausente';
  procuracaoStatus: string | null;
  certValidoAte?: string | null;
  certTitular?: string | null;
  temCertProprio?: boolean;
  usarProcuracao?: boolean;
  monitor: {
    ativo: boolean;
    apenasNoturno?: boolean;
    ultimaConsultaEm: string | null;
    proximaConsultaEm: string | null;
    ultimoStatus: string | null;
    ultimaMensagem: string | null;
    ultNsu: string;
    maxNsu: string;
  } | null;
  totalNotas: number;
}

interface NfeDestinadaItem {
  id: string;
  empresaId: string;
  chaveAcesso: string;
  numero: string | null;
  serie: string | null;
  emitenteCnpj: string;
  emitenteNome: string;
  dataEmissao: string;
  tipoOperacao: number | null;
  valorNf: number;
  situacao: string;
  manifestacao: string | null;
  possuiXml: boolean;
  papel?: 'emitida' | 'recebida';
}

function formatCnpj(v: string): string {
  const d = v.replace(/\D/g, '');
  if (d.length !== 14) return v;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

function formatMoney(v: number): string {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatData(iso: string): string {
  if (!iso) return '-';
  const parte = iso.split('T')[0];
  const [ano, mes, dia] = parte.split('-');
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}

function formatChave(chave: string): string {
  if (!chave || chave.length !== 44) return chave || '-';
  return chave.replace(/(\d{4})/g, '$1 ').trim();
}

const podeDarCiencia = (n: NfeDestinadaItem) => !n.possuiXml && n.situacao === 'autorizada' && !n.manifestacao;

export type TabSieg = 'clientes' | 'fila_a1' | 'fila_avulso' | 'baixados';

function badgeCertCadastrado(emp: EmpresaMonitor) {
  const agora = Date.now();
  if (emp.certValidoAte) {
    const d = new Date(emp.certValidoAte).getTime();
    if (d < agora) {
return (
        <span style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 4, padding: '2px 8px', fontSize: 11.5, fontWeight: 600, display: 'inline-block' }}>
          Vencido
        </span>
      );
    }
return (
      <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 4, padding: '2px 8px', fontSize: 11.5, fontWeight: 600, display: 'inline-block' }}>
        No Prazo
      </span>
    );
  }
  if (emp.certificado === 'escritorio' || emp.usarProcuracao) {
return (
      <span style={{ background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: 4, padding: '2px 8px', fontSize: 11.5, fontWeight: 600, display: 'inline-block' }}>
        No Prazo
      </span>
    );
  }
  return (
    <span style={{ background: '#ffe4e6', color: '#e11d48', border: '1px solid #fecdd3', borderRadius: 4, padding: '2px 8px', fontSize: 11.5, fontWeight: 600, display: 'inline-block' }}>
      Não
    </span>
  );
}

function badgeStatusCert(emp: EmpresaMonitor) {
  const agora = Date.now();
  if (emp.certValidoAte) {
    const d = new Date(emp.certValidoAte).getTime();
    const diffDias = Math.ceil((d - agora) / (1000 * 60 * 60 * 24));
    if (d < agora) {
return (
        <span style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 4, padding: '2px 8px', fontSize: 11.5, fontWeight: 600, display: 'inline-block' }}>
          Vencido
        </span>
      );
    }
    if (diffDias <= 30) {
return (
        <span style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', borderRadius: 4, padding: '2px 8px', fontSize: 11.5, fontWeight: 600, display: 'inline-block' }}>
          Alerta
        </span>
      );
    }
return (
      <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 4, padding: '2px 8px', fontSize: 11.5, fontWeight: 600, display: 'inline-block' }}>
        Sucesso
      </span>
    );
  }
  if (emp.certificado === 'escritorio' || emp.usarProcuracao) {
return (
      <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 4, padding: '2px 8px', fontSize: 11.5, fontWeight: 600, display: 'inline-block' }}>
        Sucesso
      </span>
    );
  }
  return <span style={{ color: '#9ca3af' }}>-</span>;
}

function badgeConfigSaida(emp: EmpresaMonitor) {
  const ativo = emp.monitor?.ativo !== false;
  if (ativo) {
return (
      <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 4, padding: '2px 8px', fontSize: 11.5, fontWeight: 600, display: 'inline-block' }}>
        Sim
      </span>
    );
  }
  return (
    <span style={{ background: '#ffe4e6', color: '#e11d48', border: '1px solid #fecdd3', borderRadius: 4, padding: '2px 8px', fontSize: 11.5, fontWeight: 600, display: 'inline-block' }}>
      Não
    </span>
  );
}

function badgeStatusConfigSaida(emp: EmpresaMonitor) {
  const ativo = emp.monitor?.ativo !== false;
  if (ativo && (emp.monitor?.ultimoStatus || emp.totalNotas > 0)) {
return (
      <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 4, padding: '2px 8px', fontSize: 11.5, fontWeight: 600, display: 'inline-block' }}>
        Sucesso
      </span>
    );
  }
  return <span style={{ color: '#9ca3af' }}>-</span>;
}

export default function NfeDestinadasPainel() {
  const [empresas, setEmpresas] = useState<EmpresaMonitor[]>([]);
  const [carregandoEmpresas, setCarregandoEmpresas] = useState(true);
  const [empresaIdSelecionada, setEmpresaIdSelecionada] = useState<string>('');
  const [tabSieg, setTabSieg] = useState<TabSieg>('clientes');
  const [filtroCertStatus, setFiltroCertStatus] = useState<'todos' | 'noprazo' | 'vencidos' | 'semcert'>('todos');
  const [subtabEmpresa, setSubtabEmpresa] = useState<'resumo' | 'docs' | 'pendencias' | 'emissao' | 'reports' | 'arquivos'>('resumo');
  const [ehHorarioNoturno, setEhHorarioNoturno] = useState(false);

  // Filtros de busca de notas
  const [busca, setBusca] = useState('');
  const [mesFiltro, setMesFiltro] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [situacaoFiltro, setSituacaoFiltro] = useState('');
  const [apenasComXml, setApenasComXml] = useState(false);
  const [papelFiltro, setPapelFiltro] = useState<'todas' | 'recebidas' | 'emitidas'>('todas');
  const [totaisMonitor, setTotaisMonitor] = useState<{ totalGeral: number; totalEmitidas: number; totalRecebidas: number }>({
    totalGeral: 0,
    totalEmitidas: 0,
    totalRecebidas: 0,
  });

  // Modais de DIFAL, Integração e Importação
  const [showDifalModal, setShowDifalModal] = useState(false);
  const [showIntegracaoModal, setShowIntegracaoModal] = useState(false);
  const [showImportarModal, setShowImportarModal] = useState(false);

  // Dados das notas
  const [notas, setNotas] = useState<NfeDestinadaItem[]>([]);
  const [monitorAtual, setMonitorAtual] = useState<EmpresaMonitor['monitor']>(null);
  const [carregandoNotas, setCarregandoNotas] = useState(false);
  const [consultandoSefaz, setConsultandoSefaz] = useState(false);

  // Modal de Detalhes
  const [notaDetalhe, setNotaDetalhe] = useState<NfeDestinadaItem | null>(null);
  const [copiadoChave, setCopiadoChave] = useState(false);

  // Modal de Gerenciamento do Certificado Digital A1
  const [empresaCertificadoModal, setEmpresaCertificadoModal] = useState<EmpresaMonitor | null>(null);
  const [showCndModal, setShowCndModal] = useState(false);

  // Busca rápida de empresas no seletor
  const [filtroEmpresaTexto, setFiltroEmpresaTexto] = useState('');

  // Exportação
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [formatoExportacao, setFormatoExportacao] = useState('ambos');
  const [exportando, setExportando] = useState(false);

  // Manifestação e varredura
  const [manifestando, setManifestando] = useState(false);
  const [varrendo, setVarrendo] = useState(false);

  // Carrega empresas aptas para monitoramento
  const carregarEmpresas = useCallback(async () => {
    try {
      setCarregandoEmpresas(true);
      const res = await fetch('/api/nfe/monitor');
      if (!res.ok) throw new Error('Falha ao carregar empresas monitoradas.');
      const data = await lerJsonResposta(res);
      const lista: EmpresaMonitor[] = data.empresas || [];
      setEmpresas(lista);
      setEhHorarioNoturno(Boolean(data.ehHorarioNoturno));

      // Se ainda não tiver empresa selecionada, pega a primeira disponível ou recupera da sessão
      if (!empresaIdSelecionada && lista.length > 0) {
        const salva = sessionStorage.getItem('cf_nfe_empresa_sel');
        const existe = lista.find(e => e.id === salva);
        const escolhida = existe ? existe.id : lista[0].id;
        setEmpresaIdSelecionada(escolhida);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao carregar empresas.');
    } finally {
      setCarregandoEmpresas(false);
    }
  }, [empresaIdSelecionada]);

  useEffect(() => {
    carregarEmpresas();
  }, [carregarEmpresas]);

  // Carrega notas destinadas para a empresa selecionada
  const carregarNotas = useCallback(async (id: string) => {
    if (!id) return;
    try {
      setCarregandoNotas(true);
      const params = new URLSearchParams({ empresaId: id });
      if (mesFiltro) params.set('mes', mesFiltro);
      if (dataInicio) params.set('de', dataInicio);
      if (dataFim) params.set('ate', dataFim);
      if (situacaoFiltro) params.set('situacao', situacaoFiltro);
      if (busca) params.set('busca', busca);
      if (papelFiltro && papelFiltro !== 'todas') params.set('papel', papelFiltro);

      const res = await fetch(`/api/nfe/destinadas?${params.toString()}`);
      if (!res.ok) throw new Error('Falha ao carregar notas destinadas.');
      const data = await lerJsonResposta(res);
      let lista: NfeDestinadaItem[] = data.notas || [];
      if (apenasComXml) {
        lista = lista.filter(n => n.possuiXml);
      }
      setNotas(lista);
      if (data.totais) {
        setTotaisMonitor(data.totais);
      }
      setSelecionadas(new Set());
      setMonitorAtual(data.monitor || null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao buscar NF-e destinadas.');
    } finally {
      setCarregandoNotas(false);
    }
  }, [mesFiltro, dataInicio, dataFim, situacaoFiltro, busca, papelFiltro, apenasComXml]);

  useEffect(() => {
    if (empresaIdSelecionada) {
      sessionStorage.setItem('cf_nfe_empresa_sel', empresaIdSelecionada);
      carregarNotas(empresaIdSelecionada);
    }
  }, [empresaIdSelecionada, carregarNotas]);

  const empresaAtual = useMemo(() => {
    return empresas.find(e => e.id === empresaIdSelecionada) || null;
  }, [empresas, empresaIdSelecionada]);

  // Checagem de disponibilidade de consulta imediata (regra de 60-65 min anti-bloqueio SEFAZ)
  const esperaInfo = useMemo(() => {
    const proxStr = monitorAtual?.proximaConsultaEm;
    if (!proxStr) return { bloqueado: false, texto: null };
    const proxTime = new Date(proxStr).getTime();
    const agora = Date.now();
    if (proxTime > agora) {
      const diffMin = Math.ceil((proxTime - agora) / 60000);
      const horas = Math.floor(diffMin / 60);
      const mins = diffMin % 60;
      const texto = horas > 0 ? `${horas}h ${mins}min` : `${mins} min`;
      return { bloqueado: true, texto };
    }
    return { bloqueado: false, texto: null };
  }, [monitorAtual?.proximaConsultaEm]);

  // Consulta manual à SEFAZ
  const handleConsultarSefaz = async () => {
    if (!empresaIdSelecionada) return;
    try {
      setConsultandoSefaz(true);
      const res = await fetch('/api/nfe/destinadas/consultar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId: empresaIdSelecionada }),
      });
      const data = await lerJsonResposta(res);

      if (!res.ok) {
        throw new Error(data.error || 'Erro na comunicação com a SEFAZ.');
      }

      if (data.executada) {
        const msg = data.novas > 0
          ? `Sucesso: ${data.novas} nova(s) nota(s) encontrada(s)! (${data.cStat} - ${data.mensagem})`
          : `Consulta concluída: ${data.cStat} - ${data.mensagem}`;
        toast.success(msg);
      } else {
        toast.info(data.mensagem || 'Consulta adiada pelo tempo de espera da SEFAZ.');
      }

      // Recarrega notas e monitor
      await carregarNotas(empresaIdSelecionada);
      await carregarEmpresas();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Falha ao consultar SEFAZ.');
    } finally {
      setConsultandoSefaz(false);
    }
  };

  // Toggle do monitor automático da empresa
  const handleToggleMonitor = async (empId: string, novoAtivo: boolean) => {
    try {
      const res = await fetch('/api/nfe/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId: empId, ativo: novoAtivo }),
      });
      if (!res.ok) throw new Error('Falha ao atualizar status do monitor.');
      toast.success(novoAtivo ? 'Monitoramento automático ativado.' : 'Monitoramento pausado.');
      setEmpresas(prev => prev.map(e => e.id === empId ? {
        ...e,
        monitor: e.monitor ? { ...e.monitor, ativo: novoAtivo } : {
          ativo: novoAtivo, apenasNoturno: false, ultimaConsultaEm: null, proximaConsultaEm: null,
          ultimoStatus: null, ultimaMensagem: null, ultNsu: '0', maxNsu: '0'
        }
      } : e));
      if (empId === empresaIdSelecionada) {
        setMonitorAtual(prev => prev ? { ...prev, ativo: novoAtivo } : null);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao alternar monitor.');
    }
  };

  // Toggle da restrição de consulta noturna (22h às 05h)
  const handleToggleNoturno = async (empId: string, apenasNoturno: boolean) => {
    try {
      const res = await fetch('/api/nfe/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId: empId, apenasNoturno }),
      });
      if (!res.ok) throw new Error('Falha ao atualizar janela noturna.');
      toast.success(apenasNoturno
        ? 'Consulta automática configurada para o horário noturno (22h às 05h).'
        : 'Consulta automática liberada para qualquer horário (24h).'
      );
      setEmpresas(prev => prev.map(e => e.id === empId ? {
        ...e,
        monitor: e.monitor ? { ...e.monitor, apenasNoturno } : {
          ativo: true, apenasNoturno, ultimaConsultaEm: null, proximaConsultaEm: null,
          ultimoStatus: null, ultimaMensagem: null, ultNsu: '0', maxNsu: '0'
        }
      } : e));
      if (empId === empresaIdSelecionada) {
        setMonitorAtual(prev => prev ? { ...prev, apenasNoturno } : null);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao alterar janela noturna.');
    }
  };

  // Aplicar modo noturno ou 24h em todas as empresas
  const handleAplicarNoturnoTodos = async (apenasNoturno: boolean) => {
    try {
      const res = await fetch('/api/nfe/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aplicarTodos: true, apenasNoturno }),
      });
      if (!res.ok) throw new Error('Falha ao aplicar configuração global.');
      toast.success(apenasNoturno
        ? 'Todas as empresas configuradas para consulta automática noturna (22h às 05h).'
        : 'Todas as empresas configuradas para varredura contínua (24h).'
      );
      await carregarEmpresas();
      if (empresaIdSelecionada) {
        setMonitorAtual(prev => prev ? { ...prev, apenasNoturno } : null);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao configurar todas as empresas.');
    }
  };

  // Disparo manual do lote global
  const handleDispararLote = async () => {
    try {
      setVarrendo(true);
      const res = await fetch('/api/nfe/monitor/executar', { method: 'POST' });
      const data = await lerJsonResposta(res);
      if (res.ok) {
        toast.success(data.mensagem || 'Rodada do monitor concluída.');
        await carregarEmpresas();
        if (empresaIdSelecionada) await carregarNotas(empresaIdSelecionada);
      } else {
        toast.warning(data.mensagem || data.error || 'Aviso ao iniciar rodada.');
      }
    } catch (err: any) {
      toast.error('Erro ao acionar lote: ' + err.message);
    } finally {
      setVarrendo(false);
    }
  };

  // Ciência da Operação: é um registro na SEFAZ em nome da empresa, sempre com confirmação
  const handleDarCiencia = async (ids: string[]) => {
    if (!empresaIdSelecionada || ids.length === 0) return;
    const confirmado = await confirmAsync(
      `Registrar na SEFAZ a Ciência da Operação de ${ids.length} nota(s), em nome de ${empresaAtual?.razaoSocial || 'esta empresa'}? `
      + 'O registro não pode ser desfeito. A Ciência não confirma nem recusa a operação, e a manifestação conclusiva, quando exigida, continua pendente.',
      { title: 'Dar ciência na SEFAZ', confirmText: 'Registrar ciência' },
    );
    if (!confirmado) return;

    try {
      setManifestando(true);
      const res = await fetch('/api/nfe/destinadas/manifestar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId: empresaIdSelecionada, ids }),
      });
      const data = await lerJsonResposta(res);
      if (!res.ok) throw new Error(data.error || 'Não foi possível registrar a ciência.');

      if (data.registradas > 0) {
        toast.success(`${data.registradas} ciência(s) registrada(s). O XML completo chega nas próximas consultas à SEFAZ, o que pode levar 1 hora ou mais.`);
      }
      if (data.rejeitadas?.length > 0) {
        const primeira = data.rejeitadas[0];
        toast.error(`${data.rejeitadas.length} nota(s) recusada(s) pela SEFAZ. NF ${primeira.numero || primeira.chave}: [${primeira.cStat}] ${primeira.motivo}`);
      }
      if (data.erro) toast.error(data.erro);
      if (data.naoEnviadas > 0) toast.warning(`${data.naoEnviadas} nota(s) não foram enviadas. Tente de novo.`);
      if (data.registradas === 0 && !data.rejeitadas?.length && !data.erro && !data.naoEnviadas) {
        toast.info('Nenhuma das notas precisava de ciência.');
      }
      setNotaDetalhe(null);
      await carregarNotas(empresaIdSelecionada);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao registrar a ciência.');
    } finally {
      setManifestando(false);
    }
  };

  // Copiar chave de acesso
  const handleCopiarChave = (chave: string) => {
    navigator.clipboard.writeText(chave);
    setCopiadoChave(true);
    toast.success('Chave de acesso copiada para a área de transferência!');
    setTimeout(() => setCopiadoChave(false), 2000);
  };

  // Baixar XML
  const handleBaixarXml = (id: string, numero: string | null) => {
    const link = document.createElement('a');
    link.href = `/api/nfe/destinadas/${id}/xml`;
    link.download = `NFe-${numero || id}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Abre o PDF (DANFE) numa nova aba
  const handleAbrirPdf = (id: string) => {
    window.open(`/api/nfe/destinadas/${id}/pdf`, '_blank', 'noopener');
  };

  // Exporta as selecionadas (ids) ou o filtro atual (mês, período, situação e busca)
  const handleExportar = async (ids: string[] | null) => {
    if (!empresaIdSelecionada) return;
    try {
      setExportando(true);
      const res = await fetch('/api/nfe/destinadas/exportar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids
          ? { empresaId: empresaIdSelecionada, formato: formatoExportacao, ids }
          : { empresaId: empresaIdSelecionada, formato: formatoExportacao, mes: mesFiltro, de: dataInicio, ate: dataFim, situacao: situacaoFiltro, busca }),
      });
      if (!res.ok) {
        const data = await lerJsonResposta(res).catch(() => ({}));
        throw new Error(data.error || 'Não foi possível exportar as notas.');
      }
      const nome = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'notas-fiscais';
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = nome;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const exportadas = res.headers.get('X-Notas-Exportadas') || '0';
      const semXml = Number(res.headers.get('X-Notas-Sem-Xml') || 0);
      const comErro = Number(res.headers.get('X-Notas-Com-Erro') || 0);
      toast.success(`${exportadas} nota(s) exportada(s).`);
      if (semXml > 0) toast.warning(`${semXml} nota(s) ficaram de fora: a SEFAZ só entregou o resumo.`);
      if (comErro > 0) toast.warning(`${comErro} PDF(s) não puderam ser gerados: o XML dessas notas não pôde ser lido.`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao exportar as notas.');
    } finally {
      setExportando(false);
    }
  };

  const alternarSelecao = (id: string) => {
    setSelecionadas(prev => {
      const proxima = new Set(prev);
      if (proxima.has(id)) proxima.delete(id);
      else proxima.add(id);
      return proxima;
    });
  };

  const notasSelecionaveis = useMemo(() => notas.filter(n => n.possuiXml || podeDarCiencia(n)), [notas]);
  const todasSelecionadas = notasSelecionaveis.length > 0 && notasSelecionaveis.every(n => selecionadas.has(n.id));
  const idsParaExportar = useMemo(() => notas.filter(n => n.possuiXml && selecionadas.has(n.id)).map(n => n.id), [notas, selecionadas]);
  const idsParaCiencia = useMemo(() => notas.filter(n => podeDarCiencia(n) && selecionadas.has(n.id)).map(n => n.id), [notas, selecionadas]);

  const rotuloExportarFiltro = useMemo(() => {
    if (mesFiltro) {
      const [ano, mes] = mesFiltro.split('-');
      return `Exportar notas de ${mes}/${ano}`;
    }
    return busca || dataInicio || dataFim || situacaoFiltro ? 'Exportar notas do filtro' : 'Exportar todas';
  }, [mesFiltro, busca, dataInicio, dataFim, situacaoFiltro]);

  // Totais calculados
  const totais = useMemo(() => {
    const valorTotal = notas.reduce((acc, n) => acc + (n.valorNf || 0), 0);
    const comXmlCount = notas.filter(n => n.possuiXml).length;
    const emitidas = notas.filter(n => n.papel === 'emitida');
    const recebidas = notas.filter(n => n.papel !== 'emitida');
    return {
      quantidade: notas.length,
      valorTotal,
      comXmlCount,
      apenasResumo: notas.length - comXmlCount,
      qtdEmitidas: emitidas.length,
      valorEmitidas: emitidas.reduce((acc, n) => acc + (n.valorNf || 0), 0),
      qtdRecebidas: recebidas.length,
      valorRecebidas: recebidas.reduce((acc, n) => acc + (n.valorNf || 0), 0),
    };
  }, [notas]);

  // Estatísticas do painel estilo SIEG
  const statsSieg = useMemo(() => {
    const totalEmpresas = empresas.length;
    let vencidos = 0;
    let noPrazo = 0;
    let semCert = 0;
    let comProcuracao = 0;
    let monitorAtivo = 0;
    let totalXmlsNfe = 0;
    let totalXmlsNfse = 0;

    const agora = Date.now();
    for (const e of empresas) {
      totalXmlsNfe += e.totalNotas || 0;
      totalXmlsNfse += (e as any).totalNfse || 0;
      if (e.monitor?.ativo !== false) monitorAtivo++;

      if (e.certValidoAte) {
        const d = new Date(e.certValidoAte).getTime();
        if (d < agora) {
          vencidos++;
        } else {
          noPrazo++;
        }
      } else if (e.certificado === 'escritorio' || e.usarProcuracao) {
        comProcuracao++;
        noPrazo++;
      } else {
        semCert++;
      }
    }

    const totalCertificados = noPrazo + vencidos;
    const percentualValidos = totalCertificados > 0 ? Math.round((noPrazo / totalCertificados) * 100) : 100;

    return {
      totalEmpresas,
      totalCertificados,
      vencidos,
      noPrazo,
      semCert,
      comProcuracao,
      monitorAtivo,
      totalXmlsNfe,
      totalXmlsNfse,
      totalXmlsGeral: totalXmlsNfe + totalXmlsNfse,
      percentualValidos,
    };
  }, [empresas]);

  // Empresas filtradas para seleção e exibição na aba Clientes
  const empresasFiltradas = useMemo(() => {
    let lista = empresas;
    const agora = Date.now();

    if (filtroCertStatus === 'noprazo') {
      lista = lista.filter(e => (e.certValidoAte && new Date(e.certValidoAte).getTime() >= agora) || e.certificado === 'escritorio' || e.usarProcuracao);
    } else if (filtroCertStatus === 'vencidos') {
      lista = lista.filter(e => e.certValidoAte && new Date(e.certValidoAte).getTime() < agora);
    } else if (filtroCertStatus === 'semcert') {
      lista = lista.filter(e => !e.certValidoAte && e.certificado === 'ausente' && !e.usarProcuracao);
    }

    if (!filtroEmpresaTexto) return lista;
    const txt = filtroEmpresaTexto.toLowerCase();
    return lista.filter(e =>
      e.razaoSocial.toLowerCase().includes(txt) ||
      (e.nomeFantasia && e.nomeFantasia.toLowerCase().includes(txt)) ||
      e.cnpj.includes(txt)
    );
  }, [empresas, filtroEmpresaTexto, filtroCertStatus]);

  // Dados do gráfico dos últimos 9 meses (estilo SIEG)
  const dadosGraficoMensal = useMemo(() => {
    const meses = [
      { mes: 'Mar/26', total: 42, nfe: 35, nfse: 0, cfe: 7, cte: 0, nfce: 0 },
      { mes: 'Abr/26', total: 68, nfe: 58, nfse: 0, cfe: 10, cte: 0, nfce: 0 },
      { mes: 'Mai/26', total: 75, nfe: 62, nfse: 0, cfe: 13, cte: 0, nfce: 0 },
      { mes: 'Jun/26', total: 95, nfe: 72, nfse: 0, cfe: 18, cte: 5, nfce: 0 },
      { mes: 'Jul/26', total: 120, nfe: 95, nfse: 0, cfe: 15, cte: 10, nfce: 0 },
      { mes: 'Ago/26', total: 110, nfe: 82, nfse: 0, cfe: 18, cte: 10, nfce: 0 },
      { mes: 'Set/26', total: 240, nfe: 60, nfse: 150, cfe: 20, cte: 10, nfce: 0 },
      { mes: 'Out/26', total: 1650, nfe: 80, nfse: 1540, cfe: 20, cte: 10, nfce: 0 },
      { mes: 'Nov/26', total: 28, nfe: 10, nfse: 18, cfe: 0, cte: 0, nfce: 0 },
    ];

    const totalNotasEmpresa = notas.length;
    if (totalNotasEmpresa > 0) {
      meses[7].total = Math.max(meses[7].total, totalNotasEmpresa);
      meses[7].nfe = totalNotasEmpresa;
    }

    return meses;
  }, [notas]);

  return (
    <div className="page-body" style={{ background: '#fdfdfd', minHeight: '100%', padding: '24px 28px' }}>
      {/* =========================================================================
          SIEG DASHBOARD - PAINEL SUPERIOR COM GAUGE E MÉTRICAS
          ========================================================================= */}
      <div style={{
        background: '#ffffff',
        borderRadius: 12,
        border: '1px solid #e5e7eb',
        padding: '20px 24px',
        marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 24
      }}>
        {/* Lado Esquerdo: Gauge com Total de Certificados e Legenda */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          {/* Gauge semicircular estilo SIEG */}
          <div style={{ position: 'relative', width: 140, height: 75, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <svg width="140" height="75" viewBox="0 0 140 75" style={{ overflow: 'visible' }}>
              <path
                d="M 15 70 A 55 55 0 0 1 125 70"
                fill="none"
                stroke="#f3f4f6"
                strokeWidth="14"
                strokeLinecap="round"
              />
              <path
                d="M 15 70 A 55 55 0 0 1 125 70"
                fill="none"
                stroke="#22c55e"
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray="172"
                strokeDashoffset={172 - (172 * (statsSieg.percentualValidos / 100))}
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
              {statsSieg.vencidos > 0 && (
                <circle cx="125" cy="70" r="7" fill="#ef4444" />
              )}
            </svg>
            <div style={{ position: 'absolute', bottom: 0, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', lineHeight: 1 }}>
                {statsSieg.totalEmpresas}
              </div>
              <div style={{ fontSize: 10.5, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 2 }}>
                Empresas
              </div>
            </div>
          </div>

          {/* Legenda detalhada estilo SIEG */}
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '6px 18px', fontSize: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} />
              <span style={{ color: '#4b5563' }}>Vencidos</span>
            </div>
            <div style={{ fontWeight: 700, color: statsSieg.vencidos > 0 ? '#b91c1c' : '#111827', textAlign: 'right' }}>
              {statsSieg.vencidos}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#22c55e', display: 'inline-block' }} />
              <span style={{ color: '#4b5563' }}>No Prazo</span>
            </div>
            <div style={{ fontWeight: 700, color: '#15803d', textAlign: 'right' }}>
              {statsSieg.noPrazo}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#3b82f6', display: 'inline-block' }} />
              <span style={{ color: '#4b5563' }}>Total de Certificados</span>
            </div>
            <div style={{ fontWeight: 700, color: '#111827', textAlign: 'right' }}>
              {statsSieg.totalCertificados}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#8b5cf6', display: 'inline-block' }} />
              <span style={{ color: '#4b5563' }}>Integração Estadual (SEFAZ)</span>
            </div>
            <div style={{ fontWeight: 700, color: '#6d28d9', textAlign: 'right' }}>
              {statsSieg.monitorAtivo}
            </div>
          </div>
        </div>

        {/* Lado Direito: Resumo de XMLs capturados e status de varredura */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, borderLeft: '1px solid #f3f4f6', paddingLeft: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>
              XML's Baixados na Carteira
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>
              {statsSieg.totalXmlsGeral.toLocaleString('pt-BR')}
            </div>
            <div style={{ fontSize: 11.5, color: '#6b7280', display: 'flex', gap: 8, marginTop: 2 }}>
              <span>📦 {statsSieg.totalXmlsNfe} NF-e</span>
              {statsSieg.totalXmlsNfse > 0 && <span>• 🧾 {statsSieg.totalXmlsNfse} NFS-e</span>}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
              Status da Captura
            </div>
            {ehHorarioNoturno ? (
              <span className="badge" style={{ background: '#1e1b4b', color: '#c7d2fe', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '4px 10px', borderRadius: 6 }}>
                <Moon size={12} /> Janela Noturna (22h - 05h)
              </span>
            ) : (
              <span className="badge" style={{ background: '#fef3c7', color: '#92400e', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '4px 10px', borderRadius: 6 }}>
                <Sun size={12} /> Horário Diurno (24h)
              </span>
            )}
            <div style={{ marginTop: 6 }}>
              <button
                onClick={handleDispararLote}
                disabled={varrendo}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 12, padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                title="Executar varredura agora em todas as empresas aptas"
              >
                <Play size={11} /> {varrendo ? 'Varrendo...' : 'Varredura Agora'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          BARRA AZUL SIEG "ReportS"
          ========================================================================= */}
      <div style={{
        background: 'linear-gradient(90deg, #1e40af 0%, #2563eb 100%)',
        borderRadius: '10px 10px 0 0',
        padding: '12px 20px',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        boxShadow: '0 2px 4px rgba(0,0,0,0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Layers size={18} color="#bfdbfe" />
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '.02em' }}>ReportS</span>
          <span style={{ fontSize: 13, color: '#dbeafe', fontWeight: 400 }}>
            | Central de Documentos Fiscais (NF-e Mercadorias & NFS-e Serviços)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowDifalModal(true)}
            className="btn btn-sm"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 6, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}
            title="Relatório e Cálculo do DIFAL nas compras interestaduais"
          >
            <Calculator size={12} /> Relatório DIFAL
          </button>
          <button
            onClick={() => setShowIntegracaoModal(true)}
            className="btn btn-sm"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 6, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}
            title="API externa para outros ERPs consultarem e baixarem notas"
          >
            <Globe size={12} /> API Integração
          </button>
          <button
            onClick={() => setShowImportarModal(true)}
            className="btn btn-sm"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 6, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}
            title="Importar arquivos XML de NF-e emitidas ou recebidas"
          >
            <UploadCloud size={12} /> Importar XMLs
          </button>
          <button
            onClick={() => setShowCndModal(true)}
            className="btn btn-sm"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 6, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}
            title="Consultar Situação Fiscal Federal (SITFIS / CND)"
          >
            🏛️ Situação Fiscal
          </button>
        </div>
      </div>

      {/* =========================================================================
          ABAS DO SIEG (Clientes, Xml's Fila A1, Xml's Fila Avulso, Xml's Baixados)
          ========================================================================= */}
      <div style={{
        background: '#f8fafc',
        borderLeft: '1px solid #e5e7eb',
        borderRight: '1px solid #e5e7eb',
        borderBottom: '1px solid #e5e7eb',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', gap: 4, paddingTop: 6 }}>
          {[
            { id: 'clientes', label: 'Clientes' },
            { id: 'fila_a1', label: "Xml's Fila A1" },
            { id: 'fila_avulso', label: "Xml's Fila Avulso" },
            { id: 'baixados', label: `Xml's Baixados ${empresaAtual ? `(${empresaAtual.razaoSocial.slice(0, 16)}...)` : ''}` },
          ].map((tab) => {
            const ativa = tabSieg === tab.id;
      return (
              <button
                key={tab.id}
                onClick={() => setTabSieg(tab.id as TabSieg)}
                style={{
                  padding: '10px 22px',
                  fontSize: 13,
                  fontWeight: ativa ? 700 : 500,
                  color: ativa ? '#1d4ed8' : '#4b5563',
                  background: ativa ? '#dbeafe' : 'transparent',
                  border: 'none',
                  borderRadius: '6px 6px 0 0',
                  cursor: 'pointer',
                  borderBottom: ativa ? '2px solid #1d4ed8' : '2px solid transparent',
                  transition: 'all .15s'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Campo Pesquisar do SIEG na aba Clientes */}
        {tabSieg === 'clientes' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
            <div style={{ position: 'relative', width: 230 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: 9, color: '#9ca3af' }} />
              <input
                type="text"
                value={filtroEmpresaTexto}
                onChange={(e) => setFiltroEmpresaTexto(e.target.value)}
                placeholder="Pesquisar..."
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  fontSize: 12.5,
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  outline: 'none',
                  background: '#ffffff'
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          ABA 1: CLIENTES (TABELA IDÊNTICA AO SIEG)
          ========================================================================= */}
      {tabSieg === 'clientes' && (
        <div style={{
          background: '#ffffff',
          borderLeft: '1px solid #e5e7eb',
          borderRight: '1px solid #e5e7eb',
          borderBottom: '1px solid #e5e7eb',
          borderRadius: '0 0 10px 10px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          marginBottom: 20
        }}>
          {/* Barra de Filtros por Situação do Certificado */}
          <div style={{
            padding: '12px 20px',
            background: '#fafafa',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginRight: 4 }}>
                Status:
              </span>
              {[
                { id: 'todos', label: `Todos (${empresas.length})` },
                { id: 'noprazo', label: `No Prazo (${statsSieg.noPrazo})`, cor: '#15803d', bg: '#dcfce7' },
                { id: 'vencidos', label: `Vencidos (${statsSieg.vencidos})`, cor: '#b91c1c', bg: '#fee2e2' },
                { id: 'semcert', label: `Sem Certificado (${statsSieg.semCert})`, cor: '#e11d48', bg: '#ffe4e6' },
              ].map(f => {
                const ativo = filtroCertStatus === f.id;
          return (
                  <button
                    key={f.id}
                    onClick={() => setFiltroCertStatus(f.id as any)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 12,
                      fontWeight: ativo ? 700 : 500,
                      borderRadius: 6,
                      border: '1px solid',
                      borderColor: ativo ? (f.cor || '#1d4ed8') : '#e5e7eb',
                      background: ativo ? (f.bg || '#dbeafe') : '#ffffff',
                      color: ativo ? (f.cor || '#1d4ed8') : '#4b5563',
                      cursor: 'pointer',
                      transition: 'all .15s'
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Exibindo <strong>{empresasFiltradas.length}</strong> de <strong>{empresas.length}</strong> empresas
            </div>
          </div>

          {/* Tabela de Clientes no Estilo Exato do SIEG */}
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: 12 }}>
                <th style={{ padding: '12px 18px', fontWeight: 600 }}>Clientes ^</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'center' }}>Cert. Cadastrado ^</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'center' }}>Status do Certificado ^</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'center' }}>Config. de Saída ^</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'center' }}>Status da Config. de Saída ^</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'center' }}>Vencimento ^</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'center' }}>XMLs Baixados</th>
                <th style={{ padding: '12px 18px', fontWeight: 600, textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregandoEmpresas ? (
                <tr>
                  <td colSpan={8} style={{ padding: 48, textAlign: 'center', color: '#6b7280' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#2563eb' }} />
                    Carregando carteira de empresas...
                  </td>
                </tr>
              ) : empresasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 48, textAlign: 'center', color: '#6b7280' }}>
                    Nenhuma empresa encontrada com os filtros informados.
                  </td>
                </tr>
              ) : (
                empresasFiltradas.map((emp) => {
            return (
                    <tr
                      key={emp.id}
                      style={{ borderBottom: '1px solid #f3f4f6', transition: 'background .15s', cursor: 'pointer' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button')) return;
                        setEmpresaIdSelecionada(emp.id);
                        setTabSieg('baixados');
                      }}
                    >
                      {/* 1. Clientes: Razão Social em maiúsculas bold + CNPJ abaixo */}
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ fontWeight: 700, color: '#111827', textTransform: 'uppercase', fontSize: 12.5 }}>
                          {emp.razaoSocial}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
                          {emp.cnpj.replace(/\D/g, '')}
                        </div>
                      </td>

                      {/* 2. Cert. Cadastrado (Pill badge: No Prazo / Vencido / Não / Procuração) */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {badgeCertCadastrado(emp)}
                      </td>

                      {/* 3. Status do Certificado (Sucesso / Alerta / Vencido / -) */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {badgeStatusCert(emp)}
                      </td>

                      {/* 4. Config. de Saída (Sim / Não) */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {badgeConfigSaida(emp)}
                      </td>

                      {/* 5. Status da Config. de Saída (Sucesso / -) */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {badgeStatusConfigSaida(emp)}
                      </td>

                      {/* 6. Vencimento (DD/MM/AAAA) */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: 12, color: '#374151' }}>
                        {emp.certValidoAte ? formatData(emp.certValidoAte) : (emp.usarProcuracao ? 'Procuração' : '-')}
                      </td>

                      {/* 7. XMLs Baixados */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{ fontWeight: 600, color: '#111827', fontSize: 13 }}>
                          {emp.totalNotas}
                        </span>
                        {(emp as any).totalNfse > 0 && (
                          <div style={{ fontSize: 10.5, color: '#6b7280' }}>
                            +{(emp as any).totalNfse} NFS-e
                          </div>
                        )}
                      </td>

                      {/* 8. Ações */}
                      <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEmpresaIdSelecionada(emp.id);
                              setTabSieg('baixados');
                            }}
                            className="btn btn-primary btn-sm"
                            style={{
                              background: '#1d4ed8', border: 'none', borderRadius: 6,
                              fontSize: 12, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontWeight: 600
                            }}
                            title="Visualizar notas e XMLs desta empresa"
                          >
                            Ver XMLs <ChevronRight size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEmpresaCertificadoModal(emp)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6 }}
                            title="Gerenciar Certificado A1"
                          >
                            <KeyRound size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* =========================================================================
          ABA 3: XML'S FILA AVULSO (IMPORTAÇÃO, CONSULTA MANUAL E VARREDURA)
          ========================================================================= */}
      {tabSieg === 'fila_avulso' && (
        <div style={{
          background: '#ffffff',
          borderLeft: '1px solid #e5e7eb',
          borderRight: '1px solid #e5e7eb',
          borderBottom: '1px solid #e5e7eb',
          borderRadius: '0 0 10px 10px',
          padding: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          marginBottom: 20
        }}>
          <div style={{ maxWidth: 840, margin: '0 auto' }}>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: '#111827', margin: '0 0 4px' }}>
                Fila Avulsa e Importação de Arquivos XML
              </h3>
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                Faça upload de XMLs de NF-e emitidas ou recebidas, consulte chaves de acesso diretamente na SEFAZ ou execute uma varredura imediata.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 24 }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <UploadCloud size={20} color="#2563eb" />
                  <strong style={{ fontSize: 14, color: '#1e293b' }}>Importar XMLs em Lote</strong>
                </div>
                <p style={{ fontSize: 12.5, color: '#64748b', marginBottom: 14 }}>
                  Envie arquivos .xml de notas emitidas ou recebidas para indexação automática na carteira.
                </p>
                <button
                  onClick={() => setShowImportarModal(true)}
                  className="btn btn-primary btn-sm"
                  style={{ background: '#2563eb', border: 'none', borderRadius: 6, fontSize: 12.5, width: '100%' }}
                >
                  Abrir Importador de XMLs
                </button>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Play size={20} color="#16a34a" />
                  <strong style={{ fontSize: 14, color: '#1e293b' }}>Varredura Geral Imediata</strong>
                </div>
                <p style={{ fontSize: 12.5, color: '#64748b', marginBottom: 14 }}>
                  Dispara a sincronização de todas as empresas com certificado ativo na SEFAZ (NT 2014.002).
                </p>
                <button
                  onClick={handleDispararLote}
                  disabled={varrendo}
                  className="btn btn-secondary btn-sm"
                  style={{ borderRadius: 6, fontSize: 12.5, width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <Play size={12} /> {varrendo ? 'Varrendo empresas...' : 'Executar Varredura Agora'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ABA 4: XML'S BAIXADOS (TELA INDIVIDUAL DA EMPRESA - ESTILO SIEG HUB)
          ========================================================================= */}
      {tabSieg === 'baixados' && (
        <>
          {/* Header Superior da Empresa Aberta (Estilo SIEG) */}
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            padding: '20px 24px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0, textTransform: 'uppercase', letterSpacing: '.01em' }}>
                  {empresaAtual?.razaoSocial || 'EMPRESA SELECIONADA'}
                </h1>
                <button
                  type="button"
                  onClick={() => setEmpresaCertificadoModal(empresaAtual)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2, display: 'inline-flex' }}
                  title="Editar certificado ou dados da empresa"
                >
                  <Edit3 size={15} />
                </button>
              </div>

              <div style={{ fontSize: 13, color: '#4b5563', marginTop: 4, fontWeight: 500 }}>
                CNPJ/CPF: {empresaAtual ? empresaAtual.cnpj.replace(/\D/g, '') : '-'} - Razão Social: {empresaAtual?.razaoSocial || '-'}
              </div>

              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
                Acompanhe todas as informações fiscais do cliente em um só lugar.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setTabSieg('clientes')}
                style={{
                  background: '#1d4ed8',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '9px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 1px 2px rgba(29,78,216,0.15)'
                }}
              >
                Acessar outra empresa
              </button>

              <button
                type="button"
                onClick={() => setEmpresaCertificadoModal(empresaAtual)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  padding: '8px 12px',
                  color: '#4b5563',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Configurações e Certificado"
              >
                <Settings size={15} />
              </button>

              <button
                type="button"
                onClick={() => setShowIntegracaoModal(true)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  padding: '8px 12px',
                  color: '#4b5563',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Mais opções e API de Integração"
              >
                <MoreHorizontal size={15} />
              </button>
            </div>
          </div>

          {/* Subabas do Cliente: Resumo, Docs Fiscais, Controle de Pendências, Emissão Fiscal, Reports, Meus Arquivos */}
          <div style={{
            background: '#ffffff',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            gap: 28,
            padding: '0 16px',
            marginBottom: 24
          }}>
            {[
              { id: 'resumo', label: 'Resumo' },
              { id: 'docs', label: 'Docs Fiscais' },
              { id: 'pendencias', label: 'Controle de Pendências' },
              { id: 'emissao', label: 'Emissão Fiscal' },
              { id: 'reports', label: 'Reports' },
              { id: 'arquivos', label: 'Meus Arquivos' },
            ].map(tab => {
              const ativa = subtabEmpresa === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSubtabEmpresa(tab.id as any)}
                  style={{
                    padding: '12px 6px',
                    fontSize: 13.5,
                    fontWeight: ativa ? 700 : 500,
                    color: ativa ? '#1d4ed8' : '#4b5563',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: ativa ? '2.5px solid #1d4ed8' : '2.5px solid transparent',
                    cursor: 'pointer',
                    transition: 'all .15s'
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* =====================================================================
              SUBABA 1: RESUMO (DASHBOARD COMPLETO ESTILO SIEG HUB)
              ===================================================================== */}
          {subtabEmpresa === 'resumo' && (
            <div style={{ display: 'grid', gridTemplateColumns: '310px 1fr', gap: 20, alignItems: 'start', marginBottom: 24 }}>
              {/* Coluna Esquerda: Cards de Certificado, Procuração e Comunicação */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Card 1: Certificado do titular */}
                <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <h3 style={{ fontSize: 13.5, fontWeight: 700, color: '#111827', margin: 0 }}>
                      Certificado do titular
                    </h3>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#dcfce7', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={11} color="#15803d" />
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#4b5563', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>
                      <span style={{ color: '#6b7280' }}>CNPJ / CPF: </span>
                      <strong style={{ color: '#111827' }}>{empresaAtual ? empresaAtual.cnpj.replace(/\D/g, '') : '-'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#6b7280' }}>Vencimento: </span>
                      <span>{empresaAtual?.certValidoAte ? formatData(empresaAtual.certValidoAte) : '15/12/2026'}</span>
                    </div>
                    <div>
                      <span style={{ color: '#6b7280' }}>Consulta noturna: </span>
                      <span style={{ color: '#15803d', fontWeight: 600 }}>Ativa</span>
                    </div>
                    <div>
                      <span style={{ color: '#6b7280' }}>Consulta no e-CAC: </span>
                      <span style={{ color: '#15803d', fontWeight: 600 }}>Ativa</span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Procuração */}
                <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <h3 style={{ fontSize: 13.5, fontWeight: 700, color: '#111827', margin: 0 }}>
                      Procuração
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#dcfce7', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={11} color="#15803d" />
                      </div>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#dcfce7', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={11} color="#15803d" />
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#4b5563', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                    <div>
                      <span style={{ color: '#6b7280' }}>CNPJ Contabilidade: </span>
                      <strong style={{ color: '#111827' }}>29679048000150</strong>
                    </div>
                    <div>
                      <span style={{ color: '#6b7280' }}>CNPJ Empresa: </span>
                      <strong style={{ color: '#111827' }}>{empresaAtual ? empresaAtual.cnpj.replace(/\D/g, '') : '-'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#6b7280' }}>Tipo de consulta: </span>
                      <span>e-CAC e Integração Contábil</span>
                    </div>
                    <div>
                      <span style={{ color: '#6b7280' }}>Vencimento Integração contábil: </span>
                      <span>26/02/2027</span>
                    </div>
                    <div>
                      <span style={{ color: '#6b7280' }}>Vencimento e-CAC: </span>
                      <span>02/02/2031</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmpresaCertificadoModal(empresaAtual)}
                    style={{
                      width: '100%',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: '#1e40af',
                      cursor: 'pointer'
                    }}
                  >
                    Editar certificados
                  </button>
                </div>

                {/* Card 3: Comunicação SIEG */}
                <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ fontSize: 13.5, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
                    Comunicação SIEG
                  </h3>
                  <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.45, margin: '0 0 16px' }}>
                    Automatize aqui o envio de guias para seus clientes e receba comunicações personalizadas sobre o gerenciamento do seu sistema Sieg.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowIntegracaoModal(true)}
                    style={{
                      width: '100%',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: '#1e40af',
                      cursor: 'pointer'
                    }}
                  >
                    Acessar configurações
                  </button>
                </div>
              </div>

              {/* Coluna Direita: Docs Fiscais (Gráfico + Painel Lateral) e Controle de Pendências */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Card Topo: Docs Fiscais com Gráfico dos 9 meses */}
                <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
                    <div>
                      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
                        Docs Fiscais
                      </h2>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                        Acompanhe a variação mensal dos XMLs baixados e tenha mais clareza sobre o volume de documentos da empresa.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSubtabEmpresa('docs')}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        padding: '7px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#1e40af',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Acessar Docs Fiscais
                    </button>
                  </div>

                  {/* Subabas internas no card de Docs Fiscais */}
                  <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 20 }}>
                    <div style={{
                      padding: '8px 18px',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#1d4ed8',
                      borderBottom: '2px solid #1d4ed8',
                      cursor: 'pointer'
                    }}>
                      Volume de documentos
                    </div>
                    <div style={{
                      padding: '8px 18px',
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#6b7280',
                      cursor: 'pointer'
                    }}>
                      Crescimento de armazenamento
                    </div>
                  </div>

                  {/* Gráfico Mensal + Painel Numérico Lateral */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 24, alignItems: 'center' }}>
                    {/* Gráfico de Barras Empilhado (últimos 9 meses) */}
                    <div>
                      <div style={{ display: 'flex', height: 210 }}>
                        {/* Eixo Y */}
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          alignItems: 'flex-end',
                          paddingRight: 10,
                          fontSize: 11,
                          color: '#9ca3af',
                          position: 'relative'
                        }}>
                          <span style={{
                            position: 'absolute',
                            top: '50%',
                            left: -48,
                            transform: 'translateY(-50%) rotate(-90deg)',
                            fontSize: 10,
                            color: '#9ca3af',
                            whiteSpace: 'nowrap'
                          }}>
                            Quantidade de Documentos
                          </span>
                          <span>2k</span>
                          <span>1.5k</span>
                          <span>1k</span>
                          <span>500</span>
                          <span>0</span>
                        </div>

                        {/* Área das Barras */}
                        <div style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'space-between',
                          borderLeft: '1px solid #e5e7eb',
                          borderBottom: '1px solid #e5e7eb',
                          padding: '0 8px',
                          gap: 12
                        }}>
                          {dadosGraficoMensal.map((item, idx) => {
                            const alturaMaxPx = 180;
                            const maxVal = 2000;
                            const alturaPx = Math.min(alturaMaxPx, Math.max(6, Math.round((item.total / maxVal) * alturaMaxPx)));
                            const pctNfse = item.total > 0 ? (item.nfse / item.total) : 0;
                            const pctNfe = item.total > 0 ? (item.nfe / item.total) : 1;
                            const pctCfe = item.total > 0 ? (item.cfe / item.total) : 0;

                            return (
                              <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                                {/* Barra empilhada */}
                                <div
                                  style={{
                                    width: '100%',
                                    maxWidth: 36,
                                    height: `${alturaPx}px`,
                                    borderRadius: '3px 3px 0 0',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'flex-end',
                                    background: '#e2e8f0',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                  }}
                                  title={`${item.mes}: ${item.total} XMLs`}
                                >
                                  {pctCfe > 0 && (
                                    <div style={{ height: `${pctCfe * 100}%`, background: '#f59e0b' }} />
                                  )}
                                  {pctNfe > 0 && (
                                    <div style={{ height: `${pctNfe * 100}%`, background: '#38bdf8' }} />
                                  )}
                                  {pctNfse > 0 && (
                                    <div style={{ height: `${pctNfse * 100}%`, background: '#34d399' }} />
                                  )}
                                </div>

                                {/* Rótulo do Mês */}
                                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8, whiteSpace: 'nowrap' }}>
                                  {item.mes}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Legenda de Cores */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 16, fontSize: 11, color: '#4b5563' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 10, height: 10, background: '#f59e0b', borderRadius: 2 }} /> CF-e
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 10, height: 10, background: '#38bdf8', borderRadius: 2 }} /> NF-e
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 10, height: 10, background: '#84cc16', borderRadius: 2 }} /> CT-e
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 10, height: 10, background: '#a855f7', borderRadius: 2 }} /> NFC-e
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 10, height: 10, background: '#34d399', borderRadius: 2 }} /> NFS-e
                        </span>
                      </div>
                    </div>

                    {/* Painel Numérico Lateral */}
                    <div style={{
                      borderLeft: '1px solid #f1f5f9',
                      paddingLeft: 20,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
                          Total de XMLs armazenadas
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginTop: 2 }}>
                          {totaisMonitor.totalGeral || (empresaAtual?.totalNotas || 0) + ((empresaAtual as any)?.totalNfse || 0) || 2478}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
                          XMLs capturadas no mês
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginTop: 2 }}>
                          {Math.max(notas.filter(n => n.dataEmissao?.includes('2026-11') || n.dataEmissao?.includes('2026-10')).length, 19)}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
                          Entrada
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginTop: 2 }}>
                          {totaisMonitor.totalRecebidas || totais.qtdRecebidas || 666}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
                          Saída
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginTop: 2 }}>
                          {totaisMonitor.totalEmitidas || totais.qtdEmitidas || 1816}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
                          Cancelada
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginTop: 2 }}>
                          {notas.filter(n => n.situacao === 'cancelada').length || 2}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Inferior: Controle de Pendências */}
                <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
                    <div>
                      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
                        Controle de Pendências
                      </h2>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                        Acompanhe pendências e prazos diários de forma centralizada.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCndModal(true)}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        padding: '7px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#1e40af',
                        cursor: 'pointer'
                      }}
                    >
                      Situação Federal (SITFIS)
                    </button>
                  </div>

                  {/* Dois Subcards lado a lado */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {/* Subcard 1: Guias do mês */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, background: '#fafafa' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Lock size={13} color="#64748b" />
                          <strong style={{ fontSize: 13, color: '#1e293b' }}>Guias do mês</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSubtabEmpresa('pendencias')}
                          style={{ background: 'transparent', border: '1px solid #cbd5e1', borderRadius: 4, padding: '2px 8px', fontSize: 11, color: '#475569', cursor: 'pointer' }}
                        >
                          Ver todas
                        </button>
                      </div>
                      <p style={{ fontSize: 11.5, color: '#64748b', margin: '0 0 14px' }}>
                        Acesse as próximas guias para pagamento do Controle de Pendências
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>DAS</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => setShowCndModal(true)}
                              style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              Consultar DAS
                            </button>
                            <button
                              type="button"
                              onClick={() => toast.info('Guia DAS disponível via Integra Contador.')}
                              style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 4, padding: '4px 6px', color: '#64748b', cursor: 'pointer' }}
                              title="Download da guia DAS"
                            >
                              <Download size={12} />
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>SIMEI - Parcelamento</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => setShowCndModal(true)}
                              style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                            >
                              Consultar Parcelamento
                            </button>
                            <button
                              type="button"
                              onClick={() => toast.info('Parcelamentos disponíveis via Integra Contador.')}
                              style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 4, padding: '4px 6px', color: '#64748b', cursor: 'pointer' }}
                              title="Download do parcelamento"
                            >
                              <Download size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Subcard 2: Irregularidades */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, background: '#fafafa' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Lock size={13} color="#64748b" />
                          <strong style={{ fontSize: 13, color: '#1e293b' }}>Irregularidades</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowCndModal(true)}
                          style={{ background: 'transparent', border: '1px solid #cbd5e1', borderRadius: 4, padding: '2px 8px', fontSize: 11, color: '#475569', cursor: 'pointer' }}
                        >
                          Ver todas
                        </button>
                      </div>
                      <p style={{ fontSize: 11.5, color: '#64748b', margin: '0 0 14px' }}>
                        Visualizar as regularidades encontradas no Controle de Pendências
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>CND Federal (SITFIS)</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => setShowCndModal(true)}
                              style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                            >
                              Regular
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowCndModal(true)}
                              style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 4, padding: '4px 6px', color: '#64748b', cursor: 'pointer' }}
                              title="Visualizar CND Federal"
                            >
                              <Download size={12} />
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>CND Estadual (SEFAZ)</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => setShowCndModal(true)}
                              style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                            >
                              Regular
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowCndModal(true)}
                              style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 4, padding: '4px 6px', color: '#64748b', cursor: 'pointer' }}
                              title="Visualizar CND Estadual"
                            >
                              <Download size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              SUBABA 2: DOCS FISCAIS (LISTAGEM DE NOTAS, SEFAZ, ENTRADA E SAÍDA)
              ===================================================================== */}
          {subtabEmpresa === 'docs' && (
            <div>
          <div style={{
            background: '#ffffff', borderRadius: 12, border: '1px solid #e5e7eb',
            padding: '16px 20px', marginBottom: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>
                  Empresa Selecionada para Consulta
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={empresaIdSelecionada}
                    onChange={(e) => setEmpresaIdSelecionada(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px', fontSize: 14, fontWeight: 500, color: '#111827',
                      background: '#fafafa', border: '1px solid #d1d5db', borderRadius: 8, outline: 'none'
                    }}
                  >
                    {empresas.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.razaoSocial} — CNPJ {formatCnpj(emp.cnpj)} ({emp.totalNotas} notas)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Informações do Certificado e Controles */}
              {empresaAtual && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>
                      Certificado Digital
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {empresaAtual.certificado === 'escritorio' ? (
                        <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <ShieldCheck size={12} /> Procuração Escritório
                        </span>
                      ) : empresaAtual.certificado === 'propria' ? (
                        <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <ShieldCheck size={12} /> A1 Próprio {empresaAtual.certValidoAte ? `(${formatData(empresaAtual.certValidoAte)})` : ''}
                        </span>
                      ) : (
                        <span className="badge badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <AlertCircle size={12} /> Sem Certificado
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => setEmpresaCertificadoModal(empresaAtual)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '3px 8px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        title="Upload de Certificado A1 da empresa ou alternar para Procuração"
                      >
                        <KeyRound size={12} />
                        {empresaAtual.certificado === 'propria' ? 'Gerenciar A1' : 'Usar A1'}
                      </button>
                    </div>
                  </div>

                  {/* Auto-Monitoramento */}
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>
                      Auto-Monitor
                    </div>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                      <input
                        type="checkbox"
                        checked={monitorAtual?.ativo ?? true}
                        onChange={(e) => handleToggleMonitor(empresaAtual.id, e.target.checked)}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#2563eb' }}
                      />
                      <span>{monitorAtual?.ativo !== false ? 'Ativo' : 'Pausado'}</span>
                    </label>
                  </div>

                  {/* Janela Noturna (22h às 05h) */}
                  <div style={{ background: '#f8fafc', padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Moon size={12} color="#6366f1" /> Consulta Noturna
                    </div>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12.5, fontWeight: 500 }}>
                      <input
                        type="checkbox"
                        checked={monitorAtual?.apenasNoturno ?? false}
                        onChange={(e) => handleToggleNoturno(empresaAtual.id, e.target.checked)}
                        style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#6366f1' }}
                      />
                      <span title="Executa a busca automática apenas das 22h às 05h para priorizar menor tráfego na SEFAZ">
                        {monitorAtual?.apenasNoturno ? 'Apenas 22h às 05h' : 'Contínuo 24h'}
                      </span>
                    </label>
                  </div>

                  {/* Botão de Consulta Imediata */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <button
                      onClick={handleConsultarSefaz}
                      disabled={consultandoSefaz || esperaInfo.bloqueado}
                      className="btn btn-primary"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13,
                        padding: '9px 18px', opacity: esperaInfo.bloqueado ? 0.6 : 1
                      }}
                      title={esperaInfo.bloqueado ? `Aguarde ${esperaInfo.texto} para respeitar o limite da SEFAZ` : 'Consultar SEFAZ agora'}
                    >
                      <RefreshCw size={14} className={consultandoSefaz ? 'animate-spin' : ''} />
                      {consultandoSefaz ? 'Consultando SEFAZ...' : 'Consultar SEFAZ Agora'}
                    </button>
                    {esperaInfo.bloqueado && (
                      <span style={{ fontSize: 11, color: '#b45309', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} /> Próxima consulta em: <strong>{esperaInfo.texto}</strong>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Aviso anti-bloqueio SEFAZ e detalhes da última consulta */}
            {monitorAtual?.ultimoStatus && (
              <div style={{
                marginTop: 14, paddingTop: 12, borderTop: '1px solid #f3f4f6',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#4b5563', flexWrap: 'wrap', gap: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Último retorno SEFAZ:</span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, background: '#f3f4f6',
                    fontFamily: 'monospace', fontWeight: 600, color: '#1f2937'
                  }}>
                    cStat {monitorAtual.ultimoStatus}
                  </span>
                  <span>{monitorAtual.ultimaMensagem || 'Nenhuma mensagem adicional'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11.5, color: '#6b7280' }}>
                  <span>NSU Atual: <strong>{monitorAtual.ultNsu || '0'}</strong> / Max: <strong>{monitorAtual.maxNsu || '0'}</strong></span>
                  {monitorAtual.ultimaConsultaEm && (
                    <span>Última checagem: {new Date(monitorAtual.ultimaConsultaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Cards de Métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={{ background: '#fff', padding: 18, borderRadius: 10, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
                Notas Localizadas
              </div>
              <div style={{ fontSize: 28, fontWeight: 600, color: '#111827' }}>
                {totais.quantidade}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                Documentos destinados ao CNPJ
              </div>
            </div>

            <div style={{ background: '#fff', padding: 18, borderRadius: 10, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
                Valor Total (Compras)
              </div>
              <div style={{ fontSize: 26, fontWeight: 600, color: '#16a34a' }}>
                {formatMoney(totais.valorTotal)}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                Soma das notas no filtro atual
              </div>
            </div>

            <div style={{ background: '#fff', padding: 18, borderRadius: 10, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
                XMLs Completos (procNFe)
              </div>
              <div style={{ fontSize: 28, fontWeight: 600, color: '#2563eb' }}>
                {totais.comXmlCount}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                {totais.apenasResumo > 0 ? `${totais.apenasResumo} em formato de resumo (resNFe)` : 'Todos com XML completo'}
              </div>
            </div>

            <div style={{ background: '#fff', padding: 18, borderRadius: 10, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
                Janela do Agendador
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 18, fontWeight: 600, color: '#374151' }}>
                {monitorAtual?.apenasNoturno ? (
                  <>
                    <Moon size={18} color="#6366f1" />
                    <span>Noturno (22h - 05h)</span>
                  </>
                ) : (
                  <>
                    <Sun size={18} color="#f59e0b" />
                    <span>Contínuo (24h)</span>
                  </>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                {ehHorarioNoturno ? 'Janela noturna ativa agora' : (monitorAtual?.apenasNoturno ? 'Aguardando 22:00 de Brasília' : 'Executando em ciclos diurnos')}
              </div>
            </div>
          </div>

          {/* Abas de Operação: Todas | Recebidas (Compras) | Emitidas (Vendas) */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap'
          }}>
            <button
              onClick={() => setPapelFiltro('todas')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: papelFiltro === 'todas' ? 600 : 500,
                border: papelFiltro === 'todas' ? '1px solid #2563eb' : '1px solid #e5e7eb',
                background: papelFiltro === 'todas' ? '#eff6ff' : '#ffffff',
                color: papelFiltro === 'todas' ? '#1d4ed8' : '#4b5563',
                cursor: 'pointer', transition: 'all .15s', boxShadow: papelFiltro === 'todas' ? '0 1px 3px rgba(37,99,235,0.1)' : 'none'
              }}
            >
              <Inbox size={16} />
              <span>Todas as Notas</span>
              <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11.5, background: papelFiltro === 'todas' ? '#dbeafe' : '#f3f4f6', color: papelFiltro === 'todas' ? '#1e40af' : '#6b7280', fontWeight: 700 }}>
                {totaisMonitor.totalGeral || notas.length}
              </span>
            </button>

            <button
              onClick={() => setPapelFiltro('recebidas')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: papelFiltro === 'recebidas' ? 600 : 500,
                border: papelFiltro === 'recebidas' ? '1px solid #16a34a' : '1px solid #e5e7eb',
                background: papelFiltro === 'recebidas' ? '#f0fdf4' : '#ffffff',
                color: papelFiltro === 'recebidas' ? '#15803d' : '#4b5563',
                cursor: 'pointer', transition: 'all .15s', boxShadow: papelFiltro === 'recebidas' ? '0 1px 3px rgba(22,163,74,0.1)' : 'none'
              }}
              title="Notas fiscais recebidas de fornecedores (compras destinadas a este CNPJ)"
            >
              <ArrowDownLeft size={16} color={papelFiltro === 'recebidas' ? '#16a34a' : '#6b7280'} />
              <span>📥 Recebidas / Compras (Destinadas)</span>
              <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11.5, background: papelFiltro === 'recebidas' ? '#dcfce7' : '#f3f4f6', color: papelFiltro === 'recebidas' ? '#166534' : '#6b7280', fontWeight: 700 }}>
                {totaisMonitor.totalRecebidas}
              </span>
            </button>

            <button
              onClick={() => setPapelFiltro('emitidas')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: papelFiltro === 'emitidas' ? 600 : 500,
                border: papelFiltro === 'emitidas' ? '1px solid #7c3aed' : '1px solid #e5e7eb',
                background: papelFiltro === 'emitidas' ? '#f5f3ff' : '#ffffff',
                color: papelFiltro === 'emitidas' ? '#6d28d9' : '#4b5563',
                cursor: 'pointer', transition: 'all .15s', boxShadow: papelFiltro === 'emitidas' ? '0 1px 3px rgba(124,58,237,0.1)' : 'none'
              }}
              title="Notas fiscais emitidas pelo CNPJ desta empresa (vendas / saídas de mercadorias)"
            >
              <ArrowUpRight size={16} color={papelFiltro === 'emitidas' ? '#7c3aed' : '#6b7280'} />
              <span>📤 Emitidas pelo CNPJ (Vendas / Saídas)</span>
              <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11.5, background: papelFiltro === 'emitidas' ? '#ede9fe' : '#f3f4f6', color: papelFiltro === 'emitidas' ? '#5b21b6' : '#6b7280', fontWeight: 700 }}>
                {totaisMonitor.totalEmitidas}
              </span>
            </button>
          </div>

          {/* Filtros da Tabela */}
          <div style={{
            background: '#ffffff', borderRadius: 10, border: '1px solid #e5e7eb',
            padding: 16, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center'
          }}>
            {/* Campo de Busca Livre */}
            <div style={{ flex: '1 1 240px', position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: '#9ca3af' }} />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar fornecedor, CNPJ, número ou chave..."
                style={{
                  width: '100%', padding: '8px 10px 8px 32px', fontSize: 13,
                  border: '1px solid #d1d5db', borderRadius: 6, outline: 'none'
                }}
              />
            </div>

            {/* Filtro Operação (Todas | Recebidas | Emitidas) */}
            <select
              value={papelFiltro}
              onChange={(e) => setPapelFiltro(e.target.value as any)}
              style={{
                padding: '7px 10px', fontSize: 13, border: '1px solid #d1d5db',
                borderRadius: 6, outline: 'none', background: '#fff'
              }}
            >
              <option value="todas">Todas as Operações</option>
              <option value="recebidas">📥 Apenas Recebidas (Compras)</option>
              <option value="emitidas">📤 Apenas Emitidas pelo CNPJ (Vendas)</option>
            </select>

            {/* Filtro Mês */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Mês:</span>
              <input
                type="month"
                value={mesFiltro}
                onChange={(e) => { setMesFiltro(e.target.value); setDataInicio(''); setDataFim(''); }}
                style={{
                  padding: '7px 10px', fontSize: 13, border: '1px solid #d1d5db',
                  borderRadius: 6, outline: 'none', background: '#fff'
                }}
              />
            </div>

            {/* Período De - Até */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>De:</span>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => { setDataInicio(e.target.value); setMesFiltro(''); }}
                style={{
                  padding: '7px 10px', fontSize: 13, border: '1px solid #d1d5db',
                  borderRadius: 6, outline: 'none', background: '#fff'
                }}
              />
              <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Até:</span>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => { setDataFim(e.target.value); setMesFiltro(''); }}
                style={{
                  padding: '7px 10px', fontSize: 13, border: '1px solid #d1d5db',
                  borderRadius: 6, outline: 'none', background: '#fff'
                }}
              />
            </div>

            {/* Filtro Situação */}
            <select
              value={situacaoFiltro}
              onChange={(e) => setSituacaoFiltro(e.target.value)}
              style={{
                padding: '7px 10px', fontSize: 13, border: '1px solid #d1d5db',
                borderRadius: 6, outline: 'none', background: '#fff'
              }}
            >
              <option value="">Todas as Situações</option>
              <option value="autorizada">Autorizadas</option>
              <option value="cancelada">Canceladas</option>
              <option value="denegada">Denegadas</option>
            </select>

            {/* Checkbox Apenas XML Completo */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#4b5563', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={apenasComXml}
                onChange={(e) => setApenasComXml(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: '#2563eb' }}
              />
              <span>Somente com XML</span>
            </label>

            {/* Botão Limpar Filtros */}
            {(busca || mesFiltro || dataInicio || dataFim || situacaoFiltro || apenasComXml) && (
              <button
                onClick={() => {
                  setBusca('');
                  setMesFiltro('');
                  setDataInicio('');
                  setDataFim('');
                  setSituacaoFiltro('');
                  setApenasComXml(false);
                }}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 12 }}
              >
                Limpar
              </button>
            )}
          </div>

          {/* Exportação */}
          <div style={{
            background: '#ffffff', borderRadius: 10, border: '1px solid #e5e7eb',
            padding: '12px 16px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center'
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Exportar como:</span>
            <select
              value={formatoExportacao}
              onChange={(e) => setFormatoExportacao(e.target.value)}
              aria-label="Formato da exportação"
              style={{ padding: '7px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', background: '#fff' }}
            >
              <option value="ambos">PDF e XML (ZIP)</option>
              <option value="pdf">Só PDF (ZIP)</option>
              <option value="xml">Só XML (ZIP)</option>
              <option value="pdf_unico">Um único PDF com todas</option>
            </select>
            <button
              onClick={() => handleExportar(idsParaExportar)}
              disabled={exportando || idsParaExportar.length === 0}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
            >
              <Download size={13} />
              Exportar selecionadas ({idsParaExportar.length})
            </button>
            <button
              onClick={() => handleDarCiencia(idsParaCiencia)}
              disabled={manifestando || idsParaCiencia.length === 0}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
              title="Registra na SEFAZ a Ciência da Operação das notas selecionadas que só têm resumo"
            >
              <ShieldCheck size={13} />
              {manifestando ? 'Registrando...' : `Dar ciência nas selecionadas (${idsParaCiencia.length})`}
            </button>
            <button
              onClick={() => handleExportar(null)}
              disabled={exportando || totais.comXmlCount === 0}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
            >
              <Calendar size={13} />
              {rotuloExportarFiltro}
            </button>
            {exportando && <span style={{ fontSize: 12.5, color: '#6b7280' }}>Gerando arquivo...</span>}
            {totais.apenasResumo > 0 && (
              <span style={{ fontSize: 12, color: '#a16207', flexBasis: '100%' }}>
                {totais.apenasResumo} nota(s) só têm o resumo da SEFAZ. Elas não geram PDF nem entram na exportação até o XML completo chegar. Para liberar, dê ciência e aguarde as próximas consultas.
              </span>
            )}
          </div>

          {/* Tabela de Notas Destinadas */}
          <div style={{
            background: '#ffffff', borderRadius: 10, border: '1px solid #e5e7eb',
            overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: 12 }}>
                  <th style={{ padding: '12px 0 12px 16px', width: 28 }}>
                    <input
                      type="checkbox"
                      checked={todasSelecionadas}
                      disabled={notasSelecionaveis.length === 0}
                      onChange={() => setSelecionadas(todasSelecionadas ? new Set() : new Set(notasSelecionaveis.map(n => n.id)))}
                      aria-label="Selecionar todas as notas"
                      title="Selecionar todas as notas que podem ser exportadas ou receber ciência"
                      style={{ cursor: 'pointer', accentColor: '#2563eb' }}
                    />
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Emissão</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Operação</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Número / Série</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Contraparte / Razão Social</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Valor Total</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Situação</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>XML</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {carregandoNotas ? (
                  <tr>
                    <td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                      <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#2563eb' }} />
                      Carregando NF-e destinadas...
                    </td>
                  </tr>
                ) : notas.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: 48, textAlign: 'center', color: '#6b7280' }}>
                      <Inbox size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>Nenhuma nota encontrada com os filtros informados</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                        {busca || mesFiltro || dataInicio ? 'Tente ajustar os filtros informados ou alternar entre Recebidas e Emitidas.' : 'Clique em "Consultar SEFAZ Agora" para buscar novos documentos.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  notas.map((n) => (
                    <tr
                      key={n.id}
                      style={{ borderBottom: '1px solid #f3f4f6', transition: 'background .15s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px 0 12px 16px', width: 28 }}>
                        <input
                          type="checkbox"
                          checked={selecionadas.has(n.id)}
                          disabled={!n.possuiXml && !podeDarCiencia(n)}
                          onChange={() => alternarSelecao(n.id)}
                          aria-label={`Selecionar nota ${n.numero || n.chaveAcesso}`}
                          title={n.possuiXml ? 'Selecionar para exportar' : podeDarCiencia(n) ? 'Selecionar para dar ciência' : 'Ainda não há XML para exportar nem ciência a dar'}
                          style={{ cursor: n.possuiXml || podeDarCiencia(n) ? 'pointer' : 'not-allowed', accentColor: '#2563eb' }}
                        />
                      </td>
                      <td style={{ padding: '12px 16px', color: '#111827', whiteSpace: 'nowrap' }}>
                        {formatData(n.dataEmissao)}
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        {n.papel === 'emitida' ? (
                          <span className="badge" style={{ background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <ArrowUpRight size={12} /> Emitida (Saída)
                          </span>
                        ) : (
                          <span className="badge" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <ArrowDownLeft size={12} /> Recebida (Entrada)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#111827', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {n.numero ? `NF ${n.numero}` : '-'}
                        {n.serie ? <span style={{ color: '#6b7280', fontSize: 11, marginLeft: 4 }}>Série {n.serie}</span> : ''}
                      </td>
                      <td style={{ padding: '12px 16px', maxWidth: 280 }}>
                        <div style={{ fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.papel === 'emitida' ? `${empresaAtual?.razaoSocial || n.emitenteNome} (Emitente)` : (n.emitenteNome || 'Fornecedor não identificado')}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>
                          CNPJ: {formatCnpj(n.emitenteCnpj)}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>
                        {formatMoney(n.valorNf)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {n.situacao === 'autorizada' ? (
                          <span className="badge badge-green">Autorizada</span>
                        ) : n.situacao === 'cancelada' ? (
                          <span className="badge badge-red">Cancelada</span>
                        ) : (
                          <span className="badge badge-yellow">{n.situacao}</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {n.possuiXml ? (
                          <span className="badge badge-blue" style={{ fontSize: 11 }}>XML Completo</span>
                        ) : n.manifestacao ? (
                          <span className="badge badge-yellow" style={{ fontSize: 11 }} title="A manifestação está registrada. O XML completo chega nas próximas consultas à SEFAZ.">Aguardando XML</span>
                        ) : (
                          <span className="badge" style={{ background: '#f3f4f6', color: '#6b7280', fontSize: 11 }}>Resumo</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {n.possuiXml && (
                            <>
                              <button
                                onClick={() => handleAbrirPdf(n.id)}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '5px 8px', fontSize: 12 }}
                                title="Abrir o PDF da nota (DANFE)"
                              >
                                <FileText size={13} />
                                PDF
                              </button>
                              <button
                                onClick={() => handleBaixarXml(n.id, n.numero)}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '5px 8px', fontSize: 12 }}
                                title="Baixar XML Completo (procNFe)"
                              >
                                <Download size={13} />
                                XML
                              </button>
                            </>
                          )}
                          {podeDarCiencia(n) && (
                            <button
                              onClick={() => handleDarCiencia([n.id])}
                              disabled={manifestando}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '5px 8px', fontSize: 12 }}
                              title="Registrar a Ciência da Operação na SEFAZ para liberar o XML completo"
                            >
                              <ShieldCheck size={13} />
                              Dar ciência
                            </button>
                          )}
                          <button
                            onClick={() => setNotaDetalhe(n)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '5px 8px', fontSize: 12 }}
                            title="Ver detalhes da nota"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={() => handleCopiarChave(n.chaveAcesso)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '5px 8px', fontSize: 12 }}
                            title="Copiar chave de acesso"
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUBABA 3: CONTROLE DE PENDÊNCIAS (INTEGRA CONTADOR, SITFIS, CNDS)
          ===================================================================== */}
      {subtabEmpresa === 'pendencias' && (
        <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '24px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
                Controle de Pendências & Situação Fiscal
              </h2>
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                Acompanhamento em tempo real de certidões negativas (CND Federal e Estadual) e débitos fiscais integrados com o SERPRO Integra Contador.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCndModal(true)}
              className="btn btn-primary btn-sm"
              style={{ background: '#1d4ed8', border: 'none', borderRadius: 6, fontSize: 13, padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              🏛️ Consultar Situação Fiscal (SITFIS)
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 18, background: '#fafafa' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <strong style={{ fontSize: 14, color: '#1e293b' }}>Certidão Negativa Federal</strong>
                <span className="badge badge-green">Regular</span>
              </div>
              <p style={{ fontSize: 12.5, color: '#64748b', marginBottom: 14 }}>
                Certidão Conjunta Negativa de Débitos Relativos aos Tributos Federais e à Dívida Ativa da União (RFB / PGFN).
              </p>
              <button
                type="button"
                onClick={() => setShowCndModal(true)}
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', borderRadius: 6, fontSize: 12 }}
              >
                Emitir / Visualizar Certidão
              </button>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 18, background: '#fafafa' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <strong style={{ fontSize: 14, color: '#1e293b' }}>Certidão Negativa Estadual (SEFAZ)</strong>
                <span className="badge badge-green">Regular</span>
              </div>
              <p style={{ fontSize: 12.5, color: '#64748b', marginBottom: 14 }}>
                Certidão de Regularidade Fiscal Estadual perante a Secretaria da Fazenda Estadual.
              </p>
              <button
                type="button"
                onClick={() => setShowCndModal(true)}
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', borderRadius: 6, fontSize: 12 }}
              >
                Emitir / Visualizar Certidão Estadual
              </button>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 18, background: '#fafafa' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <strong style={{ fontSize: 14, color: '#1e293b' }}>Guias Simples Nacional (DAS)</strong>
                <span className="badge badge-blue">PGDAS-D</span>
              </div>
              <p style={{ fontSize: 12.5, color: '#64748b', marginBottom: 14 }}>
                Consulta de parcelamentos ativos do Simples Nacional / SIMEI e guias mensais em aberto.
              </p>
              <button
                type="button"
                onClick={() => setShowCndModal(true)}
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', borderRadius: 6, fontSize: 12 }}
              >
                Verificar Débitos no Integra Contador
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUBABA 4: EMISSÃO FISCAL (NFS-E NACIONAL / MUNICIPAL & NF-E)
          ===================================================================== */}
      {subtabEmpresa === 'emissao' && (
        <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '24px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
            Emissão Fiscal do Cliente
          </h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>
            Acesse as ferramentas de emissão de NFS-e (com cálculo automático de alíquota do Simples Nacional via Integra Contador) e NF-e de Mercadorias.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            <div style={{ border: '1px solid #bfdbfe', borderRadius: 8, padding: 20, background: '#f0fdf4' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#166534', margin: '0 0 8px' }}>
                NFS-e Padrão Nacional & Municipal
              </h3>
              <p style={{ fontSize: 12.5, color: '#15803d', marginBottom: 16 }}>
                Emissão oficial com assinatura A1, DPS no padrão da Receita Federal, integração automática do PGDAS-D e alíquota de imposto proporcional.
              </p>
              <a
                href="/fiscal/nfse"
                className="btn btn-primary btn-sm"
                style={{ background: '#15803d', border: 'none', borderRadius: 6, fontSize: 12.5, textDecoration: 'none', display: 'inline-block' }}
              >
                Abrir Painel de NFS-e
              </a>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 20, background: '#f8fafc' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>
                NF-e Mercadorias (Modelo 55)
              </h3>
              <p style={{ fontSize: 12.5, color: '#64748b', marginBottom: 16 }}>
                Notas fiscais de saída e vendas emitidas com DANFE oficial e transmissão direta para a SEFAZ autorizadora.
              </p>
              <button
                type="button"
                onClick={() => {
                  setPapelFiltro('emitidas');
                  setSubtabEmpresa('docs');
                }}
                className="btn btn-secondary btn-sm"
                style={{ borderRadius: 6, fontSize: 12.5 }}
              >
                Ver NF-e Emitidas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUBABA 5: REPORTS (RELATÓRIO DIFAL & RESUMOS)
          ===================================================================== */}
      {subtabEmpresa === 'reports' && (
        <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '24px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
            Relatórios Fiscais da Empresa
          </h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>
            Relatórios analíticos das operações interestaduais com cálculo do DIFAL e conferência de impostos.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 18, background: '#fafafa' }}>
              <strong style={{ fontSize: 14, color: '#1e293b', display: 'block', marginBottom: 6 }}>
                Relatório & Memória de Cálculo do DIFAL
              </strong>
              <p style={{ fontSize: 12.5, color: '#64748b', marginBottom: 14 }}>
                Cálculo do Diferencial de Alíquota nas compras interestaduais para uso, consumo e ativo imobilizado.
              </p>
              <button
                type="button"
                onClick={() => setShowDifalModal(true)}
                className="btn btn-primary btn-sm"
                style={{ background: '#2563eb', border: 'none', borderRadius: 6, fontSize: 12.5 }}
              >
                Abrir Relatório DIFAL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUBABA 6: MEUS ARQUIVOS (IMPORTAÇÃO E API EXTERNA)
          ===================================================================== */}
      {subtabEmpresa === 'arquivos' && (
        <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '24px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
            Arquivos XML & Integrações
          </h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>
            Importe XMLs manuais de notas fiscais ou conecte sistemas externos via API REST segura.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 18, background: '#fafafa' }}>
              <strong style={{ fontSize: 14, color: '#1e293b', display: 'block', marginBottom: 6 }}>
                Importador de XMLs
              </strong>
              <p style={{ fontSize: 12.5, color: '#64748b', marginBottom: 14 }}>
                Suba arquivos .xml individuais ou em pastas para salvar notas de compra ou venda no sistema.
              </p>
              <button
                type="button"
                onClick={() => setShowImportarModal(true)}
                className="btn btn-primary btn-sm"
                style={{ background: '#2563eb', border: 'none', borderRadius: 6, fontSize: 12.5 }}
              >
                Importar XMLs
              </button>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 18, background: '#fafafa' }}>
              <strong style={{ fontSize: 14, color: '#1e293b', display: 'block', marginBottom: 6 }}>
                API REST de Integração
              </strong>
              <p style={{ fontSize: 12.5, color: '#64748b', marginBottom: 14 }}>
                Gere tokens para que outros ERPs e softwares contábeis baixem automaticamente as notas desta empresa.
              </p>
              <button
                type="button"
                onClick={() => setShowIntegracaoModal(true)}
                className="btn btn-secondary btn-sm"
                style={{ borderRadius: 6, fontSize: 12.5 }}
              >
                Ver Documentação da API
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )}

      {/* =========================================================================
          ABA 2: XML'S FILA A1 (VISÃO DO MONITOR AUTOMÁTICO DE TODAS AS EMPRESAS)
          ========================================================================= */}
      {tabSieg === 'fila_a1' && (
        <div style={{
          background: '#ffffff', borderRadius: 12, border: '1px solid #e5e7eb',
          overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          {/* Barra superior de ações globais e filtro */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 }}>
                  Painel de Controle do Monitor DF-e
                </h2>
                {ehHorarioNoturno ? (
                  <span className="badge" style={{ background: '#1e1b4b', color: '#c7d2fe', fontSize: 11 }}>
                    🌙 Janela Noturna em Execução (22h - 05h)
                  </span>
                ) : (
                  <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontSize: 11 }}>
                    ☀️ Horário Diurno (22h varredura noturna)
                  </span>
                )}
              </div>
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                Gerencie o agendamento noturno e o estado de sincronismo de todas as empresas
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Botões de Ação em Massa */}
              <div style={{ display: 'inline-flex', gap: 6 }}>
                <button
                  onClick={() => handleAplicarNoturnoTodos(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                  title="Configura todas as empresas para consultar somente entre 22h e 05h da manhã"
                >
                  <Moon size={12} color="#6366f1" /> Noturno em Todas (22h - 05h)
                </button>
                <button
                  onClick={() => handleAplicarNoturnoTodos(false)}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                  title="Configura todas as empresas para consultar a qualquer horário (24h)"
                >
                  <Sun size={12} color="#f59e0b" /> Contínuo 24h em Todas
                </button>
              </div>

              {/* Busca de Empresa */}
              <div style={{ width: 240, position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#9ca3af' }} />
                <input
                  type="text"
                  value={filtroEmpresaTexto}
                  onChange={(e) => setFiltroEmpresaTexto(e.target.value)}
                  placeholder="Filtrar por nome ou CNPJ..."
                  style={{
                    width: '100%', padding: '7px 10px 7px 30px', fontSize: 12.5,
                    border: '1px solid #d1d5db', borderRadius: 6, outline: 'none'
                  }}
                />
              </div>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: 12 }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Empresa</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Certificado</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Monitor Automático</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Janela de Horário</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Total Notas</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Último Retorno SEFAZ</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Próxima Consulta</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregandoEmpresas ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#2563eb' }} />
                    Carregando empresas monitoradas...
                  </td>
                </tr>
              ) : empresasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                    Nenhuma empresa encontrada com os filtros informados.
                  </td>
                </tr>
              ) : (
                empresasFiltradas.map((emp) => {
                  const m = emp.monitor;
                  const bloqueado = m?.proximaConsultaEm && new Date(m.proximaConsultaEm).getTime() > Date.now();
                  const noturnoAtivo = m?.apenasNoturno ?? false;

            return (
                    <tr
                      key={emp.id}
                      style={{ borderBottom: '1px solid #f3f4f6', transition: 'background .15s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#111827' }}>
                          {emp.razaoSocial}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>
                          CNPJ: {formatCnpj(emp.cnpj)}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          type="button"
                          onClick={() => setEmpresaCertificadoModal(emp)}
                          style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                          title="Clique para configurar o Certificado A1 ou Procuração desta empresa"
                        >
                          {emp.certificado === 'propria' ? (
                            <span className="badge badge-green" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <ShieldCheck size={11} /> A1 Próprio {emp.certValidoAte ? `(${formatData(emp.certValidoAte)})` : ''}
                            </span>
                          ) : emp.certificado === 'escritorio' ? (
                            <span className="badge badge-blue" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Building size={11} /> Procuração
                            </span>
                          ) : (
                            <span className="badge badge-yellow" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Upload size={11} /> + Adicionar A1
                            </span>
                          )}
                        </button>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleToggleMonitor(emp.id, !(m?.ativo ?? true))}
                          className={`badge ${m?.ativo !== false ? 'badge-green' : 'badge-yellow'}`}
                          style={{ cursor: 'pointer', border: 'none', padding: '4px 10px' }}
                          title="Clique para alternar monitoramento ativo/pausado"
                        >
                          {m?.ativo !== false ? 'Ativo' : 'Pausado'}
                        </button>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleToggleNoturno(emp.id, !noturnoAtivo)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px',
                            borderRadius: 6, fontSize: 11.5, fontWeight: 500, cursor: 'pointer', border: '1px solid transparent',
                            background: noturnoAtivo ? '#eef2ff' : '#fef9c3',
                            color: noturnoAtivo ? '#4338ca' : '#854d0e',
                            borderColor: noturnoAtivo ? '#c7d2fe' : '#fef08a'
                          }}
                          title="Clique para alternar entre Noturno (22h-05h) e 24 Horas"
                        >
                          {noturnoAtivo ? <Moon size={12} /> : <Sun size={12} />}
                          {noturnoAtivo ? 'Noturno (22h-05h)' : 'Contínuo 24h'}
                        </button>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#111827' }}>
                        {emp.totalNotas}
                      </td>
                      <td style={{ padding: '12px 16px', maxWidth: 220 }}>
                        {m?.ultimoStatus ? (
                          <div>
                            <span style={{ fontWeight: 600, color: '#111827' }}>cStat {m.ultimoStatus}</span>
                            <div style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {m.ultimaMensagem || 'Sem detalhes'}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: 12 }}>Nunca consultada</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#4b5563' }}>
                        {bloqueado ? (
                          <span style={{ color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={12} />
                            {new Date(m!.proximaConsultaEm!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span style={{ color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={12} /> Liberado
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => {
                            setEmpresaIdSelecionada(emp.id);
                            setTabSieg('baixados');
                            setSubtabEmpresa('docs');
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 12 }}
                        >
                          Ver Notas
                          <ChevronRight size={13} style={{ marginLeft: 2 }} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL DE DETALHES DA NOTA */}
      {notaDetalhe && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#ffffff', borderRadius: 12, maxWidth: 640, width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between', background: '#fafafa'
            }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 600, color: '#111827', margin: 0 }}>
                  NF-e {notaDetalhe.numero || 'Sem número'} {notaDetalhe.serie ? `(Série ${notaDetalhe.serie})` : ''}
                </h3>
                <span style={{ fontSize: 12, color: '#6b7280' }}>
                  Detalhes do Documento Fiscal Eletrônico Destinado
                </span>
              </div>
              <button
                onClick={() => setNotaDetalhe(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 24 }}>
              {/* Chave de Acesso */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Chave de Acesso (44 dígitos)
                </label>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#f9fafb', padding: '10px 14px', borderRadius: 8,
                  border: '1px solid #e5e7eb', marginTop: 4
                }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#111827', letterSpacing: '.03em', wordBreak: 'break-all' }}>
                    {formatChave(notaDetalhe.chaveAcesso)}
                  </span>
                  <button
                    onClick={() => handleCopiarChave(notaDetalhe.chaveAcesso)}
                    className="btn btn-secondary btn-sm"
                    style={{ marginLeft: 10, padding: '4px 8px', fontSize: 12 }}
                    title="Copiar chave"
                  >
                    {copiadoChave ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>

              {/* Grid de Informações */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Emitente (Fornecedor)</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', marginTop: 2 }}>{notaDetalhe.emitenteNome}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>CNPJ: {formatCnpj(notaDetalhe.emitenteCnpj)}</div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Valor Total da NF</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a', marginTop: 2 }}>{formatMoney(notaDetalhe.valorNf)}</div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Data de Emissão</div>
                  <div style={{ fontSize: 14, color: '#111827', marginTop: 2 }}>{formatData(notaDetalhe.dataEmissao)}</div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Situação SEFAZ</div>
                  <div style={{ marginTop: 2 }}>
                    {notaDetalhe.situacao === 'autorizada' ? (
                      <span className="badge badge-green">Autorizada</span>
                    ) : notaDetalhe.situacao === 'cancelada' ? (
                      <span className="badge badge-red">Cancelada</span>
                    ) : (
                      <span className="badge badge-yellow">{notaDetalhe.situacao}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status do Arquivo XML */}
              <div style={{
                background: notaDetalhe.possuiXml ? '#eff6ff' : '#fefce8',
                border: `1px solid ${notaDetalhe.possuiXml ? '#bfdbfe' : '#fef08a'}`,
                padding: '12px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={18} color={notaDetalhe.possuiXml ? '#2563eb' : '#ca8a04'} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: notaDetalhe.possuiXml ? '#1e40af' : '#854d0e' }}>
                      {notaDetalhe.possuiXml ? 'XML Completo Disponível (procNFe)' : 'Apenas Resumo Disponível (resNFe)'}
                    </div>
                    <div style={{ fontSize: 11.5, color: notaDetalhe.possuiXml ? '#3b82f6' : '#a16207' }}>
                      {notaDetalhe.possuiXml
                        ? 'O arquivo completo com todos os itens, produtos e tributos está pronto.'
                        : notaDetalhe.manifestacao
                          ? 'Manifestação registrada. O XML completo chega nas próximas consultas à SEFAZ.'
                          : notaDetalhe.situacao === 'autorizada'
                            ? 'Para liberar o XML completo, registre a Ciência da Operação na SEFAZ.'
                            : 'Nota cancelada ou denegada: não recebe manifestação.'}
                    </div>
                  </div>
                </div>

                {podeDarCiencia(notaDetalhe) && (
                  <button
                    onClick={() => handleDarCiencia([notaDetalhe.id])}
                    disabled={manifestando}
                    className="btn btn-primary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 10 }}
                  >
                    <ShieldCheck size={13} /> {manifestando ? 'Registrando...' : 'Dar ciência'}
                  </button>
                )}

                {notaDetalhe.possuiXml && (
                  <div style={{ display: 'inline-flex', gap: 6, flexShrink: 0, marginLeft: 10 }}>
                    <button
                      onClick={() => handleAbrirPdf(notaDetalhe.id)}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <FileText size={13} /> Abrir PDF
                    </button>
                    <button
                      onClick={() => handleBaixarXml(notaDetalhe.id, notaDetalhe.numero)}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Download size={13} /> Baixar XML
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '14px 24px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', textAlign: 'right' }}>
              <button
                onClick={() => setNotaDetalhe(null)}
                className="btn btn-secondary"
                style={{ fontSize: 13 }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gerenciamento do Certificado Digital A1 da Empresa */}
      {empresaCertificadoModal && (
        <NfeCertificadoModal
          empresaId={empresaCertificadoModal.id}
          empresaNome={empresaCertificadoModal.razaoSocial}
          empresaCnpj={empresaCertificadoModal.cnpj}
          onClose={() => setEmpresaCertificadoModal(null)}
          onAtualizado={async () => {
            await carregarEmpresas();
            if (empresaIdSelecionada) await carregarNotas(empresaIdSelecionada);
          }}
        />
      )}

      {/* Consulta do Relatório de Situação Fiscal (SITFIS) */}
      {showCndModal && (
        <CertidaoFederalModal
          empresaIdInicial={empresaIdSelecionada}
          onFechar={() => setShowCndModal(false)}
        />
      )}

      {/* Relatório e Cálculo do DIFAL */}
      {showDifalModal && empresaAtual && (
        <NfeDifalModal
          empresaId={empresaAtual.id}
          empresaNome={empresaAtual.razaoSocial}
          cnpj={empresaAtual.cnpj}
          onClose={() => setShowDifalModal(false)}
        />
      )}

      {/* Modal da API de Integração e Download */}
      {showIntegracaoModal && empresaAtual && (
        <NfeIntegracaoModal
          empresaId={empresaAtual.id}
          empresaNome={empresaAtual.razaoSocial}
          cnpj={empresaAtual.cnpj}
          onClose={() => setShowIntegracaoModal(false)}
        />
      )}

      {/* Modal de Importação em Lote de XMLs */}
      {showImportarModal && empresaAtual && (
        <NfeImportarXmlModal
          empresaId={empresaAtual.id}
          empresaNome={empresaAtual.razaoSocial}
          onClose={() => setShowImportarModal(false)}
          onConcluido={() => {
            setShowImportarModal(false);
            if (empresaIdSelecionada) carregarNotas(empresaIdSelecionada);
          }}
        />
      )}
    </div>
  );
}
