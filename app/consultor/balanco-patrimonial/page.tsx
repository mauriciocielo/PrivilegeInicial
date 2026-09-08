'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { store, Empresa, ContaBalanco, BalancoPatrimonial, GrupoContaBalanco, uid } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import { gerarPdfBalancoPatrimonial } from '../../../lib/balanco-pdf';
import { toast } from 'sonner';
import { confirmAsync } from '../../../components/ConfirmProvider';

const GRUPO_LABELS: Record<GrupoContaBalanco, string> = {
  ativo_circulante: 'Ativo Circulante',
  ativo_nao_circulante: 'Ativo Não Circulante',
  passivo_circulante: 'Passivo Circulante',
  passivo_nao_circulante: 'Passivo Não Circulante',
  patrimonio_liquido: 'Patrimônio Líquido',
};

const GRUPOS_ATIVO: GrupoContaBalanco[] = ['ativo_circulante', 'ativo_nao_circulante'];
const GRUPOS_PASSIVO: GrupoContaBalanco[] = ['passivo_circulante', 'passivo_nao_circulante', 'patrimonio_liquido'];

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatCompetencia(competencia: string) {
  const [y, m] = competencia.split('-');
  if (!y || !m) return competencia;
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
}

export default function BalancoPatrimonialPage() {
  const [empresaId, setEmpresaId] = useState('');
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [contas, setContas] = useState<ContaBalanco[]>([]);
  const [historico, setHistorico] = useState<BalancoPatrimonial[]>([]);

  const [competencia, setCompetencia] = useState(mesAtual());
  const [balancoId, setBalancoId] = useState<string | null>(null);
  const [valores, setValores] = useState<Record<string, number>>({});
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);

  const [addContaFor, setAddContaFor] = useState<{ grupo: GrupoContaBalanco; subgrupo?: string } | null>(null);
  const [novaConta, setNovaConta] = useState({ codigo: '', descricao: '' });

  // Mantém a competência atual acessível dentro de `load` sem recriar o callback
  // a cada troca de mês — evita usar um valor "congelado" quando `load` é
  // disparado por eventos externos (troca de empresa, sincronização em background).
  const competenciaRef = useRef(competencia);
  useEffect(() => { competenciaRef.current = competencia; }, [competencia]);

  const loadCompetencia = useCallback((eId: string, comp: string) => {
    const existente = store.getBalancosPatrimoniais(eId).find(b => b.competencia === comp);
    if (existente) {
      setBalancoId(existente.id);
      setValores(existente.valores || {});
      setObservacao(existente.observacao || '');
    } else {
      setBalancoId(null);
      setValores({});
      setObservacao('');
    }
  }, []);

  const load = useCallback((eId: string) => {
    setEmpresaId(eId);
    setEmpresa(store.getEmpresas().find(e => e.id === eId) || null);
    setContas(store.getContasBalanco(eId));
    setHistorico(store.getBalancosPatrimoniais(eId).sort((a, b) => b.competencia.localeCompare(a.competencia)));
    loadCompetencia(eId, competenciaRef.current);
  }, [loadCompetencia]);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || (store.getEmpresas()[0]?.id ?? '');
    load(saved);

    const handler = (e: Event) => load((e as CustomEvent).detail);
    const dataChangeHandler = () => {
      const current = sessionStorage.getItem('cf_empresa_sel') || (store.getEmpresas()[0]?.id ?? '');
      load(current);
    };
    window.addEventListener('empresaChange', handler);
    window.addEventListener('cfDataChange', dataChangeHandler);
    return () => {
      window.removeEventListener('empresaChange', handler);
      window.removeEventListener('cfDataChange', dataChangeHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCompetenciaChange = (comp: string) => {
    setCompetencia(comp);
    loadCompetencia(empresaId, comp);
  };

  const setValor = (contaId: string, val: number) => {
    setValores(v => ({ ...v, [contaId]: val }));
  };

  const totalAtivo = useMemo(() =>
    contas.filter(c => GRUPOS_ATIVO.includes(c.grupo)).reduce((a, c) => a + (valores[c.id] || 0), 0)
  , [contas, valores]);

  const totalPassivoPL = useMemo(() =>
    contas.filter(c => GRUPOS_PASSIVO.includes(c.grupo)).reduce((a, c) => a + (valores[c.id] || 0), 0)
  , [contas, valores]);

  const diferenca = totalAtivo - totalPassivoPL;
  const balanceado = Math.abs(diferenca) < 0.005;

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      const bp: BalancoPatrimonial = {
        id: balancoId || uid(),
        empresaId,
        competencia,
        observacao: observacao || undefined,
        valores,
        createdAt: new Date().toISOString(),
      };
      store.saveBalancoPatrimonial(bp);
      setBalancoId(bp.id);
      setHistorico(store.getBalancosPatrimoniais(empresaId).sort((a, b) => b.competencia.localeCompare(a.competencia)));
      setSaving(false);
    }, 300);
  };

  const [exportando, setExportando] = useState(false);
  const handleExportPdf = async () => {
    setExportando(true);
    try {
      await gerarPdfBalancoPatrimonial({
        empresa,
        balanco: {
          id: balancoId || 'draft',
          empresaId,
          competencia,
          observacao: observacao || undefined,
          valores,
          createdAt: new Date().toISOString(),
        },
        contas,
      });
      toast.success('PDF do Balanço Patrimonial gerado.');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível gerar o PDF.');
    } finally {
      setExportando(false);
    }
  };

  const handleLoadHistorico = (bp: BalancoPatrimonial) => {
    setCompetencia(bp.competencia);
    setBalancoId(bp.id);
    setValores(bp.valores || {});
    setObservacao(bp.observacao || '');
  };

  const handleExportHistoricoPdf = async (bp: BalancoPatrimonial) => {
    setExportando(true);
    try {
      await gerarPdfBalancoPatrimonial({ empresa, balanco: bp, contas });
      toast.success('PDF do Balanço Patrimonial gerado.');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível gerar o PDF.');
    } finally {
      setExportando(false);
    }
  };

  const handleDeleteHistorico = async (bp: BalancoPatrimonial) => {
    if (!(await confirmAsync(`Excluir o Balanço Patrimonial de ${formatCompetencia(bp.competencia)}?`))) return;
    store.deleteBalancoPatrimonial(bp.id);
    const newHist = store.getBalancosPatrimoniais(empresaId).sort((a, b) => b.competencia.localeCompare(a.competencia));
    setHistorico(newHist);
    if (bp.id === balancoId) {
      setBalancoId(null);
      setValores({});
      setObservacao('');
    }
  };

  const handleDeleteConta = async (conta: ContaBalanco) => {
    if (!(await confirmAsync(`Remover a conta "${conta.descricao}" da estrutura do balanço?`))) return;
    store.deleteContaBalanco(conta.id);
    setContas(store.getContasBalanco(empresaId));
  };

  const openAddConta = (grupo: GrupoContaBalanco, subgrupo?: string) => {
    setNovaConta({ codigo: '', descricao: '' });
    setAddContaFor({ grupo, subgrupo });
  };

  const handleAddConta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addContaFor || !novaConta.descricao) return;
    const contasDoBucket = contas.filter(c => c.grupo === addContaFor.grupo && (c.subgrupo || undefined) === addContaFor.subgrupo);
    const maiorOrdem = contasDoBucket.reduce((max, c) => Math.max(max, c.ordem), 0);
    const conta: ContaBalanco = {
      id: uid(),
      empresaId,
      grupo: addContaFor.grupo,
      subgrupo: addContaFor.subgrupo,
      codigo: novaConta.codigo || '-',
      descricao: novaConta.descricao,
      ordem: maiorOrdem + 1,
      ativo: true,
      createdAt: new Date().toISOString(),
    };
    store.saveContaBalanco(conta);
    setContas(store.getContasBalanco(empresaId));
    setAddContaFor(null);
  };

  const renderGrupo = (grupo: GrupoContaBalanco) => {
    const contasDoGrupo = contas.filter(c => c.grupo === grupo && c.ativo).sort((a, b) => a.ordem - b.ordem);
    const subgrupos = Array.from(new Set(contasDoGrupo.map(c => c.subgrupo || '')));
    const totalGrupo = contasDoGrupo.reduce((a, c) => a + (valores[c.id] || 0), 0);

    return (
      <div key={grupo} style={{ marginBottom: 18 }}>
        <div style={{
          fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
          color: 'var(--text-primary)', background: 'var(--bg-hover)', padding: '8px 12px', borderRadius: 6, marginBottom: 4
        }}>
          {GRUPO_LABELS[grupo]}
        </div>

        {subgrupos.map(sub => {
          const rows = contasDoGrupo.filter(c => (c.subgrupo || '') === sub);
          return (
            <div key={sub || '__root__'} style={{ marginBottom: 4 }}>
              {sub && (
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', padding: '6px 12px 2px' }}>
                  {sub}
                </div>
              )}
              <table style={{ width: '100%' }}>
                <tbody>
                  {rows.map(conta => (
                    <tr key={conta.id}>
                      <td style={{ fontSize: 11.5, color: 'var(--text-muted)', width: 70, padding: '4px 8px' }}>{conta.codigo}</td>
                      <td style={{ fontSize: 13, padding: '4px 8px' }}>{conta.descricao}</td>
                      <td style={{ width: 170, padding: '4px 8px' }}>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control"
                          style={{ textAlign: 'right', width: '100%' }}
                          value={valores[conta.id] || ''}
                          placeholder="0,00"
                          onChange={e => setValor(conta.id, Number(e.target.value))}
                        />
                      </td>
                      <td style={{ width: 30, padding: '4px' }}>
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          title="Remover conta da estrutura"
                          onClick={() => handleDeleteConta(conta)}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4} style={{ padding: '2px 8px 8px' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11.5 }}
                        onClick={() => openAddConta(grupo, sub || undefined)}
                      >
                        ＋ Adicionar conta{sub ? ` em ${sub}` : ''}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}

        <div style={{
          display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700,
          borderTop: '1px solid var(--border)', padding: '8px 12px', marginTop: 4
        }}>
          <span>Total {GRUPO_LABELS[grupo]}</span>
          <span>{fmt.currency(totalGrupo)}</span>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Balanço Patrimonial</div>
          <div className="page-subtitle">{empresa?.nomeFantasia || empresa?.razaoSocial} — Lançamento manual sobre estrutura contábil pré-criada</div>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            type="month"
            className="form-control"
            value={competencia}
            onChange={e => handleCompetenciaChange(e.target.value)}
            style={{ width: 170 }}
          />
          <button className="btn btn-secondary" onClick={handleExportPdf} disabled={exportando || !empresaId}>
            {exportando ? '⏳ Gerando...' : '📄 Exportar PDF'}
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !empresaId}>
            {saving ? '⏳ Salvando...' : balancoId ? '💾 Atualizar Balanço' : '💾 Salvar Balanço'}
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card blue">
            <div className="stat-icon blue">Σ</div>
            <div className="stat-label">Total do Ativo</div>
            <div className="stat-value">{fmt.currency(totalAtivo)}</div>
          </div>
          <div className="stat-card blue">
            <div className="stat-icon blue">Σ</div>
            <div className="stat-label">Total Passivo + Patrimônio Líquido</div>
            <div className="stat-value">{fmt.currency(totalPassivoPL)}</div>
          </div>
          <div className={`stat-card ${balanceado ? 'green' : 'red'}`}>
            <div className={`stat-icon ${balanceado ? 'green' : 'red'}`}>{balanceado ? '✓' : '⚠'}</div>
            <div className="stat-label">{balanceado ? 'Balanço Fechado' : 'Diferença (Ativo − Passivo/PL)'}</div>
            <div className="stat-value" style={{ color: balanceado ? 'var(--green)' : 'var(--red)' }}>
              {balanceado ? 'Balanceado' : fmt.currency(diferenca)}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">Ativo — {formatCompetencia(competencia)}</div>
            </div>
            <div style={{ padding: 16 }}>
              {GRUPOS_ATIVO.map(renderGrupo)}
              <div style={{
                display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800,
                background: 'var(--bg-hover)', padding: '10px 12px', borderRadius: 6, marginTop: 8
              }}>
                <span>TOTAL DO ATIVO</span>
                <span>{fmt.currency(totalAtivo)}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Passivo e Patrimônio Líquido — {formatCompetencia(competencia)}</div>
            </div>
            <div style={{ padding: 16 }}>
              {GRUPOS_PASSIVO.map(renderGrupo)}
              <div style={{
                display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800,
                background: 'var(--bg-hover)', padding: '10px 12px', borderRadius: 6, marginTop: 8
              }}>
                <span>TOTAL PASSIVO + PATRIMÔNIO LÍQUIDO</span>
                <span>{fmt.currency(totalPassivoPL)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <div className="card-title">Observações do Fechamento</div>
          </div>
          <div style={{ padding: 16 }}>
            <textarea
              className="form-control"
              rows={3}
              style={{ width: '100%' }}
              placeholder="Notas sobre este fechamento (opcional)..."
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
            />
          </div>
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <div className="card-title">Histórico de Balanços</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Competência</th>
                  <th style={{ textAlign: 'right' }}>Total do Ativo</th>
                  <th style={{ textAlign: 'right' }}>Total Passivo + PL</th>
                  <th style={{ textAlign: 'right' }}>Diferença</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {historico.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      Nenhum balanço patrimonial salvo ainda para esta empresa.
                    </td>
                  </tr>
                ) : (
                  historico.map(bp => {
                    const tAtivo = contas.filter(c => GRUPOS_ATIVO.includes(c.grupo)).reduce((a, c) => a + (bp.valores[c.id] || 0), 0);
                    const tPassivo = contas.filter(c => GRUPOS_PASSIVO.includes(c.grupo)).reduce((a, c) => a + (bp.valores[c.id] || 0), 0);
                    const diff = tAtivo - tPassivo;
                    const ok = Math.abs(diff) < 0.005;
                    return (
                      <tr key={bp.id} style={{ fontWeight: bp.id === balancoId ? 700 : 400 }}>
                        <td style={{ textTransform: 'capitalize' }}>{formatCompetencia(bp.competencia)}</td>
                        <td style={{ textAlign: 'right' }}>{fmt.currency(tAtivo)}</td>
                        <td style={{ textAlign: 'right' }}>{fmt.currency(tPassivo)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={`badge ${ok ? 'badge-green' : 'badge-red'}`}>{fmt.currency(diff)}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-ghost btn-sm btn-icon" title="Abrir" onClick={() => handleLoadHistorico(bp)}>✏️</button>
                            <button className="btn btn-ghost btn-sm btn-icon" title="Exportar PDF" disabled={exportando} onClick={() => handleExportHistoricoPdf(bp)}>📄</button>
                            <button className="btn btn-danger btn-sm btn-icon" title="Excluir" onClick={() => handleDeleteHistorico(bp)}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {addContaFor && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAddContaFor(null)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2>Nova Conta — {GRUPO_LABELS[addContaFor.grupo]}{addContaFor.subgrupo ? ` / ${addContaFor.subgrupo}` : ''}</h2>
              <button className="close-btn" onClick={() => setAddContaFor(null)}>✕</button>
            </div>
            <form onSubmit={handleAddConta} className="modal-body form-grid">
              <div className="form-group" style={{ gridColumn: 'span 4' }}>
                <label>Código (opcional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: 1.1.09"
                  value={novaConta.codigo}
                  onChange={e => setNovaConta(v => ({ ...v, codigo: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 8' }}>
                <label>Descrição da Conta *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: Adiantamento a Fornecedores"
                  value={novaConta.descricao}
                  onChange={e => setNovaConta(v => ({ ...v, descricao: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div className="modal-footer" style={{ gridColumn: 'span 12' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAddContaFor(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">＋ Adicionar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
