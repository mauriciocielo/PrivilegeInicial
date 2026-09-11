'use client';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { store } from '../../../lib/store';
import { fmt } from '../../../lib/reports';

type StatusConta = 'aberto' | 'parcial' | 'liquidado' | 'cancelado';

interface Baixa {
  id: string;
  data: string;
  valor: number;
  formaPagamento: string | null;
  observacao: string | null;
  estornoDeId: string | null;
}

interface ContaFinanceira {
  id: string;
  numeroDocumento: string | null;
  descricao: string | null;
  dataVencimento: string;
  valorLiquido: number;
  status: StatusConta;
  baixas: Baixa[];
  sacado?: { nome: string; cpfCnpj: string };
  fornecedor?: { nome: string; cpfCnpj: string };
  formaPagamentoPrevista?: string | null;
}

const STATUS_LABEL: Record<StatusConta, string> = {
  aberto: 'Em aberto', parcial: 'Parcialmente pago', liquidado: 'Liquidado', cancelado: 'Cancelado',
};
const STATUS_BADGE: Record<StatusConta, string> = {
  aberto: 'badge-gray', parcial: 'badge-blue', liquidado: 'badge-green', cancelado: 'badge-red',
};

/**
 * Janela de leitura para o que o ERP do cliente lançou via API (POST
 * /api/v1/contas-receber e /contas-pagar). Não é editável por aqui de
 * propósito: o sistema de origem é o ERP — mudar algo neste dado pelo portal
 * quebraria a garantia de que ele reflete exatamente o que está lá.
 */
export default function ClienteContasErpPage() {
  const [empresaId, setEmpresaId] = useState('');
  const [aba, setAba] = useState<'receber' | 'pagar'>('receber');
  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [expandido, setExpandido] = useState<string | null>(null);

  const carregar = useCallback(async (eId: string, tipo: 'receber' | 'pagar') => {
    if (!eId) return;
    setLoading(true);
    setErro('');
    try {
      const res = await fetch(`/api/contas-financeiras?tipo=${tipo}&empresaId=${eId}`);
      const json = await res.json();
      if (!res.ok) { setErro(json.error || 'Erro ao carregar.'); setContas([]); return; }
      setContas(json.contas || []);
    } catch {
      setErro('Erro de conexão ao carregar as contas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = store.getCurrentUser();
    const defaultEmpresaId = user?.empresaIds?.[0] || store.getEmpresas()[0]?.id || '';
    const saved = sessionStorage.getItem('cf_empresa_sel') || defaultEmpresaId;
    setEmpresaId(saved);
    const handler = (e: Event) => setEmpresaId((e as CustomEvent).detail || defaultEmpresaId);
    window.addEventListener('empresaChange', handler);
    return () => window.removeEventListener('empresaChange', handler);
  }, []);

  useEffect(() => { carregar(empresaId, aba); }, [empresaId, aba, carregar]);

  const hojeIso = new Date().toISOString().split('T')[0];
  const vencida = (c: ContaFinanceira) => (c.status === 'aberto' || c.status === 'parcial') && c.dataVencimento < hojeIso;

  const filtradas = useMemo(
    () => contas.filter(c => !filtroStatus || c.status === filtroStatus),
    [contas, filtroStatus]
  );

  const resumo = useMemo(() => {
    const emAberto = contas.filter(c => c.status === 'aberto' || c.status === 'parcial');
    return {
      totalAberto: emAberto.reduce((s, c) => s + c.valorLiquido - c.baixas.reduce((sb, b) => sb + b.valor, 0), 0),
      qtdAberto: emAberto.length,
      qtdVencida: contas.filter(vencida).length,
      qtdLiquidada: contas.filter(c => c.status === 'liquidado').length,
    };
  }, [contas]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Contas via Integração ERP</div>
          <div className="page-subtitle">
            Títulos lançados pelo seu sistema de gestão através da nossa API — visualização, não editável por aqui.
          </div>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border-light)', paddingBottom: 10 }}>
          <button className={`btn ${aba === 'receber' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => setAba('receber')}>
            ↑ A Receber
          </button>
          <button className={`btn ${aba === 'pagar' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => setAba('pagar')}>
            ↓ A Pagar
          </button>
        </div>

        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="card stat-card">
            <div className="stat-icon blue">💰</div>
            <div className="stat-label">Saldo em aberto</div>
            <div className="stat-value" style={{ fontSize: 22 }}>{fmt.currency(resumo.totalAberto)}</div>
          </div>
          <div className="card stat-card">
            <div className="stat-icon purple">📄</div>
            <div className="stat-label">Títulos em aberto</div>
            <div className="stat-value" style={{ fontSize: 22 }}>{resumo.qtdAberto}</div>
          </div>
          <div className="card stat-card">
            <div className={`stat-icon ${resumo.qtdVencida > 0 ? 'red' : 'green'}`}>⚠️</div>
            <div className="stat-label">Vencidos</div>
            <div className="stat-value" style={{ fontSize: 22, color: resumo.qtdVencida > 0 ? 'var(--red)' : undefined }}>{resumo.qtdVencida}</div>
          </div>
          <div className="card stat-card">
            <div className="stat-icon green">✓</div>
            <div className="stat-label">Liquidados</div>
            <div className="stat-value" style={{ fontSize: 22 }}>{resumo.qtdLiquidada}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div className="card-title">{aba === 'receber' ? 'Contas a Receber' : 'Contas a Pagar'}</div>
            <select className="form-control form-control-sm" style={{ width: 'auto' }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              <option value="">Todos os status</option>
              <option value="aberto">Em aberto</option>
              <option value="parcial">Parcialmente pago</option>
              <option value="liquidado">Liquidado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          {erro && (
            <div style={{ padding: 16, color: 'var(--red)', fontSize: 13 }}>{erro}</div>
          )}

          {!erro && loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
          ) : !erro && filtradas.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔌</div>
              <h3>Nenhum título encontrado</h3>
              <p>
                Assim que seu ERP enviar lançamentos pela integração de API, eles aparecem aqui
                automaticamente. Fale com seu consultor se esperava ver dados nesta tela.
              </p>
            </div>
          ) : !erro && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{aba === 'receber' ? 'Sacado' : 'Fornecedor'}</th>
                    <th>Documento</th>
                    <th>Vencimento</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                    <th style={{ textAlign: 'right' }}>Em aberto</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map(c => {
                    const pessoa = aba === 'receber' ? c.sacado : c.fornecedor;
                    const baixado = c.baixas.reduce((s, b) => s + b.valor, 0);
                    const emAberto = c.valorLiquido - baixado;
                    const aberta = expandido === c.id;
                    return (
                      <Fragment key={c.id}>
                        <tr style={{ cursor: c.baixas.length > 0 ? 'pointer' : 'default' }} onClick={() => c.baixas.length > 0 && setExpandido(aberta ? null : c.id)}>
                          <td style={{ fontWeight: 600 }}>{pessoa?.nome || '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {c.numeroDocumento || c.descricao || '—'}
                            {c.formaPagamentoPrevista && <div style={{ fontSize: 10.5, color: 'var(--accent)', marginTop: 2 }}>💳 {c.formaPagamentoPrevista}</div>}
                          </td>
                          <td style={{ whiteSpace: 'nowrap', color: vencida(c) ? 'var(--red)' : undefined, fontWeight: vencida(c) ? 700 : 400 }}>
                            {fmt.date(c.dataVencimento)} {vencida(c) && '⚠️'}
                          </td>
                          <td style={{ textAlign: 'right' }}>{fmt.currency(c.valorLiquido)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt.currency(Math.max(0, emAberto))}</td>
                          <td><span className={`badge ${STATUS_BADGE[c.status]}`}>{STATUS_LABEL[c.status]}</span></td>
                          <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {c.baixas.length > 0 && (aberta ? '▲' : `▼ ${c.baixas.length} mov.`)}
                          </td>
                        </tr>
                        {aberta && c.baixas.map(b => (
                          <tr key={b.id} style={{ background: 'var(--bg-card2)' }}>
                            <td colSpan={7} style={{ padding: '8px 16px 8px 32px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                              {b.valor < 0 ? '↩ Estorno' : '✓ Baixa'} de {fmt.currency(Math.abs(b.valor))} em {fmt.date(b.data)}
                              {b.formaPagamento && ` · ${b.formaPagamento}`}
                              {b.observacao && ` · ${b.observacao}`}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
