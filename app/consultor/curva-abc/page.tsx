'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { store, Empresa, CurvaAbc, CurvaAbcConfig, uid } from '../../../lib/store';
import { parseCurvaAbcFile, classificarAbc } from '../../../lib/curva-abc-parser';
import { fmt } from '../../../lib/reports';
import { toast } from 'sonner';

const BADGE_CLASSE: Record<string, string> = {
  A: 'badge-green',
  B: 'badge-blue',
  C: 'badge-red',
};

export default function CurvaAbcPage() {
  const [empresaId, setEmpresaId] = useState('');
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [config, setConfig] = useState<CurvaAbcConfig>({ empresaId: '', percentualA: 80, percentualB: 95 });
  const [formConfig, setFormConfig] = useState({ percentualA: 80, percentualB: 95 });
  const [curvas, setCurvas] = useState<CurvaAbc[]>([]);
  const [curvaAtual, setCurvaAtual] = useState<CurvaAbc | null>(null);
  const [processing, setProcessing] = useState(false);
  const [busca, setBusca] = useState('');

  const load = useCallback((eId: string) => {
    setEmpresaId(eId);
    setEmpresa(store.getEmpresas().find(e => e.id === eId) || null);
    if (!eId) { setConfig({ empresaId: '', percentualA: 80, percentualB: 95 }); setCurvas([]); setCurvaAtual(null); return; }

    const cfg = store.getCurvaAbcConfig(eId);
    setConfig(cfg);
    setFormConfig({ percentualA: cfg.percentualA, percentualB: cfg.percentualB });

    const lista = store.getCurvasAbc(eId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setCurvas(lista);
    setCurvaAtual(lista[0] || null);
  }, []);

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
  }, [load]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!empresaId) { toast.error('Selecione uma empresa antes de importar.'); return; }
    if (acceptedFiles.length === 0) return;

    setProcessing(true);
    try {
      const file = acceptedFiles[0];
      const itensBrutos = await parseCurvaAbcFile(file);
      if (itensBrutos.length === 0) {
        toast.error('Não foi possível identificar itens (nome + valor faturado) no arquivo enviado.');
        return;
      }

      const cfg = store.getCurvaAbcConfig(empresaId);
      const itens = classificarAbc(itensBrutos, cfg.percentualA, cfg.percentualB);
      const curva: CurvaAbc = {
        id: uid(),
        empresaId,
        nome: file.name,
        dataImportacao: new Date().toISOString().split('T')[0],
        percentualA: cfg.percentualA,
        percentualB: cfg.percentualB,
        itens,
        createdAt: new Date().toISOString(),
      };
      store.saveCurvaAbc(curva);
      setCurvas(store.getCurvasAbc(empresaId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setCurvaAtual(curva);
      toast.success(`Curva ABC gerada com ${itens.length} itens.`);
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message || 'Erro ao processar o arquivo.');
    } finally {
      setProcessing(false);
    }
  }, [empresaId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: processing || !empresaId,
    multiple: false,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
    },
  });

  const handleSaveConfig = () => {
    if (!empresaId) return;
    if (formConfig.percentualA <= 0 || formConfig.percentualA >= formConfig.percentualB || formConfig.percentualB > 100) {
      toast.error('Percentuais inválidos: A deve ser maior que 0, menor que B, e B até 100%.');
      return;
    }
    const cfg: CurvaAbcConfig = { empresaId, percentualA: formConfig.percentualA, percentualB: formConfig.percentualB };
    store.saveCurvaAbcConfig(cfg);
    setConfig(cfg);
    toast.success('Percentuais de corte salvos para esta empresa.');
  };

  const handleReclassificar = () => {
    if (!curvaAtual) return;
    const brutos = curvaAtual.itens.map(i => ({ nome: i.nome, valorFaturado: i.valorFaturado }));
    const itens = classificarAbc(brutos, config.percentualA, config.percentualB);
    const atualizado: CurvaAbc = { ...curvaAtual, percentualA: config.percentualA, percentualB: config.percentualB, itens };
    store.saveCurvaAbc(atualizado);
    setCurvas(store.getCurvasAbc(empresaId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setCurvaAtual(atualizado);
    toast.success('Curva reclassificada com os percentuais atuais.');
  };

  const handleAbrir = (curva: CurvaAbc) => setCurvaAtual(curva);

  const handleExcluir = (curva: CurvaAbc) => {
    if (!confirm(`Excluir a Curva ABC "${curva.nome}"?`)) return;
    store.deleteCurvaAbc(curva.id);
    const lista = store.getCurvasAbc(empresaId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setCurvas(lista);
    if (curvaAtual?.id === curva.id) setCurvaAtual(lista[0] || null);
  };

  const itensFiltrados = useMemo(() => {
    if (!curvaAtual) return [];
    const q = busca.trim().toLowerCase();
    return q ? curvaAtual.itens.filter(i => i.nome.toLowerCase().includes(q)) : curvaAtual.itens;
  }, [curvaAtual, busca]);

  const resumo = useMemo(() => {
    if (!curvaAtual) return null;
    const totalFaturado = curvaAtual.itens.reduce((a, i) => a + i.valorFaturado, 0);
    const qtdA = curvaAtual.itens.filter(i => i.classificacao === 'A').length;
    const qtdB = curvaAtual.itens.filter(i => i.classificacao === 'B').length;
    const qtdC = curvaAtual.itens.filter(i => i.classificacao === 'C').length;
    return { totalFaturado, qtdA, qtdB, qtdC };
  }, [curvaAtual]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Curva ABC</div>
          <div className="page-subtitle">{empresa?.nomeFantasia || empresa?.razaoSocial} — Classificação por valor faturado (importação de PDF, XLS ou TXT)</div>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginBottom: 20, alignItems: 'start' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">Importar Arquivo</div>
            </div>
            <div style={{ padding: 16 }}>
              <div
                {...getRootProps()}
                style={{
                  border: `2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 10,
                  padding: '32px 16px',
                  textAlign: 'center',
                  cursor: processing || !empresaId ? 'not-allowed' : 'pointer',
                  background: isDragActive ? 'var(--accent-glow)' : 'var(--bg-card2)',
                  transition: 'all 0.2s',
                }}
              >
                <input {...getInputProps()} />
                {processing ? (
                  <div>
                    <div className="spinner-sm" style={{ margin: '0 auto 10px' }} />
                    <p style={{ fontSize: 13 }}>Processando arquivo...</p>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>Arraste um arquivo ou clique para selecionar</p>
                    <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                      Formatos aceitos: .xlsx, .xls, .csv, .txt, .pdf — com nome (cliente/produto) e valor faturado
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Percentuais de Corte (Empresa)</div>
            </div>
            <div style={{ padding: 16 }}>
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: 'span 6' }}>
                  <label>Classe A até (% acumulado)</label>
                  <input
                    type="number"
                    className="form-control"
                    min={1}
                    max={99}
                    value={formConfig.percentualA}
                    onChange={e => setFormConfig(v => ({ ...v, percentualA: Number(e.target.value) }))}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 6' }}>
                  <label>Classe B até (% acumulado)</label>
                  <input
                    type="number"
                    className="form-control"
                    min={2}
                    max={100}
                    value={formConfig.percentualB}
                    onChange={e => setFormConfig(v => ({ ...v, percentualB: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 12px' }}>
                O restante (acima de {formConfig.percentualB}%) é classificado como C. Padrão usual: 80% / 95%.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={handleSaveConfig} disabled={!empresaId}>💾 Salvar</button>
                <button className="btn btn-ghost btn-sm" onClick={handleReclassificar} disabled={!curvaAtual}>🔄 Reclassificar curva atual</button>
              </div>
            </div>
          </div>
        </div>

        {resumo && curvaAtual && (
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card blue">
              <div className="stat-icon blue">Σ</div>
              <div className="stat-label">Total Faturado</div>
              <div className="stat-value">{fmt.currency(resumo.totalFaturado)}</div>
            </div>
            <div className="stat-card green">
              <div className="stat-icon green">A</div>
              <div className="stat-label">Itens Classe A</div>
              <div className="stat-value">{resumo.qtdA}</div>
            </div>
            <div className="stat-card blue">
              <div className="stat-icon blue">B</div>
              <div className="stat-label">Itens Classe B</div>
              <div className="stat-value">{resumo.qtdB}</div>
            </div>
            <div className="stat-card red">
              <div className="stat-icon red">C</div>
              <div className="stat-label">Itens Classe C</div>
              <div className="stat-value">{resumo.qtdC}</div>
            </div>
          </div>
        )}

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div className="card-title">
              {curvaAtual ? `Curva ABC — ${curvaAtual.nome}` : 'Nenhuma curva importada ainda'}
            </div>
            {curvaAtual && (
              <input
                type="text"
                className="form-control"
                placeholder="Buscar por nome..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                style={{ width: 220 }}
              />
            )}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nome (Cliente/Produto)</th>
                  <th style={{ textAlign: 'right' }}>Valor Faturado</th>
                  <th style={{ textAlign: 'right' }}>% Individual</th>
                  <th style={{ textAlign: 'right' }}>% Acumulado</th>
                  <th>Classe</th>
                </tr>
              </thead>
              <tbody>
                {!curvaAtual || itensFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      {curvaAtual ? 'Nenhum item encontrado para a busca.' : 'Importe um arquivo para gerar a primeira Curva ABC desta empresa.'}
                    </td>
                  </tr>
                ) : (
                  itensFiltrados.map((item, idx) => (
                    <tr key={item.id}>
                      <td style={{ color: 'var(--text-muted)' }}>{item.ordem + 1}</td>
                      <td style={{ fontWeight: 500 }}>{item.nome}</td>
                      <td style={{ textAlign: 'right' }}>{fmt.currency(item.valorFaturado)}</td>
                      <td style={{ textAlign: 'right' }}>{fmt.percent(item.percentualIndividual)}</td>
                      <td style={{ textAlign: 'right' }}>{fmt.percent(item.percentualAcumulado)}</td>
                      <td>
                        <span className={`badge ${BADGE_CLASSE[item.classificacao]}`}>{item.classificacao}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Histórico de Importações</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Data</th>
                  <th style={{ textAlign: 'right' }}>Itens</th>
                  <th style={{ textAlign: 'right' }}>Cortes A / B</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {curvas.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      Nenhuma importação registrada para esta empresa.
                    </td>
                  </tr>
                ) : (
                  curvas.map(curva => (
                    <tr key={curva.id} style={{ fontWeight: curva.id === curvaAtual?.id ? 700 : 400 }}>
                      <td>{curva.nome}</td>
                      <td>{fmt.date(curva.dataImportacao)}</td>
                      <td style={{ textAlign: 'right' }}>{curva.itens.length}</td>
                      <td style={{ textAlign: 'right' }}>{curva.percentualA}% / {curva.percentualB}%</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-ghost btn-sm btn-icon" title="Abrir" onClick={() => handleAbrir(curva)}>👁️</button>
                          <button className="btn btn-danger btn-sm btn-icon" title="Excluir" onClick={() => handleExcluir(curva)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
