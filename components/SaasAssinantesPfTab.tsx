'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  MessageSquare,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { fmt } from '../lib/reports';
import { confirmAsync } from './ConfirmProvider';

interface AssinantePf {
  id: string;
  userId: string;
  nome: string;
  email: string;
  phone: string;
  plano: string;
  planoNome: string;
  valorMensal: number;
  status: string;
  validoAte: string;
  origem: string;
  gateway: string;
}

interface CupomPf {
  id: string;
  codigo: string;
  tipo: 'percentual' | 'fixo';
  valor: number;
  diasTrialExtra: number;
  limiteUsos: number | null;
  usosAtuais: number;
  validoAte: string | null;
  ativo: boolean;
}

export default function SaasAssinantesPfTab() {
  const [carregando, setCarregando] = useState(true);
  const [kpis, setKpis] = useState({ total: 0, ativos: 0, emTrial: 0, expirados: 0, mrr: 0 });
  const [assinantes, setAssinantes] = useState<AssinantePf[]>([]);
  const [cupons, setCupons] = useState<CupomPf[]>([]);

  // Form Novo Cupom PF
  const [cupomCodigo, setCupomCodigo] = useState('');
  const [cupomTipo, setCupomTipo] = useState<'percentual' | 'fixo'>('percentual');
  const [cupomValor, setCupomValor] = useState('20');
  const [cupomDiasExtra, setCupomDiasExtra] = useState('0');
  const [cupomLimite, setCupomLimite] = useState('');
  const [cupomValidade, setCupomValidade] = useState('');
  const [salvandoCupom, setSalvandoCupom] = useState(false);
  const [disparandoLembretes, setDisparandoLembretes] = useState(false);

  const handleDispararLembretes = async () => {
    setDisparandoLembretes(true);
    try {
      const res = await fetch('/api/cron/financas-pessoais-lembrete', { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || 'Erro ao disparar lembretes.');
        return;
      }
      toast.success(
        `Concluído! ${d.lembretesEnviados || 0} lembrete(s) de 1 dia sem envio + ${d.boasVindasReenviadas || 0} boas-vindas pendente(s).`
      );
    } finally {
      setDisparandoLembretes(false);
    }
  };

  // Form Novo Assinante PF
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [plano, setPlano] = useState('mensal');
  const [senha, setSenha] = useState('');
  const [enviarWhatsapp, setEnviarWhatsapp] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [res, resCup] = await Promise.all([
        fetch('/api/financas-pessoais/assinantes'),
        fetch('/api/financas-pessoais/cupons'),
      ]);
      const d = await res.json().catch(() => ({}));
      const dc = await resCup.json().catch(() => ({}));
      if (res.ok) {
        setKpis(d.kpis || { total: 0, ativos: 0, emTrial: 0, expirados: 0, mrr: 0 });
        setAssinantes(Array.isArray(d.assinantes) ? d.assinantes : []);
      }
      if (resCup.ok) {
        setCupons(Array.isArray(dc.cupons) ? dc.cupons : []);
      }
    } catch {
      toast.error('Erro ao carregar assinantes PF.');
    } finally {
      setCarregando(false);
    }
  }, []);

  const handleCriarCupom = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoCupom(true);
    try {
      const res = await fetch('/api/financas-pessoais/cupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: cupomCodigo,
          tipo: cupomTipo,
          valor: parseFloat(cupomValor.replace(',', '.')) || 0,
          diasTrialExtra: Number(cupomDiasExtra) || 0,
          limiteUsos: cupomLimite ? Number(cupomLimite) : null,
          validoAte: cupomValidade || null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || 'Erro ao criar cupom.');
        return;
      }
      toast.success(`Cupom ${d.codigo} criado!`);
      setCupomCodigo('');
      setCupomLimite('');
      setCupomValidade('');
      carregar();
    } finally {
      setSalvandoCupom(false);
    }
  };

  const handleToggleCupom = async (c: CupomPf) => {
    await fetch('/api/financas-pessoais/cupons', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, ativo: !c.ativo }),
    });
    toast.success(c.ativo ? `Cupom ${c.codigo} pausado.` : `Cupom ${c.codigo} ativado!`);
    carregar();
  };

  const handleExcluirCupom = async (c: CupomPf) => {
    const ok = await confirmAsync(`Excluir o cupom "${c.codigo}"?`);
    if (!ok) return;
    await fetch(`/api/financas-pessoais/cupons?id=${encodeURIComponent(c.id)}`, { method: 'DELETE' });
    toast.success('Cupom excluído.');
    carregar();
  };

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const res = await fetch('/api/financas-pessoais/assinantes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, phone, plano, senha, enviarWhatsapp }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || 'Erro ao cadastrar assinante PF.');
        return;
      }
      const msgSenha = d.senhaGerada ? ` Senha: ${d.senhaGerada}.` : '';
      const msgWpp = d.whatsappEnviado ? ' Acesso enviado no WhatsApp!' : '';
      toast.success(`Assinante PF liberado até ${d.validoAte}!${msgSenha}${msgWpp}`);
      setNome('');
      setEmail('');
      setPhone('');
      setSenha('');
      carregar();
    } finally {
      setSalvando(false);
    }
  };

  const handleAcao = async (id: string, payload: Record<string, any>, msgOk: string) => {
    const res = await fetch('/api/financas-pessoais/assinantes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...payload }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(d.error || 'Erro ao atualizar assinante.');
      return;
    }
    toast.success(msgOk);
    carregar();
  };

  const handleExcluir = async (a: AssinantePf) => {
    const ok = await confirmAsync(`Remover a assinatura PF de "${a.nome}"?`);
    if (!ok) return;
    await fetch(`/api/financas-pessoais/assinantes?id=${encodeURIComponent(a.id)}`, { method: 'DELETE' });
    toast.success('Assinatura removida.');
    carregar();
  };

  const copiarLink = (path: string, label: string) => {
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url);
    toast.success(`${label} copiado: ${url}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Barra de Divulgação & Webhook */}
      <div className="card" style={{ padding: 18, background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff', border: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#86efac' }}>
              Produto B2C · Finanças Pessoais com WhatsApp + IA
            </div>
            <h2 style={{ margin: '4px 0 0', fontSize: 19, fontWeight: 800 }}>
              Venda no Piloto Automático ou Cadastre em 1 Clique
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#cbd5e1' }}>
              Compartilhe o link público para autocadastro (7 dias grátis) ou plugue o Webhook no Asaas, Kiwify, Hotmart ou Mercado Pago.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              className="btn"
              onClick={() => copiarLink('/financas-pessoais', 'Link de Vendas PF')}
              style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Copy size={14} /> Copiar Página de Vendas
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => copiarLink('/api/webhooks/financas-pessoais', 'URL do Webhook')}
              style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Copy size={14} /> Copiar Webhook Pagamento
            </button>
            <button
              type="button"
              className="btn"
              disabled={disparandoLembretes}
              onClick={handleDispararLembretes}
              style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              title="Envia lembrete no WhatsApp para quem está há 1 dia sem registrar gastos (também roda automaticamente todo dia às 20h)"
            >
              <MessageSquare size={14} /> {disparandoLembretes ? 'Enviando...' : 'Disparar Lembretes (1d)'}
            </button>
          </div>
        </div>
      </div>

      {/* KPIs PF */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 12 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>MRR Finanças PF</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#15803d', marginTop: 4 }}>{fmt.currency(kpis.mrr)}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>Assinantes Ativos</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginTop: 4 }}>{kpis.ativos}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>Em Teste (Trial 7d)</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#1d4ed8', marginTop: 4 }}>{kpis.emTrial}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>Expirados / Suspensos</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#b91c1c', marginTop: 4 }}>{kpis.expirados}</div>
        </div>
      </div>

      {/* Cadastro Rápido em 1 Clique */}
      <div className="card" style={{ padding: 18 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserPlus size={17} color="var(--accent, #600000)" /> Cadastrar Novo Assinante PF (Acesso Exclusivo Finanças Pessoais)
        </h3>
        <form onSubmit={handleCadastrar} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 8 }}>
            <input className="form-control" required placeholder="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
            <input className="form-control" type="email" required placeholder="E-mail de acesso" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="form-control" required placeholder="WhatsApp com DDD (ex.: 46999990000)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <select className="form-control" value={plano} onChange={(e) => setPlano(e.target.value)}>
              <option value="mensal">Mensal PF — R$ 29,90/mês (30d)</option>
              <option value="anual">Anual PF — R$ 297,00/ano (365d)</option>
              <option value="trial_7d">Teste Grátis — 7 dias</option>
              <option value="cortesia">Cortesia / VIP (365d)</option>
            </select>
            <input className="form-control" placeholder="Senha (opcional: gera automática)" value={senha} onChange={(e) => setSenha(e.target.value)} />
            <button
              type="submit"
              disabled={salvando}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700 }}
            >
              <Plus size={15} /> {salvando ? 'Criando...' : 'Liberar Acesso PF'}
            </button>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#166534', cursor: 'pointer' }}>
            <input type="checkbox" checked={enviarWhatsapp} onChange={(e) => setEnviarWhatsapp(e.target.checked)} />
            Enviar automaticamente o link, login, senha e tutorial no WhatsApp do cliente
          </label>
        </form>
      </div>

      {/* Cupons de Desconto para a Página de Vendas PF */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
            🏷️ Cupons de Desconto — Página de Vendas (/financas-pessoais)
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Crie cupons em % ou R$ (e dias grátis extras). Você também pode divulgar já aplicado no link: <code>/financas-pessoais?cupom=SEUCODIGO</code>.
          </p>
        </div>

        <form onSubmit={handleCriarCupom} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 14 }}>
          <input
            className="form-control"
            required
            placeholder="Código (ex.: PRIVILEGE20)"
            value={cupomCodigo}
            onChange={(e) => setCupomCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
          />
          <select className="form-control" value={cupomTipo} onChange={(e) => setCupomTipo(e.target.value === 'fixo' ? 'fixo' : 'percentual')}>
            <option value="percentual">Desconto em %</option>
            <option value="fixo">Desconto fixo (R$)</option>
          </select>
          <input
            className="form-control"
            required
            placeholder={cupomTipo === 'percentual' ? '% (ex.: 20)' : 'R$ (ex.: 10)'}
            value={cupomValor}
            onChange={(e) => setCupomValor(e.target.value)}
          />
          <input
            className="form-control"
            type="number"
            min={0}
            placeholder="Dias trial extras"
            title="Dias grátis extras somados aos 7 dias padrão"
            value={cupomDiasExtra}
            onChange={(e) => setCupomDiasExtra(e.target.value)}
          />
          <input
            className="form-control"
            type="number"
            min={1}
            placeholder="Limite usos (opc.)"
            value={cupomLimite}
            onChange={(e) => setCupomLimite(e.target.value)}
          />
          <input
            className="form-control"
            type="date"
            title="Validade do cupom (opcional)"
            value={cupomValidade}
            onChange={(e) => setCupomValidade(e.target.value)}
          />
          <button type="submit" disabled={salvandoCupom} className="btn btn-primary" style={{ fontWeight: 700 }}>
            <Plus size={14} /> {salvandoCupom ? 'Criando...' : 'Criar Cupom'}
          </button>
        </form>

        {cupons.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Benefício</th>
                  <th>Usos</th>
                  <th>Validade</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {cupons.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: 13.5 }}>{c.codigo}</td>
                    <td style={{ fontSize: 13 }}>
                      <strong>{c.tipo === 'percentual' ? `${c.valor}% OFF` : `${fmt.currency(c.valor)} OFF`}</strong>
                      {c.diasTrialExtra > 0 ? ` + ${c.diasTrialExtra}d grátis` : ''}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {c.usosAtuais}
                      {c.limiteUsos ? ` / ${c.limiteUsos}` : ' (ilimitado)'}
                    </td>
                    <td style={{ fontSize: 13 }}>{c.validoAte || 'Sem expiração'}</td>
                    <td>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 99,
                          fontSize: 11.5,
                          fontWeight: 700,
                          background: c.ativo ? '#dcfce7' : '#f1f5f9',
                          color: c.ativo ? '#166534' : '#64748b',
                        }}
                      >
                        {c.ativo ? 'Ativo' : 'Pausado'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: 5 }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: 11.5, padding: '4px 8px' }}
                          onClick={() => copiarLink(`/financas-pessoais?cupom=${c.codigo}`, `Link com cupom ${c.codigo}`)}
                        >
                          <Copy size={12} /> Link
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: 11.5, padding: '4px 8px' }}
                          onClick={() => handleToggleCupom(c)}
                        >
                          {c.ativo ? 'Pausar' : 'Ativar'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: 11.5, padding: '4px 8px', color: '#b91c1c' }}
                          onClick={() => handleExcluirCupom(c)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lista de Assinantes PF */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wallet size={17} color="#15803d" /> Carteira de Assinantes PF ({assinantes.length})
          </h3>
          <button type="button" className="btn btn-secondary" onClick={carregar} style={{ fontSize: 12.5 }}>
            <RefreshCw size={13} /> Atualizar
          </button>
        </div>

        {carregando ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Carregando assinantes...</div>
        ) : assinantes.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: '#64748b', fontSize: 13.5 }}>
            Nenhum assinante PF cadastrado ainda. Use o formulário acima ou compartilhe o link <strong>/financas-pessoais</strong>!
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>WhatsApp</th>
                  <th>Plano</th>
                  <th>Status</th>
                  <th>Válido até</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {assinantes.map((a) => {
                  const badgeCor =
                    a.status === 'ativo'
                      ? { bg: '#dcfce7', fg: '#166534', label: 'Ativo' }
                      : a.status === 'trial'
                      ? { bg: '#dbeafe', fg: '#1d4ed8', label: 'Trial 7d' }
                      : { bg: '#fee2e2', fg: '#b91c1c', label: a.status === 'expirado' ? 'Expirado' : 'Suspenso' };
                  return (
                    <tr key={a.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{a.nome}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{a.email}</div>
                      </td>
                      <td style={{ fontSize: 13 }}>{a.phone || '—'}</td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{a.planoNome}</div>
                        <div style={{ fontSize: 11.5, color: '#64748b' }}>
                          {a.valorMensal > 0 ? `${fmt.currency(a.valorMensal)}/mês` : 'Sem cobrança'} · {a.origem}
                        </div>
                      </td>
                      <td>
                        <span style={{ padding: '3px 9px', borderRadius: 99, fontSize: 11.5, fontWeight: 800, background: badgeCor.bg, color: badgeCor.fg }}>
                          {badgeCor.label}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{a.validoAte}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: 5 }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            title="Renovar / Ativar por +30 dias"
                            style={{ fontSize: 11.5, padding: '4px 8px', color: '#15803d' }}
                            onClick={() => handleAcao(a.id, { acao: 'renovar_30d' }, 'Assinatura renovada por +30 dias!')}
                          >
                            <CheckCircle2 size={12} /> +30d
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            title="Reenviar acesso no WhatsApp"
                            style={{ fontSize: 11.5, padding: '4px 8px', color: '#16a34a' }}
                            onClick={() => handleAcao(a.id, { acao: 'reenviar_whatsapp' }, 'Mensagem de acesso enviada no WhatsApp!')}
                          >
                            <MessageSquare size={12} />
                          </button>
                          {a.status !== 'suspenso' && (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              title="Suspender acesso"
                              style={{ fontSize: 11.5, padding: '4px 8px', color: '#b45309' }}
                              onClick={() => handleAcao(a.id, { status: 'suspenso' }, 'Assinatura suspensa.')}
                            >
                              <ShieldAlert size={12} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-secondary"
                            title="Remover"
                            style={{ fontSize: 11.5, padding: '4px 8px', color: '#b91c1c' }}
                            onClick={() => handleExcluir(a)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
