'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2, KeyRound, Plus, RefreshCw, ShieldCheck, Trash2, Users, X, Power } from 'lucide-react';
import { toast } from 'sonner';

interface EscritorioItem {
  id: string;
  nome: string;
  cnpj: string;
  responsavel: string;
  email: string;
  telefone: string;
  ativo: boolean;
  limiteEmpresas: number;
  createdAt: string;
  certificado: { titular: string; documento: string | null; validoAte: string } | null;
  totalUsuarios: number;
  totalEmpresas: number;
  usuarios: Array<{ id: string; name: string; email: string; papel: string }>;
}

export default function SaasEscritoriosNfseTab() {
  const [lista, setLista] = useState<EscritorioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    nome: '',
    cnpj: '',
    responsavel: '',
    email: '',
    telefone: '',
    limiteEmpresas: 50,
    criarLogin: true,
    loginEmail: '',
    loginSenha: '',
  });

  const carregar = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/saas/escritorios-nfse', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setLista(data.escritorios || []);
      } else {
        toast.error(data.error || 'Erro ao carregar contadores terceiros.');
      }
    } catch {
      toast.error('Sem conexão ao carregar contadores terceiros.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast.error('Informe o nome do escritório contábil.');
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch('/api/saas/escritorios-nfse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          loginEmail: form.loginEmail || form.email,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Erro ao cadastrar contador terceiro.');
        return;
      }
      toast.success('Escritório contábil terceiro criado com ambiente 100% isolado!');
      setShowModal(false);
      setForm({
        nome: '',
        cnpj: '',
        responsavel: '',
        email: '',
        telefone: '',
        limiteEmpresas: 50,
        criarLogin: true,
        loginEmail: '',
        loginSenha: '',
      });
      carregar();
    } finally {
      setSalvando(false);
    }
  };

  const toggleAtivo = async (esc: EscritorioItem) => {
    const res = await fetch('/api/saas/escritorios-nfse', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: esc.id, ativo: !esc.ativo }),
    });
    if (res.ok) {
      toast.success(esc.ativo ? `Acesso de "${esc.nome}" suspenso.` : `Acesso de "${esc.nome}" reativado.`);
      carregar();
    } else {
      toast.error('Erro ao alterar status.');
    }
  };

  const remover = async (esc: EscritorioItem) => {
    if (!confirm(`Remover o escritório "${esc.nome}" e seu certificado digital isolado?`)) return;
    const res = await fetch(`/api/saas/escritorios-nfse?id=${encodeURIComponent(esc.id)}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Escritório removido.');
      carregar();
    } else {
      toast.error('Erro ao remover escritório.');
    }
  };

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <KeyRound size={17} style={{ color: 'var(--accent)' }} /> Contadores Terceiros — Emissor NFS-e Isolado
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Cada escritório parceiro sobe o próprio Certificado Digital A1 e gerencia apenas os clientes dele — sem nenhum vínculo com a Privilege ou outros contadores.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={carregar} style={{ fontSize: 12.5 }}>
            <RefreshCw size={14} /> Atualizar
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setShowModal(true)} style={{ fontSize: 12.5 }}>
            <Plus size={14} /> Novo Contador Terceiro
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
              <th style={{ padding: '10px 8px' }}>Escritório Contábil</th>
              <th style={{ padding: '10px 8px' }}>Certificado A1</th>
              <th style={{ padding: '10px 8px' }}>Clientes / Limite</th>
              <th style={{ padding: '10px 8px' }}>Logins Vinculados</th>
              <th style={{ padding: '10px 8px' }}>Status</th>
              <th style={{ padding: '10px 8px', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</td></tr>
            ) : lista.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Nenhum contador terceiro cadastrado ainda. Clique em <strong>Novo Contador Terceiro</strong> para liberar um ambiente isolado de emissão de NFS-e.
                </td>
              </tr>
            ) : (
              lista.map((esc) => {
                const certVencido = Boolean(esc.certificado?.validoAte && new Date(esc.certificado.validoAte).getTime() < Date.now());
                return (
                  <tr key={esc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{esc.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {esc.cnpj || 'Sem CNPJ'} {esc.responsavel ? `· ${esc.responsavel}` : ''}
                      </div>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      {esc.certificado ? (
                        <div>
                          <div style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, color: certVencido ? '#dc2626' : '#15803d' }}>
                            <ShieldCheck size={14} /> {esc.certificado.titular}
                          </div>
                          <div style={{ fontSize: 11, color: certVencido ? '#dc2626' : 'var(--text-muted)' }}>
                            {certVencido ? 'Vencido em ' : 'Válido até '}
                            {new Date(esc.certificado.validoAte).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11.5, color: '#d97706', fontWeight: 600 }}>Aguardando envio do .pfx</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 8px', fontWeight: 700 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Building2 size={13} /> {esc.totalEmpresas} / {esc.limiteEmpresas}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      {esc.usuarios.length === 0 ? (
                        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Nenhum login</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {esc.usuarios.map((u) => (
                            <span key={u.id} style={{ fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Users size={11} /> {u.email}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: 999,
                          background: esc.ativo ? 'rgba(22,163,74,0.14)' : 'rgba(220,38,38,0.14)',
                          color: esc.ativo ? '#15803d' : '#dc2626',
                        }}
                      >
                        {esc.ativo ? 'ATIVO' : 'SUSPENSO'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '5px 8px', fontSize: 11.5 }}
                          onClick={() => toggleAtivo(esc)}
                          title={esc.ativo ? 'Suspender acesso' : 'Reativar acesso'}
                        >
                          <Power size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '5px 8px', fontSize: 11.5, color: '#dc2626' }}
                          onClick={() => remover(esc)}
                          title="Remover escritório"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Novo Contador Terceiro (Portal no document.body) */}
      {showModal && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.58)', backdropFilter: 'blur(4px)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16,
              width: '100%', maxWidth: 560, padding: 22, boxShadow: '0 24px 60px rgba(0,0,0,0.28)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Novo Escritório Contábil Terceiro</h3>
              <button type="button" onClick={() => setShowModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCriar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">Nome do Escritório *</label>
                  <input className="form-control" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Contabilidade Alfa Ltda" />
                </div>
                <div>
                  <label className="form-label">CNPJ</label>
                  <input className="form-control" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0001-00" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.7fr', gap: 10 }}>
                <div>
                  <label className="form-label">Responsável</label>
                  <input className="form-control" value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} placeholder="Nome do contador" />
                </div>
                <div>
                  <label className="form-label">Telefone / WhatsApp</label>
                  <input className="form-control" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(46) 99999-9999" />
                </div>
                <div>
                  <label className="form-label">Limite Empresas</label>
                  <input type="number" min={1} max={2000} className="form-control" value={form.limiteEmpresas} onChange={(e) => setForm({ ...form, limiteEmpresas: Number(e.target.value) || 50 })} />
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.criarLogin} onChange={(e) => setForm({ ...form, criarLogin: e.target.checked })} />
                  Criar login exclusivo do contador (acesso somente ao módulo NFS-e dele)
                </label>

                {form.criarLogin && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 10 }}>
                    <div>
                      <label className="form-label">E-mail de acesso *</label>
                      <input type="email" required className="form-control" value={form.loginEmail} onChange={(e) => setForm({ ...form, loginEmail: e.target.value, email: e.target.value })} placeholder="contador@escritorio.com.br" />
                    </div>
                    <div>
                      <label className="form-label">Senha inicial *</label>
                      <input type="password" required minLength={6} className="form-control" value={form.loginSenha} onChange={(e) => setForm({ ...form, loginSenha: e.target.value })} placeholder="Mínimo 6 caracteres" />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                Ao fazer login, este contador verá apenas a tela de NFS-e, poderá subir o <strong>próprio Certificado A1</strong> em <em>Emissores por Procuração</em> e importar apenas os CNPJs que deram procuração a ele.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={salvando}>
                  {salvando ? 'Criando...' : 'Criar Escritório Isolado'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
