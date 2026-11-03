'use client';
import { SEM_RETENCAO, TRIBUTOS_RETIDOS, type RegraRetencao, type TomadorRegra } from '../lib/nfse/retencao';

interface Props {
  regras: RegraRetencao[];
  mei: boolean;
  simples: boolean;
  onChange: (regras: RegraRetencao[]) => void;
}

const novaRegra = (n: number): RegraRetencao => ({
  id: `regra-${Date.now()}-${n}`,
  nome: `Regra ${n}`,
  ativa: true,
  servicos: [],
  tomador: 'pj',
  valorMinimo: 0,
  issRetido: false,
  aliquotaIss: null,
  percentuais: { ...SEM_RETENCAO },
});

/** Quando reter é decisão da contabilidade: o sistema não presume percentual nem obrigação. */
export default function NfseRegrasRetencao({ regras, mei, simples, onChange }: Props) {
  const alterar = (id: string, mudanca: Partial<RegraRetencao>) => onChange(regras.map(r => (r.id === id ? { ...r, ...mudanca } : r)));

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
        A regra preenche as retenções ao criar a nota, e você pode ajustar nota a nota. A regra de um serviço específico tem prioridade sobre a geral. Sem regra aplicável, a nota sai sem retenção.
      </div>
      {mei && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>MEI não pode informar tributos federais nem sofrer retenção de ISS: regras não se aplicam.</div>}
      {simples && !mei && <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 10 }}>Em empresa do Simples, confirme com a contabilidade quais retenções federais valem antes de ativar uma regra.</div>}

      {regras.map(r => (
        <div key={r.id} style={{ border: '1px solid var(--border-light)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Nome</label>
              <input className="form-control" value={r.nome} onChange={e => alterar(r.id, { nome: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Tomador</label>
              <select className="form-control" value={r.tomador} onChange={e => alterar(r.id, { tomador: e.target.value as TomadorRegra })}>
                <option value="pj">Pessoa jurídica</option>
                <option value="pf">Pessoa física</option>
                <option value="todos">Todos</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">A partir de (R$)</label>
              <input type="number" min="0" step="0.01" className="form-control" value={r.valorMinimo} onChange={e => alterar(r.id, { valorMinimo: Number(e.target.value) })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Serviços (códigos de 6 dígitos, separados por vírgula; vazio vale para todos)</label>
            <input className="form-control" placeholder="Ex.: 170101, 010101" defaultValue={r.servicos.join(', ')}
              onBlur={e => alterar(r.id, { servicos: e.target.value.split(/[,;\s]+/).map(s => s.replace(/\D/g, '')).filter(s => s.length === 6) })} />
          </div>
          <div className="form-row">
            {TRIBUTOS_RETIDOS.map(t => (
              <div className="form-group" key={t.chave}>
                <label className="form-label">{t.nome} (%)</label>
                <input type="number" min="0" max="100" step="0.01" className="form-control" value={r.percentuais[t.chave]}
                  onChange={e => alterar(r.id, { percentuais: { ...r.percentuais, [t.chave]: Number(e.target.value) } })} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={r.issRetido} onChange={e => alterar(r.id, { issRetido: e.target.checked })} />
              Reter ISS
            </label>
            {r.issRetido && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                Alíquota do ISS (%)
                <input type="number" min="0" max="100" step="0.01" className="form-control" style={{ width: 90 }} value={r.aliquotaIss ?? ''}
                  onChange={e => alterar(r.id, { aliquotaIss: e.target.value === '' ? null : Number(e.target.value) })} />
              </label>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={r.ativa} onChange={e => alterar(r.id, { ativa: e.target.checked })} />
              Ativa
            </label>
            <button type="button" className="btn btn-danger btn-sm" style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 8px' }}
              onClick={() => onChange(regras.filter(x => x.id !== r.id))}>🗑️ Remover</button>
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-secondary" onClick={() => onChange([...regras, novaRegra(regras.length + 1)])}>＋ Nova regra de retenção</button>
    </div>
  );
}
