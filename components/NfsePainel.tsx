'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  store, type NfsE, type Cliente, type Empresa, type Portador, type PlanoConta, uid,
} from '../lib/store';
import { fmt } from '../lib/reports';
import { toast } from 'sonner';
import { confirmAsync } from './ConfirmProvider';
import NfseConfigModal, { type NfseConfigResposta } from './NfseConfigModal';
import NfseEmissoresModal, { type EmpresaEmissora } from './NfseEmissoresModal';
import NfseAcessoClienteModal from './NfseAcessoClienteModal';
import { formatarCnpj } from '../lib/nfse/emissor';
import { useAcessoNfse, type EmpresaLiberada } from '../lib/nfse/use-acesso-nfse';
import NfseCopiarModal from './NfseCopiarModal';
import NfseImportarModal from './NfseImportarModal';
import NfseFinanceiroCampos, { financeiroInvalido, type FinanceiroNota } from './NfseFinanceiroCampos';
import { MOTIVOS_CANCELAMENTO, apenasDigitos, cnpjValido, enderecoTomadorCompleto, exigeAliquotaNaDps, hojeBrasilia } from '../lib/nfse/dps';
import { estimarValoresNota, type DadosCopiaveis } from '../lib/nfse/lote';
import NfseServicoPicker from './NfseServicoPicker';
import type { CnaeEmpresa } from '../lib/nfse/cnae-servicos';
import NfseBuscarNotasModal from './NfseBuscarNotasModal';
import CertidaoFederalModal from './CertidaoFederalModal';
import { Instrument_Serif } from 'next/font/google';
import { Search, Download, FileCode, FileText, ArrowLeftRight, RefreshCw, Sparkles } from 'lucide-react';
import {
  SEM_RETENCAO, TRIBUTOS_RETIDOS, calcularRetidos, escolherRegra, percentuaisDosValores, totalRetidoFederal, type ValoresRetidos,
} from '../lib/nfse/retencao';

const serif = Instrument_Serif({ subsets: ['latin'], weight: ['400'] });

type ModalMode = 'novo' | 'ver' | null;
type PapelFiltro = 'prestadas' | 'tomadas';

type ResultadoEnvio =
  | { resultado: 'autorizada'; nota: NfsE; recuperada: boolean; alertas: string[] }
  | { resultado: 'rejeitada' | 'incerta'; mensagem: string };

const secaoStyle = { background: 'var(--bg-card2)', borderRadius: 8, padding: 14, marginBottom: 16, border: '1px solid var(--border-light)' };

const AVISO_FALE_COM_ESCRITORIO = 'O escritório ainda precisa concluir a configuração desta empresa para emitir.';

// A tela de NFS-e opera de forma independente da empresa global selecionada no sistema.
const CHAVE_EMISSOR_NFSE = 'cf_nfse_emissor_proprio';

type EmpresaNfseSelecionada = Pick<Empresa, 'id' | 'razaoSocial' | 'nomeFantasia' | 'cnpj'>;

function lerEmissorProprio(): EmpresaNfseSelecionada | null {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE_EMISSOR_NFSE) || 'null');
  } catch {
    return null;
  }
}

// Notas anteriores à integração foram geradas pela simulação: nunca passaram pelo Sefin.
const ehSimulada = (n: NfsE) => n.status !== 'rascunho' && !n.chaveAcesso;

/**
 * Cartão de resumo no mesmo padrão do Dashboard Fiscal / NF-e Destinadas:
 * rótulo em caixa alta, número em sans-serif e, se clicável, filtra a lista ao ser pressionado.
 */
function CartaoResumoNfse({ rotulo, valor, sub, acento, badge, onClick }: {
  rotulo: string;
  valor: string | number;
  sub: string;
  acento?: string;
  badge?: { texto: string; cor: string; fundo: string } | null;
  onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);
  const interativo = !!onClick;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role={interativo ? 'button' : undefined}
      tabIndex={interativo ? 0 : undefined}
      onKeyDown={e => { if (interativo && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick!(); } }}
      style={{
        background: '#fff',
        border: `1px solid ${hover && interativo ? '#d1d5db' : '#e5e7eb'}`,
        borderRadius: 16,
        padding: 20,
        boxShadow: hover && interativo ? '0 12px 24px -8px rgba(0,0,0,0.12)' : '0 2px 4px rgba(0,0,0,0.02)',
        transform: hover && interativo ? 'translateY(-3px)' : 'none',
        transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
        cursor: interativo ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{rotulo}</span>
        {badge && (
          <span style={{ background: badge.fundo, color: badge.cor, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>{badge.texto}</span>
        )}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: acento || '#111827', lineHeight: 1.1 }}>{valor}</div>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{sub}</div>
    </div>
  );
}

function ehNotaTomada(n: NfsE, cnpjEmpresa: string): boolean {
  if (n.status === 'rascunho') return false;
  const cnpjEmp = apenasDigitos(cnpjEmpresa || '');
  const cnpjPrest = apenasDigitos(n.prestadorCnpj || '');
  if (!cnpjEmp || !cnpjPrest) return false;
  return cnpjPrest !== cnpjEmp;
}

/** Tela de NFS-e independente da empresa selecionada no restante do sistema. */
export default function NfsePainel({ modoCliente = false }: { modoCliente?: boolean }) {
  const [empresaId, setEmpresaId] = useState('');
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [empresasDisponiveis, setEmpresasDisponiveis] = useState<EmpresaEmissora[]>([]);
  const [buscaEmpresaRapida, setBuscaEmpresaRapida] = useState('');
  const [nfseList, setNfseList] = useState<NfsE[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [portadores, setPortadores] = useState<Portador[]>([]);
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [viewItem, setViewItem] = useState<NfsE | null>(null);

  // Filtros de visualização das notas já processadas em tela
  const [papelFiltro, setPapelFiltro] = useState<PapelFiltro>('prestadas');
  const [search, setSearch] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<'' | 'rascunho' | 'emitida' | 'cancelada'>('');
  const [mesFiltro, setMesFiltro] = useState<string>('');
  const [dataInicioFiltro, setDataInicioFiltro] = useState<string>('');
  const [dataFimFiltro, setDataFimFiltro] = useState<string>('');

  // Modal de exportação mensal (XML / PDF)
  const [showExportarModal, setShowExportarModal] = useState(false);
  const [mesExportacao, setMesExportacao] = useState<string>(hojeBrasilia().slice(0, 7));
  const [papelExportacao, setPapelExportacao] = useState<'prestadas' | 'tomadas' | 'todas'>('prestadas');
  const [formatoExportacao, setFormatoExportacao] = useState<'ambos' | 'xml' | 'pdf' | 'pdf_unico'>('ambos');
  const [incluirCanceladasExport, setIncluirCanceladasExport] = useState(false);
  const [exportando, setExportando] = useState(false);

  const [config, setConfig] = useState<NfseConfigResposta | null>(null);
  const [erroConfig, setErroConfig] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [transmitindoId, setTransmitindoId] = useState<string | null>(null);
  const [showEmissoresModal, setShowEmissoresModal] = useState(false);
  const [showAcessoClienteModal, setShowAcessoClienteModal] = useState(false);
  const [showCopiarModal, setShowCopiarModal] = useState(false);
  const [showImportarModal, setShowImportarModal] = useState(false);
  const [showCndModal, setShowCndModal] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [progressoLote, setProgressoLote] = useState<{ feitas: number; total: number } | null>(null);

  const [cancelModal, setCancelModal] = useState<NfsE | null>(null);
  const [motivoCancel, setMotivoCancel] = useState(1);
  const [justificativaCancel, setJustificativaCancel] = useState('');
  const [exigeAnalise, setExigeAnalise] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const [form, setForm] = useState<Partial<NfsE>>({});
  const [showBuscarNotas, setShowBuscarNotas] = useState(false);
  const [percentuaisRetencao, setPercentuaisRetencao] = useState<ValoresRetidos>(SEM_RETENCAO);
  // Depois que a pessoa mexe nas retenções da nota, a regra não sobrescreve mais.
  const [retencaoManual, setRetencaoManual] = useState(false);
  const [regraAplicada, setRegraAplicada] = useState('');
  // Null enquanto a pessoa não digitar: vale o valor salvo na configuração do emissor.
  const [aliquotaSimplesDigitada, setAliquotaSimplesDigitada] = useState<string | null>(null);
  const [buscandoAliquotaSerpro, setBuscandoAliquotaSerpro] = useState(false);
  const [infoAliquotaSerpro, setInfoAliquotaSerpro] = useState<string | null>(null);
  const [buscandoTomador, setBuscandoTomador] = useState(false);
  const [origemEndereco, setOrigemEndereco] = useState('');
  // Só vale a resposta da última consulta: as anteriores podem chegar depois.
  const ultimaConsultaTomador = useRef('');

  const carregarListaEmissores = useCallback(async () => {
    if (modoCliente) return;
    try {
      const res = await fetch('/api/nfse/emissores');
      const dados = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(dados.empresas)) {
        setEmpresasDisponiveis(dados.empresas);
      }
    } catch {
      // Silencioso: o modal de emissores tenta novamente ao abrir
    }
  }, [modoCliente]);

  const carregarConfig = useCallback(async (eId: string) => {
    setConfig(null);
    setErroConfig('');
    try {
      const res = await fetch(`/api/empresas/${eId}/nfse-config`);
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) { setErroConfig(dados.error || 'Não foi possível carregar a configuração do Emissor Nacional.'); return; }
      setConfig(dados);
    } catch {
      setErroConfig('Sem conexão com o servidor para carregar a configuração do Emissor Nacional.');
    }
  }, []);

  const carregarNotasServidor = useCallback(async (eId: string) => {
    if (!eId) return;
    try {
      const res = await fetch(`/api/nfse/emissores/${eId}/notas`);
      const dados = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(dados.notas)) {
        const locais = new Map(store.getNfsE(eId).map(n => [n.id, n]));
        // Excluída aqui e ainda não apagada no servidor: não pode voltar para a lista.
        const excluidas = new Set(store.getDeletedRecords().filter(r => r.collection === 'cf_nfse').map(r => r.id));
        const mescladas: NfsE[] = dados.notas.filter((n: NfsE) => !excluidas.has(n.id)).map((n: NfsE) => ({
          ...locais.get(n.id),
          ...n,
          createdAt: String(n.createdAt),
        }));
        store.saveManyNfsE(mescladas, true);
        setNfseList(store.getNfsE(eId));
      }
    } catch {
      // Mantém a lista local se offline
    }
  }, []);

  // Busca automática e silenciosa no portal SEFIN (ADN) de novas notas emitidas e tomadas
  const sincronizarNotasAdnSilencioso = useCallback(async (eId: string) => {
    if (!eId) return;
    try {
      const res = await fetch(`/api/nfse/emissores/${eId}/notas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meses: 3 }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data.criadas > 0 || (Array.isArray(data.idsAlterados) && data.idsAlterados.length > 0))) {
        toast.success(`Busca automática: ${data.criadas || 0} nova(s) NFS-e identificada(s) no portal SEFIN!`);
        await carregarNotasServidor(eId);
      }
    } catch {
      // Silencioso em background
    }
  }, [carregarNotasServidor]);

  const load = useCallback((eId: string, dadosEmpresa?: EmpresaNfseSelecionada | null) => {
    if (!eId) return;
    setEmpresaId(eId);
    setNfseList(store.getNfsE(eId));
    setClientes(store.getClientes(eId).filter(c => c.ativo));
    setPortadores(store.getPortadores(eId).filter(p => p.ativo));
    setPlanoContas(store.getPlanoContas(eId).filter(p => p.nivel === 3 && p.ativo && p.tipo === 'receita'));
    const proprio = dadosEmpresa || lerEmissorProprio();
    const doStore = store.getEmpresas().find(e => e.id === eId);
    setEmpresa(atual =>
      doStore
      || (proprio?.id === eId ? (proprio as Empresa) : null)
      || (atual?.id === eId ? atual : null),
    );
    localStorage.removeItem(`cf_nfse_portal_config_${eId}`);
  }, []);

  const selecionarEmissorProprio = useCallback((escolhida: EmpresaNfseSelecionada) => {
    const registro: EmpresaNfseSelecionada = {
      id: escolhida.id,
      razaoSocial: escolhida.razaoSocial,
      nomeFantasia: escolhida.nomeFantasia,
      cnpj: escolhida.cnpj,
    };
    sessionStorage.setItem(CHAVE_EMISSOR_NFSE, JSON.stringify(registro));
    setSelecionadas(new Set());
    load(registro.id, registro);
    carregarConfig(registro.id);
    carregarNotasServidor(registro.id);
    sincronizarNotasAdnSilencioso(registro.id);
  }, [load, carregarConfig, carregarNotasServidor, sincronizarNotasAdnSilencioso]);

  // Polling automático e suave a cada 3 minutos para manter notas emitidas e tomadas sempre atualizadas
  useEffect(() => {
    if (!empresaId) return;
    const timer = setInterval(() => {
      sincronizarNotasAdnSilencioso(empresaId);
    }, 180_000);
    return () => clearInterval(timer);
  }, [empresaId, sincronizarNotasAdnSilencioso]);

  const acessoCliente = useAcessoNfse(modoCliente);

  const selecionarEmpresaCliente = useCallback((escolhida: EmpresaLiberada) => {
    selecionarEmissorProprio(escolhida);
  }, [selecionarEmissorProprio]);

  // O cliente só escolhe entre as próprias empresas com procuração, não importa o que esteja salvo.
  useEffect(() => {
    if (!modoCliente || acessoCliente.empresas.length === 0) return;
    const salva = lerEmissorProprio()?.id;
    selecionarEmpresaCliente(acessoCliente.empresas.find(e => e.id === salva) || acessoCliente.empresas[0]);
    const aoMudarDados = () => { const atual = lerEmissorProprio()?.id; if (atual) load(atual); };
    window.addEventListener('cfDataChange', aoMudarDados);
    return () => window.removeEventListener('cfDataChange', aoMudarDados);
  }, [modoCliente, acessoCliente.empresas, selecionarEmpresaCliente, load]);

  // No modo consultor/administrador, a tela de NFS-e usa apenas a seleção própria desta tela,
  // sem herdar nem reagir à empresa selecionada no restante do sistema.
  useEffect(() => {
    if (modoCliente) return;
    carregarListaEmissores();
    const proprio = lerEmissorProprio();
    if (proprio?.id) {
      load(proprio.id, proprio);
      carregarConfig(proprio.id);
      carregarNotasServidor(proprio.id);
    }
    const dataChangeHandler = () => {
      const atual = lerEmissorProprio();
      if (atual?.id) load(atual.id, atual);
    };
    window.addEventListener('cfDataChange', dataChangeHandler);
    return () => {
      window.removeEventListener('cfDataChange', dataChangeHandler);
    };
  }, [modoCliente, carregarListaEmissores, load, carregarConfig, carregarNotasServidor]);

  const cnpjEmpresaAtual = empresa?.cnpj || '';

  // CNAEs da empresa emissora, para destacar os serviços dela. Sem resposta, só some o destaque.
  const [cnaesEmpresa, setCnaesEmpresa] = useState<CnaeEmpresa[] | null>(null);
  useEffect(() => {
    const cnpj = apenasDigitos(cnpjEmpresaAtual);
    if (!cnpjValido(cnpj)) { setCnaesEmpresa([]); return; }
    const chave = `cf_nfse_cnaes_${cnpj}`;
    try {
      const guardado = sessionStorage.getItem(chave);
      if (guardado) { setCnaesEmpresa(JSON.parse(guardado)); return; }
    } catch {
      // Cache ilegível: consulta de novo.
    }
    let cancelado = false;
    setCnaesEmpresa(null);
    fetch(`/api/nfse/dados-publicos?cnpj=${cnpj}`)
      .then(res => (res.ok ? res.json() : null))
      .then(dados => {
        if (cancelado) return;
        const cnaes: CnaeEmpresa[] = dados?.cnaes || [];
        setCnaesEmpresa(cnaes);
        if (cnaes.length > 0) sessionStorage.setItem(chave, JSON.stringify(cnaes));
      })
      .catch(() => { if (!cancelado) setCnaesEmpresa([]); });
    return () => { cancelado = true; };
  }, [cnpjEmpresaAtual]);

  // Notas que passam apenas pelo filtro de período (para alimentar contadores das abas e cards de resumo)
  const notasNoPeriodo = useMemo(() => {
    return nfseList.filter(n => {
      if (mesFiltro && !n.dataEmissao.startsWith(mesFiltro) && n.dataCompetencia !== mesFiltro) return false;
      if (dataInicioFiltro && n.dataEmissao < dataInicioFiltro) return false;
      if (dataFimFiltro && n.dataEmissao > dataFimFiltro) return false;
      return true;
    });
  }, [nfseList, mesFiltro, dataInicioFiltro, dataFimFiltro]);

  const notasPrestadasNoPeriodo = useMemo(
    () => notasNoPeriodo.filter(n => !ehNotaTomada(n, cnpjEmpresaAtual)),
    [notasNoPeriodo, cnpjEmpresaAtual],
  );

  const notasTomadasNoPeriodo = useMemo(
    () => notasNoPeriodo.filter(n => ehNotaTomada(n, cnpjEmpresaAtual)),
    [notasNoPeriodo, cnpjEmpresaAtual],
  );

  const basePapel = papelFiltro === 'tomadas' ? notasTomadasNoPeriodo : notasPrestadasNoPeriodo;

  const filtered = useMemo(() => {
    return basePapel.filter(n => {
      if (statusFiltro && n.status !== statusFiltro) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        n.numero.toLowerCase().includes(s)
        || n.tomadorRazaoSocial.toLowerCase().includes(s)
        || (n.tomadorCnpjCpf || '').toLowerCase().includes(s)
        || (n.prestadorRazaoSocial || '').toLowerCase().includes(s)
        || (n.prestadorCnpj || '').toLowerCase().includes(s)
        || n.discriminacao.toLowerCase().includes(s)
        || (n.chaveAcesso || '').toLowerCase().includes(s)
      );
    }).sort((a, b) => b.dataEmissao.localeCompare(a.dataEmissao) || b.createdAt.localeCompare(a.createdAt));
  }, [basePapel, search, statusFiltro]);

  const totais = useMemo(() => {
    const reaisPrestadas = notasPrestadasNoPeriodo.filter(n => n.chaveAcesso && n.ambiente === 'producao');
    const rascunhos = notasPrestadasNoPeriodo.filter(n => n.status === 'rascunho');
    const tomadasValidas = notasTomadasNoPeriodo.filter(n => n.status === 'emitida');
    const baseStatus = basePapel.filter(n => n.chaveAcesso || n.status === 'rascunho');
    return {
      emitidas: reaisPrestadas.filter(n => n.status === 'emitida').reduce((a, n) => a + n.valorLiquido, 0),
      qtdEmitidasPrestadas: reaisPrestadas.filter(n => n.status === 'emitida').length,
      tomadasValor: tomadasValidas.reduce((a, n) => a + n.valorLiquido, 0),
      qtdTomadas: tomadasValidas.length,
      pendentes: rascunhos.reduce((a, n) => a + n.valorServicos, 0),
      qtdRascunhos: rascunhos.length,
      qtdEmitidasAba: baseStatus.filter(n => n.status === 'emitida').length,
      qtdCanceladasAba: baseStatus.filter(n => n.status === 'cancelada').length,
    };
  }, [notasPrestadasNoPeriodo, notasTomadasNoPeriodo, basePapel]);

  const parametros = config?.parametros || null;
  // Sem configuração salva, a empresa já nasce no modo por procuração.
  const porProcuracao = parametros?.usarProcuracao !== false;
  const certificado = (porProcuracao ? config?.escritorio : config?.certificado) || null;
  const certVencido = !!certificado?.validoAte && new Date(certificado.validoAte).getTime() < Date.now();
  const prontoParaEmitir = !!parametros?.codigoMunicipio && !!certificado && !certVencido;
  const emProducao = parametros?.ambiente === 'producao';

  const valorForm = Number(form.valorServicos) || 0;
  const aliquotaForm = Number(form.aliquotaIss) || 0;
  const issRetidoForm = !!form.issRetido;
  const retidosForm = calcularRetidos(valorForm, percentuaisRetencao);
  const estimativa = estimarValoresNota(valorForm, aliquotaForm, issRetidoForm, totalRetidoFederal(retidosForm));
  const financeiroForm: FinanceiroNota = {
    gerarContaReceber: !!form.gerarContaReceber,
    portadorId: form.portadorId || '',
    planoContaId: form.planoContaId || '',
    vencimento: form.vencimento || '',
  };
  const aliquotaObrigatoria = !!parametros && exigeAliquotaNaDps({
    ...parametros, cnpj: empresa?.cnpj || '', codigoMunicipio: parametros.codigoMunicipio || '',
  }, issRetidoForm);
  const dadosEnderecoForm = {
    tomadorCodigoMunicipio: form.tomadorCodigoMunicipio,
    tomadorCep: form.tomadorCep,
    tomadorLogradouro: form.tomadorEndereco,
    tomadorBairro: form.tomadorBairro,
  };
  const enderecoCompleto = enderecoTomadorCompleto(dadosEnderecoForm);
  const ehSimples = parametros?.opSimpNac === 3;
  const aliquotaSimplesForm = aliquotaSimplesDigitada ?? (parametros?.pTotTribSN != null ? String(parametros.pTotTribSN) : '');
  const aliquotaSimplesValida = (v: number) => v > 0 && v <= 100;
  const AVISO_ALIQUOTA_SIMPLES = 'Informe a alíquota do Simples Nacional para emitir.';

  // A regra de retenção acompanha o serviço, o tomador e o valor da nota em edição.
  const regrasDaEmpresa = parametros?.regrasRetencao;
  useEffect(() => {
    if (modalMode !== 'novo' || retencaoManual) return;
    const regra = escolherRegra(regrasDaEmpresa, {
      cTribNac: (form.codigoServico || '').replace(/\D/g, ''),
      tomadorDocumento: form.tomadorCnpjCpf || '',
      valorServicos: Number(form.valorServicos) || 0,
    });
    setPercentuaisRetencao(regra ? regra.percentuais : SEM_RETENCAO);
    setRegraAplicada(regra?.nome || '');
    setForm(f => {
      const issRetido = !!regra?.issRetido;
      const aliquotaIss = regra?.issRetido && regra.aliquotaIss !== null ? regra.aliquotaIss : f.aliquotaIss;
      return f.issRetido === issRetido && f.aliquotaIss === aliquotaIss ? f : { ...f, issRetido, aliquotaIss };
    });
  }, [modalMode, retencaoManual, regrasDaEmpresa, form.codigoServico, form.tomadorCnpjCpf, form.valorServicos]);

  const buscarAliquotaIntegraContador = async () => {
    if (!empresaId) return;
    setBuscandoAliquotaSerpro(true);
    setInfoAliquotaSerpro(null);
    try {
      const res = await fetch(`/api/serpro/aliquota-simples?empresaId=${empresaId}`);
      const data = await res.json();
      if (data.sucesso && data.aliquota > 0) {
        setAliquotaSimplesDigitada(String(data.aliquota));
        const det = data.rpa && data.valorDevido
          ? `PGDAS-D (${data.periodoApuracao || 'último PA'}): ${data.aliquota}% (Imposto: R$ ${Number(data.valorDevido).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / RPA: R$ ${Number(data.rpa).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`
          : `PGDAS-D (${data.periodoApuracao || 'último PA'}): ${data.aliquota}% (RBT12: R$ ${(data.rbt12 || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`;
        setInfoAliquotaSerpro(det);
        toast.success(`Alíquota do Simples atualizada via Integra Contador: ${data.aliquota}%`);
      } else {
        toast.error(data.error || 'Nenhuma apuração recente do Simples Nacional foi localizada no SERPRO para este CNPJ.');
      }
    } catch {
      toast.error('Erro de conexão ao consultar alíquota no Integra Contador.');
    } finally {
      setBuscandoAliquotaSerpro(false);
    }
  };

  const [sincronizandoSequencia, setSincronizandoSequencia] = useState(false);

  const calcularProximoNumero = useCallback(() => {
    const proximoConfig = emProducao
      ? (parametros?.proximoNDpsProducao || 1)
      : (parametros?.proximoNDpsHomologacao || 1);
    const doStore = parseInt(store.getNextNfseNumero(empresaId), 10) || 1;
    const maxNfseList = nfseList
      .filter(n => n.status !== 'cancelada' && (!emProducao || n.ambiente === 'producao'))
      .map(n => parseInt(n.numero, 10))
      .filter(n => !isNaN(n));
    const maxDaLista = maxNfseList.length > 0 ? Math.max(...maxNfseList) + 1 : 1;
    const maior = Math.max(proximoConfig, doStore, maxDaLista);
    return String(maior).padStart(6, '0');
  }, [emProducao, parametros, empresaId, nfseList]);

  const handleSincronizarSequenciaOficial = async () => {
    if (!empresaId) return;
    setSincronizandoSequencia(true);
    try {
      const res = await fetch(`/api/nfse/emissores/${empresaId}/sequencia`, { method: 'POST' });
      const dados = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(dados.mensagem || `Sequência sincronizada com a base oficial! Próxima nota: ${dados.proximoNDpsProducao}`);
        await carregarConfig(empresaId);
        await carregarNotasServidor(empresaId);
      } else {
        toast.error(dados.error || 'Não foi possível sincronizar com a base oficial.');
      }
    } catch {
      toast.error('Erro de conexão ao sincronizar com a base oficial.');
    } finally {
      setSincronizandoSequencia(false);
    }
  };

  const openNovo = () => {
    setPapelFiltro('prestadas');
    setPercentuaisRetencao(SEM_RETENCAO);
    setRetencaoManual(false);
    setRegraAplicada('');
    setAliquotaSimplesDigitada(null);
    setInfoAliquotaSerpro(null);
    setOrigemEndereco('');
    if (!prontoParaEmitir) {
      toast.info(modoCliente ? `${AVISO_FALE_COM_ESCRITORIO} O rascunho pode ser salvo mesmo assim.` : 'Configure o município e o certificado antes de emitir. O rascunho pode ser salvo mesmo assim.');
    }
    setForm({
      empresaId,
      numero: calcularProximoNumero(),
      serie: parametros?.serie || '1',
      status: 'rascunho',
      dataEmissao: hojeBrasilia(),
      dataCompetencia: hojeBrasilia().slice(0, 7),
      prestadorCnpj: empresa?.cnpj || '',
      prestadorRazaoSocial: empresa?.razaoSocial || '',
      prestadorInscricaoMunicipal: parametros?.inscricaoMunicipal || '',
      valorServicos: 0,
      aliquotaIss: 0,
      issRetido: false,
      codigoServico: parametros?.cTribNacPadrao || parametros?.servicosConhecidos?.[0]?.cTribNac || '',
      cTribMun: (parametros?.cTribMunPadrao && parametros.cTribMunPadrao.length <= 3 && parametros.cTribMunPadrao !== parametros?.cTribNacPadrao) ? parametros.cTribMunPadrao : '',
      cNbs: parametros?.cNbsPadrao || parametros?.servicosConhecidos?.[0]?.cNbs || '',
      municipioPrestacao: parametros?.codigoMunicipio || '',
      discriminacao: parametros?.servicosConhecidos?.[0]?.descricao || '',
      tomadorCnpjCpf: '',
      tomadorRazaoSocial: '',
      gerarContaReceber: false,
      vencimento: hojeBrasilia(),
    });
    setModalMode('novo');
  };

  /** Rascunhos vindos da cópia ou da importação; ficam selecionados para a transmissão em lote. */
  const criarRascunhos = (itens: DadosCopiaveis[], financeiro: FinanceiroNota) => {
    const ids = itens.map(dados => {
      const id = uid();
      const carregado: ValoresRetidos = { irrf: dados.valorIr || 0, pis: dados.valorPis || 0, cofins: dados.valorCofins || 0, csll: dados.valorCsll || 0, cp: dados.valorInss || 0 };
      // Nota sem retenção própria (planilha, ou cópia sem retenção) segue a regra da empresa.
      const regra = totalRetidoFederal(carregado) === 0 && !dados.issRetido
        ? escolherRegra(parametros?.regrasRetencao, { cTribNac: dados.codigoServico, tomadorDocumento: dados.tomadorCnpjCpf, valorServicos: dados.valorServicos })
        : null;
      const retidos = regra ? calcularRetidos(dados.valorServicos, regra.percentuais) : carregado;
      const issRetido = regra ? regra.issRetido : !!dados.issRetido;
      const aliquotaIss = regra?.issRetido && regra.aliquotaIss !== null ? regra.aliquotaIss : dados.aliquotaIss || 0;
      const estimados = estimarValoresNota(dados.valorServicos, aliquotaIss, issRetido, totalRetidoFederal(retidos));
      store.saveNfsE({
        ...dados,
        id,
        empresaId,
        numero: store.getNextNfseNumero(empresaId),
        serie: parametros?.serie || '1',
        status: 'rascunho',
        prestadorCnpj: empresa?.cnpj || '',
        prestadorRazaoSocial: empresa?.razaoSocial || '',
        dataEmissao: hojeBrasilia(),
        valorDeducoes: 0,
        valorPis: retidos.pis,
        valorCofins: retidos.cofins,
        valorInss: retidos.cp,
        valorIr: retidos.irrf,
        valorCsll: retidos.csll,
        issRetido,
        aliquotaIss,
        ...estimados,
        valorBaseCalculo: dados.valorServicos,
        gerarContaReceber: financeiro.gerarContaReceber,
        portadorId: financeiro.gerarContaReceber ? financeiro.portadorId : undefined,
        planoContaId: financeiro.gerarContaReceber ? financeiro.planoContaId : undefined,
        vencimento: dados.vencimento || financeiro.vencimento,
        createdAt: new Date().toISOString(),
      });
      return id;
    });
    setNfseList(store.getNfsE(empresaId));
    setSelecionadas(new Set(ids));
    setPapelFiltro('prestadas');
    setStatusFiltro('rascunho');
    setShowCopiarModal(false);
    setShowImportarModal(false);
    toast.success(`${ids.length} rascunho(s) criado(s). Confira e transmita os selecionados.`);
  };

  const fillTomador = (clienteId: string) => {
    const cli = clientes.find(c => c.id === clienteId);
    if (!cli) return;
    setForm(f => ({
      ...f,
      clienteId,
      tomadorCnpjCpf: cli.cpfCnpj,
      tomadorRazaoSocial: cli.nome,
      tomadorEmail: cli.email || '',
      tomadorEndereco: cli.endereco || '',
      tomadorCidade: cli.cidade || '',
      tomadorUf: cli.estado || '',
      tomadorCep: cli.cep || '',
    }));
    // O cadastro do cliente não guarda o código do município: completa só o que falta.
    preencherTomadorPeloCnpj(cli.cpfCnpj, true);
  };

  const preencherTomadorPeloCnpj = async (documento: string, soCamposVazios: boolean) => {
    const cnpj = apenasDigitos(documento);
    if (!cnpjValido(cnpj)) return;
    ultimaConsultaTomador.current = cnpj;
    setBuscandoTomador(true);
    setOrigemEndereco('');
    try {
      const res = await fetch(`/api/nfse/dados-publicos?cnpj=${cnpj}`);
      const dados = await res.json().catch(() => ({}));
      if (ultimaConsultaTomador.current !== cnpj) return;
      if (!res.ok) { toast.warning(dados.error || 'Não foi possível consultar o CNPJ. Preencha os dados à mão.'); return; }
      const valor = (atual: string | null | undefined, novo: string | null | undefined) => (soCamposVazios ? atual || novo || '' : novo || atual || '');
      setForm(f => {
        // A pessoa pode ter trocado o CNPJ enquanto a consulta estava em andamento.
        if (apenasDigitos(f.tomadorCnpjCpf || '') !== cnpj) return f;
        return {
          ...f,
          tomadorRazaoSocial: valor(f.tomadorRazaoSocial, dados.razaoSocial),
          tomadorEmail: valor(f.tomadorEmail, dados.email),
          tomadorEndereco: valor(f.tomadorEndereco, dados.logradouro),
          tomadorNumero: valor(f.tomadorNumero, dados.numero),
          tomadorBairro: valor(f.tomadorBairro, dados.bairro),
          tomadorCep: valor(f.tomadorCep, dados.cep),
          tomadorCodigoMunicipio: valor(f.tomadorCodigoMunicipio, dados.codigoMunicipio),
          tomadorCidade: valor(f.tomadorCidade, dados.cidade),
          tomadorUf: valor(f.tomadorUf, dados.uf),
        };
      });
      setOrigemEndereco('Preenchido pelo cadastro público do CNPJ. Confira antes de emitir.');
    } catch {
      if (ultimaConsultaTomador.current === cnpj) toast.warning('Sem conexão para consultar o CNPJ.');
    } finally {
      if (ultimaConsultaTomador.current === cnpj) setBuscandoTomador(false);
    }
  };

  const preencherEnderecoPeloCep = async (cepDigitado: string) => {
    const cep = apenasDigitos(cepDigitado);
    if (cep.length !== 8) return;
    try {
      const res = await fetch(`/api/nfse/dados-publicos?cep=${cep}`);
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) { toast.warning(dados.error || 'Não foi possível consultar o CEP.'); return; }
      setForm(f => (apenasDigitos(f.tomadorCep || '') !== cep ? f : {
        ...f,
        tomadorEndereco: dados.logradouro || f.tomadorEndereco,
        tomadorBairro: dados.bairro || f.tomadorBairro,
        tomadorCodigoMunicipio: dados.codigoMunicipio || f.tomadorCodigoMunicipio,
        tomadorCidade: dados.cidade || f.tomadorCidade,
        tomadorUf: dados.uf || f.tomadorUf,
      }));
      setOrigemEndereco('Endereço e código do município preenchidos pelo CEP. Confira e informe o número.');
    } catch {
      toast.warning('Sem conexão para consultar o CEP.');
    }
  };

  const abrirEdicao = (n: NfsE) => {
    // Se cTribMun veio com 6 dígitos ou idêntico ao codigoServico, higieniza para não causar o erro E1235 no Sefin
    const padraoEmpresa = parametros?.cTribNacPadrao || parametros?.servicosConhecidos?.[0]?.cTribNac || '';
    const codServico = (n.codigoServico && n.codigoServico.trim()) || (n.cTribMun && n.cTribMun.length === 6 ? n.cTribMun : '') || padraoEmpresa;
    const codMun = n.cTribMun && n.cTribMun.length <= 3 && n.cTribMun !== codServico ? n.cTribMun : '';
    setForm({ ...n, codigoServico: codServico, cTribMun: codMun });
    setPercentuaisRetencao(percentuaisDosValores(n.valorServicos, { irrf: n.valorIr, pis: n.valorPis, cofins: n.valorCofins, csll: n.valorCsll, cp: n.valorInss }));
    setRetencaoManual(true);
    setRegraAplicada('');
    setAliquotaSimplesDigitada(null);
    setOrigemEndereco('');
    setModalMode('novo');
  };

  /** Guarda a alíquota digitada para as próximas notas. Cliente só usa na nota: a configuração é do escritório. */
  const salvarAliquotaSimples = async (aliquota: number) => {
    if (modoCliente || !ehSimples || !aliquotaSimplesValida(aliquota) || aliquota === parametros?.pTotTribSN) return;
    try {
      const res = await fetch(`/api/empresas/${empresaId}/nfse-config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pTotTribSN: aliquota }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) { toast.warning(dados.error || 'A alíquota do Simples não foi salva para as próximas notas.'); return; }
      setConfig(c => (c?.parametros ? { ...c, parametros: { ...c.parametros, pTotTribSN: aliquota } } : c));
    } catch {
      toast.warning('A alíquota do Simples não foi salva para as próximas notas.');
    }
  };

  const montarRascunho = (): NfsE => {
    const valorServicos = Math.round(valorForm * 100) / 100;
    return {
      ...(form as NfsE),
      id: form.id || uid(),
      empresaId,
      numero: form.numero || calcularProximoNumero(),
      serie: form.serie || parametros?.serie || '1',
      status: 'rascunho',
      prestadorCnpj: empresa?.cnpj || form.prestadorCnpj || '',
      prestadorRazaoSocial: empresa?.razaoSocial || form.prestadorRazaoSocial || '',
      dataEmissao: form.dataEmissao || hojeBrasilia(),
      dataCompetencia: form.dataCompetencia || hojeBrasilia().slice(0, 7),
      codigoServico: (form.codigoServico || '').replace(/\D/g, ''),
      valorServicos,
      valorDeducoes: 0,
      valorPis: retidosForm.pis,
      valorCofins: retidosForm.cofins,
      valorInss: retidosForm.cp,
      valorIr: retidosForm.irrf,
      valorCsll: retidosForm.csll,
      issRetido: issRetidoForm,
      aliquotaIss: aliquotaForm,
      valorIss: estimativa.valorIss,
      valorBaseCalculo: valorServicos,
      valorLiquido: estimativa.valorLiquido,
      createdAt: form.createdAt || new Date().toISOString(),
    };
  };

  const handleSave = async (emitir: boolean) => {
    if (!form.discriminacao?.trim()) { toast.error('Preencha a descrição do serviço.'); return; }
    if (!form.tomadorCnpjCpf || !form.tomadorRazaoSocial) { toast.error('Preencha os dados do tomador.'); return; }
    if (!valorForm) { toast.error('Informe o valor do serviço.'); return; }
    const financeiroErro = financeiroInvalido(financeiroForm);
    if (financeiroErro) { toast.error(financeiroErro); return; }
    const aliquotaSimples = Number(aliquotaSimplesForm);
    if (emitir && ehSimples && !aliquotaSimplesValida(aliquotaSimples)) { toast.error(AVISO_ALIQUOTA_SIMPLES); return; }

    const rascunho = montarRascunho();
    store.saveNfsE(rascunho);
    setNfseList(store.getNfsE(empresaId));
    await salvarAliquotaSimples(aliquotaSimples);
    if (!emitir) { setModalMode(null); return; }
    // O formulário só fecha se autorizada: em uma rejeição o usuário corrige ali mesmo.
    const autorizada = await handleTransmitir(rascunho, ehSimples ? aliquotaSimples : undefined);
    if (autorizada) setModalMode('ver');
    else setForm(store.getNfsE(empresaId).find(n => n.id === rascunho.id) || rascunho);
  };

  const gerarContaReceber = (nota: NfsE): NfsE => {
    if (nota.lancamentoId) return nota;
    const lancamento = {
      id: uid(),
      empresaId,
      data: nota.vencimento || nota.dataEmissao,
      descricao: `NFS-e nº ${nota.numero} — ${nota.tomadorRazaoSocial}`,
      valor: nota.valorLiquido,
      tipo: 'receita' as const,
      planoContaId: nota.planoContaId || '',
      portadorId: nota.portadorId || '',
      status: 'previsto' as const,
      numeroDocumento: `NFS-e ${nota.numero}`,
      observacao: `Competência: ${nota.dataCompetencia} | Serviço: ${nota.codigoServico} | Chave: ${nota.chaveAcesso}`,
      clienteId: nota.clienteId,
      origem: 'manual' as const,
      createdAt: new Date().toISOString(),
    };
    store.saveLancamento(lancamento);
    return { ...nota, lancamentoId: lancamento.id };
  };

  const garantirPronto = (): boolean => {
    if (prontoParaEmitir) return true;
    if (modoCliente) {
      toast.error(AVISO_FALE_COM_ESCRITORIO);
      return false;
    }
    toast.error(certVencido ? 'O certificado digital está vencido.' : 'Configure o município e o certificado antes de transmitir.');
    setShowConfigModal(true);
    return false;
  };

  const enviarAoSefin = async (nfse: NfsE, pTotTribSN?: number): Promise<ResultadoEnvio> => {
    setTransmitindoId(nfse.id);
    try {
      const padraoEmpresa = parametros?.cTribNacPadrao || parametros?.servicosConhecidos?.[0]?.cTribNac || '';
      const codServico = (nfse.codigoServico && nfse.codigoServico.trim()) || (nfse.cTribMun && nfse.cTribMun.length === 6 ? nfse.cTribMun : '') || padraoEmpresa;
      const codMun = nfse.cTribMun && nfse.cTribMun.length <= 3 && nfse.cTribMun !== codServico ? nfse.cTribMun : null;
      const notaAEnviar = { ...nfse, codigoServico: codServico, cTribMun: codMun };

      const res = await fetch('/api/nfse/emitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, nota: notaAEnviar, ...(pTotTribSN !== undefined ? { pTotTribSN } : {}) }),
      });
      const dados = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (dados.nota) {
          store.saveNfsE({ ...nfse, ...dados.nota });
        } else if (!dados.incerto && dados.error) {
          // Problema barrado antes do envio: fica visível na linha do rascunho.
          store.saveNfsE({ ...nfse, ultimoErro: dados.error });
        }
        setNfseList(store.getNfsE(empresaId));
        // Erro 5xx sem resposta do sistema (ex.: tempo da função esgotado): a nota pode ter saído.
        const incerta = dados.incerto || (res.status >= 500 && !dados.error);
        return {
          resultado: incerta ? 'incerta' : 'rejeitada',
          mensagem: dados.error || (incerta
            ? 'O servidor não confirmou o envio. Transmita de novo: o sistema consulta o Sefin antes e não duplica a nota.'
            : 'Não foi possível transmitir a nota.'),
        };
      }

      const autorizada: NfsE = { ...nfse, ...dados.nota };
      // A nota só entra no financeiro se marcado. Nota de teste não tem valor fiscal e nunca entra.
      const final = autorizada.gerarContaReceber && autorizada.ambiente === 'producao' ? gerarContaReceber(autorizada) : autorizada;
      store.saveNfsE(final);
      setNfseList(store.getNfsE(empresaId));
      return { resultado: 'autorizada', nota: final, recuperada: !!dados.recuperada, alertas: dados.alertas || [] };
    } catch {
      return { resultado: 'incerta', mensagem: 'A conexão caiu durante o envio e a emissão não foi confirmada. Transmita de novo: o sistema consulta o Sefin antes e não duplica a nota.' };
    } finally {
      setTransmitindoId(null);
    }
  };

  /** Devolve true se o Sefin autorizou a nota. */
  const handleTransmitir = async (nfse: NfsE, pTotTribSN?: number): Promise<boolean> => {
    if (transmitindoId || !garantirPronto()) return false;
    // Transmitindo pela lista, sem alíquota salva: abre a nota para informar.
    if (ehSimples && parametros?.pTotTribSN == null && pTotTribSN === undefined) {
      toast.error(AVISO_ALIQUOTA_SIMPLES);
      abrirEdicao(nfse);
      return false;
    }
    if (emProducao) {
      const confirmado = await confirmAsync(`Emitir nota fiscal REAL de ${fmt.currency(nfse.valorServicos)} para ${nfse.tomadorRazaoSocial}?`);
      if (!confirmado) return false;
    }

    const envio = await enviarAoSefin(nfse, pTotTribSN);
    if (envio.resultado !== 'autorizada') {
      if (envio.resultado === 'incerta') toast.warning(envio.mensagem, { duration: 15000 });
      else toast.error(envio.mensagem, { duration: 15000 });
      return false;
    }
    setViewItem(envio.nota);
    setModalMode('ver');
    toast.success(envio.recuperada
      ? `NFS-e ${envio.nota.numero} recuperada: a tentativa anterior já havia sido autorizada.`
      : `NFS-e ${envio.nota.numero} autorizada pelo Sefin.`);
    envio.alertas.forEach(alerta => toast.warning(alerta, { duration: 12000 }));
    return true;
  };

  // Só conta o que está na lista: uma ação nunca atinge uma nota que o filtro escondeu.
  const notasSelecionadas = filtered.filter(n => selecionadas.has(n.id));
  const rascunhosSelecionados = notasSelecionadas.filter(n => n.status === 'rascunho' && !ehNotaTomada(n, cnpjEmpresaAtual));
  const excluiveisSelecionadas = notasSelecionadas.filter(n => !n.chaveAcesso);
  const exportaveisSelecionadas = notasSelecionadas.filter(n => !!n.chaveAcesso);
  const todasMarcadas = filtered.length > 0 && notasSelecionadas.length === filtered.length;

  const alternarSelecao = (id: string) => setSelecionadas(atual => {
    const novo = new Set(atual);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    return novo;
  });

  const handleTransmitirLote = async () => {
    if (transmitindoId || progressoLote || rascunhosSelecionados.length === 0 || !garantirPronto()) return;
    if (ehSimples && parametros?.pTotTribSN == null) {
      toast.error(`${AVISO_ALIQUOTA_SIMPLES} Abra uma nota ou use Configurar Emissor.`);
      return;
    }
    const total = rascunhosSelecionados.reduce((soma, n) => soma + n.valorServicos, 0);
    const pergunta = emProducao
      ? `Emitir ${rascunhosSelecionados.length} nota(s) fiscal(is) REAL(IS), somando ${fmt.currency(total)}?`
      : `Emitir ${rascunhosSelecionados.length} nota(s) de teste em produção restrita?`;
    if (!(await confirmAsync(pergunta))) return;

    const fila = [...rascunhosSelecionados];
    let autorizadas = 0;
    let rejeitadas = 0;
    let interrompidaPor = '';
    setProgressoLote({ feitas: 0, total: fila.length });
    // Uma por vez. Com resultado incerto para: o Sefin pode estar fora, e insistir só geraria mais incertezas.
    for (let i = 0; i < fila.length; i++) {
      const envio = await enviarAoSefin(fila[i]);
      if (envio.resultado === 'autorizada') {
        autorizadas++;
        setSelecionadas(atual => { const novo = new Set(atual); novo.delete(fila[i].id); return novo; });
      } else if (envio.resultado === 'rejeitada') {
        rejeitadas++;
      } else {
        interrompidaPor = envio.mensagem;
        break;
      }
      setProgressoLote({ feitas: i + 1, total: fila.length });
    }
    setProgressoLote(null);

    const resumo = `${autorizadas} autorizada(s), ${rejeitadas} rejeitada(s).`;
    if (interrompidaPor) toast.warning(`Lote interrompido. ${resumo} ${interrompidaPor}`, { duration: 20000 });
    else if (rejeitadas > 0) toast.warning(`${resumo} O motivo de cada rejeição está na linha do rascunho.`, { duration: 15000 });
    else toast.success(resumo);
  };

  const abrirCancelamento = (n: NfsE) => {
    setCancelModal(n);
    setMotivoCancel(1);
    setJustificativaCancel('');
    setExigeAnalise(false);
  };

  const aplicarCancelamento = (nota: NfsE, justificativa: string) => {
    store.saveNfsE(nota);
    if (nota.status === 'cancelada' && nota.lancamentoId) {
      const lancamento = store.getLancamentos().find(l => l.id === nota.lancamentoId);
      if (lancamento) {
        store.saveLancamento({ ...lancamento, observacao: `CANCELADO — NFS-e ${nota.numero}: ${justificativa}`, status: 'previsto' });
      }
    }
    setNfseList(store.getNfsE(empresaId));
    setCancelModal(null);
  };

  const handleCancelar = async () => {
    if (!cancelModal) return;
    const justificativa = justificativaCancel.trim();
    if (justificativa.length < 15 || justificativa.length > 200) {
      toast.error('A justificativa deve ter entre 15 e 200 caracteres.');
      return;
    }
    // Nota simulada não existe no Sefin: o cancelamento é só local.
    if (!cancelModal.chaveAcesso) {
      aplicarCancelamento({ ...cancelModal, status: 'cancelada', motivoCancelamento: justificativa }, justificativa);
      return;
    }

    setCancelando(true);
    try {
      const res = await fetch(`/api/nfse/${cancelModal.id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivoCancel, justificativa, modo: exigeAnalise ? 'analise' : 'direto' }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (dados.exigeAnalise) {
          setExigeAnalise(true);
          toast.warning('Este município não aceita cancelamento direto. Solicite a análise fiscal.');
        } else {
          toast.error(dados.error || 'Não foi possível cancelar a nota.', { duration: 12000 });
        }
        return;
      }
      aplicarCancelamento({ ...cancelModal, ...dados.nota }, justificativa);
      toast.success(dados.nota.status === 'cancelada'
        ? 'NFS-e cancelada no Sefin.'
        : 'Análise fiscal solicitada: a nota segue válida até o município decidir.');
    } catch {
      toast.warning('A conexão caiu e o cancelamento não foi confirmado. Tente de novo.');
    } finally {
      setCancelando(false);
    }
  };

  const handleLimparSemChave = async () => {
    const semChave = store.getNfsE(empresaId).filter(n => !n.chaveAcesso);
    if (semChave.length === 0) { toast.info('Não há rascunhos nem notas simuladas para excluir.'); return; }
    if (!(await confirmAsync(`Excluir ${semChave.length} rascunho(s) e nota(s) simulada(s) e os lançamentos vinculados? Notas autorizadas pelo Sefin são mantidas.`))) return;
    semChave.forEach(n => {
      if (n.lancamentoId) store.deleteLancamento(n.lancamentoId);
      store.deleteNfsE(n.id);
    });
    setNfseList(store.getNfsE(empresaId));
    toast.success('Rascunhos e notas simuladas excluídos.');
  };

  /** Exclui rascunhos e notas simuladas. Nota com chave do Sefin nunca é excluída por aqui. */
  const handleExcluirSemChave = async (notas: NfsE[]) => {
    const alvo = notas.filter(n => !n.chaveAcesso);
    if (alvo.length === 0) return false;
    const nomeAlvo = alvo.length === 1 ? `a nota de ${alvo[0].tomadorRazaoSocial || 'tomador não informado'}` : `${alvo.length} notas sem autorização`;
    // Enviada e sem resposta: pode ter sido autorizada. Transmitir de novo é o que confirma, sem duplicar.
    const semConfirmacao = alvo.filter(n => n.nDps && !n.ultimoErro).length;
    const aviso = semConfirmacao > 0
      ? ` ATENÇÃO: ${semConfirmacao} já foi(ram) enviada(s) ao Sefin sem resposta e pode(m) ter sido autorizada(s). Antes de excluir, transmita de novo para confirmar.`
      : '';
    const confirmado = await confirmAsync(
      `Excluir ${nomeAlvo}? Os lançamentos vinculados também são excluídos, e isso não pode ser desfeito.${aviso}`,
      { title: 'Excluir rascunho', confirmText: 'Excluir', cancelText: 'Manter', danger: true },
    );
    if (!confirmado) return false;

    alvo.forEach(n => {
      if (n.lancamentoId) store.deleteLancamento(n.lancamentoId);
      store.deleteNfsE(n.id);
    });
    setNfseList(store.getNfsE(empresaId));
    setSelecionadas(atual => {
      const novo = new Set(atual);
      alvo.forEach(n => novo.delete(n.id));
      return novo;
    });
    toast.success(alvo.length === 1 ? 'Rascunho excluído.' : `${alvo.length} notas excluídas.`);
    return true;
  };

  const baixarExportacao = async (params: URLSearchParams, nomePadrao: string): Promise<number | null> => {
    const res = await fetch(`/api/nfse/emissores/${empresaId}/exportar?${params.toString()}`);
    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      toast.error(erro.error || 'Não foi possível exportar as notas.');
      return null;
    }
    const blob = await res.blob();
    const nomeArquivo = (res.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/)?.[1]
      || `${nomePadrao}.${params.get('formato') === 'pdf_unico' ? 'pdf' : 'zip'}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return Number(res.headers.get('X-Notas-Exportadas')) || 0;
  };

  const handleExportarMes = async () => {
    if (!empresaId) return;
    setExportando(true);
    try {
      const params = new URLSearchParams({
        mes: mesExportacao,
        papel: papelExportacao,
        formato: formatoExportacao,
        incluirCanceladas: incluirCanceladasExport ? '1' : '0',
      });
      if ((await baixarExportacao(params, `NFSe-${mesExportacao}`)) === null) return;
      toast.success('Exportação concluída com sucesso!');
      setShowExportarModal(false);
    } catch {
      toast.error('Erro de conexão ao exportar os arquivos.');
    } finally {
      setExportando(false);
    }
  };

  const handleExportarSelecionadas = async () => {
    if (!empresaId || exportaveisSelecionadas.length === 0) return;
    setExportando(true);
    try {
      const params = new URLSearchParams({ formato: formatoExportacao, ids: exportaveisSelecionadas.map(n => n.id).join(',') });
      const exportadas = await baixarExportacao(params, 'NFSe-selecionadas');
      if (exportadas === null) return;
      const semArquivo = exportaveisSelecionadas.length - exportadas;
      toast.success(`${exportadas} nota(s) exportada(s).`);
      if (semArquivo > 0) toast.warning(`${semArquivo} nota(s) ficaram de fora porque o XML ainda não está no sistema.`);
    } catch {
      toast.error('Erro de conexão ao exportar os arquivos.');
    } finally {
      setExportando(false);
    }
  };

  const statusBadge = (n: NfsE) => {
    if (ehSimulada(n)) return <span className="badge" style={{ background: 'rgba(148,163,184,0.15)', color: 'var(--text-muted)' }}>Simulada</span>;
    if (n.cancelamentoEmAnalise) return <span className="badge badge-yellow">Canc. em análise</span>;
    if (n.status === 'emitida') return <span className="badge badge-green">Emitida</span>;
    if (n.status === 'cancelada') return <span className="badge badge-red">Cancelada</span>;
    return <span className="badge badge-yellow">Rascunho</span>;
  };

  const modalEmissores = showEmissoresModal && (
    <NfseEmissoresModal
      empresaAtualId={empresaId}
      onFechar={() => { setShowEmissoresModal(false); carregarListaEmissores(); }}
      onCertificadoAlterado={() => { if (empresaId) carregarConfig(empresaId); carregarListaEmissores(); }}
      onSelecionar={(emissor: EmpresaEmissora) => {
        setShowEmissoresModal(false);
        selecionarEmissorProprio(emissor);
      }}
    />
  );

  const emissoresAtivos = useMemo(() => {
    const lista = empresasDisponiveis.filter(e => e.nfseConfig?.procuracaoStatus === 'ativa');
    const base = lista.length > 0 ? lista : empresasDisponiveis;
    if (!buscaEmpresaRapida.trim()) return base;
    const termo = buscaEmpresaRapida.toLowerCase();
    const digitos = apenasDigitos(buscaEmpresaRapida);
    return base.filter(e =>
      e.razaoSocial.toLowerCase().includes(termo)
      || (e.nomeFantasia || '').toLowerCase().includes(termo)
      || e.cnpj.includes(termo)
      || (digitos && apenasDigitos(e.cnpj).includes(digitos)),
    );
  }, [empresasDisponiveis, buscaEmpresaRapida]);

  if (!empresaId) return (
    <div className="page-body" style={{ background: '#fdfdfd', minHeight: '100%' }}>
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
        {modoCliente ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#600000', marginBottom: 8 }}>
              Emissor Nacional
            </div>
            <h3 className={serif.className} style={{ fontSize: 32, fontWeight: 400, color: '#000', margin: 0 }}>
              Carregando dados da empresa...
            </h3>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#600000', marginBottom: 6 }}>
                  Módulo Independente • Emissor Nacional NFS-e
                </div>
                <h3 className={serif.className} style={{ fontSize: 34, fontWeight: 400, color: '#000', margin: '0 0 6px', lineHeight: 1.1 }}>
                  Escolha a empresa para operar NFS-e
                </h3>
                <p style={{ fontSize: 14, color: '#525252', margin: 0, lineHeight: 1.5 }}>
                  Esta tela é independente da empresa selecionada no restante do sistema. Escolha abaixo qualquer cliente ou emissor por procuração.
                </p>
              </div>
              <button
                className="btn"
                style={{ background: '#600000', color: '#fff', padding: '10px 18px', borderRadius: 8, fontWeight: 500, fontSize: 13.5, border: 'none' }}
                onClick={() => setShowEmissoresModal(true)}
              >
                Gerenciar Procurações ({empresasDisponiveis.filter(e => e.nfseConfig?.procuracaoStatus === 'ativa').length || empresasDisponiveis.length})
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
                value={buscaEmpresaRapida}
                onChange={e => setBuscaEmpresaRapida(e.target.value)}
              />
            </div>

            <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid #e5e5e5', borderRadius: 14 }}>
              {emissoresAtivos.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: '#525252', fontSize: 13.5 }}>
                  Nenhuma empresa encontrada. Clique em <strong>Gerenciar Procurações</strong> para importar ou verificar CNPJs.
                </div>
              ) : (
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>CNPJ</th>
                      <th>Situação</th>
                      <th style={{ textAlign: 'right' }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emissoresAtivos.slice(0, 80).map(e => (
                      <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => selecionarEmissorProprio(e)}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13.5, color: '#171717' }}>{e.razaoSocial}</div>
                          {e.nomeFantasia && e.nomeFantasia !== e.razaoSocial && (
                            <div style={{ fontSize: 11.5, color: '#525252' }}>{e.nomeFantasia}</div>
                          )}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12.5, color: '#525252' }}>{formatarCnpj(e.cnpj)}</td>
                        <td>
                          {e.nfseConfig?.procuracaoStatus === 'ativa' ? (
                            <span className="badge badge-green">Procuração ativa</span>
                          ) : (
                            <span className="badge" style={{ background: '#f3f4f6', color: '#525252' }}>Cadastrada</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ background: '#600000', borderColor: '#600000', fontSize: 12, padding: '5px 12px' }}
                            onClick={ev => { ev.stopPropagation(); selecionarEmissorProprio(e); }}
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
          </>
        )}
      </div>
      {modalEmissores}
    </div>
  );

  return (
    <>
      <div
        className="page-header"
        style={{
          background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          padding: '24px 32px',
        }}
      >
        <div>
          <div style={{ marginBottom: 6 }}>
            <span style={{ background: '#600000', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 99 }}>
              Sefin Nacional • NFS-e (Tela Independente)
            </span>
          </div>
          <h1 className={serif.className} style={{ fontSize: 34, fontWeight: 400, color: '#fff', margin: 0, lineHeight: 1.05, letterSpacing: '-0.01em' }}>
            Notas Fiscais de Serviço
          </h1>
          {modoCliente && acessoCliente.empresas.length > 1 ? (
            <select
              className="form-control"
              style={{ marginTop: 8, maxWidth: 360, fontWeight: 500 }}
              aria-label="Empresa emissora"
              value={empresaId}
              onChange={e => {
                const escolhida = acessoCliente.empresas.find(x => x.id === e.target.value);
                if (escolhida) selecionarEmpresaCliente(escolhida);
              }}
            >
              {acessoCliente.empresas.map(e => (
                <option key={e.id} value={e.id}>
                  {e.nomeFantasia || e.razaoSocial}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 14, color: '#e5e7eb', fontWeight: 600 }}>
                {empresa?.razaoSocial || empresa?.nomeFantasia}
                {empresa?.cnpj ? <span style={{ fontWeight: 400, color: '#9ca3af' }}>{` · CNPJ ${formatarCnpj(empresa.cnpj)}`}</span> : ''}
              </div>
              {!modoCliente && (
                <button
                  type="button"
                  onClick={() => setShowEmissoresModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    borderRadius: 99,
                    padding: '3px 11px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <ArrowLeftRight size={12} /> Trocar Empresa
                </button>
              )}
            </div>
          )}
        </div>

        <div className="header-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
          {!modoCliente && (
            <>
              <button
                className="btn btn-secondary"
                style={{ background: '#fff', border: '1px solid #e5e5e5', color: '#171717', borderRadius: 8, fontWeight: 500, fontSize: 13.5 }}
                onClick={() => setShowEmissoresModal(true)}
              >
                Emissores por Procuração
              </button>
              <button
                className="btn btn-secondary"
                style={{ background: '#fff', border: '1px solid #e5e5e5', color: '#171717', borderRadius: 8, fontWeight: 500, fontSize: 13.5 }}
                onClick={() => setShowAcessoClienteModal(true)}
                disabled={!empresa}
              >
                Login do Cliente
              </button>
              <button
                className="btn btn-secondary"
                style={{ background: '#fff', border: '1px solid #e5e5e5', color: '#171717', borderRadius: 8, fontWeight: 500, fontSize: 13.5 }}
                onClick={() => setShowConfigModal(true)}
                disabled={!config}
              >
                Configurar Emissor
              </button>
              <button
                className="btn btn-secondary"
                style={{ background: '#fff', border: '1px solid #e5e5e5', color: '#7f1d1d', borderRadius: 8, fontWeight: 500, fontSize: 13.5 }}
                onClick={handleLimparSemChave}
              >
                Limpar Rascunhos
              </button>
            </>
          )}
          {emProducao && (
            <button
              className="btn btn-secondary"
              style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', borderRadius: 8, fontWeight: 600, fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={handleSincronizarSequenciaOficial}
              disabled={sincronizandoSequencia}
              title="Busca o último número emitido no portal oficial e sincroniza a sequência da DPS"
            >
              <RefreshCw size={14} className={sincronizandoSequencia ? 'animate-spin' : ''} />
              {sincronizandoSequencia ? 'Sincronizando...' : `Sincronizar Sequência Oficial (#${parametros?.proximoNDpsProducao || 1})`}
            </button>
          )}
          <button
            className="btn btn-secondary"
            style={{ background: '#fff', border: '1px solid #e5e5e5', color: '#171717', borderRadius: 8, fontWeight: 500, fontSize: 13.5 }}
            onClick={() => setShowBuscarNotas(true)}
            disabled={!config}
          >
            Buscar Emitidas / Tomadas
          </button>
          <button
            className="btn btn-secondary"
            style={{ background: '#fff', border: '1px solid #e5e5e5', color: '#171717', borderRadius: 8, fontWeight: 500, fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => {
              setMesExportacao(mesFiltro || hojeBrasilia().slice(0, 7));
              setPapelExportacao(papelFiltro);
              setShowExportarModal(true);
            }}
          >
            <Download size={14} /> Exportar Mês (XML/PDF)
          </button>
          <button
            className="btn btn-secondary"
            style={{ background: '#fff', border: '1px solid #e5e5e5', color: '#171717', borderRadius: 8, fontWeight: 500, fontSize: 13.5 }}
            onClick={() => setShowCopiarModal(true)}
          >
            Copiar Notas
          </button>
          <button
            className="btn btn-secondary"
            style={{ background: '#fff', border: '1px solid #e5e5e5', color: '#171717', borderRadius: 8, fontWeight: 500, fontSize: 13.5 }}
            onClick={() => setShowImportarModal(true)}
          >
            Importar Lista
          </button>
          {!modoCliente && (
            <button
              className="btn btn-secondary"
              style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1', borderRadius: 8, fontWeight: 600, fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => setShowCndModal(true)}
              title="Gerar o Relatório de Situação Fiscal (SITFIS) na Receita Federal e na PGFN"
            >
              🏛️ Situação Federal
            </button>
          )}
          <button
            type="button"
            style={{ background: 'rgba(124,58,237,0.18)', color: '#e9d5ff', border: '1px solid rgba(167,139,250,0.4)', borderRadius: 8, padding: '10px 16px', fontWeight: 600, fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => window.dispatchEvent(new CustomEvent('abrirCopilotoFiscal'))}
            title="Abrir o assistente de IA com o contexto fiscal"
          >
            <Sparkles size={14} /> Analista IA
          </button>
          <button
            className="btn"
            style={{ background: '#600000', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 500, fontSize: 13.5 }}
            onClick={openNovo}
          >
            Nova Nota Manual
          </button>
        </div>
      </div>

      <div className="page-body" style={{ background: '#fdfdfd', minHeight: '100%' }}>
        {/* Faixa de Situação da Integração — sóbria e direta */}
        {erroConfig ? (
          <div
            style={{
              background: '#fff',
              border: '1px solid #fca5a5',
              borderLeft: '3px solid #b91c1c',
              borderRadius: 12,
              padding: '12px 18px',
              marginBottom: 24,
              fontSize: 13.5,
              color: '#7f1d1d',
            }}
          >
            {erroConfig}
          </div>
        ) : config && (
          <div
            style={{
              background: '#fff',
              border: '1px solid #e5e5e5',
              borderLeft: `3px solid ${emProducao ? '#15803d' : '#b45309'}`,
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
            <div>
              <strong style={{ color: '#171717' }}>
                {emProducao ? 'Ambiente de Produção (com validade fiscal)' : 'Produção Restrita (ambiente de testes, sem valor fiscal)'}
              </strong>
              {emProducao && (
                <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
                  Próxima DPS Oficial: #{parametros?.proximoNDpsProducao || 1}
                </span>
              )}
              {' — '}
              {modoCliente ? (
                <>
                  {certificado && !certVencido && `Emissão por procuração com o certificado de ${certificado.titular?.replace(/:\d+$/, '') || 'seu contador'}. `}
                  {!prontoParaEmitir && AVISO_FALE_COM_ESCRITORIO}
                </>
              ) : (
                <>
                  {!certificado && (porProcuracao ? 'Envie o certificado do contador em Emissores por Procuração. ' : 'Envie o certificado da empresa em Configurar Emissor. ')}
                  {certVencido && 'Certificado digital vencido. '}
                  {certificado && !certVencido && porProcuracao && `Emissão por procuração (certificado válido até ${new Date(certificado.validoAte!).toLocaleDateString('pt-BR')}). `}
                  {certificado && !certVencido && !porProcuracao && `Certificado próprio (válido até ${new Date(certificado.validoAte!).toLocaleDateString('pt-BR')}). `}
                  {porProcuracao && parametros?.procuracaoStatus === 'sem_procuracao' && (
                    <strong style={{ color: '#b91c1c' }}>O contador não possui procuração ativa desta empresa. </strong>
                  )}
                  {porProcuracao && !parametros?.procuracaoStatus && 'Procuração ainda não verificada. '}
                  {!parametros?.codigoMunicipio && 'Informe o código IBGE do município em Configurar Emissor.'}
                </>
              )}
            </div>
          </div>
        )}

        {/* Resumo no padrão do Dashboard Fiscal / NF-e Destinadas: cartões clicáveis que filtram a lista. */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <CartaoResumoNfse
            rotulo="Notas Emitidas (Prestadas)"
            valor={fmt.currency(totais.emitidas)}
            sub={`${totais.qtdEmitidasPrestadas} nota(s) autorizada(s) no período`}
            acento="#16a34a"
            onClick={() => { setPapelFiltro('prestadas'); setStatusFiltro('emitida'); }}
          />
          <CartaoResumoNfse
            rotulo="Serviços Tomados (Recebidas)"
            valor={fmt.currency(totais.tomadasValor)}
            sub={`${totais.qtdTomadas} nota(s) tomada(s) de fornecedores`}
            onClick={() => { setPapelFiltro('tomadas'); setStatusFiltro(''); }}
          />
          <CartaoResumoNfse
            rotulo="Em Rascunho"
            valor={fmt.currency(totais.pendentes)}
            sub={`${totais.qtdRascunhos} nota(s) pendente(s) de envio`}
            acento={totais.qtdRascunhos > 0 ? '#b45309' : undefined}
            badge={totais.qtdRascunhos > 0 ? { texto: `${totais.qtdRascunhos} a enviar`, cor: '#b45309', fundo: '#fef3c7' } : null}
            onClick={() => { setPapelFiltro('prestadas'); setStatusFiltro('rascunho'); }}
          />
          <CartaoResumoNfse
            rotulo="Canceladas"
            valor={totais.qtdCanceladasAba}
            sub="Notas canceladas na visão atual"
            acento={totais.qtdCanceladasAba > 0 ? '#600000' : undefined}
            onClick={() => setStatusFiltro('cancelada')}
          />
        </div>

        {/* Seletor principal: Notas Emitidas (Prestador) vs Serviços Tomados (Tomador) + Filtro de Período em Tela */}
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
              onClick={() => { setPapelFiltro('prestadas'); setStatusFiltro(''); }}
              style={{
                background: papelFiltro === 'prestadas' ? '#600000' : 'transparent',
                color: papelFiltro === 'prestadas' ? '#fff' : '#374151',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 9,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Notas Emitidas — Prestador ({notasPrestadasNoPeriodo.length})
            </button>
            <button
              type="button"
              onClick={() => { setPapelFiltro('tomadas'); if (statusFiltro === 'rascunho') setStatusFiltro(''); }}
              style={{
                background: papelFiltro === 'tomadas' ? '#600000' : 'transparent',
                color: papelFiltro === 'tomadas' ? '#fff' : '#374151',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 9,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Serviços Tomados — Tomador ({notasTomadasNoPeriodo.length})
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#525252' }}>Mês:</span>
              <input
                type="month"
                className="form-control"
                style={{ width: 155, padding: '6px 10px', fontSize: 12.5, height: 34 }}
                value={mesFiltro}
                onChange={e => {
                  setMesFiltro(e.target.value);
                  if (e.target.value) {
                    setDataInicioFiltro('');
                    setDataFimFiltro('');
                  }
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#525252' }}>De:</span>
              <input
                type="date"
                className="form-control"
                style={{ width: 140, padding: '6px 10px', fontSize: 12.5, height: 34 }}
                value={dataInicioFiltro}
                onChange={e => {
                  setDataInicioFiltro(e.target.value);
                  if (e.target.value) setMesFiltro('');
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#525252' }}>Até:</span>
              <input
                type="date"
                className="form-control"
                style={{ width: 140, padding: '6px 10px', fontSize: 12.5, height: 34 }}
                value={dataFimFiltro}
                onChange={e => {
                  setDataFimFiltro(e.target.value);
                  if (e.target.value) setMesFiltro('');
                }}
              />
            </div>
            {(mesFiltro || dataInicioFiltro || dataFimFiltro) && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 12, padding: '5px 10px', height: 34 }}
                onClick={() => {
                  setMesFiltro('');
                  setDataInicioFiltro('');
                  setDataFimFiltro('');
                }}
              >
                Limpar período
              </button>
            )}
          </div>
        </div>

        {/* Barra de Busca e Abas de Situação */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 20,
          }}
        >
          <div
            className="search-bar"
            style={{
              flex: 1,
              minWidth: 260,
              maxWidth: 460,
              background: '#fff',
              border: '1px solid #e5e5e5',
              borderRadius: 99,
              padding: '8px 16px',
            }}
          >
            <Search size={15} style={{ color: '#525252' }} />
            <input
              placeholder={
                papelFiltro === 'tomadas'
                  ? 'Buscar por número, chave, prestador/fornecedor ou descrição...'
                  : 'Buscar por número, chave, tomador ou descrição...'
              }
              value={search}
              onChange={e => setSearch(e.target.value)}
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
            {(papelFiltro === 'tomadas'
              ? ([
                  { key: '', label: `Todas (${basePapel.length})` },
                  { key: 'emitida', label: `Autorizadas (${totais.qtdEmitidasAba})` },
                  { key: 'cancelada', label: `Canceladas (${totais.qtdCanceladasAba})` },
                ] as const)
              : ([
                  { key: '', label: `Todas (${basePapel.length})` },
                  { key: 'rascunho', label: `Rascunhos (${totais.qtdRascunhos})` },
                  { key: 'emitida', label: `Emitidas (${totais.qtdEmitidasAba})` },
                  { key: 'cancelada', label: `Canceladas (${totais.qtdCanceladasAba})` },
                ] as const)
            ).map(item => {
              const ativo = statusFiltro === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setStatusFiltro(item.key)}
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

        {/* Barra de Transmissão em Lote */}
        {notasSelecionadas.length > 0 && (
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
              <strong>{notasSelecionadas.length}</strong> nota(s) selecionada(s) —{' '}
              <strong>{fmt.currency(notasSelecionadas.reduce((soma, n) => soma + n.valorServicos, 0))}</strong>
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {exportaveisSelecionadas.length > 0 && (
                <>
                  <select
                    className="form-control"
                    aria-label="Formato da exportação"
                    style={{ width: 'auto', fontSize: 13, padding: '7px 10px' }}
                    value={formatoExportacao}
                    onChange={e => setFormatoExportacao(e.target.value as typeof formatoExportacao)}
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
                    onClick={handleExportarSelecionadas}
                    disabled={exportando || !!progressoLote}
                  >
                    <Download size={13} />
                    {exportando ? 'Gerando...' : `Baixar (${exportaveisSelecionadas.length})`}
                  </button>
                </>
              )}
              {excluiveisSelecionadas.length > 0 && (
                <button
                  className="btn btn-secondary"
                  style={{ background: '#fff', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 8, fontSize: 13 }}
                  onClick={() => handleExcluirSemChave(excluiveisSelecionadas)}
                  disabled={!!transmitindoId || !!progressoLote}
                >
                  Excluir ({excluiveisSelecionadas.length})
                </button>
              )}
              {rascunhosSelecionados.length > 0 && (
                <button
                  className="btn"
                  style={{ background: '#600000', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 500, padding: '8px 18px', fontSize: 13 }}
                  onClick={handleTransmitirLote}
                  disabled={!!transmitindoId || !!progressoLote}
                >
                  {progressoLote
                    ? `Transmitindo ${progressoLote.feitas + 1} de ${progressoLote.total}...`
                    : `${emProducao ? 'Emitir Selecionadas' : 'Emitir Selecionadas (Teste)'} (${rascunhosSelecionados.length})`}
                </button>
              )}
            </div>
            <button
              className="btn btn-secondary"
              style={{ background: '#fff', border: '1px solid #e5e5e5', color: '#525252', borderRadius: 8, fontSize: 13 }}
              onClick={() => setSelecionadas(new Set())}
              disabled={!!progressoLote}
            >
              Limpar seleção
            </button>
          </div>
        )}

        {/* Tabela Principal */}
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
                      aria-label="Selecionar todas as notas da lista"
                      title="Selecionar todas as notas da lista"
                      disabled={!!progressoLote || filtered.length === 0}
                      checked={todasMarcadas}
                      onChange={e => setSelecionadas(e.target.checked ? new Set(filtered.map(n => n.id)) : new Set())}
                    />
                  </th>
                  <th>Número</th>
                  <th>Emissão</th>
                  <th>{papelFiltro === 'tomadas' ? 'Prestador (Fornecedor)' : 'Tomador (Cliente)'}</th>
                  <th>Serviço</th>
                  <th>Competência</th>
                  <th>Situação</th>
                  <th style={{ textAlign: 'right' }}>Valor Líquido</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div style={{ padding: '56px 24px', textAlign: 'center' }}>
                        <h3 className={serif.className} style={{ fontSize: 26, fontWeight: 400, color: '#171717', marginBottom: 6 }}>
                          {papelFiltro === 'tomadas'
                            ? 'Nenhum serviço tomado encontrado neste período'
                            : 'Nenhuma nota fiscal emitida encontrada neste período'}
                        </h3>
                        <p style={{ fontSize: 14, color: '#525252', margin: 0 }}>
                          {papelFiltro === 'tomadas'
                            ? 'Clique em "Buscar Emitidas / Tomadas" no topo para sincronizar os serviços tomados no ADN Nacional.'
                            : 'Crie uma nota manual, busque notas no portal nacional ou ajuste o filtro de período.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map(n => {
                    const tomada = ehNotaTomada(n, cnpjEmpresaAtual);
                    const nomeContraparte = tomada ? (n.prestadorRazaoSocial || 'Prestador') : n.tomadorRazaoSocial;
                    const docContraparte = tomada ? n.prestadorCnpj : n.tomadorCnpjCpf;
                    return (
                      <tr key={n.id} style={{ opacity: n.status === 'cancelada' || ehSimulada(n) ? 0.6 : 1 }}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Selecionar nota de ${nomeContraparte}`}
                            disabled={!!progressoLote}
                            checked={selecionadas.has(n.id)}
                            onChange={() => alternarSelecao(n.id)}
                          />
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13.5, color: '#171717' }}>
                          {n.status === 'rascunho' ? <span style={{ color: '#9ca3af' }}>—</span> : n.numero}
                        </td>
                        <td style={{ fontSize: 13, whiteSpace: 'nowrap', color: '#525252' }}>{fmt.date(n.dataEmissao)}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#171717', fontSize: 13.5 }}>{nomeContraparte}</div>
                          <div style={{ fontSize: 11.5, color: '#525252', fontFamily: 'monospace' }}>{docContraparte}</div>
                        </td>
                        <td style={{ fontSize: 12.5, color: '#525252', maxWidth: 240 }}>
                          <div style={{ fontWeight: 600, color: '#171717' }}>{n.codigoServico}</div>
                          <div style={{ fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.discriminacao}</div>
                        </td>
                        <td style={{ fontSize: 13, color: '#525252' }}>{n.dataCompetencia}</td>
                        <td>
                          {statusBadge(n)}
                          {n.chaveAcesso && n.ambiente === 'homologacao' && (
                            <div style={{ fontSize: 10.5, color: '#b45309', marginTop: 3 }}>Teste, sem valor fiscal</div>
                          )}
                          {n.gerarContaReceber && (
                            <div style={{ fontSize: 10.5, color: '#525252', marginTop: 3 }}>
                              {n.lancamentoId ? 'Conta a receber gerada' : 'Gera conta a receber'}
                            </div>
                          )}
                          {n.status === 'rascunho' && n.ultimoErro && (
                            <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 3, maxWidth: 240 }}>{n.ultimoErro}</div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 13.5, color: n.status === 'cancelada' ? '#b91c1c' : '#171717' }}>
                          {fmt.currency(n.valorLiquido)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 12, padding: '5px 10px', background: '#fff', border: '1px solid #e5e5e5', color: '#171717', borderRadius: 6 }}
                              onClick={() => { setViewItem(n); setModalMode('ver'); }}
                            >
                              Ver
                            </button>
                            {n.chaveAcesso && (
                              <>
                                <a
                                  className="btn btn-secondary btn-sm"
                                  style={{ fontSize: 11.5, padding: '5px 8px', background: '#fff', border: '1px solid #e5e5e5', color: '#171717', borderRadius: 6, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  href={`/api/nfse/${n.id}/danfse?baixar=1`}
                                  title="Baixar DANFSe em PDF"
                                >
                                  <FileText size={12} /> PDF
                                </a>
                                <a
                                  className="btn btn-secondary btn-sm"
                                  style={{ fontSize: 11.5, padding: '5px 8px', background: '#fff', border: '1px solid #e5e5e5', color: '#171717', borderRadius: 6, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  href={`/api/nfse/${n.id}/xml`}
                                  download
                                  title="Baixar XML Oficial"
                                >
                                  <FileCode size={12} /> XML
                                </a>
                              </>
                            )}
                            {!tomada && n.status === 'rascunho' && (
                              <>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  style={{ fontSize: 12, padding: '5px 10px', background: '#fff', border: '1px solid #e5e5e5', color: '#171717', borderRadius: 6 }}
                                  onClick={() => abrirEdicao(n)}
                                >
                                  Editar
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  style={{ fontSize: 12, padding: '5px 10px', background: '#fff', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 6 }}
                                  onClick={() => handleExcluirSemChave([n])}
                                  disabled={!!transmitindoId || !!progressoLote}
                                >
                                  Excluir
                                </button>
                                <button
                                  className="btn btn-sm"
                                  style={{ fontSize: 12, padding: '5px 12px', background: '#600000', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500 }}
                                  onClick={() => handleTransmitir(n)}
                                  disabled={!!transmitindoId}
                                >
                                  {transmitindoId === n.id ? 'Enviando...' : 'Transmitir'}
                                </button>
                              </>
                            )}
                            {!tomada && n.status === 'emitida' && !n.cancelamentoEmAnalise && (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: 12, padding: '5px 10px', background: '#fff', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 6 }}
                                onClick={() => abrirCancelamento(n)}
                              >
                                Cancelar
                              </button>
                            )}
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
      </div>

      {/* ======================== MODAL EXPORTAR MÊS (XML / PDF) ======================== */}
      {showExportarModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2 className="modal-title">📦 Exportar Notas Fiscais (XML e PDF)</h2>
              <button className="modal-close" onClick={() => setShowExportarModal(false)} disabled={exportando}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Gera um pacote com os arquivos XML oficiais e/ou DANFSe em PDF de <strong>{empresa?.razaoSocial}</strong> para enviar à contabilidade ou guardar em arquivo.
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Mês de Emissão / Competência</label>
                <input
                  type="month"
                  className="form-control"
                  value={mesExportacao}
                  onChange={e => setMesExportacao(e.target.value)}
                  disabled={exportando}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de Notas</label>
                <select
                  className="form-control"
                  value={papelExportacao}
                  onChange={e => setPapelExportacao(e.target.value as 'prestadas' | 'tomadas' | 'todas')}
                  disabled={exportando}
                >
                  <option value="prestadas">Notas Emitidas (Prestador)</option>
                  <option value="tomadas">Serviços Tomados (Tomador)</option>
                  <option value="todas">Todas (Emitidas + Tomadas)</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label">Formato de Exportação</label>
              <select
                className="form-control"
                value={formatoExportacao}
                onChange={e => setFormatoExportacao(e.target.value as 'ambos' | 'xml' | 'pdf' | 'pdf_unico')}
                disabled={exportando}
              >
                <option value="ambos">ZIP completo (pastas XML + PDF separadas)</option>
                <option value="xml">Apenas arquivos XML (em ZIP)</option>
                <option value="pdf">Apenas DANFSe em PDF individuais (em ZIP)</option>
                <option value="pdf_unico">PDF Único consolidado (todas as notas em 1 PDF)</option>
              </select>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={incluirCanceladasExport}
                onChange={e => setIncluirCanceladasExport(e.target.checked)}
                disabled={exportando}
              />
              Incluir também notas canceladas no pacote
            </label>

            <div className="form-actions" style={{ marginTop: 22 }}>
              <button className="btn btn-secondary" onClick={() => setShowExportarModal(false)} disabled={exportando}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                style={{ background: '#600000', borderColor: '#600000' }}
                onClick={handleExportarMes}
                disabled={exportando}
              >
                {exportando ? '⏳ Gerando arquivos...' : '⬇️ Baixar Exportação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfigModal && (
        <NfseConfigModal
          empresaId={empresaId}
          cnpj={empresa?.cnpj}
          cnaes={cnaesEmpresa}
          config={config}
          onFechar={() => setShowConfigModal(false)}
          onSalvo={novaConfig => { setConfig(novaConfig); setShowConfigModal(false); }}
        />
      )}

      {modalEmissores}

      {showAcessoClienteModal && empresa && (
        <NfseAcessoClienteModal
          empresa={{
            id: empresa.id,
            razaoSocial: empresa.razaoSocial,
            nomeFantasia: empresa.nomeFantasia,
            cnpj: empresa.cnpj,
            procuracaoStatus: parametros?.procuracaoStatus ?? null,
          }}
          onFechar={() => setShowAcessoClienteModal(false)}
        />
      )}

      {showBuscarNotas && (
        <NfseBuscarNotasModal
          empresaId={empresaId}
          empresaNome={empresa?.nomeFantasia || empresa?.razaoSocial || ''}
          onFechar={() => setShowBuscarNotas(false)}
          onNotas={notas => {
            // Mescla com a cópia local: portador e vencimento de uma nota já conhecida são preservados.
            const locais = new Map(store.getNfsE(empresaId).map(n => [n.id, n]));
            const mescladas: NfsE[] = notas.map(n => ({ ...locais.get(n.id), ...n, createdAt: String(n.createdAt) }));
            store.saveManyNfsE(mescladas, true);
            setNfseList(store.getNfsE(empresaId));
          }}
          onConcluir={() => carregarConfig(empresaId)}
        />
      )}

      {showCopiarModal && (
        <NfseCopiarModal
          notas={notasPrestadasNoPeriodo}
          ambiente={parametros?.ambiente || 'homologacao'}
          portadores={portadores}
          planoContas={planoContas}
          onFechar={() => setShowCopiarModal(false)}
          onCriar={criarRascunhos}
        />
      )}

      {showImportarModal && (
        <NfseImportarModal
          notas={notasPrestadasNoPeriodo}
          clientes={clientes}
          padroes={{
            cTribNac: parametros?.cTribNacPadrao,
            cTribMun: parametros?.cTribMunPadrao,
            cNbs: parametros?.cNbsPadrao,
            municipioPrestacao: parametros?.codigoMunicipio,
          }}
          portadores={portadores}
          planoContas={planoContas}
          onFechar={() => setShowImportarModal(false)}
          onCriar={criarRascunhos}
        />
      )}

      {/* ======================== MODAL NOVA / EDITAR (NÃO FECHA AO CLICAR FORA) ======================== */}
      {modalMode === 'novo' && (
        <div className="modal-overlay">
          <div className="modal modal-lg" style={{ maxWidth: 860, maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
              <h2 className="modal-title">{form.id ? 'Editar rascunho de NFS-e' : 'Nova nota manual'}</h2>
              <button className="modal-close" onClick={() => setModalMode(null)}>✕</button>
            </div>

            {form.ultimoErro && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
                <strong>Última rejeição do Sefin:</strong> {form.ultimoErro}
              </div>
            )}

            {/* prestador */}
            <div style={secaoStyle}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#600000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>Prestador</div>
              <div style={{ fontSize: 13 }}>
                {empresa?.razaoSocial} — {empresa?.cnpj}
                {parametros?.inscricaoMunicipal ? ` — IM ${parametros.inscricaoMunicipal}` : ''}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>O Sefin usa o nome e o endereço do cadastro nacional.</div>
            </div>

            {/* tomador */}
            <div style={secaoStyle}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#171717', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>Tomador (Cliente)</div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Selecionar cliente cadastrado</label>
                <select className="form-control" value={form.clienteId || ''} onChange={e => { if (e.target.value) fillTomador(e.target.value); else setForm(f => ({ ...f, clienteId: undefined })); }}>
                  <option value="">— Preencher manualmente —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nomeFantasia || c.nome} — {c.cpfCnpj}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">CNPJ / CPF *</label>
                  <input
                    className="form-control"
                    placeholder="Digite o CNPJ para preencher os dados"
                    value={form.tomadorCnpjCpf || ''}
                    onChange={e => {
                      const documento = e.target.value;
                      const digitos = apenasDigitos(documento);
                      setForm(f => {
                        // Outro documento já não é aquele cliente: a nota não pode ficar vinculada a ele.
                        const cliente = clientes.find(c => c.id === f.clienteId);
                        const continuaCliente = cliente && apenasDigitos(cliente.cpfCnpj) === digitos;
                        return { ...f, tomadorCnpjCpf: documento, clienteId: continuaCliente ? f.clienteId : undefined };
                      });
                      if (cnpjValido(digitos)) preencherTomadorPeloCnpj(digitos, false);
                      else if (buscandoTomador) { ultimaConsultaTomador.current = ''; setBuscandoTomador(false); }
                    }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {buscandoTomador ? 'Consultando o CNPJ...' : 'Com CNPJ, o cadastro e o endereço são preenchidos sozinhos.'}
                  </div>
                </div>
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">Razão Social / Nome *</label>
                  <input className="form-control" value={form.tomadorRazaoSocial || ''} onChange={e => setForm(f => ({ ...f, tomadorRazaoSocial: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">E-mail</label>
                  <input type="email" className="form-control" value={form.tomadorEmail || ''} onChange={e => setForm(f => ({ ...f, tomadorEmail: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Inscrição municipal</label>
                  <input className="form-control" value={form.tomadorInscricaoMunicipal || ''} onChange={e => setForm(f => ({ ...f, tomadorInscricaoMunicipal: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">Logradouro</label>
                  <input className="form-control" value={form.tomadorEndereco || ''} onChange={e => setForm(f => ({ ...f, tomadorEndereco: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Número</label>
                  <input className="form-control" value={form.tomadorNumero || ''} onChange={e => setForm(f => ({ ...f, tomadorNumero: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Bairro</label>
                  <input className="form-control" value={form.tomadorBairro || ''} onChange={e => setForm(f => ({ ...f, tomadorBairro: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">CEP</label>
                  <input
                    className="form-control"
                    placeholder="Preenche o endereço"
                    value={form.tomadorCep || ''}
                    onChange={e => {
                      const cep = e.target.value;
                      setForm(f => ({ ...f, tomadorCep: cep }));
                      preencherEnderecoPeloCep(cep);
                    }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Município (código IBGE)</label>
                  <input className="form-control" maxLength={7} value={form.tomadorCodigoMunicipio || ''} onChange={e => setForm(f => ({ ...f, tomadorCodigoMunicipio: e.target.value, tomadorCidade: '', tomadorUf: '' }))} />
                  {form.tomadorCidade && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{form.tomadorCidade}{form.tomadorUf ? `/${form.tomadorUf}` : ''}</div>}
                </div>
              </div>
              {origemEndereco && <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 4 }}>{origemEndereco}</div>}
              {!enderecoCompleto && (
                <div style={{ fontSize: 11, color: issRetidoForm ? 'var(--red)' : 'var(--text-muted)' }}>
                  {issRetidoForm
                    ? 'Com ISS retido, logradouro, bairro, CEP e código IBGE são obrigatórios.'
                    : 'O endereço é opcional, mas só vai para a nota se logradouro, bairro, CEP e código IBGE estiverem preenchidos.'}
                </div>
              )}
            </div>

            {/* serviço */}
            <div style={secaoStyle}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#171717', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>Serviço</div>
              {(parametros?.servicosConhecidos?.length || 0) > 0 && (
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Serviços que esta empresa já emitiu</label>
                  <select className="form-control" value={String(parametros?.servicosConhecidos?.findIndex(s =>
                    s.cTribNac === (form.codigoServico || '').replace(/\D/g, '') && (s.cTribMun || '') === (form.cTribMun || '') && (s.cNbs || '') === (form.cNbs || ''),
                  ) ?? -1)} onChange={e => {
                    const s = parametros?.servicosConhecidos?.[Number(e.target.value)];
                    if (s) setForm(f => ({ ...f, codigoServico: s.cTribNac, cTribMun: s.cTribMun || '', cNbs: s.cNbs || '', discriminacao: f.discriminacao || s.descricao }));
                  }}>
                    <option value="-1">— Selecionar para preencher os códigos —</option>
                    {parametros?.servicosConhecidos?.map((s, i) => (
                      <option key={`${s.cTribNac}-${s.cTribMun}-${s.cNbs}`} value={i}>{s.cTribNac}{s.cTribMun ? ` / ${s.cTribMun}` : ''} — {s.descricao.slice(0, 70)} ({s.quantidade}x)</option>
                    ))}
                  </select>
                </div>
              )}
              <NfseServicoPicker
                cnaes={cnaesEmpresa}
                cTribNac={(form.codigoServico || '').replace(/\D/g, '')}
                cNbs={form.cNbs || ''}
                onChange={m => setForm(f => ({
                  ...f,
                  ...(m.cTribNac !== undefined ? { codigoServico: m.cTribNac } : {}),
                  ...(m.cNbs !== undefined ? { cNbs: m.cNbs } : {}),
                  ...(m.descricao && !f.discriminacao ? { discriminacao: m.descricao } : {}),
                }))}
              />
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Competência *</label>
                  <input type="month" className="form-control" max={hojeBrasilia().slice(0, 7)} value={form.dataCompetencia || ''} onChange={e => setForm(f => ({ ...f, dataCompetencia: e.target.value }))} />
                </div>
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Cód. Tributação Nacional / Municipal *</label>
                    {(parametros?.cTribNacPadrao || parametros?.servicosConhecidos?.[0]?.cTribNac) && (
                      <button
                        type="button"
                        onClick={() => {
                          const padrao = parametros?.cTribNacPadrao || parametros?.servicosConhecidos?.[0]?.cTribNac || '';
                          setForm(f => ({ ...f, codigoServico: padrao, cTribMun: '' }));
                          toast.success(`Código de tributação ${padrao} preenchido.`);
                        }}
                        style={{ background: 'none', border: 'none', color: '#600000', fontSize: 11, cursor: 'pointer', fontWeight: 600, padding: 0 }}
                      >
                        ⚡ Puxar da empresa
                      </button>
                    )}
                  </div>
                  <input
                    className="form-control"
                    maxLength={6}
                    placeholder="6 dígitos (ex: 171901)"
                    value={form.codigoServico || ''}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setForm(f => ({ ...f, codigoServico: v }));
                    }}
                    style={{ marginTop: 4 }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Item da LC 116 (ex: 171901). É o mesmo código nacional e municipal.
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Subcódigo Municipal <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Opcional)</span>
                  </label>
                  <input
                    className="form-control"
                    maxLength={3}
                    placeholder="Até 3 dígitos (ex: 001)"
                    value={form.cTribMun || ''}
                    onChange={e => {
                      let v = e.target.value.trim();
                      if (v.length === 6 && /^\d{6}$/.test(v)) {
                        setForm(f => ({ ...f, codigoServico: v, cTribMun: '' }));
                        return;
                      }
                      setForm(f => ({ ...f, cTribMun: v.slice(0, 3) }));
                    }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Se o município usa o código padrão (171901), <strong>deixe em branco</strong>.
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Código NBS</label>
                  <input className="form-control" placeholder="9 dígitos" value={form.cNbs || ''} onChange={e => setForm(f => ({ ...f, cNbs: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Município da prestação (IBGE) *</label>
                  <input className="form-control" maxLength={7} value={form.municipioPrestacao || ''} onChange={e => setForm(f => ({ ...f, municipioPrestacao: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Descrição do serviço *</label>
                <textarea className="form-control" rows={4} maxLength={2000} style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                  placeholder="Descreva os serviços prestados (aparece na NFS-e)..."
                  value={form.discriminacao || ''} onChange={e => setForm(f => ({ ...f, discriminacao: e.target.value }))} />
              </div>
            </div>

            {/* valores */}
            <div style={secaoStyle}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#600000', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>Valores e Retenções</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Valor do serviço (R$) *</label>
                  <input type="number" step="0.01" min="0" className="form-control" value={form.valorServicos ?? ''} onChange={e => setForm(f => ({ ...f, valorServicos: Number(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Alíquota ISS (%){aliquotaObrigatoria ? ' *' : ''}</label>
                  <input type="number" step="0.01" min="0" className="form-control" value={form.aliquotaIss ?? ''} onChange={e => setForm(f => ({ ...f, aliquotaIss: Number(e.target.value) }))} />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {aliquotaObrigatoria ? 'Enviada na nota: obrigatória neste regime.' : 'Só para estimativa: quem define é a parametrização do município.'}
                  </div>
                </div>
                {ehSimples && (
                  <div className="form-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label className="form-label" style={{ marginBottom: 0 }}>Alíquota do Simples Nacional (%) *</label>
                      <button
                        type="button"
                        onClick={buscarAliquotaIntegraContador}
                        disabled={buscandoAliquotaSerpro}
                        style={{
                          background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          padding: '3px 8px',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: buscandoAliquotaSerpro ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                        title="Busca a alíquota apurada na Receita Federal via Integra Contador (SERPRO)"
                      >
                        {buscandoAliquotaSerpro ? 'Buscando no SERPRO...' : '⚡ Buscar no Integra Contador'}
                      </button>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      className="form-control"
                      value={aliquotaSimplesForm}
                      onChange={e => {
                        setAliquotaSimplesDigitada(e.target.value);
                        setInfoAliquotaSerpro(null);
                      }}
                    />
                    {infoAliquotaSerpro && (
                      <div style={{ fontSize: 11, color: '#059669', fontWeight: 600, marginTop: 4 }}>
                        ✓ {infoAliquotaSerpro}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {modoCliente
                        ? 'Percentual aproximado de tributos informado na nota. Vale para esta emissão.'
                        : 'Percentual aproximado de tributos informado na nota. Fica salvo para as próximas notas desta empresa.'}
                    </div>
                  </div>
                )}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 16 }}>
                <input type="checkbox" checked={issRetidoForm} onChange={e => { setRetencaoManual(true); setRegraAplicada(''); setForm(f => ({ ...f, issRetido: e.target.checked })); }} />
                <span style={{ fontSize: 13 }}>ISS retido pelo tomador</span>
              </label>

              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Tributos federais retidos</div>
              {regraAplicada && <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 6 }}>Preenchido pela regra &quot;{regraAplicada}&quot;. Se alterar um percentual, a nota fica com o valor que você definir.</div>}
              {parametros?.opSimpNac === 2 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>MEI não informa tributos federais na nota.</div>
              ) : (
                <div className="form-row" style={{ marginBottom: 16 }}>
                  {TRIBUTOS_RETIDOS.map(t => (
                    <div className="form-group" key={t.chave}>
                      <label className="form-label">{t.nome} (%)</label>
                      <input type="number" step="0.01" min="0" max="100" className="form-control" value={percentuaisRetencao[t.chave]}
                        onChange={e => {
                          setRetencaoManual(true);
                          setRegraAplicada('');
                          setPercentuaisRetencao(p => ({ ...p, [t.chave]: Number(e.target.value) }));
                        }} />
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{fmt.currency(retidosForm[t.chave])}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Valor Bruto</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt.currency(valorForm)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>ISS estimado ({aliquotaForm}%)</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt.currency(estimativa.valorIss)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700 }}>Líquido estimado</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>{fmt.currency(estimativa.valorLiquido)}</div>
                  {totalRetidoFederal(retidosForm) > 0 && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Federais retidos: {fmt.currency(totalRetidoFederal(retidosForm))}</div>}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Os valores oficiais são os devolvidos pelo Sefin na autorização.</div>
            </div>

            {/* financeiro */}
            <div style={secaoStyle}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#171717', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>Financeiro (opcional)</div>
              <NfseFinanceiroCampos
                valor={financeiroForm}
                portadores={portadores}
                planoContas={planoContas}
                onChange={f => setForm(atual => ({ ...atual, ...f }))}
              />
            </div>

            <div className="form-actions" style={{ marginTop: 24, gap: 10 }}>
              {form.id && !form.chaveAcesso && (
                <button
                  className="btn btn-secondary"
                  style={{ marginRight: 'auto', border: '1px solid #fca5a5', color: '#b91c1c' }}
                  onClick={async () => {
                    const salva = store.getNfsE(empresaId).find(n => n.id === form.id);
                    if (salva && await handleExcluirSemChave([salva])) setModalMode(null);
                  }}
                  disabled={!!transmitindoId}
                >
                  Excluir rascunho
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setModalMode(null)}>Cancelar</button>
              <button className="btn btn-secondary" onClick={() => handleSave(false)} disabled={!!transmitindoId}>Salvar Rascunho</button>
              <button className="btn btn-primary" style={{ background: '#600000', borderColor: '#600000' }} onClick={() => handleSave(true)} disabled={!!transmitindoId}>
                {transmitindoId ? 'Transmitindo ao Sefin...' : emProducao ? 'Emitir Nota Real' : 'Emitir Nota de Teste'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================== DANFSe (nota autorizada) ======================== */}
      {modalMode === 'ver' && viewItem?.chaveAcesso && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 900, width: '95vw', height: '95vh', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', gap: 8, flexWrap: 'wrap' }}>
              <h2 className="modal-title" style={{ margin: 0 }}>NFS-e Nº {viewItem.numero}</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <a className="btn btn-primary" style={{ background: '#600000', borderColor: '#600000' }} href={`/api/nfse/${viewItem.id}/danfse?baixar=1`}>Baixar PDF</a>
                <a className="btn btn-secondary" href={`/api/nfse/${viewItem.id}/xml`} download>Baixar XML</a>
                <button className="modal-close" onClick={() => setModalMode(null)}>✕</button>
              </div>
            </div>
            <iframe title={`DANFSe da NFS-e ${viewItem.numero}`} src={`/api/nfse/${viewItem.id}/danfse`} style={{ flex: 1, width: '100%', border: 'none', background: '#525659' }} />
          </div>
        </div>
      )}

      {/* ======================== MODAL VISUALIZAR ======================== */}
      {modalMode === 'ver' && viewItem && !viewItem.chaveAcesso && (
        <div className="modal-overlay">
          <div className="modal nfse-doc-container" style={{ maxWidth: 800, padding: 0, background: '#fff', color: '#000', fontFamily: 'Arial, sans-serif', maxHeight: '95vh', overflowY: 'auto' }}>
            <style dangerouslySetInnerHTML={{
              __html: `
              @media print {
                body * { visibility: hidden !important; }
                .nfse-doc-container, .nfse-doc-container * { visibility: visible !important; }
                .nfse-doc-container { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; max-width: none !important; margin: 0 !important; border-radius: 0 !important; max-height: none !important; }
                .no-print { display: none !important; }
              }
            ` }} />

            {/* Header actions */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {viewItem.status === 'rascunho' ? 'Rascunho de NFS-e' : `NFS-e Nº ${viewItem.numero}`} &nbsp;
                {ehSimulada(viewItem) ? <span style={{ color: '#6b7280', fontSize: 13 }}>Simulada</span> : viewItem.status === 'emitida' ? <span style={{ color: '#16a34a', fontSize: 13 }}>Emitida</span> : viewItem.status === 'cancelada' ? <span style={{ color: '#dc2626', fontSize: 13 }}>Cancelada</span> : <span style={{ color: '#d97706', fontSize: 13 }}>Rascunho</span>}
              </h2>
              <div style={{ display: 'flex', gap: 8 }}>
                {viewItem.chaveAcesso && (
                  <a className="btn btn-secondary" href={`/api/nfse/${viewItem.id}/xml`} download>Baixar XML</a>
                )}
                <button className="btn btn-primary" style={{ background: '#1e293b' }} onClick={() => window.print()}>Imprimir</button>
                <button className="modal-close" onClick={() => setModalMode(null)}>✕</button>
              </div>
            </div>

            {/* NFS-e Document */}
            <div style={{ padding: 28 }}>
              <div style={{ textAlign: 'center', borderBottom: '3px solid #1e293b', paddingBottom: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>
                  Espelho interno — não substitui o DANFSe
                </div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>NOTA FISCAL DE SERVIÇOS ELETRÔNICA</div>
                <div style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>NFS-e — LC 116/2003</div>
              </div>

              {/* Número e verificação */}
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 16px', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Número da NFS-e</div>
                  <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'monospace' }}>{viewItem.numero}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Série</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{viewItem.serie}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Data de Emissão</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt.date(viewItem.dataEmissao)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Competência</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{viewItem.dataCompetencia}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Chave de Acesso</div>
                  <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', wordBreak: 'break-all', maxWidth: 240, color: viewItem.chaveAcesso ? '#15803d' : '#9ca3af' }}>
                    {viewItem.chaveAcesso || 'SEM CHAVE'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Situação</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: viewItem.status === 'emitida' ? '#15803d' : viewItem.status === 'cancelada' ? '#dc2626' : '#d97706' }}>
                    {viewItem.status.toUpperCase()}
                  </div>
                </div>
              </div>

              {viewItem.chaveAcesso && viewItem.ambiente === 'homologacao' && (
                <div style={{ border: '2px solid #d97706', borderRadius: 6, padding: '8px 12px', marginBottom: 12, textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#b45309' }}>
                  PRODUÇÃO RESTRITA — NOTA DE TESTE, SEM VALIDADE JURÍDICA
                </div>
              )}
              {ehSimulada(viewItem) && (
                <div style={{ border: '2px solid #6b7280', borderRadius: 6, padding: '8px 12px', marginBottom: 12, textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#374151' }}>
                  NOTA SIMULADA — NUNCA FOI TRANSMITIDA AO SEFIN
                </div>
              )}
              {viewItem.cancelamentoEmAnalise && (
                <div style={{ background: '#fffbeb', border: '2px solid #d97706', borderRadius: 6, padding: '8px 12px', marginBottom: 12, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#b45309' }}>
                  CANCELAMENTO EM ANÁLISE PELO MUNICÍPIO — A NOTA SEGUE VÁLIDA
                </div>
              )}

              {/* Prestador */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: 6, marginBottom: 12, overflow: 'hidden' }}>
                <div style={{ background: '#1e293b', color: '#fff', padding: '6px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Prestador de Serviços</div>
                <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <div style={{ gridColumn: '1 / 3' }}>
                    <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Razão Social</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{viewItem.prestadorRazaoSocial}</div>
                  </div>
                  <div><div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>CNPJ</div><div style={{ fontSize: 11, fontFamily: 'monospace' }}>{viewItem.prestadorCnpj}</div></div>
                  {viewItem.prestadorInscricaoMunicipal && <div><div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Insc. Municipal</div><div style={{ fontSize: 11 }}>{viewItem.prestadorInscricaoMunicipal}</div></div>}
                </div>
              </div>

              {/* Tomador */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: 6, marginBottom: 12, overflow: 'hidden' }}>
                <div style={{ background: '#166534', color: '#fff', padding: '6px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Tomador de Serviços</div>
                <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <div style={{ gridColumn: '1 / 3' }}><div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Razão Social / Nome</div><div style={{ fontSize: 12, fontWeight: 700 }}>{viewItem.tomadorRazaoSocial}</div></div>
                  <div><div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>CNPJ / CPF</div><div style={{ fontSize: 11, fontFamily: 'monospace' }}>{viewItem.tomadorCnpjCpf}</div></div>
                  {viewItem.tomadorEndereco && <div style={{ gridColumn: '1 / 3' }}><div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Endereço</div><div style={{ fontSize: 11 }}>{viewItem.tomadorEndereco}</div></div>}
                  {viewItem.tomadorCidade && <div><div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Município</div><div style={{ fontSize: 11 }}>{viewItem.tomadorCidade}/{viewItem.tomadorUf}</div></div>}
                </div>
              </div>

              {/* Discriminação */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: 6, marginBottom: 12, overflow: 'hidden' }}>
                <div style={{ background: '#78350f', color: '#fff', padding: '6px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Discriminação dos Serviços</div>
                <div style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 20, marginBottom: 8, flexWrap: 'wrap' }}>
                    <div><div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Código do Serviço</div><div style={{ fontSize: 12, fontWeight: 700 }}>{viewItem.codigoServico}</div></div>
                  </div>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, padding: '10px 12px', fontSize: 11, lineHeight: '18px', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                    {viewItem.discriminacao}
                  </div>
                </div>
              </div>

              {/* Valores */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: 6, marginBottom: 16, overflow: 'hidden' }}>
                <div style={{ background: '#1e3a5f', color: '#fff', padding: '6px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Valores e Tributos</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
                  {[
                    { label: 'Valor dos Serviços', value: viewItem.valorServicos },
                    { label: 'Deduções', value: viewItem.valorDeducoes },
                    { label: 'Base de Cálculo', value: viewItem.valorBaseCalculo },
                    { label: `ISS ${viewItem.aliquotaIss}% ${viewItem.issRetido ? '(RETIDO)' : ''}`, value: viewItem.valorIss, highlight: true },
                    ...[
                      { label: 'IRRF retido', value: viewItem.valorIr },
                      { label: 'PIS retido', value: viewItem.valorPis },
                      { label: 'COFINS retido', value: viewItem.valorCofins },
                      { label: 'CSLL retido', value: viewItem.valorCsll },
                      { label: 'INSS retido', value: viewItem.valorInss },
                    ].filter(r => r.value > 0).map(r => ({ ...r, highlight: false })),
                  ].map(({ label, value, highlight }) => (
                    <div key={label} style={{ padding: '8px 12px', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', background: highlight ? '#f0fdf4' : 'transparent' }}>
                      <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>{label}</div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{fmt.currency(value)}</div>
                    </div>
                  ))}
                  <div style={{ padding: '12px 16px', gridColumn: '4 / 5', background: '#0f172a', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: 1 }}>Valor Líquido</div>
                    <div style={{ fontSize: 22, fontWeight: 900 }}>{fmt.currency(viewItem.valorLiquido)}</div>
                  </div>
                </div>
              </div>

              {/* Cancelamento info */}
              {viewItem.status === 'cancelada' && (
                <div style={{ background: '#fef2f2', border: '2px solid #fca5a5', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#dc2626' }}>NOTA FISCAL CANCELADA</div>
                  {viewItem.motivoCancelamento && <div style={{ fontSize: 12, color: '#7f1d1d', marginTop: 4 }}>Motivo: {viewItem.motivoCancelamento}</div>}
                </div>
              )}

              {/* Rascunho info */}
              {viewItem.status === 'rascunho' && (
                <div style={{ border: '2px dashed #d97706', borderRadius: 8, padding: '12px 16px', textAlign: 'center', background: '#fffbeb' }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#d97706', marginBottom: 12 }}>RASCUNHO — Esta nota ainda não foi autorizada pelo Sefin</div>
                  <button className="btn btn-primary no-print" style={{ background: '#600000', borderColor: '#600000' }} onClick={() => handleTransmitir(viewItem)} disabled={!!transmitindoId}>
                    Transmitir ao Sefin
                  </button>
                </div>
              )}

              {viewItem.lancamentoId && (
                <div style={{ marginTop: 12, padding: '8px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, fontSize: 11, color: '#166534' }}>
                  Conta a Receber gerada automaticamente — ID: {viewItem.lancamentoId}
                  {viewItem.vencimento && ` | Vencimento: ${fmt.date(viewItem.vencimento)}`}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================== MODAL CANCELAR ======================== */}
      {cancelModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2 className="modal-title">Cancelar NFS-e Nº {cancelModal.numero}</h2>
              <button className="modal-close" onClick={() => setCancelModal(null)}>✕</button>
            </div>
            <div style={{ marginBottom: 8, padding: '12px 14px', background: 'var(--bg-card2)', borderRadius: 8, fontSize: 13 }}>
              <strong>Tomador:</strong> {cancelModal.tomadorRazaoSocial}<br />
              <strong>Valor:</strong> {fmt.currency(cancelModal.valorLiquido)}<br />
              <strong>Emissão:</strong> {fmt.date(cancelModal.dataEmissao)}
            </div>
            {exigeAnalise && (
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: 13 }}>
                Este município não aceita cancelamento direto. A nota seguirá válida até o fisco municipal decidir sobre a análise.
              </div>
            )}
            {cancelModal.chaveAcesso && (
              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Motivo *</label>
                <select className="form-control" value={motivoCancel} onChange={e => setMotivoCancel(Number(e.target.value))}>
                  {Object.entries(MOTIVOS_CANCELAMENTO).map(([codigo, descricao]) => <option key={codigo} value={codigo}>{descricao}</option>)}
                </select>
              </div>
            )}
            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label">Justificativa * (15 a 200 caracteres)</label>
              <textarea className="form-control" rows={3} maxLength={200} value={justificativaCancel} onChange={e => setJustificativaCancel(e.target.value)} placeholder="Descreva o motivo do cancelamento..." />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{justificativaCancel.trim().length}/200</div>
            </div>
            <div className="form-actions" style={{ marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setCancelModal(null)}>Voltar</button>
              <button className="btn btn-danger" onClick={handleCancelar} disabled={cancelando}>
                {cancelando ? 'Enviando...' : exigeAnalise ? 'Solicitar Análise Fiscal' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCndModal && (
        <CertidaoFederalModal
          empresaIdInicial={empresaId}
          onFechar={() => setShowCndModal(false)}
        />
      )}
    </>
  );
}
