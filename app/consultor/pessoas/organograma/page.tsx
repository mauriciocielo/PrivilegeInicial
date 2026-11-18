'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ComercialExportBar from '@/components/ComercialExportBar';
import { store } from '@/lib/store';
import {
  Network, FileText, Plus, Edit3, Trash2, Printer, Users, Building2,
  ChevronRight, CheckCircle2, X, Briefcase, UserCheck, ShieldCheck
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
  Diretoria: { bg: '#eff6ff', border: '#3b82f6', badge: '#1d4ed8' },
  Gerencia: { bg: '#f0fdf4', border: '#22c55e', badge: '#15803d' },
  Supervisao: { bg: '#fefce8', border: '#eab308', badge: '#a16207' },
  Operacional: { bg: '#f8fafc', border: '#94a3b8', badge: '#475569' },
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

  // Modal Node
  const [editingNode, setEditingNode] = useState<OrgNode | null>(null);
  const [showNodeModal, setShowNodeModal] = useState(false);

  // Modal Descritivo
  const [editingDesc, setEditingDesc] = useState<DescritivoFuncao | null>(null);
  const [showDescModal, setShowDescModal] = useState(false);
  const [reqInput, setReqInput] = useState('');
  const [ativInput, setAtivInput] = useState('');

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async (empId: string) => {
    try {
      const res = await fetch(`/api/comercial?empresaId=${encodeURIComponent(empId)}`);
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
      // fallback default
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
          gap: '16px',
          marginTop: depth === 0 ? 0 : '18px',
          paddingTop: depth === 0 ? 0 : '14px',
          borderTop: depth === 0 ? 'none' : '2px dashed #cbd5e1',
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
                minWidth: '230px',
                maxWidth: hasChildren ? '100%' : '280px',
                flex: hasChildren ? '1 1 280px' : '0 1 260px',
              }}
            >
              <div
                style={{
                  width: '100%',
                  background: style.bg,
                  border: `1.5px solid ${style.border}`,
                  borderRadius: '12px',
                  padding: '12px 14px',
                  boxShadow: '0 2px 6px rgba(15, 23, 42, 0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: '#fff',
                      background: style.badge,
                      padding: '2px 8px',
                      borderRadius: '999px',
                    }}
                  >
                    {node.nivel} · {node.headcount} {node.headcount === 1 ? 'vaga' : 'vagas'}
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => openNewNode(node.id)}
                      title="Adicionar subordinado"
                      style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '3px 5px', cursor: 'pointer' }}
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      onClick={() => {
                        setEditingNode({ ...node });
                        setShowNodeModal(true);
                      }}
                      title="Editar"
                      style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '3px 5px', cursor: 'pointer' }}
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteNode(node.id)}
                      title="Remover"
                      style={{ background: '#fff', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '6px', padding: '3px 5px', cursor: 'pointer' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>{node.cargo}</div>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>{node.setor}</div>
                <div style={{ fontSize: '12px', color: '#1e293b', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 500 }}>
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
    <div style={{ padding: '24px 28px', maxWidth: '1400px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <Network size={24} color="#2563eb" />
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Organograma & Descritivo de Funções
              </h1>
            </div>
            <p style={{ color: '#64748b', fontSize: '13.5px', margin: 0 }}>
              Arquitetura de cargos, hierarquia organizacional e fichas assináveis de perfil de função (CBO, requisitos e atividades).
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {saving && <span style={{ fontSize: '12px', color: '#64748b' }}>Salvando...</span>}
            {!saving && lastSaved && (
              <span style={{ fontSize: '12px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={14} /> Salvo às {lastSaved}
              </span>
            )}
          </div>
        </div>

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

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', margin: '18px 0' }}>
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Briefcase size={15} color="#2563eb" /> Cargos Estruturados
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>{nodes.length}</div>
          </div>
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={15} color="#16a34a" /> Quadro Total (Vagas)
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>{totalHeadcount}</div>
          </div>
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building2 size={15} color="#eab308" /> Setores / Áreas
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>{setoresUnicos}</div>
          </div>
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={15} color="#7c3aed" /> Descritivos de Função
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>{descritivos.length}</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
          <button
            onClick={() => setTab('organograma')}
            className={tab === 'organograma' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Network size={16} /> Organograma Visual
          </button>
          <button
            onClick={() => setTab('descritivo')}
            className={tab === 'descritivo' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FileText size={16} /> Descritivo de Perfil de Função
          </button>
        </div>

        {tab === 'organograma' ? (
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Estrutura Hierárquica</h2>
                <p style={{ fontSize: '12.5px', color: '#64748b', margin: '2px 0 0' }}>
                  Clique em <strong>+</strong> dentro de qualquer cargo para adicionar um subordinado direto.
                </p>
              </div>
              <button onClick={() => openNewNode(null)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={16} /> Novo Cargo Raiz / Diretoria
              </button>
            </div>
            <div style={{ overflowX: 'auto', paddingBottom: '12px' }}>{renderTree(null)}</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '18px', alignItems: 'start' }}>
            {/* Sidebar de Descritivos */}
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <strong style={{ fontSize: '14px' }}>Funções ({descritivos.length})</strong>
                <button onClick={openNewDesc} className="btn btn-primary" style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Plus size={14} /> Nova
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {descritivos.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDescId(d.id)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: selectedDesc?.id === d.id ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                      background: selectedDesc?.id === d.id ? '#eff6ff' : '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{d.funcao}</div>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                        {d.setor} · CBO {d.cbo || '—'}
                      </div>
                    </div>
                    <ChevronRight size={15} color="#94a3b8" />
                  </button>
                ))}
              </div>
            </div>

            {/* Ficha Oficial Descritivo de Função */}
            {selectedDesc && (
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }} className="no-print">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={20} color="#2563eb" />
                    <strong style={{ fontSize: '16px' }}>Ficha Oficial — Descrição de Perfil de Função</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => window.print()}
                      className="btn btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
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
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Edit3 size={15} /> Editar Ficha
                    </button>
                    {descritivos.length > 1 && (
                      <button
                        onClick={() => handleDeleteDesc(selectedDesc.id)}
                        className="btn btn-secondary"
                        style={{ color: '#dc2626', borderColor: '#fecaca' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Cabeçalho da Ficha */}
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ background: '#0f172a', color: '#fff', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.75 }}>
                        Descrição de Perfil de Função
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 800 }}>{selectedDesc.funcao}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                      <div><strong>CBO:</strong> {selectedDesc.cbo || '—'}</div>
                      <div><strong>Revisão:</strong> {selectedDesc.revisao || '01'}</div>
                      <div><strong>Data:</strong> {selectedDesc.data || '—'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', padding: '16px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Setor a que se aplica</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{selectedDesc.setor}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Nome do Funcionário</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{selectedDesc.nomeFuncionario || 'A definir'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Gestor Responsável</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{selectedDesc.gestorResponsavel || '—'}</div>
                    </div>
                  </div>

                  <div style={{ padding: '16px 18px', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Objetivo da Função
                    </div>
                    <p style={{ margin: 0, fontSize: '13.5px', color: '#334155', lineHeight: 1.55 }}>{selectedDesc.objetivo}</p>
                  </div>

                  <div style={{ padding: '16px 18px', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Perfil / Requisitos Comportamentais e Técnicos
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {selectedDesc.requisitos.map((req, i) => (
                        <span
                          key={i}
                          style={{
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            padding: '5px 12px',
                            borderRadius: '999px',
                            fontSize: '12.5px',
                            fontWeight: 600,
                          }}
                        >
                          {req}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ padding: '16px 18px', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Função — Descrição das Atividades Exercidas
                    </div>
                    <ol style={{ margin: 0, paddingLeft: '20px', color: '#334155', fontSize: '13.5px', lineHeight: 1.7 }}>
                      {selectedDesc.atividades.map((at, i) => (
                        <li key={i}>{at}</li>
                      ))}
                    </ol>
                  </div>

                  {/* Assinaturas */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', padding: '32px 24px 20px', background: '#fff' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ borderTop: '1px solid #475569', paddingTop: '8px', fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                        Assinatura do Colaborador
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ borderTop: '1px solid #475569', paddingTop: '8px', fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                        Assinatura do Supervisor / Gestor
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Node */}
        {showNodeModal && editingNode && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
            <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>Cargo no Organograma</h3>
                <button onClick={() => setShowNodeModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="form-label">Nome do Cargo *</label>
                  <input className="form-input" value={editingNode.cargo} onChange={(e) => setEditingNode({ ...editingNode, cargo: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label className="form-label">Setor</label>
                    <input className="form-input" value={editingNode.setor} onChange={(e) => setEditingNode({ ...editingNode, setor: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label">Nível Hierárquico</label>
                    <select
                      className="form-input"
                      value={editingNode.nivel}
                      onChange={(e) => setEditingNode({ ...editingNode, nivel: e.target.value as OrgNode['nivel'] })}
                    >
                      <option value="Diretoria">Diretoria</option>
                      <option value="Gerencia">Gerência</option>
                      <option value="Supervisao">Supervisão / Coordenação</option>
                      <option value="Operacional">Operacional</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                  <div>
                    <label className="form-label">Colaborador / Ocupante</label>
                    <input className="form-input" value={editingNode.colaborador} onChange={(e) => setEditingNode({ ...editingNode, colaborador: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label">Nº de Vagas</label>
                    <input
                      type="number"
                      min={1}
                      className="form-input"
                      value={editingNode.headcount}
                      onChange={(e) => setEditingNode({ ...editingNode, headcount: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </div>
                </div>
                <div>
                  <label className="form-label">Reporta para (Superior Imediato)</label>
                  <select
                    className="form-input"
                    value={editingNode.parentId || ''}
                    onChange={(e) => setEditingNode({ ...editingNode, parentId: e.target.value || null })}
                  >
                    <option value="">Topo da Estrutura (Diretoria)</option>
                    {nodes
                      .filter((n) => n.id !== editingNode.id)
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.cargo} ({n.setor})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
                <button onClick={() => setShowNodeModal(false)} className="btn btn-secondary">Cancelar</button>
                <button onClick={handleSaveNode} className="btn btn-primary">Salvar Cargo</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Descritivo */}
        {showDescModal && editingDesc && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
            <div className="card" style={{ width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', padding: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>Editar Descritivo de Função</h3>
                <button onClick={() => setShowDescModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
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
              <div style={{ marginBottom: '12px' }}>
                <label className="form-label">Objetivo da Função</label>
                <textarea className="form-input" rows={2} value={editingDesc.objetivo} onChange={(e) => setEditingDesc({ ...editingDesc, objetivo: e.target.value })} />
              </div>

              {/* Requisitos */}
              <div style={{ marginBottom: '12px' }}>
                <label className="form-label">Perfil / Requisitos</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
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
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      if (reqInput.trim()) {
                        setEditingDesc({ ...editingDesc, requisitos: [...editingDesc.requisitos, reqInput.trim()] });
                        setReqInput('');
                      }
                    }}
                  >
                    Adicionar
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {editingDesc.requisitos.map((r, idx) => (
                    <span key={idx} style={{ background: '#eff6ff', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {r}
                      <button
                        type="button"
                        onClick={() => setEditingDesc({ ...editingDesc, requisitos: editingDesc.requisitos.filter((_, i) => i !== idx) })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 0 }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Atividades */}
              <div>
                <label className="form-label">Atividades Exercidas</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
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
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      if (ativInput.trim()) {
                        setEditingDesc({ ...editingDesc, atividades: [...editingDesc.atividades, ativInput.trim()] });
                        setAtivInput('');
                      }
                    }}
                  >
                    Adicionar
                  </button>
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px' }}>
                  {editingDesc.atividades.map((a, idx) => (
                    <li key={idx} style={{ marginBottom: '4px' }}>
                      {a}{' '}
                      <button
                        type="button"
                        onClick={() => setEditingDesc({ ...editingDesc, atividades: editingDesc.atividades.filter((_, i) => i !== idx) })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '12px' }}
                      >
                        [remover]
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
                <button onClick={() => setShowDescModal(false)} className="btn btn-secondary">Cancelar</button>
                <button onClick={handleSaveDesc} className="btn btn-primary">Salvar Descritivo</button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
