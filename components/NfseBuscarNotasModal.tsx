'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import type { NfsE } from '../lib/store';

// Uma empresa grande pode ter muitos milhares de documentos: cada chamada lê poucas páginas.
const MAX_CHAMADAS = 120;

interface Props {
  empresaId: string;
  empresaNome: string;
  onFechar: () => void;
  /** Chamado a cada lote, para a tela mostrar as notas conforme chegam. */
  onNotas: (notas: NfsE[]) => void;
  onConcluir: () => void;
}

export default function NfseBuscarNotasModal({ empresaId, empresaNome, onFechar, onNotas, onConcluir }: Props) {
  const [meses, setMeses] = useState(3);
  const [reiniciar, setReiniciar] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [criadas, setCriadas] = useState(0);
  const [resultado, setResultado] = useState('');

  const buscar = async () => {
    setBuscando(true);
    setCriadas(0);
    setResultado('');
    let total = 0;
    let totalEmitidas = 0;
    let totalTomadas = 0;
    let fora = 0;
    try {
      for (let i = 0; i < MAX_CHAMADAS; i++) {
        const res = await fetch(`/api/nfse/emissores/${empresaId}/notas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meses, reiniciar: i === 0 && reiniciar }),
        });
        const dados = await res.json().catch(() => ({}));
        if (!res.ok) {
          setResultado(`${dados.error || 'Não foi possível buscar as notas.'}${total > 0 ? ` Já trazidas: ${total}.` : ''}`);
          return;
        }
        if (dados.notas?.length) onNotas(dados.notas);
        total += dados.criadas || 0;
        totalEmitidas += dados.criadasEmitidas || 0;
        totalTomadas += dados.criadasTomadas || 0;
        fora += dados.foraDoPeriodo || 0;
        setCriadas(total);
        if (!dados.temMais) {
          setResultado(total > 0
            ? `${total} documento(s) novo(s) trazido(s) do portal (${totalEmitidas} emitido(s) e ${totalTomadas} serviço(s) tomado(s)).`
            : `Nenhuma nota nova neste período.${fora > 0 ? ` ${fora} nota(s) mais antiga(s) ficaram de fora.` : ''}`);
          toast.success('Busca no portal concluída.');
          onConcluir();
          return;
        }
      }
      setResultado(`Lidas ${total} nota(s) até o limite desta busca. Clique em Buscar de novo para continuar de onde parou.`);
    } catch {
      setResultado('A conexão caiu. Clique em Buscar de novo: a leitura continua de onde parou.');
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !buscando && onFechar()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2 className="modal-title">📥 Buscar notas e serviços tomados do portal</h2>
          <button className="modal-close" onClick={onFechar} disabled={buscando}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
          Traz do Ambiente de Dados Nacional (ADN) tanto as <strong>notas emitidas</strong> quanto os <strong>serviços tomados</strong> por <strong>{empresaNome}</strong>. Só lê documentos reais de produção, com XML e PDF oficiais disponíveis para download.
        </div>
        <div className="form-group">
          <label className="form-label">Período</label>
          <select className="form-control" value={meses} onChange={e => setMeses(Number(e.target.value))} disabled={buscando}>
            <option value={1}>Mês atual e anterior</option>
            <option value={3}>Últimos 3 meses</option>
            <option value={6}>Últimos 6 meses</option>
            <option value={12}>Últimos 12 meses</option>
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={reiniciar} onChange={e => setReiniciar(e.target.checked)} disabled={buscando} />
          Reler desde o início do lote no ADN (recomendado para capturar serviços tomados de períodos já consultados)
        </label>
        {(buscando || resultado) && (
          <div style={{ fontSize: 13, marginTop: 8 }}>
            {buscando ? `⏳ Lendo o portal... ${criadas} nota(s) trazida(s) até agora.` : resultado}
          </div>
        )}
        <div className="form-actions" style={{ marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onFechar} disabled={buscando}>Fechar</button>
          <button className="btn btn-primary" onClick={buscar} disabled={buscando}>{buscando ? '⏳ Buscando...' : '📥 Buscar'}</button>
        </div>
      </div>
    </div>
  );
}
