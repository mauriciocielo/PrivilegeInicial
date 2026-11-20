'use client';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { NfsE, PlanoConta, Portador } from '../lib/store';
import { fmt } from '../lib/reports';
import { hojeBrasilia, type AmbienteNfse } from '../lib/nfse/dps';
import { copiarParaCompetencia, existeNotaIgual, mesAnterior, type DadosCopiaveis } from '../lib/nfse/lote';
import NfseFinanceiroCampos, { financeiroInvalido, type FinanceiroNota } from './NfseFinanceiroCampos';

interface Props {
  notas: NfsE[];
  ambiente: AmbienteNfse;
  portadores: Portador[];
  planoContas: PlanoConta[];
  onFechar: () => void;
  onCriar: (itens: DadosCopiaveis[], financeiro: FinanceiroNota) => void;
}

export default function NfseCopiarModal({ notas, ambiente, portadores, planoContas, onFechar, onCriar }: Props) {
  const mesAtual = hojeBrasilia().slice(0, 7);
  const [mesOrigem, setMesOrigem] = useState(mesAnterior(mesAtual));
  const [competencia, setCompetencia] = useState(mesAtual);
  const [atualizarDescricao, setAtualizarDescricao] = useState(true);
  const [descricaoLote, setDescricaoLote] = useState('');
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [financeiro, setFinanceiro] = useState<FinanceiroNota>({ gerarContaReceber: false, portadorId: '', planoContaId: '', vencimento: hojeBrasilia() });

  const candidatas = useMemo(() => notas
    // Em produção, nota de teste não serve de base. Em teste, as notas reais servem: são só o modelo.
    .filter(n => n.chaveAcesso && n.status === 'emitida' && (ambiente !== 'producao' || n.ambiente === 'producao') && n.dataEmissao.startsWith(mesOrigem))
    .sort((a, b) => a.tomadorRazaoSocial.localeCompare(b.tomadorRazaoSocial)),
  [notas, ambiente, mesOrigem]);

  const jaExiste = (n: NfsE) => existeNotaIgual(notas, { tomadorCnpjCpf: n.tomadorCnpjCpf, valorServicos: n.valorServicos, dataCompetencia: competencia });

  // Por padrão vem marcado tudo que ainda não tem nota igual na competência de destino.
  useEffect(() => {
    setSelecionadas(new Set(candidatas.filter(n => !jaExiste(n)).map(n => n.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidatas, competencia]);

  const alternar = (id: string) => setSelecionadas(atual => {
    const novo = new Set(atual);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    return novo;
  });

  const total = candidatas.filter(n => selecionadas.has(n.id)).reduce((soma, n) => soma + n.valorServicos, 0);

  const resolverDescricao = (n: NfsE): string => {
    const [ano, mes] = competencia.split('-');
    const mesFormatado = ano && mes ? `${mes}/${ano}` : competencia;
    if (descricaoLote.trim()) {
      return descricaoLote
        .replace(/\{mes\}/gi, mesFormatado)
        .replace(/\{tomador\}/gi, n.tomadorRazaoSocial || '');
    }
    return copiarParaCompetencia(n, competencia, atualizarDescricao).discriminacao;
  };

  const copiar = () => {
    const invalido = financeiroInvalido(financeiro);
    if (invalido) { toast.error(invalido); return; }
    if (competencia > mesAtual) { toast.error('A competência não pode ser posterior ao mês atual.'); return; }
    const itens = candidatas
      .filter(n => selecionadas.has(n.id))
      .map(n => {
        const base = copiarParaCompetencia(n, competencia, atualizarDescricao);
        if (descricaoLote.trim()) {
          return { ...base, discriminacao: resolverDescricao(n) };
        }
        return base;
      });
    onCriar(itens, financeiro);
  };

  return (
    <div className="modal-overlay nfse-ui" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="modal modal-lg" style={{ maxWidth: 800, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2 className="modal-title">Copiar notas emitidas</h2>
          <button className="modal-close" onClick={onFechar}>✕</button>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Emitidas em</label>
            <input type="month" className="form-control" max={mesAtual} value={mesOrigem} onChange={e => setMesOrigem(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Nova competência</label>
            <input type="month" className="form-control" max={mesAtual} value={competencia} onChange={e => setCompetencia(e.target.value)} />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14.5, marginBottom: 12 }}>
          <input type="checkbox" checked={atualizarDescricao} onChange={e => setAtualizarDescricao(e.target.checked)} />
          Atualizar o mês citado na descrição (ex.: &quot;referente a 10/2026&quot; passa para a nova competência)
        </label>

        <div className="form-group" style={{ marginBottom: 16 }}>
          <div className="form-label-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <label className="form-label" style={{ margin: 0 }}>
              Alterar descrição para todas automaticamente (opcional)
            </label>
            {candidatas.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '3px 9px', fontSize: 13.5 }}
                onClick={() => setDescricaoLote(copiarParaCompetencia(candidatas[0], competencia, atualizarDescricao).discriminacao)}
              >
                Usar 1ª nota como modelo
              </button>
            )}
          </div>
          <textarea
            className="form-control"
            rows={2}
            placeholder="Deixe vazio para manter a descrição original de cada nota (com o mês atualizado), ou digite aqui para aplicar automaticamente em todas. Dica: use {mes} para inserir MM/AAAA."
            value={descricaoLote}
            onChange={e => setDescricaoLote(e.target.value)}
          />
        </div>

        {candidatas.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3>Nenhuma nota emitida neste mês</h3>
            <p>Use Buscar Notas do Portal para trazer as notas emitidas fora do sistema.</p>
          </div>
        ) : (
          <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 16 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <input
                      type="checkbox"
                      checked={candidatas.length > 0 && selecionadas.size === candidatas.length}
                      onChange={() => {
                        if (selecionadas.size === candidatas.length) setSelecionadas(new Set());
                        else setSelecionadas(new Set(candidatas.map(c => c.id)));
                      }}
                    />
                  </th>
                  <th>Tomador</th>
                  <th>Descrição (Prévia)</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {candidatas.map(n => (
                  <tr key={n.id} onClick={() => alternar(n.id)} style={{ cursor: 'pointer' }}>
                    <td><input type="checkbox" checked={selecionadas.has(n.id)} onChange={() => alternar(n.id)} onClick={e => e.stopPropagation()} /></td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{n.tomadorRazaoSocial}</div>
                      {jaExiste(n) && <div style={{ fontSize: 13, color: '#f59e0b' }}>Já existe nota igual nesta competência</div>}
                    </td>
                    <td style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {resolverDescricao(n)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt.currency(n.valorServicos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ background: 'var(--bg-card2)', borderRadius: 8, padding: 14, border: '1px solid var(--border-light)' }}>
          <NfseFinanceiroCampos valor={financeiro} portadores={portadores} planoContas={planoContas} onChange={setFinanceiro} />
        </div>

        <div className="form-actions" style={{ marginTop: 20 }}>
          <span style={{ fontSize: 14.5, color: 'var(--text-muted)', marginRight: 'auto' }}>
            As cópias viram rascunhos: nada é enviado ao Sefin nesta etapa.
          </span>
          <button className="btn btn-secondary" onClick={onFechar}>Cancelar</button>
          <button className="btn btn-primary" onClick={copiar} disabled={selecionadas.size === 0}>
            Criar {selecionadas.size} rascunho(s) — {fmt.currency(total)}
          </button>
        </div>
      </div>
    </div>
  );
}
