'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { ShieldCheck, ShieldOff, Copy } from 'lucide-react';

interface TwoFactorModalProps {
  open: boolean;
  enabled: boolean;
  onClose: () => void;
  onChanged: (enabled: boolean) => void;
}

type Step = 'status' | 'setup' | 'backup-codes' | 'disable';

export default function TwoFactorModal({ open, enabled, onClose, onChanged }: TwoFactorModalProps) {
  const [step, setStep] = useState<Step>('status');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [secret, setSecret] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [password, setPassword] = useState('');

  if (!open) return null;

  const reset = () => {
    setStep('status');
    setError('');
    setSecret('');
    setQrCodeDataUrl('');
    setCode('');
    setBackupCodes([]);
    setPassword('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const startSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST' });
      const result = await res.json();
      if (!res.ok) { setError(result.error || 'Erro ao iniciar configuração.'); setLoading(false); return; }
      setSecret(result.secret);
      setQrCodeDataUrl(result.qrCodeDataUrl);
      setStep('setup');
    } catch {
      setError('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  const confirmSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, code }),
      });
      const result = await res.json();
      if (!res.ok) { setError(result.error || 'Código incorreto.'); setLoading(false); return; }
      setBackupCodes(result.backupCodes);
      setStep('backup-codes');
      onChanged(true);
    } catch {
      setError('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  const confirmDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const result = await res.json();
      if (!res.ok) { setError(result.error || 'Senha incorreta.'); setLoading(false); return; }
      onChanged(false);
      toast.success('Verificação em duas etapas desativada.');
      handleClose();
    } catch {
      setError('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    toast.success('Códigos de backup copiados.');
  };

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 className="modal-title">Verificação em Duas Etapas</h2>
          <button className="modal-close" onClick={handleClose}>✕</button>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 16, color: '#dc2626', background: '#fef2f2', padding: 12, borderRadius: 8, fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {step === 'status' && (
          <div>
            {enabled ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--green)', fontWeight: 600, marginBottom: 12 }}>
                  <ShieldCheck size={18} /> Verificação em duas etapas ativa
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                  Sua conta pede um código do seu aplicativo autenticador a cada login.
                </p>
                <div className="form-actions">
                  <button className="btn btn-secondary" onClick={handleClose}>Fechar</button>
                  <button className="btn btn-danger" onClick={() => setStep('disable')}>Desativar</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 12 }}>
                  <ShieldOff size={18} /> Verificação em duas etapas desativada
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                  Adicione uma camada extra de segurança exigindo um código do Google Authenticator (ou similar) a cada login.
                </p>
                <div className="form-actions">
                  <button className="btn btn-secondary" onClick={handleClose}>Cancelar</button>
                  <button className="btn btn-primary" onClick={startSetup} disabled={loading}>
                    {loading ? '⏳ Gerando...' : 'Ativar'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {step === 'setup' && (
          <form onSubmit={confirmSetup}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              1. Escaneie o QR code com o Google Authenticator, Authy ou similar.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              {qrCodeDataUrl && <img src={qrCodeDataUrl} alt="QR Code 2FA" style={{ width: 180, height: 180, background: '#fff', padding: 8, borderRadius: 8 }} />}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 20, wordBreak: 'break-all' }}>
              Não consegue escanear? Digite manualmente: <strong>{secret}</strong>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
              2. Digite o código de 6 dígitos gerado pelo app:
            </p>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <input
                type="text"
                inputMode="numeric"
                className="form-control"
                placeholder="000000"
                value={code}
                onChange={e => setCode(e.target.value)}
                required
                autoFocus
                style={{ fontSize: 20, letterSpacing: 4, textAlign: 'center' }}
              />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={handleClose}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? '⏳ Confirmando...' : 'Confirmar e Ativar'}
              </button>
            </div>
          </form>
        )}

        {step === 'backup-codes' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--green)', fontWeight: 600, marginBottom: 12 }}>
              <ShieldCheck size={18} /> Ativado com sucesso!
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Guarde estes códigos de backup em um lugar seguro. Cada um pode ser usado uma vez para entrar caso você perca acesso ao seu app autenticador. Eles não serão mostrados novamente.
            </p>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontFamily: 'monospace', fontSize: 13,
              background: 'var(--bg-card2)', border: '1px solid var(--border-light)', borderRadius: 8, padding: 14, marginBottom: 12
            }}>
              {backupCodes.map(c => <div key={c}>{c}</div>)}
            </div>
            <button className="btn btn-secondary btn-sm" style={{ marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={copyBackupCodes}>
              <Copy size={13} /> Copiar códigos
            </button>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleClose}>Concluído, já salvei</button>
            </div>
          </div>
        )}

        {step === 'disable' && (
          <form onSubmit={confirmDisable}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Confirme sua senha para desativar a verificação em duas etapas.
            </p>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Senha</label>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setStep('status')}>Voltar</button>
              <button type="submit" className="btn btn-danger" disabled={loading}>
                {loading ? '⏳ Verificando...' : 'Desativar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
