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

export default function SaasAssinantesPfTab() {
  const [carregando, setCarregando] = useState(true);
  const [kpis, setKpis] = useState({ total: 0, ativos: 0, emTrial: 0, expirados: 0, mrr: 0 });
  const [assinantes, setAssinantes] = useState<AssinantePf[]>([]);

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
      const res = await fetch('/api/financas-pessoais/assinantes');
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setKpis(d.kpis || { total: 0, ativos: 0, emTrial: 0, expirados: 0, mrr: 0 });
        setAssinantes(Array.isArray(d.assinantes) ? d.assinantes : []);
      }
    } catch {
      toast.error('Erro ao carregar assinantes PF.');
    } finally {
      setCarregando(false);
    }
  }, []);

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
