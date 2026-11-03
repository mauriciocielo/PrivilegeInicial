'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Cliente, NfsE, PlanoConta, Portador } from '../lib/store';
import { fmt } from '../lib/reports';
import { hojeBrasilia } from '../lib/nfse/dps';
import {
  MAX_LINHAS_IMPORTACAO, baixarModeloImportacao, existeNotaIgual, interpretarLinhas, lerPlanilha,
  type DadosCopiaveis, type LinhaImportada, type PadroesImportacao,
} from '../lib/nfse/lote';
import NfseFinanceiroCampos, { financeiroInvalido, type FinanceiroNota } from './NfseFinanceiroCampos';

const TAMANHO_MAX_ARQUIVO = 5 * 1024 * 1024;

interface Props {
  notas: NfsE[];
  clientes: Cliente[];
  padroes: Omit<PadroesImportacao, 'competencia'>;
  portadores: Portador[];
  planoContas: PlanoConta[];
  onFechar: () => void;
  onCriar: (itens: DadosCopiaveis[], financeiro: FinanceiroNota) => void;
}

export default function NfseImportarModal({ notas, clientes, padroes, portadores, planoContas, onFechar, onCriar }: Props) {
  const mesAtual = hojeBrasilia().slice(0, 7);
  const [competencia, setCompetencia] = useState(mesAtual);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [linhas, setLinhas] = useState<LinhaImportada[] | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [lendo, setLendo] = useState(false);
  const [financeiro, setFinanceiro] = useState<FinanceiroNota>({ gerarContaReceber: false, portadorId: '', planoContaId: '', vencimento: hojeBrasilia() });

  const jaExiste = (l: LinhaImportada) => existeNotaIgual(notas, l.dados);

  const processar = async (selecionado: File, competenciaPadrao: string) => {
    if (selecionado.size > TAMANHO_MAX_ARQUIVO) { toast.error('O arquivo passa de 5 MB.'); return; }
    setLendo(true);
    try {
      const brutas = await lerPlanilha(await selecionado.arrayBuffer(), selecionado.name);
      if (brutas.length > MAX_LINHAS_IMPORTACAO) {
        toast.error(`A planilha tem ${brutas.length} linhas. O limite é ${MAX_LINHAS_IMPORTACAO} por importação.`);
        return;
      }
      const interpretadas = interpretarLinhas(brutas, { ...padroes, competencia: competenciaPadrao }, clientes);
      if (interpretadas.length === 0) toast.error('Nenhuma nota encontrada na primeira aba da planilha.');
      setLinhas(interpretadas);
      setSelecionadas(new Set(interpretadas.filter(l => l.erros.length === 0 && !jaExiste(l)).map(l => l.linha)));
    } catch {
      toast.error('Não foi possível ler o arquivo. Use .xlsx, .xls ou .csv.');
    } finally {
      setLendo(false);
    }
  };

  const alternar = (linha: number) => setSelecionadas(atual => {
    const novo = new Set(atual);
    if (novo.has(linha)) novo.delete(linha); else novo.add(linha);
    return novo;
  });

  const escolhidas = (linhas || []).filter(l => selecionadas.has(l.linha) && l.erros.length === 0);
  const comErro = (linhas || []).filter(l => l.erros.length > 0).length;
  const total = escolhidas.reduce((soma, l) => soma + l.dados.valorServicos, 0);

  const importar = () => {
    const invalido = financeiroInvalido(financeiro);
    if (invalido) { toast.error(invalido); return; }
    onCriar(escolhidas.map(l => l.dados), financeiro);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="modal modal-lg" style={{ maxWidth: 860, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2 className="modal-title">📥 Importar lista de notas</h2>
          <button className="modal-close" onClick={onFechar}>✕</button>
        </div>

        <div className="form-row">
          <div className="form-group" style={{ flex: 2 }}>
            <label className="form-label">Planilha (.xlsx, .xls ou .csv)</label>
            <input type="file" accept=".xlsx,.xls,.csv" style={{ fontSize: 12 }} onChange={e => {
              const selecionado = e.target.files?.[0] || null;
              setArquivo(selecionado);
              setLinhas(null);
              if (selecionado) processar(selecionado, competencia);
            }} />
          </div>
          <div className="form-group">
            <label className="form-label">Competência das linhas sem esse dado</label>
            <input type="month" className="form-control" max={mesAtual} value={competencia} onChange={e => {
              setCompetencia(e.target.value);
              if (arquivo) processar(arquivo, e.target.value);
            }} />
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          Obrigatórios: documento e nome do tomador, valor e descrição. Código do serviço e município usam o padrão da configuração se ficarem vazios.{' '}
          <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => baixarModeloImportacao()}>⬇️ Baixar modelo</button>
        </div>

        {lendo && <div style={{ fontSize: 13, marginBottom: 16 }}>⏳ Lendo a planilha...</div>}

        {linhas && linhas.length > 0 && !lendo && (
          <>
            {comErro > 0 && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
                {comErro} linha(s) com erro não serão importadas. Corrija na planilha e envie de novo.
              </div>
            )}
            <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 32 }}></th>
                    <th>Linha</th>
                    <th>Tomador</th>
                    <th>Competência</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(l => (
                    <tr key={l.linha} onClick={() => l.erros.length === 0 && alternar(l.linha)} style={{ cursor: l.erros.length === 0 ? 'pointer' : 'default' }}>
                      <td><input type="checkbox" disabled={l.erros.length > 0} checked={selecionadas.has(l.linha)} onChange={() => alternar(l.linha)} onClick={e => e.stopPropagation()} /></td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{l.linha}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{l.dados.tomadorRazaoSocial || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.dados.tomadorCnpjCpf}</div>
                        {l.erros.length > 0 && <div style={{ fontSize: 11, color: 'var(--red)' }}>{l.erros.join('; ')}</div>}
                        {l.erros.length === 0 && jaExiste(l) && <div style={{ fontSize: 11, color: '#f59e0b' }}>Já existe nota igual nesta competência</div>}
                      </td>
                      <td style={{ fontSize: 12 }}>{l.dados.dataCompetencia}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt.currency(l.dados.valorServicos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div style={{ background: 'var(--bg-card2)', borderRadius: 8, padding: 14, border: '1px solid var(--border-light)' }}>
          <NfseFinanceiroCampos
            valor={financeiro}
            portadores={portadores}
            planoContas={planoContas}
            onChange={setFinanceiro}
            ajudaVencimento="Vale para as linhas sem a coluna vencimento."
          />
        </div>

        <div className="form-actions" style={{ marginTop: 20 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', marginRight: 'auto' }}>
            As notas viram rascunhos: nada é enviado ao Sefin nesta etapa.
          </span>
          <button className="btn btn-secondary" onClick={onFechar}>Cancelar</button>
          <button className="btn btn-primary" onClick={importar} disabled={escolhidas.length === 0}>
            Criar {escolhidas.length} rascunho(s) — {fmt.currency(total)}
          </button>
        </div>
      </div>
    </div>
  );
}
