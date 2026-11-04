'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, FileText, Search } from 'lucide-react';
import { lerJsonResposta } from '../lib/nfe/resposta-cliente';
import { URL_CND_RECEITA, temPdfRelatorio } from '../lib/certidoes/situacao';

interface EmpresaItem {
  id: string;
  nome: string;
  cnpj: string;
}

interface Resultado {
  certidaoId: string;
  situacao: string;
  mensagem?: string;
}

interface Props {
  empresaIdInicial?: string;
  onFechar: () => void;
  empresas?: EmpresaItem[];
}

const ROTULOS: Record<string, { texto: string; classe: string }> = {
  NEGATIVA: { texto: 'Sem pendências no relatório', classe: 'badge-green' },
  POSITIVA_COM_EFEITO_NEGATIVA: { texto: 'Débitos com exigibilidade suspensa', classe: 'badge-blue' },
  POSITIVA: { texto: 'Com pendências', classe: 'badge-red' },
  INDETERMINADA: { texto: 'Conferir no PDF', classe: 'badge-yellow' },
  PROCESSANDO: { texto: 'Em processamento na Receita', classe: 'badge-yellow' },
  ERRO: { texto: 'Erro na consulta', classe: 'badge-red' },
};

/** Consulta avulsa do Relatório de Situação Fiscal (SITFIS), aberta a partir de outras telas. */
export default function CertidaoFederalModal({ empresaIdInicial, onFechar, empresas }: Props) {
  const [empresaId, setEmpresaId] = useState(empresaIdInicial || empresas?.[0]?.id || '');
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [listaEmpresas, setListaEmpresas] = useState<EmpresaItem[]>(empresas || []);

  useEffect(() => {
    if (empresas && empresas.length > 0) return;
    fetch('/api/nfse/emissores')
      .then(lerJsonResposta)
      .then(dados => {
        if (!Array.isArray(dados?.empresas)) return;
        const formatadas: EmpresaItem[] = dados.empresas.map((e: { id: string; nomeFantasia?: string; razaoSocial: string; cnpj: string }) => ({
          id: e.id, nome: e.nomeFantasia || e.razaoSocial, cnpj: e.cnpj,
        }));
        setListaEmpresas(formatadas);
        setEmpresaId(atual => atual || formatadas[0]?.id || '');
      })
      .catch(() => toast.error('Não foi possível carregar as empresas.'));
  }, [empresas]);

  const consultar = async () => {
    if (!empresaId) { toast.error('Selecione uma empresa para consultar.'); return; }
    setCarregando(true);
    setResultado(null);
    try {
      const res = await fetch('/api/certidoes/consultar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId }),
      });
      const dados = await lerJsonResposta(res);
      if (!res.ok) { toast.error(dados.error || 'Não foi possível consultar a situação fiscal.'); return; }
      setResultado(dados.resultado);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro de conexão ao consultar a situação fiscal.');
    } finally {
      setCarregando(false);
    }
  };

  const rotulo = resultado ? ROTULOS[resultado.situacao] : null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !carregando && onFechar()}>
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <h2 className="modal-title">Situação Fiscal Federal</h2>
          <button type="button" className="modal-close" onClick={onFechar} disabled={carregando}>✕</button>
        </div>

        <div className="form-group">
          <label className="form-label">Empresa</label>
          <select
            className="form-control"
            value={empresaId}
            disabled={carregando}
            onChange={e => { setEmpresaId(e.target.value); setResultado(null); }}
          >
            {listaEmpresas.map(e => <option key={e.id} value={e.id}>{e.nome} — {e.cnpj}</option>)}
          </select>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Gera o Relatório de Situação Fiscal (SITFIS) pelo Integra Contador. Ele mostra as pendências na Receita e na PGFN, mas não é uma certidão.
        </p>

        {resultado && rotulo && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <span className={`badge ${rotulo.classe}`}>{rotulo.texto}</span>
            {resultado.mensagem && <div style={{ fontSize: 13, marginTop: 8 }}>{resultado.mensagem}</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {temPdfRelatorio(resultado.situacao) && (
                <a className="btn btn-secondary btn-sm" href={`/api/certidoes/${resultado.certidaoId}/download`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={13} /> Abrir relatório em PDF
                </a>
              )}
              <a className="btn btn-secondary btn-sm" href={URL_CND_RECEITA} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ExternalLink size={13} /> Emitir a certidão na Receita
              </a>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onFechar} disabled={carregando}>Fechar</button>
          <button type="button" className="btn btn-primary" onClick={consultar} disabled={carregando || !empresaId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Search size={14} /> {carregando ? 'Consultando...' : 'Consultar'}
          </button>
        </div>
      </div>
    </div>
  );
}
