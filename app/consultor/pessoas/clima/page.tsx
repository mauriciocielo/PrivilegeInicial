'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ComercialExportBar from '@/components/ComercialExportBar';
import { store } from '@/lib/store';
import { toast } from 'sonner';
import { redirectToWhatsAppShare } from '@/lib/whatsapp-share';
import {
  SmilePlus, BarChart3, ClipboardList, Table2, CheckCircle2, Plus, Trash2,
  Award, AlertTriangle, FileText, Link2, Copy, ExternalLink, MessageSquare, Smartphone
} from 'lucide-react';

interface ClimaQuestion {
  id: number;
  categoria: string;
  texto: string;
}

interface ClimaResponse {
  id: string;
  respondente: string;
  setor: string;
  data: string;
  notas: Record<number, number>;
}

const CATEGORIAS = [
  'Ambiente e Estrutura',
  'Comportamento',
  'Desenvolvimento Profissional',
  'Gestão e Liderança',
  'Imagem da Empresa',
  'Remuneração e Beneficios',
  'Cultura',
];

const DEFAULT_QUESTIONS: ClimaQuestion[] = [
  { id: 1, categoria: 'Ambiente e Estrutura', texto: 'A infraestrutura para seu trabalho é adequada (equipamentos, maquinário, mobiliaria)?' },
  { id: 2, categoria: 'Ambiente e Estrutura', texto: 'A carga horária do trabalho está adequada para realizar os trabalhos com qualidade?' },
  { id: 3, categoria: 'Ambiente e Estrutura', texto: 'A infraestrutura para comodidade e conforto (refeitório, descanso, higiene) é adequada?' },
  { id: 4, categoria: 'Ambiente e Estrutura', texto: 'Os objetivos e metas da empresa estão claros para mim?' },
  { id: 5, categoria: 'Ambiente e Estrutura', texto: 'Sei claramente quais são as metas/objetivos da minha área?' },
  { id: 6, categoria: 'Comportamento', texto: 'Você possui uma relação de fácil comunicação com sua equipe de trabalho?' },
  { id: 7, categoria: 'Comportamento', texto: 'Você possui uma relação de fácil comunicação com outros departamentos/setores?' },
  { id: 8, categoria: 'Comportamento', texto: 'É tratado de forma respeitosa pelos colegas de trabalho?' },
  { id: 9, categoria: 'Comportamento', texto: 'Você se sente estimulado para o trabalho em equipe?' },
  { id: 10, categoria: 'Comportamento', texto: 'Durante seu dia de trabalho você está 100% focado em suas atividades?' },
  { id: 11, categoria: 'Comportamento', texto: 'Durante seu dia de trabalho há distrações? (Uso de celular / conversas / brincadeiras)' },
  { id: 12, categoria: 'Desenvolvimento Profissional', texto: 'As promoções e reconhecimento que acontecem na empresa são justas e bem fundamentadas?' },
  { id: 13, categoria: 'Desenvolvimento Profissional', texto: 'Seu potencial de trabalho está sendo aproveitado de forma adequada na sua área?' },
  { id: 14, categoria: 'Desenvolvimento Profissional', texto: 'Suas sugestões são avaliadas pelo seu gestor?' },
  { id: 15, categoria: 'Desenvolvimento Profissional', texto: 'Você visualiza oportunidades de crescimento profissional na empresa?' },
  { id: 16, categoria: 'Desenvolvimento Profissional', texto: 'Sente prazer pelo trabalho que faz?' },
  { id: 17, categoria: 'Desenvolvimento Profissional', texto: 'A empresa oferece um treinamento adequado quando necessário?' },
  { id: 18, categoria: 'Desenvolvimento Profissional', texto: 'Recebe elogios pelo seu trabalho?' },
  { id: 19, categoria: 'Desenvolvimento Profissional', texto: 'Você tem oportunidade de aprendizado e desenvolvimento profissional na empresa?' },
  { id: 20, categoria: 'Desenvolvimento Profissional', texto: 'Você é realizado profissionalmente com o cargo?' },
  { id: 21, categoria: 'Gestão e Liderança', texto: 'Meu gestor direto mostra-se próximo e preocupado com o bem estar do time?' },
  { id: 22, categoria: 'Gestão e Liderança', texto: 'Você tem uma boa comunicação com seu gestor?' },
  { id: 23, categoria: 'Gestão e Liderança', texto: 'Seu gestor possui as competências necessárias para a função?' },
  { id: 24, categoria: 'Gestão e Liderança', texto: 'Confia que as decisões tomadas pelo gestor direto são adequadas para alcançar o resultado proposto?' },
  { id: 25, categoria: 'Gestão e Liderança', texto: 'Meu gestor direto fornece o direcionamento necessário para que eu realize meu trabalho da melhor forma?' },
  { id: 26, categoria: 'Gestão e Liderança', texto: 'Sinto segurança em falar sobre erros, dificuldades e frustrações relacionadas ao trabalho com meu líder?' },
  { id: 27, categoria: 'Gestão e Liderança', texto: 'Seu desempenho profissional é avaliado de forma adequada?' },
  { id: 28, categoria: 'Imagem da Empresa', texto: 'A empresa oferece ótimas soluções para seus clientes?' },
  { id: 29, categoria: 'Imagem da Empresa', texto: 'Sente seguro em relação a estabilidade no emprego?' },
  { id: 30, categoria: 'Imagem da Empresa', texto: 'Indicaria um amigo para trabalhar na empresa?' },
  { id: 31, categoria: 'Imagem da Empresa', texto: 'A empresa é um bom lugar para trabalhar?' },
  { id: 32, categoria: 'Remuneração e Beneficios', texto: 'Os benefícios oferecidos estão compatíveis com suas necessidades pessoais?' },
  { id: 33, categoria: 'Remuneração e Beneficios', texto: 'Sua remuneração atende suas necessidades pessoais?' },
  { id: 34, categoria: 'Remuneração e Beneficios', texto: 'Minhas responsabilidades estão alinhadas com minha remuneração (salário)?' },
  { id: 35, categoria: 'Cultura', texto: 'Acredito que o propósito e valores da empresa estão alinhados com os meus?' },
  { id: 36, categoria: 'Cultura', texto: 'Penso que não existe diferença entre o discurso e prática na empresa?' },
  { id: 37, categoria: 'Cultura', texto: 'Há um grande empenho de todos da empresa para se ajudar para atingir o resultado coletivo?' },
  { id: 38, categoria: 'Cultura', texto: 'Considero que de modo geral as pessoas desta empresa têm um bom relacionamento entre si?' },
  { id: 39, categoria: 'Cultura', texto: 'A empresa desenvolve ações com o objetivo de proporcionar o bem estar das pessoas?' },
];

const buildDefaultResponses = (): ClimaResponse[] => {
  const mk = (id: string, nome: string, setor: string, base: number, shift: number): ClimaResponse => {
    const notas: Record<number, number> = {};
    DEFAULT_QUESTIONS.forEach((q, idx) => {
      const val = Math.max(2, Math.min(10, base + ((idx + shift) % 4) - 1));
      notas[q.id] = q.categoria === 'Remuneração e Beneficios' ? Math.max(3, val - 2) : val;
    });
    return { id, respondente: nome, setor, data: new Date().toISOString().slice(0, 10), notas };
  };
  return [
    mk('resp-1', 'Pessoa 1 (Exemplo)', 'Comercial', 8, 1),
    mk('resp-2', 'Pessoa 2 (Exemplo)', 'Administrativo', 7, 2),
    mk('resp-3', 'Pessoa 3 (Exemplo)', 'Operações', 9, 0),
  ];
};

export default function PessoasClimaPage() {
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState('default');
  const [origin, setOrigin] = useState('');

  const [tab, setTab] = useState<'analise' | 'aplicar' | 'tabulacao' | 'parecer'>('analise');
  const [questions, setQuestions] = useState<ClimaQuestion[]>(DEFAULT_QUESTIONS);
  const [responses, setResponses] = useState<ClimaResponse[]>(buildDefaultResponses);
  const [parecer, setParecer] = useState<string>(
    'Parecer Executivo de Clima Organizacional:\n\n1. Pontos Fortes Identificados:\n- Relacionamento interpessoal entre equipes e clareza no propósito da empresa.\n\n2. Pontos de Atenção (Notas < 7):\n- Alinhamento de remuneração/benefícios e clareza nos critérios de promoção e reconhecimento.\n\n3. Plano de Ação 30/60/90 dias:\n- Implantar feedback estruturado mensal entre lideranças e equipe.\n- Revisar política de benefícios e plano de carreira.'
  );

  const [formNome, setFormNome] = useState('Respondente Anônimo');
  const [formSetor, setFormSetor] = useState('Geral');
  const [formNotas, setFormNotas] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {};
    DEFAULT_QUESTIONS.forEach((q) => { init[q.id] = 8; });
    return init;
  });

  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async (empId: string) => {
    try {
      const res = await fetch(`/api/comercial?empresaId=${encodeURIComponent(empId)}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success && json.data?.pessoas_clima) {
        const d = json.data.pessoas_clima;
        if (Array.isArray(d.questions) && d.questions.length > 0) setQuestions(d.questions);
        if (Array.isArray(d.responses)) setResponses(d.responses);
        if (typeof d.parecer === 'string' && d.parecer.trim()) setParecer(d.parecer);
      }
    } catch {
      // default
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const emp = store.getSafeEmpresaId() || 'default';
    setEmpresaId(emp);
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
    loadData(emp);
  }, [loadData]);

  const persist = useCallback(
    (nextQ: ClimaQuestion[], nextR: ClimaResponse[], nextP: string) => {
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
              sectionKey: 'pessoas_clima',
              value: { questions: nextQ, responses: nextR, parecer: nextP },
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

  const publicSurveyUrl = `${origin || ''}/clima?empresaId=${encodeURIComponent(empresaId)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicSurveyUrl);
      toast.success('Link da pesquisa copiado! Envie para os colaboradores responderem pelo celular ou computador.');
    } catch {
      toast.error('Não foi possível copiar automaticamente.');
    }
  };

  const handleShareWhatsApp = () => {
    const msg = `Olá! Convidamos você a responder nossa *Pesquisa de Clima Organizacional*.\n\nÉ rápido, seguro e pode ser respondido pelo celular ou computador:\n${publicSurveyUrl}`;
    redirectToWhatsAppShare({ text: msg }, (url) => router.push(url));
  };

  const stats = useMemo(() => {
    const allScores: number[] = [];
    responses.forEach((r) => {
      questions.forEach((q) => {
        const v = r.notas[q.id];
        if (typeof v === 'number') allScores.push(v);
      });
    });
    const totalRespostas = allScores.length;
    const mediaGeral = totalRespostas ? allScores.reduce((a, b) => a + b, 0) / totalRespostas : 0;
    const promotores = allScores.filter((s) => s >= 9).length;
    const passivos = allScores.filter((s) => s >= 7 && s <= 8).length;
    const detratores = allScores.filter((s) => s <= 6).length;
    const enps = totalRespostas ? Math.round(((promotores - detratores) / totalRespostas) * 100) : 0;

    const porCategoria = CATEGORIAS.map((cat) => {
      const qs = questions.filter((q) => q.categoria === cat);
      const vals: number[] = [];
      responses.forEach((r) => {
        qs.forEach((q) => {
          const v = r.notas[q.id];
          if (typeof v === 'number') vals.push(v);
        });
      });
      const media = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      const pctMax = (media / 10) * 100;
      const prom = vals.length ? (vals.filter((v) => v >= 9).length / vals.length) * 100 : 0;
      const pass = vals.length ? (vals.filter((v) => v >= 7 && v <= 8).length / vals.length) * 100 : 0;
      const detr = vals.length ? (vals.filter((v) => v <= 6).length / vals.length) * 100 : 0;
      return { categoria: cat, media, pctMax, prom, pass, detr, count: qs.length };
    });

    const porPergunta = questions.map((q) => {
      const vals = responses.map((r) => r.notas[q.id]).filter((v): v is number => typeof v === 'number');
      const media = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return { ...q, media };
    });

    const sortedDesc = [...porPergunta].sort((a, b) => b.media - a.media);
    const top10Melhores = sortedDesc.slice(0, 10);
    const top10Piores = [...porPergunta].sort((a, b) => a.media - b.media).slice(0, 10);

    return { mediaGeral, promotores, passivos, detratores, totalRespostas, enps, porCategoria, top10Melhores, top10Piores };
  }, [questions, responses]);

  const handleSubmitSurvey = (e: React.FormEvent) => {
    e.preventDefault();
    const novo: ClimaResponse = {
      id: `resp-${Date.now()}`,
      respondente: formNome.trim() || `Pessoa ${responses.length + 1}`,
      setor: formSetor.trim() || 'Geral',
      data: new Date().toISOString().slice(0, 10),
      notas: { ...formNotas },
    };
    const nextR = [...responses, novo];
    setResponses(nextR);
    persist(questions, nextR, parecer);
    setFormNome(`Pessoa ${nextR.length + 1}`);
    toast.success('Resposta registrada na tabulação!');
    setTab('analise');
  };

  const handleDeleteResponse = (id: string) => {
    const nextR = responses.filter((r) => r.id !== id);
    setResponses(nextR);
    persist(questions, nextR, parecer);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SmilePlus size={26} color="var(--accent)" />
            Pesquisa de Clima Organizacional
          </div>
          <div className="page-subtitle">
            39 indicadores em 7 dimensões, link público para colaboradores (celular/computador), eNPS interno, Top 10 e parecer executivo.
          </div>
        </div>
        <div className="header-actions">
          {saving && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Salvando...</span>}
          {!saving && lastSaved && (
            <span style={{ fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle2 size={14} /> Salvo às {lastSaved}
            </span>
          )}
          <button type="button" onClick={handleCopyLink} className="btn btn-primary">
            <Link2 size={15} /> Copiar Link dos Colaboradores
          </button>
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <ComercialExportBar
          title="Relatório de Pesquisa de Clima Organizacional"
          fileNameBase="pesquisa-clima-organizacional"
          kpis={[
            { label: 'Respondentes', value: String(responses.length) },
            { label: 'Média Geral', value: `${stats.mediaGeral.toFixed(2)} / 10` },
            { label: 'eNPS Interno', value: `${stats.enps}` },
            { label: 'Perguntas Ativas', value: String(questions.length) },
          ]}
          columns={[
            { header: 'Categoria', key: 'categoria' },
            { header: 'Média (0-10)', key: 'media' },
            { header: '% Pontuação Máxima', key: 'pctMax' },
            { header: '% Promotores', key: 'prom' },
            { header: '% Passivos', key: 'pass' },
            { header: '% Detratores', key: 'detr' },
          ]}
          rows={stats.porCategoria.map((c) => ({
            categoria: c.categoria,
            media: c.media.toFixed(2),
            pctMax: `${c.pctMax.toFixed(1)}%`,
            prom: `${c.prom.toFixed(1)}%`,
            pass: `${c.pass.toFixed(1)}%`,
            detr: `${c.detr.toFixed(1)}%`,
          }))}
        />

        {/* Card Link Público para Celular / Computador */}
        <div className="card" style={{ padding: '16px 20px', border: '1px solid var(--accent-border)', background: 'var(--accent-glow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                <Smartphone size={17} color="var(--accent)" />
                Link Público da Pesquisa (Celular ou Computador)
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                Compartilhe este link com os colaboradores — não precisa de login e as respostas caem automaticamente nesta tabulação.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={handleCopyLink} className="btn btn-secondary">
                <Copy size={14} /> Copiar Link
              </button>
              <button
                type="button"
                onClick={() => window.open(publicSurveyUrl, '_blank', 'noopener,noreferrer')}
                className="btn btn-secondary"
              >
                <ExternalLink size={14} /> Abrir Formulário
              </button>
              <button type="button" onClick={handleShareWhatsApp} className="btn btn-primary">
                <MessageSquare size={14} /> Enviar no WhatsApp
              </button>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <input
              readOnly
              value={publicSurveyUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="form-input"
              style={{ fontSize: 12.5, fontFamily: 'monospace' }}
            />
          </div>
        </div>

        {/* KPIs */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Respondentes Tabulados</div>
            <div className="kpi-value">{responses.length}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Média Geral de Clima</div>
            <div className="kpi-value" style={{ color: 'var(--accent)' }}>
              {stats.mediaGeral.toFixed(2)} <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>/ 10</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">eNPS Interno</div>
            <div className="kpi-value" style={{ color: stats.enps >= 20 ? '#16a34a' : stats.enps >= 0 ? '#eab308' : '#dc2626' }}>
              {stats.enps}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Distribuição Geral</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, display: 'flex', gap: 10 }}>
              <span style={{ color: '#16a34a' }}>Prom: {stats.totalRespostas ? Math.round((stats.promotores / stats.totalRespostas) * 100) : 0}%</span>
              <span style={{ color: '#eab308' }}>Pass: {stats.totalRespostas ? Math.round((stats.passivos / stats.totalRespostas) * 100) : 0}%</span>
              <span style={{ color: '#dc2626' }}>Detr: {stats.totalRespostas ? Math.round((stats.detratores / stats.totalRespostas) * 100) : 0}%</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setTab('analise')} className={tab === 'analise' ? 'btn btn-primary' : 'btn btn-secondary'}>
            <BarChart3 size={15} /> Análise & Rankings
          </button>
          <button onClick={() => setTab('aplicar')} className={tab === 'aplicar' ? 'btn btn-primary' : 'btn btn-secondary'}>
            <ClipboardList size={15} /> Aplicar Pesquisa (Interno)
          </button>
          <button onClick={() => setTab('tabulacao')} className={tab === 'tabulacao' ? 'btn btn-primary' : 'btn btn-secondary'}>
            <Table2 size={15} /> Tabulação de Dados ({responses.length})
          </button>
          <button onClick={() => setTab('parecer')} className={tab === 'parecer' ? 'btn btn-primary' : 'btn btn-secondary'}>
            <FileText size={15} /> Parecer & Plano de Ação
          </button>
        </div>

        {tab === 'analise' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="card" style={{ padding: 20 }}>
              <div className="card-header" style={{ padding: 0, marginBottom: 14, border: 'none' }}>
                <div className="card-title">% Pontuação Máxima por Categoria</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {stats.porCategoria.map((c) => (
                  <div key={c.categoria}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
                      <strong>
                        {c.categoria} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({c.count} perguntas)</span>
                      </strong>
                      <span>
                        <strong>{c.pctMax.toFixed(1)}%</strong> (Média {c.media.toFixed(2)}) ·{' '}
                        <span style={{ color: '#16a34a' }}>P:{c.prom.toFixed(0)}%</span> /{' '}
                        <span style={{ color: '#eab308' }}>N:{c.pass.toFixed(0)}%</span> /{' '}
                        <span style={{ color: '#dc2626' }}>D:{c.detr.toFixed(0)}%</span>
                      </span>
                    </div>
                    <div style={{ height: 10, background: 'var(--bg-secondary)', borderRadius: 999, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(100, c.pctMax)}%`,
                          height: '100%',
                          background: c.pctMax >= 80 ? '#16a34a' : c.pctMax >= 65 ? '#2563eb' : '#dc2626',
                          borderRadius: 999,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 18 }}>
              <div className="card" style={{ padding: 18 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px' }}>
                  <Award size={18} /> TOP 10 Melhores Avaliações
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stats.top10Melhores.map((q, idx) => (
                    <div
                      key={q.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '8px 10px',
                        background: 'rgba(22, 163, 74, 0.08)',
                        border: '1px solid rgba(22, 163, 74, 0.25)',
                        borderRadius: 8,
                        fontSize: 12.5,
                      }}
                    >
                      <span><strong>#{idx + 1}</strong> ({q.categoria}) — {q.texto}</span>
                      <strong style={{ color: '#16a34a', whiteSpace: 'nowrap' }}>{q.media.toFixed(1)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card" style={{ padding: 18 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px' }}>
                  <AlertTriangle size={18} /> TOP 10 Piores Avaliações (Prioridade)
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stats.top10Piores.map((q, idx) => (
                    <div
                      key={q.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '8px 10px',
                        background: 'rgba(220, 38, 38, 0.08)',
                        border: '1px solid rgba(220, 38, 38, 0.25)',
                        borderRadius: 8,
                        fontSize: 12.5,
                      }}
                    >
                      <span><strong>#{idx + 1}</strong> ({q.categoria}) — {q.texto}</span>
                      <strong style={{ color: '#dc2626', whiteSpace: 'nowrap' }}>{q.media.toFixed(1)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'aplicar' && (
          <form onSubmit={handleSubmitSurvey} className="card" style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 18, padding: 14, background: 'var(--bg-secondary)', borderRadius: 10 }}>
              <div>
                <label className="form-label">Identificação do Respondente (ou Anônimo)</label>
                <input className="form-input" value={formNome} onChange={(e) => setFormNome(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Setor / Área</label>
                <input className="form-input" value={formSetor} onChange={(e) => setFormSetor(e.target.value)} />
              </div>
            </div>

            {CATEGORIAS.map((cat) => (
              <div key={cat} style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)', background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 8, marginBottom: 10 }}>
                  {cat}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {questions
                    .filter((q) => q.categoria === cat)
                    .map((q) => (
                      <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 13.5, flex: '1 1 360px' }}>
                          <strong>{q.id}ª.</strong> {q.texto}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setFormNotas({ ...formNotas, [q.id]: n })}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                border: formNotas[q.id] === n ? '2px solid #fff' : '1px solid var(--border)',
                                background:
                                  formNotas[q.id] === n
                                    ? n >= 9
                                      ? '#16a34a'
                                      : n >= 7
                                      ? '#eab308'
                                      : '#dc2626'
                                    : 'var(--bg-secondary)',
                                color: formNotas[q.id] === n ? '#fff' : 'var(--text-primary)',
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="submit" className="btn btn-primary">
                <Plus size={16} /> Registrar Resposta na Tabulação
              </button>
            </div>
          </form>
        )}

        {tab === 'tabulacao' && (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
              <div className="card-title">Matriz de Tabulação (Reg)</div>
              <button onClick={() => setTab('aplicar')} className="btn btn-primary">
                <Plus size={15} /> Nova Resposta
              </button>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Categoria</th>
                    <th>Pergunta</th>
                    {responses.map((r) => (
                      <th key={r.id} style={{ textAlign: 'center', minWidth: 110 }}>
                        <div>{r.respondente}</div>
                        <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>{r.setor}</div>
                        <button
                          onClick={() => handleDeleteResponse(r.id)}
                          title="Remover respondente"
                          style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 11, marginTop: 2 }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </th>
                    ))}
                    <th style={{ textAlign: 'center' }}>Média</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => {
                    const vals = responses.map((r) => r.notas[q.id]).filter((v): v is number => typeof v === 'number');
                    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                    return (
                      <tr key={q.id}>
                        <td>{q.id}ª</td>
                        <td style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{q.categoria}</td>
                        <td style={{ fontSize: 12.5 }}>{q.texto}</td>
                        {responses.map((r) => {
                          const v = r.notas[q.id];
                          return (
                            <td
                              key={r.id}
                              style={{
                                textAlign: 'center',
                                fontWeight: 700,
                                color: v >= 9 ? '#16a34a' : v >= 7 ? '#eab308' : '#dc2626',
                              }}
                            >
                              {v ?? '—'}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'center', fontWeight: 800 }}>{avg.toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'parecer' && (
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ marginBottom: 4 }}>Parecer da Pesquisa de Clima & Plano de Ação</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
              Registre a análise qualitativa do consultor, pontos críticos e ações corretivas para apresentação à diretoria.
            </p>
            <textarea
              className="form-input"
              rows={12}
              value={parecer}
              onChange={(e) => {
                setParecer(e.target.value);
                persist(questions, responses, e.target.value);
              }}
              style={{ lineHeight: 1.6, fontSize: 13.5 }}
            />
          </div>
        )}
      </div>
    </>
  );
}
