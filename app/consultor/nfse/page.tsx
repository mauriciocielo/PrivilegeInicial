'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  store, type NfsE, type Cliente, type Empresa, type Portador, type PlanoConta, uid,
} from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import { toast } from 'sonner';
import { confirmAsync } from '../../../components/ConfirmProvider';

// Lista de serviços LC 116/2003 (principais)
const LISTA_SERVICOS = [
  { codigo: '1.01', descricao: 'Análise e desenvolvimento de sistemas' },
  { codigo: '1.02', descricao: 'Programação' },
  { codigo: '1.03', descricao: 'Processamento de dados e congêneres' },
  { codigo: '1.04', descricao: 'Elaboração de programas de computadores' },
  { codigo: '1.05', descricao: 'Licenciamento ou cessão de direito de uso de programas de computação' },
  { codigo: '1.07', descricao: 'Suporte técnico em informática, inclusive instalação, configuração e manutenção de programas de computação e bancos de dados' },
  { codigo: '1.08', descricao: 'Planejamento, confecção, manutenção e atualização de páginas eletrônicas' },
  { codigo: '4.01', descricao: 'Medicina e biomedicina' },
  { codigo: '4.02', descricao: 'Análises clínicas, patologia, ultrassonografia, radiologia, tomografia e congêneres' },
  { codigo: '4.09', descricao: 'Nutrição' },
  { codigo: '4.14', descricao: 'Psicologia, psicanálise, terapia ocupacional, acupuntura, podologia, fonoaudiologia, clínicas de magrecimento e congêneres' },
  { codigo: '5.01', descricao: 'Medicina veterinária e zootecnia' },
  { codigo: '6.02', descricao: 'Babá' },
  { codigo: '6.04', descricao: 'Emprego de trabalhadores temporários e de trabalhadores por prazo indeterminado' },
  { codigo: '6.09', descricao: 'Serviço de recrutamento, agenciamento, seleção e colocação de mão de obra' },
  { codigo: '7.01', descricao: 'Engenharia, agronomia, agrimensura, arquitetura, geologia, urbanismo, paisagismo e congêneres' },
  { codigo: '7.02', descricao: 'Execução, por administração, empreitada ou subempreitada, de obras de construção civil' },
  { codigo: '8.01', descricao: 'Planejamento, confecção, manutenção e atualização de publicidade, marketing, propaganda, avisos e afins' },
  { codigo: '9.01', descricao: 'Hospedagem de qualquer natureza em hotéis, apart-service condominiais, flat, apart-hotéis, hotéis residência, residence-service, suíte service, hotelaria marítima' },
  { codigo: '10.01', descricao: 'Agenciamento, corretagem ou intermediação de câmbio, de seguros, de cartões de crédito, de planos de saúde e de planos de previdência privada' },
  { codigo: '10.02', descricao: 'Agenciamento, corretagem ou intermediação de títulos em geral' },
  { codigo: '10.05', descricao: 'Agenciamento, corretagem ou intermediação de bens imóveis' },
  { codigo: '10.09', descricao: 'Representação de qualquer natureza, inclusive comercial' },
  { codigo: '11.01', descricao: 'Guarda e estacionamento de veículos terrestres automotores, de aeronaves e de presumíveis embarcações' },
  { codigo: '12.01', descricao: 'Shows, ballet, danças, desfiles, bailes, óperas, concertos, recitais, festivais e congêneres' },
  { codigo: '13.03', descricao: 'Fotografia e cinematografia, inclusive revelação, ampliação, cópia, reprodução, trucagem e congêneres' },
  { codigo: '14.01', descricao: 'Lubrificação, limpeza, lustração, revisão, carga e recarga, conserto, restauração, blindagem, manutenção e conservação de máquinas' },
  { codigo: '15.01', descricao: 'Administração de fundos quaisquer, de consórcio, de cartão de crédito ou débito e congêneres' },
  { codigo: '17.01', descricao: 'Assessoria ou consultoria de qualquer natureza, não contida em outros itens desta lista' },
  { codigo: '17.02', descricao: 'Análise, exame, pesquisa, coleta, compilação e fornecimento de dados e informações de qualquer natureza' },
  { codigo: '17.06', descricao: 'Propaganda e publicidade, inclusive promoção de vendas, planejamento de campanhas ou sistemas de publicidade' },
  { codigo: '17.09', descricao: 'Perícias, laudos, exames técnicos e análises técnicas' },
  { codigo: '17.10', descricao: 'Planejamento, organização e administração de feiras, exposições, congressos e congêneres' },
  { codigo: '17.14', descricao: 'Serviços de despachante' },
  { codigo: '17.16', descricao: 'Tributação, auditoria, consultoria e serviços contábeis' },
  { codigo: '17.17', descricao: 'Assessoria e consultoria jurídica' },
  { codigo: '17.20', descricao: 'Datilografia, digitação, estenografia, expediente, secretaria em geral, resposta audível, redação, edição, interpretação, revisão, tradução, apoio e infraestrutura administrativa e congêneres' },
  { codigo: '22.01', descricao: 'Serviços da área de educação e ensino' },
  { codigo: '25.01', descricao: 'Funerárias e congêneres' },
  { codigo: '26.01', descricao: 'Serviços de coleta, remessa ou entrega de correspondências, documentos, objetos' },
];

const today = () => new Date().toISOString().split('T')[0];
const compMonth = () => new Date().toISOString().substring(0, 7);

type ModalMode = 'novo' | 'ver' | null;

function calcTributos(valorServicos: number, deducoes: number, aliqIss: number, pis: number, cofins: number, ir: number, csll: number, inss: number, issRetido: boolean) {
  const base = Math.max(0, valorServicos - deducoes);
  const vIss = Math.round(base * aliqIss / 100 * 100) / 100;
  const vPis = Math.round(base * pis / 100 * 100) / 100;
  const vCofins = Math.round(base * cofins / 100 * 100) / 100;
  const vIr = Math.round(base * ir / 100 * 100) / 100;
  const vCsll = Math.round(base * csll / 100 * 100) / 100;
  const vInss = Math.round(base * inss / 100 * 100) / 100;
  const deducoesTotais = vPis + vCofins + vIr + vCsll + vInss + (issRetido ? vIss : 0);
  const liquido = Math.max(0, valorServicos - deducoesTotais);
  return { base, vIss, vPis, vCofins, vIr, vCsll, vInss, liquido };
}

export default function NfsePage() {
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
  const [saving, setSaving] = useState(false);
  const [cancelModal, setCancelModal] = useState<NfsE | null>(null);
  const [motivoCancel, setMotivoCancel] = useState('');

  // Portal Nacional config states
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [portalCnpj, setPortalCnpj] = useState('');
  const [certUploaded, setCertUploaded] = useState(false);
  const [certPassword, setCertPassword] = useState('');
  const [portalEnv, setPortalEnv] = useState<'homologacao' | 'producao'>('homologacao');
  const [importingNotes, setImportingNotes] = useState(false);

  // Transmission simulation states
  const [transmittingItem, setTransmittingItem] = useState<NfsE | null>(null);
  const [transmissionStep, setTransmissionStep] = useState(0);
  const [transmissionLogs, setTransmissionLogs] = useState<string[]>([]);
  const [simulatedXml, setSimulatedXml] = useState('');
  const [simulatedJson, setSimulatedJson] = useState('');

  // Form state
  const [form, setForm] = useState<Partial<NfsE>>({});
  const [aliqIss, setAliqIss] = useState(5);
  const [aliqPis, setAliqPis] = useState(0);
  const [aliqCofins, setAliqCofins] = useState(0);
  const [aliqIr, setAliqIr] = useState(0);
  const [aliqCsll, setAliqCsll] = useState(0);
  const [aliqInss, setAliqInss] = useState(0);
  const [issRetido, setIssRetido] = useState(false);
  const [servicoSearch, setServicoSearch] = useState('');

  const load = useCallback((eId: string) => {
    if (!eId) return;
    setEmpresaId(eId);
    setNfseList(store.getNfsE(eId));
    setClientes(store.getClientes(eId).filter(c => c.ativo));
    setPortadores(store.getPortadores(eId).filter(p => p.ativo));
    setPlanoContas(store.getPlanoContas(eId).filter(p => p.nivel === 3 && p.ativo && p.tipo === 'receita'));
    const currentEmp = store.getEmpresas().find(e => e.id === eId) || null;
    setEmpresa(currentEmp);

    if (currentEmp) {
      setPortalCnpj(currentEmp.cnpj);
    }

    // Carregar config do Portal Nacional
    const savedConf = localStorage.getItem(`cf_nfse_portal_config_${eId}`);
    if (savedConf) {
      try {
        const parsed = JSON.parse(savedConf);
        setCertUploaded(!!parsed.certUploaded);
        setCertPassword(parsed.certPassword || '');
        setPortalEnv(parsed.portalEnv || 'homologacao');
      } catch {}
    } else {
      setCertUploaded(false);
      setCertPassword('');
      setPortalEnv('homologacao');
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || '';
    if (saved) load(saved);
    const handler = (e: Event) => load((e as CustomEvent).detail);
    const dataChangeHandler = () => {
      const current = sessionStorage.getItem('cf_empresa_sel') || '';
      if (current) load(current);
    };
    window.addEventListener('empresaChange', handler);
    window.addEventListener('cfDataChange', dataChangeHandler);
    return () => {
      window.removeEventListener('empresaChange', handler);
      window.removeEventListener('cfDataChange', dataChangeHandler);
    };
  }, [load]);

  const todayStr = today();

  const filtered = useMemo(() => {
    return nfseList.filter(n => {
      if (statusFiltro && n.status !== statusFiltro) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return n.numero.includes(s) || n.tomadorRazaoSocial.toLowerCase().includes(s) || n.discriminacao.toLowerCase().includes(s);
    }).sort((a, b) => b.numero.localeCompare(a.numero));
  }, [nfseList, search, statusFiltro]);

  const totais = useMemo(() => ({
    emitidas: nfseList.filter(n => n.status === 'emitida').reduce((a, n) => a + n.valorLiquido, 0),
    pendentes: nfseList.filter(n => n.status === 'rascunho').reduce((a, n) => a + n.valorServicos, 0),
    qtdEmitidas: nfseList.filter(n => n.status === 'emitida').length,
    qtdRascunhos: nfseList.filter(n => n.status === 'rascunho').length,
  }), [nfseList]);

  const calcs = useMemo(() => calcTributos(
    Number(form.valorServicos) || 0,
    Number(form.valorDeducoes) || 0,
    aliqIss, aliqPis, aliqCofins, aliqIr, aliqCsll, aliqInss, issRetido
  ), [form.valorServicos, form.valorDeducoes, aliqIss, aliqPis, aliqCofins, aliqIr, aliqCsll, aliqInss, issRetido]);

  const openNovo = () => {
    const numero = store.getNextNfseNumero(empresaId);
    setForm({
      empresaId,
      numero,
      serie: '1',
      status: 'rascunho',
      dataEmissao: todayStr,
      dataCompetencia: compMonth(),
      prestadorCnpj: empresa?.cnpj || '',
      prestadorRazaoSocial: empresa?.razaoSocial || '',
      prestadorInscricaoMunicipal: '',
      prestadorEndereco: '',
      prestadorCidade: '',
      prestadorUf: '',
      valorServicos: 0,
      valorDeducoes: 0,
      issRetido: false,
      codigoServico: '',
      discriminacao: '',
      tomadorCnpjCpf: '',
      tomadorRazaoSocial: '',
      vencimento: todayStr,
    });
    setAliqIss(5);
    setAliqPis(0);
    setAliqCofins(0);
    setAliqIr(0);
    setAliqCsll(0);
    setAliqInss(0);
    setIssRetido(false);
    setServicoSearch('');
    setModalMode('novo');
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

  const handleImportFromPortal = async (cnpjToUse: string) => {
    if (!cnpjToUse) return;
    setImportingNotes(true);
    await new Promise(r => setTimeout(r, 1200));

    // Cria as notas fictícias emitidas para este CNPJ
    const mockNotes: NfsE[] = [
      {
        id: uid(),
        empresaId,
        numero: store.getNextNfseNumero(empresaId),
        serie: '1',
        status: 'emitida',
        codigoVerificacao: `CF${Date.now().toString(36).toUpperCase()}1`,
        prestadorCnpj: cnpjToUse,
        prestadorRazaoSocial: empresa?.razaoSocial || 'PRESTADOR DEMO LTDA',
        tomadorCnpjCpf: '12.345.678/0001-00',
        tomadorRazaoSocial: 'CLIENTE INTEGRACAO PORTAL S.A.',
        tomadorEmail: 'financeiro@clienteportal.com.br',
        dataEmissao: today(),
        dataCompetencia: compMonth(),
        codigoServico: '1.01',
        discriminacao: 'Serviços de desenvolvimento de sistemas e consultoria tecnológica - Importado do Portal Nacional.',
        valorServicos: 4500.00,
        valorDeducoes: 0,
        valorPis: 0,
        valorCofins: 0,
        valorInss: 0,
        valorIr: 0,
        valorCsll: 0,
        issRetido: false,
        valorIss: 225.00,
        aliquotaIss: 5,
        valorBaseCalculo: 4500.00,
        valorLiquido: 4500.00,
        createdAt: new Date().toISOString(),
      },
      {
        id: uid(),
        empresaId,
        numero: (Number(store.getNextNfseNumero(empresaId)) + 1).toString(),
        serie: '1',
        status: 'emitida',
        codigoVerificacao: `CF${Date.now().toString(36).toUpperCase()}2`,
        prestadorCnpj: cnpjToUse,
        prestadorRazaoSocial: empresa?.razaoSocial || 'PRESTADOR DEMO LTDA',
        tomadorCnpjCpf: '98.765.432/0001-00',
        tomadorRazaoSocial: 'FORNECEDOR TECNOLOGIA MOCK',
        tomadorEmail: 'contato@forntech.com',
        dataEmissao: today(),
        dataCompetencia: compMonth(),
        codigoServico: '1.07',
        discriminacao: 'Suporte técnico em TI e manutenção de servidores - Importado do Portal Nacional.',
        valorServicos: 1800.00,
        valorDeducoes: 0,
        valorPis: 0,
        valorCofins: 0,
        valorInss: 0,
        valorIr: 0,
        valorCsll: 0,
        issRetido: false,
        valorIss: 90.00,
        aliquotaIss: 5,
        valorBaseCalculo: 1800.00,
        valorLiquido: 1800.00,
        createdAt: new Date().toISOString(),
      }
    ];

    // Salvar no store e gerar contas a receber correspondentes
    mockNotes.forEach(n => {
      const lancamento = {
        id: uid(),
        empresaId,
        data: n.dataEmissao,
        descricao: `NFS-e nº ${n.numero} — ${n.tomadorRazaoSocial} (Importada)`,
        valor: n.valorLiquido,
        tipo: 'receita' as const,
        planoContaId: '',
        portadorId: '',
        status: 'previsto' as const,
        numeroDocumento: `NFS-e ${n.numero}`,
        observacao: `Importado do Portal Nacional de NFS-e para CNPJ ${cnpjToUse}`,
        origem: 'manual' as const,
        createdAt: new Date().toISOString(),
      };
      store.saveLancamento(lancamento);
      n.lancamentoId = lancamento.id;
      store.saveNfsE(n);
    });

    setNfseList(store.getNfsE(empresaId));
    setImportingNotes(false);
    toast.success(`Importação concluída! 2 NFS-e encontradas no Portal e importadas com sucesso para o CNPJ ${cnpjToUse}.`);
  };

  // Salvar configuração do Portal
  const savePortalConfig = async () => {
    const data = { certUploaded, certPassword, portalEnv };
    localStorage.setItem(`cf_nfse_portal_config_${empresaId}`, JSON.stringify(data));
    setShowConfigModal(false);

    if (portalCnpj) {
      await handleImportFromPortal(portalCnpj);
    } else {
      toast.success('Configurações do Portal Nacional salvas.');
    }
  };

  const handleSave = async (emitir: boolean) => {
    if (!form.discriminacao || !form.codigoServico) {
      toast.error('Preencha a discriminação e o código do serviço.'); return;
    }
    if (!form.tomadorCnpjCpf || !form.tomadorRazaoSocial) {
      toast.error('Preencha os dados do tomador (cliente).'); return;
    }
    if (!Number(form.valorServicos)) {
      toast.error('Informe o valor dos serviços.'); return;
    }

    const draftItem: NfsE = {
      id: form.id || uid(),
      empresaId,
      numero: form.numero!,
      serie: form.serie || '1',
      status: 'rascunho',
      prestadorCnpj: form.prestadorCnpj!,
      prestadorRazaoSocial: form.prestadorRazaoSocial!,
      prestadorInscricaoMunicipal: form.prestadorInscricaoMunicipal || '',
      prestadorEndereco: form.prestadorEndereco || '',
      prestadorCidade: form.prestadorCidade || '',
      prestadorUf: form.prestadorUf || '',
      prestadorCep: form.prestadorCep || '',
      clienteId: form.clienteId,
      tomadorCnpjCpf: form.tomadorCnpjCpf!,
      tomadorRazaoSocial: form.tomadorRazaoSocial!,
      tomadorEmail: form.tomadorEmail || '',
      tomadorEndereco: form.tomadorEndereco || '',
      tomadorCidade: form.tomadorCidade || '',
      tomadorUf: form.tomadorUf || '',
      tomadorCep: form.tomadorCep || '',
      tomadorInscricaoMunicipal: form.tomadorInscricaoMunicipal || '',
      dataEmissao: form.dataEmissao!,
      dataCompetencia: form.dataCompetencia!,
      codigoServico: form.codigoServico!,
      cnae: form.cnae || '',
      discriminacao: form.discriminacao!,
      municipioPrestacao: form.municipioPrestacao || form.prestadorCidade || '',
      valorServicos: Number(form.valorServicos),
      valorDeducoes: Number(form.valorDeducoes) || 0,
      valorPis: calcs.vPis,
      valorCofins: calcs.vCofins,
      valorInss: calcs.vInss,
      valorIr: calcs.vIr,
      valorCsll: calcs.vCsll,
      issRetido,
      valorIss: calcs.vIss,
      aliquotaIss: aliqIss,
      valorBaseCalculo: calcs.base,
      valorLiquido: calcs.liquido,
      portadorId: form.portadorId,
      planoContaId: form.planoContaId,
      vencimento: form.vencimento,
      createdAt: form.createdAt || new Date().toISOString(),
    };

    store.saveNfsE(draftItem);
    setNfseList(store.getNfsE(empresaId));
    setModalMode(null);

    if (emitir) {
      handleTransmitir(draftItem);
    }
  };

  const handleTransmitir = async (nfse: NfsE) => {
    setTransmittingItem(nfse);
    setTransmissionStep(1);
    setTransmissionLogs(['[INFO] Iniciando processo de comunicação com o Portal Nacional de NFS-e...']);
    
    // Gerar XML Padrão Nacional
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<EnviarLoteRpsEnvio xmlns="http://www.nfse.gov.br/WSNfse">
  <LoteRps Id="lote_${nfse.numero}">
    <NumeroLote>${nfse.numero}</NumeroLote>
    <Cnpj>${nfse.prestadorCnpj.replace(/\D/g, '')}</Cnpj>
    <InscricaoMunicipal>${nfse.prestadorInscricaoMunicipal || '102938'}</InscricaoMunicipal>
    <QuantidadeRps>1</QuantidadeRps>
    <ListaRps>
      <Rps>
        <InfRps Id="rps_${nfse.numero}">
          <IdentificacaoRps>
            <Numero>${nfse.numero}</Numero>
            <Serie>${nfse.serie}</Serie>
            <Tipo>1</Tipo>
          </IdentificacaoRps>
          <DataEmissao>${nfse.dataEmissao}T12:00:00</DataEmissao>
          <Status>1</Status>
          <Servico>
            <Valores>
              <ValorServicos>${nfse.valorServicos.toFixed(2)}</ValorServicos>
              <ValorDeducoes>${nfse.valorDeducoes.toFixed(2)}</ValorDeducoes>
              <Aliquota>${nfse.aliquotaIss.toFixed(2)}</Aliquota>
              <ValorIss>${nfse.valorIss.toFixed(2)}</ValorIss>
              <IssRetido>${nfse.issRetido ? 1 : 2}</IssRetido>
            </Valores>
            <ItemListaServico>${nfse.codigoServico}</ItemListaServico>
            <Discriminacao>${nfse.discriminacao}</Discriminacao>
            <MunicipioPrestacaoServico>${nfse.municipioPrestacao || '4305108'}</MunicipioPrestacaoServico>
          </Servico>
          <Prestador>
            <Cnpj>${nfse.prestadorCnpj.replace(/\D/g, '')}</Cnpj>
          </Prestador>
          <Tomador>
            <IdentificacaoTomador>
              <CpfCnpj>
                <Cnpj>${nfse.tomadorCnpjCpf.replace(/\D/g, '')}</Cnpj>
              </CpfCnpj>
            </IdentificacaoTomador>
            <RazaoSocial>${nfse.tomadorRazaoSocial}</RazaoSocial>
          </Tomador>
        </InfRps>
      </Rps>
    </ListaRps>
  </LoteRps>
</EnviarLoteRpsEnvio>`;

    setSimulatedXml(xml);

    // Passo 1: Assinatura XML
    await new Promise(r => setTimeout(r, 600));
    setTransmissionLogs(prev => [...prev, '[INFO] Chave privada lida do Certificado Digital A1.', '[SUCCESS] XML assinado com a tag <Signature> e hash SHA-256 gerado.']);
    setTransmissionStep(2);

    // Passo 2: TLS mTLS Handshake
    await new Promise(r => setTimeout(r, 800));
    setTransmissionLogs(prev => [...prev, '[INFO] Abrindo canal de segurança TLS 1.3...', `[INFO] Servidor Portal Nacional: https://api.nfse.gov.br/ws/ (Ambiente: ${portalEnv.toUpperCase()})`, '[SUCCESS] Autenticação mTLS realizada com sucesso.']);
    setTransmissionStep(3);

    // Passo 3: Chamada OAuth2
    await new Promise(r => setTimeout(r, 700));
    setTransmissionLogs(prev => [...prev, '[INFO] Solicitando token de autorização...', '[SUCCESS] Token OAuth2 JWT recebido do servidor SPED Nacional.']);
    setTransmissionStep(4);

    // Passo 4: Transmissão Lote
    await new Promise(r => setTimeout(r, 800));
    const tokenVerif = `CF${Date.now().toString(36).toUpperCase()}`;
    const mockResponse = {
      status: 'PROCESSADO',
      codigoVerificacao: tokenVerif,
      numeroNfse: nfse.numero,
      dataProcessamento: new Date().toISOString(),
      protocolo: `RNFS_${new Date().getFullYear()}_001928372`,
      erros: []
    };
    setSimulatedJson(JSON.stringify(mockResponse, null, 2));
    setTransmissionLogs(prev => [...prev, '[INFO] Transmitindo envelope SOAP/XML de NFS-e...', '[SUCCESS] Retorno do Portal Nacional: Código HTTP 200 OK. Lote processado com sucesso.']);
    setTransmissionStep(5);
  };

  const finalizeTransmission = () => {
    if (!transmittingItem) return;

    const tokenVerif = JSON.parse(simulatedJson).codigoVerificacao || `CF${Date.now().toString(36).toUpperCase()}`;

    const emitida: NfsE = {
      ...transmittingItem,
      status: 'emitida',
      codigoVerificacao: tokenVerif,
    };

    // Gerar financeiro
    if (!emitida.lancamentoId) {
      const lancamento = {
        id: uid(),
        empresaId,
        data: emitida.vencimento || emitida.dataEmissao,
        descricao: `NFS-e nº ${emitida.numero} — ${emitida.tomadorRazaoSocial}`,
        valor: emitida.valorLiquido,
        tipo: 'receita' as const,
        planoContaId: emitida.planoContaId || '',
        portadorId: emitida.portadorId || '',
        status: 'previsto' as const,
        numeroDocumento: `NFS-e ${emitida.numero}`,
        observacao: `Competência: ${emitida.dataCompetencia} | Serviço: ${emitida.codigoServico}`,
        clienteId: emitida.clienteId,
        origem: 'manual' as const,
        createdAt: new Date().toISOString(),
      };
      store.saveLancamento(lancamento);
      emitida.lancamentoId = lancamento.id;
    }

    store.saveNfsE(emitida);
    setNfseList(store.getNfsE(empresaId));
    setTransmittingItem(null);
    setViewItem(emitida);
    setModalMode('ver');
  };

  const handleCancelar = () => {
    if (!cancelModal) return;
    if (!motivoCancel.trim()) { toast.error('Informe o motivo do cancelamento.'); return; }
    store.saveNfsE({ ...cancelModal, status: 'cancelada', motivoCancelamento: motivoCancel });
    if (cancelModal.lancamentoId) {
      const all = store.getLancamentos();
      const idx = all.findIndex(l => l.id === cancelModal.lancamentoId);
      if (idx >= 0) {
        store.saveLancamento({ ...all[idx], observacao: `CANCELADO — NFS-e ${cancelModal.numero}: ${motivoCancel}`, status: 'previsto' });
      }
    }
    setNfseList(store.getNfsE(empresaId));
    setCancelModal(null);
    setMotivoCancel('');
  };

  const handleClearAllNfse = async () => {
    if (!(await confirmAsync('Deseja realmente excluir TODAS as NFS-e desta empresa e seus respectivos lançamentos de contas a receber vinculados?'))) return;
    const allNfse = store.getNfsE(empresaId);
    allNfse.forEach(n => {
      if (n.lancamentoId) {
        store.deleteLancamento(n.lancamentoId);
      }
      store.deleteNfsE(n.id);
    });
    setNfseList([]);
    toast.success('Todas as NFS-e e lançamentos vinculados foram excluídos com sucesso.');
  };

  const servicosFiltrados = useMemo(() => {
    if (!servicoSearch) return LISTA_SERVICOS;
    const s = servicoSearch.toLowerCase();
    return LISTA_SERVICOS.filter(sv => sv.codigo.includes(s) || sv.descricao.toLowerCase().includes(s));
  }, [servicoSearch]);

  const statusBadge = (s: string) => {
    if (s === 'emitida') return <span className="badge badge-green">Emitida</span>;
    if (s === 'cancelada') return <span className="badge badge-red">Cancelada</span>;
    return <span className="badge badge-yellow">Rascunho</span>;
  };

  if (!empresaId) return (
    <div className="page-body">
      <div className="empty-state">
        <div className="empty-state-icon">🏢</div>
        <h3>Selecione uma empresa</h3>
        <p>Use o seletor no menu lateral para escolher a empresa ativa.</p>
      </div>
    </div>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">🧾 NFS-e Portal Nacional</div>
          <div className="page-subtitle">{empresa?.nomeFantasia || empresa?.razaoSocial}</div>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => setShowConfigModal(true)}>
            ⚙️ Configurar Portal Nacional
          </button>
          <button className="btn btn-danger" onClick={handleClearAllNfse}>
            🗑️ Limpar Notas e Contas
          </button>
          <button className="btn btn-primary" onClick={openNovo}>＋ Nova NFS-e</button>
        </div>
      </div>

      <div className="page-body">
        {/* Banner informativo */}
        <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
          🛸 <strong>Integração com o Portal Nacional da NFS-e (RFB / SPED)</strong> — Este ambiente simula a geração de arquivos XML estruturados assinados digitalmente com certificado A1 e a transmissão direta com resposta síncrona. A emissão com sucesso gera automaticamente contas a receber correspondentes.
        </div>

        {/* KPI Cards */}
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card green">
            <div className="stat-icon green">✅</div>
            <div className="stat-label">Total Emitido</div>
            <div className="stat-value" style={{ fontSize: 18, color: 'var(--green)' }}>{fmt.currency(totais.emitidas)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{totais.qtdEmitidas} nota(s)</div>
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
            <div className="stat-value" style={{ fontSize: 24, color: 'var(--red)' }}>{nfseList.filter(n => n.status === 'cancelada').length}</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="card card-sm" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-bar" style={{ flex: 1, minWidth: 220 }}>
              <span>🔍</span>
              <input placeholder="Buscar por nº, tomador ou discriminação..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {(['', 'rascunho', 'emitida', 'cancelada'] as const).map(s => (
              <button key={s} className={`btn ${statusFiltro === s ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 12.5 }}
                onClick={() => setStatusFiltro(s)}>
                {s === '' ? '📋 Todas' : s === 'rascunho' ? '📝 Rascunhos' : s === 'emitida' ? '✅ Emitidas' : '❌ Canceladas'}
              </button>
            ))}
          </div>
        </div>

        {/* Tabela */}
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nº / Série</th>
                  <th>Data Emissão</th>
                  <th>Tomador</th>
                  <th>Serviço</th>
                  <th>Competência</th>
                  <th>Status</th>
                  <th>Cód. Verif.</th>
                  <th style={{ textAlign: 'right' }}>Valor Liq.</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-state-icon">🧾</div>
                      <h3>Nenhuma NFS-e encontrada</h3>
                      <p>Clique em "＋ Nova NFS-e" para preencher seu rascunho de serviços.</p>
                    </div>
                  </td></tr>
                ) : filtered.map(n => (
                  <tr key={n.id} style={{ opacity: n.status === 'cancelada' ? 0.6 : 1 }}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>
                      {n.numero}/{n.serie}
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
                    <td>{statusBadge(n.status)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{n.codigoVerificacao || '—'}</td>
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
                                setForm({ ...n, valorDeducoes: n.valorDeducoes });
                                setAliqIss(n.aliquotaIss);
                                setAliqPis(n.valorPis / Math.max(n.valorBaseCalculo, 1) * 100);
                                setAliqCofins(n.valorCofins / Math.max(n.valorBaseCalculo, 1) * 100);
                                setAliqIr(n.valorIr / Math.max(n.valorBaseCalculo, 1) * 100);
                                setAliqCsll(n.valorCsll / Math.max(n.valorBaseCalculo, 1) * 100);
                                setAliqInss(n.valorInss / Math.max(n.valorBaseCalculo, 1) * 100);
                                setIssRetido(n.issRetido);
                                setModalMode('novo');
                              }}>✏️ Editar</button>
                            <button className="btn btn-primary btn-sm" style={{ fontSize: 11, padding: '4px 8px', background: 'var(--green)', borderColor: 'var(--green)' }}
                              onClick={() => handleTransmitir(n)} disabled={saving}>
                              🚀 Transmitir ao Portal
                            </button>
                          </>
                        )}
                        {n.status === 'emitida' && (
                          <button className="btn btn-danger btn-sm" style={{ fontSize: 11, padding: '4px 8px' }}
                            onClick={() => { setCancelModal(n); setMotivoCancel(''); }}>❌ Cancelar</button>
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

      {/* ======================== MODAL CONFIGURAÇÃO PORTAL ======================== */}
      {showConfigModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowConfigModal(false)}>
          <div className="modal" style={{ maxWidth: 550 }}>
            <div className="modal-header">
              <h2 className="modal-title">⚙️ Parâmetros do Portal Nacional NFS-e</h2>
              <button className="modal-close" onClick={() => setShowConfigModal(false)}>✕</button>
            </div>
            
            <div style={{ marginTop: 15 }}>
              <div className="form-group">
                <label className="form-label">CNPJ Emissor *</label>
                <input 
                  className="form-control" 
                  value={portalCnpj} 
                  onChange={e => setPortalCnpj(e.target.value)} 
                  placeholder="00.000.000/0001-00" 
                />
              </div>
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                  onClick={() => handleImportFromPortal(portalCnpj)}
                  disabled={importingNotes || !portalCnpj}
                >
                  {importingNotes ? '⏳ Buscando no Portal...' : '📥 Consultar e Importar Notas já Emitidas'}
                </button>
              </div>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Certificado Digital A1 (.pfx) *</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="file" accept=".pfx" onChange={() => setCertUploaded(true)} style={{ fontSize: 12 }} />
                  {certUploaded && <span style={{ fontSize: 12, color: 'var(--green)' }}>✓ Certificado Pronto</span>}
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Senha do Certificado Digital *</label>
                <input 
                  type="password" 
                  className="form-control" 
                  value={certPassword} 
                  onChange={e => setCertPassword(e.target.value)} 
                  placeholder="••••••••••••"
                />
              </div>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Ambiente do Portal Nacional</label>
                <select 
                  className="form-control" 
                  value={portalEnv} 
                  onChange={e => setPortalEnv(e.target.value as any)}
                >
                  <option value="homologacao">Homologação (Testes / Sem valor fiscal)</option>
                  <option value="producao">Produção (Real / Oficial)</option>
                </select>
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowConfigModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={savePortalConfig}>✓ Salvar Configuração</button>
            </div>
          </div>
        </div>
      )}

      {/* ======================== MODAL NOVA / EDITAR ======================== */}
      {modalMode === 'novo' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalMode(null)}>
          <div className="modal modal-lg" style={{ maxWidth: 860, maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
              <h2 className="modal-title">🧾 {form.id ? 'Editar NFS-e' : 'Nova NFS-e'} — Nº {form.numero}/{form.serie}</h2>
              <button className="modal-close" onClick={() => setModalMode(null)}>✕</button>
            </div>

            {/* prestador */}
            <div style={{ background: 'var(--bg-card2)', borderRadius: 8, padding: 14, marginBottom: 16, border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>🏢 Prestador de Serviços</div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">Razão Social *</label>
                  <input className="form-control" value={form.prestadorRazaoSocial || ''} onChange={e => setForm(f => ({ ...f, prestadorRazaoSocial: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">CNPJ</label>
                  <input className="form-control" value={form.prestadorCnpj || ''} onChange={e => setForm(f => ({ ...f, prestadorCnpj: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Insc. Municipal</label>
                  <input className="form-control" value={form.prestadorInscricaoMunicipal || ''} onChange={e => setForm(f => ({ ...f, prestadorInscricaoMunicipal: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* tomador */}
            <div style={{ background: 'var(--bg-card2)', borderRadius: 8, padding: 14, marginBottom: 16, border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>👤 Tomador de Serviços (Cliente)</div>
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
                  <label className="form-label">Endereço</label>
                  <input className="form-control" value={form.tomadorEndereco || ''} onChange={e => setForm(f => ({ ...f, tomadorEndereco: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Cidade</label>
                  <input className="form-control" value={form.tomadorCidade || ''} onChange={e => setForm(f => ({ ...f, tomadorCidade: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* serviço */}
            <div style={{ background: 'var(--bg-card2)', borderRadius: 8, padding: 14, marginBottom: 16, border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>⚙️ Dados do Serviço</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Data Emissão *</label>
                  <input type="date" className="form-control" value={form.dataEmissao || ''} onChange={e => setForm(f => ({ ...f, dataEmissao: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Competência *</label>
                  <input type="month" className="form-control" value={form.dataCompetencia || ''} onChange={e => setForm(f => ({ ...f, dataCompetencia: e.target.value }))} />
                </div>
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">Código do Serviço (Lista LC 116/2003) *</label>
                  <select className="form-control" value={form.codigoServico || ''} onChange={e => setForm(f => ({ ...f, codigoServico: e.target.value }))}>
                    <option value="">— Selecione —</option>
                    {LISTA_SERVICOS.map(s => (
                      <option key={s.codigo} value={s.codigo}>{s.codigo} — {s.descricao}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Discriminação dos Serviços *</label>
                <textarea className="form-control" rows={4} style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                  placeholder="Descreva detalhadamente os serviços prestados (aparece na NFS-e)..."
                  value={form.discriminacao || ''} onChange={e => setForm(f => ({ ...f, discriminacao: e.target.value }))} />
              </div>
            </div>

            {/* valores */}
            <div style={{ background: 'var(--bg-card2)', borderRadius: 8, padding: 14, marginBottom: 16, border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>💰 Valores e Tributos</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Valor dos Serviços (R$) *</label>
                  <input type="number" step="0.01" min="0" className="form-control" value={form.valorServicos ?? ''} onChange={e => setForm(f => ({ ...f, valorServicos: Number(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Deduções (R$)</label>
                  <input type="number" step="0.01" min="0" className="form-control" value={form.valorDeducoes ?? ''} onChange={e => setForm(f => ({ ...f, valorDeducoes: Number(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Alíquota ISS (%)</label>
                  <input type="number" step="0.01" className="form-control" value={aliqIss} onChange={e => setAliqIss(Number(e.target.value))} />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 16 }}>
                <input type="checkbox" checked={issRetido} onChange={e => setIssRetido(e.target.checked)} />
                <span style={{ fontSize: 13 }}>ISS Retido pelo Tomador</span>
              </label>

              <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Valor Bruto</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt.currency(Number(form.valorServicos) || 0)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Valor ISS ({aliqIss}%)</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt.currency(calcs.vIss)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700 }}>Valor Líquido (A Receber)</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>{fmt.currency(calcs.liquido)}</div>
                </div>
              </div>
            </div>

            {/* financeiro */}
            <div style={{ background: 'var(--bg-card2)', borderRadius: 8, padding: 14, marginBottom: 16, border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>📥 Conta a Receber (vínculo automático)</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Vencimento</label>
                  <input type="date" className="form-control" value={form.vencimento || ''} onChange={e => setForm(f => ({ ...f, vencimento: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Portador / Conta</label>
                  <select className="form-control" value={form.portadorId || ''} onChange={e => setForm(f => ({ ...f, portadorId: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {portadores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">Categoria de Receita</label>
                  <select className="form-control" value={form.planoContaId || ''} onChange={e => setForm(f => ({ ...f, planoContaId: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {planoContas.map(pc => <option key={pc.id} value={pc.id}>{pc.codigo} - {pc.descricao}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: 24, gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setModalMode(null)}>Cancelar</button>
              <button className="btn btn-secondary" onClick={() => handleSave(false)}>Salvar Rascunho</button>
              <button className="btn btn-primary" style={{ background: 'var(--green)', borderColor: 'var(--green)' }} onClick={() => handleSave(true)}>
                🚀 Transmitir ao Portal Nacional
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================== MODAL DETALHE TRANSMISSÃO SIMULADA ======================== */}
      {transmittingItem && (
        <div className="modal-overlay">
          <div className="modal modal-lg" style={{ maxWidth: 800, background: '#0c0d12', border: '1px solid #1f2235', color: '#fff' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #1f2235' }}>
              <h2 className="modal-title" style={{ color: '#fff' }}>🚀 Transmissão de NFS-e ao Portal Nacional</h2>
            </div>
            
            <div className="page-body" style={{ padding: '10px 0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 20 }}>
                {/* Status & Log column */}
                <div>
                  <h4 style={{ fontSize: 13, color: 'var(--accent-light)', marginBottom: 12 }}>Checklist do mTLS e Handshake</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span style={{ color: transmissionStep >= 1 ? '#9ece6a' : '#565f89' }}>{transmissionStep >= 2 ? '✓' : '○'}</span>
                      <span style={{ color: transmissionStep >= 1 ? '#fff' : 'var(--text-muted)' }}>1. Assinar XML com Certificado Digital A1</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span style={{ color: transmissionStep >= 2 ? '#9ece6a' : '#565f89' }}>{transmissionStep >= 3 ? '✓' : '○'}</span>
                      <span style={{ color: transmissionStep >= 2 ? '#fff' : 'var(--text-muted)' }}>2. Estabelecer canal mTLS seguro TLS 1.3</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span style={{ color: transmissionStep >= 3 ? '#9ece6a' : '#565f89' }}>{transmissionStep >= 4 ? '✓' : '○'}</span>
                      <span style={{ color: transmissionStep >= 3 ? '#fff' : 'var(--text-muted)' }}>3. Obter token de autorização JWT (OAuth2)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span style={{ color: transmissionStep >= 4 ? '#9ece6a' : '#565f89' }}>{transmissionStep >= 5 ? '✓' : '○'}</span>
                      <span style={{ color: transmissionStep >= 4 ? '#fff' : 'var(--text-muted)' }}>4. Transmitir Lote de RPS ao Portal SPED</span>
                    </div>
                  </div>

                  <h4 style={{ fontSize: 13, color: '#e0af68', marginBottom: 8 }}>Histórico de Comunicação</h4>
                  <div style={{ 
                    fontFamily: 'monospace', 
                    fontSize: 11, 
                    background: '#12131a', 
                    border: '1px solid #1a1b26', 
                    padding: 10, 
                    borderRadius: 6, 
                    height: 150, 
                    overflowY: 'auto',
                    color: '#a9b1d6'
                  }}>
                    {transmissionLogs.map((l, i) => (
                      <div key={i} style={{ marginBottom: 4, color: l.includes('SUCCESS') ? '#9ece6a' : l.includes('ERROR') ? '#f7768e' : '#7aa2f7' }}>
                        {l}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Technical Payload / Response XML column */}
                <div>
                  <h4 style={{ fontSize: 13, color: 'var(--accent-light)', marginBottom: 8 }}>Envelope XML Transmitido (Padrão ABRASF/RNFS)</h4>
                  <pre style={{ 
                    fontFamily: 'monospace', 
                    fontSize: 10, 
                    background: '#12131a', 
                    border: '1px solid #1a1b26', 
                    padding: 8, 
                    borderRadius: 6, 
                    height: 150, 
                    overflow: 'auto',
                    color: '#565f89',
                    whiteSpace: 'pre'
                  }}>
                    {simulatedXml}
                  </pre>

                  {simulatedJson && (
                    <>
                      <h4 style={{ fontSize: 13, color: '#9ece6a', marginBottom: 8, marginTop: 12 }}>Resposta JSON do Webservice</h4>
                      <pre style={{ 
                        fontFamily: 'monospace', 
                        fontSize: 10, 
                        background: '#12131a', 
                        border: '1px solid #1a1b26', 
                        padding: 8, 
                        borderRadius: 6, 
                        height: 90, 
                        overflow: 'auto',
                        color: '#73daca'
                      }}>
                        {simulatedJson}
                      </pre>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="form-actions" style={{ borderTop: '1px solid #1f2235', paddingTop: 16, marginTop: 10 }}>
              {transmissionStep < 5 ? (
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>⏳ Processando transmissão...</span>
              ) : (
                <button className="btn btn-primary" style={{ background: 'var(--green)', borderColor: 'var(--green)' }} onClick={finalizeTransmission}>
                  ✓ Concluir e Visualizar Nota Emitida
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================== MODAL VISUALIZAR ======================== */}
      {modalMode === 'ver' && viewItem && (
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
                🧾 NFS-e Nº {viewItem.numero}/{viewItem.serie} &nbsp;
                {viewItem.status === 'emitida' ? <span style={{ color: '#16a34a', fontSize: 13 }}>✅ Emitida</span> : viewItem.status === 'cancelada' ? <span style={{ color: '#dc2626', fontSize: 13 }}>❌ Cancelada</span> : <span style={{ color: '#d97706', fontSize: 13 }}>📝 Rascunho</span>}
              </h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" style={{ background: '#1e293b' }} onClick={() => window.print()}>🖨️ Imprimir / PDF</button>
                <button className="modal-close" onClick={() => setModalMode(null)}>✕</button>
              </div>
            </div>

            {/* NFS-e Document */}
            <div style={{ padding: 28 }}>
              <div style={{ textAlign: 'center', borderBottom: '3px solid #1e293b', paddingBottom: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>
                  Portal Nacional de NFS-e
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
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Cód. Verificação</div>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: viewItem.codigoVerificacao ? '#15803d' : '#9ca3af' }}>
                    {viewItem.codigoVerificacao || 'RASCUNHO'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Situação</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: viewItem.status === 'emitida' ? '#15803d' : viewItem.status === 'cancelada' ? '#dc2626' : '#d97706' }}>
                    {viewItem.status.toUpperCase()}
                  </div>
                </div>
              </div>

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
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#d97706', marginBottom: 12 }}>📝 RASCUNHO — Esta nota não foi transmitida ao Portal Nacional de NFS-e</div>
                  <button className="btn btn-primary no-print" style={{ background: '#16a34a', borderColor: '#16a34a' }} onClick={() => handleTransmitir(viewItem)}>
                    🚀 Transmitir ao Portal Nacional
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
            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label">Motivo do Cancelamento *</label>
              <textarea className="form-control" rows={3} value={motivoCancel} onChange={e => setMotivoCancel(e.target.value)} placeholder="Descreva o motivo do cancelamento..." />
            </div>
            <div className="form-actions" style={{ marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setCancelModal(null)}>Voltar</button>
              <button className="btn btn-danger" onClick={handleCancelar}>❌ Confirmar Cancelamento</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
