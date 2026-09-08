'use client';
import { useState, useEffect } from 'react';

export interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface ConfirmState {
  message: string;
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

type ShowConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;
let showConfirmImpl: ShowConfirmFn | null = null;

/**
 * Substitui o `window.confirm()` nativo por um modal consistente com o resto
 * da UI, sem travar a thread — use com `await`. Se o provider ainda não
 * montou (ex: chamada muito cedo no boot), cai de volta no confirm nativo.
 */
export function confirmAsync(message: string, options?: ConfirmOptions): Promise<boolean> {
  if (!showConfirmImpl) {
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(message) : false);
  }
  return showConfirmImpl(message, options);
}

export default function ConfirmProvider() {
  const [state, setState] = useState<ConfirmState | null>(null);

  useEffect(() => {
    showConfirmImpl = (message, options = {}) => {
      return new Promise<boolean>((resolve) => {
        setState({ message, options, resolve });
      });
    };
    return () => { showConfirmImpl = null; };
  }, []);

  const handle = (result: boolean) => {
    state?.resolve(result);
    setState(null);
  };

  if (!state) return null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && handle(false)}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2>{state.options.title || 'Confirmar ação'}</h2>
        </div>
        <div className="modal-body">
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
            {state.message}
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => handle(false)}>
            {state.options.cancelText || 'Cancelar'}
          </button>
          <button
            className={`btn ${state.options.danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => handle(true)}
            autoFocus
          >
            {state.options.confirmText || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
