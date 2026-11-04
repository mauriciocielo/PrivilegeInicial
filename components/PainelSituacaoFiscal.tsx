'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, CircleSlash, Copy, ExternalLink, FileText, History, Landmark, Play, RefreshCw, Search, Settings, ShieldAlert, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { confirmAsync } from './ConfirmProvider';
import { lerJsonResposta } from '../lib/nfe/resposta-cliente';
import { hojeBrasilia } from '../lib/nfse/dps';
import { ORDEM_CATEGORIAS, SITUACOES_ANEXO, TAMANHO_MAX_PDF, URL_CND_RECEITA, statusValidade, temPdfRelatorio, type CategoriaFederal } from '../lib/certidoes/situacao';
import { PORTAIS_ESTADUAIS, UFS, portalDaUf } from '../lib/certidoes/portais-estaduais';

interface Consulta {
  id: string;
  tipo?: string;
  uf?: string | null;
  situacao: string;
  protocolo?: string | null;
  emitidoEm?: string | null;
  validoAte?: string | null;
  observacoes?: string | null;
  criadoAutomaticamente: boolean;
  createdAt: string;
}

interface EmpresaSituacao {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  uf: string | null;
  cidade: string | null;
  federal: Consulta | null;
  categoria: CategoriaFederal;
  estaduais: Consulta[];
  historico: Consulta[];
}

type Metricas = Record<CategoriaFederal, number> & { total: number };

interface ConfigRotina {
  ativo: boolean;
  notificarEmail: boolean;
  emailsNotificacao?: string | null;
}

const METRICAS_VAZIAS: Metricas = { total: 0, pendencias: 0, atencao: 0, nao_consultada: 0, com_efeito: 0, sem_pendencias: 0 };

/** Dias a partir dos quais a consulta é tratada como antiga. */
const DIAS_CONSULTA_ANTIGA = 30;

const CATEGORIAS: Record<CategoriaFederal, { titulo: string; ajuda: string; rotulo: string; classe: string; cor: string; Icone: typeof ShieldCheck }> = {
  pendencias: { titulo: 'Com pendências', ajuda: 'Débitos ou omissões no relatório', rotulo: 'Com pendências', classe: 'badge-red', cor: '#b91c1c', Icone: ShieldAlert },
  atencao: { titulo: 'Precisam de conferência', ajuda: 'Erro, PDF ilegível ou consulta antiga', rotulo: 'Conferir', classe: 'badge-yellow', cor: '#b45309', Icone: AlertTriangle },
  nao_consultada: { titulo: 'Não consultadas', ajuda: 'Ainda sem relatório', rotulo: 'Não consultada', classe: '', cor: '#525252', Icone: CircleSlash },
  com_efeito: { titulo: 'Débitos suspensos', ajuda: 'Exigibilidade suspensa', rotulo: 'Débitos suspensos', classe: 'badge-blue', cor: '#1d4ed8', Icone: ShieldCheck },
  sem_pendencias: { titulo: 'Sem pendências', ajuda: 'Conforme o último relatório', rotulo: 'Sem pendências', classe: 'badge-green', cor: '#15803d', Icone: CheckCircle2 },
};

const ROTULO_ATENCAO: Record<string, string> = {
  ERRO: 'Erro na consulta',
  PROCESSANDO: 'Em processamento',
  INDETERMINADA: 'Conferir no PDF',
};

function rotuloDaConsulta(e: EmpresaSituacao): string {
  if (e.categoria !== 'atencao') return CATEGORIAS[e.categoria].rotulo;
  return ROTULO_ATENCAO[e.federal?.situacao || ''] || 'Consultar de novo';
}

function detalheDaConsulta(e: EmpresaSituacao): string | null {
  if (e.categoria !== 'atencao' || !e.federal) return null;
  if (ROTULO_ATENCAO[e.federal.situacao]) return e.federal.observacoes || null;
  return 'Consulta feita antes da correção da leitura do relatório: o resultado anterior não é confiável.';
}

const dataDaConsulta = (c: Consulta) => new Date(c.emitidoEm || c.createdAt);
const diasDesde = (d: Date) => Math.floor((Date.now() - d.getTime()) / 86_400_000);

function textoIdade(c: Consulta): string {
  const dias = diasDesde(dataDaConsulta(c));
  if (dias <= 0) return 'hoje';
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}

const linkStyle = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 };

/** A validade fica em UTC ao meio-dia: mostrar em UTC mantém o dia que está na certidão. */
const formatarValidade = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

function textoValidade(validoAte: string | null | undefined): { texto: string; cor: string } {
  const { status, dias } = statusValidade(validoAte, hojeBrasilia());
  if (status === 'sem_validade' || !validoAte) return { texto: 'Sem validade informada', cor: 'var(--text-muted)' };
  if (status === 'vencida') return { texto: `Vencida em ${formatarValidade(validoAte)}`, cor: '#b91c1c' };
  if (status === 'vencendo') return { texto: dias === 0 ? 'Vence hoje' : `Vence em ${dias} dia(s)`, cor: '#b45309' };
  return { texto: `Válida até ${formatarValidade(validoAte)}`, cor: 'var(--text-muted)' };
}

const CLASSE_ANEXO: Record<string, string> = { NEGATIVA: 'badge-green', POSITIVA_COM_EFEITO_NEGATIVA: 'badge-blue', POSITIVA: 'badge-red' };

function lerPdfBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(',')[1] || '');
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    leitor.readAsDataURL(arquivo);
  });
}

export default function PainelSituacaoFiscal() {
  const [empresas, setEmpresas] = useState<EmpresaSituacao[]>([]);
  const [metricas, setMetricas] = useState<Metricas>(METRICAS_VAZIAS);
  const [config, setConfig] = useState<ConfigRotina | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState('');
  const [consultandoId, setConsultandoId] = useState<string | null>(null);
  const [lote, setLote] = useState<{ feitas: number; total: number } | null>(null);
  const cancelarLote = useRef(false);

  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaFederal | ''>('');
  const [filtroUf, setFiltroUf] = useState('');

  const [modalRotina, setModalRotina] = useState(false);
  const [salvandoRotina, setSalvandoRotina] = useState(false);
  const [historicoEmpresa, setHistoricoEmpresa] = useState<EmpresaSituacao | null>(null);
  const [modalEstados, setModalEstados] = useState(false);
  const [buscaEstado, setBuscaEstado] = useState('');
  const [filtroEstadual, setFiltroEstadual] = useState<'' | 'sem' | 'vencendo'>('');

  // Emitir no portal e anexar o PDF
  const [anexoEmpresa, setAnexoEmpresa] = useState<EmpresaSituacao | null>(null);
  const [anexoUf, setAnexoUf] = useState('');
  const [anexoSituacao, setAnexoSituacao] = useState('NEGATIVA');
  const [anexoValidade, setAnexoValidade] = useState('');
  const [anexoArquivo, setAnexoArquivo] = useState<File | null>(null);
  const [anexando, setAnexando] = useState(false);

  const abrirAnexo = (e: EmpresaSituacao) => {
    setAnexoEmpresa(e);
    setAnexoUf((e.uf || '').trim().toUpperCase());
    setAnexoSituacao('NEGATIVA');
    setAnexoValidade('');
    setAnexoArquivo(null);
  };

  const enviarAnexo = async () => {
    if (!anexoEmpresa) return;
    if (!anexoUf) { toast.error('Selecione o estado da certidão.'); return; }
    if (!anexoArquivo) { toast.error('Selecione o PDF da certidão.'); return; }
    if (anexoSituacao !== 'POSITIVA' && !anexoValidade) { toast.error('Informe a validade que consta na certidão.'); return; }
    if (anexoArquivo.size > TAMANHO_MAX_PDF) { toast.error('O PDF precisa ter no máximo 3 MB.'); return; }
    setAnexando(true);
    try {
      const res = await fetch('/api/certidoes/anexar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId: anexoEmpresa.id,
          uf: anexoUf,
          situacao: anexoSituacao,
          validoAte: anexoValidade,
          nomeArquivo: anexoArquivo.name,
          pdfBase64: await lerPdfBase64(anexoArquivo),
        }),
      });
      const dados = await lerJsonResposta(res);
      if (!res.ok) throw new Error(dados.error || 'Não foi possível guardar a certidão.');
      toast.success('Certidão guardada.');
      setAnexoEmpresa(null);
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível guardar a certidão.');
    } finally {
      setAnexando(false);
    }
  };

  const removerAnexo = async (id: string) => {
    const confirmado = await confirmAsync('Remover esta certidão do sistema? O documento continua válido no estado, mas o PDF sai daqui.', {
      title: 'Remover certidão', confirmText: 'Remover', cancelText: 'Manter', danger: true,
    });
    if (!confirmado) return;
    try {
      const res = await fetch(`/api/certidoes/${id}`, { method: 'DELETE' });
      const dados = await lerJsonResposta(res);
      if (!res.ok) throw new Error(dados.error || 'Não foi possível remover a certidão.');
      toast.success('Certidão removida.');
      setHistoricoEmpresa(null);
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível remover a certidão.');
    }
  };

  const copiarCnpj = async (cnpj: string) => {
    try {
      await navigator.clipboard.writeText(cnpj.replace(/\D/g, ''));
      toast.success('CNPJ copiado. Cole no portal do estado.');
    } catch {
      toast.error('Não foi possível copiar o CNPJ.');
    }
  };

  const estadosFiltrados = useMemo(() => {
    const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const termo = normalizar(buscaEstado.trim());
    return UFS.filter(uf => !termo || normalizar(`${uf} ${PORTAIS_ESTADUAIS[uf].nome}`).includes(termo));
  }, [buscaEstado]);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch('/api/certidoes');
      const dados = await lerJsonResposta(res);
      if (!res.ok) throw new Error(dados.error || 'Erro ao carregar a situação fiscal.');
      setEmpresas(dados.empresas || []);
      setMetricas(dados.metricas || METRICAS_VAZIAS);
      setConfig(dados.configAgendamento || null);
      setErroCarga('');
    } catch (err) {
      setErroCarga(err instanceof Error ? err.message : 'Sem conexão para carregar a situação fiscal.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const ufsDisponiveis = useMemo(() => [...new Set(empresas.map(e => e.uf).filter((u): u is string => !!u))].sort(), [empresas]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const digitos = termo.replace(/\D/g, '');
    return empresas
      .filter(e => {
        if (filtroCategoria && e.categoria !== filtroCategoria) return false;
        if (filtroUf && e.uf !== filtroUf) return false;
        if (filtroEstadual === 'sem' && (e.estaduais || []).length > 0) return false;
        if (filtroEstadual === 'vencendo') {
          const hoje = hojeBrasilia();
          const atencao = (e.estaduais || []).some(c => ['vencida', 'vencendo'].includes(statusValidade(c.validoAte, hoje).status));
          if (!atencao) return false;
        }
        if (!termo) return true;
        return `${e.razaoSocial} ${e.nomeFantasia || ''}`.toLowerCase().includes(termo)
          || (digitos.length > 0 && e.cnpj.replace(/\D/g, '').includes(digitos));
      })
      .sort((a, b) => ORDEM_CATEGORIAS.indexOf(a.categoria) - ORDEM_CATEGORIAS.indexOf(b.categoria)
        || (a.nomeFantasia || a.razaoSocial).localeCompare(b.nomeFantasia || b.razaoSocial, 'pt-BR'));
  }, [empresas, busca, filtroCategoria, filtroUf, filtroEstadual]);

  /** Devolve a situação, ou null se a própria chamada falhou. */
  const consultarUma = async (empresaId: string): Promise<{ situacao: string; mensagem?: string } | null> => {
    const res = await fetch('/api/certidoes/consultar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaId }),
    });
    const dados = await lerJsonResposta(res);
    if (!res.ok) throw new Error(dados.error || 'Erro ao consultar a situação fiscal.');
    return dados.resultado;
  };

  const consultarEmpresa = async (e: EmpresaSituacao) => {
    setConsultandoId(e.id);
    try {
      const r = await consultarUma(e.id);
      const nome = e.nomeFantasia || e.razaoSocial;
      if (r?.situacao === 'ERRO') toast.error(`${nome}: ${r.mensagem || 'erro na consulta.'}`, { duration: 12000 });
      else if (r?.situacao === 'POSITIVA') toast.warning(`${nome}: o relatório aponta pendências.`);
      else if (r?.situacao === 'NEGATIVA') toast.success(`${nome}: relatório sem pendências.`);
      else toast.info(`${nome}: ${r?.mensagem || 'consulta concluída.'}`);
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao consultar a situação fiscal.');
    } finally {
      setConsultandoId(null);
    }
  };

  // Uma por vez, a partir da tela: cada chamada cabe no tempo do servidor e o progresso fica visível.
  const consultarLista = async () => {
    const fila = [...filtradas];
    if (fila.length === 0) return;
    const confirmado = await confirmAsync(
      `Consultar ${fila.length} empresa(s) da lista? Cada consulta usa o Integra Contador do SERPRO, que pode ser cobrado. Mantenha esta aba aberta até terminar.`,
      { title: 'Consultar a lista', confirmText: 'Consultar' },
    );
    if (!confirmado) return;

    cancelarLote.current = false;
    const contagem = { pendencias: 0, erros: 0, feitas: 0 };
    setLote({ feitas: 0, total: fila.length });
    for (const e of fila) {
      if (cancelarLote.current) break;
      try {
        const r = await consultarUma(e.id);
        if (r?.situacao === 'POSITIVA') contagem.pendencias++;
        if (r?.situacao === 'ERRO') contagem.erros++;
      } catch {
        contagem.erros++;
      }
      contagem.feitas++;
      setLote({ feitas: contagem.feitas, total: fila.length });
    }
    setLote(null);
    await carregar();
    const resumo = `${contagem.feitas} de ${fila.length} consultada(s): ${contagem.pendencias} com pendências, ${contagem.erros} com erro.`;
    if (contagem.erros > 0 || contagem.pendencias > 0) toast.warning(resumo, { duration: 12000 });
    else toast.success(resumo);
  };

  const salvarRotina = async () => {
    if (!config) return;
    setSalvandoRotina(true);
    try {
      const res = await fetch('/api/certidoes/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, consultarFederal: true, consultarEstadual: false }),
      });
      const dados = await lerJsonResposta(res);
      if (!res.ok) throw new Error(dados.error || 'Erro ao salvar a configuração.');
      setConfig(dados.config);
      setModalRotina(false);
      toast.success('Configuração salva.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar a configuração.');
    } finally {
      setSalvandoRotina(false);
    }
  };

  const ocupado = !!lote || !!consultandoId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Situação Fiscal</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Pendências de cada empresa na Receita Federal e na PGFN, pelo relatório SITFIS.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a className="btn btn-secondary" href={URL_CND_RECEITA} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <ExternalLink size={14} /> Emitir CND na Receita
          </a>
          <button type="button" className="btn btn-secondary" onClick={() => { setBuscaEstado(''); setModalEstados(true); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Landmark size={14} /> Certidões estaduais (27)
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setModalRotina(true)} disabled={!config} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Settings size={14} /> Rotina mensal
          </button>
        </div>
      </div>

      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#78350f', lineHeight: 1.5 }}>
        <strong>O relatório não é uma certidão.</strong> Ele mostra as pendências, mas a CND federal é emitida no portal da Receita. A certidão estadual é emitida no portal do estado: o sistema abre o portal certo, e você anexa o PDF para guardar e acompanhar a validade.
      </div>

      {/* Totais: cada um filtra a lista */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        {ORDEM_CATEGORIAS.map(categoria => {
          const { titulo, ajuda, cor, Icone } = CATEGORIAS[categoria];
          const ativo = filtroCategoria === categoria;
          return (
            <button
              key={categoria}
              type="button"
              aria-pressed={ativo}
              onClick={() => setFiltroCategoria(ativo ? '' : categoria)}
              style={{
                textAlign: 'left', cursor: 'pointer', background: 'var(--bg-card)', padding: '12px 14px', borderRadius: 12,
                border: `1px solid ${ativo ? cor : 'var(--border)'}`, boxShadow: ativo ? `inset 0 0 0 1px ${cor}` : 'none', color: 'inherit', font: 'inherit',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                <Icone size={14} color={cor} /> {titulo}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{metricas[categoria]}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ajuda}</div>
            </button>
          );
        })}
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 380 }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="form-control"
              aria-label="Buscar empresa"
              placeholder="Buscar por nome ou CNPJ..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{ paddingLeft: 32, fontSize: 13 }}
            />
          </div>
          {ufsDisponiveis.length > 1 && (
            <select className="form-control" aria-label="Filtrar por estado" value={filtroUf} onChange={e => setFiltroUf(e.target.value)} style={{ width: 'auto', fontSize: 13 }}>
              <option value="">Todos os estados</option>
              {ufsDisponiveis.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          )}
          <select className="form-control" aria-label="Filtrar por certidão estadual" value={filtroEstadual} onChange={e => setFiltroEstadual(e.target.value as typeof filtroEstadual)} style={{ width: 'auto', fontSize: 13 }}>
            <option value="">Certidão estadual: todas</option>
            <option value="sem">Sem certidão anexada</option>
            <option value="vencendo">Vencida ou vencendo</option>
          </select>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{filtradas.length} de {empresas.length} empresas</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {lote ? (
              <>
                <span role="status" style={{ fontSize: 13 }}>Consultando {Math.min(lote.feitas + 1, lote.total)} de {lote.total}...</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { cancelarLote.current = true; }}>Parar</button>
              </>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" onClick={consultarLista} disabled={ocupado || carregando || filtradas.length === 0} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Play size={13} /> Consultar esta lista ({filtradas.length})
              </button>
            )}
          </div>
        </div>

        {lote && (
          <div style={{ height: 3, background: 'var(--border-light)' }}>
            <div style={{ height: '100%', width: `${(lote.feitas / lote.total) * 100}%`, background: '#600000', transition: 'width .2s' }} />
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Situação federal</th>
                <th>Última consulta</th>
                <th>Certidão estadual</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando a situação fiscal...</td></tr>
              ) : erroCarga ? (
                <tr>
                  <td colSpan={5} style={{ padding: 40, textAlign: 'center' }}>
                    <div style={{ marginBottom: 10 }}>{erroCarga}</div>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setCarregando(true); carregar(); }}>Tentar de novo</button>
                  </td>
                </tr>
              ) : filtradas.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    {empresas.length === 0 ? 'Nenhuma empresa com CNPJ válido na sua carteira.' : 'Nenhuma empresa com estes filtros.'}
                  </td>
                </tr>
              ) : filtradas.map(e => {
                const detalhe = detalheDaConsulta(e);
                const antiga = !!e.federal && diasDesde(dataDaConsulta(e.federal)) > DIAS_CONSULTA_ANTIGA;
                return (
                  <tr key={e.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{e.nomeFantasia || e.razaoSocial}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{e.cnpj}</div>
                    </td>
                    <td style={{ maxWidth: 300 }}>
                      <span className={`badge ${CATEGORIAS[e.categoria].classe}`} style={CATEGORIAS[e.categoria].classe ? undefined : { background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                        {rotuloDaConsulta(e)}
                      </span>
                      {detalhe && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>{detalhe}</div>}
                    </td>
                    <td style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
                      {e.federal ? (
                        <>
                          <div>{dataDaConsulta(e.federal).toLocaleDateString('pt-BR')}</div>
                          <div style={{ fontSize: 11.5, color: antiga ? '#b45309' : 'var(--text-muted)' }}>{textoIdade(e.federal)}{antiga ? ': consulte de novo' : ''}</div>
                        </>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12.5 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                        {(e.estaduais || []).map(c => {
                          const validade = textoValidade(c.validoAte);
                          return (
                            <div key={c.id}>
                              <span className={`badge ${CLASSE_ANEXO[c.situacao] || ''}`}>{c.uf}: {SITUACOES_ANEXO[c.situacao] || c.situacao}</span>
                              <div style={{ fontSize: 11.5, color: validade.cor, marginTop: 2 }}>
                                {validade.texto}
                                {' · '}
                                <a href={`/api/certidoes/${c.id}/download`} target="_blank" rel="noreferrer">PDF</a>
                              </div>
                            </div>
                          );
                        })}
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => abrirAnexo(e)} style={linkStyle}>
                          <Upload size={12} /> {(e.estaduais || []).length > 0 ? 'Atualizar' : 'Emitir e anexar'}
                        </button>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        {e.federal && temPdfRelatorio(e.federal.situacao) && (
                          <a className="btn btn-secondary btn-sm" href={`/api/certidoes/${e.federal.id}/download`} target="_blank" rel="noreferrer" title="Abrir o relatório em PDF" style={linkStyle}>
                            <FileText size={12} /> PDF
                          </a>
                        )}
                        {e.historico.length > 0 && (
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setHistoricoEmpresa(e)} title="Consultas anteriores" aria-label={`Histórico de ${e.razaoSocial}`} style={linkStyle}>
                            <History size={12} />
                          </button>
                        )}
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => consultarEmpresa(e)} disabled={ocupado} style={linkStyle}>
                          <RefreshCw size={12} className={consultandoId === e.id ? 'animate-spin' : undefined} />
                          {consultandoId === e.id ? 'Consultando...' : 'Consultar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {anexoEmpresa && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !anexando && setAnexoEmpresa(null)}>
          <div className="modal" style={{ maxWidth: 560, maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Certidão estadual</h2>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{anexoEmpresa.nomeFantasia || anexoEmpresa.razaoSocial} — {anexoEmpresa.cnpj}</div>
              </div>
              <button type="button" className="modal-close" onClick={() => setAnexoEmpresa(null)} disabled={anexando}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="anexo-uf">Estado</label>
              <select id="anexo-uf" className="form-control" value={anexoUf} onChange={e => setAnexoUf(e.target.value)} disabled={anexando}>
                <option value="">Selecione</option>
                {UFS.map(uf => <option key={uf} value={uf}>{uf} — {PORTAIS_ESTADUAIS[uf].nome}</option>)}
              </select>
            </div>

            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>1. Emita no portal do estado</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => copiarCnpj(anexoEmpresa.cnpj)} style={linkStyle}>
                <Copy size={12} /> Copiar CNPJ
              </button>
              {portalDaUf(anexoUf)?.links.map(l => (
                <a key={l.url} className="btn btn-secondary btn-sm" href={l.url} target="_blank" rel="noreferrer" style={linkStyle}>
                  <ExternalLink size={12} /> {l.rotulo}
                </a>
              ))}
            </div>
            {portalDaUf(anexoUf)?.observacao && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>{portalDaUf(anexoUf)?.observacao}</div>}

            <div style={{ fontSize: 13, fontWeight: 600, margin: '14px 0 6px' }}>2. Anexe o PDF baixado</div>
            <div className="form-group">
              <label className="form-label" htmlFor="anexo-pdf">PDF da certidão (até 3 MB)</label>
              <input id="anexo-pdf" type="file" accept="application/pdf,.pdf" style={{ fontSize: 12 }} disabled={anexando} onChange={e => setAnexoArquivo(e.target.files?.[0] || null)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="anexo-situacao">Situação na certidão</label>
                <select id="anexo-situacao" className="form-control" value={anexoSituacao} onChange={e => setAnexoSituacao(e.target.value)} disabled={anexando}>
                  {Object.entries(SITUACOES_ANEXO).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="anexo-validade">Válida até{anexoSituacao === 'POSITIVA' ? '' : ' *'}</label>
                <input id="anexo-validade" type="date" className="form-control" value={anexoValidade} onChange={e => setAnexoValidade(e.target.value)} disabled={anexando} />
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              Copie a situação e a validade do próprio documento. O sistema guarda o arquivo e registra quem anexou, mas não confere a autenticidade: ela é validada no portal do estado.
            </div>

            <div className="form-actions" style={{ marginTop: 14 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setAnexoEmpresa(null)} disabled={anexando}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={enviarAnexo} disabled={anexando}>{anexando ? 'Guardando...' : 'Guardar certidão'}</button>
            </div>
          </div>
        </div>
      )}

      {modalEstados && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalEstados(false)}>
          <div className="modal modal-lg" style={{ maxWidth: 860, maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Certidões estaduais</h2>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  Portal oficial dos 27 estados. A empresa precisa da certidão de cada estado em que atua.
                </div>
              </div>
              <button type="button" className="modal-close" onClick={() => setModalEstados(false)}>✕</button>
            </div>
            <input
              className="form-control"
              aria-label="Buscar estado"
              placeholder="Buscar estado..."
              value={buscaEstado}
              onChange={e => setBuscaEstado(e.target.value)}
              style={{ marginBottom: 12, fontSize: 13 }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 8 }}>
              {estadosFiltrados.map(uf => {
                const portal = PORTAIS_ESTADUAIS[uf];
                return (
                  <div key={uf} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{uf} — {portal.nome}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
                      {portal.links.map(l => (
                        <a key={l.url} href={l.url} target="_blank" rel="noreferrer" style={linkStyle}><ExternalLink size={12} /> {l.rotulo}</a>
                      ))}
                    </div>
                    {portal.observacao && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{portal.observacao}</div>}
                  </div>
                );
              })}
              {estadosFiltrados.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nenhum estado encontrado.</div>}
            </div>
            <div className="form-actions" style={{ marginTop: 14 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModalEstados(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {modalRotina && config && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalRotina(false)}>
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h2 className="modal-title">Rotina mensal</h2>
              <button type="button" className="modal-close" onClick={() => setModalRotina(false)}>✕</button>
            </div>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#78350f', marginBottom: 14 }}>
              <strong>A rotina ainda não está agendada:</strong> nada roda sozinho no último dia do mês. Por enquanto, use &quot;Consultar esta lista&quot;. Estas opções só passam a valer quando o agendamento for ativado.
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13.5, marginBottom: 14 }}>
              <input type="checkbox" checked={config.ativo} onChange={e => setConfig({ ...config, ativo: e.target.checked })} />
              Consultar a carteira no último dia do mês
            </label>
            <div className="form-group">
              <label className="form-label">E-mails que recebem o resumo</label>
              <input
                className="form-control"
                placeholder="fiscal@empresa.com.br, contato@empresa.com.br"
                value={config.emailsNotificacao || ''}
                onChange={e => setConfig({ ...config, emailsNotificacao: e.target.value })}
              />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setModalRotina(false)}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={salvarRotina} disabled={salvandoRotina}>{salvandoRotina ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {historicoEmpresa && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setHistoricoEmpresa(null)}>
          <div className="modal" style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Histórico</h2>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{historicoEmpresa.nomeFantasia || historicoEmpresa.razaoSocial} — {historicoEmpresa.cnpj}</div>
              </div>
              <button type="button" className="modal-close" onClick={() => setHistoricoEmpresa(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
              {historicoEmpresa.historico.map(h => (
                <div key={h.id} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {h.tipo === 'ESTADUAL' ? `Estadual ${h.uf || ''}: ${SITUACOES_ANEXO[h.situacao] || h.situacao}` : 'Federal'} — {dataDaConsulta(h).toLocaleDateString('pt-BR')} às {dataDaConsulta(h).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      {h.criadoAutomaticamente && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> — automática</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {h.tipo === 'ESTADUAL' && h.validoAte ? `${textoValidade(h.validoAte).texto}. ` : ''}{h.observacoes || h.situacao}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {temPdfRelatorio(h.situacao) && (
                      <a className="btn btn-secondary btn-sm" href={`/api/certidoes/${h.id}/download`} target="_blank" rel="noreferrer" style={linkStyle}>
                        <FileText size={12} /> PDF
                      </a>
                    )}
                    {h.tipo === 'ESTADUAL' && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => removerAnexo(h.id)} aria-label="Remover certidão" title="Remover certidão" style={{ ...linkStyle, color: '#b91c1c' }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setHistoricoEmpresa(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
