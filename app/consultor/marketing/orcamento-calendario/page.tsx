'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, DollarSign, Save, Plus, Trash2 } from 'lucide-react';
import { store } from '@/lib/store';
import { toast } from 'sonner';
import ComercialExportBar from '@/components/ComercialExportBar';

interface BudgetRow {
  id: string;
  channel: string;
  budget: number;
  leads: number;
  revenue: number;
}

interface CalendarItem {
  id: string;
  date: string;
  title: string;
  format: string;
  owner: string;
  status: 'planejado' | 'producao' | 'publicado';
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
}

export default function MarketingOrcamentoCalendarioPage() {
  const [empresaId, setEmpresaId] = useState('default');
  const [budgets, setBudgets] = useState<BudgetRow[]>([
    { id: 'b1', channel: 'Google Ads (Pesquisa)', budget: 1500, leads: 45, revenue: 18000 },
    { id: 'b2', channel: 'Meta Ads (Instagram/Facebook)', budget: 1200, leads: 60, revenue: 12000 },
    { id: 'b3', channel: 'Produção de Vídeos e Fotos', budget: 800, leads: 20, revenue: 6500 },
  ]);
  const [calendar, setCalendar] = useState<CalendarItem[]>([
    { id: 'c1', date: '2026-11-25', title: 'Captação de Vídeos Institucionais & Provas Sociais', format: 'Vídeos e Fotos', owner: 'Audiovisual + Diretoria', status: 'planejado' },
    { id: 'c2', date: '2026-12-02', title: 'Campanha Impulsionamento Planejamento 2027', format: 'Tráfego Pago / Reels', owner: 'Marketing', status: 'producao' },
  ]);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    const emp = store.getSafeEmpresaId() || 'default';
    setEmpresaId(emp);
    fetch(`/api/comercial?empresaId=${encodeURIComponent(emp)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.mkt_orcamento_calendario) {
          if (Array.isArray(d.data.mkt_orcamento_calendario.budgets)) setBudgets(d.data.mkt_orcamento_calendario.budgets);
          if (Array.isArray(d.data.mkt_orcamento_calendario.calendar)) setCalendar(d.data.mkt_orcamento_calendario.calendar);
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
        body: JSON.stringify({
          empresaId,
          sectionKey: 'mkt_orcamento_calendario',
          value: { budgets, calendar },
        }),
      }).catch(() => {});
    }, 1000);
    return () => clearTimeout(t);
  }, [budgets, calendar, empresaId]);

  const totals = useMemo(() => {
    const totalBudget = budgets.reduce((a, b) => a + Number(b.budget || 0), 0);
    const totalLeads = budgets.reduce((a, b) => a + Number(b.leads || 0), 0);
    const totalRev = budgets.reduce((a, b) => a + Number(b.revenue || 0), 0);
    const roi = totalBudget > 0 ? ((totalRev - totalBudget) / totalBudget) * 100 : 0;
    const cpl = totalLeads > 0 ? totalBudget / totalLeads : 0;
    return { totalBudget, totalLeads, totalRev, roi, cpl };
  }, [budgets]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/comercial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId,
          sectionKey: 'mkt_orcamento_calendario',
          value: { budgets, calendar },
        }),
      });
      const d = await res.json();
      if (d.success) toast.success('Orçamento e Calendário MKT salvos!');
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
            <CalendarDays size={26} color="var(--accent)" />
            Orçamento de Marketing, Calendário &amp; ROI
          </div>
          <div className="page-subtitle">
            Estruturação de verba por canal, custo por lead (CPL), retorno sobre investimento (ROI) e calendário de eventos/produções.
          </div>
        </div>
        <div className="header-actions">
          <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
            <Save size={15} /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <ComercialExportBar
        title="Orçamento de Marketing & ROI"
        fileNameBase="marketing_orcamento_roi"
        kpis={[
          { label: 'Orçamento Total', value: fmtBRL(totals.totalBudget) },
          { label: 'Leads Gerados', value: String(totals.totalLeads) },
          { label: 'Custo por Lead (CPL)', value: fmtBRL(totals.cpl) },
          { label: 'ROI Estimado', value: `${totals.roi.toFixed(0)}%` },
        ]}
        columns={[
          { header: 'Canal / Investimento', key: 'channel' },
          { header: 'Verba', key: 'budgetFmt' },
          { header: 'Leads', key: 'leads' },
          { header: 'CPL', key: 'cplFmt' },
          { header: 'Receita Gerada', key: 'revFmt' },
          { header: 'ROI', key: 'roiFmt' },
        ]}
        rows={budgets.map(b => ({
          ...b,
          budgetFmt: fmtBRL(b.budget),
          cplFmt: fmtBRL(b.leads > 0 ? b.budget / b.leads : 0),
          revFmt: fmtBRL(b.revenue),
          roiFmt: `${(b.budget > 0 ? ((b.revenue - b.budget) / b.budget) * 100 : 0).toFixed(0)}%`,
        }))}
      />

      {/* Orçamento */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarSign size={18} color="var(--accent)" /> Estruturação do Orçamento de Marketing
          </h3>
          <button
            type="button"
            onClick={() => setBudgets(prev => [...prev, { id: `b_${Date.now()}`, channel: 'Novo Canal', budget: 0, leads: 0, revenue: 0 }])}
            className="btn btn-secondary"
            style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <Plus size={14} /> Adicionar Canal
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: 8 }}>Canal / Ação</th>
                <th style={{ padding: 8 }}>Verba Mensal (R$)</th>
                <th style={{ padding: 8 }}>Leads</th>
                <th style={{ padding: 8 }}>CPL</th>
                <th style={{ padding: 8 }}>Receita Atribuída (R$)</th>
                <th style={{ padding: 8 }}>ROI</th>
                <th style={{ padding: 8 }}></th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((b, idx) => {
                const cpl = b.leads > 0 ? b.budget / b.leads : 0;
                const roi = b.budget > 0 ? ((b.revenue - b.budget) / b.budget) * 100 : 0;
                return (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: 6 }}><input className="form-control" style={{ fontSize: 14 }} value={b.channel} onChange={e => setBudgets(prev => prev.map((x, i) => (i === idx ? { ...x, channel: e.target.value } : x)))} /></td>
                    <td style={{ padding: 6 }}><input type="number" className="form-control" style={{ width: 120, fontSize: 14 }} value={b.budget} onChange={e => setBudgets(prev => prev.map((x, i) => (i === idx ? { ...x, budget: Number(e.target.value) } : x)))} /></td>
                    <td style={{ padding: 6 }}><input type="number" className="form-control" style={{ width: 80, fontSize: 14 }} value={b.leads} onChange={e => setBudgets(prev => prev.map((x, i) => (i === idx ? { ...x, leads: Number(e.target.value) } : x)))} /></td>
                    <td style={{ padding: 6, fontWeight: 700 }}>{fmtBRL(cpl)}</td>
                    <td style={{ padding: 6 }}><input type="number" className="form-control" style={{ width: 125, fontSize: 14 }} value={b.revenue} onChange={e => setBudgets(prev => prev.map((x, i) => (i === idx ? { ...x, revenue: Number(e.target.value) } : x)))} /></td>
                    <td style={{ padding: 6, fontWeight: 800, color: roi >= 0 ? '#16a34a' : '#dc2626' }}>{roi.toFixed(0)}%</td>
                    <td style={{ padding: 6 }}>
                      <button type="button" onClick={() => setBudgets(prev => prev.filter((_, i) => i !== idx))} className="btn btn-secondary" style={{ padding: '5px 8px', color: '#dc2626' }}>
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

      {/* Calendário de Eventos, Vídeos e Fotos */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarDays size={18} color="var(--accent)" /> Calendário de Eventos, Vídeos &amp; Fotos e Impulsionamento
          </h3>
          <button
            type="button"
            onClick={() => setCalendar(prev => [...prev, { id: `c_${Date.now()}`, date: new Date().toISOString().slice(0, 10), title: 'Novo Evento / Produção', format: 'Vídeos e Fotos', owner: 'Marketing', status: 'planejado' }])}
            className="btn btn-secondary"
            style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <Plus size={14} /> Adicionar Evento
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: 8 }}>Data</th>
                <th style={{ padding: 8 }}>Evento / Campanha</th>
                <th style={{ padding: 8 }}>Formato</th>
                <th style={{ padding: 8 }}>Responsável</th>
                <th style={{ padding: 8 }}>Status</th>
                <th style={{ padding: 8 }}></th>
              </tr>
            </thead>
            <tbody>
              {calendar.map((c, idx) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 6 }}><input type="date" className="form-control" style={{ width: 135, fontSize: 14 }} value={c.date} onChange={e => setCalendar(prev => prev.map((x, i) => (i === idx ? { ...x, date: e.target.value } : x)))} /></td>
                  <td style={{ padding: 6 }}><input className="form-control" style={{ width: 250, fontSize: 14, fontWeight: 700 }} value={c.title} onChange={e => setCalendar(prev => prev.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)))} /></td>
                  <td style={{ padding: 6 }}><input className="form-control" style={{ width: 150, fontSize: 14 }} value={c.format} onChange={e => setCalendar(prev => prev.map((x, i) => (i === idx ? { ...x, format: e.target.value } : x)))} /></td>
                  <td style={{ padding: 6 }}><input className="form-control" style={{ width: 150, fontSize: 14 }} value={c.owner} onChange={e => setCalendar(prev => prev.map((x, i) => (i === idx ? { ...x, owner: e.target.value } : x)))} /></td>
                  <td style={{ padding: 6 }}>
                    <select className="form-control" style={{ minWidth: 125, width: 'auto', fontSize: 14 }} value={c.status} onChange={e => setCalendar(prev => prev.map((x, i) => (i === idx ? { ...x, status: e.target.value as any } : x)))}>
                      <option value="planejado">Planejado</option>
                      <option value="producao">Em Produção</option>
                      <option value="publicado">Publicado</option>
                    </select>
                  </td>
                  <td style={{ padding: 6 }}>
                    <button type="button" onClick={() => setCalendar(prev => prev.filter((_, i) => i !== idx))} className="btn btn-secondary" style={{ padding: '5px 8px', color: '#dc2626' }}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </>
  );
}
