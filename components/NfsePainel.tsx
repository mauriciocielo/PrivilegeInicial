'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  store, type NfsE, type Cliente, type Empresa, type Portador, type PlanoConta, uid,
} from '../lib/store';
import { fmt } from '../lib/reports';
import { toast } from 'sonner';
import { confirmAsync } from './ConfirmProvider';
import NfseConfigModal, { type NfseConfigResposta } from './NfseConfigModal';
import NfseEmissoresModal, { type EmpresaEmissora } from './NfseEmissoresModal';
import { TIPO_EMPRESA_SO_EMISSOR } from '../lib/nfse/emissor';
import { useAcessoNfse, type EmpresaLiberada } from '../lib/nfse/use-acesso-nfse';
import NfseCopiarModal from './NfseCopiarModal';
import NfseImportarModal from './NfseImportarModal';
import NfseFinanceiroCampos, { financeiroInvalido, type FinanceiroNota } from './NfseFinanceiroCampos';
import { MOTIVOS_CANCELAMENTO, enderecoTomadorCompleto, exigeAliquotaNaDps, hojeBrasilia } from '../lib/nfse/dps';
import { estimarValoresNota, type DadosCopiaveis } from '../lib/nfse/lote';
import NfseServicoPicker from './NfseServicoPicker';
import NfseBuscarNotasModal from './NfseBuscarNotasModal';
import {
  SEM_RETENCAO, TRIBUTOS_RETIDOS, calcularRetidos, escolherRegra, percentuaisDosValores, totalRetidoFederal, type ValoresRetidos,
} from '../lib/nfse/retencao';

type ModalMode = 'novo' | 'ver' | null;

type ResultadoEnvio =
  | { resultado: 'autorizada'; nota: NfsE; recuperada: boolean; alertas: string[] }
  | { resultado: 'rejeitada' | 'incerta'; mensagem: string };

const secaoStyle = { background: 'var(--bg-card2)', borderRadius: 8, padding: 14, marginBottom: 16, border: '1px solid var(--border-light)' };

const AVISO_FALE_COM_ESCRITORIO = 'O escritório ainda precisa concluir a configuração desta empresa para emitir.';

// Empresa só emissora não existe no navegador nem na barra lateral: a escolha fica aqui.
const CHAVE_EMISSOR_AVULSO = 'cf_nfse_emissor';

function lerEmissorAvulso(): Pick<Empresa, 'id' | 'razaoSocial' | 'nomeFantasia' | 'cnpj'> | null {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE_EMISSOR_AVULSO) || 'null');
  } catch {
    return null;
  }
}

// Notas anteriores à integração foram geradas pela simulação: nunca passaram pelo Sefin.
const ehSimulada = (n: NfsE) => n.status !== 'rascunho' && !n.chaveAcesso;

/** Tela de NFS-e. No modo cliente, escondem-se certificado, configuracao e limpeza: o servidor valida tudo de novo. */
export default function NfsePainel({ modoCliente = false }: { modoCliente?: boolean }) {
  const [empresaId, setEmpresaId] = useState('');
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [nfseList, setNfseList] = useState<NfsE[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [portadores, setPortadores] = useState<Portador[]>([]);
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [viewItem, setViewItem] = useState<NfsE | null>(null);
  const [search, setSearch] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<'' | 'rascunho' | 'emitida' | 'cancelada'>('');

  const [config, setConfig] = useState<NfseConfigResposta | null>(null);
  const [erroConfig, setErroConfig] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [transmitindoId, setTransmitindoId] = useState<string | null>(null);
  const [showEmissoresModal, setShowEmissoresModal] = useState(false);
  const [showCopiarModal, setShowCopiarModal] = useState(false);
  const [showImportarModal, setShowImportarModal] = useState(false);
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

  const load = useCallback((eId: string) => {
    if (!eId) return;
    setEmpresaId(eId);
    setNfseList(store.getNfsE(eId));
    setClientes(store.getClientes(eId).filter(c => c.ativo));
    setPortadores(store.getPortadores(eId).filter(p => p.ativo));
    setPlanoContas(store.getPlanoContas(eId).filter(p => p.nivel === 3 && p.ativo && p.tipo === 'receita'));
    const avulso = lerEmissorAvulso();
    setEmpresa(store.getEmpresas().find(e => e.id === eId) || (avulso?.id === eId ? avulso as Empresa : null));
    // A versão simulada guardava a senha do certificado em texto puro aqui.
    localStorage.removeItem(`cf_nfse_portal_config_${eId}`);
  }, []);

  const acessoCliente = useAcessoNfse(modoCliente);

  const selecionarEmpresaCliente = useCallback((escolhida: EmpresaLiberada) => {
    sessionStorage.setItem(CHAVE_EMISSOR_AVULSO, JSON.stringify(escolhida));
    setSelecionadas(new Set());
    load(escolhida.id);
    carregarConfig(escolhida.id);
  }, [load, carregarConfig]);

  // O cliente só escolhe entre as próprias empresas com procuração, não importa o que esteja salvo.
  useEffect(() => {
    if (!modoCliente || acessoCliente.empresas.length === 0) return;
    const salva = lerEmissorAvulso()?.id;
    selecionarEmpresaCliente(acessoCliente.empresas.find(e => e.id === salva) || acessoCliente.empresas[0]);
    const aoMudarDados = () => { const atual = lerEmissorAvulso()?.id; if (atual) load(atual); };
    window.addEventListener('cfDataChange', aoMudarDados);
    return () => window.removeEventListener('cfDataChange', aoMudarDados);
  }, [modoCliente, acessoCliente.empresas, selecionarEmpresaCliente, load]);

  useEffect(() => {
    if (modoCliente) return;
    const saved = lerEmissorAvulso()?.id || sessionStorage.getItem('cf_empresa_sel') || '';
    if (saved) { load(saved); carregarConfig(saved); }
    const handler = (e: Event) => {
      // Escolher uma empresa na barra lateral encerra o uso do emissor avulso.
      sessionStorage.removeItem(CHAVE_EMISSOR_AVULSO);
      const id = (e as CustomEvent).detail;
      load(id);
      carregarConfig(id);
    };
    const dataChangeHandler = () => {
      const current = lerEmissorAvulso()?.id || sessionStorage.getItem('cf_empresa_sel') || '';
      if (current) load(current);
    };
    window.addEventListener('empresaChange', handler);
    window.addEventListener('cfDataChange', dataChangeHandler);
    return () => {
      window.removeEventListener('empresaChange', handler);
      window.removeEventListener('cfDataChange', dataChangeHandler);
    };
  }, [modoCliente, load, carregarConfig]);

  const filtered = useMemo(() => {
    return nfseList.filter(n => {
      if (statusFiltro && n.status !== statusFiltro) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return n.numero.includes(s) || n.tomadorRazaoSocial.toLowerCase().includes(s) || n.discriminacao.toLowerCase().includes(s) || (n.chaveAcesso || '').includes(s);
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [nfseList, search, statusFiltro]);

  const totais = useMemo(() => {
    // Só nota real de produção conta como faturamento.
    const reais = nfseList.filter(n => n.chaveAcesso && n.ambiente === 'producao');
    const rascunhos = nfseList.filter(n => n.status === 'rascunho');
    return {
      emitidas: reais.filter(n => n.status === 'emitida').reduce((a, n) => a + n.valorLiquido, 0),
      qtdEmitidas: reais.filter(n => n.status === 'emitida').length,
      qtdCanceladas: reais.filter(n => n.status === 'cancelada').length,
      pendentes: rascunhos.reduce((a, n) => a + n.valorServicos, 0),
      qtdRascunhos: rascunhos.length,
    };
  }, [nfseList]);

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

  const openNovo = () => {
    setPercentuaisRetencao(SEM_RETENCAO);
    setRetencaoManual(false);
    setRegraAplicada('');
    if (!prontoParaEmitir) {
      toast.info(modoCliente ? `${AVISO_FALE_COM_ESCRITORIO} O rascunho pode ser salvo mesmo assim.` : 'Configure o município e o certificado antes de emitir. O rascunho pode ser salvo mesmo assim.');
    }
    setForm({
      empresaId,
      numero: store.getNextNfseNumero(empresaId),
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
      codigoServico: parametros?.cTribNacPadrao || '',
      cTribMun: parametros?.cTribMunPadrao || '',
      cNbs: parametros?.cNbsPadrao || '',
      municipioPrestacao: parametros?.codigoMunicipio || '',
      discriminacao: '',
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
  };

  const montarRascunho = (): NfsE => {
    const valorServicos = Math.round(valorForm * 100) / 100;
    return {
      ...(form as NfsE),
      id: form.id || uid(),
      empresaId,
      numero: form.numero || store.getNextNfseNumero(empresaId),
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

    const rascunho = montarRascunho();
    store.saveNfsE(rascunho);
    setNfseList(store.getNfsE(empresaId));
    if (!emitir) { setModalMode(null); return; }
    // O formulário só fecha se autorizada: em uma rejeição o usuário corrige ali mesmo.
    const autorizada = await handleTransmitir(rascunho);
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

  const enviarAoSefin = async (nfse: NfsE): Promise<ResultadoEnvio> => {
    setTransmitindoId(nfse.id);
    try {
      const res = await fetch('/api/nfse/emitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, nota: nfse }),
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
  const handleTransmitir = async (nfse: NfsE): Promise<boolean> => {
    if (transmitindoId || !garantirPronto()) return false;
    if (emProducao) {
      const confirmado = await confirmAsync(`Emitir nota fiscal REAL de ${fmt.currency(nfse.valorServicos)} para ${nfse.tomadorRazaoSocial}?`);
      if (!confirmado) return false;
    }

    const envio = await enviarAoSefin(nfse);
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

  const rascunhosSelecionados = nfseList.filter(n => n.status === 'rascunho' && selecionadas.has(n.id));

  const alternarSelecao = (id: string) => setSelecionadas(atual => {
    const novo = new Set(atual);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    return novo;
  });

  const handleTransmitirLote = async () => {
    if (transmitindoId || progressoLote || rascunhosSelecionados.length === 0 || !garantirPronto()) return;
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
      onFechar={() => setShowEmissoresModal(false)}
      onCertificadoAlterado={() => { if (empresaId) carregarConfig(empresaId); }}
      onSelecionar={(emissor: EmpresaEmissora) => {
        setShowEmissoresModal(false);
        setSelecionadas(new Set());
        if (emissor.tipo === TIPO_EMPRESA_SO_EMISSOR) {
          const { id, razaoSocial, nomeFantasia, cnpj } = emissor;
          sessionStorage.setItem(CHAVE_EMISSOR_AVULSO, JSON.stringify({ id, razaoSocial, nomeFantasia, cnpj }));
          load(id);
          carregarConfig(id);
          return;
        }
        // A barra lateral faz a troca e avisa as telas pelo evento empresaChange.
        window.dispatchEvent(new CustomEvent('selecionarEmpresa', { detail: emissor.id }));
      }}
    />
  );

  if (!empresaId) return (
    <div className="page-body">
      <div className="empty-state">
        <div className="empty-state-icon">🏢</div>
        {modoCliente ? (
          <h3>⏳ Carregando sua empresa...</h3>
        ) : (
          <>
            <h3>Selecione uma empresa emissora</h3>
            <p>Use o seletor no menu lateral ou escolha entre as empresas por procuração.</p>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowEmissoresModal(true)}>🏢 Emissores por Procuração</button>
          </>
        )}
      </div>
      {modalEmissores}
    </div>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">🧾 NFS-e — Emissor Nacional</div>
          {modoCliente && acessoCliente.empresas.length > 1 ? (
            <select className="form-control" style={{ marginTop: 6, maxWidth: 360 }} aria-label="Empresa emissora" value={empresaId}
              onChange={e => { const escolhida = acessoCliente.empresas.find(x => x.id === e.target.value); if (escolhida) selecionarEmpresaCliente(escolhida); }}>
              {acessoCliente.empresas.map(e => <option key={e.id} value={e.id}>{e.nomeFantasia || e.razaoSocial}</option>)}
            </select>
          ) : (
            <div className="page-subtitle">{empresa?.nomeFantasia || empresa?.razaoSocial}</div>
          )}
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!modoCliente && (
            <>
              <button className="btn btn-secondary" onClick={() => setShowEmissoresModal(true)}>🏢 Emissores por Procuração</button>
              <button className="btn btn-secondary" onClick={() => setShowConfigModal(true)} disabled={!config}>
                ⚙️ Configurar Emissor
              </button>
              <button className="btn btn-danger" onClick={handleLimparSemChave}>
                🗑️ Limpar Rascunhos e Simuladas
              </button>
            </>
          )}
          <button className="btn btn-secondary" onClick={() => setShowBuscarNotas(true)} disabled={!config}>📥 Buscar Notas do Portal</button>
          <button className="btn btn-secondary" onClick={() => setShowCopiarModal(true)}>📋 Copiar Notas</button>
          <button className="btn btn-secondary" onClick={() => setShowImportarModal(true)}>📥 Importar Lista</button>
          <button className="btn btn-primary" onClick={openNovo}>＋ Nota Manual</button>
        </div>
      </div>

      <div className="page-body">
        {/* Situação da integração */}
        {erroConfig ? (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13 }}>
            {erroConfig}
          </div>
        ) : config && (
          <div style={{
            background: emProducao ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)',
            border: `1px solid ${emProducao ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
            borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: 'var(--text-secondary)',
          }}>
            <strong>{emProducao ? '🟢 Produção: as notas transmitidas têm valor fiscal.' : '🧪 Produção restrita: notas de teste, sem valor fiscal.'}</strong>
            {' '}
            {modoCliente ? (
              <>
                {certificado && !certVencido && `Emissão por procuração, com o certificado de ${certificado.titular?.replace(/:\d+$/, '') || 'seu contador'}. `}
                {!prontoParaEmitir && AVISO_FALE_COM_ESCRITORIO}
              </>
            ) : (
              <>
                {!certificado && (porProcuracao ? 'Envie o certificado do contador em Emissores por Procuração. ' : 'Envie o certificado da empresa em Configurar Emissor. ')}
                {certVencido && 'O certificado está vencido. '}
                {certificado && !certVencido && porProcuracao && `Por procuração, com o certificado do contador (válido até ${new Date(certificado.validoAte!).toLocaleDateString('pt-BR')}). `}
                {certificado && !certVencido && !porProcuracao && `Certificado próprio, válido até ${new Date(certificado.validoAte!).toLocaleDateString('pt-BR')}. `}
                {porProcuracao && parametros?.procuracaoStatus === 'sem_procuracao' && <strong style={{ color: 'var(--red)' }}>O contador não tem procuração desta empresa. </strong>}
                {porProcuracao && !parametros?.procuracaoStatus && 'Procuração ainda não verificada. '}
                {!parametros?.codigoMunicipio && 'Informe o código IBGE do município em Configurar Emissor. '}
              </>
            )}
          </div>
        )}

        {/* KPI Cards */}
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card green">
            <div className="stat-icon green">✅</div>
            <div className="stat-label">Total Emitido</div>
            <div className="stat-value" style={{ fontSize: 18, color: 'var(--green)' }}>{fmt.currency(totais.emitidas)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{totais.qtdEmitidas} nota(s) em produção</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid #f59e0b' }}>
            <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>📝</div>
            <div className="stat-label">Em Rascunho</div>
            <div className="stat-value" style={{ fontSize: 18, color: '#f59e0b' }}>{fmt.currency(totais.pendentes)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{totais.qtdRascunhos} nota(s)</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-icon purple">🧾</div>
            <div className="stat-label">Total de Notas</div>
            <div className="stat-value" style={{ fontSize: 24 }}>{nfseList.length}</div>
          </div>
          <div className="stat-card red">
            <div className="stat-icon red">❌</div>
            <div className="stat-label">Canceladas</div>
            <div className="stat-value" style={{ fontSize: 24, color: 'var(--red)' }}>{totais.qtdCanceladas}</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="card card-sm" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-bar" style={{ flex: 1, minWidth: 220 }}>
              <span>🔍</span>
              <input placeholder="Buscar por nº, chave, tomador ou descrição..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {(['', 'rascunho', 'emitida', 'cancelada'] as const).map(s => (
              <button key={s} className={`btn ${statusFiltro === s ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 12.5 }}
                onClick={() => setStatusFiltro(s)}>
                {s === '' ? '📋 Todas' : s === 'rascunho' ? '📝 Rascunhos' : s === 'emitida' ? '✅ Emitidas' : '❌ Canceladas'}
              </button>
            ))}
          </div>
        </div>

        {rascunhosSelecionados.length > 0 && (
          <div className="card card-sm" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13 }}>
              <strong>{rascunhosSelecionados.length}</strong> rascunho(s) selecionado(s) — {fmt.currency(rascunhosSelecionados.reduce((soma, n) => soma + n.valorServicos, 0))}
            </span>
            <button className="btn btn-primary" style={{ marginLeft: 'auto', background: 'var(--green)', borderColor: 'var(--green)' }}
              onClick={handleTransmitirLote} disabled={!!transmitindoId || !!progressoLote}>
              {progressoLote ? `⏳ Transmitindo ${progressoLote.feitas + 1} de ${progressoLote.total}...` : emProducao ? '🚀 Emitir Selecionadas' : '🧪 Emitir Selecionadas (teste)'}
            </button>
            <button className="btn btn-secondary" onClick={() => setSelecionadas(new Set())} disabled={!!progressoLote}>Limpar seleção</button>
          </div>
        )}

        {/* Tabela */}
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <input type="checkbox" aria-label="Selecionar todos os rascunhos" disabled={!!progressoLote}
                      checked={filtered.some(n => n.status === 'rascunho') && filtered.filter(n => n.status === 'rascunho').every(n => selecionadas.has(n.id))}
                      onChange={e => setSelecionadas(e.target.checked ? new Set(filtered.filter(n => n.status === 'rascunho').map(n => n.id)) : new Set())} />
                  </th>
                  <th>Número</th>
                  <th>Emissão</th>
                  <th>Tomador</th>
                  <th>Serviço</th>
                  <th>Competência</th>
                  <th>Situação</th>
                  <th style={{ textAlign: 'right' }}>Valor Líq.</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-state-icon">🧾</div>
                      <h3>Nenhuma NFS-e encontrada</h3>
                      <p>Crie uma nota manual, copie notas emitidas ou importe uma lista.</p>
                    </div>
                  </td></tr>
                ) : filtered.map(n => (
                  <tr key={n.id} style={{ opacity: n.status === 'cancelada' || ehSimulada(n) ? 0.6 : 1 }}>
                    <td>
                      {n.status === 'rascunho' && (
                        <input type="checkbox" aria-label={`Selecionar rascunho de ${n.tomadorRazaoSocial}`} disabled={!!progressoLote}
                          checked={selecionadas.has(n.id)} onChange={() => alternarSelecao(n.id)} />
                      )}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>
                      {n.status === 'rascunho' ? '—' : n.numero}
                    </td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmt.date(n.dataEmissao)}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{n.tomadorRazaoSocial}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{n.tomadorCnpjCpf}</div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 200 }}>
                      <div style={{ fontWeight: 600 }}>{n.codigoServico}</div>
                      <div style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.discriminacao}</div>
                    </td>
                    <td style={{ fontSize: 12 }}>{n.dataCompetencia}</td>
                    <td>
                      {statusBadge(n)}
                      {n.chaveAcesso && n.ambiente === 'homologacao' && (
                        <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 3 }}>Teste, sem valor fiscal</div>
                      )}
                      {n.gerarContaReceber && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                          {n.lancamentoId ? '📥 Conta a receber gerada' : '📥 Gera conta a receber'}
                        </div>
                      )}
                      {n.status === 'rascunho' && n.ultimoErro && (
                        <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 3, maxWidth: 240 }}>{n.ultimoErro}</div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: n.status === 'cancelada' ? 'var(--red)' : 'var(--green)' }}>
                      {fmt.currency(n.valorLiquido)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '4px 8px' }}
                          onClick={() => { setViewItem(n); setModalMode('ver'); }}>🧾 Ver</button>
                        {n.status === 'rascunho' && (
                          <>
                            <button className="btn btn-primary btn-sm" style={{ fontSize: 11, padding: '4px 8px' }}
                              onClick={() => {
                                setForm({ ...n });
                                setPercentuaisRetencao(percentuaisDosValores(n.valorServicos, { irrf: n.valorIr, pis: n.valorPis, cofins: n.valorCofins, csll: n.valorCsll, cp: n.valorInss }));
                                setRetencaoManual(true);
                                setRegraAplicada('');
                                setModalMode('novo');
                              }}>✏️ Editar</button>
                            <button className="btn btn-primary btn-sm" style={{ fontSize: 11, padding: '4px 8px', background: 'var(--green)', borderColor: 'var(--green)' }}
                              onClick={() => handleTransmitir(n)} disabled={!!transmitindoId}>
                              {transmitindoId === n.id ? '⏳ Enviando...' : '🚀 Transmitir'}
                            </button>
                          </>
                        )}
                        {n.status === 'emitida' && !n.cancelamentoEmAnalise && (
                          <button className="btn btn-danger btn-sm" style={{ fontSize: 11, padding: '4px 8px' }}
                            onClick={() => abrirCancelamento(n)}>❌ Cancelar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showConfigModal && (
        <NfseConfigModal
          empresaId={empresaId}
          config={config}
          onFechar={() => setShowConfigModal(false)}
          onSalvo={novaConfig => { setConfig(novaConfig); setShowConfigModal(false); }}
        />
      )}

      {modalEmissores}

      {showBuscarNotas && (
        <NfseBuscarNotasModal
          empresaId={empresaId}
          empresaNome={empresa?.nomeFantasia || empresa?.razaoSocial || ''}
          onFechar={() => setShowBuscarNotas(false)}
          onNotas={notas => {
            // Mescla com a cópia local: portador e vencimento de uma nota já conhecida são preservados.
            const locais = new Map(store.getNfsE(empresaId).map(n => [n.id, n]));
            notas.forEach(n => store.saveNfsE({ ...locais.get(n.id), ...n, createdAt: String(n.createdAt) }));
            setNfseList(store.getNfsE(empresaId));
          }}
          onConcluir={() => carregarConfig(empresaId)}
        />
      )}

      {showCopiarModal && (
        <NfseCopiarModal
          notas={nfseList}
          ambiente={parametros?.ambiente || 'homologacao'}
          portadores={portadores}
          planoContas={planoContas}
          onFechar={() => setShowCopiarModal(false)}
          onCriar={criarRascunhos}
        />
      )}

      {showImportarModal && (
        <NfseImportarModal
          notas={nfseList}
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

      {/* ======================== MODAL NOVA / EDITAR ======================== */}
      {modalMode === 'novo' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalMode(null)}>
          <div className="modal modal-lg" style={{ maxWidth: 860, maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
              <h2 className="modal-title">🧾 {form.id ? 'Editar rascunho de NFS-e' : 'Nota manual'}</h2>
              <button className="modal-close" onClick={() => setModalMode(null)}>✕</button>
            </div>

            {form.ultimoErro && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
                <strong>Última rejeição do Sefin:</strong> {form.ultimoErro}
              </div>
            )}

            {/* prestador */}
            <div style={secaoStyle}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>🏢 Prestador</div>
              <div style={{ fontSize: 13 }}>
                {empresa?.razaoSocial} — {empresa?.cnpj}
                {parametros?.inscricaoMunicipal ? ` — IM ${parametros.inscricaoMunicipal}` : ''}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>O Sefin usa o nome e o endereço do cadastro nacional.</div>
            </div>

            {/* tomador */}
            <div style={secaoStyle}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>👤 Tomador (Cliente)</div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Selecionar cliente cadastrado</label>
                <select className="form-control" value={form.clienteId || ''} onChange={e => { if (e.target.value) fillTomador(e.target.value); else setForm(f => ({ ...f, clienteId: undefined })); }}>
                  <option value="">— Preencher manualmente —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nomeFantasia || c.nome} — {c.cpfCnpj}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">Razão Social / Nome *</label>
                  <input className="form-control" value={form.tomadorRazaoSocial || ''} onChange={e => setForm(f => ({ ...f, tomadorRazaoSocial: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">CNPJ / CPF *</label>
                  <input className="form-control" value={form.tomadorCnpjCpf || ''} onChange={e => setForm(f => ({ ...f, tomadorCnpjCpf: e.target.value }))} />
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
                  <input className="form-control" value={form.tomadorCep || ''} onChange={e => setForm(f => ({ ...f, tomadorCep: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Município (código IBGE)</label>
                  <input className="form-control" maxLength={7} value={form.tomadorCodigoMunicipio || ''} onChange={e => setForm(f => ({ ...f, tomadorCodigoMunicipio: e.target.value }))} />
                </div>
              </div>
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
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>⚙️ Serviço</div>
              {(parametros?.servicosConhecidos?.length || 0) > 0 && (
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Serviços que esta empresa já emitiu</label>
                  <select className="form-control" value="" onChange={e => {
                    const s = parametros?.servicosConhecidos?.[Number(e.target.value)];
                    if (s) setForm(f => ({ ...f, codigoServico: s.cTribNac, cTribMun: s.cTribMun || '', cNbs: s.cNbs || '', discriminacao: f.discriminacao || s.descricao }));
                  }}>
                    <option value="">— Selecionar para preencher os códigos —</option>
                    {parametros?.servicosConhecidos?.map((s, i) => (
                      <option key={`${s.cTribNac}-${s.cTribMun}-${s.cNbs}`} value={i}>{s.cTribNac}{s.cTribMun ? ` / ${s.cTribMun}` : ''} — {s.descricao.slice(0, 70)} ({s.quantidade}x)</option>
                    ))}
                  </select>
                </div>
              )}
              <NfseServicoPicker
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
                  <label className="form-label">Cód. Tributação Nacional *</label>
                  <input className="form-control" maxLength={6} placeholder="6 dígitos" value={form.codigoServico || ''} onChange={e => setForm(f => ({ ...f, codigoServico: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Cód. Tributação Municipal</label>
                  <input className="form-control" value={form.cTribMun || ''} onChange={e => setForm(f => ({ ...f, cTribMun: e.target.value }))} />
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
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>💰 Valores</div>
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
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>📥 Financeiro (opcional)</div>
              <NfseFinanceiroCampos
                valor={financeiroForm}
                portadores={portadores}
                planoContas={planoContas}
                onChange={f => setForm(atual => ({ ...atual, ...f }))}
              />
            </div>

            <div className="form-actions" style={{ marginTop: 24, gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setModalMode(null)}>Cancelar</button>
              <button className="btn btn-secondary" onClick={() => handleSave(false)} disabled={!!transmitindoId}>Salvar Rascunho</button>
              <button className="btn btn-primary" style={{ background: 'var(--green)', borderColor: 'var(--green)' }} onClick={() => handleSave(true)} disabled={!!transmitindoId}>
                {transmitindoId ? '⏳ Transmitindo ao Sefin...' : emProducao ? '🚀 Emitir Nota Real' : '🧪 Emitir Nota de Teste'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================== DANFSe (nota autorizada) ======================== */}
      {modalMode === 'ver' && viewItem?.chaveAcesso && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalMode(null)}>
          <div className="modal" style={{ maxWidth: 900, width: '95vw', height: '95vh', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', gap: 8, flexWrap: 'wrap' }}>
              <h2 className="modal-title" style={{ margin: 0 }}>🧾 NFS-e Nº {viewItem.numero}</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <a className="btn btn-primary" href={`/api/nfse/${viewItem.id}/danfse?baixar=1`}>⬇️ Baixar PDF</a>
                <a className="btn btn-secondary" href={`/api/nfse/${viewItem.id}/xml`} download>📄 Baixar XML</a>
                <button className="modal-close" onClick={() => setModalMode(null)}>✕</button>
              </div>
            </div>
            <iframe title={`DANFSe da NFS-e ${viewItem.numero}`} src={`/api/nfse/${viewItem.id}/danfse`} style={{ flex: 1, width: '100%', border: 'none', background: '#525659' }} />
          </div>
        </div>
      )}

      {/* ======================== MODAL VISUALIZAR ======================== */}
      {modalMode === 'ver' && viewItem && !viewItem.chaveAcesso && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalMode(null)}>
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
                🧾 {viewItem.status === 'rascunho' ? 'Rascunho de NFS-e' : `NFS-e Nº ${viewItem.numero}`} &nbsp;
                {ehSimulada(viewItem) ? <span style={{ color: '#6b7280', fontSize: 13 }}>Simulada</span> : viewItem.status === 'emitida' ? <span style={{ color: '#16a34a', fontSize: 13 }}>✅ Emitida</span> : viewItem.status === 'cancelada' ? <span style={{ color: '#dc2626', fontSize: 13 }}>❌ Cancelada</span> : <span style={{ color: '#d97706', fontSize: 13 }}>📝 Rascunho</span>}
              </h2>
              <div style={{ display: 'flex', gap: 8 }}>
                {viewItem.chaveAcesso && (
                  <a className="btn btn-secondary" href={`/api/nfse/${viewItem.id}/xml`} download>📄 Baixar XML</a>
                )}
                <button className="btn btn-primary" style={{ background: '#1e293b' }} onClick={() => window.print()}>🖨️ Imprimir</button>
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
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#dc2626' }}>⚠️ NOTA FISCAL CANCELADA</div>
                  {viewItem.motivoCancelamento && <div style={{ fontSize: 12, color: '#7f1d1d', marginTop: 4 }}>Motivo: {viewItem.motivoCancelamento}</div>}
                </div>
              )}

              {/* Rascunho info */}
              {viewItem.status === 'rascunho' && (
                <div style={{ border: '2px dashed #d97706', borderRadius: 8, padding: '12px 16px', textAlign: 'center', background: '#fffbeb' }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#d97706', marginBottom: 12 }}>📝 RASCUNHO — Esta nota ainda não foi autorizada pelo Sefin</div>
                  <button className="btn btn-primary no-print" style={{ background: '#16a34a', borderColor: '#16a34a' }} onClick={() => handleTransmitir(viewItem)} disabled={!!transmitindoId}>
                    🚀 Transmitir ao Sefin
                  </button>
                </div>
              )}

              {viewItem.lancamentoId && (
                <div style={{ marginTop: 12, padding: '8px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, fontSize: 11, color: '#166534' }}>
                  ✅ Conta a Receber gerada automaticamente — ID: {viewItem.lancamentoId}
                  {viewItem.vencimento && ` | Vencimento: ${fmt.date(viewItem.vencimento)}`}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================== MODAL CANCELAR ======================== */}
      {cancelModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setCancelModal(null)}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2 className="modal-title">❌ Cancelar NFS-e Nº {cancelModal.numero}</h2>
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
                {cancelando ? '⏳ Enviando...' : exigeAnalise ? '📨 Solicitar Análise Fiscal' : '❌ Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
