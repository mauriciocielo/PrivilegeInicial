'use client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Download, RefreshCw, Calculator, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { ALIQUOTAS_INTERNAS_PADRAO, type ItemCalculoDifal, type RelatorioDifalResultado } from '../lib/nfe/difal';

interface Props {
  empresaId: string;
  empresaNome: string;
  cnpj: string;
  mesPadrao?: string;
  onClose: () => void;
}

export default function NfeDifalModal({ empresaId, empresaNome, cnpj, mesPadrao, onClose }: Props) {
  const [mes, setMes] = useState(mesPadrao || new Date().toISOString().slice(0, 7));
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [ufDestino, setUfDestino] = useState('PR');
  const [apenasInterestaduais, setApenasInterestaduais] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [dados, setDados] = useState<RelatorioDifalResultado | null>(null);

  const carregarRelatorio = async () => {
    try {
      setCarregando(true);
      const params = new URLSearchParams({
        empresaId,
        ufDestino,
        apenasInterestaduais: String(apenasInterestaduais),
      });
      if (mes) params.set('mes', mes);
      if (de) params.set('de', de);
      if (ate) params.set('ate', ate);

      const res = await fetch(`/api/nfe/destinadas/difal?${params.toString()}`);
      if (!res.ok) throw new Error('Falha ao calcular DIFAL.');
      const json = await res.json();
      setDados(json);
      if (json.ufDestino) setUfDestino(json.ufDestino);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao carregar cálculo do DIFAL.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarRelatorio();
  }, [mes, de, ate, ufDestino, apenasInterestaduais]);

  const exportarCsv = () => {
    const params = new URLSearchParams({
      empresaId,
      ufDestino,
      formato: 'csv',
      apenasInterestaduais: String(apenasInterestaduais),
    });
    if (mes) params.set('mes', mes);
    if (de) params.set('de', de);
    if (ate) params.set('ate', ate);

    window.open(`/api/nfe/destinadas/difal?${params.toString()}`, '_blank');
  };

  const formatMoney = (v: number) =>
    Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 960, width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ padding: 8, background: '#eff6ff', color: '#2563eb', borderRadius: 8 }}>
              <Calculator size={20} />
            </span>
            <div>
              <h2 className="modal-title" style={{ margin: 0, fontSize: 18 }}>
                Relatório para Cálculo do DIFAL
              </h2>
              <span style={{ fontSize: 12.5, color: '#6b7280' }}>
                {empresaNome} • Diferencial de Alíquota do ICMS (Entradas Interestaduais)
              </span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Barra de Filtros e Parâmetros */}
        <div style={{
          background: '#f9fafb', borderRadius: 8, padding: '12px 16px', border: '1px solid #e5e7eb',
          margin: '16px 0', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center'
        }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: 4 }}>
              Mês de Apuração:
            </label>
            <input
              type="month"
              value={mes}
              onChange={(e) => { setMes(e.target.value); setDe(''); setAte(''); }}
              style={{ padding: '6px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: 4 }}>
              UF de Destino:
            </label>
            <select
              value={ufDestino}
              onChange={(e) => setUfDestino(e.target.value)}
              style={{ padding: '6px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff' }}
            >
              {Object.keys(ALIQUOTAS_INTERNAS_PADRAO).sort().map(uf => (
                <option key={uf} value={uf}>
                  {uf} ({ALIQUOTAS_INTERNAS_PADRAO[uf]}% interna)
                </option>
              ))}
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#4b5563', cursor: 'pointer', marginTop: 18 }}>
            <input
              type="checkbox"
              checked={apenasInterestaduais}
              onChange={(e) => setApenasInterestaduais(e.target.checked)}
              style={{ accentColor: '#2563eb' }}
            />
            <span>Apenas Interestaduais</span>
          </label>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              onClick={exportarCsv}
              disabled={!dados || dados.itens.length === 0}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            >
              <FileSpreadsheet size={14} color="#16a34a" /> Exportar CSV
            </button>
            <button
              onClick={carregarRelatorio}
              disabled={carregando}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            >
              <RefreshCw size={13} className={carregando ? 'animate-spin' : ''} />
              Recalcular
            </button>
          </div>
        </div>

        {/* Cards de Totais */}
        {dados && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Notas Sujeitas a DIFAL</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginTop: 2 }}>
                {dados.totais.totalInterestaduais}
              </div>
              <span style={{ fontSize: 11, color: '#6b7280' }}>de {dados.totais.totalNotas} analisadas</span>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Total das Compras</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginTop: 2 }}>
                {formatMoney(dados.totais.valorTotalNotas)}
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Base de Cálculo ICMS</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#2563eb', marginTop: 2 }}>
                {formatMoney(dados.totais.baseCalculoTotal)}
              </div>
            </div>

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: '#166534', fontWeight: 600, textTransform: 'uppercase' }}>DIFAL a Recolher (Estimado)</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#15803d', marginTop: 2 }}>
                {formatMoney(dados.totais.difalTotalEstimado)}
              </div>
              <span style={{ fontSize: 11, color: '#166534' }}>Alíquota UF {ufDestino}: {dados.aliquotaInternaPadrao}%</span>
            </div>
          </div>
        )}

        {/* Tabela de Itens e Cálculos */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563' }}>
                <th style={{ padding: '10px 12px' }}>Emissão</th>
                <th style={{ padding: '10px 12px' }}>NF / Série</th>
                <th style={{ padding: '10px 12px' }}>Fornecedor</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Origem → Destino</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Valor Total</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Base ICMS</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Aliq. Inter.</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Aliq. Interna</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Diferencial</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>DIFAL Estimado</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={10} style={{ padding: 30, textAlign: 'center', color: '#6b7280' }}>
                    <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px', color: '#2563eb' }} />
                    Calculando diferencial de alíquotas...
                  </td>
                </tr>
              ) : !dados || dados.itens.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: 36, textAlign: 'center', color: '#6b7280' }}>
                    <AlertCircle size={24} style={{ margin: '0 auto 6px', color: '#9ca3af' }} />
                    Nenhuma nota fiscal interestadual encontrada no período selecionado.
                  </td>
                </tr>
              ) : (
                dados.itens.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      {item.dataEmissao ? new Date(item.dataEmissao + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      NF {item.numero} <span style={{ color: '#6b7280', fontSize: 11 }}>({item.serie})</span>
                    </td>
                    <td style={{ padding: '8px 12px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.emitenteNome}>
                      {item.emitenteNome || item.emitenteCnpj}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span className="badge" style={{
                        background: item.isInterestadual ? '#fef3c7' : '#f3f4f6',
                        color: item.isInterestadual ? '#92400e' : '#4b5563',
                        fontWeight: 600, fontSize: 11
                      }}>
                        {item.ufOrigem || '??'} → {item.ufDestino}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {formatMoney(item.valorTotalNf)}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap', color: '#2563eb' }}>
                      {formatMoney(item.baseCalculoIcms)}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {item.aliquotaInterestadual}%
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {item.aliquotaInterna}%
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {item.diferencialAliquota.toFixed(1)}%
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700, color: '#15803d' }}>
                      {formatMoney(item.valorDifalEstimado)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-secondary">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

