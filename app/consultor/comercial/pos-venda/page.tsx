'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HeartHandshake, Smile, RefreshCw, Save, Plus, Trash2 } from 'lucide-react';
import { store } from '@/lib/store';
import { toast } from 'sonner';
import ComercialExportBar from '@/components/ComercialExportBar';

interface CsClientRow {
  id: string;
  clientName: string;
  lastPurchase: string;
  nps: number;
  healthScore: 'verde' | 'amarelo' | 'vermelho';
  repurchaseCount: number;
  upsellOpportunity: string;
  nextAction: string;
}

export default function PosVendaCsPage() {
  const [empresaId, setEmpresaId] = useState('default');
  const [rows, setRows] = useState<CsClientRow[]>([
    {
      id: 'cs1',
      clientName: 'Cliente Exemplo Alpha',
      lastPurchase: '2026-10-25',
      nps: 9,
      healthScore: 'verde',
      repurchaseCount: 4,
      upsellOpportunity: 'Upgrade para contrato anual',
      nextAction: 'Ligar para check-in de satisfação e pedir indicação',
    },
  ]);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    const emp = store.getSafeEmpresaId() || 'default';
    setEmpresaId(emp);
    fetch(`/api/comercial?empresaId=${encodeURIComponent(emp)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data?.pos_venda) && d.data.pos_venda.length > 0) {
          setRows(d.data.pos_venda);
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
        body: JSON.stringify({ empresaId, sectionKey: 'pos_venda', value: rows }),
      }).catch(() => {});
    }, 1000);
    return () => clearTimeout(t);
  }, [rows, empresaId]);

  const stats = useMemo(() => {
    const avgNps = rows.length > 0 ? rows.reduce((a, r) => a + Number(r.nps || 0), 0) / rows.length : 0;
    const promoters = rows.filter(r => r.nps >= 9).length;
    const atRisk = rows.filter(r => r.healthScore === 'vermelho').length;
    return { avgNps, promoters, atRisk };
  }, [rows]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/comercial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, sectionKey: 'pos_venda', value: rows }),
      });
      const d = await res.json();
      if (d.success) toast.success('Pós-Venda e Customer Success salvos!');
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
            <HeartHandshake size={26} color="var(--accent)" />
            Pós-Venda &amp; Customer Success (CS)
          </div>
          <div className="page-subtitle">
            Controle de retenção, NPS, Health Score, recompra e oportunidades de expansão na carteira.
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            onClick={() =>
              setRows(prev => [
                ...prev,
                {
                  id: `cs_${Date.now()}`,
                  clientName: 'Novo Cliente',
                  lastPurchase: new Date().toISOString().slice(0, 10),
                  nps: 9,
                  healthScore: 'verde',
                  repurchaseCount: 1,
                  upsellOpportunity: '',
                  nextAction: '',
                },
              ])
            }
            className="btn btn-secondary"
          >
            <Plus size={15} /> Adicionar Cliente
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
            <Save size={15} /> {saving ? 'Salvando...' : 'Salvar CS'}
          </button>
        </div>
      </div>
      <div className="page-body">

      <ComercialExportBar
        title="Pós-Venda & Customer Success (CS)"
        fileNameBase="comercial_pos_venda_cs"
        kpis={[
          { label: 'Nota Média NPS', value: `${stats.avgNps.toFixed(1)} / 10` },
          { label: 'Clientes Promotores', value: String(stats.promoters) },
          { label: 'Contas em Risco (Churn)', value: String(stats.atRisk) },
        ]}
        columns={[
          { header: 'Cliente', key: 'clientName' },
          { header: 'Última Compra', key: 'lastPurchase' },
          { header: 'Recompras', key: 'repurchaseCount' },
          { header: 'NPS', key: 'nps' },
          { header: 'Health Score', key: 'healthScore' },
          { header: 'Upsell', key: 'upsellOpportunity' },
          { header: 'Próxima Ação', key: 'nextAction' },
        ]}
        rows={rows}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>Nota Média NPS</span>
            <Smile size={15} color="#16a34a" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6, color: '#16a34a' }}>{stats.avgNps.toFixed(1)} / 10</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>Clientes Promotores (NPS 9–10)</span>
            <RefreshCw size={15} color="var(--accent)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>{stats.promoters}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>Contas em Risco (Churn)</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6, color: stats.atRisk > 0 ? '#dc2626' : '#16a34a' }}>{stats.atRisk}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: 8 }}>Cliente</th>
                <th style={{ padding: 8 }}>Última Compra</th>
                <th style={{ padding: 8 }}>Recompras</th>
                <th style={{ padding: 8 }}>NPS (0-10)</th>
                <th style={{ padding: 8 }}>Health Score</th>
                <th style={{ padding: 8 }}>Oportunidade Upsell</th>
                <th style={{ padding: 8 }}>Próxima Ação Pós-Venda</th>
                <th style={{ padding: 8 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 6 }}>
                    <input className="form-control" style={{ width: 155, fontSize: 14 }} value={r.clientName} onChange={e => setRows(prev => prev.map((x, i) => (i === idx ? { ...x, clientName: e.target.value } : x)))} />
                  </td>
                  <td style={{ padding: 6 }}>
                    <input type="date" className="form-control" style={{ width: 130, fontSize: 14 }} value={r.lastPurchase} onChange={e => setRows(prev => prev.map((x, i) => (i === idx ? { ...x, lastPurchase: e.target.value } : x)))} />
                  </td>
                  <td style={{ padding: 6 }}>
                    <input type="number" className="form-control" style={{ width: 70, fontSize: 14 }} value={r.repurchaseCount} onChange={e => setRows(prev => prev.map((x, i) => (i === idx ? { ...x, repurchaseCount: Number(e.target.value) } : x)))} />
                  </td>
                  <td style={{ padding: 6 }}>
                    <input type="number" min={0} max={10} className="form-control" style={{ width: 65, fontSize: 14 }} value={r.nps} onChange={e => setRows(prev => prev.map((x, i) => (i === idx ? { ...x, nps: Number(e.target.value) } : x)))} />
                  </td>
                  <td style={{ padding: 6 }}>
                    <select className="form-control" style={{ minWidth: 110, width: 'auto', fontSize: 14 }} value={r.healthScore} onChange={e => setRows(prev => prev.map((x, i) => (i === idx ? { ...x, healthScore: e.target.value as any } : x)))}>
                      <option value="verde">Saudável</option>
                      <option value="amarelo">Atenção</option>
                      <option value="vermelho">Risco</option>
                    </select>
                  </td>
                  <td style={{ padding: 6 }}>
                    <input className="form-control" style={{ width: 180, fontSize: 14 }} value={r.upsellOpportunity} onChange={e => setRows(prev => prev.map((x, i) => (i === idx ? { ...x, upsellOpportunity: e.target.value } : x)))} />
                  </td>
                  <td style={{ padding: 6 }}>
                    <input className="form-control" style={{ width: 210, fontSize: 14 }} value={r.nextAction} onChange={e => setRows(prev => prev.map((x, i) => (i === idx ? { ...x, nextAction: e.target.value } : x)))} />
                  </td>
                  <td style={{ padding: 6 }}>
                    <button type="button" onClick={() => setRows(prev => prev.filter((_, i) => i !== idx))} className="btn btn-secondary" style={{ padding: '5px 8px', color: '#dc2626' }}>
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
