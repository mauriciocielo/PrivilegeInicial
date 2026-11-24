'use client';

import React, { useState } from 'react';
import { KeyRound, ShieldCheck, Upload, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface CertAtual {
  nomeArquivo: string | null;
  titular: string | null;
  cnpj: string | null;
  validoAte: string | null;
}

interface Props {
  empresaId: string;
  empresaNome: string;
  empresaCnpj: string;
  certificadoAtual: CertAtual | null;
  usarProcuracao: boolean;
  onFechar: () => void;
  onSalvo: () => void;
}

function lerArquivoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(',')[1] || '');
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    leitor.readAsDataURL(arquivo);
  });
}

export default function NfseCertificadoClienteModal({
  empresaId,
  empresaNome,
  empresaCnpj,
  certificadoAtual,
  usarProcuracao,
  onFechar,
  onSalvo,
}: Props) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [senha, setSenha] = useState('');
  const [salvando, setSalvando] = useState(false);

  const vencido = Boolean(certificadoAtual?.validoAte && new Date(certificadoAtual.validoAte).getTime() < Date.now());

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!arquivo || !senha) {
      toast.error('Selecione o arquivo .pfx/.p12 e informe a senha do certificado.');
      return;
    }
    setSalvando(true);
    try {
      const pfxBase64 = await lerArquivoBase64(arquivo);
      const res = await fetch(`/api/empresas/${empresaId}/nfse-certificado-cliente`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pfxBase64, senha, nomeArquivo: arquivo.name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Não foi possível salvar o certificado.');
        return;
      }
      toast.success('Certificado Digital A1 salvo com segurança! Sua empresa já pode emitir NFS-e.');
      onSalvo();
    } catch {
      toast.error('Erro de conexão ao enviar o certificado.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      onClick={onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.55)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 520,
          padding: 22,
          boxShadow: '0 24px 60px rgba(0,0,0,0.28)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <KeyRound size={20} style={{ color: 'var(--accent)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
                Meu Certificado Digital A1
              </h3>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {empresaNome} · CNPJ {empresaCnpj}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            style={{ border: 'none', background: 'var(--bg-secondary)', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Status atual */}
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            marginBottom: 16,
            border: `1px solid ${vencido ? 'rgba(220,38,38,0.35)' : 'var(--border)'}`,
            background: vencido ? 'rgba(220,38,38,0.06)' : 'var(--bg-secondary)',
            fontSize: 12.5,
          }}
        >
          {!usarProcuracao && certificadoAtual ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              {vencido ? <AlertTriangle size={18} color="#dc2626" /> : <ShieldCheck size={18} color="#16a34a" />}
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{certificadoAtual.titular}</div>
                <div style={{ color: vencido ? '#dc2626' : 'var(--text-muted)', marginTop: 2 }}>
                  {vencido ? 'Vencido em ' : 'Válido até '}
                  {certificadoAtual.validoAte ? new Date(certificadoAtual.validoAte).toLocaleDateString('pt-BR') : '—'}
                </div>
              </div>
            </div>
          ) : usarProcuracao ? (
            <div style={{ color: 'var(--text-secondary)' }}>
              Esta empresa está configurada para emitir por procuração. Caso queira emitir usando seu <strong>próprio Certificado A1</strong> de forma independente, basta enviá-lo abaixo.
            </div>
          ) : (
            <div style={{ color: 'var(--text-secondary)' }}>
              Nenhum Certificado Digital A1 cadastrado ainda. Envie o arquivo <code>.pfx</code> ou <code>.p12</code> da sua empresa para emitir NFS-e direto pelo Portal Nacional.
            </div>
          )}
        </div>

        <form onSubmit={handleSalvar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="form-label">Arquivo do Certificado A1 (.pfx ou .p12) *</label>
            <input
              type="file"
              accept=".pfx,.p12"
              className="form-control"
              onChange={(e) => setArquivo(e.target.files?.[0] || null)}
            />
          </div>

          <div>
            <label className="form-label">Senha do Certificado *</label>
            <input
              type="password"
              className="form-control"
              autoComplete="new-password"
              placeholder="Digite a senha do certificado A1"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>
            Seu arquivo e senha são criptografados com chave exclusiva da sua empresa (AES-256-GCM) e usados somente na assinatura/transmissão das suas NFS-e no Portal Nacional.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button type="button" className="btn btn-secondary" onClick={onFechar}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={salvando || !arquivo || !senha}>
              <Upload size={14} /> {salvando ? 'Validando e salvando...' : 'Salvar Certificado A1'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
