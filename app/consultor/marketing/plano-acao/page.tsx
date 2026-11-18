'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, Save, Plus, Trash2, Edit3 } from 'lucide-react';
import { store } from '@/lib/store';
import { toast } from 'sonner';
import ComercialExportBar from '@/components/ComercialExportBar';

interface Action5W2H {
  id: string;
  acao: string;
  porque: string;
  onde: string;
  quem: string;
  quando: string;
  como: string;
  custo: string;
  status: 'pendente' | 'em_execucao' | 'concluida';
}

const DEFAULT_5W2H: Action5W2H[] = [
  {
    id: 'a1',
    acao: 'Campanha de Ativação de Base',
    porque: 'Recuperar clientes que não compram há 60 dias para gerar caixa rápido.',
    onde: 'WhatsApp e E-mail',
    quem: 'Equipe de Vendas (Suporte Mkt)',
    quando: 'Imediato (Mês 1)',
    como: 'Extrair lista de inativos > Criar oferta exclusiva "Volta Cliente" > Disparar script 1 > Ligar para quem visualizou.',
    custo: 'R$ 0,00 (Orgânico)',
    status: 'em_execucao',
  },
  {
    id: 'a2',
    acao: 'Tráfego Pago (Google Ads & Meta)',
    porque: 'Captar leads com intenção de compra (fundo de funil).',
    onde: 'Google Search & Instagram',
    quem: 'Gestor de Tráfego',
    quando: 'Recorrente (Diário)',
    como: 'Configurar campanha para palavras-chave de alta intenção e otimizar a cada 3 dias.',
    custo: 'R$ 1.000/mês',
    status: 'pendente',
  },
  {
    id: 'a3',
    acao: 'Reestruturação do Script Comercial',
    porque: 'Aumentar a taxa de conversão de 10% para 20%.',
    onde: 'Atendimento / WhatsApp',
    quem: 'Consultor + Líder de Vendas',
    quando: 'Mês 1',
    como: 'Analisar as 10 últimas conversas perdidas > Mapear objeções > Reescrever quebras de objeção > Treinar equipe.',
    custo: 'Incluso na Consultoria',
    status: 'pendente',
  },
];

export default function MarketingPlanoAcaoPage() {
  const [empresaId, setEmpresaId] = useState('default');
  const [actions, setActions] = useState<Action5W2H[]>(DEFAULT_5W2H);
  const [saving, setSaving] = useState(false);
  const [editingAction, setEditingAction] = useState<Action5W2H | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    const emp = store.getSafeEmpresaId() || 'default';
    setEmpresaId(emp);
    fetch(`/api/comercial?empresaId=${encodeURIComponent(emp)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data?.mkt_plano_5w2h) && d.data.mkt_plano_5w2h.length > 0) {
          setActions(d.data.mkt_plano_5w2h);
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
        body: JSON.stringify({ empresaId, sectionKey: 'mkt_plano_5w2h', value: actions }),
      }).catch(() => {});
    }, 1000);
    return () => clearTimeout(t);
  }, [actions, empresaId]);

  const stats = useMemo(() => {
    const total = actions.length;
    const done = actions.filter(a => a.status === 'concluida').length;
    const running = actions.filter(a => a.status === 'em_execucao').length;
    return { total, done, running };
  }, [actions]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/comercial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, sectionKey: 'mkt_plano_5w2h', value: actions }),
      });
      const d = await res.json();
      if (d.success) toast.success('Plano de Ação MKT (5W2H) salvo!');
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
            <ClipboardList size={26} color="var(--accent)" />
            Plano de Ação Tático de Marketing (5W2H)
          </div>
          <div className="page-subtitle">
            Plano prático com foco em ROI, ativação de base, tráfego pago e rotina de 90 dias.
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            onClick={() =>
              setActions(prev => [
                ...prev,
                { id: `a_${Date.now()}`, acao: 'Nova Ação MKT', porque: '', onde: '', quem: '', quando: '', como: '', custo: 'R$ 0,00', status: 'pendente' },
              ])
            }
            className="btn btn-secondary"
          >
            <Plus size={15} /> Nova Ação 5W2H
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
            <Save size={15} /> {saving ? 'Salvando...' : 'Salvar Plano'}
          </button>
        </div>
      </div>
      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <ComercialExportBar
        title="Plano de Ação Tático de Marketing (5W2H)"
        fileNameBase="marketing_plano_5w2h"
        kpis={[
          { label: 'Total de Ações', value: String(stats.total) },
          { label: 'Em Execução', value: String(stats.running) },
          { label: 'Concluídas', value: String(stats.done) },
        ]}
        columns={[
          { header: 'Ação', key: 'acao' },
          { header: 'Por que fazer?', key: 'porque' },
          { header: 'Onde?', key: 'onde' },
          { header: 'Quem faz?', key: 'quem' },
          { header: 'Quando?', key: 'quando' },
          { header: 'Como fazer?', key: 'como' },
          { header: 'Custo', key: 'custo' },
          { header: 'Status', key: 'status' },
        ]}
        rows={actions}
      />

      {/* Cronograma 90 dias + Rotina */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)' }}>MÊS 1 · ESTRUTURAÇÃO (&ldquo;ARRUMAR A CASA&rdquo;)</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>Configuração de ferramentas, ICP, scripts e definição de metas.</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)' }}>MÊS 2 · GO-TO-MARKET (TRAÇÃO)</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>Início das campanhas pagas, prospecção ativa e leitura inicial de dados.</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)' }}>MÊS 3 · OTIMIZAÇÃO &amp; ESCALA</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>Refinamento de público/criativos e aumento de verba no que traz ROI.</div>
        </div>
      </div>

      {/* Tabela 5W2H */}
      <div className="card" style={{ padding: 20 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ação &amp; Objetivo</th>
                <th>Onde / Quem / Quando</th>
                <th>Como fazer?</th>
                <th>Custo</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a, idx) => (
                <tr key={a.id}>
                  <td style={{ minWidth: 200 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{a.acao}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{a.porque}</div>
                  </td>
                  <td style={{ minWidth: 170, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <div><strong>Onde:</strong> {a.onde}</div>
                    <div><strong>Quem:</strong> {a.quem}</div>
                    <div><strong>Quando:</strong> {a.quando}</div>
                  </td>
                  <td style={{ minWidth: 240, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    {a.como}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{a.custo}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <select
                      value={a.status}
                      onChange={e => setActions(prev => prev.map((x, i) => (i === idx ? { ...x, status: e.target.value as any } : x)))}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: 11.5,
                        fontWeight: 700,
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        background: a.status === 'concluida' ? 'var(--green-bg)' : a.status === 'em_execucao' ? 'var(--yellow-bg)' : 'var(--bg-card2)',
                        color: a.status === 'concluida' ? 'var(--green)' : a.status === 'em_execucao' ? 'var(--yellow)' : 'var(--text-secondary)',
                      }}
                    >
                      <option value="pendente">⏳ Pendente</option>
                      <option value="em_execucao">🚀 Em Execução</option>
                      <option value="concluida">✅ Concluída</option>
                    </select>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button type="button" onClick={() => setEditingAction({ ...a })} className="btn btn-secondary btn-sm">
                        <Edit3 size={13} /> Editar
                      </button>
                      <button type="button" onClick={() => setActions(prev => prev.filter((_, i) => i !== idx))} className="btn btn-secondary btn-sm" style={{ color: 'var(--red)' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingAction && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 580, padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Editar Ação 5W2H</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label className="form-label">Ação</label><input className="form-control" style={{ width: '100%' }} value={editingAction.acao} onChange={e => setEditingAction(a => a ? { ...a, acao: e.target.value } : null)} /></div>
              <div><label className="form-label">Custo</label><input className="form-control" style={{ width: '100%' }} value={editingAction.custo} onChange={e => setEditingAction(a => a ? { ...a, custo: e.target.value } : null)} /></div>
              <div><label className="form-label">Onde?</label><input className="form-control" style={{ width: '100%' }} value={editingAction.onde} onChange={e => setEditingAction(a => a ? { ...a, onde: e.target.value } : null)} /></div>
              <div><label className="form-label">Quem faz?</label><input className="form-control" style={{ width: '100%' }} value={editingAction.quem} onChange={e => setEditingAction(a => a ? { ...a, quem: e.target.value } : null)} /></div>
              <div><label className="form-label">Quando?</label><input className="form-control" style={{ width: '100%' }} value={editingAction.quando} onChange={e => setEditingAction(a => a ? { ...a, quando: e.target.value } : null)} /></div>
              <div>
                <label className="form-label">Status</label>
                <select className="form-control" style={{ width: '100%' }} value={editingAction.status} onChange={e => setEditingAction(a => a ? { ...a, status: e.target.value as any } : null)}>
                  <option value="pendente">⏳ Pendente</option>
                  <option value="em_execucao">🚀 Em Execução</option>
                  <option value="concluida">✅ Concluída</option>
                </select>
              </div>
            </div>
            <div><label className="form-label">Por que fazer?</label><input className="form-control" style={{ width: '100%' }} value={editingAction.porque} onChange={e => setEditingAction(a => a ? { ...a, porque: e.target.value } : null)} /></div>
            <div><label className="form-label">Como fazer?</label><textarea rows={3} className="form-control" style={{ width: '100%' }} value={editingAction.como} onChange={e => setEditingAction(a => a ? { ...a, como: e.target.value } : null)} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <button type="button" onClick={() => setEditingAction(null)} className="btn btn-secondary">Cancelar</button>
              <button
                type="button"
                onClick={() => {
                  setActions(prev => prev.map(x => (x.id === editingAction.id ? editingAction : x)));
                  setEditingAction(null);
                  toast.success('Ação 5W2H atualizada!');
                }}
                className="btn btn-primary"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
