'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Swords, Package, Save, Plus, Trash2 } from 'lucide-react';
import { store } from '@/lib/store';
import { toast } from 'sonner';
import ComercialExportBar from '@/components/ComercialExportBar';

interface CompetitorRow {
  id: string;
  name: string;
  avgPrice: string;
  strengths: string;
  weaknesses: string;
  ourEdge: string;
}

interface StockItem {
  id: string;
  category: string;
  stockValue: number;
  monthlyCmv: number;
  minDays: number;
  statusNote: string;
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
}

export default function ConcorrenciaEstoquePage() {
  const [empresaId, setEmpresaId] = useState('default');
  const [competitors, setCompetitors] = useState<CompetitorRow[]>([
    {
      id: 'c1',
      name: 'Concorrente Regional A',
      avgPrice: '10% abaixo do mercado',
      strengths: 'Preço agressivo à vista',
      weaknesses: 'Pós-venda lento e sem consultoria',
      ourEdge: 'Atendimento consultivo + entrega rápida',
    },
  ]);
  const [stockItems, setStockItems] = useState<StockItem[]>([
    { id: 'st1', category: 'Linha Curva A (Giro Rápido)', stockValue: 95000, monthlyCmv: 140000, minDays: 20, statusNote: 'Saudável' },
    { id: 'st2', category: 'Linha Curva C (Baixo Giro)', stockValue: 65000, monthlyCmv: 18000, minDays: 45, statusNote: 'Excesso — fazer queima promocional' },
  ]);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    const emp = store.getSafeEmpresaId() || 'default';
    setEmpresaId(emp);
    fetch(`/api/comercial?empresaId=${encodeURIComponent(emp)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.concorrencia_estoque) {
          if (Array.isArray(d.data.concorrencia_estoque.competitors)) setCompetitors(d.data.concorrencia_estoque.competitors);
          if (Array.isArray(d.data.concorrencia_estoque.stockItems)) setStockItems(d.data.concorrencia_estoque.stockItems);
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
          sectionKey: 'concorrencia_estoque',
          value: { competitors, stockItems },
        }),
      }).catch(() => {});
    }, 1000);
    return () => clearTimeout(t);
  }, [competitors, stockItems, empresaId]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/comercial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId,
          sectionKey: 'concorrencia_estoque',
          value: { competitors, stockItems },
        }),
      });
      const d = await res.json();
      if (d.success) toast.success('Análise de Concorrência e Estoque salva!');
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
            <Swords size={26} color="var(--accent)" />
            Concorrência &amp; Estoque Estratégico
          </div>
          <div className="page-subtitle">
            Mapeamento competitivo de mercado e análise de giro/cobertura de estoque para proteger caixa e margem.
          </div>
        </div>
        <div className="header-actions">
          <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
            <Save size={15} /> {saving ? 'Salvando...' : 'Salvar Análise'}
          </button>
        </div>
      </div>
      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      <ComercialExportBar
        title="Concorrência & Estoque Estratégico"
        fileNameBase="comercial_concorrencia_estoque"
        kpis={[
          { label: 'Concorrentes Mapeados', value: String(competitors.length) },
          {
            label: 'Capital Total em Estoque',
            value: fmtBRL(stockItems.reduce((a, s) => a + Number(s.stockValue || 0), 0)),
          },
        ]}
        columns={[
          { header: 'Grupo / Estoque', key: 'category' },
          { header: 'Valor Estoque', key: 'stockFmt' },
          { header: 'CMV Mensal', key: 'cmvFmt' },
          { header: 'Cobertura', key: 'covFmt' },
          { header: 'Giro/Mês', key: 'giroFmt' },
          { header: 'Diagnóstico', key: 'statusNote' },
        ]}
        rows={stockItems.map(s => ({
          ...s,
          stockFmt: fmtBRL(s.stockValue),
          cmvFmt: fmtBRL(s.monthlyCmv),
          covFmt: `${s.monthlyCmv > 0 ? Math.round((s.stockValue / s.monthlyCmv) * 30) : 0} dias`,
          giroFmt: `${s.stockValue > 0 ? (s.monthlyCmv / s.stockValue).toFixed(2) : '0.00'}x`,
        }))}
      />

      {/* Bloco 1: Concorrência */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Swords size={18} color="var(--accent)" /> Matriz de Concorrência
          </h3>
          <button
            type="button"
            onClick={() =>
              setCompetitors(prev => [
                ...prev,
                { id: `c_${Date.now()}`, name: 'Novo Concorrente', avgPrice: '', strengths: '', weaknesses: '', ourEdge: '' },
              ])
            }
            className="btn btn-secondary"
            style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <Plus size={14} /> Adicionar Concorrente
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: 8 }}>Concorrente</th>
                <th style={{ padding: 8 }}>Posicionamento de Preço</th>
                <th style={{ padding: 8 }}>Pontos Fortes</th>
                <th style={{ padding: 8 }}>Pontos Fracos</th>
                <th style={{ padding: 8 }}>Nosso Diferencial</th>
                <th style={{ padding: 8 }}></th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((c, idx) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 6 }}>
                    <input className="form-control" style={{ fontSize: 14 }} value={c.name} onChange={e => setCompetitors(prev => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))} />
                  </td>
                  <td style={{ padding: 6 }}>
                    <input className="form-control" style={{ fontSize: 14 }} value={c.avgPrice} onChange={e => setCompetitors(prev => prev.map((x, i) => (i === idx ? { ...x, avgPrice: e.target.value } : x)))} />
                  </td>
                  <td style={{ padding: 6 }}>
                    <input className="form-control" style={{ fontSize: 14 }} value={c.strengths} onChange={e => setCompetitors(prev => prev.map((x, i) => (i === idx ? { ...x, strengths: e.target.value } : x)))} />
                  </td>
                  <td style={{ padding: 6 }}>
                    <input className="form-control" style={{ fontSize: 14 }} value={c.weaknesses} onChange={e => setCompetitors(prev => prev.map((x, i) => (i === idx ? { ...x, weaknesses: e.target.value } : x)))} />
                  </td>
                  <td style={{ padding: 6 }}>
                    <input className="form-control" style={{ fontSize: 14 }} value={c.ourEdge} onChange={e => setCompetitors(prev => prev.map((x, i) => (i === idx ? { ...x, ourEdge: e.target.value } : x)))} />
                  </td>
                  <td style={{ padding: 6 }}>
                    <button type="button" onClick={() => setCompetitors(prev => prev.filter((_, i) => i !== idx))} className="btn btn-secondary" style={{ padding: '5px 8px', color: '#dc2626' }}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bloco 2: Estoque */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Package size={18} color="var(--accent)" /> Indicadores de Estoque &amp; Giro
          </h3>
          <button
            type="button"
            onClick={() =>
              setStockItems(prev => [
                ...prev,
                { id: `st_${Date.now()}`, category: 'Nova Categoria', stockValue: 0, monthlyCmv: 0, minDays: 30, statusNote: '' },
              ])
            }
            className="btn btn-secondary"
            style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <Plus size={14} /> Adicionar Grupo
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: 8 }}>Grupo / Linha de Produto</th>
                <th style={{ padding: 8 }}>Valor em Estoque (R$)</th>
                <th style={{ padding: 8 }}>CMV Mensal (R$)</th>
                <th style={{ padding: 8 }}>Cobertura (Dias)</th>
                <th style={{ padding: 8 }}>Giro/Mês</th>
                <th style={{ padding: 8 }}>Diagnóstico / Ação</th>
                <th style={{ padding: 8 }}></th>
              </tr>
            </thead>
            <tbody>
              {stockItems.map((s, idx) => {
                const coverageDays = s.monthlyCmv > 0 ? Math.round((s.stockValue / s.monthlyCmv) * 30) : 0;
                const giro = s.stockValue > 0 ? (s.monthlyCmv / s.stockValue).toFixed(2) : '0.00';
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: 6 }}>
                      <input className="form-control" style={{ fontSize: 14 }} value={s.category} onChange={e => setStockItems(prev => prev.map((x, i) => (i === idx ? { ...x, category: e.target.value } : x)))} />
                    </td>
                    <td style={{ padding: 6 }}>
                      <input type="number" className="form-control" style={{ width: 120, fontSize: 14 }} value={s.stockValue} onChange={e => setStockItems(prev => prev.map((x, i) => (i === idx ? { ...x, stockValue: Number(e.target.value) } : x)))} />
                    </td>
                    <td style={{ padding: 6 }}>
                      <input type="number" className="form-control" style={{ width: 120, fontSize: 14 }} value={s.monthlyCmv} onChange={e => setStockItems(prev => prev.map((x, i) => (i === idx ? { ...x, monthlyCmv: Number(e.target.value) } : x)))} />
                    </td>
                    <td style={{ padding: 6, fontWeight: 800, color: coverageDays > 60 ? '#dc2626' : '#16a34a' }}>{coverageDays} dias</td>
                    <td style={{ padding: 6, fontWeight: 700 }}>{giro}x</td>
                    <td style={{ padding: 6 }}>
                      <input className="form-control" style={{ fontSize: 14 }} value={s.statusNote} onChange={e => setStockItems(prev => prev.map((x, i) => (i === idx ? { ...x, statusNote: e.target.value } : x)))} />
                    </td>
                    <td style={{ padding: 6 }}>
                      <button type="button" onClick={() => setStockItems(prev => prev.filter((_, i) => i !== idx))} className="btn btn-secondary" style={{ padding: '5px 8px', color: '#dc2626' }}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 10, fontSize: 14, color: 'var(--text-muted)' }}>
          Capital total imobilizado em estoque:{' '}
          <strong style={{ color: 'var(--accent)' }}>
            {fmtBRL(stockItems.reduce((a, s) => a + Number(s.stockValue || 0), 0))}
          </strong>
        </div>
      </div>
      </div>
    </>
  );
}
