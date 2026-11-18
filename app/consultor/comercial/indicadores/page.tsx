'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TrendingUp, DollarSign, Target, Percent, Save, Plus, Trash2 } from 'lucide-react';
import { store } from '@/lib/store';
import { toast } from 'sonner';
import ComercialExportBar from '@/components/ComercialExportBar';

interface MonthlyProjection {
  id: string;
  month: string;
  meta: number;
  realizado: number;
  vendasCount: number;
  leadsCount: number;
  propostasCount: number;
}

const DEFAULT_PROJECTIONS: MonthlyProjection[] = [
  { id: 'm1', month: 'Jan/2027', meta: 120000, realizado: 112000, vendasCount: 28, leadsCount: 190, propostasCount: 64 },
  { id: 'm2', month: 'Fev/2027', meta: 135000, realizado: 141000, vendasCount: 33, leadsCount: 210, propostasCount: 72 },
  { id: 'm3', month: 'Mar/2027', meta: 150000, realizado: 148500, vendasCount: 35, leadsCount: 230, propostasCount: 80 },
];

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
}

export default function ComercialIndicadoresPage() {
  const [empresaId, setEmpresaId] = useState('default');
  const [rows, setRows] = useState<MonthlyProjection[]>(DEFAULT_PROJECTIONS);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    const emp = store.getSafeEmpresaId() || 'default';
    setEmpresaId(emp);
    fetch(`/api/comercial?empresaId=${encodeURIComponent(emp)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data?.indicadores) && d.data.indicadores.length > 0) {
          setRows(d.data.indicadores);
        }
      })
      .catch(() => {})
      .finally(() => {
        setTimeout(() => { loadedRef.current = true; }, 100);
      });
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    const t = setTimeout(() => {
      fetch('/api/comercial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, sectionKey: 'indicadores', value: rows }),
      }).catch(() => {});
    }, 1000);
    return () => clearTimeout(t);
  }, [rows, empresaId]);

  const kpis = useMemo(() => {
    const totalMeta = rows.reduce((a, r) => a + Number(r.meta || 0), 0);
    const totalRealizado = rows.reduce((a, r) => a + Number(r.realizado || 0), 0);
    const totalVendas = rows.reduce((a, r) => a + Number(r.vendasCount || 0), 0);
    const totalLeads = rows.reduce((a, r) => a + Number(r.leadsCount || 0), 0);
    const totalPropostas = rows.reduce((a, r) => a + Number(r.propostasCount || 0), 0);

    const avgMensal = rows.length > 0 ? totalRealizado / rows.length : 0;
    const ticketMedio = totalVendas > 0 ? totalRealizado / totalVendas : 0;
    const atingimento = totalMeta > 0 ? (totalRealizado / totalMeta) * 100 : 0;
    const convGlobal = totalLeads > 0 ? (totalVendas / totalLeads) * 100 : 0;
    const convProposta = totalPropostas > 0 ? (totalVendas / totalPropostas) * 100 : 0;

    return {
      totalMeta,
      totalRealizado,
      avgMensal,
      ticketMedio,
      atingimento,
      convGlobal,
      convProposta,
      totalLeads,
      totalPropostas,
      totalVendas,
    };
  }, [rows]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/comercial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, sectionKey: 'indicadores', value: rows }),
      });
      const d = await res.json();
      if (d.success) toast.success('Indicadores Comerciais salvos!');
      else toast.error(d.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <TrendingUp size={26} color="var(--accent)" />
            Indicadores Comerciais — Projeções &amp; Monetização
          </div>
          <div className="page-subtitle">
            Acompanhamento consultivo de projeções de vendas, faturamento mensal, ticket médio e taxa de conversão.
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            onClick={() =>
              setRows(prev => [
                ...prev,
                { id: `m_${Date.now()}`, month: 'Novo Mês', meta: 0, realizado: 0, vendasCount: 0, leadsCount: 0, propostasCount: 0 },
              ])
            }
            className="btn btn-secondary"
          >
            <Plus size={15} /> Adicionar Mês
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
            <Save size={15} /> {saving ? 'Salvando...' : 'Salvar Análise'}
          </button>
        </div>
      </div>
      <div className="page-body">

      {/* Barra de Exportação & Compartilhamento */}
      <ComercialExportBar
        title="Indicadores Comercial — Projeções & Monetização"
        fileNameBase="comercial_indicadores"
        kpis={[
          { label: 'Faturamento Mensal Médio', value: fmtBRL(kpis.avgMensal) },
          { label: 'Ticket Médio', value: fmtBRL(kpis.ticketMedio) },
          { label: 'Atingimento da Projeção', value: `${kpis.atingimento.toFixed(1)}%` },
          { label: 'Taxa de Conversão Global', value: `${kpis.convGlobal.toFixed(1)}%` },
        ]}
        columns={[
          { header: 'Mês', key: 'month' },
          { header: 'Meta (R$)', key: 'metaFmt' },
          { header: 'Realizado (R$)', key: 'realizadoFmt' },
          { header: 'Leads', key: 'leadsCount' },
          { header: 'Propostas', key: 'propostasCount' },
          { header: 'Vendas', key: 'vendasCount' },
          { header: 'Ticket Médio', key: 'tmFmt' },
          { header: 'Conversão', key: 'convFmt' },
        ]}
        rows={rows.map(r => ({
          ...r,
          metaFmt: fmtBRL(r.meta),
          realizadoFmt: fmtBRL(r.realizado),
          tmFmt: fmtBRL(r.vendasCount > 0 ? r.realizado / r.vendasCount : 0),
          convFmt: `${(r.leadsCount > 0 ? (r.vendasCount / r.leadsCount) * 100 : 0).toFixed(1)}%`,
        }))}
      />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>Faturamento Mensal Médio</span>
            <DollarSign size={15} color="var(--accent)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6, color: 'var(--accent)' }}>{fmtBRL(kpis.avgMensal)}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>Acumulado: {fmtBRL(kpis.totalRealizado)}</div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>Ticket Médio</span>
            <TrendingUp size={15} color="var(--gold)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>{fmtBRL(kpis.ticketMedio)}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{kpis.totalVendas} vendas no período</div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>Atingimento da Projeção</span>
            <Target size={15} color="#16a34a" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6, color: kpis.atingimento >= 100 ? '#16a34a' : 'var(--yellow)' }}>
            {kpis.atingimento.toFixed(1)}%
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>Meta total: {fmtBRL(kpis.totalMeta)}</div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>Taxa de Conversão</span>
            <Percent size={15} color="var(--accent)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>{kpis.convGlobal.toFixed(1)}%</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
            Fechamento de propostas: {kpis.convProposta.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Funil visual */}
      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 12px' }}>Funil de Monetização e Conversão</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 700 }}>1. LEADS GERADOS</div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>{kpis.totalLeads}</div>
          </div>
          <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 700 }}>2. PROPOSTAS ENVIADAS</div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>{kpis.totalPropostas}</div>
            <div style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 700 }}>
              {kpis.totalLeads > 0 ? ((kpis.totalPropostas / kpis.totalLeads) * 100).toFixed(1) : '0.0'}% dos leads
            </div>
          </div>
          <div style={{ padding: 14, borderRadius: 12, background: 'var(--accent-glow)', border: '1px solid var(--accent-border)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 700 }}>3. VENDAS FECHADAS</div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4, color: 'var(--accent)' }}>{kpis.totalVendas}</div>
            <div style={{ fontSize: 11.5, color: '#16a34a', fontWeight: 700 }}>
              {kpis.convProposta.toFixed(1)}% das propostas
            </div>
          </div>
        </div>
      </div>

      {/* Tabela Editável de Projeções Mensais */}
      <div className="card" style={{ padding: 18 }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 12px' }}>Projeções de Vendas &amp; Faturamento Mensal (Editável com o Cliente)</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '8px' }}>Mês</th>
                <th style={{ padding: '8px' }}>Projeção / Meta (R$)</th>
                <th style={{ padding: '8px' }}>Faturamento Realizado (R$)</th>
                <th style={{ padding: '8px' }}>Leads</th>
                <th style={{ padding: '8px' }}>Propostas</th>
                <th style={{ padding: '8px' }}>Vendas</th>
                <th style={{ padding: '8px' }}>Ticket Médio</th>
                <th style={{ padding: '8px' }}>Conversão</th>
                <th style={{ padding: '8px' }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const tm = r.vendasCount > 0 ? r.realizado / r.vendasCount : 0;
                const conv = r.leadsCount > 0 ? (r.vendasCount / r.leadsCount) * 100 : 0;
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        className="form-control"
                        style={{ width: 100, padding: '5px 8px', fontSize: 12 }}
                        value={r.month}
                        onChange={e => setRows(prev => prev.map((x, i) => (i === idx ? { ...x, month: e.target.value } : x)))}
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="number"
                        className="form-control"
                        style={{ width: 125, padding: '5px 8px', fontSize: 12 }}
                        value={r.meta}
                        onChange={e => setRows(prev => prev.map((x, i) => (i === idx ? { ...x, meta: Number(e.target.value) } : x)))}
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="number"
                        className="form-control"
                        style={{ width: 125, padding: '5px 8px', fontSize: 12 }}
                        value={r.realizado}
                        onChange={e => setRows(prev => prev.map((x, i) => (i === idx ? { ...x, realizado: Number(e.target.value) } : x)))}
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="number"
                        className="form-control"
                        style={{ width: 80, padding: '5px 8px', fontSize: 12 }}
                        value={r.leadsCount}
                        onChange={e => setRows(prev => prev.map((x, i) => (i === idx ? { ...x, leadsCount: Number(e.target.value) } : x)))}
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="number"
                        className="form-control"
                        style={{ width: 80, padding: '5px 8px', fontSize: 12 }}
                        value={r.propostasCount}
                        onChange={e => setRows(prev => prev.map((x, i) => (i === idx ? { ...x, propostasCount: Number(e.target.value) } : x)))}
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="number"
                        className="form-control"
                        style={{ width: 80, padding: '5px 8px', fontSize: 12 }}
                        value={r.vendasCount}
                        onChange={e => setRows(prev => prev.map((x, i) => (i === idx ? { ...x, vendasCount: Number(e.target.value) } : x)))}
                      />
                    </td>
                    <td style={{ padding: '6px 8px', fontWeight: 700 }}>{fmtBRL(tm)}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--accent)' }}>{conv.toFixed(1)}%</td>
                    <td style={{ padding: '6px 8px' }}>
                      <button
                        type="button"
                        onClick={() => setRows(prev => prev.filter((_, i) => i !== idx))}
                        className="btn btn-secondary"
                        style={{ padding: '5px 8px', color: '#dc2626' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </>
  );
}
