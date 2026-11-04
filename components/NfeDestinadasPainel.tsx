'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Instrument_Serif } from 'next/font/google';
import {
  Inbox, Search, RefreshCw, Download, Copy, Check, Filter, Calendar, Building2,
  AlertCircle, CheckCircle2, Clock, ShieldCheck, FileText, ArrowUpDown, ChevronRight,
  ExternalLink, Eye, X, Layers, Play, Moon, Sun, Sparkles, KeyRound, Upload, Building,
  Calculator, Globe, UploadCloud, ArrowUpRight, ArrowDownLeft,
  Edit3, Lock, Settings, MoreHorizontal, CheckCircle, ArrowLeftRight
} from 'lucide-react';
import { toast } from 'sonner';
import { fmt } from '../lib/reports';
import NfeCertificadoModal from './NfeCertificadoModal';
import CertidaoFederalModal from './CertidaoFederalModal';
import NfeDifalModal from './NfeDifalModal';
import NfeIntegracaoModal from './NfeIntegracaoModal';
import NfeImportarXmlModal from './NfeImportarXmlModal';
import CadastrarCnpjModal from './CadastrarCnpjModal';
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
    ultNsu: string | null;
    maxNsu: string | null;
  } | null;
  totalNotas: number;
}

interface NfeDestinadaItem {
  id: string;
  chaveAcesso: string;
  numero: string | null;
  serie: string | null;
  dataEmissao: string;
  emitenteCnpj: string;
  emitenteNome: string;
  destinatarioCnpj?: string;
  destinatarioNome?: string;
  papel?: 'recebida' | 'emitida';
  valorNf: number;
  situacao: 'autorizada' | 'cancelada' | 'denegada' | string;
  situacaoManifestacao: string;
  possuiXml: boolean;
  tipoDocumento: string;
  dataManifestacao?: string | null;
  protocoloManifestacao?: string | null;
}

// Helpers de formatação
function formatCnpj(cnpj: string): string {
  if (!cnpj) return '';
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatChave(chave: string): string {
  if (!chave) return '';
  return chave.replace(/(\d{4})/g, '$1 ').trim();
}

function formatData(dataStr?: string | null): string {
  if (!dataStr) return '—';
  try {
    const parte = dataStr.slice(0, 10);
    const [ano, mes, dia] = parte.split('-');
    if (ano && mes && dia) return `${dia}/${mes}/${ano}`;
    const d = new Date(dataStr);
    return isNaN(d.getTime()) ? dataStr : d.toLocaleDateString('pt-BR');
  } catch {
    return dataStr;
  }
}

function podeDarCiencia(nota: NfeDestinadaItem): boolean {
  if (nota.possuiXml) return false;
  const sit = (nota.situacaoManifestacao || '').toLowerCase();
  return !sit || sit === 'sem_manifestacao' || sit === 'desconhecida' || sit === 'nenhuma';
}

function labelManifestacao(sit?: string | null): { rotulo: string; classe: string } {
  const s = (sit || '').toLowerCase();
  if (s.includes('ciencia') || s.includes('ciência')) return { rotulo: 'Ciência Registrada', classe: 'badge-blue' };
  if (s.includes('confirma')) return { rotulo: 'Confirmada', classe: 'badge-green' };
  if (s.includes('desconhec')) return { rotulo: 'Desconhecida', classe: 'badge-red' };
  if (s.includes('nao_realizada') || s.includes('não realizada')) return { rotulo: 'Não Realizada', classe: 'badge-red' };
  return { rotulo: 'Sem Manifesto', classe: 'badge-amber' };
}

export default function NfeDestinadasPainel() {
  const [empresas, setEmpresas] = useState<EmpresaMonitor[]>([]);
  const [carregandoEmpresas, setCarregandoEmpresas] = useState(true);
  const [empresaIdSelecionada, setEmpresaIdSelecionada] = useState<string>('');
  const [abaPrincipal, setAbaPrincipal] = useState<'recebidas' | 'emitidas' | 'todas' | 'carteira'>('recebidas');
  const [filtroStatusRapido, setFiltroStatusRapido] = useState<string>('todas');
  const [ehHorarioNoturno, setEhHorarioNoturno] = useState(false);

  // Filtros de busca de notas
  const [busca, setBusca] = useState('');
  const [mesFiltro, setMesFiltro] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [situacaoFiltro, setSituacaoFiltro] = useState('');
  const [apenasComXml, setApenasComXml] = useState(false);

  // Modais de suporte
  const [showDifalModal, setShowDifalModal] = useState(false);
  const [showIntegracaoModal, setShowIntegracaoModal] = useState(false);
  const [showImportarModal, setShowImportarModal] = useState(false);

  // Estado das Notas
  const [notas, setNotas] = useState<NfeDestinadaItem[]>([]);
  const [monitorAtual, setMonitorAtual] = useState<EmpresaMonitor['monitor']>(null);
  const [carregandoNotas, setCarregandoNotas] = useState(false);
  const [consultandoSefaz, setConsultandoSefaz] = useState(false);

  // Detalhe da Nota
  const [notaDetalhe, setNotaDetalhe] = useState<NfeDestinadaItem | null>(null);
  const [copiadoChave, setCopiadoChave] = useState(false);

  // Modais de Certificado e Situação Fiscal
  const [empresaCertificadoModal, setEmpresaCertificadoModal] = useState<EmpresaMonitor | null>(null);
  const [showCndModal, setShowCndModal] = useState(false);
  const [showCadastrarCnpjModal, setShowCadastrarCnpjModal] = useState(false);
  const [showTrocarEmpresaModal, setShowTrocarEmpresaModal] = useState(false);
  const [buscaModalEmpresa, setBuscaModalEmpresa] = useState('');

  // Filtro de Empresas
  const [filtroEmpresaTexto, setFiltroEmpresaTexto] = useState('');
  const inicializadoRef = useRef(false);

  // Seleção Múltipla & Ações em Lote
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [manifestando, setManifestando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [formatoExportacao, setFormatoExportacao] = useState<'ambos' | 'pdf' | 'xml' | 'pdf_unico'>('ambos');

  // Consulta de Horário Noturno
  useEffect(() => {
    const hora = new Date().getHours();
    setEhHorarioNoturno(hora >= 22 || hora < 5);
  }, []);

  // Carrega Empresas do Monitor
  const carregarEmpresas = useCallback(async () => {
    try {
      setCarregandoEmpresas(true);
      const res = await fetch('/api/nfe/monitor');
      const data = await lerJsonResposta(res);
      if (res.ok && Array.isArray(data.empresas)) {
        setEmpresas(data.empresas);
        if (!inicializadoRef.current) {
          inicializadoRef.current = true;
          // Tenta recuperar a última empresa usada na inicialização
          const salva = sessionStorage.getItem('cf_nfe_empresa_id');
          if (salva && data.empresas.some((e: EmpresaMonitor) => e.id === salva)) {
            setEmpresaIdSelecionada(salva);
          } else if (data.empresas.length > 0) {
            setEmpresaIdSelecionada(data.empresas[0].id);
          }
        }
      } else {
        toast.error(data.error || 'Não foi possível carregar a lista de empresas.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao conectar com o servidor para listar empresas.');
    } finally {
      setCarregandoEmpresas(false);
    }
  }, []);

  useEffect(() => {
    carregarEmpresas();
  }, [carregarEmpresas]);

  // Carrega Notas da Empresa Selecionada
  const carregarNotas = useCallback(async (id: string) => {
    if (!id) return;
    try {
      setCarregandoNotas(true);
      sessionStorage.setItem('cf_nfe_empresa_id', id);

      const params = new URLSearchParams({ empresaId: id });
      if (mesFiltro) params.set('mes', mesFiltro);
      if (dataInicio) params.set('de', dataInicio);
      if (dataFim) params.set('ate', dataFim);
      if (situacaoFiltro) params.set('situacao', situacaoFiltro);
      if (busca) params.set('busca', busca);

      const res = await fetch(`/api/nfe/destinadas?${params.toString()}`);
      const data = await lerJsonResposta(res);

      if (res.ok) {
        setNotas(data.notas || []);
        setMonitorAtual(data.monitor || null);
        setSelecionadas(new Set());
      } else {
        toast.error(data.error || 'Erro ao carregar as notas da empresa.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao buscar as notas destinadas.');
    } finally {
      setCarregandoNotas(false);
    }
  }, [mesFiltro, dataInicio, dataFim, situacaoFiltro, busca]);

  useEffect(() => {
    if (empresaIdSelecionada) {
      carregarNotas(empresaIdSelecionada);
    }
  }, [empresaIdSelecionada, carregarNotas]);

  const empresaAtual = useMemo(() => {
    return empresas.find(e => e.id === empresaIdSelecionada) || null;
  }, [empresas, empresaIdSelecionada]);

  // Consulta Imediata na SEFAZ (NF-e Mercadorias) e SEFIN (NFS-e Serviços)
  const handleConsultarSefaz = async () => {
    if (!empresaIdSelecionada) return;
    try {
      setConsultandoSefaz(true);
      const [resSefaz] = await Promise.allSettled([
        fetch('/api/nfe/destinadas/consultar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empresaId: empresaIdSelecionada }),
        }),
        fetch(`/api/nfse/emissores/${empresaIdSelecionada}/notas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meses: 3 }),
        }),
      ]);

      if (resSefaz.status === 'fulfilled') {
        const data = await lerJsonResposta(resSefaz.value);
        if (resSefaz.value.ok) {
          toast.success(data.mensagem || 'Consulta realizada com sucesso na SEFAZ e SEFIN!');
          await carregarNotas(empresaIdSelecionada);
          await carregarEmpresas();
        } else {
          toast.error(data.error || 'Falha ao consultar a SEFAZ.');
        }
      } else {
        toast.error('Erro de conexão ao consultar o WebService.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro de conexão ao consultar os órgãos emissores.');
    } finally {
      setConsultandoSefaz(false);
    }
  };

  // Toggle do Monitor Automático
  const handleToggleMonitor = async (empId: string, novoAtivo: boolean) => {
    try {
      const res = await fetch('/api/nfe/destinadas/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId: empId, ativo: novoAtivo }),
      });
      const data = await lerJsonResposta(res);
      if (res.ok) {
        toast.success(novoAtivo ? 'Auto-monitoramento ativado!' : 'Auto-monitoramento pausado.');
        setEmpresas(prev => prev.map(e => e.id === empId ? { ...e, monitor: { ...(e.monitor || {} as any), ativo: novoAtivo } } : e));
        if (empresaIdSelecionada === empId) {
          setMonitorAtual(prev => prev ? { ...prev, ativo: novoAtivo } : null);
        }
      } else {
        toast.error(data.error || 'Erro ao alterar configuração do monitor.');
      }
    } catch {
      toast.error('Erro ao conectar ao servidor.');
    }
  };

  // Toggle Consulta Noturna
  const handleToggleNoturno = async (empId: string, apenasNoturno: boolean) => {
    try {
      const res = await fetch('/api/nfe/destinadas/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId: empId, apenasNoturno }),
      });
      const data = await lerJsonResposta(res);
      if (res.ok) {
        toast.success(apenasNoturno ? 'Consulta configurada para Janela Noturna (22h - 05h).' : 'Consulta configurada para 24 horas contínuas.');
        setEmpresas(prev => prev.map(e => e.id === empId ? { ...e, monitor: { ...(e.monitor || {} as any), apenasNoturno } } : e));
        if (empresaIdSelecionada === empId) {
          setMonitorAtual(prev => prev ? { ...prev, apenasNoturno } : null);
        }
      } else {
        toast.error(data.error || 'Erro ao salvar configuração.');
      }
    } catch {
      toast.error('Erro ao conectar ao servidor.');
    }
  };

  // Manifestação do Destinatário
  const manifestarNota = async (chaveAcesso: string, tipoEvento: '210210' | '210200' | '210220' | '210240', justificativa?: string) => {
    if (!empresaIdSelecionada) return;
    try {
      setManifestando(true);
      const res = await fetch('/api/nfe/destinadas/manifestar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId: empresaIdSelecionada, chaveAcesso, tipoEvento, justificativa }),
      });
      const data = await lerJsonResposta(res);
      if (res.ok) {
        toast.success(data.mensagem || 'Manifestação registrada na SEFAZ com sucesso!');
        await carregarNotas(empresaIdSelecionada);
      } else {
        toast.error(data.error || 'Erro ao registrar manifestação na SEFAZ.');
      }
    } catch {
      toast.error('Erro de conexão ao enviar manifestação.');
    } finally {
      setManifestando(false);
    }
  };

  // Ciência em Lote
  const handleDarCiencia = async (ids: string[]) => {
    if (ids.length === 0 || !empresaIdSelecionada) return;
    const ok = await confirmAsync(
      `Deseja registrar Ciência da Operação para ${ids.length} nota(s) na SEFAZ? O XML completo será disponibilizado nas próximas consultas.`,
      { title: 'Registrar Ciência da Operação', confirmText: 'Sim, registrar ciência' }
    );
    if (!ok) return;

    try {
      setManifestando(true);
      let sucesso = 0;
      let falha = 0;
      for (const id of ids) {
        const n = notas.find(item => item.id === id);
        if (!n) continue;
        const res = await fetch('/api/nfe/destinadas/manifestar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empresaId: empresaIdSelecionada, chaveAcesso: n.chaveAcesso, tipoEvento: '210210' }),
        });
        if (res.ok) sucesso++;
        else falha++;
      }
      toast.success(`${sucesso} nota(s) manifestada(s) com sucesso.`);
      if (falha > 0) toast.warning(`${falha} nota(s) falharam na manifestação.`);
      await carregarNotas(empresaIdSelecionada);
    } catch {
      toast.error('Erro ao processar lote de manifestação.');
    } finally {
      setManifestando(false);
    }
  };

  // Copiar Chave
  const handleCopiarChave = (chave: string) => {
    navigator.clipboard.writeText(chave);
    setCopiadoChave(true);
    toast.success('Chave de acesso copiada!');
    setTimeout(() => setCopiadoChave(false), 2000);
  };

  // Baixar XML individual
  const handleBaixarXml = (id: string, numero: string | null) => {
    const link = document.createElement('a');
    link.href = `/api/nfe/destinadas/${id}/xml`;
    link.download = `NFe_${numero || id}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Abrir PDF / DANFE
  const handleAbrirPdf = (id: string) => {
    window.open(`/api/nfe/destinadas/${id}/pdf`, '_blank');
  };

  // Exportar Lote / Filtro
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
      toast.success(`${exportadas} nota(s) exportada(s) com sucesso.`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao exportar as notas.');
    } finally {
      setExportando(false);
    }
  };

  // Seleção
  const alternarSelecao = (id: string) => {
    setSelecionadas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filtragem das Notas
  const notasFiltradas = useMemo(() => {
    return notas.filter(n => {
      // 1. Papel (Recebidas / Emitidas / Todas)
      if (abaPrincipal === 'recebidas' && n.papel === 'emitida') return false;
      if (abaPrincipal === 'emitidas' && n.papel !== 'emitida') return false;

      // 2. Filtro Rápido de Status
      if (filtroStatusRapido === 'xml' && !n.possuiXml) return false;
      if (filtroStatusRapido === 'resumo' && n.possuiXml) return false;
      if (filtroStatusRapido === 'cancelada' && n.situacao !== 'cancelada') return false;
      if (filtroStatusRapido === 'autorizada' && n.situacao !== 'autorizada') return false;

      // 3. Somente com XML
      if (apenasComXml && !n.possuiXml) return false;

      return true;
    });
  }, [notas, abaPrincipal, filtroStatusRapido, apenasComXml]);

  // Totais
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

  // Notas selecionadas
  const notasSelecionadas = useMemo(() => {
    return notas.filter(n => selecionadas.has(n.id));
  }, [notas, selecionadas]);

  const valorSelecionadas = useMemo(() => {
    return notasSelecionadas.reduce((acc, n) => acc + (n.valorNf || 0), 0);
  }, [notasSelecionadas]);

  const idsParaCiencia = useMemo(() => {
    return notasSelecionadas.filter(podeDarCiencia).map(n => n.id);
  }, [notasSelecionadas]);

  const todasMarcadas = notasFiltradas.length > 0 && notasFiltradas.every(n => selecionadas.has(n.id));

  // Filtro de empresas para listagem
  const empresasFiltradas = useMemo(() => {
    const t = filtroEmpresaTexto.toLowerCase().trim();
    if (!t) return empresas;
    const digitos = filtroEmpresaTexto.replace(/\D/g, '');
    return empresas.filter(e =>
      e.razaoSocial.toLowerCase().includes(t) ||
      (e.nomeFantasia || '').toLowerCase().includes(t) ||
      e.cnpj.includes(t) ||
      (digitos && e.cnpj.replace(/\D/g, '').includes(digitos))
    );
  }, [empresas, filtroEmpresaTexto]);

  // Filtro de empresas para o modal de troca rápida
  const empresasModalFiltradas = useMemo(() => {
    const t = buscaModalEmpresa.toLowerCase().trim();
    if (!t) return empresas;
    const digitos = buscaModalEmpresa.replace(/\D/g, '');
    return empresas.filter(e =>
      e.razaoSocial.toLowerCase().includes(t) ||
      (e.nomeFantasia || '').toLowerCase().includes(t) ||
      e.cnpj.includes(t) ||
      (digitos && e.cnpj.replace(/\D/g, '').includes(digitos))
    );
  }, [empresas, buscaModalEmpresa]);

  // Se nenhuma empresa estiver selecionada: tela idêntica à de NFS-e
  if (!empresaIdSelecionada) {
    return (
      <div className="page-body" style={{ background: '#fdfdfd', minHeight: '100%', padding: '24px 32px' }}>
        <div
          style={{
            maxWidth: 780,
            margin: '48px auto',
            padding: '40px',
            background: '#fff',
            border: '1px solid #e5e5e5',
            borderRadius: 24,
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#600000', marginBottom: 6 }}>
                Módulo SEFAZ • NF-e Mercadorias (Destinadas & Emitidas)
              </div>
              <h3 className={serif.className} style={{ fontSize: 34, fontWeight: 400, color: '#000', margin: '0 0 6px', lineHeight: 1.1 }}>
                Escolha a empresa para consultar NF-e
              </h3>
              <p style={{ fontSize: 14, color: '#525252', margin: 0, lineHeight: 1.5 }}>
                Consulte notas destinadas (compras), notas emitidas (vendas), realize manifestação do destinatário e baixe XMLs e DANFEs.
              </p>
            </div>
            <button
              className="btn"
              style={{ background: '#600000', color: '#fff', padding: '10px 18px', borderRadius: 8, fontWeight: 500, fontSize: 13.5, border: 'none' }}
              onClick={() => setShowCadastrarCnpjModal(true)}
            >
              + Cadastrar CNPJ
            </button>
          </div>

          <div
            className="search-bar"
            style={{
              background: '#f9fafb',
              border: '1px solid #e5e5e5',
              borderRadius: 12,
              padding: '10px 14px',
              marginBottom: 16,
            }}
          >
            <Search size={16} style={{ color: '#525252' }} />
            <input
              placeholder="Pesquisar empresa por razão social, nome fantasia ou CNPJ..."
              value={filtroEmpresaTexto}
              onChange={e => setFiltroEmpresaTexto(e.target.value)}
            />
          </div>

          <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid #e5e5e5', borderRadius: 14 }}>
            {empresasFiltradas.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: '#525252', fontSize: 13.5 }}>
                {carregandoEmpresas ? 'Carregando empresas...' : 'Nenhuma empresa encontrada com os filtros informados.'}
              </div>
            ) : (
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>CNPJ</th>
                    <th>Certificado / Procuração</th>
                    <th>Notas</th>
                    <th style={{ textAlign: 'right' }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {empresasFiltradas.map(emp => (
                    <tr
                      key={emp.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setEmpresaIdSelecionada(emp.id);
                        sessionStorage.setItem('cf_nfe_empresa_id', emp.id);
                      }}
                    >
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13.5, color: '#171717' }}>{emp.razaoSocial}</div>
                        {emp.nomeFantasia && emp.nomeFantasia !== emp.razaoSocial && (
                          <div style={{ fontSize: 11.5, color: '#525252' }}>{emp.nomeFantasia}</div>
                        )}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12.5, color: '#525252' }}>{formatCnpj(emp.cnpj)}</td>
                      <td>
                        {emp.certificado === 'propria' ? (
                          <span className="badge badge-green">A1 Próprio</span>
                        ) : emp.certificado === 'escritorio' ? (
                          <span className="badge badge-green">Procuração Ativa</span>
                        ) : (
                          <span className="badge" style={{ background: '#fef2f2', color: '#991b1b' }}>Sem Certificado</span>
                        )}
                      </td>
                      <td style={{ fontSize: 13, color: '#171717', fontWeight: 600 }}>{emp.totalNotas}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ background: '#600000', borderColor: '#600000', fontSize: 12, padding: '5px 12px' }}
                          onClick={ev => {
                            ev.stopPropagation();
                            setEmpresaIdSelecionada(emp.id);
                            sessionStorage.setItem('cf_nfe_empresa_id', emp.id);
                          }}
                        >
                          Selecionar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {showCadastrarCnpjModal && (
          <CadastrarCnpjModal
            onFechar={() => setShowCadastrarCnpjModal(false)}
            onEmpresaCadastrada={carregarEmpresas}
          />
        )}
      </div>
    );
  }

  return (
    <>
      {/* =========================================================================
          PAGE HEADER NO PADRÃO EXATO DE NFSE
          ========================================================================= */}
      <div
        className="page-header"
        style={{
          background: '#fdfdfd',
          borderBottom: '1px solid #e5e5e5',
          padding: '24px 32px',
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#600000', marginBottom: 4 }}>
            SEFAZ NACIONAL • NF-E MERCADORIAS (DESTINADAS E EMITIDAS)
          </div>
          <h1 className={serif.className} style={{ fontSize: 34, fontWeight: 400, color: '#000', margin: 0, lineHeight: 1.05, letterSpacing: '-0.01em' }}>
            Notas Fiscais Destinadas
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, color: '#171717', fontWeight: 600 }}>
              {empresaAtual?.razaoSocial || empresaAtual?.nomeFantasia}
              {empresaAtual?.cnpj ? <span style={{ fontWeight: 400, color: '#525252' }}>{` · CNPJ ${formatCnpj(empresaAtual.cnpj)}`}</span> : ''}
            </div>

            <button
              type="button"
              onClick={() => {
                setBuscaModalEmpresa('');
                setShowTrocarEmpresaModal(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: '#f3f4f6',
                border: '1px solid #d4d4d8',
                color: '#171717',
                borderRadius: 99,
                padding: '3px 11px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <ArrowLeftRight size={12} /> Trocar Empresa
            </button>
          </div>
        </div>

        <div className="header-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
          <button
            className="btn btn-secondary"
            style={{ background: '#fff', border: '1px solid #e5e5e5', color: '#171717', borderRadius: 8, fontWeight: 500, fontSize: 13.5 }}
            onClick={() => setShowCadastrarCnpjModal(true)}
          >
            + Cadastrar CNPJ
          </button>

          <button
            className="btn btn-secondary"
            style={{ background: '#fff', border: '1px solid #e5e5e5', color: '#171717', borderRadius: 8, fontWeight: 500, fontSize: 13.5 }}
            onClick={() => setEmpresaCertificadoModal(empresaAtual)}
            disabled={!empresaAtual}
          >
            Certificado / Procuração
          </button>

          <button
            className="btn btn-secondary"
            style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', borderRadius: 8, fontWeight: 600, fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={handleConsultarSefaz}
            disabled={consultandoSefaz || !empresaAtual}
            title="Consulta no WebService da SEFAZ novas notas destinadas e emitidas via Distribuição DFe"
          >
            <RefreshCw size={14} className={consultandoSefaz ? 'animate-spin' : ''} />
            {consultandoSefaz ? 'Consultando SEFAZ...' : 'Consultar SEFAZ Agora'}
          </button>

          <button
            className="btn btn-secondary"
            style={{ background: '#fff', border: '1px solid #e5e5e5', color: '#171717', borderRadius: 8, fontWeight: 500, fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => handleExportar(null)}
            disabled={exportando || !empresaAtual || notas.length === 0}
          >
            <Download size={14} /> Exportar Mês (XML/PDF)
          </button>

          <button
            className="btn btn-secondary"
            style={{ background: '#fff', border: '1px solid #e5e5e5', color: '#171717', borderRadius: 8, fontWeight: 500, fontSize: 13.5 }}
            onClick={() => setShowImportarModal(true)}
            disabled={!empresaAtual}
          >
            Importar XMLs
          </button>

          <button
            className="btn btn-secondary"
            style={{ background: '#fff', border: '1px solid #e5e5e5', color: '#171717', borderRadius: 8, fontWeight: 500, fontSize: 13.5 }}
            onClick={() => setShowDifalModal(true)}
            disabled={!empresaAtual}
          >
            Relatório DIFAL
          </button>

          <button
            className="btn btn-secondary"
            style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1', borderRadius: 8, fontWeight: 600, fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => setShowCndModal(true)}
            title="Gerar Relatório de Situação Fiscal Federal (SITFIS / CND)"
          >
            🏛️ Situação Federal
          </button>
        </div>
      </div>

      {/* =========================================================================
          CORPO DA PÁGINA
          ========================================================================= */}
      <div className="page-body" style={{ background: '#fdfdfd', minHeight: '100%', padding: '24px 32px' }}>
        {/* Faixa de Situação do Certificado e Monitoramento */}
        {empresaAtual && (
          <div
            style={{
              background: '#fff',
              border: '1px solid #e5e5e5',
              borderLeft: `3px solid ${empresaAtual.certificado !== 'ausente' ? '#15803d' : '#b45309'}`,
              borderRadius: 12,
              padding: '12px 18px',
              marginBottom: 24,
              fontSize: 13.5,
              color: '#525252',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <strong style={{ color: '#171717' }}>
                {empresaAtual.certificado === 'propria'
                  ? `Certificado A1 Próprio (válido até ${formatData(empresaAtual.certValidoAte)})`
                  : empresaAtual.certificado === 'escritorio'
                  ? 'Consulta por Procuração Eletrônica do Escritório'
                  : 'Certificado Digital não configurado para este CNPJ'}
              </strong>
              {' — '}
              <span>
                {monitorAtual?.ativo !== false ? 'Auto-monitoramento ativo' : 'Auto-monitoramento pausado'}
                {monitorAtual?.apenasNoturno ? ' (somente no período noturno 22h–05h)' : ' (contínuo 24h)'}.
              </span>
              {monitorAtual?.ultimaConsultaEm && (
                <span style={{ fontSize: 12, color: '#6b7280' }}>
                  Última sincronização SEFAZ: {new Date(monitorAtual.ultimaConsultaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#374151', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={monitorAtual?.ativo !== false}
                  onChange={e => handleToggleMonitor(empresaAtual.id, e.target.checked)}
                  style={{ cursor: 'pointer', accentColor: '#15803d' }}
                />
                <span>Auto-Monitor</span>
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#374151', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={monitorAtual?.apenasNoturno ?? false}
                  onChange={e => handleToggleNoturno(empresaAtual.id, e.target.checked)}
                  style={{ cursor: 'pointer', accentColor: '#6366f1' }}
                />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Moon size={11} color="#6366f1" /> Noturno
                </span>
              </label>
            </div>
          </div>
        )}

        {/* 4 Cards de KPIs no Padrão Editorial da NFS-e */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.35fr repeat(3, 1fr)',
            gap: 20,
            marginBottom: 24,
          }}
        >
          {/* Card 1: Escuro */}
          <div
            style={{
              background: '#0a0a0a',
              color: '#fff',
              padding: '26px 30px',
              borderRadius: 20,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11.5, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500 }}>
              Notas Recebidas (Compras)
            </span>
            <div className={serif.className} style={{ fontSize: 38, fontWeight: 400, margin: '8px 0 4px', lineHeight: 1 }}>
              {fmt.currency(totais.valorRecebidas)}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              {totais.qtdRecebidas} nota(s) destinadas de fornecedores
            </div>
          </div>

          {/* Card 2: Branco */}
          <div
            style={{
              background: '#fff',
              border: '1px solid #e5e5e5',
              padding: '26px 26px',
              borderRadius: 20,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ color: '#525252', fontSize: 11.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
              Notas Emitidas (Vendas)
            </span>
            <div className={serif.className} style={{ fontSize: 34, fontWeight: 400, color: '#171717', margin: '8px 0 4px', lineHeight: 1 }}>
              {fmt.currency(totais.valorEmitidas)}
            </div>
            <div style={{ fontSize: 13, color: '#525252' }}>
              {totais.qtdEmitidas} nota(s) faturadas pelo CNPJ
            </div>
          </div>

          {/* Card 3: Branco */}
          <div
            style={{
              background: '#fff',
              border: '1px solid #e5e5e5',
              padding: '26px 26px',
              borderRadius: 20,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ color: '#525252', fontSize: 11.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
              Com XML Completo
            </span>
            <div className={serif.className} style={{ fontSize: 34, fontWeight: 400, color: '#171717', margin: '8px 0 4px', lineHeight: 1 }}>
              {totais.comXmlCount}
            </div>
            <div style={{ fontSize: 13, color: '#525252' }}>
              {totais.apenasResumo > 0 ? `${totais.apenasResumo} em formato de resumo SEFAZ` : 'Todos com arquivo XML baixado'}
            </div>
          </div>

          {/* Card 4: Branco */}
          <div
            style={{
              background: '#fff',
              border: '1px solid #e5e5e5',
              padding: '26px 26px',
              borderRadius: 20,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ color: '#525252', fontSize: 11.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
              Total Movimentado
            </span>
            <div className={serif.className} style={{ fontSize: 34, fontWeight: 400, color: '#171717', margin: '8px 0 4px', lineHeight: 1 }}>
              {fmt.currency(totais.valorTotal)}
            </div>
            <div style={{ fontSize: 13, color: '#525252' }}>
              {totais.quantidade} documento(s) fiscal(is) no período
            </div>
          </div>
        </div>

        {/* Seletor de Abas Principal (Estilo Píldora da NFS-e) */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #e5e5e5',
            borderRadius: 16,
            padding: '14px 18px',
            marginBottom: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14,
          }}
        >
          <div style={{ display: 'inline-flex', background: '#f3f4f6', padding: 4, borderRadius: 12, gap: 4 }}>
            <button
              type="button"
              onClick={() => { setAbaPrincipal('recebidas'); setFiltroStatusRapido('todas'); }}
              style={{
                background: abaPrincipal === 'recebidas' ? '#600000' : 'transparent',
                color: abaPrincipal === 'recebidas' ? '#fff' : '#374151',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 9,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Notas Recebidas — Compras ({totais.qtdRecebidas})
            </button>
            <button
              type="button"
              onClick={() => { setAbaPrincipal('emitidas'); setFiltroStatusRapido('todas'); }}
              style={{
                background: abaPrincipal === 'emitidas' ? '#600000' : 'transparent',
                color: abaPrincipal === 'emitidas' ? '#fff' : '#374151',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 9,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Notas Emitidas — Vendas ({totais.qtdEmitidas})
            </button>
            <button
              type="button"
              onClick={() => { setAbaPrincipal('todas'); setFiltroStatusRapido('todas'); }}
              style={{
                background: abaPrincipal === 'todas' ? '#600000' : 'transparent',
                color: abaPrincipal === 'todas' ? '#fff' : '#374151',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 9,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Todas as Notas ({totais.quantidade})
            </button>
            <button
              type="button"
              onClick={() => setAbaPrincipal('carteira')}
              style={{
                background: abaPrincipal === 'carteira' ? '#600000' : 'transparent',
                color: abaPrincipal === 'carteira' ? '#fff' : '#374151',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 9,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Carteira de Empresas ({empresas.length})
            </button>
          </div>

          {/* Filtros de Data e Competência */}
          {abaPrincipal !== 'carteira' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#525252', fontWeight: 600 }}>Mês:</span>
                <input
                  type="month"
                  value={mesFiltro}
                  onChange={e => { setMesFiltro(e.target.value); setDataInicio(''); setDataFim(''); }}
                  style={{
                    padding: '6px 10px',
                    fontSize: 13,
                    border: '1px solid #d4d4d8',
                    borderRadius: 8,
                    background: '#fff',
                    outline: 'none',
                  }}
                />
              </div>

              {(mesFiltro || dataInicio || dataFim || busca || situacaoFiltro) && (
                <button
                  type="button"
                  onClick={() => { setMesFiltro(''); setDataInicio(''); setDataFim(''); setBusca(''); setSituacaoFiltro(''); }}
                  style={{
                    fontSize: 12,
                    color: '#600000',
                    background: 'transparent',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </div>

        {/* =========================================================================
            VISÃO 1: NOTAS FISCAIS (RECEBIDAS, EMITIDAS OU TODAS)
            ========================================================================= */}
        {abaPrincipal !== 'carteira' ? (
          <>
            {/* Barra de Busca e Filtros Rápidos de Status */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
              <div
                className="search-bar"
                style={{
                  flex: 1,
                  minWidth: 260,
                  background: '#fff',
                  border: '1px solid #e5e5e5',
                  borderRadius: 12,
                  padding: '9px 14px',
                }}
              >
                <Search size={16} style={{ color: '#525252' }} />
                <input
                  placeholder="Buscar por fornecedor, cliente, chave de acesso, número da NF-e..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                />
              </div>

              <div
                style={{
                  background: '#f0f0f2',
                  padding: 4,
                  borderRadius: 99,
                  display: 'inline-flex',
                  gap: 4,
                  border: '1px solid #e5e5e5',
                }}
              >
                {[
                  { key: 'todas', label: `Todas (${notas.filter(n => abaPrincipal === 'todas' || (abaPrincipal === 'recebidas' ? n.papel !== 'emitida' : n.papel === 'emitida')).length})` },
                  { key: 'xml', label: `Com XML (${notas.filter(n => n.possuiXml && (abaPrincipal === 'todas' || (abaPrincipal === 'recebidas' ? n.papel !== 'emitida' : n.papel === 'emitida'))).length})` },
                  { key: 'resumo', label: `Em Resumo (${notas.filter(n => !n.possuiXml && (abaPrincipal === 'todas' || (abaPrincipal === 'recebidas' ? n.papel !== 'emitida' : n.papel === 'emitida'))).length})` },
                  { key: 'cancelada', label: 'Canceladas' },
                ].map(item => {
                  const ativo = filtroStatusRapido === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setFiltroStatusRapido(item.key)}
                      style={{
                        background: ativo ? '#fff' : 'transparent',
                        color: ativo ? '#000' : '#525252',
                        border: 'none',
                        padding: '8px 18px',
                        borderRadius: 99,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: ativo ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Barra de Ações em Lote quando há seleção */}
            {selecionadas.size > 0 && (
              <div
                style={{
                  padding: '14px 20px',
                  marginBottom: 20,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  background: '#fff',
                  border: '1px solid #171717',
                  borderRadius: 14,
                }}
              >
                <span style={{ fontSize: 13.5, color: '#171717' }}>
                  <strong>{selecionadas.size}</strong> nota(s) selecionada(s) —{' '}
                  <strong>{fmt.currency(valorSelecionadas)}</strong>
                </span>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <select
                    className="form-control"
                    aria-label="Formato da exportação"
                    style={{ width: 'auto', fontSize: 13, padding: '7px 10px' }}
                    value={formatoExportacao}
                    onChange={e => setFormatoExportacao(e.target.value as any)}
                    disabled={exportando}
                  >
                    <option value="ambos">PDF e XML (ZIP)</option>
                    <option value="pdf">Só PDF (ZIP)</option>
                    <option value="xml">Só XML (ZIP)</option>
                    <option value="pdf_unico">Um único PDF</option>
                  </select>

                  <button
                    className="btn btn-secondary"
                    style={{ background: '#fff', border: '1px solid #e5e5e5', color: '#171717', borderRadius: 8, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={() => handleExportar(Array.from(selecionadas))}
                    disabled={exportando}
                  >
                    <Download size={13} />
                    {exportando ? 'Exportando...' : `Baixar (${selecionadas.size})`}
                  </button>

                  {idsParaCiencia.length > 0 && (
                    <button
                      className="btn"
                      style={{ background: '#600000', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 500, padding: '8px 16px', fontSize: 13 }}
                      onClick={() => handleDarCiencia(idsParaCiencia)}
                      disabled={manifestando}
                    >
                      {manifestando ? 'Registrando...' : `Dar Ciência nas Selecionadas (${idsParaCiencia.length})`}
                    </button>
                  )}

                  <button
                    className="btn btn-secondary"
                    style={{ background: '#fff', border: '1px solid #e5e5e5', color: '#525252', borderRadius: 8, fontSize: 13 }}
                    onClick={() => setSelecionadas(new Set())}
                  >
                    Limpar seleção
                  </button>
                </div>
              </div>
            )}

            {/* Tabela Principal de Notas */}
            <div
              style={{
                background: '#fff',
                border: '1px solid #e5e5e5',
                borderRadius: 20,
                overflow: 'hidden',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
              }}
            >
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}>
                        <input
                          type="checkbox"
                          aria-label="Selecionar todas as notas"
                          title="Selecionar todas as notas filtradas"
                          disabled={notasFiltradas.length === 0}
                          checked={todasMarcadas}
                          onChange={e => setSelecionadas(e.target.checked ? new Set(notasFiltradas.map(n => n.id)) : new Set())}
                        />
                      </th>
                      <th>Número</th>
                      <th>Emissão</th>
                      <th>Contraparte</th>
                      <th>Operação</th>
                      <th>Manifestação SEFAZ</th>
                      <th>Situação</th>
                      <th style={{ textAlign: 'right' }}>Valor Total</th>
                      <th style={{ textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carregandoNotas ? (
                      <tr>
                        <td colSpan={9} style={{ padding: '48px 24px', textAlign: 'center', color: '#525252' }}>
                          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px', color: '#600000' }} />
                          Carregando documentos fiscais da SEFAZ...
                        </td>
                      </tr>
                    ) : notasFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan={9}>
                          <div style={{ padding: '56px 24px', textAlign: 'center' }}>
                            <h3 className={serif.className} style={{ fontSize: 26, fontWeight: 400, color: '#171717', marginBottom: 6 }}>
                              Nenhuma nota fiscal encontrada neste filtro
                            </h3>
                            <p style={{ fontSize: 14, color: '#525252', margin: 0 }}>
                              Clique em &quot;Consultar SEFAZ Agora&quot; no topo ou ajuste o filtro de data e busca.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      notasFiltradas.map(n => {
                        const ehEmitida = n.papel === 'emitida';
                        const contraparteNome = ehEmitida ? (n.destinatarioNome || 'Destinatário não informado') : n.emitenteNome;
                        const contraparteDoc = ehEmitida ? n.destinatarioCnpj : n.emitenteCnpj;
                        const manif = labelManifestacao(n.situacaoManifestacao);

                        return (
                          <tr key={n.id} style={{ opacity: n.situacao === 'cancelada' ? 0.6 : 1 }}>
                            <td>
                              <input
                                type="checkbox"
                                aria-label={`Selecionar nota ${n.numero}`}
                                checked={selecionadas.has(n.id)}
                                onChange={() => alternarSelecao(n.id)}
                              />
                            </td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13.5, color: '#171717' }}>
                              {n.numero || '—'} {n.serie ? `(Série ${n.serie})` : ''}
                            </td>
                            <td style={{ fontSize: 13, whiteSpace: 'nowrap', color: '#525252' }}>
                              {formatData(n.dataEmissao)}
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, color: '#171717', fontSize: 13.5 }}>{contraparteNome}</div>
                              {contraparteDoc && (
                                <div style={{ fontSize: 11.5, fontFamily: 'monospace', color: '#6b7280' }}>
                                  {formatCnpj(contraparteDoc)}
                                </div>
                              )}
                            </td>
                            <td>
                              {ehEmitida ? (
                                <span className="badge badge-purple" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <ArrowUpRight size={11} /> Emitida (Venda)
                                </span>
                              ) : (
                                <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <ArrowDownLeft size={11} /> Recebida (Compra)
                                </span>
                              )}
                            </td>
                            <td>
                              <span className={`badge ${manif.classe}`}>{manif.rotulo}</span>
                            </td>
                            <td>
                              {n.situacao === 'autorizada' ? (
                                <span className="badge badge-green">Autorizada</span>
                              ) : n.situacao === 'cancelada' ? (
                                <span className="badge badge-red">Cancelada</span>
                              ) : (
                                <span className="badge badge-yellow">{n.situacao}</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13.5, color: '#171717' }}>
                              {fmt.currency(n.valorNf)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                                {podeDarCiencia(n) && (
                                  <button
                                    type="button"
                                    onClick={() => manifestarNota(n.chaveAcesso, '210210')}
                                    className="btn btn-secondary btn-sm"
                                    style={{ background: '#fdfdfd', border: '1px solid #d4d4d8', fontSize: 11.5, padding: '3px 8px', color: '#1d4ed8' }}
                                    title="Dar Ciência da Operação para liberar XML completo"
                                  >
                                    Ciência
                                  </button>
                                )}

                                {n.possuiXml ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleBaixarXml(n.id, n.numero)}
                                      className="btn btn-secondary btn-sm"
                                      style={{ background: '#fff', border: '1px solid #e5e5e5', fontSize: 11.5, padding: '3px 8px' }}
                                      title="Baixar arquivo XML"
                                    >
                                      XML
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAbrirPdf(n.id)}
                                      className="btn btn-secondary btn-sm"
                                      style={{ background: '#fff', border: '1px solid #e5e5e5', fontSize: 11.5, padding: '3px 8px' }}
                                      title="Visualizar ou Imprimir DANFE (PDF)"
                                    >
                                      PDF
                                    </button>
                                  </>
                                ) : (
                                  <span style={{ fontSize: 11, color: '#9ca3af' }}>Só Resumo</span>
                                )}

                                <button
                                  type="button"
                                  onClick={() => setNotaDetalhe(n)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ background: '#fff', border: '1px solid #e5e5e5', fontSize: 11.5, padding: '3px 8px' }}
                                  title="Ver detalhes da nota e chave de acesso"
                                >
                                  Ver
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
            </div>
          </>
        ) : (
          /* =========================================================================
             VISÃO 2: CARTEIRA DE EMPRESAS (MONITORADAS)
             ========================================================================= */
          <div
            style={{
              background: '#fff',
              border: '1px solid #e5e5e5',
              borderRadius: 20,
              padding: 24,
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
              <div>
                <h3 className={serif.className} style={{ fontSize: 26, fontWeight: 400, color: '#171717', margin: '0 0 4px' }}>
                  Carteira de Clientes & Empresas Monitoradas
                </h3>
                <p style={{ fontSize: 13, color: '#525252', margin: 0 }}>
                  Acompanhe a situação do certificado A1, procuração eletrônica e auto-monitoramento de todas as empresas cadastradas.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div
                  className="search-bar"
                  style={{
                    background: '#f9fafb',
                    border: '1px solid #e5e5e5',
                    borderRadius: 10,
                    padding: '8px 12px',
                    width: 280,
                  }}
                >
                  <Search size={14} style={{ color: '#525252' }} />
                  <input
                    placeholder="Filtrar por nome ou CNPJ..."
                    value={filtroEmpresaTexto}
                    onChange={e => setFiltroEmpresaTexto(e.target.value)}
                  />
                </div>

                <button
                  className="btn"
                  style={{ background: '#600000', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 500 }}
                  onClick={() => setShowCadastrarCnpjModal(true)}
                >
                  + Cadastrar CNPJ
                </button>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>CNPJ</th>
                    <th>Certificado / Procuração</th>
                    <th>Auto-Monitor</th>
                    <th>Janela Noturna</th>
                    <th>Notas</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {empresasFiltradas.map(emp => (
                    <tr key={emp.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13.5, color: '#171717' }}>{emp.razaoSocial}</div>
                        {emp.nomeFantasia && emp.nomeFantasia !== emp.razaoSocial && (
                          <div style={{ fontSize: 11.5, color: '#525252' }}>{emp.nomeFantasia}</div>
                        )}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12.5, color: '#525252' }}>{formatCnpj(emp.cnpj)}</td>
                      <td>
                        {emp.certificado === 'propria' ? (
                          <span className="badge badge-green">A1 Próprio ({formatData(emp.certValidoAte)})</span>
                        ) : emp.certificado === 'escritorio' ? (
                          <span className="badge badge-green">Procuração Ativa</span>
                        ) : (
                          <span className="badge badge-red">Sem Certificado</span>
                        )}
                      </td>
                      <td>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12.5 }}>
                          <input
                            type="checkbox"
                            checked={emp.monitor?.ativo !== false}
                            onChange={e => handleToggleMonitor(emp.id, e.target.checked)}
                            style={{ cursor: 'pointer', accentColor: '#15803d' }}
                          />
                          <span>{emp.monitor?.ativo !== false ? 'Ativo' : 'Pausado'}</span>
                        </label>
                      </td>
                      <td>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12.5 }}>
                          <input
                            type="checkbox"
                            checked={emp.monitor?.apenasNoturno ?? false}
                            onChange={e => handleToggleNoturno(emp.id, e.target.checked)}
                            style={{ cursor: 'pointer', accentColor: '#6366f1' }}
                          />
                          <span>{emp.monitor?.apenasNoturno ? '22h–05h' : '24h'}</span>
                        </label>
                      </td>
                      <td style={{ fontWeight: 600, fontSize: 13.5, color: '#171717' }}>{emp.totalNotas}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ background: '#600000', borderColor: '#600000', fontSize: 12, padding: '4px 10px' }}
                            onClick={() => {
                              setEmpresaIdSelecionada(emp.id);
                              sessionStorage.setItem('cf_nfe_empresa_id', emp.id);
                              setAbaPrincipal('recebidas');
                            }}
                          >
                            Acessar Notas
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 12, padding: '4px 8px' }}
                            onClick={() => setEmpresaCertificadoModal(emp)}
                          >
                            Certificado
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          MODAIS INTEGRADOS (COM PROTEÇÃO CONTRA CLIQUE FORA)
          ========================================================================= */}

      {/* MODAL DE DETALHES DA NOTA */}
      {notaDetalhe && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 9999 }}>
          <div className="modal" style={{ maxWidth: 640, width: '95%', background: '#ffffff', borderRadius: 16, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafafa' }}>
              <div>
                <h3 className={serif.className} style={{ fontSize: 24, fontWeight: 400, color: '#111827', margin: 0 }}>
                  NF-e {notaDetalhe.numero || 'Sem número'} {notaDetalhe.serie ? `(Série ${notaDetalhe.serie})` : ''}
                </h3>
                <span style={{ fontSize: 12, color: '#525252' }}>
                  Detalhes do Documento Fiscal Eletrônico
                </span>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setNotaDetalhe(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, color: '#525252' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 24 }}>
              {/* Chave de Acesso */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#525252', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Chave de Acesso (44 dígitos)
                </label>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#f9fafb', padding: '10px 14px', borderRadius: 8,
                  border: '1px solid #e5e5e5', marginTop: 4
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

              {/* Informações da Nota */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Emitente (Fornecedor)</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginTop: 2 }}>{notaDetalhe.emitenteNome}</div>
                  <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#6b7280' }}>CNPJ: {formatCnpj(notaDetalhe.emitenteCnpj)}</div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Valor Total da NF</div>
                  <div className={serif.className} style={{ fontSize: 28, fontWeight: 400, color: '#16a34a', marginTop: 2 }}>
                    {fmt.currency(notaDetalhe.valorNf)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Data de Emissão</div>
                  <div style={{ fontSize: 13.5, color: '#111827', marginTop: 2 }}>{formatData(notaDetalhe.dataEmissao)}</div>
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

              {/* Ações dentro do modal */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid #e5e5e5' }}>
                {notaDetalhe.possuiXml ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleBaixarXml(notaDetalhe.id, notaDetalhe.numero)}
                      className="btn btn-secondary"
                      style={{ fontSize: 13 }}
                    >
                      <Download size={13} style={{ marginRight: 6 }} /> Baixar XML
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAbrirPdf(notaDetalhe.id)}
                      className="btn btn-secondary"
                      style={{ fontSize: 13 }}
                    >
                      <FileText size={13} style={{ marginRight: 6 }} /> Visualizar DANFE (PDF)
                    </button>
                  </>
                ) : (
                  podeDarCiencia(notaDetalhe) && (
                    <button
                      type="button"
                      onClick={() => {
                        manifestarNota(notaDetalhe.chaveAcesso, '210210');
                        setNotaDetalhe(null);
                      }}
                      className="btn"
                      style={{ background: '#600000', color: '#fff', fontSize: 13 }}
                    >
                      Dar Ciência da Operação
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() => setNotaDetalhe(null)}
                  className="btn btn-secondary"
                  style={{ fontSize: 13 }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Certificado Digital */}
      {empresaCertificadoModal && (
        <NfeCertificadoModal
          empresaId={empresaCertificadoModal.id}
          empresaNome={empresaCertificadoModal.razaoSocial}
          empresaCnpj={empresaCertificadoModal.cnpj}
          onClose={() => setEmpresaCertificadoModal(null)}
          onAtualizado={carregarEmpresas}
        />
      )}

      {/* Modal de Situação Federal / CND */}
      {showCndModal && empresaAtual && (
        <CertidaoFederalModal
          empresaIdInicial={empresaAtual.id}
          empresas={empresas.map(e => ({ id: e.id, nome: e.razaoSocial, cnpj: e.cnpj }))}
          onFechar={() => setShowCndModal(false)}
        />
      )}

      {/* Modal DIFAL */}
      {showDifalModal && empresaAtual && (
        <NfeDifalModal
          empresaId={empresaAtual.id}
          empresaNome={empresaAtual.razaoSocial}
          cnpj={empresaAtual.cnpj}
          onClose={() => setShowDifalModal(false)}
        />
      )}

      {/* Modal API de Integração */}
      {showIntegracaoModal && empresaAtual && (
        <NfeIntegracaoModal
          empresaId={empresaAtual.id}
          empresaNome={empresaAtual.razaoSocial}
          cnpj={empresaAtual.cnpj}
          onClose={() => setShowIntegracaoModal(false)}
        />
      )}

      {/* Modal Importação de XMLs */}
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

      {/* Modal de Trocar Empresa */}
      {showTrocarEmpresaModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            className="modal"
            style={{
              maxWidth: 820,
              width: '100%',
              background: '#fff',
              borderRadius: 20,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              border: '1px solid #e5e5e5',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
            }}
          >
            {/* Header do Modal */}
            <div
              style={{
                padding: '24px 28px 20px',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#600000', marginBottom: 4 }}>
                  Módulo Fiscal • Carteira SEFAZ
                </div>
                <h3 className={serif.className} style={{ fontSize: 28, fontWeight: 400, color: '#000', margin: '0 0 4px', lineHeight: 1.1 }}>
                  Escolha a Empresa para Operar NF-e
                </h3>
                <p style={{ fontSize: 13, color: '#525252', margin: 0 }}>
                  Selecione qualquer cliente cadastrado para consultar notas destinadas (compras), emitidas (vendas) e manifestação.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTrocarEmpresaModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer',
                  color: '#9ca3af',
                  padding: 4,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Barra de Busca */}
            <div style={{ padding: '16px 28px 12px', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
              <div
                className="search-bar"
                style={{
                  background: '#fff',
                  border: '1px solid #e5e5e5',
                  borderRadius: 12,
                  padding: '9px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Search size={16} style={{ color: '#525252', flexShrink: 0 }} />
                <input
                  placeholder="Pesquisar por razão social, nome fantasia ou CNPJ..."
                  value={buscaModalEmpresa}
                  onChange={e => setBuscaModalEmpresa(e.target.value)}
                  style={{ border: 'none', outline: 'none', width: '100%', fontSize: 13.5 }}
                  autoFocus
                />
                {buscaModalEmpresa && (
                  <button
                    type="button"
                    onClick={() => setBuscaModalEmpresa('')}
                    style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 12 }}
                  >
                    Limpar
                  </button>
                )}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#71717a', display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  {empresasModalFiltradas.length} empresa(s) encontrada(s)
                </span>
                {empresaAtual && (
                  <span>
                    Empresa selecionada: <strong>{empresaAtual.razaoSocial}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Lista / Tabela de Empresas */}
            <div style={{ padding: '0 28px', overflowY: 'auto', flex: 1, maxHeight: 420 }}>
              {empresasModalFiltradas.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#525252', fontSize: 13.5 }}>
                  Nenhuma empresa encontrada com os termos digitados.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1, borderBottom: '1px solid #e5e5e5' }}>
                    <tr>
                      <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: '#525252', textTransform: 'uppercase' }}>Empresa</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: '#525252', textTransform: 'uppercase' }}>CNPJ</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: '#525252', textTransform: 'uppercase' }}>Certificado</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: '#525252', textTransform: 'uppercase' }}>Notas</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: 11.5, fontWeight: 600, color: '#525252', textTransform: 'uppercase' }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empresasModalFiltradas.slice(0, 100).map(emp => {
                      const isAtual = emp.id === empresaIdSelecionada;
                      return (
                        <tr
                          key={emp.id}
                          style={{
                            borderBottom: '1px solid #f4f4f5',
                            cursor: 'pointer',
                            background: isAtual ? '#f0fdf4' : 'transparent',
                          }}
                          onClick={() => {
                            setEmpresaIdSelecionada(emp.id);
                            sessionStorage.setItem('cf_nfe_empresa_id', emp.id);
                            setShowTrocarEmpresaModal(false);
                            carregarNotas(emp.id);
                          }}
                        >
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 600, fontSize: 13.5, color: '#171717' }}>{emp.razaoSocial}</span>
                              {isAtual && <span className="badge badge-green" style={{ fontSize: 10, padding: '2px 6px' }}>Atual</span>}
                            </div>
                            {emp.nomeFantasia && emp.nomeFantasia !== emp.razaoSocial && (
                              <div style={{ fontSize: 11.5, color: '#525252' }}>{emp.nomeFantasia}</div>
                            )}
                          </td>
                          <td style={{ padding: '12px 8px', fontFamily: 'monospace', fontSize: 12, color: '#525252' }}>
                            {formatCnpj(emp.cnpj)}
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            {emp.certificado === 'propria' ? (
                              <span className="badge badge-green" style={{ fontSize: 11 }}>A1 Próprio</span>
                            ) : emp.certificado === 'escritorio' ? (
                              <span className="badge badge-green" style={{ fontSize: 11 }}>Procuração</span>
                            ) : (
                              <span className="badge" style={{ background: '#fef2f2', color: '#991b1b', fontSize: 11 }}>Sem Certificado</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 8px', fontSize: 13, color: '#171717', fontWeight: 600 }}>
                            {emp.totalNotas}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{
                                background: isAtual ? '#15803d' : '#600000',
                                borderColor: isAtual ? '#15803d' : '#600000',
                                fontSize: 12,
                                padding: '4px 12px',
                              }}
                              onClick={ev => {
                                ev.stopPropagation();
                                setEmpresaIdSelecionada(emp.id);
                                sessionStorage.setItem('cf_nfe_empresa_id', emp.id);
                                setShowTrocarEmpresaModal(false);
                                carregarNotas(emp.id);
                              }}
                            >
                              {isAtual ? 'Selecionada' : 'Selecionar'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer do Modal */}
            <div
              style={{
                padding: '16px 28px',
                borderTop: '1px solid #f0f0f0',
                background: '#fafafa',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                style={{ background: '#fff', border: '1px solid #e5e5e5', fontSize: 13 }}
                onClick={() => {
                  setShowTrocarEmpresaModal(false);
                  setShowCadastrarCnpjModal(true);
                }}
              >
                + Cadastrar Novo CNPJ
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{ background: '#fff', border: '1px solid #d4d4d8', fontSize: 13 }}
                onClick={() => setShowTrocarEmpresaModal(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cadastro de CNPJ / Importação de Carteira */}
      {showCadastrarCnpjModal && (
        <CadastrarCnpjModal
          onFechar={() => setShowCadastrarCnpjModal(false)}
          onEmpresaCadastrada={carregarEmpresas}
        />
      )}
    </>
  );
}
