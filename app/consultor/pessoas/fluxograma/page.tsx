'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, GitBranch, Save, Plus, Trash2, Edit3, Copy, MessageSquare } from 'lucide-react';
import { store } from '@/lib/store';
import { toast } from 'sonner';
import { redirectToWhatsAppShare } from '@/lib/whatsapp-share';
import ComercialExportBar from '@/components/ComercialExportBar';

interface RhMilestone {
  id: string;
  modelType: 'conectado' | 'presencial';
  windowDays: string;
  meetingLabel: string;
  title: string;
  status: 'pendente' | 'em_andamento' | 'concluido';
  agendaMessage: string;
}

interface RoleCargo {
  id: string;
  cargo: string;
  setor: string;
  reportaA: string;
  faixaSalarial: string;
  descritivo: string;
}

const DEFAULT_RH_MILESTONES: RhMilestone[] = [
  // Projeto Conectado (100 Dias)
  {
    id: 'rh_c1',
    modelType: 'conectado',
    windowDays: '01 - 30 dias',
    meetingLabel: '1ª Reunião (1h)',
    title: 'Organograma & Levantamento de Cargos e Salários',
    status: 'concluido',
    agendaMessage: 'Nesta agenda, iremos trabalhar o organograma da empresa e realizar o levantamento de cargos e salários, com o objetivo de organizar a estrutura hierárquica e definir com clareza as funções, responsabilidades e faixas salariais de cada posição.',
  },
  {
    id: 'rh_c2',
    modelType: 'conectado',
    windowDays: '01 - 30 dias',
    meetingLabel: '2ª Interna (30min) / 3ª Online (1h)',
    title: 'Descritivo de Função (Elaboração & Apresentação)',
    status: 'em_andamento',
    agendaMessage: 'Nesta agenda, iremos desenvolver e apresentar o descritivo de funções, detalhando as atividades, responsabilidades e requisitos de cada cargo, para trazer mais clareza, organização e eficiência à gestão da equipe.',
  },
  {
    id: 'rh_c3',
    modelType: 'conectado',
    windowDays: '15 - 45 dias',
    meetingLabel: '4ª Online / 5ª Interna / 6ª Online',
    title: 'Análise de Perfil Comportamental (DISC)',
    status: 'pendente',
    agendaMessage: 'Nesta agenda, realizaremos a apresentação da metodologia de análise de perfil (ferramenta DISC), recebimento dos questionários e tabulação dos dados para alinhar os perfis às funções e demandas da empresa.',
  },
  {
    id: 'rh_c4',
    modelType: 'conectado',
    windowDays: '30 - 60 dias',
    meetingLabel: '7ª Reunião Online (1h)',
    title: 'Política de Recrutamento e Seleção',
    status: 'pendente',
    agendaMessage: 'Nesta agenda, iremos desenvolver a política de recrutamento e seleção, definindo critérios, etapas e diretrizes que garantam um processo mais estratégico, justo e alinhado às necessidades da empresa.',
  },
  {
    id: 'rh_c5',
    modelType: 'conectado',
    windowDays: '30 - 90 dias',
    meetingLabel: '8ª Reunião Online (1h)',
    title: 'Processo de Integração (Onboarding)',
    status: 'pendente',
    agendaMessage: 'Nesta agenda, iremos estruturar a política de integração dos funcionários, com foco em padronizar o acolhimento de novos colaboradores e promover uma adaptação mais rápida e eficaz à cultura e aos processos da empresa.',
  },
  {
    id: 'rh_c6',
    modelType: 'conectado',
    windowDays: '30 - 90 dias',
    meetingLabel: '9ª Reunião Online (1h)',
    title: 'Estruturação de Feedbacks e Demissão',
    status: 'pendente',
    agendaMessage: 'Nesta agenda, iremos estruturar os processos de feedback e desligamento, estabelecendo diretrizes claras para uma comunicação assertiva, desenvolvimento contínuo e condução ética e respeitosa em casos de demissão.',
  },
  {
    id: 'rh_c7',
    modelType: 'conectado',
    windowDays: '30 - 90 dias',
    meetingLabel: '10ª Online / Interna / Apresentação',
    title: 'Fluxograma de Processos da Empresa',
    status: 'pendente',
    agendaMessage: 'Nesta agenda, iremos entender, estruturar e apresentar visualmente o fluxograma da empresa, organizando processos e responsabilidades para facilitar o alinhamento e a eficiência entre as áreas.',
  },
  {
    id: 'rh_c8',
    modelType: 'conectado',
    windowDays: '60 - 100 dias',
    meetingLabel: '15ª Online (30min) / 16ª Online (1h)',
    title: 'Política Salarial & Meritocracia',
    status: 'pendente',
    agendaMessage: 'Nesta agenda, iremos estruturar a política salarial interna voltada ao desenvolvimento, com foco em criar critérios que valorizem a evolução profissional, desempenho e crescimento dentro da empresa, promovendo meritocracia e engajamento.',
  },
  // Assessoria Presencial
  {
    id: 'rh_p1',
    modelType: 'presencial',
    windowDays: 'Fase 1',
    meetingLabel: 'Presencial',
    title: 'Cliente, Organograma & Levantamento de Cargos e Salários',
    status: 'concluido',
    agendaMessage: 'Mapeamento inicial do cliente, estrutura hierárquica (organograma) e levantamento completo de cargos e salários.',
  },
  {
    id: 'rh_p2',
    modelType: 'presencial',
    windowDays: 'Fase 2',
    meetingLabel: 'Presencial',
    title: 'Descritivo de Função, Clima Organizacional & Competência Comportamental',
    status: 'pendente',
    agendaMessage: 'Elaboração dos descritivos de função, aplicação de Pesquisa de Clima Organizacional e mapeamento de competências comportamentais.',
  },
  {
    id: 'rh_p3',
    modelType: 'presencial',
    windowDays: 'Fase 3',
    meetingLabel: 'Presencial',
    title: 'Política de Recrutamento, Regimento Interno & Normas e Condutas',
    status: 'pendente',
    agendaMessage: 'Definição da Política de Recrutamento e Seleção e estruturação do Regimento Interno / Normas e Condutas da empresa.',
  },
  {
    id: 'rh_p4',
    modelType: 'presencial',
    windowDays: 'Fase 4',
    meetingLabel: 'Presencial',
    title: 'Fluxograma, Política Salarial & Processo de Integração',
    status: 'pendente',
    agendaMessage: 'Desenho do fluxograma interno de RH, Política Salarial estruturada e Processo de Integração de novos colaboradores.',
  },
];

const DEFAULT_CARGOS: RoleCargo[] = [
  {
    id: 'cg1',
    cargo: 'Gerente / Líder Comercial',
    setor: 'Comercial',
    reportaA: 'Diretoria',
    faixaSalarial: 'R$ 4.500 + Comissão',
    descritivo: 'Gestão de metas da equipe, acompanhamento de funil, feedbacks semanais e fechamento de contas estratégicas.',
  },
  {
    id: 'cg2',
    cargo: 'Assistente Administrativo / Financeiro',
    setor: 'Administrativo',
    reportaA: 'Diretoria',
    faixaSalarial: 'R$ 2.400 - R$ 3.000',
    descritivo: 'Contas a pagar/receber, conciliação bancária, emissão de notas fiscais e apoio ao RH.',
  },
];

export default function PessoasFluxogramaRhPage() {
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState('default');
  const [modelTab, setModelTab] = useState<'conectado' | 'presencial'>('conectado');
  const [milestones, setMilestones] = useState<RhMilestone[]>(DEFAULT_RH_MILESTONES);
  const [cargos, setCargos] = useState<RoleCargo[]>(DEFAULT_CARGOS);
  const [editingMilestone, setEditingMilestone] = useState<RhMilestone | null>(null);
  const [editingCargo, setEditingCargo] = useState<RoleCargo | null>(null);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    const emp = store.getSafeEmpresaId() || 'default';
    setEmpresaId(emp);
    fetch(`/api/comercial?empresaId=${encodeURIComponent(emp)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.pessoas_rh) {
          if (Array.isArray(d.data.pessoas_rh.milestones) && d.data.pessoas_rh.milestones.length > 0) {
            setMilestones(d.data.pessoas_rh.milestones);
          }
          if (Array.isArray(d.data.pessoas_rh.cargos) && d.data.pessoas_rh.cargos.length > 0) {
            setCargos(d.data.pessoas_rh.cargos);
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
          sectionKey: 'pessoas_rh',
          value: { milestones, cargos },
        }),
      }).catch(() => {});
    }, 1000);
    return () => clearTimeout(t);
  }, [milestones, cargos, empresaId]);

  const visibleMilestones = useMemo(
    () => milestones.filter(m => m.modelType === modelTab),
    [milestones, modelTab]
  );

  const stats = useMemo(() => {
    const total = visibleMilestones.length;
    const done = visibleMilestones.filter(m => m.status === 'concluido').length;
    const doing = visibleMilestones.filter(m => m.status === 'em_andamento').length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, doing, pct };
  }, [visibleMilestones]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/comercial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId,
          sectionKey: 'pessoas_rh',
          value: { milestones, cargos },
        }),
      });
      const d = await res.json();
      if (d.success) toast.success('Fluxograma de Pessoas & RH salvo!');
      else toast.error(d.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  function sendAgendaWhatsApp(m: RhMilestone) {
    const emp = store.getEmpresas().find(e => e.id === empresaId);
    const msg = `📅 *Agenda RH — ${m.title}* (${m.meetingLabel})\n\n${m.agendaMessage}`;
    redirectToWhatsAppShare(
      {
        phone: emp?.telefone || '',
        name: emp?.nomeFantasia || emp?.razaoSocial || 'Cliente',
        text: msg,
      },
      url => router.push(url)
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GitBranch size={26} color="var(--accent)" />
            Fluxograma de Gestão Estratégica de Pessoas &amp; RH
          </div>
          <div className="page-subtitle">
            Organograma, Cargos e Salários, Descritivo de Função, Clima, DISC, Recrutamento, Integração, Feedbacks e Política Salarial.
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            onClick={() =>
              setMilestones(prev => [
                ...prev,
                {
                  id: `rh_${Date.now()}`,
                  modelType: modelTab,
                  windowDays: 'Personalizado',
                  meetingLabel: 'Reunião Extra',
                  title: 'Nova Etapa de RH',
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
            <Save size={15} /> {saving ? 'Salvando...' : 'Salvar RH'}
          </button>
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <ComercialExportBar
          title={`Fluxograma RH & Pessoas (${modelTab === 'conectado' ? 'Projeto Conectado' : 'Assessoria Presencial'})`}
          fileNameBase="pessoas_fluxograma_rh"
          kpis={[
            { label: 'Progresso RH', value: `${stats.pct}% (${stats.done}/${stats.total} etapas)` },
            { label: 'Cargos Mapeados', value: String(cargos.length) },
          ]}
          columns={[
            { header: 'Janela', key: 'windowDays' },
            { header: 'Reunião', key: 'meetingLabel' },
            { header: 'Etapa / Entrega', key: 'title' },
            { header: 'Status', key: 'status' },
            { header: 'Pauta / Mensagem', key: 'agendaMessage' },
          ]}
          rows={visibleMilestones}
        />

        {/* Abas Projeto Conectado vs Assessoria Presencial */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setModelTab('conectado')}
              className={modelTab === 'conectado' ? 'btn btn-primary' : 'btn btn-secondary'}
            >
              Projeto Conectado (100 Dias · Online)
            </button>
            <button
              type="button"
              onClick={() => setModelTab('presencial')}
              className={modelTab === 'presencial' ? 'btn btn-primary' : 'btn btn-secondary'}
            >
              Assessoria Presencial
            </button>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
            {stats.done} concluídas · {stats.doing} em andamento · {stats.pct}%
          </span>
        </div>

        {/* Barra de progresso */}
        <div className="card" style={{ padding: 14 }}>
          <div style={{ height: 10, borderRadius: 999, background: 'var(--bg-card2)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div style={{ width: `${stats.pct}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s ease' }} />
          </div>
        </div>

        {/* Tabela Limpa de Etapas + Modelos de Mensagem */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>
            Cronograma de Reuniões, Entregas &amp; Modelos de Mensagem da Agenda
          </h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Prazo / Reunião</th>
                  <th>Entrega / Política RH</th>
                  <th>Status</th>
                  <th>Modelo de Mensagem / Pauta</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {visibleMilestones.map(m => (
                  <tr key={m.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{m.windowDays}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{m.meetingLabel}</div>
                    </td>
                    <td style={{ fontWeight: 700, minWidth: 200 }}>{m.title}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <select
                        value={m.status}
                        onChange={e =>
                          setMilestones(prev =>
                            prev.map(x => (x.id === m.id ? { ...x, status: e.target.value as any } : x))
                          )
                        }
                        style={{
                          padding: '4px 10px',
                          borderRadius: 999,
                          fontSize: 13.5,
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
                        <option value="pendente">Pendente</option>
                        <option value="em_andamento">Em Andamento</option>
                        <option value="concluido">Concluído</option>
                      </select>
                    </td>
                    <td style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.45, minWidth: 280 }}>
                      {m.agendaMessage || <span style={{ opacity: 0.5 }}>Sem texto definido</span>}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: 5 }}>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(m.agendaMessage || m.title);
                            toast.success('Texto da agenda copiado!');
                          }}
                          className="btn btn-secondary btn-sm"
                          title="Copiar mensagem da agenda"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => sendAgendaWhatsApp(m)}
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#15803d' }}
                          title="Enviar pauta no WhatsApp"
                        >
                          <MessageSquare size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingMilestone({ ...m })}
                          className="btn btn-secondary btn-sm"
                          title="Editar etapa"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setMilestones(prev => prev.filter(x => x.id !== m.id))}
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

        {/* Bloco 2: Organograma, Cargos & Salários e Descritivo de Função */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={17} color="var(--accent)" /> Organograma, Cargos &amp; Salários e Descritivo de Função
            </h3>
            <button
              type="button"
              onClick={() =>
                setEditingCargo({
                  id: `cg_${Date.now()}`,
                  cargo: '',
                  setor: '',
                  reportaA: '',
                  faixaSalarial: '',
                  descritivo: '',
                })
              }
              className="btn btn-secondary btn-sm"
            >
              <Plus size={14} /> Novo Cargo
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cargo / Posição</th>
                  <th>Setor</th>
                  <th>Reporta-se a</th>
                  <th>Faixa Salarial</th>
                  <th>Descritivo de Função</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {cargos.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 700 }}>{c.cargo}</td>
                    <td>{c.setor}</td>
                    <td>{c.reportaA}</td>
                    <td style={{ fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{c.faixaSalarial}</td>
                    <td style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.45, minWidth: 240 }}>{c.descritivo}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button type="button" onClick={() => setEditingCargo({ ...c })} className="btn btn-secondary btn-sm">
                          <Edit3 size={13} /> Editar
                        </button>
                        <button type="button" onClick={() => setCargos(prev => prev.filter(x => x.id !== c.id))} className="btn btn-secondary btn-sm" style={{ color: 'var(--red)' }}>
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
      </div>

      {/* Modal Editar Etapa RH */}
      {editingMilestone && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 560, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Editar Etapa de RH</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label className="form-label">Prazo</label><input className="form-control" style={{ width: '100%' }} value={editingMilestone.windowDays} onChange={e => setEditingMilestone(m => m ? { ...m, windowDays: e.target.value } : null)} /></div>
              <div><label className="form-label">Reunião</label><input className="form-control" style={{ width: '100%' }} value={editingMilestone.meetingLabel} onChange={e => setEditingMilestone(m => m ? { ...m, meetingLabel: e.target.value } : null)} /></div>
            </div>
            <div><label className="form-label">Título da Entrega / Política</label><input className="form-control" style={{ width: '100%' }} value={editingMilestone.title} onChange={e => setEditingMilestone(m => m ? { ...m, title: e.target.value } : null)} /></div>
            <div><label className="form-label">Modelo de Mensagem / Pauta da Reunião</label><textarea rows={4} className="form-control" style={{ width: '100%' }} value={editingMilestone.agendaMessage} onChange={e => setEditingMilestone(m => m ? { ...m, agendaMessage: e.target.value } : null)} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar/Criar Cargo */}
      {editingCargo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 540, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Cargo, Salário &amp; Descritivo</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label className="form-label">Cargo</label><input className="form-control" style={{ width: '100%' }} value={editingCargo.cargo} onChange={e => setEditingCargo(c => c ? { ...c, cargo: e.target.value } : null)} /></div>
              <div><label className="form-label">Setor</label><input className="form-control" style={{ width: '100%' }} value={editingCargo.setor} onChange={e => setEditingCargo(c => c ? { ...c, setor: e.target.value } : null)} /></div>
              <div><label className="form-label">Reporta-se a</label><input className="form-control" style={{ width: '100%' }} value={editingCargo.reportaA} onChange={e => setEditingCargo(c => c ? { ...c, reportaA: e.target.value } : null)} /></div>
              <div><label className="form-label">Faixa Salarial</label><input className="form-control" style={{ width: '100%' }} value={editingCargo.faixaSalarial} onChange={e => setEditingCargo(c => c ? { ...c, faixaSalarial: e.target.value } : null)} /></div>
            </div>
            <div><label className="form-label">Descritivo de Função (Atividades &amp; Responsabilidades)</label><textarea rows={4} className="form-control" style={{ width: '100%' }} value={editingCargo.descritivo} onChange={e => setEditingCargo(c => c ? { ...c, descritivo: e.target.value } : null)} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setEditingCargo(null)} className="btn btn-secondary">Cancelar</button>
              <button
                type="button"
                onClick={() => {
                  if (!editingCargo.cargo.trim()) {
                    toast.error('Informe o nome do cargo.');
                    return;
                  }
                  setCargos(prev => {
                    const exists = prev.some(x => x.id === editingCargo.id);
                    return exists ? prev.map(x => (x.id === editingCargo.id ? editingCargo : x)) : [...prev, editingCargo];
                  });
                  setEditingCargo(null);
                  toast.success('Cargo salvo!');
                }}
                className="btn btn-primary"
              >
                Salvar Cargo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
