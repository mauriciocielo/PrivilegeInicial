'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Instrument_Serif } from 'next/font/google';
import {
  Inbox, Search, RefreshCw, Download, Copy, Check, Filter, Calendar, Building2,
  AlertCircle, CheckCircle2, Clock, ShieldCheck, FileText, ArrowUpDown, ChevronRight,
  ExternalLink, Eye, X, Layers, Play
} from 'lucide-react';
import { toast } from 'sonner';

const serif = Instrument_Serif({ subsets: ['latin'], weight: ['400'] });

interface EmpresaMonitor {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  certificado: 'escritorio' | 'propria' | 'ausente';
  procuracaoStatus: string | null;
  monitor: {
    ativo: boolean;
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

export default function NfeDestinadasPainel() {
  const [empresas, setEmpresas] = useState<EmpresaMonitor[]>([]);
  const [carregandoEmpresas, setCarregandoEmpresas] = useState(true);
  const [empresaIdSelecionada, setEmpresaIdSelecionada] = useState<string>('');
  const [modoVisao, setModoVisao] = useState<'empresa' | 'visao-geral'>('empresa');

  // Filtros de busca de notas
  const [busca, setBusca] = useState('');
  const [mesFiltro, setMesFiltro] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [situacaoFiltro, setSituacaoFiltro] = useState('');
  const [apenasComXml, setApenasComXml] = useState(false);

  // Dados das notas
  const [notas, setNotas] = useState<NfeDestinadaItem[]>([]);
  const [monitorAtual, setMonitorAtual] = useState<EmpresaMonitor['monitor']>(null);
  const [carregandoNotas, setCarregandoNotas] = useState(false);
  const [consultandoSefaz, setConsultandoSefaz] = useState(false);

  // Modal de Detalhes
  const [notaDetalhe, setNotaDetalhe] = useState<NfeDestinadaItem | null>(null);
  const [copiadoChave, setCopiadoChave] = useState(false);

  // Busca rápida de empresas no seletor
  const [filtroEmpresaTexto, setFiltroEmpresaTexto] = useState('');

  // Carrega empresas aptas para monitoramento
  const carregarEmpresas = useCallback(async () => {
    try {
      setCarregandoEmpresas(true);
      const res = await fetch('/api/nfe/monitor');
      if (!res.ok) throw new Error('Falha ao carregar empresas monitoradas.');
      const data = await res.json();
      const lista: EmpresaMonitor[] = data.empresas || [];
      setEmpresas(lista);

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

      const res = await fetch(`/api/nfe/destinadas?${params.toString()}`);
      if (!res.ok) throw new Error('Falha ao carregar notas destinadas.');
      const data = await res.json();
      let lista: NfeDestinadaItem[] = data.notas || [];
      if (apenasComXml) {
        lista = lista.filter(n => n.possuiXml);
      }
      setNotas(lista);
      setMonitorAtual(data.monitor || null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao buscar NF-e destinadas.');
    } finally {
      setCarregandoNotas(false);
    }
  }, [mesFiltro, dataInicio, dataFim, situacaoFiltro, busca, apenasComXml]);

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
      const data = await res.json();

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
          ativo: novoAtivo, ultimaConsultaEm: null, proximaConsultaEm: null,
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

  // Disparo manual do lote global
  const handleDispararLote = async () => {
    try {
      const res = await fetch('/api/nfe/monitor/executar', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.mensagem || 'Rodada do monitor iniciada em segundo plano!');
      } else {
        toast.warning(data.mensagem || data.error || 'Aviso ao iniciar rodada.');
      }
    } catch (err: any) {
      toast.error('Erro ao acionar lote: ' + err.message);
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

  // Totais calculados
  const totais = useMemo(() => {
    const valorTotal = notas.reduce((acc, n) => acc + (n.valorNf || 0), 0);
    const comXmlCount = notas.filter(n => n.possuiXml).length;
    return {
      quantidade: notas.length,
      valorTotal,
      comXmlCount,
      apenasResumo: notas.length - comXmlCount,
    };
  }, [notas]);

  // Empresas filtradas para seleção
  const empresasFiltradas = useMemo(() => {
    if (!filtroEmpresaTexto) return empresas;
    const txt = filtroEmpresaTexto.toLowerCase();
    return empresas.filter(e =>
      e.razaoSocial.toLowerCase().includes(txt) ||
      (e.nomeFantasia && e.nomeFantasia.toLowerCase().includes(txt)) ||
      e.cnpj.includes(txt)
    );
  }, [empresas, filtroEmpresaTexto]);

  return (
    <div className="page-body" style={{ background: '#fdfdfd', minHeight: '100%', padding: '24px 28px' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 38, height: 38, borderRadius: 10, background: '#eff6ff', color: '#2563eb'
            }}>
              <Inbox size={22} />
            </span>
            <div>
              <h1 className={serif.className} style={{ fontSize: 32, fontWeight: 400, color: '#171717', margin: 0, lineHeight: 1.1 }}>
                NF-e Destinadas
              </h1>
              <span style={{ fontSize: 13, color: '#737373' }}>
                Monitor automático de compras e notas fiscais de mercadorias emitidas para seus CNPJs (SEFAZ NT 2014.002)
              </span>
            </div>
          </div>
        </div>

        {/* Abas de Navegação / Ações do Topo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'inline-flex', padding: 3, background: '#f4f4f5', borderRadius: 8, border: '1px solid #e4e4e7'
          }}>
            <button
              onClick={() => setModoVisao('empresa')}
              style={{
                padding: '6px 14px', fontSize: 13, fontWeight: modoVisao === 'empresa' ? 600 : 500,
                borderRadius: 6, border: 'none', cursor: 'pointer', transition: 'all .15s',
                background: modoVisao === 'empresa' ? '#fff' : 'transparent',
                color: modoVisao === 'empresa' ? '#171717' : '#71717a',
                boxShadow: modoVisao === 'empresa' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              Notas da Empresa
            </button>
            <button
              onClick={() => setModoVisao('visao-geral')}
              style={{
                padding: '6px 14px', fontSize: 13, fontWeight: modoVisao === 'visao-geral' ? 600 : 500,
                borderRadius: 6, border: 'none', cursor: 'pointer', transition: 'all .15s',
                background: modoVisao === 'visao-geral' ? '#fff' : 'transparent',
                color: modoVisao === 'visao-geral' ? '#171717' : '#71717a',
                boxShadow: modoVisao === 'visao-geral' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              Monitor Geral ({empresas.length})
            </button>
          </div>

          <button
            onClick={handleDispararLote}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
            title="Aciona a rodada de varredura em segundo plano para todas as empresas ativas"
          >
            <Play size={13} />
            Varredura Geral SEFAZ
          </button>
        </div>
      </div>

      {/* Conteúdo: MODO 1 - NOTAS DA EMPRESA */}
      {modoVisao === 'empresa' && (
        <>
          {/* Seletor da Empresa Ativa */}
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

              {/* Informações do Certificado e Status */}
              {empresaAtual && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>
                      Certificado Digital
                    </div>
                    {empresaAtual.certificado === 'escritorio' ? (
                      <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <ShieldCheck size={12} /> Procuração Escritório
                      </span>
                    ) : empresaAtual.certificado === 'propria' ? (
                      <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <ShieldCheck size={12} /> Certificado Próprio A1
                      </span>
                    ) : (
                      <span className="badge badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <AlertCircle size={12} /> Sem Certificado
                      </span>
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>
                      Auto-Monitoramento
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

            {/* Aviso anti-bloqueio SEFAZ */}
            {monitorAtual?.ultimoStatus && (
              <div style={{
                marginTop: 14, paddingTop: 12, borderTop: '1px solid #f3f4f6',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#4b5563'
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
                Sincronismo SEFAZ
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 20, fontWeight: 600, color: '#374151' }}>
                {esperaInfo.bloqueado ? (
                  <>
                    <Clock size={20} color="#f59e0b" />
                    <span>Em espera</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={20} color="#16a34a" />
                    <span>Pronto p/ consulta</span>
                  </>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                Janela anti-bloqueio respeitada
              </div>
            </div>
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

          {/* Tabela de Notas Destinadas */}
          <div style={{
            background: '#ffffff', borderRadius: 10, border: '1px solid #e5e7eb',
            overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: 12 }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Emissão</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Número / Série</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Emitente (Fornecedor)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Valor Total</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Situação</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>XML</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {carregandoNotas ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                      <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#2563eb' }} />
                      Carregando NF-e destinadas...
                    </td>
                  </tr>
                ) : notas.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 48, textAlign: 'center', color: '#6b7280' }}>
                      <Inbox size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>Nenhuma nota destinada encontrada</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                        {busca || mesFiltro || dataInicio ? 'Tente ajustar os filtros informados.' : 'Clique em "Consultar SEFAZ Agora" para buscar novos documentos.'}
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
                      <td style={{ padding: '12px 16px', color: '#111827', whiteSpace: 'nowrap' }}>
                        {formatData(n.dataEmissao)}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#111827', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {n.numero ? `NF ${n.numero}` : '-'}
                        {n.serie ? <span style={{ color: '#6b7280', fontSize: 11, marginLeft: 4 }}>Série {n.serie}</span> : ''}
                      </td>
                      <td style={{ padding: '12px 16px', maxWidth: 280 }}>
                        <div style={{ fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.emitenteNome || 'Fornecedor não identificado'}
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
                        ) : (
                          <span className="badge" style={{ background: '#f3f4f6', color: '#6b7280', fontSize: 11 }}>Resumo</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {n.possuiXml && (
                            <button
                              onClick={() => handleBaixarXml(n.id, n.numero)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '5px 8px', fontSize: 12 }}
                              title="Baixar XML Completo (procNFe)"
                            >
                              <Download size={13} />
                              XML
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
        </>
      )}

      {/* Conteúdo: MODO 2 - VISÃO GERAL DO MONITOR (TODAS AS EMPRESAS) */}
      {modoVisao === 'visao-geral' && (
        <div style={{
          background: '#ffffff', borderRadius: 12, border: '1px solid #e5e7eb',
          overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 }}>
                Status do Monitor por Empresa
              </h2>
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                Acompanhamento das consultas agendadas, NSUs processados e certificados vinculados
              </span>
            </div>
            <div style={{ width: 280, position: 'relative' }}>
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

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: 12 }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Empresa</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Certificado</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Monitor Automático</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Total Notas</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Último Retorno SEFAZ</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Próxima Consulta</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregandoEmpresas ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#2563eb' }} />
                    Carregando empresas monitoradas...
                  </td>
                </tr>
              ) : empresasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                    Nenhuma empresa encontrada com os filtros informados.
                  </td>
                </tr>
              ) : (
                empresasFiltradas.map((emp) => {
                  const m = emp.monitor;
                  const bloqueado = m?.proximaConsultaEm && new Date(m.proximaConsultaEm).getTime() > Date.now();
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
                        {emp.certificado === 'escritorio' ? (
                          <span className="badge badge-green" style={{ fontSize: 11 }}>Procuração</span>
                        ) : emp.certificado === 'propria' ? (
                          <span className="badge badge-green" style={{ fontSize: 11 }}>A1 Próprio</span>
                        ) : (
                          <span className="badge badge-red" style={{ fontSize: 11 }}>Ausente</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleToggleMonitor(emp.id, !(m?.ativo ?? true))}
                          className={`badge ${m?.ativo !== false ? 'badge-green' : 'badge-yellow'}`}
                          style={{ cursor: 'pointer', border: 'none', padding: '4px 10px' }}
                          title="Clique para alternar status"
                        >
                          {m?.ativo !== false ? 'Ativo' : 'Pausado'}
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
                            setModoVisao('empresa');
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
                        : 'Para obter o XML completo, efetue a Manifestação do Destinatário na SEFAZ.'}
                    </div>
                  </div>
                </div>

                {notaDetalhe.possuiXml && (
                  <button
                    onClick={() => handleBaixarXml(notaDetalhe.id, notaDetalhe.numero)}
                    className="btn btn-primary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Download size={13} /> Baixar XML
                  </button>
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
    </div>
  );
}

