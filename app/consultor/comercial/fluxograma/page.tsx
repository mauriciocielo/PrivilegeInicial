'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GitBranch, Edit3, Save, Plus, Trash2 } from 'lucide-react';
import { store } from '@/lib/store';
import { toast } from 'sonner';
import ComercialExportBar from '@/components/ComercialExportBar';

interface RoadmapMilestone {
  id: string;
  phase: string;
  windowDays: string;
  title: string;
  owner: string;
  status: 'pendente' | 'em_andamento' | 'concluido';
  deliverable: string;
}

interface FunnelStep {
  step: string;
  objective: string;
  conversionTarget: string;
}

const DEFAULT_MILESTONES: RoadmapMilestone[] = [
  { id: 'f1', phase: 'Fase 1 · Diagnóstico (0-30d)', windowDays: '0 - 30 dias', title: '1º Day Training & Plano de Ação', owner: 'Consultoria + Diretoria', status: 'concluido', deliverable: 'Alinhamento inicial, metas de 180 dias e plano 5W2H.' },
  { id: 'f2', phase: 'Fase 1 · Diagnóstico (0-30d)', windowDays: '0 - 30 dias', title: 'Diagnóstico de Cliente & Cliente Oculto', owner: 'Consultoria', status: 'em_andamento', deliverable: 'Auditoria real da jornada de compra, atendimento e objeções.' },
  { id: 'f3', phase: 'Fase 1 · Diagnóstico (0-30d)', windowDays: '30 - 60 dias', title: 'Levantamento & Monitoramento de KPIs', owner: 'Gerência / Consultoria', status: 'pendente', deliverable: 'Painel de conversão, ticket médio, CAC e faturamento mensal.' },
  { id: 'f4', phase: 'Fase 2 · Estruturação (30-90d)', windowDays: '30 - 75 dias', title: 'Mapeamento do Processo Comercial (7 etapas)', owner: 'Equipe Comercial', status: 'pendente', deliverable: 'Fluxo padronizado: Mapeamento → Prospecção → Qualificação → Abordagem → Apresentação → Negociação → Fechamento.' },
  { id: 'f5', phase: 'Fase 2 · Estruturação (30-90d)', windowDays: '30 - 90 dias', title: '2º Day Training & Introdução à Gerência Comercial', owner: 'Liderança Comercial', status: 'pendente', deliverable: 'Rituais de gestão (daily, weekly), acompanhamento de metas e feedback.' },
  { id: 'f6', phase: 'Fase 2 · Estruturação (30-90d)', windowDays: '30 - 90 dias', title: 'Política Comercial', owner: 'Diretoria + Comercial', status: 'pendente', deliverable: 'Regras de desconto, alçadas, prazos, condições de pagamento e comissionamento.' },
  { id: 'f7', phase: 'Fase 3 · Políticas & Cultura (60-130d)', windowDays: '60 - 120 dias', title: 'Missão, Visão e Valores', owner: 'Diretoria + Equipe', status: 'pendente', deliverable: 'Código de cultura comercial e posicionamento da marca.' },
  { id: 'f8', phase: 'Fase 3 · Políticas & Cultura (60-130d)', windowDays: '70 - 125 dias', title: 'Política de Atendimento', owner: 'Atendimento / Comercial', status: 'pendente', deliverable: 'SLA de resposta, padrão de abordagem e scripts omnichannel.' },
  { id: 'f9', phase: 'Fase 3 · Políticas & Cultura (60-130d)', windowDays: '80 - 130 dias', title: 'Política de Prospecção', owner: 'SDR / Hunters', status: 'pendente', deliverable: 'Cadência ativa (WhatsApp, ligação, visita), ICP e metas diárias de prospecção.' },
  { id: 'f10', phase: 'Fase 3 · Políticas & Cultura (60-130d)', windowDays: '90 - 130 dias', title: 'Pós-Venda & Customer Success', owner: 'CS / Carteira', status: 'pendente', deliverable: 'Onboarding, NPS, régua de recompra e prevenção de churn.' },
  { id: 'f11', phase: 'Fase 4 · Escala Black Management (130-180d)', windowDays: '130 - 150 dias', title: 'Planejamento Estratégico & Fomento de Vendas', owner: 'Diretoria + Consultoria', status: 'pendente', deliverable: 'Campanhas de aceleração, metas trimestrais e expansão de canais.' },
  { id: 'f12', phase: 'Fase 4 · Escala Black Management (130-180d)', windowDays: '150 - 180 dias', title: 'Processo de Execução Black Management', owner: 'Toda a Empresa', status: 'pendente', deliverable: 'Operação comercial autogerenciável com auditoria contínua de KPIs.' },
];

const DEFAULT_FUNNEL: FunnelStep[] = [
  { step: '1. Mapeamento', objective: 'Definir ICP, segmentar leads e levantar decisores', conversionTarget: '100% base qualificada' },
  { step: '2. Prospecção', objective: 'Primeiro contato ativo com gancho de valor (sem spam)', conversionTarget: '35% resposta' },
  { step: '3. Qualificação', objective: 'Identificar dor, urgência, orçamento e decisor', conversionTarget: '60% qualificados' },
  { step: '4. Abordagem', objective: 'Conectar dor do cliente à solução consultiva', conversionTarget: '75% agendamento' },
  { step: '5. Apresentação', objective: 'Diagnóstico e proposta de valor personalizada', conversionTarget: '80% proposta aceita' },
  { step: '6. Negociação', objective: 'Contorno de objeções e condições comerciais', conversionTarget: '50% avanço' },
  { step: '7. Fechamento', objective: 'Assinatura, onboarding e passagem para Pós-Venda', conversionTarget: '30%+ conversão final' },
];

export default function ComercialFluxogramaPage() {
  const [empresaId, setEmpresaId] = useState('default');
  const [milestones, setMilestones] = useState<RoadmapMilestone[]>(DEFAULT_MILESTONES);
  const [funnel, setFunnel] = useState<FunnelStep[]>(DEFAULT_FUNNEL);
  const [saving, setSaving] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<RoadmapMilestone | null>(null);
  const [editingFunnelIdx, setEditingFunnelIdx] = useState<number | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    const emp = store.getSafeEmpresaId() || 'default';
    setEmpresaId(emp);
    fetch(`/api/comercial?empresaId=${encodeURIComponent(emp)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.fluxograma) {
          if (Array.isArray(d.data.fluxograma.milestones) && d.data.fluxograma.milestones.length > 0) {
            setMilestones(d.data.fluxograma.milestones);
          }
          if (Array.isArray(d.data.fluxograma.funnel) && d.data.fluxograma.funnel.length > 0) {
            setFunnel(d.data.fluxograma.funnel);
          }
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
          sectionKey: 'fluxograma',
          value: { milestones, funnel },
        }),
      }).catch(() => {});
    }, 1000);
    return () => clearTimeout(t);
  }, [milestones, funnel, empresaId]);

  const stats = useMemo(() => {
    const total = milestones.length;
    const done = milestones.filter(m => m.status === 'concluido').length;
    const doing = milestones.filter(m => m.status === 'em_andamento').length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, doing, pct };
  }, [milestones]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/comercial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId,
          sectionKey: 'fluxograma',
          value: { milestones, funnel },
        }),
      });
      const d = await res.json();
      if (d.success) toast.success('Fluxograma de Assessoria Comercial salvo!');
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
            <GitBranch size={26} color="var(--accent)" />
            Fluxograma de Assessoria Comercial (180 Dias · Black Management)
          </div>
          <div className="page-subtitle">
            Roteiro completo de implantação comercial: Plano de Ação, Cliente Oculto, Políticas, Processo de 7 Etapas e Execução.
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            onClick={() =>
              setMilestones(prev => [
                ...prev,
                {
                  id: `f_${Date.now()}`,
                  phase: 'Nova Fase',
                  windowDays: 'Personalizado',
                  title: 'Nova Entrega Comercial',
                  owner: 'Consultoria',
                  status: 'pendente',
                  deliverable: '',
                },
              ])
            }
            className="btn btn-secondary"
          >
            <Plus size={15} /> Adicionar Etapa
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
            <Save size={15} /> {saving ? 'Salvando...' : 'Salvar Fluxograma'}
          </button>
        </div>
      </div>
      <div className="page-body">

      <ComercialExportBar
        title="Fluxograma de Assessoria Comercial (180 Dias)"
        fileNameBase="comercial_fluxograma_180d"
        kpis={[
          { label: 'Progresso Geral', value: `${stats.pct}% (${stats.done}/${stats.total} concluídas)` },
          { label: 'Em Andamento', value: String(stats.doing) },
        ]}
        columns={[
          { header: 'Janela', key: 'windowDays' },
          { header: 'Etapa / Entrega', key: 'title' },
          { header: 'Responsável', key: 'owner' },
          { header: 'Status', key: 'status' },
          { header: 'Entregável / Diretriz', key: 'deliverable' },
        ]}
        rows={milestones}
      />

      {/* Progresso Geral */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 13, fontWeight: 700 }}>
          <span>Evolução da Implantação Comercial (180 dias)</span>
          <span style={{ color: 'var(--accent)' }}>
            {stats.done} concluídas · {stats.doing} em andamento · {stats.pct}%
          </span>
        </div>
        <div style={{ height: 10, borderRadius: 999, background: 'var(--bg-card2)', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{ width: `${stats.pct}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {/* Processo Comercial (7 Etapas) */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
            Processo Comercial Padronizado (7 Etapas)
          </h3>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Clique em uma etapa para editar</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 12 }}>
          {funnel.map((f, idx) => (
            <div
              key={f.step}
              onClick={() => setEditingFunnelIdx(editingFunnelIdx === idx ? null : idx)}
              style={{
                padding: 14,
                borderRadius: 12,
                background: 'var(--bg-card2)',
                border: editingFunnelIdx === idx ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 8,
                cursor: 'pointer',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>{f.step}</div>
                {editingFunnelIdx === idx ? (
                  <textarea
                    rows={3}
                    className="form-control"
                    style={{ width: '100%', fontSize: 12, resize: 'none' }}
                    value={f.objective}
                    onClick={e => e.stopPropagation()}
                    onChange={e => setFunnel(prev => prev.map((x, i) => (i === idx ? { ...x, objective: e.target.value } : x)))}
                  />
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                    {f.objective}
                  </p>
                )}
              </div>
              {editingFunnelIdx === idx ? (
                <input
                  className="form-control"
                  style={{ width: '100%', fontSize: 11.5, fontWeight: 700 }}
                  value={f.conversionTarget}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setFunnel(prev => prev.map((x, i) => (i === idx ? { ...x, conversionTarget: e.target.value } : x)))}
                />
              ) : (
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', background: 'var(--bg-card)', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', textAlign: 'center' }}>
                  🎯 {f.conversionTarget}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tabela Cronograma 180 Dias */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
            Cronograma de Entregas, Políticas &amp; Day Trainings
          </h3>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{milestones.length} etapas cadastradas</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Janela</th>
                <th>Entrega / Política</th>
                <th>Responsável</th>
                <th>Status</th>
                <th>Diretrizes / O que foi definido</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((m, idx) => (
                <tr key={m.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
                      {m.windowDays}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--text-primary)', minWidth: 210 }}>
                    {m.title}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {m.owner}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <select
                      value={m.status}
                      onChange={e => setMilestones(prev => prev.map((x, i) => (i === idx ? { ...x, status: e.target.value as any } : x)))}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: 11.5,
                        fontWeight: 700,
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        background:
                          m.status === 'concluido'
                            ? 'var(--green-bg)'
                            : m.status === 'em_andamento'
                            ? 'var(--yellow-bg)'
                            : 'var(--bg-card2)',
                        color:
                          m.status === 'concluido'
                            ? 'var(--green)'
                            : m.status === 'em_andamento'
                            ? 'var(--yellow)'
                            : 'var(--text-secondary)',
                      }}
                    >
                      <option value="pendente">⏳ Pendente</option>
                      <option value="em_andamento">🔄 Em Andamento</option>
                      <option value="concluido">✅ Concluído</option>
                    </select>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', lineHeight: 1.45, minWidth: 280 }}>
                    {m.deliverable || <span style={{ opacity: 0.5 }}>Sem diretriz definida</span>}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setEditingMilestone({ ...m })}
                        className="btn btn-secondary btn-sm"
                        title="Editar etapa"
                      >
                        <Edit3 size={13} /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setMilestones(prev => prev.filter((_, i) => i !== idx))}
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--red)' }}
                        title="Excluir"
                      >
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

      {/* Modal de Edição Limpa da Etapa */}
      {editingMilestone && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: 16,
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 540, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Editar Entrega Comercial</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label className="form-label">Janela de Prazo</label>
                <input
                  className="form-control"
                  style={{ width: '100%' }}
                  value={editingMilestone.windowDays}
                  onChange={e => setEditingMilestone(m => m ? { ...m, windowDays: e.target.value } : null)}
                />
              </div>
              <div>
                <label className="form-label">Responsável</label>
                <input
                  className="form-control"
                  style={{ width: '100%' }}
                  value={editingMilestone.owner}
                  onChange={e => setEditingMilestone(m => m ? { ...m, owner: e.target.value } : null)}
                />
              </div>
            </div>
            <div>
              <label className="form-label">Título da Entrega / Política</label>
              <input
                className="form-control"
                style={{ width: '100%' }}
                value={editingMilestone.title}
                onChange={e => setEditingMilestone(m => m ? { ...m, title: e.target.value } : null)}
              />
            </div>
            <div>
              <label className="form-label">Status</label>
              <select
                className="form-control"
                style={{ width: '100%' }}
                value={editingMilestone.status}
                onChange={e => setEditingMilestone(m => m ? { ...m, status: e.target.value as any } : null)}
              >
                <option value="pendente">⏳ Pendente</option>
                <option value="em_andamento">🔄 Em Andamento</option>
                <option value="concluido">✅ Concluído</option>
              </select>
            </div>
            <div>
              <label className="form-label">Diretrizes / O que foi definido com o cliente</label>
              <textarea
                rows={4}
                className="form-control"
                style={{ width: '100%' }}
                value={editingMilestone.deliverable}
                onChange={e => setEditingMilestone(m => m ? { ...m, deliverable: e.target.value } : null)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <button type="button" onClick={() => setEditingMilestone(null)} className="btn btn-secondary">Cancelar</button>
              <button
                type="button"
                onClick={() => {
                  setMilestones(prev => prev.map(x => (x.id === editingMilestone.id ? editingMilestone : x)));
                  setEditingMilestone(null);
                  toast.success('Etapa atualizada!');
                }}
                className="btn btn-primary"
              >
                Aplicar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
