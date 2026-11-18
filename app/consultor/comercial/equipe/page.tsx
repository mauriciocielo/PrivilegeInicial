'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Users, Award, DollarSign, Save, Plus, Trash2 } from 'lucide-react';
import { store } from '@/lib/store';
import { toast } from 'sonner';
import ComercialExportBar from '@/components/ComercialExportBar';

interface SellerRow {
  id: string;
  name: string;
  profile: string;
  metaMensal: number;
  vendidoMes: number;
  atendimentos: number;
  fechamentos: number;
  salarioFixo: number;
  comissaoPct: number;
  bonusMeta: number;
}

const DEFAULT_SELLERS: SellerRow[] = [
  {
    id: 's1',
    name: 'Consultor / Vendedor 1',
    profile: 'Hunter (Prospecção Ativa)',
    metaMensal: 80000,
    vendidoMes: 84500,
    atendimentos: 65,
    fechamentos: 18,
    salarioFixo: 2500,
    comissaoPct: 3.0,
    bonusMeta: 800,
  },
  {
    id: 's2',
    name: 'Consultor / Vendedor 2',
    profile: 'Farmer (Carteira & Pós-Venda)',
    metaMensal: 60000,
    vendidoMes: 52000,
    atendimentos: 48,
    fechamentos: 14,
    salarioFixo: 2200,
    comissaoPct: 2.5,
    bonusMeta: 600,
  },
];

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
}

export default function ComercialEquipePage() {
  const [empresaId, setEmpresaId] = useState('default');
  const [sellers, setSellers] = useState<SellerRow[]>(DEFAULT_SELLERS);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    const emp = store.getSafeEmpresaId() || 'default';
    setEmpresaId(emp);
    fetch(`/api/comercial?empresaId=${encodeURIComponent(emp)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data?.equipe) && d.data.equipe.length > 0) {
          setSellers(d.data.equipe);
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
        body: JSON.stringify({ empresaId, sectionKey: 'equipe', value: sellers }),
      }).catch(() => {});
    }, 1000);
    return () => clearTimeout(t);
  }, [sellers, empresaId]);

  const summary = useMemo(() => {
    const totalMeta = sellers.reduce((a, s) => a + Number(s.metaMensal || 0), 0);
    const totalVendido = sellers.reduce((a, s) => a + Number(s.vendidoMes || 0), 0);
    const totalAtend = sellers.reduce((a, s) => a + Number(s.atendimentos || 0), 0);
    const totalFech = sellers.reduce((a, s) => a + Number(s.fechamentos || 0), 0);
    const totalRemun = sellers.reduce((a, s) => {
      const bateu = s.vendidoMes >= s.metaMensal && s.metaMensal > 0;
      const comissao = (s.vendidoMes * s.comissaoPct) / 100;
      return a + s.salarioFixo + comissao + (bateu ? s.bonusMeta : 0);
    }, 0);

    return {
      totalMeta,
      totalVendido,
      convMedia: totalAtend > 0 ? (totalFech / totalAtend) * 100 : 0,
      totalRemun,
      custoSobreVenda: totalVendido > 0 ? (totalRemun / totalVendido) * 100 : 0,
    };
  }, [sellers]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/comercial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, sectionKey: 'equipe', value: sellers }),
      });
      const d = await res.json();
      if (d.success) toast.success('Equipe Comercial salva!');
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
            <Users size={26} color="var(--accent)" />
            Equipe Comercial — Perfil, Metas, Conversão &amp; Remuneração
          </div>
          <div className="page-subtitle">
            Estruture o perfil de cada vendedor, metas individuais, taxa de conversão e modelo de comissionamento.
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            onClick={() =>
              setSellers(prev => [
                ...prev,
                {
                  id: `s_${Date.now()}`,
                  name: 'Novo Vendedor',
                  profile: 'Hunter / Closer',
                  metaMensal: 50000,
                  vendidoMes: 0,
                  atendimentos: 0,
                  fechamentos: 0,
                  salarioFixo: 2000,
                  comissaoPct: 3,
                  bonusMeta: 500,
                },
              ])
            }
            className="btn btn-secondary"
          >
            <Plus size={15} /> Adicionar Vendedor
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
            <Save size={15} /> {saving ? 'Salvando...' : 'Salvar Equipe'}
          </button>
        </div>
      </div>
      <div className="page-body">

      <ComercialExportBar
        title="Equipe Comercial — Metas, Conversão & Remuneração"
        fileNameBase="comercial_equipe"
        kpis={[
          { label: 'Meta Global da Equipe', value: fmtBRL(summary.totalMeta) },
          { label: 'Total Vendido', value: fmtBRL(summary.totalVendido) },
          { label: 'Taxa de Conversão Média', value: `${summary.convMedia.toFixed(1)}%` },
          { label: 'Custo Total Remuneração', value: fmtBRL(summary.totalRemun) },
        ]}
        columns={[
          { header: 'Vendedor', key: 'name' },
          { header: 'Perfil', key: 'profile' },
          { header: 'Meta', key: 'metaFmt' },
          { header: 'Vendido', key: 'vendidoFmt' },
          { header: 'Conversão', key: 'convFmt' },
          { header: 'Comissão %', key: 'comissaoPct' },
          { header: 'Total Remuneração', key: 'remunFmt' },
        ]}
        rows={sellers.map(s => {
          const conv = s.atendimentos > 0 ? (s.fechamentos / s.atendimentos) * 100 : 0;
          const bateu = s.vendidoMes >= s.metaMensal && s.metaMensal > 0;
          const remun = s.salarioFixo + (s.vendidoMes * s.comissaoPct) / 100 + (bateu ? s.bonusMeta : 0);
          return {
            ...s,
            metaFmt: fmtBRL(s.metaMensal),
            vendidoFmt: fmtBRL(s.vendidoMes),
            convFmt: `${conv.toFixed(1)}%`,
            remunFmt: fmtBRL(remun),
          };
        })}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Meta Global da Equipe</div>
          <div style={{ fontSize: 23, fontWeight: 900, marginTop: 6 }}>{fmtBRL(summary.totalMeta)}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Realizado: {fmtBRL(summary.totalVendido)}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Taxa de Conversão Média</div>
          <div style={{ fontSize: 23, fontWeight: 900, marginTop: 6, color: 'var(--accent)' }}>{summary.convMedia.toFixed(1)}%</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Custo Total Remuneração</div>
          <div style={{ fontSize: 23, fontWeight: 900, marginTop: 6 }}>{fmtBRL(summary.totalRemun)}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Representa {summary.custoSobreVenda.toFixed(1)}% das vendas</div>
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: 8 }}>Vendedor</th>
                <th style={{ padding: 8 }}>Perfil</th>
                <th style={{ padding: 8 }}>Meta (R$)</th>
                <th style={{ padding: 8 }}>Vendido (R$)</th>
                <th style={{ padding: 8 }}>Atend.</th>
                <th style={{ padding: 8 }}>Fech.</th>
                <th style={{ padding: 8 }}>Conv. %</th>
                <th style={{ padding: 8 }}>Fixo (R$)</th>
                <th style={{ padding: 8 }}>Comissão %</th>
                <th style={{ padding: 8 }}>Bônus Meta</th>
                <th style={{ padding: 8 }}>Total Remun.</th>
                <th style={{ padding: 8 }}></th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((s, idx) => {
                const conv = s.atendimentos > 0 ? (s.fechamentos / s.atendimentos) * 100 : 0;
                const bateu = s.vendidoMes >= s.metaMensal && s.metaMensal > 0;
                const remun = s.salarioFixo + (s.vendidoMes * s.comissaoPct) / 100 + (bateu ? s.bonusMeta : 0);
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: 6 }}>
                      <input
                        className="form-control"
                        style={{ width: 145, padding: '5px 7px', fontSize: 12 }}
                        value={s.name}
                        onChange={e => setSellers(prev => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))}
                      />
                    </td>
                    <td style={{ padding: 6 }}>
                      <input
                        className="form-control"
                        style={{ width: 155, padding: '5px 7px', fontSize: 12 }}
                        value={s.profile}
                        onChange={e => setSellers(prev => prev.map((x, i) => (i === idx ? { ...x, profile: e.target.value } : x)))}
                      />
                    </td>
                    <td style={{ padding: 6 }}>
                      <input
                        type="number"
                        className="form-control"
                        style={{ width: 95, padding: '5px 7px', fontSize: 12 }}
                        value={s.metaMensal}
                        onChange={e => setSellers(prev => prev.map((x, i) => (i === idx ? { ...x, metaMensal: Number(e.target.value) } : x)))}
                      />
                    </td>
                    <td style={{ padding: 6 }}>
                      <input
                        type="number"
                        className="form-control"
                        style={{ width: 95, padding: '5px 7px', fontSize: 12 }}
                        value={s.vendidoMes}
                        onChange={e => setSellers(prev => prev.map((x, i) => (i === idx ? { ...x, vendidoMes: Number(e.target.value) } : x)))}
                      />
                    </td>
                    <td style={{ padding: 6 }}>
                      <input
                        type="number"
                        className="form-control"
                        style={{ width: 60, padding: '5px 7px', fontSize: 12 }}
                        value={s.atendimentos}
                        onChange={e => setSellers(prev => prev.map((x, i) => (i === idx ? { ...x, atendimentos: Number(e.target.value) } : x)))}
                      />
                    </td>
                    <td style={{ padding: 6 }}>
                      <input
                        type="number"
                        className="form-control"
                        style={{ width: 60, padding: '5px 7px', fontSize: 12 }}
                        value={s.fechamentos}
                        onChange={e => setSellers(prev => prev.map((x, i) => (i === idx ? { ...x, fechamentos: Number(e.target.value) } : x)))}
                      />
                    </td>
                    <td style={{ padding: 6, fontWeight: 800, color: 'var(--accent)' }}>{conv.toFixed(1)}%</td>
                    <td style={{ padding: 6 }}>
                      <input
                        type="number"
                        className="form-control"
                        style={{ width: 80, padding: '5px 7px', fontSize: 12 }}
                        value={s.salarioFixo}
                        onChange={e => setSellers(prev => prev.map((x, i) => (i === idx ? { ...x, salarioFixo: Number(e.target.value) } : x)))}
                      />
                    </td>
                    <td style={{ padding: 6 }}>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control"
                        style={{ width: 65, padding: '5px 7px', fontSize: 12 }}
                        value={s.comissaoPct}
                        onChange={e => setSellers(prev => prev.map((x, i) => (i === idx ? { ...x, comissaoPct: Number(e.target.value) } : x)))}
                      />
                    </td>
                    <td style={{ padding: 6 }}>
                      <input
                        type="number"
                        className="form-control"
                        style={{ width: 75, padding: '5px 7px', fontSize: 12 }}
                        value={s.bonusMeta}
                        onChange={e => setSellers(prev => prev.map((x, i) => (i === idx ? { ...x, bonusMeta: Number(e.target.value) } : x)))}
                      />
                    </td>
                    <td style={{ padding: 6, fontWeight: 900, color: bateu ? '#16a34a' : 'var(--text-primary)' }}>
                      {fmtBRL(remun)} {bateu ? '🏆' : ''}
                    </td>
                    <td style={{ padding: 6 }}>
                      <button
                        type="button"
                        onClick={() => setSellers(prev => prev.filter((_, i) => i !== idx))}
                        className="btn btn-secondary"
                        style={{ padding: '5px 7px', color: '#dc2626' }}
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
