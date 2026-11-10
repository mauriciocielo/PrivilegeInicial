'use client';
import type { PlanoConta, Portador } from '../lib/store';

export interface FinanceiroNota {
  gerarContaReceber: boolean;
  emitirBoletoSicoob?: boolean;
  portadorId: string;
  planoContaId: string;
  vencimento: string;
}

export function financeiroInvalido(f: FinanceiroNota): string | null {
  if (!f.gerarContaReceber) return null;
  if (!f.vencimento) return 'Informe o vencimento da conta a receber.';
  if (!f.portadorId) return 'Selecione o portador da conta a receber.';
  if (!f.planoContaId) return 'Selecione a categoria de receita da conta a receber.';
  return null;
}

interface Props {
  valor: FinanceiroNota;
  portadores: Portador[];
  planoContas: PlanoConta[];
  onChange: (valor: FinanceiroNota) => void;
  /** Em lote o vencimento pode vir da planilha. */
  ajudaVencimento?: string;
}

/** A conta a receber é opcional: por padrão a nota é apenas emitida para o cliente. */
export default function NfseFinanceiroCampos({ valor, portadores, planoContas, onChange, ajudaVencimento }: Props) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 700,
          color: '#008a49',
          background: 'rgba(0, 168, 89, 0.08)',
          border: '1px solid rgba(0, 168, 89, 0.28)',
          padding: '8px 12px',
          borderRadius: 8,
        }}
      >
        <input
          type="checkbox"
          checked={Boolean(valor.emitirBoletoSicoob)}
          onChange={e =>
            onChange({
              ...valor,
              emitirBoletoSicoob: e.target.checked,
              vencimento:
                valor.vencimento ||
                (() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 7);
                  return d.toISOString().slice(0, 10);
                })(),
            })
          }
        />
        ⚡ Emitir Boleto / Cobrança Pix Sicoob (API Direta mTLS) ao autorizar a NFS-e
      </label>

      {valor.emitirBoletoSicoob && !valor.gerarContaReceber && (
        <div className="form-group" style={{ maxWidth: 220, marginBottom: 0 }}>
          <label className="form-label">Vencimento da Cobrança / Boleto</label>
          <input
            type="date"
            className="form-control"
            value={valor.vencimento}
            onChange={e => onChange({ ...valor, vencimento: e.target.value })}
          />
        </div>
      )}

      {portadores.length === 0 && !valor.gerarContaReceber ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Esta empresa não tem portadores internos cadastrados para conciliação local, mas pode emitir Cobrança / Boleto Sicoob via API normalmente.
        </div>
      ) : (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={valor.gerarContaReceber}
              onChange={e => onChange({ ...valor, gerarContaReceber: e.target.checked })}
            />
            Gerar conta a receber quando a nota for autorizada em produção
          </label>
          {valor.gerarContaReceber && (
            <div className="form-row" style={{ marginTop: 4 }}>
              <div className="form-group">
                <label className="form-label">Vencimento *</label>
                <input
                  type="date"
                  className="form-control"
                  value={valor.vencimento}
                  onChange={e => onChange({ ...valor, vencimento: e.target.value })}
                />
                {ajudaVencimento && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{ajudaVencimento}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Portador / Conta *</label>
                <select
                  className="form-control"
                  value={valor.portadorId}
                  onChange={e => onChange({ ...valor, portadorId: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {portadores.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Categoria de Receita *</label>
                <select
                  className="form-control"
                  value={valor.planoContaId}
                  onChange={e => onChange({ ...valor, planoContaId: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {planoContas.map(pc => (
                    <option key={pc.id} value={pc.id}>
                      {pc.codigo} - {pc.descricao}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
