'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck, Upload, KeyRound, CheckCircle2, AlertTriangle, X, FileCheck,
  Eye, EyeOff, RefreshCw, Trash2, Building, Calendar, ArrowRight, ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { lerJsonResposta } from '../lib/nfe/resposta-cliente';

interface NfeCertificadoModalProps {
  empresaId: string;
  empresaNome: string;
  empresaCnpj: string;
  onClose: () => void;
  onAtualizado: () => void;
}

interface DadosCertificado {
  empresaId: string;
  razaoSocial: string;
  cnpj: string;
  modoAtivo: 'escritorio' | 'propria' | 'ausente';
  usarProcuracao: boolean;
  certProprio: {
    cadastrado: boolean;
    titular: string | null;
    cnpj: string | null;
    nomeArquivo: string | null;
    validoAte: string | null;
    vencido: boolean;
    diasParaVencer: number | null;
  };
  certEscritorio: {
    cadastrado: boolean;
    titular: string | null;
    cnpj: string | null;
    validoAte: string | null;
    vencido: boolean;
    procuracaoStatus: string | null;
  };
}

function formatCnpj(v: string): string {
  const d = v.replace(/\D/g, '');
  if (d.length !== 14) return v;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

function formatData(iso: string | null): string {
  if (!iso) return '-';
  const parte = iso.split('T')[0];
  const [ano, mes, dia] = parte.split('-');
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}

export default function NfeCertificadoModal({
  empresaId,
  empresaNome,
  empresaCnpj,
  onClose,
  onAtualizado,
}: NfeCertificadoModalProps) {
  const [dados, setDados] = useState<DadosCertificado | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Formulário de upload de novo PFX
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [alternandoModo, setAlternandoModo] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const carregarDados = async () => {
    try {
      setCarregando(true);
      const res = await fetch(`/api/nfe/certificado?empresaId=${empresaId}`);
      if (!res.ok) throw new Error('Falha ao carregar situação dos certificados.');
      const json = await lerJsonResposta(res);
      setDados(json);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao carregar dados do certificado.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [empresaId]);

  // Upload do Certificado Próprio A1
  const handleEnviarCertificado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!arquivo) {
      toast.warning('Selecione o arquivo do certificado (.pfx ou .p12).');
      return;
    }
    if (!senha) {
      toast.warning('Informe a senha do certificado digital.');
      return;
    }

    try {
      setEnviando(true);
      const reader = new FileReader();
      const pfxBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result as string;
          resolve(res.split(',')[1] || res);
        };
        reader.onerror = reject;
        reader.readAsDataURL(arquivo);
      });

      const res = await fetch('/api/nfe/certificado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId,
          pfxBase64,
          senha,
          nomeArquivo: arquivo.name,
        }),
      });

      const ret = await lerJsonResposta(res);
      if (!res.ok) throw new Error(ret.error || 'Falha ao validar certificado A1.');

      toast.success(ret.mensagem || 'Certificado digital A1 salvo com sucesso!');
      setArquivo(null);
      setSenha('');
      await carregarDados();
      onAtualizado();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao processar certificado.');
    } finally {
      setEnviando(false);
    }
  };

  // Alternar entre certificado próprio A1 e procuração do escritório
  const handleAlternarModo = async (usarProcuracao: boolean) => {
    try {
      setAlternandoModo(true);
      const res = await fetch('/api/nfe/certificado', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, usarProcuracao }),
      });
      const ret = await lerJsonResposta(res);
      if (!res.ok) throw new Error(ret.error || 'Falha ao alternar certificado.');

      toast.success(usarProcuracao
        ? 'Agora a empresa usará a Procuração do Escritório para buscar notas.'
        : 'Agora a empresa usará o Certificado Próprio A1 para buscar notas.'
      );
      await carregarDados();
      onAtualizado();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao alternar modo do certificado.');
    } finally {
      setAlternandoModo(false);
    }
  };

  // Remover certificado próprio
  const handleRemoverCertProprio = async () => {
    if (!confirm('Deseja realmente remover o certificado A1 próprio desta empresa?')) return;
    try {
      const res = await fetch(`/api/nfe/certificado?empresaId=${empresaId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao remover certificado.');
      toast.success('Certificado próprio removido com sucesso.');
      await carregarDados();
      onAtualizado();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover certificado.');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        background: '#ffffff', borderRadius: 14, maxWidth: 680, width: '100%',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh'
      }}>
        {/* Cabeçalho */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid #e5e7eb', background: '#fafafa',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 10, background: '#eff6ff', color: '#2563eb'
            }}>
              <KeyRound size={20} />
            </span>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 600, color: '#111827', margin: 0 }}>
                Certificado Digital para Busca de Notas (NF-e)
              </h3>
              <span style={{ fontSize: 12.5, color: '#6b7280' }}>
                {empresaNome} • CNPJ {formatCnpj(empresaCnpj)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {carregando ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#2563eb' }} />
              Carregando situação dos certificados...
            </div>
          ) : (
            <>
              {/* Opções de Origem da Busca de Notas */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 10 }}>
                  Como esta empresa busca as notas na SEFAZ:
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {/* Opção 1: Certificado Próprio A1 */}
                  <div
                    onClick={() => {
                      if (dados?.certProprio.cadastrado && dados.usarProcuracao) {
                        handleAlternarModo(false);
                      }
                    }}
                    style={{
                      border: `2px solid ${!dados?.usarProcuracao ? '#2563eb' : '#e5e7eb'}`,
                      background: !dados?.usarProcuracao ? '#eff6ff' : '#ffffff',
                      borderRadius: 10, padding: 16, cursor: dados?.certProprio.cadastrado ? 'pointer' : 'default',
                      position: 'relative', transition: 'all .15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13.5, color: !dados?.usarProcuracao ? '#1e40af' : '#111827' }}>
                        <ShieldCheck size={16} color={!dados?.usarProcuracao ? '#2563eb' : '#6b7280'} />
                        Certificado Próprio A1
                      </div>
                      {!dados?.usarProcuracao && (
                        <span className="badge badge-blue" style={{ fontSize: 10.5, padding: '2px 6px' }}>Ativo</span>
                      )}
                    </div>

                    {dados?.certProprio.cadastrado ? (
                      <div style={{ fontSize: 12, color: '#4b5563' }}>
                        <div style={{ fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {dados.certProprio.titular}
                        </div>
                        <div style={{ color: dados.certProprio.vencido ? '#dc2626' : '#16a34a', marginTop: 3, fontWeight: 500 }}>
                          {dados.certProprio.vencido ? '⚠️ Certificado Vencido' : `Válido até ${formatData(dados.certProprio.validoAte)}`}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                          Arquivo: {dados.certProprio.nomeArquivo || 'certificado.pfx'}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', marginTop: 6 }}>
                        Nenhum certificado A1 próprio enviado ainda.
                      </div>
                    )}
                  </div>

                  {/* Opção 2: Procuração do Escritório */}
                  <div
                    onClick={() => {
                      if (!dados?.usarProcuracao && dados?.certEscritorio.cadastrado) {
                        handleAlternarModo(true);
                      }
                    }}
                    style={{
                      border: `2px solid ${dados?.usarProcuracao ? '#16a34a' : '#e5e7eb'}`,
                      background: dados?.usarProcuracao ? '#f0fdf4' : '#ffffff',
                      borderRadius: 10, padding: 16, cursor: dados?.certEscritorio.cadastrado ? 'pointer' : 'default',
                      position: 'relative', transition: 'all .15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13.5, color: dados?.usarProcuracao ? '#166534' : '#111827' }}>
                        <Building size={16} color={dados?.usarProcuracao ? '#16a34a' : '#6b7280'} />
                        Procuração Escritório
                      </div>
                      {dados?.usarProcuracao && (
                        <span className="badge badge-green" style={{ fontSize: 10.5, padding: '2px 6px' }}>Ativo</span>
                      )}
                    </div>

                    {dados?.certEscritorio.cadastrado ? (
                      <div style={{ fontSize: 12, color: '#4b5563' }}>
                        <div style={{ fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {dados.certEscritorio.titular}
                        </div>
                        <div style={{ color: dados.certEscritorio.vencido ? '#dc2626' : '#16a34a', marginTop: 3, fontWeight: 500 }}>
                          {dados.certEscritorio.vencido ? '⚠️ Certificado Vencido' : `Válido até ${formatData(dados.certEscritorio.validoAte)}`}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                          Status: {dados.certEscritorio.procuracaoStatus === 'ativa' ? 'Procuração Confirmada' : 'Cadastrada no escritório'}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', marginTop: 6 }}>
                        Escritório sem certificado cadastrado.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Botão de Alternância Explícita se ambos existirem */}
              {dados?.certProprio.cadastrado && dados.certEscritorio.cadastrado && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#f8fafc', padding: '10px 16px', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20
                }}>
                  <div style={{ fontSize: 12.5, color: '#334155' }}>
                    Origem selecionada: <strong>{dados.usarProcuracao ? 'Procuração do Escritório' : 'Certificado Próprio A1'}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      disabled={alternandoModo}
                      onClick={() => handleAlternarModo(!dados.usarProcuracao)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 12 }}
                    >
                      {dados.usarProcuracao ? 'Mudar para Certificado Próprio' : 'Mudar para Procuração'}
                    </button>
                    {!dados.usarProcuracao && (
                      <button
                        type="button"
                        onClick={handleRemoverCertProprio}
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#dc2626', fontSize: 12 }}
                        title="Remover arquivo do certificado próprio"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Seção de Upload / Troca do Certificado Próprio A1 (Estilo SIEG) */}
              <div style={{
                border: '1px solid #e5e7eb', borderRadius: 10, padding: 18, background: '#ffffff'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Upload size={16} color="#2563eb" />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                    {dados?.certProprio.cadastrado ? 'Substituir / Atualizar Certificado A1' : 'Cadastrar Certificado A1 da Empresa'}
                  </span>
                </div>

                <form onSubmit={handleEnviarCertificado}>
                  {/* Dropzone do Arquivo PFX */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed #cbd5e1', borderRadius: 8, padding: '20px 16px',
                      textAlign: 'center', cursor: 'pointer', background: arquivo ? '#eff6ff' : '#f8fafc',
                      marginBottom: 14, transition: 'all .15s'
                    }}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".pfx,.p12"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setArquivo(f);
                      }}
                    />
                    {arquivo ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#1e40af' }}>
                        <FileCheck size={20} />
                        <span style={{ fontWeight: 500, fontSize: 13.5 }}>{arquivo.name}</span>
                        <span style={{ fontSize: 11.5, color: '#6b7280' }}>({(arquivo.size / 1024).toFixed(1)} KB)</span>
                      </div>
                    ) : (
                      <div>
                        <Upload size={22} style={{ margin: '0 auto 6px', color: '#64748b' }} />
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#334155' }}>
                          Clique para selecionar ou arraste o arquivo <strong>.pfx</strong> ou <strong>.p12</strong>
                        </div>
                        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
                          O arquivo é criptografado em cofre AES-256 e nunca é exposto
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Campo de Senha */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>
                      Senha do Certificado Digital
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={mostrarSenha ? 'text' : 'password'}
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        placeholder="Digite a senha do arquivo PFX"
                        style={{
                          width: '100%', padding: '9px 36px 9px 12px', fontSize: 13,
                          border: '1px solid #d1d5db', borderRadius: 6, outline: 'none'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarSenha(o => !o)}
                        style={{
                          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                          background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280'
                        }}
                      >
                        {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Botão de Envio */}
                  <button
                    type="submit"
                    disabled={enviando || !arquivo || !senha}
                    className="btn btn-primary"
                    style={{
                      width: '100%', padding: '10px 16px', fontSize: 13.5,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      opacity: enviando || !arquivo || !senha ? 0.6 : 1
                    }}
                  >
                    {enviando ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        Validando e Criptografando...
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={16} />
                        Salvar e Usar Certificado Próprio A1
                      </>
                    )}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>

        {/* Rodapé */}
        <div style={{
          padding: '14px 24px', background: '#f9fafb', borderTop: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10
        }}>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ fontSize: 13 }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

