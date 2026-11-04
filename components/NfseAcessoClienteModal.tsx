'use client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { store } from '../lib/store';
import { confirmAsync } from './ConfirmProvider';

export interface EmpresaAlvoAcesso {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  procuracaoStatus?: 'ativa' | 'sem_procuracao' | 'indeterminada' | null;
}

interface UsuarioClienteResumo {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  empresaIds: string[];
  allowedRoutes: string[];
  createdAt: string;
}

interface CredencialCriada {
  nome: string;
  email: string;
  senha: string;
  telefone: string;
}

function gerarSenhaSugerida(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

interface Props {
  empresa: EmpresaAlvoAcesso;
  onFechar: () => void;
  onAtualizado?: () => void;
}

export default function NfseAcessoClienteModal({ empresa, onFechar, onAtualizado }: Props) {
  const nomeEmpresa = empresa.nomeFantasia || empresa.razaoSocial;
  const [usuarios, setUsuarios] = useState<UsuarioClienteResumo[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [removendoId, setRemovendoId] = useState<string | null>(null);

  const [nome, setNome] = useState(nomeEmpresa);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState(() => gerarSenhaSugerida());
  const [telefone, setTelefone] = useState('');
  const [editandoEmail, setEditandoEmail] = useState<string | null>(null);
  const [credencialCriada, setCredencialCriada] = useState<CredencialCriada | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/nfse/emissores/${empresa.id}/acesso`, { cache: 'no-store' });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(dados.error || 'Não foi possível carregar os acessos desta empresa.');
        setUsuarios([]);
        return;
      }
      setUsuarios(dados.usuarios || []);
    } catch {
      toast.error('Sem conexão com o servidor.');
      setUsuarios([]);
    } finally {
      setCarregando(false);
    }
  }, [empresa.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailLimpo = email.trim().toLowerCase();
    const nomeLimpo = nome.trim() || nomeEmpresa;
    const senhaLimpa = senha.trim();

    if (!emailLimpo || !emailLimpo.includes('@')) {
      toast.error('Informe um e-mail válido para o cliente.');
      return;
    }
    if (!editandoEmail && senhaLimpa.length < 4) {
      toast.error('Defina uma senha com pelo menos 4 caracteres.');
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch(`/api/nfse/emissores/${empresa.id}/acesso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nomeLimpo,
          email: emailLimpo,
          password: senhaLimpa || undefined,
          phone: telefone.trim() || undefined,
        }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(dados.error || 'Não foi possível salvar o acesso do cliente.');
        return;
      }

      if (dados.usuario) {
        store.saveUser({
          id: dados.usuario.id,
          name: dados.usuario.name,
          email: dados.usuario.email,
          password: '',
          role: 'cliente',
          empresaIds: dados.usuario.empresaIds || [empresa.id],
          allowedRoutes: dados.usuario.allowedRoutes || ['/cliente/nfse'],
          phone: dados.usuario.phone || '',
          createdAt: dados.usuario.createdAt || new Date().toISOString(),
        });
      }

      setCredencialCriada({
        nome: nomeLimpo,
        email: emailLimpo,
        senha: senhaLimpa || '(mantida a senha atual)',
        telefone: telefone.replace(/\D/g, ''),
      });

      toast.success(
        dados.vinculadoExistente
          ? 'Acesso atualizado e empresa vinculada ao login do cliente!'
          : 'Login do cliente criado com sucesso!'
      );
      setEmail('');
      setSenha(gerarSenhaSugerida());
      setEditandoEmail(null);
      await carregar();
      onAtualizado?.();
    } catch {
      toast.error('Erro de conexão ao salvar o acesso.');
    } finally {
      setSalvando(false);
    }
  };

  const handleRemover = async (u: UsuarioClienteResumo) => {
    const msg = u.empresaIds.length <= 1
      ? `Remover o acesso de ${u.email}? Como ele está vinculado apenas a esta empresa, o usuário será excluído.`
      : `Desvincular ${u.email} da empresa ${nomeEmpresa}?`;
    if (!(await confirmAsync(msg))) return;

    setRemovendoId(u.id);
    try {
      const res = await fetch(`/api/nfse/emissores/${empresa.id}/acesso?userId=${encodeURIComponent(u.id)}`, {
        method: 'DELETE',
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(dados.error || 'Não foi possível remover o acesso.');
        return;
      }
      if (dados.excluido) {
        store.deleteUser(u.id);
      }
      toast.success('Acesso removido.');
      await carregar();
      onAtualizado?.();
    } catch {
      toast.error('Erro de conexão ao remover o acesso.');
    } finally {
      setRemovendoId(null);
    }
  };

  const montarMensagemAcesso = (cred: CredencialCriada) => {
    const origem = typeof window !== 'undefined' ? window.location.origin : '';
    return [
      `Olá, *${cred.nome}*!`,
      `Seu acesso para emissão de Nota Fiscal de Serviços (NFS-e) da empresa *${nomeEmpresa}* (${empresa.cnpj}) já está liberado:`,
      ``,
      `🔗 *Link de acesso:* ${origem}/login`,
      `📧 *E-mail:* ${cred.email}`,
      `🔑 *Senha:* ${cred.senha}`,
      ``,
      `Ao entrar, você cairá direto na tela do Emissor de NFS-e.`,
    ].join('\n');
  };

  const copiarMensagem = async (cred: CredencialCriada) => {
    try {
      await navigator.clipboard.writeText(montarMensagemAcesso(cred));
      toast.success('Dados de acesso copiados para a área de transferência!');
    } catch {
      toast.error('Não foi possível copiar automaticamente.');
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !salvando && onFechar()}>
      <div className="modal modal-lg" style={{ maxWidth: 680, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">🔑 Acesso do Cliente para Emitir NFS-e</h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {nomeEmpresa} · <span style={{ fontFamily: 'monospace' }}>{empresa.cnpj}</span>
            </div>
          </div>
          <button className="modal-close" onClick={onFechar} disabled={salvando}>✕</button>
        </div>

        {/* Passo a passo claro */}
        <div style={{
          background: 'rgba(59,130,246,0.08)',
          border: '1px solid rgba(59,130,246,0.28)',
          borderRadius: 10,
          padding: '12px 16px',
          marginBottom: 16,
          fontSize: 12.5,
          lineHeight: 1.55,
          color: 'var(--text-secondary)',
        }}>
          <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
            💡 Como funciona o login do cliente para emissão de notas:
          </div>
          <div>1. Crie abaixo o <strong>e-mail e senha</strong> do cliente (ou vincule um e-mail já existente).</div>
          <div>2. O cliente acessa a tela normal de login (<code>/login</code>) com esse e-mail e senha (ou pelo botão do Google com o mesmo e-mail).</div>
          <div>3. Ele entra <strong>direto e exclusivamente na tela de NFS-e</strong> desta empresa — sem acesso às telas financeiras internas do BPO.</div>
          {empresa.procuracaoStatus !== 'ativa' && (
            <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(245,158,11,0.14)', color: '#f59e0b', fontWeight: 600 }}>
              ⚠️ Atenção: lembre-se de verificar a procuração desta empresa em &quot;Emissores por Procuração&quot; para que o cliente consiga transmitir notas.
            </div>
          )}
        </div>

        {/* Cartão de credenciais recém-criadas */}
        {credencialCriada && (
          <div style={{
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.4)',
            borderRadius: 10,
            padding: 14,
            marginBottom: 16,
          }}>
            <div style={{ fontWeight: 700, color: 'var(--green)', fontSize: 13.5, marginBottom: 8 }}>
              ✅ Login liberado! Envie os dados abaixo para o cliente:
            </div>
            <pre style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border-light)',
              borderRadius: 8,
              padding: 10,
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              margin: '0 0 10px 0',
            }}>
              {montarMensagemAcesso(credencialCriada)}
            </pre>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => copiarMensagem(credencialCriada)}>
                📋 Copiar mensagem de acesso
              </button>
              {credencialCriada.telefone && (
                <a
                  className="btn btn-secondary btn-sm"
                  href={`https://wa.me/${credencialCriada.telefone.startsWith('55') ? credencialCriada.telefone : `55${credencialCriada.telefone}`}?text=${encodeURIComponent(montarMensagemAcesso(credencialCriada))}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  💬 Enviar pelo WhatsApp
                </a>
              )}
            </div>
          </div>
        )}

        {/* Lista de usuários já vinculados */}
        <div style={{ background: 'var(--bg-card2)', borderRadius: 8, padding: 14, marginBottom: 16, border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            👥 Logins já liberados para esta empresa ({usuarios?.length || 0})
          </div>
          {carregando ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>⏳ Carregando acessos...</div>
          ) : !usuarios || usuarios.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Nenhum login de cliente vinculado ainda. Preencha o formulário abaixo para criar o primeiro acesso.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {usuarios.map(u => (
                <div
                  key={u.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-light)',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      {u.email}
                      {u.phone ? ` · 📱 ${u.phone}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: '4px 10px' }}
                      onClick={() => {
                        setEditandoEmail(u.email);
                        setNome(u.name);
                        setEmail(u.email);
                        setTelefone(u.phone || '');
                        setSenha(gerarSenhaSugerida());
                        setCredencialCriada(null);
                      }}
                    >
                      🔑 Trocar Senha
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ fontSize: 11, padding: '4px 10px' }}
                      disabled={removendoId === u.id}
                      onClick={() => handleRemover(u)}
                    >
                      {removendoId === u.id ? '⏳' : '🗑️ Remover'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Formulário de criação / atualização */}
        <form onSubmit={handleSalvar} style={{ background: 'var(--bg-card2)', borderRadius: 8, padding: 14, border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {editandoEmail ? `🔑 Redefinir senha de ${editandoEmail}` : '＋ Criar novo login para o cliente'}
            </div>
            {editandoEmail && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, padding: '2px 8px' }}
                onClick={() => {
                  setEditandoEmail(null);
                  setNome(nomeEmpresa);
                  setEmail('');
                  setTelefone('');
                  setSenha(gerarSenhaSugerida());
                }}
              >
                Cancelar edição
              </button>
            )}
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Nome do Cliente / Responsável *</label>
              <input
                className="form-control"
                placeholder="Ex: João Silva"
                value={nome}
                onChange={e => setNome(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">E-mail de Login *</label>
              <input
                type="email"
                className="form-control"
                placeholder="cliente@empresa.com.br"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">
                {editandoEmail ? 'Nova Senha *' : 'Senha Inicial *'}
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontFamily: 'monospace', fontWeight: 600 }}
                  placeholder="Mínimo 4 caracteres"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  required={!editandoEmail}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ whiteSpace: 'nowrap', padding: '0 10px', fontSize: 12 }}
                  title="Gerar senha numérica de 6 dígitos"
                  onClick={() => setSenha(gerarSenhaSugerida())}
                >
                  🎲 Gerar
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Visível para você copiar e enviar ao cliente.
              </div>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">WhatsApp do Cliente (opcional)</label>
              <input
                type="text"
                className="form-control"
                placeholder="Ex: 5546999999999"
                value={telefone}
                onChange={e => setTelefone(e.target.value.replace(/\D/g, ''))}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Permite enviar o login direto no WhatsApp com 1 clique.
              </div>
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={onFechar} disabled={salvando}>
              Fechar
            </button>
            <button type="submit" className="btn btn-primary" disabled={salvando}>
              {salvando ? '⏳ Salvando...' : editandoEmail ? '✓ Salvar Nova Senha' : '✓ Liberar Acesso do Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

