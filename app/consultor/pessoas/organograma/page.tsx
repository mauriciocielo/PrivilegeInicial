'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ComercialExportBar from '@/components/ComercialExportBar';
import { store } from '@/lib/store';
import {
  Network, FileText, Plus, Edit3, Trash2, Printer,
  ChevronRight, CheckCircle2, X, UserCheck, ShieldCheck
} from 'lucide-react';

interface OrgNode {
  id: string;
  cargo: string;
  setor: string;
  colaborador: string;
  nivel: 'Diretoria' | 'Gerencia' | 'Supervisao' | 'Operacional';
  parentId: string | null;
  headcount: number;
}

interface DescritivoFuncao {
  id: string;
  funcao: string;
  cbo: string;
  revisao: string;
  data: string;
  setor: string;
  nomeFuncionario: string;
  gestorResponsavel: string;
  objetivo: string;
  requisitos: string[];
  atividades: string[];
}

const DEFAULT_ORG_NODES: OrgNode[] = [
  { id: 'org-1', cargo: 'Diretor Executivo / Sócio', setor: 'Diretoria', colaborador: 'Diretoria Geral', nivel: 'Diretoria', parentId: null, headcount: 1 },
  { id: 'org-2', cargo: 'Gerente Administrativo & Financeiro', setor: 'Administrativo / Financeiro', colaborador: 'A definir', nivel: 'Gerencia', parentId: 'org-1', headcount: 1 },
  { id: 'org-3', cargo: 'Gerente Comercial & Marketing', setor: 'Comercial', colaborador: 'A definir', nivel: 'Gerencia', parentId: 'org-1', headcount: 1 },
  { id: 'org-4', cargo: 'Coordenador de Operações / RH', setor: 'Pessoas & Operações', colaborador: 'A definir', nivel: 'Supervisao', parentId: 'org-1', headcount: 1 },
  { id: 'org-5', cargo: 'Analista Financeiro / DP', setor: 'Administrativo / Financeiro', colaborador: 'Equipe Financeira', nivel: 'Operacional', parentId: 'org-2', headcount: 2 },
  { id: 'org-6', cargo: 'Consultor de Vendas / SDR', setor: 'Comercial', colaborador: 'Time Comercial', nivel: 'Operacional', parentId: 'org-3', headcount: 4 },
  { id: 'org-7', cargo: 'Assistente de RH & Endomarketing', setor: 'Pessoas & Operações', colaborador: 'Equipe RH', nivel: 'Operacional', parentId: 'org-4', headcount: 1 },
];

const DEFAULT_DESCRITIVOS: DescritivoFuncao[] = [
  {
    id: 'desc-1',
    funcao: 'Analista Administrativo / Financeiro',
    cbo: '2521-05',
    revisao: '01',
    data: new Date().toISOString().slice(0, 10),
    setor: 'Administrativo / Financeiro',
    nomeFuncionario: 'A definir',
    gestorResponsavel: 'Gerente Administrativo & Financeiro',
    objetivo: 'Garantir o controle preciso do fluxo de caixa, contas a pagar e receber, conciliação bancária e rotinas administrativas de apoio à gestão.',
    requisitos: [
      'Ser organizado(a) e metódico(a)',
      'Ser responsável e comprometido(a) com prazos',
      'Ser proativo(a) na resolução de pendências',
      'Ser atento(a) aos detalhes e conferência de dados',
      'Domínio de planilhas e sistema de gestão financeira',
    ],
    atividades: [
      'Realizar lançamentos diários de contas a pagar e contas a receber.',
      'Executar conciliação bancária diária e reportar divergências.',
      'Emitir notas fiscais, boletos e acompanhar cobranças de inadimplentes.',
      'Organizar documentação contábil e fiscal para envio mensal à contabilidade.',
      'Apoiar no fechamento do DRE gerencial e indicadores financeiros semanais.',
    ],
  },
  {
    id: 'desc-2',
    funcao: 'Consultor Comercial / Vendedor',
    cbo: '3541-25',
    revisao: '01',
    data: new Date().toISOString().slice(0, 10),
    setor: 'Comercial',
    nomeFuncionario: 'A definir',
    gestorResponsavel: 'Gerente Comercial',
    objetivo: 'Prospectar, qualificar e converter oportunidades comerciais em vendas recorrentes, garantindo atendimento consultivo e atingimento de metas.',
    requisitos: [
      'Comunicação clara e escuta ativa',
      'Foco em metas e orientação para resultados',
      'Disciplina no preenchimento do CRM e follow-up',
      'Resiliência e postura consultiva com o cliente',
    ],
    atividades: [
      'Atender leads recebidos via WhatsApp, telefone e canais digitais dentro do SLA.',
      'Realizar diagnósticos comerciais e apresentar propostas personalizadas.',
      'Registrar todas as interações e etapas do funil no CRM diariamente.',
      'Executar rotina de follow-up e reativação de carteira inativa.',
      'Participar da reunião semanal de metas e alinhamento comercial.',
    ],
  },
];

const NIVEL_COLORS: Record<OrgNode['nivel'], { bg: string; border: string; badge: string }> = {
  Diretoria: { bg: 'rgba(59, 130, 246, 0.10)', border: '#3b82f6', badge: '#2563eb' },
  Gerencia: { bg: 'rgba(34, 197, 94, 0.10)', border: '#22c55e', badge: '#16a34a' },
  Supervisao: { bg: 'rgba(234, 179, 8, 0.10)', border: '#eab308', badge: '#ca8a04' },
  Operacional: { bg: 'var(--bg-secondary)', border: 'var(--border)', badge: '#64748b' },
};

export default function PessoasOrganogramaPage() {
  const [empresaId, setEmpresaId] = useState('default');
  const [tab, setTab] = useState<'organograma' | 'descritivo'>('organograma');
  const [nodes, setNodes] = useState<OrgNode[]>(DEFAULT_ORG_NODES);
  const [descritivos, setDescritivos] = useState<DescritivoFuncao[]>(DEFAULT_DESCRITIVOS);
  const [selectedDescId, setSelectedDescId] = useState<string>(DEFAULT_DESCRITIVOS[0].id);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const [editingNode, setEditingNode] = useState<OrgNode | null>(null);
  const [showNodeModal, setShowNodeModal] = useState(false);

  const [editingDesc, setEditingDesc] = useState<DescritivoFuncao | null>(null);
  const [showDescModal, setShowDescModal] = useState(false);
  const [reqInput, setReqInput] = useState('');
  const [ativInput, setAtivInput] = useState('');

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async (empId: string) => {
    try {
      const res = await fetch(`/api/comercial?empresaId=${encodeURIComponent(empId)}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success && json.data?.pessoas_organograma) {
        const d = json.data.pessoas_organograma;
        if (Array.isArray(d.nodes) && d.nodes.length > 0) setNodes(d.nodes);
        if (Array.isArray(d.descritivos) && d.descritivos.length > 0) {
          setDescritivos(d.descritivos);
          setSelectedDescId(d.descritivos[0].id);
        }
      }
    } catch {
      // fallback
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const emp = store.getSafeEmpresaId() || 'default';
    setEmpresaId(emp);
    loadData(emp);
  }, [loadData]);

  const persist = useCallback(
    (nextNodes: OrgNode[], nextDescs: DescritivoFuncao[]) => {
      if (!loaded) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaving(true);
        try {
          await fetch('/api/comercial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              empresaId,
              sectionKey: 'pessoas_organograma',
              value: { nodes: nextNodes, descritivos: nextDescs },
            }),
          });
          setLastSaved(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        } finally {
          setSaving(false);
        }
      }, 900);
    },
    [empresaId, loaded]
  );

  const updateNodes = (next: OrgNode[]) => {
    setNodes(next);
    persist(next, descritivos);
  };

  const updateDescritivos = (next: DescritivoFuncao[]) => {
    setDescritivos(next);
    persist(nodes, next);
  };

  const selectedDesc = useMemo(
    () => descritivos.find((d) => d.id === selectedDescId) || descritivos[0],
    [descritivos, selectedDescId]
  );

  const totalHeadcount = useMemo(() => nodes.reduce((acc, n) => acc + (Number(n.headcount) || 1), 0), [nodes]);
  const setoresUnicos = useMemo(() => new Set(nodes.map((n) => n.setor)).size, [nodes]);

  const openNewNode = (parentId: string | null = null) => {
    setEditingNode({
      id: `org-${Date.now()}`,
      cargo: '',
      setor: '',
      colaborador: '',
      nivel: parentId ? 'Operacional' : 'Diretoria',
      parentId,
      headcount: 1,
    });
    setShowNodeModal(true);
  };

  const handleSaveNode = () => {
    if (!editingNode || !editingNode.cargo.trim()) return;
    const exists = nodes.some((n) => n.id === editingNode.id);
    const next = exists
      ? nodes.map((n) => (n.id === editingNode.id ? editingNode : n))
      : [...nodes, editingNode];
    updateNodes(next);
    setShowNodeModal(false);
  };

  const handleDeleteNode = (id: string) => {
    const next = nodes
      .filter((n) => n.id !== id)
      .map((n) => (n.parentId === id ? { ...n, parentId: null } : n));
    updateNodes(next);
  };

  const openNewDesc = () => {
    setEditingDesc({
      id: `desc-${Date.now()}`,
      funcao: '',
      cbo: '',
      revisao: '01',
      data: new Date().toISOString().slice(0, 10),
      setor: '',
      nomeFuncionario: '',
      gestorResponsavel: '',
      objetivo: '',
      requisitos: [],
      atividades: [],
    });
    setReqInput('');
    setAtivInput('');
    setShowDescModal(true);
  };

  const handleSaveDesc = () => {
    if (!editingDesc || !editingDesc.funcao.trim()) return;
    const exists = descritivos.some((d) => d.id === editingDesc.id);
    const next = exists
      ? descritivos.map((d) => (d.id === editingDesc.id ? editingDesc : d))
      : [...descritivos, editingDesc];
    updateDescritivos(next);
    setSelectedDescId(editingDesc.id);
    setShowDescModal(false);
  };

  const handleDeleteDesc = (id: string) => {
    if (descritivos.length <= 1) return;
    const next = descritivos.filter((d) => d.id !== id);
    updateDescritivos(next);
    if (selectedDescId === id && next[0]) setSelectedDescId(next[0].id);
  };

  const renderTree = (parentId: string | null, depth = 0): React.ReactNode => {
    const children = nodes.filter((n) => n.parentId === parentId);
    if (children.length === 0) return null;
    return (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 16,
          marginTop: depth === 0 ? 0 : 18,
          paddingTop: depth === 0 ? 0 : 14,
          borderTop: depth === 0 ? 'none' : '2px dashed var(--border)',
          width: '100%',
        }}
      >
        {children.map((node) => {
          const style = NIVEL_COLORS[node.nivel];
          const hasChildren = nodes.some((c) => c.parentId === node.id);
          return (
            <div
              key={node.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: 230,
                maxWidth: hasChildren ? '100%' : 280,
                flex: hasChildren ? '1 1 280px' : '0 1 260px',
              }}
            >
              <div
                style={{
                  width: '100%',
                  background: style.bg,
                  border: `1.5px solid ${style.border}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: '#fff',
                      background: style.badge,
                      padding: '2px 8px',
                      borderRadius: 999,
                    }}
                  >
                    {node.nivel} · {node.headcount} {node.headcount === 1 ? 'vaga' : 'vagas'}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => openNewNode(node.id)}
                      title="Adicionar subordinado"
                      className="btn btn-secondary"
                      style={{ padding: '3px 5px', minHeight: 'auto' }}
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      onClick={() => {
                        setEditingNode({ ...node });
                        setShowNodeModal(true);
                      }}
                      title="Editar"
                      className="btn btn-secondary"
                      style={{ padding: '3px 5px', minHeight: 'auto' }}
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteNode(node.id)}
                      title="Remover"
                      className="btn btn-secondary"
                      style={{ padding: '3px 5px', minHeight: 'auto', color: '#dc2626' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{node.cargo}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{node.setor}</div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500 }}>
                  <UserCheck size={13} color={style.badge} />
                  {node.colaborador || 'A definir'}
                </div>
              </div>
              {renderTree(node.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  const exportRows = useMemo(
    () =>
      tab === 'organograma'
        ? nodes.map((n) => ({
            nivel: n.nivel,
            cargo: n.cargo,
            setor: n.setor,
            colaborador: n.colaborador || 'A definir',
            vagas: String(n.headcount),
            reporta: nodes.find((p) => p.id === n.parentId)?.cargo || 'Topo da Estrutura',
          }))
        : descritivos.map((d) => ({
            funcao: d.funcao,
            cbo: d.cbo,
            setor: d.setor,
            colaborador: d.nomeFuncionario,
            gestor: d.gestorResponsavel,
            objetivo: d.objetivo,
          })),
    [tab, nodes, descritivos]
  );

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Network size={26} color="var(--accent)" />
            Organograma & Descritivo de Funções
          </div>
          <div className="page-subtitle">
            Arquitetura de cargos, hierarquia organizacional e fichas assináveis de perfil de função (CBO, requisitos e atividades).
          </div>
        </div>
        <div className="header-actions">
          {saving && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Salvando...</span>}
          {!saving && lastSaved && (
            <span style={{ fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle2 size={14} /> Salvo às {lastSaved}
            </span>
          )}
          <button onClick={() => openNewNode(null)} className="btn btn-primary">
            <Plus size={15} /> Novo Cargo Diretoria
          </button>
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <ComercialExportBar
          title={tab === 'organograma' ? 'Organograma & Arquitetura de Cargos' : 'Descritivos de Perfil de Função'}
          fileNameBase={tab === 'organograma' ? 'organograma-cargos' : 'descritivo-funcoes'}
          kpis={[
            { label: 'Posições no Organograma', value: String(nodes.length) },
            { label: 'Headcount Previsto', value: `${totalHeadcount} pessoas` },
            { label: 'Setores Mapeados', value: String(setoresUnicos) },
            { label: 'Descritivos Criados', value: String(descritivos.length) },
          ]}
          columns={
            tab === 'organograma'
              ? [
                  { header: 'Nível', key: 'nivel' },
                  { header: 'Cargo', key: 'cargo' },
                  { header: 'Setor', key: 'setor' },
                  { header: 'Colaborador', key: 'colaborador' },
                  { header: 'Vagas', key: 'vagas' },
                  { header: 'Reporta para', key: 'reporta' },
                ]
              : [
                  { header: 'Função', key: 'funcao' },
                  { header: 'CBO', key: 'cbo' },
                  { header: 'Setor', key: 'setor' },
                  { header: 'Colaborador', key: 'colaborador' },
                  { header: 'Gestor', key: 'gestor' },
                  { header: 'Objetivo', key: 'objetivo' },
                ]
          }
          rows={exportRows}
        />

        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Cargos Estruturados</div>
            <div className="kpi-value">{nodes.length}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Quadro Total (Vagas)</div>
            <div className="kpi-value">{totalHeadcount}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Setores / Áreas</div>
            <div className="kpi-value">{setoresUnicos}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Descritivos de Função</div>
            <div className="kpi-value">{descritivos.length}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setTab('organograma')} className={tab === 'organograma' ? 'btn btn-primary' : 'btn btn-secondary'}>
            <Network size={15} /> Organograma Visual
          </button>
          <button onClick={() => setTab('descritivo')} className={tab === 'descritivo' ? 'btn btn-primary' : 'btn btn-secondary'}>
            <FileText size={15} /> Descritivo de Perfil de Função
          </button>
        </div>

        {tab === 'organograma' ? (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div className="card-title">Estrutura Hierárquica</div>
                <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  Clique em <strong>+</strong> dentro de qualquer cargo para adicionar um subordinado direto.
                </p>
              </div>
            </div>
            <div style={{ overflowX: 'auto', paddingBottom: 12 }}>{renderTree(null)}</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 18, alignItems: 'start' }}>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <strong style={{ fontSize: 14 }}>Funções ({descritivos.length})</strong>
                <button onClick={openNewDesc} className="btn btn-primary" style={{ padding: '6px 10px', fontSize: 12 }}>
                  <Plus size={14} /> Nova
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {descritivos.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDescId(d.id)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: selectedDesc?.id === d.id ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      background: selectedDesc?.id === d.id ? 'var(--bg-secondary)' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{d.funcao}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {d.setor} · CBO {d.cbo || '—'}
                      </div>
                    </div>
                    <ChevronRight size={15} color="var(--text-muted)" />
                  </button>
                ))}
              </div>
            </div>

            {selectedDesc && (
              <div className="card" style={{ padding: 22, gridColumn: 'span 2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldCheck size={20} color="var(--accent)" />
                    <strong style={{ fontSize: 16 }}>Ficha Oficial — Descrição de Perfil de Função</strong>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => window.print()} className="btn btn-secondary">
                      <Printer size={15} /> Imprimir / Assinar
                    </button>
                    <button
                      onClick={() => {
                        setEditingDesc({ ...selectedDesc, requisitos: [...selectedDesc.requisitos], atividades: [...selectedDesc.atividades] });
                        setReqInput('');
                        setAtivInput('');
                        setShowDescModal(true);
                      }}
                      className="btn btn-primary"
                    >
                      <Edit3 size={15} /> Editar Ficha
                    </button>
                    {descritivos.length > 1 && (
                      <button
                        onClick={() => handleDeleteDesc(selectedDesc.id)}
                        className="btn btn-secondary"
                        style={{ color: '#dc2626' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ background: 'var(--bg-secondary)', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                        Descrição de Perfil de Função
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{selectedDesc.funcao}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
                      <div><strong>CBO:</strong> {selectedDesc.cbo || '—'}</div>
                      <div><strong>Revisão:</strong> {selectedDesc.revisao || '01'}</div>
                      <div><strong>Data:</strong> {selectedDesc.data || '—'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Setor</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedDesc.setor}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Funcionário</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedDesc.nomeFuncionario || 'A definir'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Gestor Responsável</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedDesc.gestorResponsavel || '—'}</div>
                    </div>
                  </div>

                  <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 6 }}>
                      Objetivo da Função
                    </div>
                    <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{selectedDesc.objetivo}</p>
                  </div>

                  <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 8 }}>
                      Perfil / Requisitos
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {selectedDesc.requisitos.map((req, i) => (
                        <span key={i} className="badge badge-info" style={{ fontSize: 12, padding: '4px 10px' }}>
                          {req}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 8 }}>
                      Função — Descrição das Atividades Exercidas
                    </div>
                    <ol style={{ margin: 0, paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 13.5, lineHeight: 1.7 }}>
                      {selectedDesc.atividades.map((at, i) => (
                        <li key={i}>{at}</li>
                      ))}
                    </ol>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, padding: '32px 24px 20px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Assinatura do Colaborador
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Assinatura do Supervisor / Gestor
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Node */}
      {showNodeModal && editingNode && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Cargo no Organograma</h3>
              <button onClick={() => setShowNodeModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="form-label">Nome do Cargo *</label>
                <input className="form-input" value={editingNode.cargo} onChange={(e) => setEditingNode({ ...editingNode, cargo: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">Setor</label>
                  <input className="form-input" value={editingNode.setor} onChange={(e) => setEditingNode({ ...editingNode, setor: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Nível Hierárquico</label>
                  <select className="form-input" value={editingNode.nivel} onChange={(e) => setEditingNode({ ...editingNode, nivel: e.target.value as OrgNode['nivel'] })}>
                    <option value="Diretoria">Diretoria</option>
                    <option value="Gerencia">Gerência</option>
                    <option value="Supervisao">Supervisão / Coordenação</option>
                    <option value="Operacional">Operacional</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">Colaborador / Ocupante</label>
                  <input className="form-input" value={editingNode.colaborador} onChange={(e) => setEditingNode({ ...editingNode, colaborador: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Nº de Vagas</label>
                  <input type="number" min={1} className="form-input" value={editingNode.headcount} onChange={(e) => setEditingNode({ ...editingNode, headcount: Math.max(1, Number(e.target.value) || 1) })} />
                </div>
              </div>
              <div>
                <label className="form-label">Reporta para (Superior Imediato)</label>
                <select className="form-input" value={editingNode.parentId || ''} onChange={(e) => setEditingNode({ ...editingNode, parentId: e.target.value || null })}>
                  <option value="">Topo da Estrutura (Diretoria)</option>
                  {nodes.filter((n) => n.id !== editingNode.id).map((n) => (
                    <option key={n.id} value={n.id}>{n.cargo} ({n.setor})</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button onClick={() => setShowNodeModal(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={handleSaveNode} className="btn btn-primary">Salvar Cargo</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Descritivo */}
      {showDescModal && editingDesc && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Editar Descritivo de Função</h3>
              <button onClick={() => setShowDescModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label className="form-label">Função *</label>
                <input className="form-input" value={editingDesc.funcao} onChange={(e) => setEditingDesc({ ...editingDesc, funcao: e.target.value })} />
              </div>
              <div>
                <label className="form-label">CBO</label>
                <input className="form-input" value={editingDesc.cbo} onChange={(e) => setEditingDesc({ ...editingDesc, cbo: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Revisão</label>
                <input className="form-input" value={editingDesc.revisao} onChange={(e) => setEditingDesc({ ...editingDesc, revisao: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label className="form-label">Setor</label>
                <input className="form-input" value={editingDesc.setor} onChange={(e) => setEditingDesc({ ...editingDesc, setor: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Funcionário</label>
                <input className="form-input" value={editingDesc.nomeFuncionario} onChange={(e) => setEditingDesc({ ...editingDesc, nomeFuncionario: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Gestor Responsável</label>
                <input className="form-input" value={editingDesc.gestorResponsavel} onChange={(e) => setEditingDesc({ ...editingDesc, gestorResponsavel: e.target.value })} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Objetivo da Função</label>
              <textarea className="form-input" rows={2} value={editingDesc.objetivo} onChange={(e) => setEditingDesc({ ...editingDesc, objetivo: e.target.value })} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Perfil / Requisitos</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input
                  className="form-input"
                  placeholder="Ex: Ser organizado(a)"
                  value={reqInput}
                  onChange={(e) => setReqInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && reqInput.trim()) {
                      e.preventDefault();
                      setEditingDesc({ ...editingDesc, requisitos: [...editingDesc.requisitos, reqInput.trim()] });
                      setReqInput('');
                    }
                  }}
                />
                <button type="button" className="btn btn-secondary" onClick={() => {
                  if (reqInput.trim()) {
                    setEditingDesc({ ...editingDesc, requisitos: [...editingDesc.requisitos, reqInput.trim()] });
                    setReqInput('');
                  }
                }}>Adicionar</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {editingDesc.requisitos.map((r, idx) => (
                  <span key={idx} className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {r}
                    <button type="button" onClick={() => setEditingDesc({ ...editingDesc, requisitos: editingDesc.requisitos.filter((_, i) => i !== idx) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="form-label">Atividades Exercidas</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input
                  className="form-input"
                  placeholder="Descreva uma atividade da função..."
                  value={ativInput}
                  onChange={(e) => setAtivInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && ativInput.trim()) {
                      e.preventDefault();
                      setEditingDesc({ ...editingDesc, atividades: [...editingDesc.atividades, ativInput.trim()] });
                      setAtivInput('');
                    }
                  }}
                />
                <button type="button" className="btn btn-secondary" onClick={() => {
                  if (ativInput.trim()) {
                    setEditingDesc({ ...editingDesc, atividades: [...editingDesc.atividades, ativInput.trim()] });
                    setAtivInput('');
                  }
                }}>Adicionar</button>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
                {editingDesc.atividades.map((a, idx) => (
                  <li key={idx} style={{ marginBottom: 4 }}>
                    {a}{' '}
                    <button type="button" onClick={() => setEditingDesc({ ...editingDesc, atividades: editingDesc.atividades.filter((_, i) => i !== idx) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 12 }}>[remover]</button>
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button onClick={() => setShowDescModal(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={handleSaveDesc} className="btn btn-primary">Salvar Descritivo</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
