'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GitBranch, Compass, Target, Save, Plus, Trash2, Sparkles, Globe, Edit3 } from 'lucide-react';
import { store } from '@/lib/store';
import { toast } from 'sonner';
import ComercialExportBar from '@/components/ComercialExportBar';

interface MktMilestone {
  id: string;
  windowDays: string;
  title: string;
  owner: string;
  status: 'pendente' | 'em_andamento' | 'concluido';
  deliverable: string;
}

const DEFAULT_MKT_MILESTONES: MktMilestone[] = [
  { id: 'm1', windowDays: '0 - 15 dias', title: '1. Análise da Empresa', owner: 'Consultoria + Diretoria', status: 'concluido', deliverable: 'Levantamento de histórico, produtos, margens e estrutura atual.' },
  { id: 'm2', windowDays: '15 - 30 dias', title: '2. Diagnóstico de Precisão (SWOT & Canais)', owner: 'Consultoria MKT', status: 'em_andamento', deliverable: 'Análise financeira do marketing, Matriz SWOT cruzada e auditoria de canais.' },
  { id: 'm3', windowDays: '30 - 45 dias', title: '3. Fluxograma & Jornada do Cliente', owner: 'Consultoria MKT', status: 'pendente', deliverable: 'Desenho do funil de atração, conversão e retenção.' },
  { id: 'm4', windowDays: '45 - 60 dias', title: '4. Pesquisa de Comunicação', owner: 'Marketing', status: 'pendente', deliverable: 'Percepção de marca, linguagem do público-alvo e objeções.' },
  { id: 'm5', windowDays: '60 - 75 dias', title: '5. Posicionamento (ICP & Grande Promessa)', owner: 'Diretoria + MKT', status: 'pendente', deliverable: 'Definição de ICP, Big Idea e diferenciação frente à concorrência.' },
  { id: 'm6', windowDays: '75 - 90 dias', title: '6. Treinamento Criação de Conteúdo', owner: 'Equipe MKT', status: 'pendente', deliverable: 'Linhas editoriais, roteiros e calendário de publicações.' },
  { id: 'm7', windowDays: '90 - 105 dias', title: '7. Estruturação do Orçamento de Marketing', owner: 'Financeiro + MKT', status: 'pendente', deliverable: 'Definição de verba mensal por canal, meta de CPL e ROI.' },
  { id: 'm8', windowDays: '105 - 120 dias', title: '8. Calendário de Eventos & Campanhas', owner: 'Marketing + Comercial', status: 'pendente', deliverable: 'Datas sazonais, ações promocionais e feiras/eventos.' },
  { id: 'm9', windowDays: '120 - 135 dias', title: '9. Treinamento de Impulsionamento (Tráfego)', owner: 'Gestor de Tráfego', status: 'pendente', deliverable: 'Meta Ads, Google Ads, segmentação e leitura de métricas.' },
  { id: 'm10', windowDays: '135 - 150 dias', title: '10. Estratégias de Vendas Online', owner: 'MKT + Comercial', status: 'pendente', deliverable: 'Landing pages, WhatsApp integrado, automação e recuperação de leads.' },
  { id: 'm11', windowDays: '150 - 165 dias', title: '11. Produção de Vídeos e Fotos', owner: 'Audiovisual / Equipe', status: 'pendente', deliverable: 'Banco de criativos, reels, provas sociais e fotos institucionais.' },
  { id: 'm12', windowDays: '150 - 180 dias', title: '12. Processo de Execução 360 MKT', owner: 'Toda a Equipe', status: 'pendente', deliverable: 'Operação contínua com check-in semanal, relatório mensal e foco em ROI.' },
];

export default function MarketingFluxogramaPage() {
  const [empresaId, setEmpresaId] = useState('default');
  const [milestones, setMilestones] = useState<MktMilestone[]>(DEFAULT_MKT_MILESTONES);
  const [diagnostico, setDiagnostico] = useState({
    icp: '',
    bigIdea: '',
    canaisAtivos: '',
    forcas: '',
    oportunidades: '',
    gargalos: '',
  });
  const [links, setLinks] = useState({
    site: '',
    ecommerce: '',
    instagram: '',
    facebook: '',
    google: '',
    linkedin: '',
  });
  const [aiAudit, setAiAudit] = useState<any>(null);
  const [auditingAi, setAuditingAi] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<MktMilestone | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    const emp = store.getSafeEmpresaId() || 'default';
    setEmpresaId(emp);
    fetch(`/api/comercial?empresaId=${encodeURIComponent(emp)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.mkt_fluxograma) {
          if (Array.isArray(d.data.mkt_fluxograma.milestones) && d.data.mkt_fluxograma.milestones.length > 0) {
            setMilestones(d.data.mkt_fluxograma.milestones);
          }
          if (d.data.mkt_fluxograma.diagnostico) {
            setDiagnostico(d.data.mkt_fluxograma.diagnostico);
          }
          if (d.data.mkt_fluxograma.links) {
            setLinks(prev => ({ ...prev, ...d.data.mkt_fluxograma.links }));
          }
          if (d.data.mkt_fluxograma.aiAudit) {
            setAiAudit(d.data.mkt_fluxograma.aiAudit);
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
          sectionKey: 'mkt_fluxograma',
          value: { milestones, diagnostico, links, aiAudit },
        }),
      }).catch(() => {});
    }, 1000);
    return () => clearTimeout(t);
  }, [milestones, diagnostico, links, aiAudit, empresaId]);

  const stats = useMemo(() => {
    const total = milestones.length;
    const done = milestones.filter(m => m.status === 'concluido').length;
    const doing = milestones.filter(m => m.status === 'em_andamento').length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, doing, pct };
  }, [milestones]);

  async function handleAnalyzeChannels() {
    if (auditingAi) return;
    const hasAny = Object.values(links).some(v => String(v || '').trim() !== '');
    if (!hasAny) {
      toast.error('Informe pelo menos 1 link ou @ de canal para o Gemini analisar.');
      return;
    }
    setAuditingAi(true);
    try {
      const empObj = store.getEmpresas().find(e => e.id === empresaId);
      const res = await fetch('/api/marketing/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId,
          empresaNome: empObj?.nomeFantasia || empObj?.razaoSocial || 'Empresa',
          links,
        }),
      });
      const d = await res.json();
      if (d.success && d.audit) {
        setAiAudit(d.audit);
        toast.success('Auditoria Digital 360º concluída e salva no banco!');
      } else {
        toast.error(d.error || 'Erro ao analisar canais.');
      }
    } catch {
      toast.error('Falha ao conectar com a IA.');
    } finally {
      setAuditingAi(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/comercial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId,
          sectionKey: 'mkt_fluxograma',
          value: { milestones, diagnostico, links, aiAudit },
        }),
      });
      const d = await res.json();
      if (d.success) toast.success('Fluxograma e Diagnóstico MKT salvos!');
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
            Fluxograma Geral Marketing (360 MKT · 180 Dias)
          </div>
          <div className="page-subtitle">
            Diagnóstico de precisão, engenharia de posicionamento (ICP &amp; Big Idea) e execução 360º de Marketing.
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            onClick={() =>
              setMilestones(prev => [
                ...prev,
                { id: `m_${Date.now()}`, windowDays: 'Personalizado', title: 'Nova Etapa MKT', owner: 'Marketing', status: 'pendente', deliverable: '' },
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
        title="Fluxograma Geral Marketing (360 MKT)"
        fileNameBase="marketing_fluxograma_360"
        kpis={[
          { label: 'Progresso 360 MKT', value: `${stats.pct}% (${stats.done}/${stats.total} etapas)` },
          { label: 'Em Andamento', value: String(stats.doing) },
        ]}
        columns={[
          { header: 'Janela', key: 'windowDays' },
          { header: 'Etapa', key: 'title' },
          { header: 'Responsável', key: 'owner' },
          { header: 'Status', key: 'status' },
          { header: 'Entregável', key: 'deliverable' },
        ]}
        rows={milestones}
      />

      {/* Progresso */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14.5, fontWeight: 700 }}>
          <span>Evolução do Fluxograma 360 MKT (150 a 180 dias)</span>
          <span style={{ color: 'var(--accent)' }}>{stats.done} concluídas · {stats.doing} em andamento · {stats.pct}%</span>
        </div>
        <div style={{ height: 10, borderRadius: 999, background: 'var(--bg-card2)', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{ width: `${stats.pct}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {/* Auditoria Digital 360º com IA (Gemini) */}
      <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Globe size={18} color="var(--accent)" /> Auditoria Digital 360º com IA (Gemini)
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '3px 0 0' }}>
              Cole os links dos canais da empresa (Site, E-commerce, Instagram, Facebook, Google e LinkedIn) para o Gemini analisar posicionamento, conversão e oportunidades.
            </p>
          </div>
          <button
            type="button"
            disabled={auditingAi}
            onClick={handleAnalyzeChannels}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14.5 }}
          >
            <Sparkles size={15} /> {auditingAi ? 'Analisando canais com Gemini...' : 'Analisar Canais com IA'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
          <div>
            <label className="form-label">Site Próprio</label>
            <input className="form-control" placeholder="https://www.empresa.com.br" value={links.site} onChange={e => setLinks(l => ({ ...l, site: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">E-commerce / Loja Virtual</label>
            <input className="form-control" placeholder="https://loja.empresa.com.br" value={links.ecommerce} onChange={e => setLinks(l => ({ ...l, ecommerce: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">Instagram</label>
            <input className="form-control" placeholder="https://instagram.com/empresa" value={links.instagram} onChange={e => setLinks(l => ({ ...l, instagram: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">Facebook</label>
            <input className="form-control" placeholder="https://facebook.com/empresa" value={links.facebook} onChange={e => setLinks(l => ({ ...l, facebook: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">Google / Perfil da Empresa</label>
            <input className="form-control" placeholder="Link do Google Maps / Busca" value={links.google} onChange={e => setLinks(l => ({ ...l, google: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">LinkedIn</label>
            <input className="form-control" placeholder="https://linkedin.com/company/empresa" value={links.linkedin} onChange={e => setLinks(l => ({ ...l, linkedin: e.target.value }))} />
          </div>
        </div>

        {aiAudit && (
          <div style={{ marginTop: 6, padding: 16, borderRadius: 14, background: 'var(--bg-card2)', border: '1px solid var(--accent-border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ padding: '6px 14px', borderRadius: 999, background: 'var(--accent)', color: '#fff', fontWeight: 900, fontSize: 15 }}>
                  Score Digital: {aiAudit.score ?? 70}/100
                </div>
                <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                  Análise gerada pelo Gemini {aiAudit.analyzedAt ? `em ${new Date(aiAudit.analyzedAt).toLocaleString('pt-BR')}` : ''}
                </span>
              </div>
              {(aiAudit.icpSugerido || aiAudit.bigIdeaSugerida) && (
                <button
                  type="button"
                  onClick={() => {
                    setDiagnostico(d => ({
                      ...d,
                      icp: aiAudit.icpSugerido || d.icp,
                      bigIdea: aiAudit.bigIdeaSugerida || d.bigIdea,
                      gargalos: aiAudit.gargalosPrincipais || d.gargalos,
                    }));
                    toast.success('Sugestões aplicadas no Diagnóstico de Posicionamento!');
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: 14 }}
                >
                  Aplicar ICP &amp; Big Idea no Diagnóstico
                </button>
              )}
            </div>

            {aiAudit.resumoExecutivo && (
              <div style={{ fontSize: 14.5, lineHeight: 1.5 }}>{aiAudit.resumoExecutivo}</div>
            )}

            {Array.isArray(aiAudit.canais) && aiAudit.canais.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                {aiAudit.canais.map((c: any, i: number) => (
                  <div key={i} style={{ padding: 12, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <strong style={{ fontSize: 14.5 }}>{c.canal}</strong>
                      <span style={{ fontSize: 13, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--accent-glow)', color: 'var(--accent)' }}>
                        {c.situacao}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 4 }}>
                      <strong>Pontos fortes:</strong> {c.pontosFortes}
                    </div>
                    <div style={{ fontSize: 14 }}>
                      <strong>Melhorias:</strong> {c.melhorias}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {Array.isArray(aiAudit.planoImediato) && aiAudit.planoImediato.length > 0 && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4, color: 'var(--accent)' }}>Ações Imediatas (7 dias):</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
                  {aiAudit.planoImediato.map((item: string, idx: number) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Diagnóstico de Precisão + Posicionamento (ICP & Big Idea) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={17} color="var(--accent)" /> Engenharia de Posicionamento
          </h3>
          <div>
            <label className="form-label">ICP (Perfil de Cliente Ideal: Dores e Desejos)</label>
            <textarea rows={2} className="form-control" placeholder="Quem compra, porte, dores principais e desejos..." value={diagnostico.icp} onChange={e => setDiagnostico(d => ({ ...d, icp: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">A Grande Promessa (Big Idea &amp; Diferenciação)</label>
            <textarea rows={2} className="form-control" placeholder="Por que o cliente deve escolher a empresa?" value={diagnostico.bigIdea} onChange={e => setDiagnostico(d => ({ ...d, bigIdea: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">Ecossistema de Canais (Atração &amp; Conversão)</label>
            <input className="form-control" placeholder="Ex: Google Ads, Instagram, WhatsApp, Indicações..." value={diagnostico.canaisAtivos} onChange={e => setDiagnostico(d => ({ ...d, canaisAtivos: e.target.value }))} />
          </div>
        </div>

        <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Compass size={17} color="var(--accent)" /> Diagnóstico de Precisão (SWOT &amp; Gargalos)
          </h3>
          <div>
            <label className="form-label">Forças Internas da Marca</label>
            <textarea rows={2} className="form-control" placeholder="Autoridade, carteira, qualidade, localização..." value={diagnostico.forcas} onChange={e => setDiagnostico(d => ({ ...d, forcas: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">Oportunidades de Mercado</label>
            <textarea rows={2} className="form-control" placeholder="Nichos pouco explorados, novos canais, parcerias..." value={diagnostico.oportunidades} onChange={e => setDiagnostico(d => ({ ...d, oportunidades: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">Gargalos Atuais nos Canais</label>
            <input className="form-control" placeholder="Onde o funil perde leads ou dinheiro hoje?" value={diagnostico.gargalos} onChange={e => setDiagnostico(d => ({ ...d, gargalos: e.target.value }))} />
          </div>
        </div>
      </div>

      {/* Tabela das 12 etapas */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Cronograma das 12 Etapas do Fluxograma Geral Marketing</h3>
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{milestones.length} etapas</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Janela</th>
                <th>Etapa</th>
                <th>Responsável</th>
                <th>Status</th>
                <th>Entregável / Definições</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((m, idx) => (
                <tr key={m.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
                      {m.windowDays}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--text-primary)', minWidth: 200 }}>{m.title}</td>
                  <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{m.owner}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <select
                      value={m.status}
                      onChange={e => setMilestones(prev => prev.map((x, i) => (i === idx ? { ...x, status: e.target.value as any } : x)))}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: 13.5,
                        fontWeight: 700,
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        background: m.status === 'concluido' ? 'var(--green-bg)' : m.status === 'em_andamento' ? 'var(--yellow-bg)' : 'var(--bg-card2)',
                        color: m.status === 'concluido' ? 'var(--green)' : m.status === 'em_andamento' ? 'var(--yellow)' : 'var(--text-secondary)',
                      }}
                    >
                      <option value="pendente">Pendente</option>
                      <option value="em_andamento">Em Andamento</option>
                      <option value="concluido">Concluído</option>
                    </select>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', lineHeight: 1.45, minWidth: 260 }}>{m.deliverable}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button type="button" onClick={() => setEditingMilestone({ ...m })} className="btn btn-secondary btn-sm">
                        <Edit3 size={13} /> Editar
                      </button>
                      <button type="button" onClick={() => setMilestones(prev => prev.filter((_, i) => i !== idx))} className="btn btn-secondary btn-sm" style={{ color: 'var(--red)' }}>
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

      {editingMilestone && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 540, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Editar Etapa de Marketing</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label className="form-label">Janela</label>
                <input className="form-control" style={{ width: '100%' }} value={editingMilestone.windowDays} onChange={e => setEditingMilestone(m => m ? { ...m, windowDays: e.target.value } : null)} />
              </div>
              <div>
                <label className="form-label">Responsável</label>
                <input className="form-control" style={{ width: '100%' }} value={editingMilestone.owner} onChange={e => setEditingMilestone(m => m ? { ...m, owner: e.target.value } : null)} />
              </div>
            </div>
            <div>
              <label className="form-label">Título da Etapa</label>
              <input className="form-control" style={{ width: '100%' }} value={editingMilestone.title} onChange={e => setEditingMilestone(m => m ? { ...m, title: e.target.value } : null)} />
            </div>
            <div>
              <label className="form-label">Entregável / Definições</label>
              <textarea rows={4} className="form-control" style={{ width: '100%' }} value={editingMilestone.deliverable} onChange={e => setEditingMilestone(m => m ? { ...m, deliverable: e.target.value } : null)} />
            </div>
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
      </div>
    </>
  );
}
