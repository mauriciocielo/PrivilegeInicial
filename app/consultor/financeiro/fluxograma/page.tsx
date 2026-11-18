'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GitBranch, Plus, Save, Edit3, Trash2, Copy, MessageSquare, CalendarCheck2 } from 'lucide-react';
import { store } from '@/lib/store';
import { toast } from 'sonner';
import { redirectToWhatsAppShare } from '@/lib/whatsapp-share';
import ComercialExportBar from '@/components/ComercialExportBar';

interface FinMilestone {
  id: string;
  modelType: 'presencial' | 'conectado';
  periodo: string;
  reuniao: string;
  title: string;
  entregaveis: string;
  status: 'pendente' | 'em_andamento' | 'concluido';
  agendaMessage: string;
}

interface WeeklyRoutine {
  id: string;
  semana: string;
  atividade: string;
  concluido: boolean;
}

const DEFAULT_FIN_MILESTONES: FinMilestone[] = [
  // Assessoria Presencial (6 Meses)
  {
    id: 'fin_p1',
    modelType: 'presencial',
    periodo: 'Mês 1',
    reuniao: 'Reunião 1',
    title: 'Fluxo de Caixa, Orçamento, Ponto de Equilíbrio & CMV',
    entregaveis: 'Alinhamento do plano de trabalho, preenchimento do fluxo de caixa, tabulação de dados para orçamento, ponto de equilíbrio e CMV, documento final e inclusão na plataforma.',
    status: 'concluido',
    agendaMessage: 'Olá! Vamos iniciar o Mês 1 da Assessoria Financeira: alinhamento do plano de trabalho, organização das informações para o Fluxo de Caixa, Orçamento, Ponto de Equilíbrio e CMV.',
  },
  {
    id: 'fin_p2',
    modelType: 'presencial',
    periodo: 'Mês 2',
    reuniao: 'Reunião 2',
    title: 'Precificação, Contas a Receber & Compras / Estoque',
    entregaveis: 'Estruturação da ferramenta de precificação, política de contas a receber, Curva ABC de produtos, análise de custos, levantamento de estoque e política/ferramenta de compras.',
    status: 'em_andamento',
    agendaMessage: 'Nesta agenda do Mês 2, iremos estruturar a ferramenta de precificação, política de contas a receber, Curva ABC de produtos, estoque e política de compras.',
  },
  {
    id: 'fin_p3',
    modelType: 'presencial',
    periodo: 'Mês 3',
    reuniao: 'Reunião 3',
    title: 'Endividamento, Contas a Pagar & Curva ABC Fornecedores',
    entregaveis: 'Alinhamento do endividamento anexo ao fluxo de caixa, estruturação da política de contas a pagar, Curva ABC de fornecedores e processo de pagamentos.',
    status: 'pendente',
    agendaMessage: 'Agenda do Mês 3: levantamento do endividamento, estruturação da política de contas a pagar, Curva ABC de fornecedores e fluxo de pagamentos.',
  },
  {
    id: 'fin_p4',
    modelType: 'presencial',
    periodo: 'Mês 4',
    reuniao: 'Reunião 4',
    title: 'Política de Cobrança, Inadimplência & Crédito',
    entregaveis: 'Política e ferramenta de cobrança, levantamento de inadimplência vs recebimento, política e ferramenta de crédito e inclusão na plataforma.',
    status: 'pendente',
    agendaMessage: 'Agenda do Mês 4: análise de inadimplência vs recebimento, estruturação da política de cobrança e definição da política de crédito.',
  },
  {
    id: 'fin_p5',
    modelType: 'presencial',
    periodo: 'Mês 5',
    reuniao: 'Reunião 5',
    title: 'Balancete, Bens/Direitos & Obrigações',
    entregaveis: 'Levantamento do balancete, bens e direitos (disponibilidades, contas a receber, estoque, investimentos, imobilizado) e obrigações (fornecedores, endividamento, impostos, trabalhistas).',
    status: 'pendente',
    agendaMessage: 'Agenda do Mês 5: fechamento do balancete gerencial com levantamento completo de bens, direitos e obrigações da empresa.',
  },
  {
    id: 'fin_p6',
    modelType: 'presencial',
    periodo: 'Mês 6',
    reuniao: 'Reunião 6',
    title: 'Revisão Geral de KPIs & Encerramento',
    entregaveis: 'Discussão dos KPIs, endividamento, fluxo de caixa, políticas, orçamento, precificação, processos e reunião de encerramento.',
    status: 'pendente',
    agendaMessage: 'Agenda do Mês 6 (Encerramento): apresentação consolidada dos resultados (KPIs), fluxo de caixa, orçamento, precificação e próximos passos.',
  },

  // Assessoria Conectado / Online (3 Meses)
  {
    id: 'fin_c1',
    modelType: 'conectado',
    periodo: '1º Mês',
    reuniao: 'Reunião 1 e 2',
    title: 'Fluxo de Caixa, Orçamento, CMV, Precificação & Compras',
    entregaveis: 'Plano de trabalho, fluxo de caixa, orçamento, ponto de equilíbrio e CMV, política de contas a receber, Curva ABC de produtos/estoque e política de compras.',
    status: 'concluido',
    agendaMessage: '1º Mês (Conectado): implantação do fluxo de caixa, orçamento, ponto de equilíbrio, CMV, contas a receber e política de compras.',
  },
  {
    id: 'fin_c2',
    modelType: 'conectado',
    periodo: '2º Mês',
    reuniao: 'Reunião 3 e 4',
    title: 'Endividamento, Contas a Pagar & Cobrança',
    entregaveis: 'Ferramenta de endividamento anexa ao fluxo de caixa, política de contas a pagar, Curva ABC de fornecedores, inadimplência vs recebimento e ferramenta de cobrança.',
    status: 'em_andamento',
    agendaMessage: '2º Mês (Conectado): controle de endividamento, política de contas a pagar, Curva ABC de fornecedores e régua de cobrança.',
  },
  {
    id: 'fin_c3',
    modelType: 'conectado',
    periodo: '3º Mês',
    reuniao: 'Reunião 4, 5 e Estratégica',
    title: 'Balancete, Fluxo Projetado Empresário & KPIs',
    entregaveis: 'Levantamento do balancete (bens, direitos e obrigações), precificação, Fluxo de Caixa Empresário projetado, discussão de KPIs e encerramento.',
    status: 'pendente',
    agendaMessage: '3º Mês (Conectado): balancete gerencial, precificação, Fluxo de Caixa Projetado Empresário e revisão de KPIs.',
  },
];

const DEFAULT_WEEKLY: WeeklyRoutine[] = [
  { id: 'w1', semana: '1ª Semana', atividade: 'Fechamento do Mês e Validação das despesas', concluido: false },
  { id: 'w2', semana: '2ª Semana', atividade: 'Apresentação com GIP', concluido: false },
  { id: 'w3', semana: '3ª Semana', atividade: 'Fechar 15 dias', concluido: false },
  { id: 'w4', semana: '4ª Semana', atividade: 'Validar o final do mês', concluido: false },
];

export default function FinanceiroFluxogramaPage() {
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState('default');
  const [modelTab, setModelTab] = useState<'presencial' | 'conectado'>('presencial');
  const [milestones, setMilestones] = useState<FinMilestone[]>(DEFAULT_FIN_MILESTONES);
  const [weekly, setWeekly] = useState<WeeklyRoutine[]>(DEFAULT_WEEKLY);
  const [editing, setEditing] = useState<FinMilestone | null>(null);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    const emp = store.getSafeEmpresaId() || 'default';
    setEmpresaId(emp);
    fetch(`/api/comercial?empresaId=${encodeURIComponent(emp)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.financeiro_fluxograma) {
          const f = d.data.financeiro_fluxograma;
          if (Array.isArray(f.milestones) && f.milestones.length > 0) setMilestones(f.milestones);
          if (Array.isArray(f.weekly) && f.weekly.length > 0) setWeekly(f.weekly);
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
          sectionKey: 'financeiro_fluxograma',
          value: { milestones, weekly },
        }),
      }).catch(() => {});
    }, 1000);
    return () => clearTimeout(t);
  }, [milestones, weekly, empresaId]);

  const visible = useMemo(
    () => milestones.filter((m) => m.modelType === modelTab),
    [milestones, modelTab]
  );

  const stats = useMemo(() => {
    const total = visible.length;
    const done = visible.filter((m) => m.status === 'concluido').length;
    const doing = visible.filter((m) => m.status === 'em_andamento').length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const weeklyDone = weekly.filter((w) => w.concluido).length;
    return { total, done, doing, pct, weeklyDone };
  }, [visible, weekly]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/comercial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId,
          sectionKey: 'financeiro_fluxograma',
          value: { milestones, weekly },
        }),
      });
      const d = await res.json();
      if (d.success) toast.success('Fluxograma Financeiro salvo!');
      else toast.error(d.error || 'Erro ao salvar');
    } catch {
      toast.error('Erro de rede ao salvar');
    } finally {
      setSaving(false);
    }
  }

  function cycleStatus(id: string) {
    setMilestones((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const next = m.status === 'pendente' ? 'em_andamento' : m.status === 'em_andamento' ? 'concluido' : 'pendente';
        return { ...m, status: next };
      })
    );
  }

  function shareWhatsApp(m: FinMilestone) {
    const msg = `*${m.periodo} · ${m.reuniao} — ${m.title}*\n\n${m.agendaMessage || m.entregaveis}`;
    redirectToWhatsAppShare({ text: msg }, (url) => router.push(url));
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GitBranch size={26} color="var(--accent)" />
            Fluxograma de Assessoria Financeira
          </div>
          <div className="page-subtitle">
            Roteiro completo de implantação financeira (Presencial 6 Meses &amp; Conectado 3 Meses) + Rotina Semanal (GIP / Fechamentos).
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            onClick={() =>
              setMilestones((prev) => [
                ...prev,
                {
                  id: `fin_${Date.now()}`,
                  modelType: modelTab,
                  periodo: 'Extra',
                  reuniao: 'Reunião Extra',
                  title: 'Nova Etapa Financeira',
                  entregaveis: '',
                  status: 'pendente',
                  agendaMessage: '',
                },
              ])
            }
            className="btn btn-secondary"
          >
            <Plus size={15} /> Adicionar Etapa
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
            <Save size={15} /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <ComercialExportBar
          title={`Fluxograma Financeiro (${modelTab === 'presencial' ? 'Assessoria Presencial' : 'Assessoria Conectado'})`}
          fileNameBase="financeiro_fluxograma"
          kpis={[
            { label: 'Progresso', value: `${stats.pct}% (${stats.done}/${stats.total})` },
            { label: 'Rotina Semanal', value: `${stats.weeklyDone}/${weekly.length} semanas` },
          ]}
          columns={[
            { header: 'Período', key: 'periodo' },
            { header: 'Reunião', key: 'reuniao' },
            { header: 'Etapa', key: 'title' },
            { header: 'Entregáveis', key: 'entregaveis' },
            { header: 'Status', key: 'status' },
          ]}
          rows={visible}
        />

        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Etapas do Modelo</div>
            <div className="kpi-value">{stats.total}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Concluídas</div>
            <div className="kpi-value" style={{ color: '#16a34a' }}>{stats.done}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Em Andamento</div>
            <div className="kpi-value" style={{ color: '#eab308' }}>{stats.doing}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Rotina Mensal (Semanas)</div>
            <div className="kpi-value" style={{ color: 'var(--accent)' }}>{stats.weeklyDone} / {weekly.length}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setModelTab('presencial')}
              className={modelTab === 'presencial' ? 'btn btn-primary' : 'btn btn-secondary'}
            >
              🏢 Assessoria Presencial (6 Meses)
            </button>
            <button
              type="button"
              onClick={() => setModelTab('conectado')}
              className={modelTab === 'conectado' ? 'btn btn-primary' : 'btn btn-secondary'}
            >
              🌐 Assessoria Conectado / Online (3 Meses)
            </button>
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>
            {stats.done} concluídas · {stats.doing} em andamento · {stats.pct}%
          </span>
        </div>

        {/* Tabela do Fluxograma */}
        <div className="card" style={{ padding: 18 }}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Reunião</th>
                  <th>Etapa &amp; Entregáveis</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{m.periodo}</td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{m.reuniao}</td>
                    <td>
                      <div style={{ fontWeight: 700, marginBottom: 3 }}>{m.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{m.entregaveis}</div>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => cycleStatus(m.id)}
                        className={`badge ${m.status === 'concluido' ? 'badge-success' : m.status === 'em_andamento' ? 'badge-warning' : 'badge-info'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                      >
                        {m.status === 'concluido' ? 'Concluído' : m.status === 'em_andamento' ? 'Em andamento' : 'Pendente'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(m.agendaMessage || m.entregaveis);
                            toast.success('Mensagem de agenda copiada!');
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px' }}
                          title="Copiar mensagem"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => shareWhatsApp(m)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px' }}
                          title="Enviar via WhatsApp"
                        >
                          <MessageSquare size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing({ ...m })}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px' }}
                          title="Editar"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setMilestones((prev) => prev.filter((x) => x.id !== m.id))}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', color: '#dc2626' }}
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

        {/* Rotina Semanal (Planilha1 do Fluxograma Online) */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <CalendarCheck2 size={18} color="var(--accent)" />
            <div className="card-title">Rotina Mensal de Acompanhamento (4 Semanas)</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {weekly.map((w) => (
              <label
                key={w.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: 12,
                  borderRadius: 10,
                  border: w.concluido ? '1.5px solid #16a34a' : '1px solid var(--border)',
                  background: w.concluido ? 'rgba(22, 163, 74, 0.08)' : 'var(--bg-secondary)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={w.concluido}
                  onChange={() =>
                    setWeekly((prev) => prev.map((x) => (x.id === w.id ? { ...x, concluido: !x.concluido } : x)))
                  }
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{w.semana}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{w.atividade}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {editing && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 540 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700 }}>Editar Etapa Financeira</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">Período</label>
                  <input className="form-input" value={editing.periodo} onChange={(e) => setEditing({ ...editing, periodo: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Reunião</label>
                  <input className="form-input" value={editing.reuniao} onChange={(e) => setEditing({ ...editing, reuniao: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="form-label">Título da Etapa</label>
                <input className="form-input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Entregáveis</label>
                <textarea className="form-input" rows={3} value={editing.entregaveis} onChange={(e) => setEditing({ ...editing, entregaveis: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Mensagem de Agenda (WhatsApp)</label>
                <textarea className="form-input" rows={3} value={editing.agendaMessage} onChange={(e) => setEditing({ ...editing, agendaMessage: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setEditing(null)} className="btn btn-secondary">Cancelar</button>
              <button
                type="button"
                onClick={() => {
                  setMilestones((prev) => prev.map((x) => (x.id === editing.id ? editing : x)));
                  setEditing(null);
                }}
                className="btn btn-primary"
              >
                Salvar Etapa
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
