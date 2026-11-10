'use client';

import { useState, useEffect } from 'react';
import { store, Empresa, Portador } from '../../../lib/store';
import { toast } from 'sonner';
import BoletoSicoobOficial from '../../../components/BoletoSicoobOficial';

interface BankDefinition {
  id: string;
  code: string;
  name: string;
  color: string;
  portalUrl: string;
  portalLabel: string;
  authType: string;
  freeSteps: string[];
  needsSecret?: boolean;
  needsAppKey?: boolean;
  needsAgenciaConta?: boolean;
  supportsCustomEndpoint?: boolean;
}

interface BankSavedConfig {
  bankId: string;
  enabled: boolean;
  ambiente: 'producao' | 'sandbox';
  clientId: string;
  clientSecret: string;
  appKey: string;
  agencia: string;
  conta: string;
  customEndpoint: string;
  usarCertificadoEmpresa: boolean;
  certPemUpload?: string;
  keyPemUpload?: string;
  lastSyncAt?: string;
  lastSyncCount?: number;
}

interface NormalizedTx {
  fitId: string;
  date: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  paymentType: 'PIX' | 'TED' | 'BOLETO' | 'TARIFA' | 'DEBITO_AUTOMATICO' | 'OUTROS';
  description: string;
  counterpartyName?: string;
  counterpartyDoc?: string;
}

const BANCOS_DIRETOS_GRATUITOS: BankDefinition[] = [
  {
    id: 'sicoob',
    code: '756',
    name: 'Sicoob (API Direta)',
    color: '#00a859',
    portalUrl: 'https://developers.sicoob.com.br',
    portalLabel: 'developers.sicoob.com.br',
    authType: 'OAuth2 + Certificado Digital A1 (mTLS) — 100% Gratuito',
    needsAgenciaConta: true,
    freeSteps: [
      'Acesse developers.sicoob.com.br e clique em "Acessar Portal" com a conta do cooperado PJ.',
      'Crie um aplicativo gratuito selecionando a API "Conta Corrente v4" (escopos cco_extrato e cco_consulta) e vincule o Certificado A1 da empresa.',
      'Copie o Client ID gerado gratuitamente e cole abaixo. O sistema usará automaticamente o Certificado A1 da empresa!',
    ],
  },
  {
    id: 'inter',
    code: '077',
    name: 'Banco Inter PJ',
    color: '#ff7a00',
    portalUrl: 'https://developers.inter.co',
    portalLabel: 'Internet Banking Inter PJ > Soluções para sua empresa > Nova Integração',
    authType: 'OAuth2 + Certificado .crt/.key gratuito do painel Inter PJ',
    needsSecret: true,
    needsAgenciaConta: true,
    freeSteps: [
      'Entre no Internet Banking do Banco Inter PJ pelo computador > menu "Soluções para sua empresa" > "Nova Integração".',
      'Marque a permissão "Consultar extrato e saldo" (extrato.read) de forma 100% gratuita.',
      'Baixe o pacote com Client ID, Client Secret, Certificado (.crt) e Chave Privada (.key) e preencha abaixo.',
    ],
  },
  {
    id: 'sicredi',
    code: '748',
    name: 'Sicredi Cooperativa',
    color: '#3fa110',
    portalUrl: 'https://developers.sicredi.com.br',
    portalLabel: 'developers.sicredi.com.br',
    authType: 'OAuth2 + API Extrato/Cobrança Sicredi Developers (Gratuito)',
    needsSecret: true,
    needsAgenciaConta: true,
    supportsCustomEndpoint: true,
    freeSteps: [
      'Acesse developers.sicredi.com.br ou solicite ao gerente da conta PJ a liberação gratuita da chave de API no Internet Banking.',
      'Ative o produto de Consulta de Extrato / Open Finance PJ e copie o Client ID e Client Secret.',
      'Informe cooperativa/posto e conta corrente abaixo para sincronizar os lançamentos D-1.',
    ],
  },
  {
    id: 'bb',
    code: '001',
    name: 'Banco do Brasil PJ',
    color: '#eab308',
    portalUrl: 'https://developers.bb.com.br',
    portalLabel: 'developers.bb.com.br',
    authType: 'OAuth2 + gw-dev-app-key + Certificado A1 (API Extratos v1)',
    needsSecret: true,
    needsAppKey: true,
    needsAgenciaConta: true,
    freeSteps: [
      'Acesse developers.bb.com.br, crie seu projeto gratuito e assine a API "Extratos Conta Corrente v1".',
      'Credencie o Certificado Digital e-CNPJ A1 da empresa no Gerenciador Financeiro BB.',
      'Copie o Client ID, Client Secret e a Developer Application Key (gw-dev-app-key) e cole abaixo.',
    ],
  },
  {
    id: 'cora',
    code: '403',
    name: 'Cora PJ (API Direta)',
    color: '#fe3e6d',
    portalUrl: 'https://developers.cora.com.br',
    portalLabel: 'App/Web Cora PJ > Conta > Integrações > APIs Diretas',
    authType: 'mTLS Direto Gratuito (Client ID + Certificado PEM)',
    freeSteps: [
      'No painel web da Cora PJ, acesse "Conta" > "Integrações" > "APIs Diretas" (100% gratuito no plano padrão).',
      'Gere uma nova credencial de integração direta e baixe o Client ID, certificado (.pem/.crt) e private-key (.key).',
      'Cole o Client ID e envie os arquivos de certificado abaixo para puxar o extrato em tempo real.',
    ],
  },
  {
    id: 'c6',
    code: '336',
    name: 'C6 Bank PJ',
    color: '#18181b',
    portalUrl: 'https://developers.c6bank.com.br',
    portalLabel: 'developers.c6bank.com.br',
    authType: 'OAuth2 + mTLS Certificado A1 (API Statement C6)',
    needsSecret: true,
    needsAgenciaConta: true,
    supportsCustomEndpoint: true,
    freeSteps: [
      'Acesse o portal developers.c6bank.com.br e habilite a API de Extrato (Statement) na conta C6 Empresas.',
      'Vincule o Certificado Digital A1 (e-CNPJ) da empresa e copie o Client ID e Client Secret.',
      'Salve abaixo para sincronizar Pix, TEDs, boletos liquidados e tarifas diretamente.',
    ],
  },
  {
    id: 'itau',
    code: '341',
    name: 'Itaú Empresas',
    color: '#ea580c',
    portalUrl: 'https://devportal.itau.com.br',
    portalLabel: 'devportal.itau.com.br',
    authType: 'Itaú DevPortal — Account Statement API + mTLS A1',
    needsSecret: true,
    needsAgenciaConta: true,
    supportsCustomEndpoint: true,
    freeSteps: [
      'Acesse devportal.itau.com.br com os dados da empresa correntista Itaú Empresas.',
      'Crie uma credencial para a API "Consulta de Extrato (Account Statement)" usando o Certificado A1.',
      'Preencha Client ID, Client Secret, Agência e Conta abaixo.',
    ],
  },
  {
    id: 'openbanking-brasil',
    code: '000',
    name: 'Padrão OpenBanking-Brasil (openapi v2)',
    color: '#2563eb',
    portalUrl: 'https://github.com/orgs/OpenBanking-Brasil/repositories',
    portalLabel: 'github.com/OpenBanking-Brasil/openapi',
    authType: 'Contrato Oficial BACEN (/open-banking/accounts/v2/accounts/{id}/transactions)',
    needsSecret: true,
    supportsCustomEndpoint: true,
    freeSteps: [
      'Compatível com qualquer endpoint que siga o repositório oficial OpenBanking-Brasil/openapi (Fase 2 - Dados Transacionais de Contas).',
      'Pode apontar para um container local do OpenBanking-Brasil/mock-api (Docker) ou para o endpoint FAPI-BR do banco.',
      'No modo "Homologação / Simulador OpenBanking-Brasil", você pode testar e importar transações imediatamente sem precisar de credenciais externas.',
    ],
  },
];

export default function OpenFinancePage() {
  const [empresaId, setEmpresaId] = useState('');
  const [activeCompany, setActiveCompany] = useState<Empresa | null>(null);
  const [portadores, setPortadores] = useState<Portador[]>([]);
  const [configs, setConfigs] = useState<Record<string, BankSavedConfig>>({});
  const [certStatus, setCertStatus] = useState<{
    possuiCertificadoA1: boolean;
    titular: string | null;
    cnpj: string | null;
    validoAte: string | null;
  }>({ possuiCertificadoA1: false, titular: null, cnpj: null, validoAte: null });

  // Modal & Form state
  const [selectedBank, setSelectedBank] = useState<BankDefinition | null>(null);
  const [form, setForm] = useState<BankSavedConfig>({
    bankId: '',
    enabled: true,
    ambiente: 'sandbox',
    clientId: '',
    clientSecret: '',
    appKey: '',
    agencia: '',
    conta: '',
    customEndpoint: '',
    usarCertificadoEmpresa: true,
    certPemUpload: '',
    keyPemUpload: '',
  });
  const [pfxBase64, setPfxBase64] = useState('');
  const [pfxPassword, setPfxPassword] = useState('');
  const [pfxFileName, setPfxFileName] = useState('');

  // Sync & Preview state
  const [syncingBankId, setSyncingBankId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [previewTxs, setPreviewTxs] = useState<NormalizedTx[]>([]);
  const [previewBank, setPreviewBank] = useState<BankDefinition | null>(null);
  const [previewProtocol, setPreviewProtocol] = useState('');
  const [previewAviso, setPreviewAviso] = useState('');

  // Modal de Emissão de Cobrança Direta via API (Sicoob Pix Cob / CobV)
  const [showCobrancaModal, setShowCobrancaModal] = useState(false);
  const [emittingCobranca, setEmittingCobranca] = useState(false);
  const [cobForm, setCobForm] = useState({
    tipoCobranca: 'pix_imediato' as 'pix_imediato' | 'pix_vencimento',
    chavePix: '58033979000184',
    valor: '',
    pagadorNome: '',
    pagadorDocumento: '',
    descricao: 'Honorários Contábeis / Consultoria Privilege',
    dataVencimento: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d.toISOString().slice(0, 10);
    })(),
    multaPercentual: '2',
    jurosMensalPercentual: '1',
    lancarContasReceber: true,
  });
  const [cobResult, setCobResult] = useState<{
    txid: string;
    brcode: string;
    valor: string;
    status: string;
    chave: string;
    boletoRegistradoOnline?: boolean;
    pdfBoletoOficialBase64?: string | null;
    motivoCodigoBarrasNaoRegistrado?: string | null;
    boleto?: {
      linhaDigitavel: string;
      codigoBarras: string;
      nossoNumero: string;
      agencia: string;
      convenio: string;
      conta: string;
      dataVencimento: string;
    } | null;
  } | null>(null);

  const storageKey = (eId: string) => `cf_openfinance_free_configs_${eId}`;

  const load = async (eId: string) => {
    if (!eId) return;
    setEmpresaId(eId);
    setPortadores(store.getPortadores(eId));
    setActiveCompany(store.getEmpresas().find(e => e.id === eId) || null);

    try {
      const raw = localStorage.getItem(storageKey(eId));
      const parsed: Record<string, BankSavedConfig> = raw ? JSON.parse(raw) : {};
      // Se for a Privilege Consultoria (ou se o Sicoob ainda estiver vazio/sem Client ID), já preenche os dados oficiais do Sicoob da Privilege
      if (!parsed.sicoob || !parsed.sicoob.clientId) {
        parsed.sicoob = {
          bankId: 'sicoob',
          enabled: true,
          ambiente: 'producao',
          clientId: '35fcd9a6-cf4b-470d-a665-9785af693fd5',
          clientSecret: '',
          appKey: '',
          agencia: '4342',
          conta: '175.204-9',
          customEndpoint: '',
          usarCertificadoEmpresa: true,
        };
        localStorage.setItem(storageKey(eId), JSON.stringify(parsed));
      }
      setConfigs(parsed);
    } catch {
      setConfigs({});
    }

    try {
      const res = await fetch(`/api/banco-extrato?acao=status-certificado&empresaId=${encodeURIComponent(eId)}`);
      if (res.ok) {
        const data = await res.json();
        setCertStatus(data);
      }
    } catch {
      // ignora falha silenciosamente
    }
  };

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || (store.getEmpresas()[0]?.id ?? '');
    load(saved);

    const handler = (e: Event) => load((e as CustomEvent).detail);
    window.addEventListener('empresaChange', handler);
    return () => window.removeEventListener('empresaChange', handler);
  }, []);

  const openBankConfig = (bank: BankDefinition) => {
    const existing = configs[bank.id];
    setSelectedBank(bank);
    setPfxBase64('');
    setPfxPassword('');
    setPfxFileName('');
    setForm(
      existing || {
        bankId: bank.id,
        enabled: true,
        ambiente: 'sandbox',
        clientId: '',
        clientSecret: '',
        appKey: '',
        agencia: '',
        conta: '',
        customEndpoint: '',
        usarCertificadoEmpresa: true,
        certPemUpload: '',
        keyPemUpload: '',
      }
    );
  };

  const saveBankConfig = () => {
    if (!selectedBank || !empresaId) return;
    if (form.ambiente === 'producao' && !form.clientId.trim() && !form.customEndpoint.trim()) {
      toast.error('Em modo Produção, informe o Client ID gratuito gerado no portal do banco (ou mude para Simulador OpenBanking-Brasil para testar).');
      return;
    }

    const updated: Record<string, BankSavedConfig> = {
      ...configs,
      [selectedBank.id]: {
        ...form,
        bankId: selectedBank.id,
        enabled: true,
      },
    };
    setConfigs(updated);
    localStorage.setItem(storageKey(empresaId), JSON.stringify(updated));

    // Garante que existe um Portador (conta bancária) vinculado a esse banco
    const existingPortador = portadores.find(p =>
      p.nome.toLowerCase().includes(selectedBank.name.split(' ')[0].toLowerCase())
    );
    if (!existingPortador) {
      store.savePortador({
        id: `port_${selectedBank.id}_${Date.now()}`,
        empresaId,
        nome: `${selectedBank.name}${form.conta ? ` (${form.conta})` : ''}`,
        tipo: 'conta_corrente',
        banco: `${selectedBank.code} - ${selectedBank.name}`,
        agencia: form.agencia || '0001',
        conta: form.conta || 'Conta PJ',
        saldoInicial: 0,
        ativo: true,
      });
      setPortadores(store.getPortadores(empresaId));
    }

    toast.success(`Configuração gratuita de ${selectedBank.name} salva com sucesso!`);
    setSelectedBank(null);
  };

  const handlePfxUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPfxFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      setPfxBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleTextFileUpload = (field: 'certPemUpload' | 'keyPemUpload', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm(prev => ({ ...prev, [field]: String(reader.result || '') }));
      toast.success(`Arquivo ${file.name} carregado.`);
    };
    reader.readAsText(file);
  };

  const syncBankStatement = async (bank: BankDefinition, cfgOverride?: BankSavedConfig) => {
    const cfg = cfgOverride ||
      configs[bank.id] || {
        bankId: bank.id,
        enabled: true,
        ambiente: 'sandbox',
        clientId: '',
        clientSecret: '',
        appKey: '',
        agencia: '',
        conta: '',
        customEndpoint: '',
        usarCertificadoEmpresa: true,
      };

    setSyncingBankId(bank.id);
    try {
      const res = await fetch('/api/banco-extrato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...cfg,
          empresaId,
          bankId: bank.id,
          pfxBase64,
          pfxPassword,
          startDate,
          endDate,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error || 'Falha ao consultar extrato na API do banco.');
        return;
      }

      const txs: NormalizedTx[] = data.transactions || [];
      setPreviewBank(bank);
      setPreviewTxs(txs);
      setPreviewProtocol(data.protocolo || 'OpenBanking-Brasil/openapi v2');
      setPreviewAviso(data.aviso || '');

      // Atualiza data do último sync
      const updated: Record<string, BankSavedConfig> = {
        ...configs,
        [bank.id]: {
          ...cfg,
          enabled: true,
          lastSyncAt: new Date().toLocaleString('pt-BR'),
          lastSyncCount: txs.length,
        },
      };
      setConfigs(updated);
      localStorage.setItem(storageKey(empresaId), JSON.stringify(updated));

      toast.success(`${txs.length} transações recebidas de ${bank.name}! Confira abaixo para importar no Fluxo de Caixa.`);
    } catch (err) {
      toast.error(`Erro de conexão: ${(err as Error).message}`);
    } finally {
      setSyncingBankId(null);
    }
  };

  const handleEmitirCobrancaSicoob = async () => {
    const sicoobCfg = configs.sicoob;
    const valorNum = Number(String(cobForm.valor).replace(',', '.'));
    if (!valorNum || valorNum <= 0) {
      toast.error('Informe o valor da cobrança (ex: 150.00).');
      return;
    }

    setEmittingCobranca(true);
    try {
      const res = await fetch('/api/banco-extrato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'emitir-cobranca-sicoob',
          empresaId,
          bankId: 'sicoob',
          ambiente: 'producao',
          clientId: sicoobCfg?.clientId || '35fcd9a6-cf4b-470d-a665-9785af693fd5',
          usarCertificadoEmpresa: true,
          tipoCobranca: cobForm.tipoCobranca,
          chavePix: cobForm.chavePix,
          valor: valorNum,
          pagadorNome: cobForm.pagadorNome,
          pagadorDocumento: cobForm.pagadorDocumento,
          descricao: cobForm.descricao,
          dataVencimento: cobForm.dataVencimento,
          multaPercentual: Number(cobForm.multaPercentual || 0),
          jurosMensalPercentual: Number(cobForm.jurosMensalPercentual || 0),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error || 'Erro ao emitir cobrança na API do Sicoob.');
        return;
      }

      setCobResult({
        txid: data.txid,
        brcode: data.brcode,
        valor: data.valor,
        status: data.status,
        chave: data.chave,
        boletoRegistradoOnline: Boolean(data.boletoRegistradoOnline),
        pdfBoletoOficialBase64: data.pdfBoletoOficialBase64 || null,
        motivoCodigoBarrasNaoRegistrado: data.motivoCodigoBarrasNaoRegistrado || null,
        boleto: data.boleto || null,
      });

      if (cobForm.lancarContasReceber && empresaId) {
        const portadorSicoob =
          store.getPortadores(empresaId).find(p => p.nome.toLowerCase().includes('sicoob')) ||
          store.getPortadores(empresaId)[0];
        const planos = store.getPlanoContas(empresaId);
        const planoReceita =
          planos.find(p => p.tipo === 'receita' && p.nivel === 3 && p.ativo) || planos.find(p => p.tipo === 'receita');

        store.saveLancamento({
          id: `cob_sicoob_${data.txid}`,
          empresaId,
          tipo: 'receita',
          descricao: `[COB PIX SICOOB] ${cobForm.descricao}${cobForm.pagadorNome ? ` — ${cobForm.pagadorNome}` : ''}`,
          valor: valorNum,
          data:
            cobForm.tipoCobranca === 'pix_vencimento'
              ? cobForm.dataVencimento
              : new Date().toISOString().slice(0, 10),
          status: 'previsto',
          planoContaId: planoReceita?.id || 'pc4',
          portadorId: portadorSicoob?.id || 'port_sicoob',
          numeroDocumento: data.txid,
          observacao: `Cobrança emitida via API Oficial Sicoob (TXID: ${data.txid}). Pix Copia e Cola: ${data.brcode}`,
          origem: 'manual',
          createdAt: new Date().toISOString(),
        });
      }

      toast.success('Cobrança Pix emitida direto na API do Sicoob com sucesso!');
    } catch (err) {
      toast.error(`Erro ao emitir cobrança: ${(err as Error).message}`);
    } finally {
      setEmittingCobranca(false);
    }
  };

  const importTransactionsToCashflow = () => {
    if (!previewBank || previewTxs.length === 0 || !empresaId) return;

    // Localiza ou cria o Portador correspondente
    let portador = store
      .getPortadores(empresaId)
      .find(p => p.nome.toLowerCase().includes(previewBank.name.split(' ')[0].toLowerCase()));

    if (!portador) {
      const novoPortador: Portador = {
        id: `port_${previewBank.id}_${Date.now()}`,
        empresaId,
        nome: previewBank.name,
        tipo: 'conta_corrente',
        banco: `${previewBank.code} - ${previewBank.name}`,
        agencia: '0001',
        conta: 'Conta PJ',
        saldoInicial: 0,
        ativo: true,
      };
      store.savePortador(novoPortador);
      portador = novoPortador;
      setPortadores(store.getPortadores(empresaId));
    }

    // Localiza plano de contas padrão para receitas e despesas
    const planos = store.getPlanoContas(empresaId);
    const planoEntrada =
      planos.find(p => p.tipo === 'receita' && p.nivel === 3 && p.ativo) || planos.find(p => p.tipo === 'receita');
    const planoSaida =
      planos.find(p => p.tipo === 'despesa' && p.nivel === 3 && p.ativo) || planos.find(p => p.tipo === 'despesa');

    const existentes = store.getLancamentos(empresaId);
    const novosLancamentos = [];
    let ignoradosDuplicados = 0;

    for (const tx of previewTxs) {
      const jaExiste = existentes.some(
        l =>
          l.ofxId === tx.fitId ||
          l.observacao?.includes(tx.fitId) ||
          (l.data === tx.date && Math.abs(l.valor - tx.amount) < 0.01 && l.descricao === tx.description)
      );

      if (jaExiste) {
        ignoradosDuplicados++;
        continue;
      }

      novosLancamentos.push({
        id: `of_${tx.fitId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        empresaId,
        tipo: (tx.type === 'CREDIT' ? 'receita' : 'despesa') as 'receita' | 'despesa',
        descricao: tx.description,
        valor: tx.amount,
        data: tx.date,
        planoContaId: (tx.type === 'CREDIT' ? planoEntrada?.id : planoSaida?.id) || (tx.type === 'CREDIT' ? 'pc4' : 'pc30'),
        portadorId: portador.id,
        status: 'realizado' as const,
        numeroDocumento: tx.fitId,
        observacao: `Importado via Open Finance Gratuito (${previewProtocol})${
          tx.counterpartyName ? ` · ${tx.counterpartyName}` : ''
        }${tx.counterpartyDoc ? ` (${tx.counterpartyDoc})` : ''}`,
        origem: 'ofx' as const,
        ofxId: tx.fitId,
        createdAt: new Date().toISOString(),
      });
    }

    if (novosLancamentos.length > 0) {
      store.saveLancamentos(novosLancamentos);
    }

    toast.success(
      `${novosLancamentos.length} lançamento(s) importado(s) e conciliado(s) no Fluxo de Caixa${
        ignoradosDuplicados > 0 ? ` (${ignoradosDuplicados} já existente(s) ignorado(s))` : ''
      }!`
    );
    setPreviewTxs([]);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">
            Central Open Finance & APIs Bancárias Diretas
            <span className="badge badge-green" style={{ marginLeft: 12 }}>
              100% GRATUITO (SEM INTERMEDIÁRIOS)
            </span>
          </div>
          <div className="page-subtitle">
            {activeCompany?.nomeFantasia || 'Selecione uma empresa'} — Conexão direta via mTLS / Certificado Digital A1 e padrão OpenBanking-Brasil
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Banner explicativo da arquitetura gratuita */}
        <div
          className="card"
          style={{
            padding: 24,
            marginBottom: 24,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
            <div style={{ maxWidth: 680 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(34,197,94,0.18)', color: '#4ade80', padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
                ✓ Zero Mensalidade de Agregadores · Conexão Direta mTLS + OpenBanking-Brasil/openapi
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, color: '#fff' }}>
                Extrato Automático Direto nos Portais Gratuitos dos Bancos
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
                Em vez de pagar hubs intermediários por conta conectada, o sistema utiliza diretamente o{' '}
                <strong>Certificado Digital ICP-Brasil A1 (e-CNPJ)</strong> que a empresa já possui cadastrado no cofre e as credenciais gratuitas do{' '}
                <strong>Portal Developers de cada banco (Sicoob, Inter, Sicredi, BB, Cora, C6, Itaú)</strong>, além de suportar o contrato oficial{' '}
                <code>OpenBanking-Brasil/openapi</code>.
              </p>
            </div>

            {/* Status do Certificado A1 da Empresa */}
            <div
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 14,
                padding: '16px 20px',
                minWidth: 280,
              }}
            >
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', fontWeight: 700, marginBottom: 6 }}>
                Cofre mTLS da Empresa Ativa
              </div>
              {certStatus.possuiCertificadoA1 ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>
                    ● Certificado A1 Pronto para Uso
                  </div>
                  <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                    {certStatus.titular || activeCompany?.razaoSocial}
                  </div>
                  {certStatus.validoAte && (
                    <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>
                      Válido até: {new Date(certStatus.validoAte).toLocaleDateString('pt-BR')}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>
                    ● Certificado A1 não detectado no cofre
                  </div>
                  <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.45 }}>
                    Você pode usar o <strong>Simulador OpenBanking-Brasil</strong> imediatamente ou enviar o arquivo <code>.pfx</code> / <code>.crt</code> na configuração do banco.
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Filtro de Período para Sincronização */}
          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
              fontSize: 13,
            }}
          >
            <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Período de Busca do Extrato:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ color: '#94a3b8' }}>De:</label>
              <input
                type="date"
                className="form-input"
                style={{ width: 155, height: 34, background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)' }}
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ color: '#94a3b8' }}>Até:</label>
              <input
                type="date"
                className="form-input"
                style={{ width: 155, height: 34, background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)' }}
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Painel de Pré-visualização de Lançamentos Sincronizados */}
        {previewTxs.length > 0 && previewBank && (
          <div className="card" style={{ padding: 24, marginBottom: 28, border: '2px solid var(--green)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Extrato Recebido — {previewBank.name} ({previewTxs.length} transações)
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  Protocolo: <strong>{previewProtocol}</strong> · Sem duplicidade por FITID
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => setPreviewTxs([])}>
                  Fechar Prévia
                </button>
                <button className="btn btn-primary" style={{ background: 'var(--green)', border: 'none' }} onClick={importTransactionsToCashflow}>
                  ✓ Importar e Conciliar {previewTxs.length} Lançamentos no Caixa
                </button>
              </div>
            </div>

            {previewAviso && (
              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1e3a8a',
                  padding: '10px 14px',
                  borderRadius: 10,
                  fontSize: 12.5,
                  marginBottom: 14,
                }}
              >
                ℹ️ {previewAviso}
              </div>
            )}

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>ID Transação (FITID)</th>
                    <th>Modalidade</th>
                    <th>Histórico / Descrição</th>
                    <th>Contraparte (CPF/CNPJ)</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {previewTxs.map(tx => (
                    <tr key={tx.fitId}>
                      <td>{tx.date.split('-').reverse().join('/')}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{tx.fitId}</td>
                      <td>
                        <span className={`badge ${tx.type === 'CREDIT' ? 'badge-green' : 'badge-red'}`}>
                          {tx.paymentType}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{tx.description}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {tx.counterpartyName || '-'}
                        {tx.counterpartyDoc ? ` (${tx.counterpartyDoc})` : ''}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          color: tx.type === 'CREDIT' ? 'var(--green)' : 'var(--red)',
                        }}
                      >
                        {tx.type === 'CREDIT' ? '+' : '-'} R${' '}
                        {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Grade de Bancos e Conectores Gratuitos */}
        <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>
          Conectores Bancários Gratuitos (APIs Diretas PJ & Padrão OpenBanking-Brasil)
        </h3>

        <div className="grid-3" style={{ marginBottom: 40 }}>
          {BANCOS_DIRETOS_GRATUITOS.map(b => {
            const cfg = configs[b.id];
            const isConfigured = Boolean(cfg?.enabled);
            const isSyncing = syncingBankId === b.id;

            return (
              <div className="glass-card" key={b.id} style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: b.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 15,
                        color: b.color === '#eab308' ? '#111' : '#fff',
                        fontWeight: 900,
                      }}
                    >
                      {b.code}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 20,
                          background: 'rgba(16,185,129,0.12)',
                          color: 'var(--green)',
                        }}
                      >
                        GRÁTIS
                      </span>
                      {isConfigured && (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 20,
                            background: cfg.ambiente === 'producao' ? 'var(--green-bg)' : 'rgba(59,130,246,0.15)',
                            color: cfg.ambiente === 'producao' ? 'var(--green)' : '#3b82f6',
                          }}
                        >
                          {cfg.ambiente === 'producao' ? 'PRODUÇÃO mTLS' : 'SIMULADOR ATIVO'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: 16.5, fontWeight: 800, color: 'var(--text-primary)' }}>{b.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 600, marginTop: 2 }}>{b.authType}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, marginBottom: 16, lineHeight: 1.5 }}>
                    Portal oficial: <strong>{b.portalLabel}</strong>
                    {cfg?.lastSyncAt && (
                      <div style={{ marginTop: 6, color: 'var(--green)', fontWeight: 600 }}>
                        ✓ Última sincronização: {cfg.lastSyncAt} ({cfg.lastSyncCount || 0} lançamentos)
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-secondary"
                      style={{ flex: 1, border: '1px solid var(--border)', fontSize: 12.5 }}
                      onClick={() => openBankConfig(b)}
                    >
                      ⚙️ Configurar Grátis
                    </button>
                    <button
                      className="btn btn-primary"
                      style={{
                        flex: 1,
                        background: b.color,
                        color: b.color === '#eab308' ? '#111' : '#fff',
                        border: 'none',
                        fontSize: 12.5,
                      }}
                      disabled={isSyncing}
                      onClick={() => syncBankStatement(b)}
                    >
                      {isSyncing ? '⏳ Buscando...' : '↻ Puxar Extrato'}
                    </button>
                  </div>
                  {b.id === 'sicoob' && (
                    <button
                      className="btn btn-secondary"
                      style={{
                        width: '100%',
                        background: 'rgba(0, 168, 89, 0.1)',
                        color: '#008a49',
                        border: '1px solid rgba(0, 168, 89, 0.35)',
                        fontWeight: 700,
                        fontSize: 12.5,
                      }}
                      onClick={() => {
                        setCobResult(null);
                        setShowCobrancaModal(true);
                      }}
                    >
                      ⚡ Emitir Cobrança Direta via API (Pix QR Code / CobV)
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Configuração Gratuita Passo a Passo */}
      {selectedBank && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
          <div className="modal" style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: selectedBank.color,
                    color: selectedBank.color === '#eab308' ? '#111' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: 14,
                  }}
                >
                  {selectedBank.code}
                </div>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{selectedBank.name}</h2>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedBank.authType}</div>
                </div>
              </div>
              <button className="btn btn-ghost" onClick={() => setSelectedBank(null)}>
                ✕
              </button>
            </div>

            {/* Passo a Passo para Gerar a Credencial Gratuita no Banco */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ fontSize: 13 }}>Como obter a credencial gratuita neste banco:</strong>
                <a
                  href={selectedBank.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}
                >
                  Abrir {selectedBank.portalLabel} ↗
                </a>
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {selectedBank.freeSteps.map((stepText, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {stepText}
                  </li>
                ))}
              </ol>
            </div>

            {/* Seleção de Modo: Simulador Gratuito Imediato vs. Produção mTLS */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Modo de Operação</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button
                  type="button"
                  className="btn"
                  style={{
                    border: form.ambiente === 'sandbox' ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: form.ambiente === 'sandbox' ? 'rgba(96,0,0,0.08)' : 'transparent',
                    fontWeight: 700,
                    fontSize: 12.5,
                  }}
                  onClick={() => setForm(prev => ({ ...prev, ambiente: 'sandbox' }))}
                >
                  🧪 Simulador OpenBanking-Brasil (Teste Imediato)
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{
                    border: form.ambiente === 'producao' ? '2px solid var(--green)' : '1px solid var(--border)',
                    background: form.ambiente === 'producao' ? 'var(--green-bg)' : 'transparent',
                    fontWeight: 700,
                    fontSize: 12.5,
                  }}
                  onClick={() => setForm(prev => ({ ...prev, ambiente: 'producao' }))}
                >
                  🔒 Produção Direta (API Oficial mTLS)
                </button>
              </div>
            </div>

            {form.ambiente === 'sandbox' ? (
              <div
                style={{
                  padding: 14,
                  borderRadius: 10,
                  background: 'rgba(59,130,246,0.08)',
                  border: '1px solid rgba(59,130,246,0.25)',
                  fontSize: 12.5,
                  color: 'var(--text-secondary)',
                  marginBottom: 18,
                  lineHeight: 1.55,
                }}
              >
                No modo <strong>Simulador OpenBanking-Brasil</strong>, o sistema gera e consome o payload padronizado{' '}
                <code>GET /open-banking/accounts/v2/accounts/&#123;accountId&#125;/transactions</code> sem exigir chaves de produção, permitindo testar todo o fluxo de conciliação automática no Fluxo de Caixa agora mesmo.
              </div>
            ) : (
              <>
                <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Client ID (Portal Developers do Banco)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ex: 9b1deb4d-3b7d-4bad-9bdd..."
                      value={form.clientId}
                      onChange={e => setForm(prev => ({ ...prev, clientId: e.target.value }))}
                    />
                  </div>

                  {selectedBank.needsSecret && (
                    <div className="form-group">
                      <label className="form-label">Client Secret / Token Bearer</label>
                      <input
                        type="password"
                        className="form-input"
                        placeholder="Informe o Client Secret..."
                        value={form.clientSecret}
                        onChange={e => setForm(prev => ({ ...prev, clientSecret: e.target.value }))}
                      />
                    </div>
                  )}
                </div>

                {selectedBank.needsAppKey && (
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Developer Application Key (gw-dev-app-key)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Chave da aplicação no developers.bb.com.br"
                      value={form.appKey}
                      onChange={e => setForm(prev => ({ ...prev, appKey: e.target.value }))}
                    />
                  </div>
                )}

                {selectedBank.needsAgenciaConta && (
                  <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Agência / Cooperativa</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Ex: 3025"
                        value={form.agencia}
                        onChange={e => setForm(prev => ({ ...prev, agencia: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Conta Corrente PJ (com dígito)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Ex: 12345-6"
                        value={form.conta}
                        onChange={e => setForm(prev => ({ ...prev, conta: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                {selectedBank.supportsCustomEndpoint && (
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">
                      Endpoint OpenBanking-Brasil / API de Extrato (Opcional)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="https://api.banco.com.br/open-banking/accounts/v2/accounts/{id}/transactions"
                      value={form.customEndpoint}
                      onChange={e => setForm(prev => ({ ...prev, customEndpoint: e.target.value }))}
                    />
                  </div>
                )}

                {/* Certificado Digital mTLS */}
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 18,
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.usarCertificadoEmpresa}
                      onChange={e => setForm(prev => ({ ...prev, usarCertificadoEmpresa: e.target.checked }))}
                    />
                    Reaproveitar automaticamente o Certificado Digital A1 (.pfx) salvo na empresa
                  </label>

                  {!form.usarCertificadoEmpresa && (
                    <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                      <div className="grid-2" style={{ gap: 10 }}>
                        <div>
                          <label className="form-label" style={{ fontSize: 11.5 }}>
                            Opção A: Arquivo .PFX / .P12
                          </label>
                          <input type="file" accept=".pfx,.p12" className="form-input" onChange={handlePfxUpload} />
                          {pfxFileName && <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 4 }}>{pfxFileName}</div>}
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: 11.5 }}>
                            Senha do .PFX
                          </label>
                          <input
                            type="password"
                            className="form-input"
                            placeholder="Senha do certificado"
                            value={pfxPassword}
                            onChange={e => setPfxPassword(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid-2" style={{ gap: 10 }}>
                        <div>
                          <label className="form-label" style={{ fontSize: 11.5 }}>
                            Opção B: Certificado .CRT / .PEM (Inter/Cora)
                          </label>
                          <input
                            type="file"
                            accept=".crt,.pem"
                            className="form-input"
                            onChange={e => handleTextFileUpload('certPemUpload', e)}
                          />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: 11.5 }}>
                            Chave Privada .KEY (Inter/Cora)
                          </label>
                          <input
                            type="file"
                            accept=".key,.pem"
                            className="form-input"
                            onChange={e => handleTextFileUpload('keyPemUpload', e)}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setSelectedBank(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  const cfgToTest: BankSavedConfig = { ...form, bankId: selectedBank.id, enabled: true };
                  saveBankConfig();
                  syncBankStatement(selectedBank, cfgToTest);
                }}
              >
                ↻ Salvar e Puxar Extrato Agora
              </button>
              <button className="btn btn-primary" onClick={saveBankConfig}>
                Salvar Configuração
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Emissão de Cobrança Direta via API Oficial Sicoob (mTLS + OAuth2) */}
      {showCobrancaModal && (
        <div className="modal-overlay" onClick={() => setShowCobrancaModal(false)}>
          <div className="modal" style={{ maxWidth: 680, maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: '#00a859',
                    color: '#fff',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                  }}
                >
                  756
                </span>
                <div>
                  <span className="modal-title">Emitir Cobrança Direta — API Sicoob (mTLS)</span>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    Cooperativa 4342 · Conta 175.204-9 · PRIVILEGE CONSULTORIA LTDA
                  </div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowCobrancaModal(false)}>
                ✕
              </button>
            </div>

            {!cobResult ? (
              <>
                <div className="grid-2" style={{ gap: 12, marginBottom: 14 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Modalidade da Cobrança</label>
                    <select
                      className="form-select"
                      value={cobForm.tipoCobranca}
                      onChange={e =>
                        setCobForm(prev => ({
                          ...prev,
                          tipoCobranca: e.target.value as 'pix_imediato' | 'pix_vencimento',
                        }))
                      }
                    >
                      <option value="pix_imediato">Pix Cobrança Imediata (PUT /pix/api/v2/cob)</option>
                      <option value="pix_vencimento">Pix com Vencimento, Multa e Juros (PUT /pix/api/v2/cobv)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Chave Pix Sicoob Recebedora</label>
                    <select
                      className="form-select"
                      value={cobForm.chavePix}
                      onChange={e => setCobForm(prev => ({ ...prev, chavePix: e.target.value }))}
                    >
                      <option value="58033979000184">CNPJ: 58.033.979/0001-84 (Privilege Consultoria)</option>
                      <option value="8f6adc95-716c-46bb-bb05-14bec147c2d9">Chave Aleatória: 8f6adc95-716c-46bb-bb05-14bec147c2d9</option>
                    </select>
                  </div>
                </div>

                <div className="grid-2" style={{ gap: 12, marginBottom: 14 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Valor da Cobrança (R$) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      placeholder="Ex: 1500.00"
                      value={cobForm.valor}
                      onChange={e => setCobForm(prev => ({ ...prev, valor: e.target.value }))}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Data de Vencimento</label>
                    <input
                      type="date"
                      className="form-input"
                      value={cobForm.dataVencimento}
                      onChange={e => setCobForm(prev => ({ ...prev, dataVencimento: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid-2" style={{ gap: 12, marginBottom: 14 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">
                      Nome / Razão Social do Pagador {cobForm.tipoCobranca === 'pix_vencimento' ? '*' : '(Opcional)'}
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Nome do cliente ou empresa"
                      value={cobForm.pagadorNome}
                      onChange={e => setCobForm(prev => ({ ...prev, pagadorNome: e.target.value }))}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">
                      CPF ou CNPJ do Pagador {cobForm.tipoCobranca === 'pix_vencimento' ? '*' : '(Opcional)'}
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Somente números ou formatado"
                      value={cobForm.pagadorDocumento}
                      onChange={e => setCobForm(prev => ({ ...prev, pagadorDocumento: e.target.value }))}
                    />
                  </div>
                </div>

                {cobForm.tipoCobranca === 'pix_vencimento' && (
                  <div className="grid-2" style={{ gap: 12, marginBottom: 14 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Multa após vencimento (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-input"
                        value={cobForm.multaPercentual}
                        onChange={e => setCobForm(prev => ({ ...prev, multaPercentual: e.target.value }))}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Juros ao mês (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-input"
                        value={cobForm.jurosMensalPercentual}
                        onChange={e => setCobForm(prev => ({ ...prev, jurosMensalPercentual: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">Descrição / Mensagem ao Pagador</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ex: Honorários Contábeis ref. competência 11/2026"
                    value={cobForm.descricao}
                    onChange={e => setCobForm(prev => ({ ...prev, descricao: e.target.value }))}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, marginBottom: 18, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={cobForm.lancarContasReceber}
                    onChange={e => setCobForm(prev => ({ ...prev, lancarContasReceber: e.target.checked }))}
                  />
                  Registrar automaticamente esta cobrança em Contas a Receber / Fluxo de Caixa
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button className="btn btn-secondary" onClick={() => setShowCobrancaModal(false)}>
                    Cancelar
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ background: '#00a859', border: 'none' }}
                    disabled={emittingCobranca}
                    onClick={handleEmitirCobrancaSicoob}
                  >
                    {emittingCobranca ? '⏳ Gerando Cobrança no Sicoob...' : '⚡ Emitir Cobrança Agora'}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ padding: '8px 0' }} className="boleto-print-wrapper">
                <style dangerouslySetInnerHTML={{ __html: `
                  @media print {
                    body * { visibility: hidden !important; }
                    .boleto-sicoob-oficial-printable, .boleto-sicoob-oficial-printable * { visibility: visible !important; }
                    .boleto-sicoob-oficial-printable {
                      position: absolute !important; left: 0 !important; top: 0 !important;
                      width: 100% !important; margin: 0 !important; padding: 12px !important;
                      border: none !important;
                    }
                    .no-print { display: none !important; }
                  }
                ` }} />
                <div
                  className="no-print"
                  style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--green)' }}>
                      ✓ Boleto Híbrido + Cobrança Pix Emitido no Sicoob ({cobResult.status})
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      <strong>TXID BACEN:</strong> <code>{cobResult.txid}</code> · <strong>Valor:</strong> R${' '}
                      {Number(cobResult.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {cobResult.boleto?.linhaDigitavel && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          navigator.clipboard.writeText(cobResult.boleto!.linhaDigitavel);
                          toast.success('Linha digitável copiada!');
                        }}
                      >
                        📋 Copiar Linha Digitável
                      </button>
                    )}
                    {cobResult.brcode && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          navigator.clipboard.writeText(cobResult.brcode);
                          toast.success('Código Pix Copia e Cola copiado!');
                        }}
                      >
                        ⚡ Copiar Pix Copia e Cola
                      </button>
                    )}
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ background: '#003641', border: 'none' }}
                      onClick={() => window.print()}
                    >
                      🖨️ Imprimir Boleto / Salvar PDF
                    </button>
                  </div>
                </div>

                {/* Aviso / Status do Registro do Código de Barras na CIP */}
                <div className="no-print" style={{ marginBottom: 14 }}>
                  {cobResult.boletoRegistradoOnline ? (
                    <div style={{ background: '#ecfdf5', border: '1px solid #10b981', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#065f46' }}>
                      <strong>✅ Código de Barras + QR Code Pix Registrados Online no Sicoob (CIP/Nuclea)!</strong>
                    </div>
                  ) : (
                    <div style={{ background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#92400e', lineHeight: 1.45 }}>
                      <div>
                        <strong>✅ QR Code Pix Oficial: REGISTRADO E ATIVO IMEDIATAMENTE</strong> (TXID: {cobResult.txid}).
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <strong>⚠️ Código de Barras (CIP):</strong>{' '}
                        {cobResult.motivoCodigoBarrasNaoRegistrado ||
                          "Para que o código de barras também seja registrado online na CIP sem precisar enviar CNAB 240, acesse developers.sicoob.com.br > Aplicativos > (PRIVILEGE CONSULTORIA) > seção APIs e marque também a API 'Cobrança Bancária'."}
                      </div>
                    </div>
                  )}
                </div>

                {/* Boleto Oficial Sicoob (Recibo do Pagador + Ficha de Compensação 756-0 FEBRABAN) */}
                {cobResult.boleto && (
                  <div style={{ marginBottom: 16 }}>
                    <BoletoSicoobOficial
                      beneficiarioNome={activeCompany?.razaoSocial || 'PRIVILEGE CONSULTORIA LTDA'}
                      beneficiarioCnpj={activeCompany?.cnpj || '58.033.979/0001-84'}
                      agencia={cobResult.boleto.agencia || '4342'}
                      convenio={cobResult.boleto.convenio || '4276485'}
                      conta={cobResult.boleto.conta || '175.204-9'}
                      nossoNumero={cobResult.boleto.nossoNumero}
                      numeroDocumento={cobResult.txid.slice(0, 10).toUpperCase()}
                      dataDocumento={new Date().toLocaleDateString('pt-BR')}
                      dataProcessamento={new Date().toLocaleDateString('pt-BR')}
                      dataVencimento={cobForm.dataVencimento.split('-').reverse().join('/')}
                      valorDocumento={`R$ ${Number(cobResult.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      linhaDigitavel={cobResult.boleto.linhaDigitavel}
                      codigoBarras={cobResult.boleto.codigoBarras}
                      pagadorNome={cobForm.pagadorNome || 'CONSUMIDOR / CLIENTE'}
                      pagadorCpfCnpj={cobForm.pagadorDocumento}
                      descricaoReferencia={cobForm.descricao}
                      brcodePix={cobResult.brcode}
                      txidPix={cobResult.txid}
                    />
                  </div>
                )}

                <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Olá${cobForm.pagadorNome ? ` ${cobForm.pagadorNome}` : ''}! Segue o boleto/cobrança referente a ${cobForm.descricao} (Valor: R$ ${Number(cobResult.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}):\n\nLinha Digitável do Boleto:\n${cobResult.boleto?.linhaDigitavel || ''}\n\nPix Copia e Cola:\n${cobResult.brcode}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary"
                    style={{ fontSize: 12.5, textDecoration: 'none' }}
                  >
                    📲 Enviar Boleto + Pix no WhatsApp
                  </a>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-secondary" onClick={() => setCobResult(null)}>
                      + Emitir Outra Cobrança
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowCobrancaModal(false)}>
                      Concluir
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
