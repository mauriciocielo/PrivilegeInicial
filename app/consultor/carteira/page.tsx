'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity, AlertTriangle, CheckCircle2, ShieldAlert, Search, RefreshCw, Calendar, Sparkles, X,
} from 'lucide-react';
import { toast } from 'sonner';

interface ClienteSemaforo {
  empresaId: string;
  nome: string;
  cnpj: string;
  responsavel: string;
  telefone: string;
  saldoCaixa: number;
  totalVencidoPagar: number;
  qtdVencidoPagar: number;
  certDias: number | null;
  cndsPositivas: string[];
  ultimaReuniao: string | null;
  diasSemReuniao: number | null;
  semaforo: 'vermelho' | 'amarelo' | 'verde';
  scoreSaude: number;
  motivos: string[];
}

const moeda = (v: number) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function CarteiraSemaforoPage() {
  const [loading, setLoading] = useState(true);
  const [totais, setTotais] = useState({ total: 0, vermelho: 0, amarelo: 0, verde: 0 });
  const [carteira, setCarteira] = useState<ClienteSemaforo[]>([]);
  const [filtroCor, setFiltroCor] = useState<'todos' | 'vermelho' | 'amarelo' | 'verde'>('todos');
  const [busca, setBusca] = useState('');

  // Modal Dossiê IA rápido
  const [dossieAberto, setDossieAberto] = useState<{ nome: string; dados: any; pontosIA: string[] } | null>(null);
  const [carregandoDossieId, setCarregandoDossieId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/carteira/semaforo');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar carteira');
      setTotais(json.totais || { total: 0, vermelho: 0, amarelo: 0, verde: 0 });
      setCarteira(Array.isArray(json.carteira) ? json.carteira : []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrirDossie = async (c: ClienteSemaforo) => {
    setCarregandoDossieId(c.empresaId);
    try {
      const res = await fetch('/api/agenda/dossie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId: c.empresaId, titulo: 'Revisão de Saúde da Carteira' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao gerar dossiê');
      setDossieAberto({ nome: c.nome, dados: json.dados, pontosIA: json.pontosIA || [] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCarregandoDossieId(null);
    }
  };

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return carteira.filter(c => {
      if (filtroCor !== 'todos' && c.semaforo !== filtroCor) return false;
      if (q && !`${c.nome} ${c.cnpj} ${c.responsavel}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [carteira, filtroCor, busca]);

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Activity size={22} style={{ color: '#600000' }} />
            Semáforo da Carteira de Clientes
          </div>
          <div className="page-subtitle">
            Radar automático da diretoria cruzando Caixa, Contas Vencidas, Certificado A1, CND e Dias sem Reunião.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/consultor/agenda" className="btn btn-secondary btn-sm">
            <Calendar size={14} style={{ marginRight: 5, verticalAlign: -2 }} /> Ir para Agenda
          </Link>
          <button className="btn btn-primary btn-sm" onClick={carregar} disabled={loading} style={{ background: '#600000', borderColor: '#600000' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} style={{ marginRight: 5, verticalAlign: -2 }} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* 4 KPIs clicáveis */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          {[
            { id: 'todos' as const, label: 'Total na Carteira', valor: totais.total, cor: '#0f172a', bg: 'var(--bg-card)', border: 'var(--border-light)', icon: <Activity size={18} /> },
            { id: 'vermelho' as const, label: 'Crítico (Ação Imediata)', valor: totais.vermelho, cor: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: <ShieldAlert size={18} /> },
            { id: 'amarelo' as const, label: 'Atenção (Monitorar)', valor: totais.amarelo, cor: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: <AlertTriangle size={18} /> },
            { id: 'verde' as const, label: 'Saudável (Em Dia)', valor: totais.verde, cor: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: <CheckCircle2 size={18} /> },
          ].map(card => (
            <div
              key={card.id}
              onClick={() => setFiltroCor(card.id)}
              style={{
                background: card.bg,
                border: `2px solid ${filtroCor === card.id ? '#600000' : card.border}`,
                borderRadius: 12,
                padding: '14px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{card.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: card.cor, marginTop: 2 }}>{card.valor}</div>
              </div>
              <div style={{ color: card.cor }}>{card.icon}</div>
            </div>
          ))}
        </div>

        {/* Busca */}
        <div className="card" style={{ padding: 14, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 260px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Buscar empresa, CNPJ ou responsável..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{ paddingLeft: 32 }}
            />
          </div>
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>
            Exibindo {filtrados.length} de {carteira.length} empresa(s)
          </span>
        </div>

        {/* Lista da Carteira */}
        {loading ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Analisando carteira de clientes...</div>
        ) : filtrados.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma empresa neste filtro.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
            {filtrados.map(c => {
              const corBorder = c.semaforo === 'vermelho' ? '#dc2626' : c.semaforo === 'amarelo' ? '#d97706' : '#16a34a';
              const badgeBg = c.semaforo === 'vermelho' ? '#fee2e2' : c.semaforo === 'amarelo' ? '#fef3c7' : '#dcfce7';
              const badgeTxt = c.semaforo === 'vermelho' ? '#b91c1c' : c.semaforo === 'amarelo' ? '#b45309' : '#15803d';
              const badgeLbl = c.semaforo === 'vermelho' ? 'CRÍTICO' : c.semaforo === 'amarelo' ? 'ATENÇÃO' : 'SAUDÁVEL';

              return (
                <div
                  key={c.empresaId}
                  className="card"
                  style={{
                    padding: 16,
                    borderLeft: `5px solid ${corBorder}`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-primary)' }}>{c.nome}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{c.cnpj}</div>
                      </div>
                      <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 99, background: badgeBg, color: badgeTxt }}>
                        {badgeLbl} · {c.scoreSaude}%
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-base)', fontSize: 12 }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>Saldo Caixa</div>
                        <div style={{ fontWeight: 700, color: c.saldoCaixa < 0 ? '#dc2626' : '#15803d' }}>{moeda(c.saldoCaixa)}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>Última Reunião</div>
                        <div style={{ fontWeight: 700 }}>
                          {c.diasSemReuniao !== null ? `há ${c.diasSemReuniao}d` : 'Sem registro'}
                        </div>
                      </div>
                    </div>

                    {c.motivos.length > 0 ? (
                      <ul style={{ margin: '10px 0 0', paddingLeft: 16, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {c.motivos.map((m, idx) => (
                          <li key={idx}>{m}</li>
                        ))}
                      </ul>
                    ) : (
                      <div style={{ marginTop: 10, fontSize: 12, color: '#15803d', fontWeight: 600 }}>
                        ✓ Caixa, obrigações fiscais e acompanhamento em dia.
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border-light)' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => abrirDossie(c)}
                      disabled={carregandoDossieId === c.empresaId}
                      style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12 }}
                    >
                      <Sparkles size={13} style={{ color: '#600000' }} />
                      {carregandoDossieId === c.empresaId ? 'Gerando...' : 'Dossiê IA'}
                    </button>
                    <Link
                      href="/consultor/agenda"
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1, background: '#600000', borderColor: '#600000', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12 }}
                    >
                      <Calendar size={13} /> Agendar
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Dossiê IA */}
      {dossieAberto && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.52)', zIndex: 1200, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(6px)', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setDossieAberto(null)}
        >
          <div className="card" style={{ width: 560, maxWidth: '96vw', maxHeight: '88vh', overflowY: 'auto', padding: 24, position: 'relative' }}>
            <button onClick={() => setDossieAberto(null)} style={{ position: 'absolute', right: 16, top: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={18} />
            </button>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={18} style={{ color: '#600000' }} /> Dossiê Executivo — {dossieAberto.nome}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>
              Resumo em tempo real para tomada de decisão.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
              <div style={{ padding: 10, borderRadius: 10, background: 'var(--bg-base)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Saldo em Caixa</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: dossieAberto.dados.saldoCaixa < 0 ? '#dc2626' : '#15803d' }}>{moeda(dossieAberto.dados.saldoCaixa)}</div>
              </div>
              <div style={{ padding: 10, borderRadius: 10, background: 'var(--bg-base)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>NFS-e no Mês ({dossieAberto.dados.qtdNotasMes})</div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{moeda(dossieAberto.dados.faturamentoNfseMes)}</div>
              </div>
              <div style={{ padding: 10, borderRadius: 10, background: 'var(--bg-base)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Contas a Pagar Vencidas</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: dossieAberto.dados.pagarVencido > 0 ? '#dc2626' : 'var(--text-primary)' }}>{moeda(dossieAberto.dados.pagarVencido)}</div>
              </div>
              <div style={{ padding: 10, borderRadius: 10, background: 'var(--bg-base)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Certificado A1</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: dossieAberto.dados.certAlerta ? '#dc2626' : '#15803d' }}>{dossieAberto.dados.certStatus}</div>
              </div>
            </div>
            <div style={{ padding: 14, borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#600000', marginBottom: 8 }}>Pauta Recomendada pela IA</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#1e293b', lineHeight: 1.55 }}>
                {dossieAberto.pontosIA.map((p, i) => <li key={i} style={{ marginBottom: 4 }}>{p}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
