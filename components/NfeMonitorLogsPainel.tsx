'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Play, AlertTriangle, CheckCircle2, XCircle, Clock,
  Filter, Building2, Moon, Sun, Trash2, ChevronDown, ChevronRight,
  Info, ShieldAlert, Truck, FileText, Activity
} from 'lucide-react';
import { toast } from 'sonner';

export interface LogItem {
  id: string;
  empresaId: string | null;
  empresaNome: string;
  empresaCnpj: string;
  tipo: string;
  origem: string;
  status: 'sucesso' | 'erro' | 'alerta' | string;
  cStat: string | null;
  mensagem: string;
  novas: number;
  atualizadas: number;
  detalhes: string | null;
  createdAt: string;
}

interface NfeMonitorLogsPainelProps {
  empresaIdSelecionada?: string;
  ehHorarioNoturno?: boolean;
}

function formatCnpj(cnpj: string): string {
  if (!cnpj) return '';
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatDataHora(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

export default function NfeMonitorLogsPainel({
  empresaIdSelecionada,
  ehHorarioNoturno = false,
}: NfeMonitorLogsPainelProps) {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [executandoRodada, setExecutandoRodada] = useState(false);
  const [totalErros24h, setTotalErros24h] = useState(0);
  const [totalGeral, setTotalGeral] = useState(0);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [apenasErros, setApenasErros] = useState<boolean>(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const carregarLogs = useCallback(async () => {
    try {
      setCarregando(true);
      const params = new URLSearchParams();
      if (empresaIdSelecionada && empresaIdSelecionada !== 'todas') {
        params.set('empresaId', empresaIdSelecionada);
      }
      if (filtroTipo !== 'todos') params.set('tipo', filtroTipo);
      if (filtroStatus !== 'todos') params.set('status', filtroStatus);
      if (apenasErros) params.set('apenasErros', 'true');
      params.set('limit', '80');

      const res = await fetch(`/api/nfe/monitor/logs?${params.toString()}`);
      if (!res.ok) throw new Error('Falha ao obter logs');
      const data = await res.json();
      setLogs(data.logs || []);
      setTotalErros24h(data.totalErros24h || 0);
      setTotalGeral(data.totalGeral || 0);
    } catch (err: any) {
      console.error('Erro ao carregar logs:', err);
      toast.error('Erro ao carregar logs do monitor fiscal.');
    } finally {
      setCarregando(false);
    }
  }, [empresaIdSelecionada, filtroTipo, filtroStatus, apenasErros]);

  useEffect(() => {
    carregarLogs();
  }, [carregarLogs]);

  const dispararRodadaAgora = async () => {
    try {
      setExecutandoRodada(true);
      toast.info('Iniciando rodada de monitoramento fiscal em segundo plano...');
      const res = await fetch('/api/nfe/monitor/executar', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.iniciado) {
        toast.success(data.mensagem || 'Rodada concluída com sucesso!');
        setTimeout(() => carregarLogs(), 1500);
      } else {
        toast.warning(data.mensagem || 'Não foi possível iniciar a rodada.');
      }
    } catch (err: any) {
      toast.error('Erro ao acionar a rodada do monitor fiscal.');
    } finally {
      setExecutandoRodada(false);
    }
  };

  const limparLogsAntigos = async () => {
    if (!confirm('Deseja limpar os logs anteriores a 3 dias?')) return;
    try {
      const res = await fetch('/api/nfe/monitor/logs', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Limpeza concluída! ${data.apagados || 0} registros antigos removidos.`);
        carregarLogs();
      } else {
        toast.error(data.error || 'Falha ao limpar logs.');
      }
    } catch {
      toast.error('Erro ao executar a limpeza de logs.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Banner / KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#f0fdf4',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Activity size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>
              Monitor Automático
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginTop: 2 }}>
              Ativo (a cada 10 min)
            </div>
            <div style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>
              NF-e, CT-e e NFS-e automáticas
            </div>
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: totalErros24h > 0 ? '#fef2f2' : '#f0fdf4',
              color: totalErros24h > 0 ? '#dc2626' : '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {totalErros24h > 0 ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>
              Erros nas últimas 24h
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: totalErros24h > 0 ? '#dc2626' : '#16a34a', marginTop: 2 }}>
              {totalErros24h} {totalErros24h === 1 ? 'ocorrência' : 'ocorrências'}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
              {totalErros24h > 0 ? 'Exige atenção nos certificados/SEFAZ' : 'Tudo operando normalmente'}
            </div>
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: ehHorarioNoturno ? '#ede9fe' : '#fef3c7',
              color: ehHorarioNoturno ? '#6d28d9' : '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {ehHorarioNoturno ? <Moon size={20} /> : <Sun size={20} />}
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>
              Janela Noturna SEFAZ
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginTop: 2 }}>
              {ehHorarioNoturno ? 'Janela Ativa (21h às 07h)' : 'Horário Diurno'}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
              NFS-e roda 24/7 a qualquer hora
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Ações */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#4b5563', fontWeight: 600 }}>Tipo:</span>
            <select
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value)}
              style={{
                fontSize: 12,
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              <option value="todos">Todos os Tipos</option>
              <option value="nfe">NF-e (Mercadorias)</option>
              <option value="cte">CT-e (Fretes)</option>
              <option value="nfse">NFS-e (Serviços)</option>
              <option value="lote">Ciclos em Lote</option>
              <option value="geral">Monitor Geral</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#4b5563', fontWeight: 600 }}>Status:</span>
            <select
              value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value)}
              style={{
                fontSize: 12,
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              <option value="todos">Todos os Status</option>
              <option value="sucesso">Apenas Sucesso</option>
              <option value="alerta">Alertas / SEFAZ</option>
              <option value="erro">Erros / Falhas</option>
            </select>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: apenasErros ? '#dc2626' : '#4b5563',
              fontWeight: 600,
              cursor: 'pointer',
              background: apenasErros ? '#fef2f2' : '#f3f4f6',
              padding: '6px 12px',
              borderRadius: 8,
              border: `1px solid ${apenasErros ? '#fca5a5' : '#e5e7eb'}`,
            }}
          >
            <input
              type="checkbox"
              checked={apenasErros}
              onChange={e => setApenasErros(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Apenas Ocorrências & Erros
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={carregarLogs}
            disabled={carregando}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: '#374151',
              background: '#f9fafb',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              padding: '6px 12px',
              cursor: carregando ? 'wait' : 'pointer',
            }}
            title="Atualizar lista de logs"
          >
            <RefreshCw size={13} className={carregando ? 'animate-spin' : ''} />
            Atualizar
          </button>

          <button
            type="button"
            onClick={dispararRodadaAgora}
            disabled={executandoRodada}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: '#ffffff',
              background: '#600000',
              border: 'none',
              borderRadius: 8,
              padding: '7px 14px',
              cursor: executandoRodada ? 'wait' : 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
            title="Dispara a consulta automática no servidor imediatamente"
          >
            <Play size={13} fill="#ffffff" />
            {executandoRodada ? 'Consultando...' : 'Executar Rodada Agora'}
          </button>

          <button
            type="button"
            onClick={limparLogsAntigos}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              color: '#9ca3af',
              background: 'transparent',
              border: 'none',
              padding: '6px 8px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
            title="Limpar histórico com mais de 3 dias"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Lista / Tabela de Logs */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        {carregando && logs.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#6b7280' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px', color: '#600000' }} />
            <div style={{ fontSize: 13 }}>Carregando histórico do monitor fiscal...</div>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#6b7280' }}>
            <CheckCircle2 size={32} style={{ margin: '0 auto 10px', color: '#16a34a' }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Nenhum log encontrado para os filtros selecionados.</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
              As consultas automáticas e manuais aparecerão aqui assim que forem executadas.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '12px 16px' }}>Data / Hora</th>
                  <th style={{ padding: '12px 16px' }}>Tipo</th>
                  <th style={{ padding: '12px 16px' }}>Empresa</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Mensagem / Retorno</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Novas</th>
                  <th style={{ padding: '12px 16px', width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const isErro = log.status === 'erro';
                  const isAlerta = log.status === 'alerta';
                  const isSucesso = log.status === 'sucesso';

                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid #f3f4f6',
                        background: isExpanded ? '#fafafa' : isErro ? '#fff5f5' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: '#6b7280', fontSize: 12 }}>
                        {formatDataHora(log.createdAt)}
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        {log.tipo === 'cte' ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: '#fef3c7',
                              color: '#92400e',
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                            }}
                          >
                            <Truck size={11} /> CT-e
                          </span>
                        ) : log.tipo === 'nfse' ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: '#ede9fe',
                              color: '#6d28d9',
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                            }}
                          >
                            <FileText size={11} /> NFS-e
                          </span>
                        ) : log.tipo === 'nfe' ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: '#e0f2fe',
                              color: '#0369a1',
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                            }}
                          >
                            NF-e
                          </span>
                        ) : (
                          <span
                            style={{
                              background: '#f3f4f6',
                              color: '#374151',
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 6,
                            }}
                          >
                            Lote
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#111827', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.empresaNome}
                        </div>
                        {log.empresaCnpj && (
                          <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>
                            {formatCnpj(log.empresaCnpj)}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        {isErro ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: '#fee2e2',
                              color: '#991b1b',
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                            }}
                          >
                            <XCircle size={12} /> Falha
                          </span>
                        ) : isAlerta ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: '#fef3c7',
                              color: '#92400e',
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                            }}
                          >
                            <AlertTriangle size={12} /> Alerta
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: '#f0fdf4',
                              color: '#166534',
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                            }}
                          >
                            <CheckCircle2 size={12} /> Sucesso
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#374151' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {log.cStat && (
                            <span
                              style={{
                                background: '#f3f4f6',
                                color: '#1f2937',
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: 4,
                                fontFamily: 'monospace',
                              }}
                            >
                              cStat {log.cStat}
                            </span>
                          )}
                          <span style={{ fontSize: 12, color: isErro ? '#b91c1c' : '#374151' }}>
                            {log.mensagem}
                          </span>
                        </div>
                        {isExpanded && log.detalhes && (
                          <div
                            style={{
                              marginTop: 8,
                              background: '#1f2937',
                              color: '#f9fafb',
                              padding: 10,
                              borderRadius: 6,
                              fontSize: 11,
                              fontFamily: 'monospace',
                              whiteSpace: 'pre-wrap',
                              maxHeight: 180,
                              overflowY: 'auto',
                            }}
                          >
                            {log.detalhes}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {log.novas > 0 ? (
                          <span
                            style={{
                              background: '#dcfce7',
                              color: '#15803d',
                              fontWeight: 700,
                              fontSize: 11,
                              padding: '2px 8px',
                              borderRadius: 99,
                            }}
                          >
                            +{log.novas}
                          </span>
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: 11 }}>0</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {log.detalhes && (
                          <button
                            type="button"
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#6b7280',
                              cursor: 'pointer',
                              padding: 4,
                            }}
                            title="Ver detalhes técnicos"
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

