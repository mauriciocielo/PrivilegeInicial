'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { store, Empresa } from '../../../lib/store';
import { fmt, generatePDF, generateXLS, buildFluxoCaixaData } from '../../../lib/reports';
import GeminiTips from '../../../components/GeminiTips';

export default function RelatoriosPage() {
  const [empresaId, setEmpresaId] = useState('e1');
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [tipo, setTipo] = useState<'fluxo' | 'extrato' | 'dre'>('fluxo');
  const [dataIni, setDataIni] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().split('T')[0]);
  const [portadorFiltro, setPortadorFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('realizado');
  const [generating, setGenerating] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ rows: (string | number)[][]; totais: { label: string; value: string; color?: string }[] } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({});

  const load = useCallback((eId: string) => {
    setEmpresaId(eId);
    setEmpresa(store.getEmpresas().find(e => e.id === eId) || null);
  }, []);

  const drilldownData = useMemo(() => {
    const lancs = store.getLancamentos(empresaId).filter(l => l.data >= dataIni && l.data <= dataFim);
    let filteredLancs = lancs;
    if (portadorFiltro) filteredLancs = filteredLancs.filter(l => l.portadorId === portadorFiltro);
    if (statusFiltro) filteredLancs = filteredLancs.filter(l => l.status === statusFiltro);

    const plano = store.getPlanoContas(empresaId);
    
    const catGroups = {
      receitas: { id: 'receitas', label: 'Receitas', isDespesa: false, total: 0, subaccounts: [] as any[] },
      custos: { id: 'custos', label: 'Custos de Mercadoria', isDespesa: true, total: 0, subaccounts: [] as any[] },
      despesas: { id: 'despesas', label: 'Despesas', isDespesa: true, total: 0, subaccounts: [] as any[] },
      liberacoes: { id: 'liberacoes', label: 'Liberações Bancárias', isDespesa: false, total: 0, subaccounts: [] as any[] },
      emprestimos: { id: 'emprestimos', label: 'Empréstimos', isDespesa: true, total: 0, subaccounts: [] as any[] },
      investimentos: { id: 'investimentos', label: 'Investimentos', isDespesa: true, total: 0, subaccounts: [] as any[] },
    };

    const subaccountMap: Record<string, { id: string; desc: string; total: number; lancs: any[] }> = {};

    filteredLancs.forEach(l => {
      const pc = plano.find(p => p.id === l.planoContaId);
      if (!pc) return;
      const cod = pc.codigo;

      let groupKey: keyof typeof catGroups | null = null;
      if (cod.startsWith('1')) groupKey = 'receitas';
      else if (cod.startsWith('2')) groupKey = 'custos';
      else if (cod.startsWith('3')) groupKey = 'despesas';
      else if (cod.startsWith('4.1')) groupKey = 'liberacoes';
      else if (cod.startsWith('4.2')) groupKey = 'emprestimos';
      else if (cod.startsWith('5')) groupKey = 'investimentos';

      if (groupKey) {
        catGroups[groupKey].total += l.valor;
        if (!subaccountMap[l.planoContaId]) {
          subaccountMap[l.planoContaId] = {
            id: l.planoContaId,
            desc: `${pc.codigo} - ${pc.descricao}`,
            total: 0,
            lancs: []
          };
          catGroups[groupKey].subaccounts.push(subaccountMap[l.planoContaId]);
        }
        subaccountMap[l.planoContaId].total += l.valor;
        subaccountMap[l.planoContaId].lancs.push(l);
      }
    });

    Object.keys(catGroups).forEach(k => {
      const grp = catGroups[k as keyof typeof catGroups];
      grp.subaccounts.sort((a, b) => b.total - a.total);
    });

    const recOperacionalBruta = catGroups.receitas.total - catGroups.custos.total - catGroups.despesas.total;
    const resultadoLiquido = recOperacionalBruta + catGroups.liberacoes.total - catGroups.emprestimos.total - catGroups.investimentos.total;

    return {
      groups: catGroups,
      recOperacionalBruta,
      resultadoLiquido
    };
  }, [empresaId, dataIni, dataFim, portadorFiltro, statusFiltro]);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || 'e1';
    load(saved);
    const handler = (e: Event) => load((e as CustomEvent).detail);
    window.addEventListener('empresaChange', handler);
    return () => window.removeEventListener('empresaChange', handler);
  }, [load]);

  const getTitle = () => tipo === 'fluxo' ? 'Fluxo de Caixa' : tipo === 'extrato' ? 'Extrato Detalhado' : 'DRE — Demonstrativo de Resultado';
  const getPeriodo = () => `${fmt.date(dataIni)} a ${fmt.date(dataFim)}`;

  const getLancamentosFiltrados = () => {
    let lancs = store.getLancamentos(empresaId).filter(l => l.data >= dataIni && l.data <= dataFim);
    if (portadorFiltro) lancs = lancs.filter(l => l.portadorId === portadorFiltro);
    if (statusFiltro) lancs = lancs.filter(l => l.status === statusFiltro);
    return lancs;
  };

  const buildPreview = () => {
    const lancs = getLancamentosFiltrados();
    const plano = store.getPlanoContas(empresaId);
    const portadores = store.getPortadores(empresaId);
    const data = buildFluxoCaixaData(lancs, plano, portadores);

    // Mapeamento Gerencial conforme estrutura solicitada
    let receitas = 0;
    let custos = 0;
    let despesas = 0;
    let liberacoes = 0;
    let emprestimos = 0;
    let investimentos = 0;

    lancs.forEach(l => {
      const pc = plano.find(p => p.id === l.planoContaId);
      if (!pc) return;
      const cod = pc.codigo;

      if (cod.startsWith('1')) {
        receitas += l.valor;
      } else if (cod.startsWith('2')) {
        custos += l.valor;
      } else if (cod.startsWith('3')) {
        despesas += l.valor;
      } else if (cod.startsWith('4.1')) {
        liberacoes += l.valor;
      } else if (cod.startsWith('4.2')) {
        emprestimos += l.valor;
      } else if (cod.startsWith('5')) {
        investimentos += l.valor;
      }
    });

    const recOperacionalBruta = receitas - custos - despesas;
    const resultadoLiquido = recOperacionalBruta + liberacoes - emprestimos - investimentos;

    if (tipo === 'dre') {
      const vals = {
        receita_vendas: 0,
        impostos: 0,
        cmv: 0,
        despesas_fixas: 0,
        despesas_variaveis: 0,
        despesas_pessoal: 0,
        despesas_bancarias: 0,
        despesas_terceiros: 0,
        outras_receitas: 0,
        outras_despesas: 0,
      };

      lancs.forEach(l => {
        const pc = plano.find(p => p.id === l.planoContaId);
        if (!pc) return;
        const cat = pc.dreCategoria;
        if (cat && cat in vals) {
          vals[cat as keyof typeof vals] += l.valor;
        } else {
          if (l.tipo === 'receita') vals.outras_receitas += l.valor;
          else vals.outras_despesas += l.valor;
        }
      });

      const recLiquida = vals.receita_vendas - vals.impostos;
      const lucroBruto = recLiquida - vals.cmv;
      const lucroOperacional = lucroBruto - vals.despesas_fixas - vals.despesas_variaveis - vals.despesas_pessoal - vals.despesas_bancarias - vals.despesas_terceiros;
      const resultadoFinal = lucroOperacional + vals.outras_receitas - vals.outras_despesas;

      const rows: (string | number)[][] = [
        ['Receita Total de Vendas', fmt.currency(vals.receita_vendas)],
        ['(-) Despesas com Impostos', `-${fmt.currency(vals.impostos)}`],
        ['(=) Receita Líquida', fmt.currency(recLiquida)],
        ['(-) CMV (Custo da Mercadoria Vendida)', `-${fmt.currency(vals.cmv)}`],
        ['(=) Lucro Bruto', fmt.currency(lucroBruto)],
        ['(-) Despesas Fixas', `-${fmt.currency(vals.despesas_fixas)}`],
        ['(-) Despesas Variáveis', `-${fmt.currency(vals.despesas_variaveis)}`],
        ['(-) Despesas com Pessoal', `-${fmt.currency(vals.despesas_pessoal)}`],
        ['(-) Despesas Bancárias', `-${fmt.currency(vals.despesas_bancarias)}`],
        ['(-) Despesas com Terceiros', `-${fmt.currency(vals.despesas_terceiros)}`],
        ['(=) Lucro Operacional', fmt.currency(lucroOperacional)],
        ['(+) Outras Receitas', fmt.currency(vals.outras_receitas)],
        ['(-) Outras Despesas', `-${fmt.currency(vals.outras_despesas)}`],
        ['(=) Resultado Líquido Final', fmt.currency(resultadoFinal)],
      ];

      setPreview({ rows, totais: [
        { label: 'Lucro Bruto', value: fmt.currency(lucroBruto), color: lucroBruto >= 0 ? 'green' : 'red' },
        { label: 'Lucro Operacional', value: fmt.currency(lucroOperacional), color: lucroOperacional >= 0 ? 'green' : 'red' },
        { label: 'Resultado Líquido Final', value: fmt.currency(resultadoFinal), color: resultadoFinal >= 0 ? 'green' : 'red' },
      ]});
    } else if (tipo === 'fluxo') {
      const rows: (string | number)[][] = [
        ['Receitas', fmt.currency(receitas)],
        ['Custos de Mercadoria', fmt.currency(custos)],
        ['Despesas', fmt.currency(despesas)],
        ['(=) Receita Operacional Bruta (Receita - Custos - Despesas)', fmt.currency(recOperacionalBruta)],
        ['Liberações Bancárias', fmt.currency(liberacoes)],
        ['Empréstimos', fmt.currency(emprestimos)],
        ['Investimentos', fmt.currency(investimentos)],
        ['(=) Resultado Mensal Líquido (Operacional + Liberações - Empréstimos - Investimentos)', fmt.currency(resultadoLiquido)]
      ];
      setPreview({ rows, totais: [
        { label: 'Rec. Operacional Bruta', value: fmt.currency(recOperacionalBruta), color: recOperacionalBruta >= 0 ? 'green' : 'red' },
        { label: 'Resultado Mensal Líquido', value: fmt.currency(resultadoLiquido), color: resultadoLiquido >= 0 ? 'green' : 'red' },
        { label: 'Registros no Período', value: String(lancs.length) }
      ]});
    } else {
      const rows = data.map(d => [d.data, d.descricao, d.tipo, d.planoConta, d.portador, d.status, d.valor]);
      setPreview({ rows, totais: [
        { label: 'Total Receitas', value: fmt.currency(receitas), color: 'green' },
        { label: 'Total Despesas', value: fmt.currency(despesas), color: 'red' },
        { label: 'Resultado', value: fmt.currency(receitas - despesas), color: (receitas - despesas) >= 0 ? 'green' : 'red' },
        { label: 'Registros', value: String(lancs.length) },
      ]});
    }
  };

  useEffect(() => { buildPreview(); }, [empresaId, tipo, dataIni, dataFim, portadorFiltro, statusFiltro]);

  const getColumns = () => {
    if (tipo === 'fluxo') return ['Estrutura de Fluxo de Caixa Gerencial', 'Total no Período'];
    if (tipo === 'dre') return ['Estrutura DRE Gerencial', 'Total no Período'];
    return ['Data', 'Descrição', 'Tipo', 'Plano de Contas', 'Portador', 'Status', 'Valor'];
  };

  const handlePDF = async () => {
    if (!empresa) return;
    setGenerating('pdf');
    try {
      await generatePDF({
        title: getTitle(),
        empresa,
        periodo: getPeriodo(),
        columns: getColumns(),
        rows: preview?.rows || [],
        summary: preview?.totais,
        tipo,
      });
    } finally { setGenerating(null); }
  };

  const handleXLS = async () => {
    if (!empresa) return;
    setGenerating('xls');
    try {
      await generateXLS({
        title: getTitle(),
        empresa,
        periodo: getPeriodo(),
        columns: getColumns(),
        rows: preview?.rows || [],
      });
    } finally { setGenerating(null); }
  };

  const handlePrint = () => { window.print(); };

  const renderGroupRow = (id: string, group: any, totalReceitas: number) => {
    const isExpanded = !!expandedGroups[id];
    const displayVal = group.isDespesa ? `-${fmt.currency(group.total)}` : fmt.currency(group.total);
    const valueColor = group.total > 0 ? (group.isDespesa ? 'var(--red)' : 'var(--green)') : 'var(--text-muted)';
    const pctV = totalReceitas > 0 && group.total > 0 ? ((group.total / totalReceitas) * 100).toFixed(1) + '%' : '0.0%';
    
    return (
      <div key={id} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div 
          onClick={() => setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }))}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 18px', cursor: 'pointer', background: 'var(--bg-card)',
            transition: 'background 0.2s', fontWeight: 600, fontSize: 13,
            userSelect: 'none'
          }}
          className="accordion-header-row"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ 
              fontSize: 9, 
              color: 'var(--text-muted)', 
              display: 'inline-block',
              transform: isExpanded ? 'rotate(90deg)' : 'none', 
              transition: 'transform 0.15s ease' 
            }}>▶</span>
            <span>{group.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, minWidth: 40, textAlign: 'right' }}>{pctV}</span>
            <span style={{ color: valueColor, fontWeight: 700, minWidth: 100, textAlign: 'right' }}>{displayVal}</span>
          </div>
        </div>

        {isExpanded && (
          <div style={{ background: 'rgba(0,0,0,0.01)', borderTop: '1px solid rgba(0,0,0,0.03)' }}>
            {group.subaccounts.length === 0 ? (
              <div style={{ padding: '12px 38px', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Nenhum lançamento nesta categoria no período selecionado.
              </div>
            ) : group.subaccounts.map((sub: any) => {
              const isSubExpanded = !!expandedSubs[sub.id];
              const subVal = group.isDespesa ? `-${fmt.currency(sub.total)}` : fmt.currency(sub.total);
              const subPctV = totalReceitas > 0 && sub.total > 0 ? ((sub.total / totalReceitas) * 100).toFixed(1) + '%' : '0.0%';
              
              return (
                <div key={sub.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.02)' }}>
                  <div
                    onClick={() => setExpandedSubs(prev => ({ ...prev, [sub.id]: !prev[sub.id] }))}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 18px 10px 38px', cursor: 'pointer', fontSize: 12.5, fontWeight: 500,
                      userSelect: 'none'
                    }}
                    className="accordion-sub-row"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ 
                        fontSize: 8, 
                        color: 'var(--text-muted)', 
                        display: 'inline-block',
                        transform: isSubExpanded ? 'rotate(90deg)' : 'none', 
                        transition: 'transform 0.15s ease' 
                      }}>▶</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{sub.desc}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, minWidth: 40, textAlign: 'right' }}>{subPctV}</span>
                      <span style={{ fontWeight: 600, color: group.isDespesa ? 'var(--red)' : 'var(--green)', minWidth: 100, textAlign: 'right' }}>{subVal}</span>
                    </div>
                  </div>

                  {isSubExpanded && (
                    <div style={{ background: '#ffffff', padding: '10px 15px 10px 48px', borderTop: '1px solid rgba(0,0,0,0.02)', borderBottom: '1px solid rgba(0,0,0,0.02)' }}>
                      <table style={{ width: '100%', fontSize: 11.5, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', color: 'var(--text-muted)', textAlign: 'left' }}>
                            <th style={{ padding: '6px 8px', fontWeight: 600 }}>Data</th>
                            <th style={{ padding: '6px 8px', fontWeight: 600 }}>Descrição</th>
                            <th style={{ padding: '6px 8px', fontWeight: 600 }}>Portador</th>
                            <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sub.lancs.map((l: any) => (
                            <tr key={l.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.01)' }}>
                              <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{fmt.date(l.data)}</td>
                              <td style={{ padding: '6px 8px', fontWeight: 500, color: 'var(--text-main)' }}>{l.descricao}</td>
                              <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{portadores.find(p => p.id === l.portadorId)?.nome || '-'}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: l.tipo === 'receita' ? 'var(--green)' : 'var(--red)' }}>
                                {l.tipo === 'receita' ? '+' : '-'}{fmt.currency(l.valor)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const portadores = store.getPortadores(empresaId);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Relatórios</div>
          <div className="page-subtitle">Emissão e exportação de relatórios financeiros</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={handlePrint} disabled={!!generating}>🖨️ Imprimir</button>
          <button className="btn btn-success" onClick={handleXLS} disabled={!!generating}>
            {generating === 'xls' ? '⏳...' : '📊 Excel'}
          </button>
          <button className="btn btn-primary" onClick={handlePDF} disabled={!!generating}>
            {generating === 'pdf' ? '⏳...' : '📄 PDF'}
          </button>
        </div>
      </div>

      <div className="page-body">
        <GeminiTips
          empresaId={empresaId}
          dataIni={dataIni}
          dataFim={dataFim}
          status={statusFiltro}
          portadorId={portadorFiltro}
          contextKey={`${tipo}-${dataIni}-${dataFim}-${statusFiltro}-${portadorFiltro}`}
        />

        {/* Config */}
        <div className="card card-sm" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Tipo de Relatório</label>
              <select className="form-control" value={tipo} onChange={e => setTipo(e.target.value as typeof tipo)}>
                <option value="fluxo">Fluxo de Caixa</option>
                <option value="extrato">Extrato Detalhado</option>
                <option value="dre">DRE — Demonstrativo de Resultado</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Data Início</label>
              <input type="date" className="form-control" value={dataIni} onChange={e => setDataIni(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Data Fim</label>
              <input type="date" className="form-control" value={dataFim} onChange={e => setDataFim(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Portador</label>
              <select className="form-control" value={portadorFiltro} onChange={e => setPortadorFiltro(e.target.value)}>
                <option value="">Todos</option>
                {portadores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Status</label>
              <select className="form-control" value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}>
                <option value="">Todos</option>
                <option value="realizado">Realizado</option>
                <option value="previsto">Previsto</option>
              </select>
            </div>
          </div>
        </div>

        {/* Totais */}
        {preview && (
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            {preview.totais.map((t, i) => (
              <div key={i} className={`stat-card ${t.color || 'blue'}`}>
                <div className={`stat-icon ${t.color || 'blue'}`}>≈</div>
                <div className="stat-label">{t.label}</div>
                <div className="stat-value" style={{ fontSize: 18, color: t.color === 'green' ? 'var(--green)' : t.color === 'red' ? 'var(--red)' : undefined }}>
                  {t.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Preview Table */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">{getTitle()}</div>
              <div className="card-subtitle">Período: {getPeriodo()} — {empresa?.razaoSocial}</div>
            </div>
          </div>
          {tipo === 'fluxo' ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* 1. Receitas */}
              {renderGroupRow('receitas', drilldownData.groups.receitas, drilldownData.groups.receitas.total)}
              
              {/* 2. Custos de Mercadoria */}
              {renderGroupRow('custos', drilldownData.groups.custos, drilldownData.groups.receitas.total)}
              
              {/* 3. Despesas */}
              {renderGroupRow('despesas', drilldownData.groups.despesas, drilldownData.groups.receitas.total)}
              
              {/* 4. Receita Operacional Bruta */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 18px', background: 'rgba(96,0,0,0.04)',
                fontWeight: 700, fontSize: 13, borderBottom: '1px solid rgba(96,0,0,0.08)',
                borderTop: '1px solid rgba(96,0,0,0.1)'
              }}>
                <span>(=) Receita Operacional Bruta (Receita - Custos - Despesas)</span>
                <span style={{ color: drilldownData.recOperacionalBruta >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                  {fmt.currency(drilldownData.recOperacionalBruta)}
                </span>
              </div>

              {/* 5. Liberações Bancárias */}
              {renderGroupRow('liberacoes', drilldownData.groups.liberacoes, drilldownData.groups.receitas.total)}

              {/* 6. Empréstimos */}
              {renderGroupRow('emprestimos', drilldownData.groups.emprestimos, drilldownData.groups.receitas.total)}

              {/* 7. Investimentos */}
              {renderGroupRow('investimentos', drilldownData.groups.investimentos, drilldownData.groups.receitas.total)}

              {/* 8. Resultado Mensal Líquido */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 18px', background: 'rgba(96,0,0,0.06)',
                fontWeight: 700, fontSize: 13, borderTop: '2px solid rgba(96,0,0,0.15)',
                borderBottom: '1px solid rgba(96,0,0,0.08)'
              }}>
                <span>(=) Resultado Mensal Líquido (Operacional + Liberações - Empréstimos - Investimentos)</span>
                <span style={{ color: drilldownData.resultadoLiquido >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                  {fmt.currency(drilldownData.resultadoLiquido)}
                </span>
              </div>
              
              {/* Saldos dos Portadores */}
              <div style={{ marginTop: 20, borderTop: '2px dashed var(--border)', paddingTop: 16 }}>
                <div style={{ padding: '0 18px', fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>
                  Saldos Finais dos Portadores (Atuais)
                </div>
                {store.getPortadores(empresaId).filter(p => p.ativo).map(p => {
                  const saldo = store.getSaldoPortador(p.id, empresaId);
                  return (
                    <div key={p.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 18px', fontSize: 12, color: 'var(--text-secondary)'
                    }}>
                      <span>🏦 {p.nome}</span>
                      <span style={{ fontWeight: 600, color: saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {fmt.currency(saldo)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>{getColumns().map(c => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {preview?.rows.length === 0 ? (
                    <tr><td colSpan={9}>
                      <div className="empty-state">
                        <div className="empty-state-icon">📄</div>
                        <h3>Nenhum dado encontrado</h3>
                        <p>Ajuste o período ou os filtros.</p>
                      </div>
                    </td></tr>
                  ) : preview?.rows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => {
                        const isVal = String(cell).includes('R$');
                        const isReceita = String(row[2]) === 'Receita';
                        return (
                          <td key={ci} style={{
                            fontSize: 12.5,
                            color: isVal ? (isReceita ? 'var(--green)' : 'var(--red)') : undefined,
                            fontWeight: isVal ? 600 : undefined,
                          }}>
                            {cell}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
