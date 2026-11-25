'use client';
import { useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  empresaNome: string;
  buscandoEmSegundoPlano?: boolean;
  onFechar: () => void;
  onIniciarBusca: (meses: number, reiniciar: boolean) => void;
}

export default function NfseBuscarNotasModal({
  empresaNome,
  buscandoEmSegundoPlano = false,
  onFechar,
  onIniciarBusca,
}: Props) {
  const [meses, setMeses] = useState(3);
  const [reiniciar, setReiniciar] = useState(true);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="modal-overlay nfse-ui"
      style={{ zIndex: 9999 }}
      onClick={e => e.target === e.currentTarget && onFechar()}
    >
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2 className="modal-title">Buscar notas e serviços tomados do portal</h2>
          <button className="modal-close" onClick={onFechar}>✕</button>
        </div>
        <div style={{ fontSize: 14.5, color: 'var(--text-secondary)', marginBottom: 14 }}>
          Traz do Ambiente de Dados Nacional (ADN) tanto as <strong>notas emitidas</strong> quanto os <strong>serviços tomados</strong> por <strong>{empresaNome}</strong>. A busca roda em <strong>segundo plano</strong> para você continuar usando o sistema normalmente.
        </div>
        <div className="form-group">
          <label className="form-label">Período</label>
          <select className="form-control" value={meses} onChange={e => setMeses(Number(e.target.value))}>
            <option value={1}>Mês atual e anterior</option>
            <option value={3}>Últimos 3 meses</option>
            <option value={6}>Últimos 6 meses</option>
            <option value={12}>Últimos 12 meses</option>
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-secondary)', marginTop: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={reiniciar} onChange={e => setReiniciar(e.target.checked)} />
          Reler desde o início do lote no ADN (recomendado para capturar serviços tomados de períodos já consultados)
        </label>
        {buscandoEmSegundoPlano && (
          <div style={{ fontSize: 13, color: '#2563eb', marginTop: 10, fontWeight: 600 }}>
            Já existe uma busca no ADN rodando em segundo plano. Aguarde concluir para iniciar outra.
          </div>
        )}
        <div className="form-actions" style={{ marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onFechar}>Fechar</button>
          <button
            className="btn btn-primary"
            disabled={buscandoEmSegundoPlano}
            onClick={() => {
              onIniciarBusca(meses, reiniciar);
              onFechar();
            }}
          >
            {buscandoEmSegundoPlano ? 'Busca em andamento...' : 'Buscar em 2º plano'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
