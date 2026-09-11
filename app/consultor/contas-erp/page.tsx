'use client';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { store } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import { toast } from 'sonner';

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
}

const STATUS_LABEL: Record<StatusConta, string> = {
  aberto: 'Em aberto', parcial: 'Parcialmente pago', liquidado: 'Liquidado', cancelado: 'Cancelado',
};
const STATUS_BADGE: Record<StatusConta, string> = {
  aberto: 'badge-gray', parcial: 'badge-blue', liquidado: 'badge-green', cancelado: 'badge-red',
};

/**
 * Janela do consultor sobre o que o ERP do cliente lançou via API v1 (POST
 * /api/v1/contas-receber e /contas-pagar). É a mesma fonte que a tela do
 * cliente (app/cliente/contas-erp) exibe, com um adicional: o consultor pode
 * dar baixa manual num título aqui — útil quando o pagamento chega por fora
 * do fluxo automático de webhook, ou para conciliar com uma transação OFX
 * (ver app/consultor/importar-ofx, que sugere este mesmo título quando bate
 * data/valor com o extrato bancário importado).
 */
export default function ConsultorContasErpPage() {
  const [empresaId, setEmpresaId] = useState('');
  const [aba, setAba] = useState<'receber' | 'pagar'>('receber');
  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [expandido, setExpandido] = useState<string | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [formBaixa, setFormBaixa] = useState({ valor: '', data: '', formaPagamento: '', observacao: '' });
  const [salvandoBaixa, setSalvandoBaixa] = useState(false);

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
    const defaultEmpresaId = store.getEmpresas()[0]?.id || '';
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

  const emAbertoDe = (c: ContaFinanceira) => c.valorLiquido - c.baixas.reduce((s, b) => s + b.valor, 0);

  const resumo = useMemo(() => {
    const emAberto = contas.filter(c => c.status === 'aberto' || c.status === 'parcial');
    return {
      totalAberto: emAberto.reduce((s, c) => s + emAbertoDe(c), 0),
      qtdAberto: emAberto.length,
      qtdVencida: contas.filter(vencida).length,
      qtdLiquidada: contas.filter(c => c.status === 'liquidado').length,
    };
  }, [contas]);

  const iniciarBaixa = (c: ContaFinanceira) => {
    setBaixando(c.id);
    setExpandido(c.id);
    setFormBaixa({ valor: Math.max(0, emAbertoDe(c)).toFixed(2), data: hojeIso, formaPagamento: '', observacao: '' });
  };

  const confirmarBaixa = async (c: ContaFinanceira) => {
    const valor = Number(formBaixa.valor);
    if (!valor || valor <= 0) { toast.error('Informe um valor válido.'); return; }
    if (!formBaixa.data) { toast.error('Informe a data do pagamento.'); return; }
    setSalvandoBaixa(true);
    try {
      const res = await fetch(`/api/contas-financeiras/${c.id}/baixas?tipo=${aba}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor, data: formBaixa.data,
          formaPagamento: formBaixa.formaPagamento || undefined,
          observacao: formBaixa.observacao || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Erro ao registrar a baixa.'); return; }
      toast.success('Baixa registrada com sucesso.');
      setBaixando(null);
      carregar(empresaId, aba);
    } catch {
      toast.error('Erro de conexão ao registrar a baixa.');
    } finally {
      setSalvandoBaixa(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Contas via Integração ERP</div>
          <div className="page-subtitle">
            Títulos lançados pelo ERP do cliente através da API v1 — dê baixa manual aqui quando o
            pagamento não chegar pelo fluxo automático de webhook.
          </div>
        </div>
      </div>

      <div className="page-body">
        <div style={{
          display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20, padding: '12px 16px',
          background: 'var(--blue-bg, rgba(59,130,246,0.08))', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 8,
        }}>
          <span style={{ fontSize: 16 }}>💡</span>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Para o dia a dia (dar baixa, conciliar com o extrato bancário), use as telas normais de{' '}
            <a href="/consultor/contas-receber" style={{ color: 'var(--accent)', fontWeight: 600 }}>Contas a Receber</a>
            {' '}e <a href="/consultor/contas-pagar" style={{ color: 'var(--accent)', fontWeight: 600 }}>Contas a Pagar</a> — todo
            título com o selo <span className="badge badge-blue" style={{ fontSize: 9.5 }}>🔌 API</span> veio daqui automaticamente
            (se a empresa tiver plano de conta/portador padrão configurados em Empresas → Integração via API).
            Esta tela é o livro-razão exato como o ERP vê — útil para conferência e para dar baixa quando o
            webhook de pagamento não chegar.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border-light)', paddingBottom: 10 }}>
          <button className={`btn ${aba === 'receber' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => { setAba('receber'); setBaixando(null); }}>
            ↑ A Receber
          </button>
          <button className={`btn ${aba === 'pagar' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => { setAba('pagar'); setBaixando(null); }}>
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
                Assim que o ERP do cliente enviar lançamentos pela integração de API (veja
                Administrativo → Documentação da API), eles aparecem aqui automaticamente.
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
                    const emAberto = emAbertoDe(c);
                    const aberta = expandido === c.id;
                    const podeBaixar = c.status === 'aberto' || c.status === 'parcial';
                    return (
                      <Fragment key={c.id}>
                        <tr>
                          <td style={{ fontWeight: 600 }}>{pessoa?.nome || '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.numeroDocumento || c.descricao || '—'}</td>
                          <td style={{ whiteSpace: 'nowrap', color: vencida(c) ? 'var(--red)' : undefined, fontWeight: vencida(c) ? 700 : 400 }}>
                            {fmt.date(c.dataVencimento)} {vencida(c) && '⚠️'}
                          </td>
                          <td style={{ textAlign: 'right' }}>{fmt.currency(c.valorLiquido)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt.currency(Math.max(0, emAberto))}</td>
                          <td><span className={`badge ${STATUS_BADGE[c.status]}`}>{STATUS_LABEL[c.status]}</span></td>
                          <td style={{ fontSize: 11, whiteSpace: 'nowrap', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            {podeBaixar && (
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '2px 8px', fontSize: 10.5, border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: 4 }}
                                onClick={() => (baixando === c.id ? setBaixando(null) : iniciarBaixa(c))}
                              >
                                {baixando === c.id ? 'Cancelar' : '💵 Dar baixa'}
                              </button>
                            )}
                            {c.baixas.length > 0 && (
                              <span style={{ color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setExpandido(aberta ? null : c.id)}>
                                {aberta ? '▲' : `▼ ${c.baixas.length} mov.`}
                              </span>
                            )}
                          </td>
                        </tr>
                        {baixando === c.id && (
                          <tr style={{ background: 'var(--bg-card2)' }}>
                            <td colSpan={7} style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <div>
                                  <label className="form-label" style={{ fontSize: 11 }}>Valor (R$)</label>
                                  <input className="form-control form-control-sm" style={{ width: 120 }} type="number" step="0.01"
                                    value={formBaixa.valor} onChange={e => setFormBaixa(f => ({ ...f, valor: e.target.value }))} />
                                </div>
                                <div>
                                  <label className="form-label" style={{ fontSize: 11 }}>Data</label>
                                  <input className="form-control form-control-sm" style={{ width: 140 }} type="date"
                                    value={formBaixa.data} onChange={e => setFormBaixa(f => ({ ...f, data: e.target.value }))} />
                                </div>
                                <div>
                                  <label className="form-label" style={{ fontSize: 11 }}>Forma de pagamento</label>
                                  <input className="form-control form-control-sm" style={{ width: 140 }} placeholder="PIX, boleto..."
                                    value={formBaixa.formaPagamento} onChange={e => setFormBaixa(f => ({ ...f, formaPagamento: e.target.value }))} />
                                </div>
                                <div style={{ flex: 1, minWidth: 160 }}>
                                  <label className="form-label" style={{ fontSize: 11 }}>Observação</label>
                                  <input className="form-control form-control-sm" value={formBaixa.observacao}
                                    onChange={e => setFormBaixa(f => ({ ...f, observacao: e.target.value }))} />
                                </div>
                                <button className="btn btn-primary btn-sm" disabled={salvandoBaixa} onClick={() => confirmarBaixa(c)}>
                                  {salvandoBaixa ? 'Salvando...' : 'Confirmar baixa'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
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
