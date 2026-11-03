'use client';
import type { PlanoConta, Portador } from '../lib/store';

export interface FinanceiroNota {
  gerarContaReceber: boolean;
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
  // Empresa só emissora (por procuração) não tem contas nem categorias: a nota é só emitida.
  if (portadores.length === 0 && !valor.gerarContaReceber) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Esta empresa não tem portadores cadastrados, então a nota não gera conta a receber.</div>;
  }

  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
        <input type="checkbox" checked={valor.gerarContaReceber} onChange={e => onChange({ ...valor, gerarContaReceber: e.target.checked })} />
        Gerar conta a receber quando a nota for autorizada em produção
      </label>
      {valor.gerarContaReceber && (
        <div className="form-row" style={{ marginTop: 12 }}>
          <div className="form-group">
            <label className="form-label">Vencimento *</label>
            <input type="date" className="form-control" value={valor.vencimento} onChange={e => onChange({ ...valor, vencimento: e.target.value })} />
            {ajudaVencimento && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{ajudaVencimento}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Portador / Conta *</label>
            <select className="form-control" value={valor.portadorId} onChange={e => onChange({ ...valor, portadorId: e.target.value })}>
              <option value="">Selecione...</option>
              {portadores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 2 }}>
            <label className="form-label">Categoria de Receita *</label>
            <select className="form-control" value={valor.planoContaId} onChange={e => onChange({ ...valor, planoContaId: e.target.value })}>
              <option value="">Selecione...</option>
              {planoContas.map(pc => <option key={pc.id} value={pc.id}>{pc.codigo} - {pc.descricao}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
