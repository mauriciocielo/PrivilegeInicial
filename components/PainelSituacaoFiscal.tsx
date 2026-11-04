'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import CertidaoFederalModal from './CertidaoFederalModal';

interface CertidaoItem {
  id: string;
  tipo: 'FEDERAL' | 'ESTADUAL';
  uf: string;
  situacao: 'NEGATIVA' | 'POSITIVA_COM_EFEITO_NEGATIVA' | 'POSITIVA' | 'PROCESSANDO' | 'ERRO';
  protocolo?: string;
  numeroCertidao?: string;
  codigoAutenticidade?: string;
  emitidoEm: string;
  validoAte?: string;
  observacoes?: string;
  criadoAutomaticamente: boolean;
}

interface EmpresaSituacao {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  uf: string | null;
  cidade: string | null;
  federal: CertidaoItem | null;
  estadual: CertidaoItem | null;
  historico: CertidaoItem[];
}

interface Metricas {
  total: number;
  regulares: number;
  comEfeito: number;
  pendencias: number;
  naoConsultadas: number;
}

interface ConfigAgendamento {
  ativo: boolean;
  executarUltimoDia: boolean;
  horario: string;
  consultarFederal: boolean;
  consultarEstadual: boolean;
  notificarEmail: boolean;
  emailsNotificacao?: string;
  notificarApenasComPendencias?: boolean;
}

export default function PainelSituacaoFiscal() {
  const [empresas, setEmpresas] = useState<EmpresaSituacao[]>([]);
  const [metricas, setMetricas] = useState<Metricas>({ total: 0, regulares: 0, comEfeito: 0, pendencias: 0, naoConsultadas: 0 });
  const [config, setConfig] = useState<ConfigAgendamento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [processandoLote, setProcessandoLote] = useState(false);
  const [processandoId, setProcessandoId] = useState<string | null>(null);

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroUf, setFiltroUf] = useState<string>('todas');
  const [filtroTipo, setFiltroTipo] = useState<'todas' | 'federal' | 'estadual'>('todas');

  // Modais
  const [modalConfigAberto, setModalConfigAberto] = useState(false);
  const [modalConsultaAvulsaAberto, setModalConsultaAvulsaAberto] = useState(false);
  const [historicoEmpresa, setHistoricoEmpresa] = useState<EmpresaSituacao | null>(null);

  const carregarDados = async () => {
    try {
      setCarregando(true);
      const res = await fetch('/api/certidoes');
      const dados = await res.json();
      if (res.ok) {
        setEmpresas(dados.empresas || []);
        setMetricas(dados.metricas || { total: 0, regulares: 0, comEfeito: 0, pendencias: 0, naoConsultadas: 0 });
        setConfig(dados.configAgendamento || null);
      } else {
        toast.error(dados.error || 'Erro ao carregar certidões fiscais.');
      }
    } catch {
      toast.error('Erro de conexão ao carregar dados de certidões.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Consulta de uma empresa específica
  const consultarEmpresa = async (empresaId: string, tipo?: 'FEDERAL' | 'ESTADUAL') => {
    try {
      setProcessandoId(empresaId);
      const res = await fetch('/api/certidoes/consultar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId,
          federal: !tipo || tipo === 'FEDERAL',
          estadual: !tipo || tipo === 'ESTADUAL',
        }),
      });
      const dados = await res.json();
      if (res.ok && dados.sucesso) {
        toast.success('Consulta de certidão concluída com sucesso!');
        await carregarDados();
      } else {
        toast.error(dados.error || 'Erro ao consultar certidão da empresa.');
      }
    } catch {
      toast.error('Erro ao conectar ao serviço de certidões.');
    } finally {
      setProcessandoId(null);
    }
  };

  // Consulta em lote de todas as empresas
  const consultarTodasEmLote = async () => {
    if (!confirm('Deseja consultar a CND Federal e Estadual de todas as empresas da carteira agora?')) return;
    try {
      setProcessandoLote(true);
      toast.info('Iniciando consulta em lote no Integra Contador e SEFAZ...');
      const res = await fetch('/api/certidoes/consultar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todas: true, federal: true, estadual: true }),
      });
      const dados = await res.json();
      if (res.ok && dados.sucesso) {
        toast.success(`Consulta em lote finalizada! ${dados.total} empresas verificadas.`);
        await carregarDados();
      } else {
        toast.error(dados.error || 'Falha ao processar lote.');
      }
    } catch {
      toast.error('Erro de conexão durante o processamento do lote.');
    } finally {
      setProcessandoLote(false);
    }
  };

  // Salvar configuração de agendamento mensal
  const salvarConfiguracao = async (novaConfig: ConfigAgendamento) => {
    try {
      const res = await fetch('/api/certidoes/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novaConfig),
      });
      const dados = await res.json();
      if (res.ok && dados.sucesso) {
        toast.success('Configuração de agendamento automático salva com sucesso!');
        setConfig(dados.config);
        setModalConfigAberto(false);
      } else {
        toast.error(dados.error || 'Erro ao salvar configuração.');
      }
    } catch {
      toast.error('Erro de conexão ao salvar configuração.');
    }
  };

  // Disparar execução forçada da rotina mensal de teste
  const executarRotinaMensalTeste = async () => {
    if (!confirm('Deseja forçar a execução da rotina do último dia do mês agora para teste?')) return;
    try {
      setProcessandoLote(true);
      const res = await fetch('/api/cron/certidoes-mensal?forcar=true');
      const dados = await res.json();
      if (res.ok && dados.sucesso) {
        toast.success(`Rotina executada! ${dados.resultado?.totalProcessado || 0} empresas processadas.`);
        await carregarDados();
        setModalConfigAberto(false);
      } else {
        toast.error(dados.error || 'Erro ao executar rotina.');
      }
    } catch {
      toast.error('Erro de conexão.');
    } finally {
      setProcessandoLote(false);
    }
  };

  // Filtragem
  const empresasFiltradas = useMemo(() => {
    return empresas.filter(e => {
      // Busca textual
      const texto = `${e.razaoSocial} ${e.nomeFantasia || ''} ${e.cnpj}`.toLowerCase();
      if (busca && !texto.includes(busca.toLowerCase())) return false;

      // Filtro UF
      if (filtroUf !== 'todas' && (e.uf || 'PR') !== filtroUf) return false;

      // Filtro Status
      if (filtroStatus === 'regulares') {
        const fedOk = e.federal?.situacao === 'NEGATIVA';
        const estOk = e.estadual?.situacao === 'NEGATIVA';
        if (!fedOk && !estOk) return false;
      } else if (filtroStatus === 'com_efeito') {
        const fedEfeito = e.federal?.situacao === 'POSITIVA_COM_EFEITO_NEGATIVA';
        const estEfeito = e.estadual?.situacao === 'POSITIVA_COM_EFEITO_NEGATIVA';
        if (!fedEfeito && !estEfeito) return false;
      } else if (filtroStatus === 'pendencias') {
        const fedPend = e.federal?.situacao === 'POSITIVA' || e.federal?.situacao === 'ERRO';
        const estPend = e.estadual?.situacao === 'POSITIVA' || e.estadual?.situacao === 'ERRO';
        if (!fedPend && !estPend) return false;
      } else if (filtroStatus === 'nao_consultadas') {
        if (e.federal || e.estadual) return false;
      }

      return true;
    });
  }, [empresas, busca, filtroUf, filtroStatus]);

  const renderBadgeSituacao = (item: CertidaoItem | null) => {
    if (!item) {
      return (
        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, background: 'var(--bg-hover, #f1f5f9)', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>
          Não consultada
        </span>
      );
    }
    if (item.situacao === 'NEGATIVA') {
      return (
        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, background: 'rgba(16, 185, 129, 0.12)', color: '#059669', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          ✓ NEGATIVA
        </span>
      );
    }
    if (item.situacao === 'POSITIVA_COM_EFEITO_NEGATIVA') {
      return (
        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', fontWeight: 700, border: '1px solid rgba(2, 132, 199, 0.3)' }}>
          ✓ POS. C/ EFEITO
        </span>
      );
    }
    if (item.situacao === 'POSITIVA') {
      return (
        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', fontWeight: 700, border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          ⚠ POSITIVA (DÉBITO)
        </span>
      );
    }
    return (
      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, background: 'rgba(234, 179, 8, 0.12)', color: '#b45309', fontWeight: 600 }}>
        {item.situacao}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Banner / Header */}
      <div style={{
        background: 'var(--bg-card)',
        padding: '24px 28px',
        borderRadius: 14,
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #1e3a8a, #0284c7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 26,
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
          }}>
            🏛️
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Painel de Regularidade Fiscal & CNDs (Federal e Estadual)
            </h1>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              Monitoramento automático e consulta oficial perante a Receita Federal / PGFN e Secretarias da Fazenda Estaduais (SEFAZ).
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setModalConfigAberto(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}
          >
            ⚙️ Automação Mensal
            {config?.ativo && (
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} title="Rotina Ativa no Último Dia do Mês" />
            )}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setModalConsultaAvulsaAberto(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}
          >
            🔍 Consulta Avulsa
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={consultarTodasEmLote}
            disabled={processandoLote || carregando}
            style={{
              background: 'linear-gradient(135deg, #1e3a8a, #0284c7)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {processandoLote ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                Consultando Carteira...
              </>
            ) : (
              <>
                ⚡ Consultar Todas em Lote
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: 14,
      }}>
        <div style={{ background: 'var(--bg-card)', padding: '16px 20px', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Empresas Monitoradas
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
            {metricas.total}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {metricas.naoConsultadas} aguardando 1ª consulta
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '16px 20px', borderRadius: 12, border: '1px solid var(--border)', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#059669', textTransform: 'uppercase' }}>
            Certidões Negativas
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#059669', marginTop: 4 }}>
            {metricas.regulares}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            100% Regulares sem débitos
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '16px 20px', borderRadius: 12, border: '1px solid var(--border)', borderLeft: '4px solid #0284c7' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0284c7', textTransform: 'uppercase' }}>
            Positivas c/ Efeito
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#0284c7', marginTop: 4 }}>
            {metricas.comEfeito}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Débitos suspensos / parcelados
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '16px 20px', borderRadius: 12, border: '1px solid var(--border)', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', textTransform: 'uppercase' }}>
            Com Pendências
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#dc2626', marginTop: 4 }}>
            {metricas.pendencias}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Débitos ou omissão fiscal
          </div>
        </div>
      </div>

      {/* Main Filter & Table Container */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 14,
        border: '1px solid var(--border)',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        {/* Barra de Filtros */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          background: 'var(--bg-card2, #fafafa)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 260 }}>
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por Razão Social, Fantasia ou CNPJ..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{ maxWidth: 360, fontSize: 13 }}
            />

            <select
              className="form-control"
              value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value)}
              style={{ maxWidth: 190, fontSize: 13 }}
            >
              <option value="todos">Todos os Status</option>
              <option value="regulares">Apenas Regulares (Negativas)</option>
              <option value="com_efeito">Positivas com Efeito</option>
              <option value="pendencias">Com Pendências / Débitos</option>
              <option value="nao_consultadas">Não Consultadas</option>
            </select>

            <select
              className="form-control"
              value={filtroUf}
              onChange={e => setFiltroUf(e.target.value)}
              style={{ maxWidth: 140, fontSize: 13 }}
            >
              <option value="todas">Todas UFs</option>
              <option value="PR">PR (Paraná)</option>
              <option value="SC">SC (Santa Catarina)</option>
              <option value="SP">SP (São Paulo)</option>
              <option value="RS">RS (Rio Grande do Sul)</option>
            </select>
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Exibindo <strong>{empresasFiltradas.length}</strong> de {empresas.length} empresas
          </div>
        </div>

        {/* Tabela de Empresas & Certidões */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-card2)', borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                <th style={{ padding: '12px 18px' }}>Empresa</th>
                <th style={{ padding: '12px 14px' }}>UF</th>
                <th style={{ padding: '12px 16px' }}>CND Federal (RFB/PGFN)</th>
                <th style={{ padding: '12px 16px' }}>CND Estadual (SEFAZ)</th>
                <th style={{ padding: '12px 18px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Carregando situação fiscal da carteira...
                  </td>
                </tr>
              ) : empresasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhuma empresa encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                empresasFiltradas.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: 13.5 }}>
                        {e.nomeFantasia || e.razaoSocial}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace' }}>
                        {e.cnpj}
                      </div>
                      {e.nomeFantasia && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                          {e.razaoSocial}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '14px 14px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: 'var(--bg-card2, #f1f5f9)',
                        fontWeight: 700,
                        fontSize: 11,
                        color: 'var(--text-main)',
                        border: '1px solid var(--border)',
                      }}>
                        {e.uf || 'PR'}
                      </span>
                    </td>

                    {/* CND Federal */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {renderBadgeSituacao(e.federal)}
                        {e.federal?.id && (
                          <a
                            href={`/api/certidoes/${e.federal.id}/download`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                            title="Visualizar Certidão Federal em PDF"
                          >
                            📄 PDF
                          </a>
                        )}
                      </div>
                      {e.federal && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          {new Date(e.federal.emitidoEm).toLocaleDateString('pt-BR')} às {new Date(e.federal.emitidoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {e.federal.protocolo && ` • Prot: ${e.federal.protocolo.slice(0, 16)}...`}
                        </div>
                      )}
                    </td>

                    {/* CND Estadual */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {renderBadgeSituacao(e.estadual)}
                        {e.estadual?.id && (
                          <a
                            href={`/api/certidoes/${e.estadual.id}/download`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                            title="Visualizar Certidão Estadual em PDF"
                          >
                            📄 PDF
                          </a>
                        )}
                      </div>
                      {e.estadual && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          {new Date(e.estadual.emitidoEm).toLocaleDateString('pt-BR')}
                          {e.estadual.numeroCertidao && ` • Nº: ${e.estadual.numeroCertidao}`}
                        </div>
                      )}
                    </td>

                    {/* Ações */}
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={processandoId === e.id || processandoLote}
                          onClick={() => consultarEmpresa(e.id)}
                          style={{
                            background: 'linear-gradient(135deg, #1e3a8a, #0284c7)',
                            fontSize: 12,
                            padding: '4px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          title="Consultar CND Federal e Estadual desta empresa agora"
                        >
                          {processandoId === e.id ? 'Consultando...' : '⚡ Consultar'}
                        </button>

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setHistoricoEmpresa(e)}
                          style={{ fontSize: 12, padding: '4px 10px' }}
                          title="Ver histórico de certidões anteriores"
                        >
                          📜 Histórico
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

      {/* ========================================================================= */}
      {/* MODAL DE AGENDAMENTO AUTOMÁTICO (ÚLTIMO DIA DO MÊS) */}
      {/* ========================================================================= */}
      {modalConfigAberto && config && (
        <div className="modal-backdrop" onClick={() => setModalConfigAberto(false)}>
          <div className="modal-container" style={{ maxWidth: 560, width: '95%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 22 }}>⚙️</div>
                <div>
                  <h2 className="modal-title" style={{ fontSize: 17, margin: 0 }}>
                    Configuração de Automação Mensal de CNDs
                  </h2>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Consulta automática de regularidade fiscal no fechamento mensal
                  </div>
                </div>
              </div>
              <button type="button" className="modal-close" onClick={() => setModalConfigAberto(false)}>&times;</button>
            </div>

            <div className="modal-body" style={{ paddingTop: 16 }}>
              <div style={{ background: 'var(--bg-card2, #f8fafc)', padding: 14, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16, fontSize: 13, lineHeight: 1.5 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
                  Como funciona a consulta automática:
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  O sistema dispara a rotina automaticamente <strong>1 vez no mês, exatamente no último dia</strong> (ex: dia 28/29 de fev, 30 ou 31 nos demais meses), gerando a CND Federal (Integra Contador / SERPRO) e a CND Estadual (SEFAZ) para todas as empresas ativas.
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={config.ativo}
                    onChange={e => setConfig({ ...config, ativo: e.target.checked })}
                    style={{ width: 18, height: 18 }}
                  />
                  <span>Ativar rotina mensal automática de CNDs</span>
                </label>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={config.executarUltimoDia}
                    onChange={e => setConfig({ ...config, executarUltimoDia: e.target.checked })}
                    style={{ width: 18, height: 18 }}
                  />
                  <span>Executar no último dia do mês às {config.horario}</span>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={config.consultarFederal}
                    onChange={e => setConfig({ ...config, consultarFederal: e.target.checked })}
                  />
                  <span>Gerar CND Federal</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={config.consultarEstadual}
                    onChange={e => setConfig({ ...config, consultarEstadual: e.target.checked })}
                  />
                  <span>Gerar CND Estadual</span>
                </label>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>E-mails para Notificação / Alerta de Débitos</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="ex: fiscal@privilegecontabilidade.com.br, contato@..."
                  value={config.emailsNotificacao || ''}
                  onChange={e => setConfig({ ...config, emailsNotificacao: e.target.value })}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Receba um resumo com todas as certidões e alertas de empresas que perderam a certidão negativa.
                </div>
              </div>

              <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={executarRotinaMensalTeste}
                  disabled={processandoLote}
                  style={{ color: '#0284c7' }}
                >
                  ▶️ Executar Rotina Agora (Teste)
                </button>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModalConfigAberto(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => salvarConfiguracao(config)}
                style={{ background: 'linear-gradient(135deg, #1e3a8a, #0284c7)' }}
              >
                Salvar Configuração
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE HISTÓRICO DE CERTIDÕES DA EMPRESA */}
      {/* ========================================================================= */}
      {historicoEmpresa && (
        <div className="modal-backdrop" onClick={() => setHistoricoEmpresa(null)}>
          <div className="modal-container" style={{ maxWidth: 650, width: '95%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title" style={{ fontSize: 17, margin: 0 }}>
                  Histórico de Certidões — {historicoEmpresa.nomeFantasia || historicoEmpresa.razaoSocial}
                </h2>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  CNPJ: {historicoEmpresa.cnpj} • UF: {historicoEmpresa.uf || 'PR'}
                </div>
              </div>
              <button type="button" className="modal-close" onClick={() => setHistoricoEmpresa(null)}>&times;</button>
            </div>

            <div className="modal-body" style={{ paddingTop: 14 }}>
              {historicoEmpresa.historico.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Nenhuma certidão registrada no histórico desta empresa.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto' }}>
                  {historicoEmpresa.historico.map(h => (
                    <div
                      key={h.id}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: 'var(--bg-card2, #f8fafc)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 12, color: h.tipo === 'FEDERAL' ? '#1e3a8a' : '#0284c7' }}>
                            CND {h.tipo}
                          </span>
                          {renderBadgeSituacao(h)}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          Emitida em: {new Date(h.emitidoEm).toLocaleDateString('pt-BR')} às {new Date(h.emitidoEm).toLocaleTimeString('pt-BR')}
                          {h.protocolo && ` • Prot: ${h.protocolo.slice(0, 20)}...`}
                          {h.numeroCertidao && ` • Nº: ${h.numeroCertidao}`}
                        </div>
                      </div>

                      <a
                        href={`/api/certidoes/${h.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 12, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        📄 Abrir PDF
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setHistoricoEmpresa(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Consulta Avulsa */}
      {modalConsultaAvulsaAberto && (
        <CertidaoFederalModal
          onFechar={() => {
            setModalConsultaAvulsaAberto(false);
            carregarDados();
          }}
          empresas={empresas.map(e => ({ id: e.id, nome: e.nomeFantasia || e.razaoSocial, cnpj: e.cnpj }))}
        />
      )}
    </div>
  );
}

