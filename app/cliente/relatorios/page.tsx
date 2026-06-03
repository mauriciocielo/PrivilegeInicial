'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { store, Empresa } from '../../../lib/store';
import { fmt, generatePDF, generateXLS, buildFluxoCaixaData } from '../../../lib/reports';
import GeminiTips from '../../../components/GeminiTips';

const isContaRedutoraReceita = (descricao: string) => descricao.trim().startsWith('( - )');

const getMonthsInRange = (start: string, end: string) => {
  const months = [];
  const dStart = new Date(start + 'T12:00:00');
  const dEnd = new Date(end + 'T12:00:00');
  let curr = new Date(dStart.getFullYear(), dStart.getMonth(), 1);
  while (curr <= dEnd) {
    months.push(new Date(curr));
    curr.setMonth(curr.getMonth() + 1);
  }
  return months;
};

export default function RelatoriosPage() {
  const [empresaId, setEmpresaId] = useState('');
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
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('46999048990');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  const load = useCallback((eId: string) => {
    const list = store.getEmpresas();
    let targetId = eId;
    if (!list.find(e => e.id === targetId)) {
      if (list.length > 0) {
        targetId = list[0].id;
        sessionStorage.setItem('cf_empresa_sel', targetId);
      }
    }
    setEmpresaId(targetId);
    setEmpresa(list.find(e => e.id === targetId) || null);
  }, []);

  useEffect(() => {
    setCurrentUser(store.getCurrentUser());
    const saved = sessionStorage.getItem('cf_empresa_sel') || '';
    load(saved);

    const handler = (e: Event) => load((e as CustomEvent).detail);
    window.addEventListener('empresaChange', handler);

    const dataHandler = () => {
      const currentSaved = sessionStorage.getItem('cf_empresa_sel') || '';
      load(currentSaved);
    };
    window.addEventListener('cfDataChange', dataHandler);

    return () => {
      window.removeEventListener('empresaChange', handler);
      window.removeEventListener('cfDataChange', dataHandler);
    };
  }, [load]);

  const drilldownData = useMemo(() => {
    const allLancs = store.getLancamentos(empresaId);
    const months = getMonthsInRange(dataIni, dataFim);
    const plano = store.getPlanoContas(empresaId);

    const lancs = allLancs.filter(l => l.data >= dataIni && l.data <= dataFim);
    let filteredLancs = lancs;
    if (portadorFiltro) filteredLancs = filteredLancs.filter(l => l.portadorId === portadorFiltro);
    if (statusFiltro) filteredLancs = filteredLancs.filter(l => l.status === statusFiltro);

    const initGroup = (id: string, label: string, isDespesa: boolean) => ({
      id, label, isDespesa, total: 0,
      monthlyTotals: months.reduce((acc, m) => {
        acc[m.toISOString().slice(0, 7)] = 0;
        return acc;
      }, {} as Record<string, number>),
      subaccounts: [] as any[]
    });

    const catGroups = {
      receitas: initGroup('receitas', 'Receitas', false),
      custos: initGroup('custos', 'Custos de Mercadoria', true),
      despesas: initGroup('despesas', 'Despesas', true),
      liberacoes: initGroup('liberacoes', 'Liberações Bancárias', false),
      emprestimos: initGroup('emprestimos', 'Empréstimos', true),
      investimentos: initGroup('investimentos', 'Investimentos', true),
    };

    const subaccountMap: Record<string, any> = {};

    filteredLancs.forEach(l => {
      const pc = plano.find(p => p.id === l.planoContaId);
      if (!pc) return;
      const cod = pc.codigo;
      const valorGerencial = cod.startsWith('1') && isContaRedutoraReceita(pc.descricao) ? -l.valor : l.valor;
      const mesKey = l.data.slice(0, 7);

      let groupKey: keyof typeof catGroups | null = null;
      if (cod.startsWith('1')) groupKey = 'receitas';
      else if (cod.startsWith('2')) groupKey = 'custos';
      else if (cod.startsWith('3')) groupKey = 'despesas';
      else if (cod.startsWith('4.1')) groupKey = 'liberacoes';
      else if (cod.startsWith('4.2')) groupKey = 'emprestimos';
      else if (cod.startsWith('5')) groupKey = 'investimentos';

      if (groupKey) {
        catGroups[groupKey].total += valorGerencial;
        catGroups[groupKey].monthlyTotals[mesKey] += valorGerencial;

        if (!subaccountMap[l.planoContaId]) {
          subaccountMap[l.planoContaId] = {
            id: l.planoContaId,
            desc: `${pc.codigo} - ${pc.descricao}`,
            total: 0,
            monthlyTotals: months.reduce((acc, m) => {
              acc[m.toISOString().slice(0, 7)] = 0;
              return acc;
            }, {} as Record<string, number>),
            lancs: []
          };
          catGroups[groupKey].subaccounts.push(subaccountMap[l.planoContaId]);
        }
        subaccountMap[l.planoContaId].total += valorGerencial;
        subaccountMap[l.planoContaId].monthlyTotals[mesKey] += valorGerencial;
        subaccountMap[l.planoContaId].lancs.push({ ...l, valorLinha: valorGerencial });
      }
    });

    Object.keys(catGroups).forEach(k => {
      const grp = catGroups[k as keyof typeof catGroups];
      grp.subaccounts.sort((a, b) => b.total - a.total);
    });

    const monthlySummary = months.map(m => {
      const k = m.toISOString().slice(0, 7);
      const receitas = catGroups.receitas.monthlyTotals[k];
      const custos = catGroups.custos.monthlyTotals[k];
      const despesas = catGroups.despesas.monthlyTotals[k];
      const liberacoes = catGroups.liberacoes.monthlyTotals[k];
      const emprestimos = catGroups.emprestimos.monthlyTotals[k];
      const investimentos = catGroups.investimentos.monthlyTotals[k];

      const recOp = receitas - custos - despesas;
      const resLiq = recOp + liberacoes - emprestimos - investimentos;

      return { key: k, recOp, resLiq };
    });

    return {
      groups: catGroups,
      months,
      monthlySummary
    };
  }, [empresaId, dataIni, dataFim, portadorFiltro, statusFiltro]);

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
    const saldosPortadores = portadores
      .filter(p => p.ativo)
      .map(p => ({
        nome: p.nome,
        saldo: store.getSaldoPortador(p.id, empresaId, dataFim),
      }));
    const saldoFinalCaixa = saldosPortadores.reduce((acc, p) => acc + p.saldo, 0);

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
      const valorGerencial = cod.startsWith('1') && isContaRedutoraReceita(pc.descricao) ? -l.valor : l.valor;

      if (cod.startsWith('1')) {
        receitas += valorGerencial;
      } else if (cod.startsWith('2')) {
        custos += valorGerencial;
      } else if (cod.startsWith('3')) {
        despesas += valorGerencial;
      } else if (cod.startsWith('4.1')) {
        liberacoes += valorGerencial;
      } else if (cod.startsWith('4.2')) {
        emprestimos += valorGerencial;
      } else if (cod.startsWith('5')) {
        investimentos += valorGerencial;
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

      setPreview({
        rows, totais: [
          { label: 'Lucro Bruto', value: fmt.currency(lucroBruto), color: lucroBruto >= 0 ? 'green' : 'red' },
          { label: 'Lucro Operacional', value: fmt.currency(lucroOperacional), color: lucroOperacional >= 0 ? 'green' : 'red' },
          { label: 'Resultado Líquido Final', value: fmt.currency(resultadoFinal), color: resultadoFinal >= 0 ? 'green' : 'red' },
        ]
      });
    } else if (tipo === 'fluxo') {
      const rows: (string | number)[][] = [
        ['Receitas', fmt.currency(receitas)],
        ['Custos de Mercadoria', fmt.currency(custos)],
        ['Despesas', fmt.currency(despesas)],
        ['(=) Receita Operacional Bruta (Receita - Custos - Despesas)', fmt.currency(recOperacionalBruta)],
        ['Liberações Bancárias', fmt.currency(liberacoes)],
        ['Empréstimos', fmt.currency(emprestimos)],
        ['Investimentos', fmt.currency(investimentos)],
        ['(=) Resultado Mensal Líquido (Operacional + Liberações - Empréstimos - Investimentos)', fmt.currency(resultadoLiquido)],
        ['', ''],
        [`Saldos Finais dos Portadores ate ${fmt.date(dataFim)}`, ''],
        ...saldosPortadores.map(p => [p.nome, fmt.currency(p.saldo)]),
      ];
      setPreview({
        rows, totais: [
          { label: 'Rec. Operacional Bruta', value: fmt.currency(recOperacionalBruta), color: recOperacionalBruta >= 0 ? 'green' : 'red' },
          { label: 'Resultado Mensal Líquido', value: fmt.currency(resultadoLiquido), color: resultadoLiquido >= 0 ? 'green' : 'red' },
          { label: 'Saldo Caixa Final', value: fmt.currency(saldoFinalCaixa), color: saldoFinalCaixa >= 0 ? 'green' : 'red' },
          { label: 'Registros no Período', value: String(lancs.length) }
        ]
      });
    } else {
      const rows = data.map(d => [d.data, d.descricao, d.tipo, d.planoConta, d.portador, d.status, d.valor]);
      setPreview({
        rows, totais: [
          { label: 'Total Receitas', value: fmt.currency(receitas), color: 'green' },
          { label: 'Total Despesas', value: fmt.currency(despesas), color: 'red' },
          { label: 'Resultado', value: fmt.currency(receitas - despesas), color: (receitas - despesas) >= 0 ? 'green' : 'red' },
          { label: 'Registros', value: String(lancs.length) },
        ]
      });
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

  const handleWhatsAppClick = () => {
    if (!empresa || !preview) return;
    
    // Formata mensagem para WhatsApp
    const periodStr = getPeriodo();
    let msg = `*Privilege Financeiro - ${getTitle()}*\n`;
    msg += `🏢 *Empresa:* ${empresa.nomeFantasia || empresa.razaoSocial}\n`;
    msg += `📅 *Período:* ${periodStr}\n\n`;

    if (tipo === 'fluxo' || tipo === 'dre') {
      preview.rows.forEach(row => {
        if (!row[0] && !row[1]) return;
        if (row[0] && row[1]) {
          msg += `• *${row[0]}:* ${row[1]}\n`;
        } else if (row[0]) {
          msg += `\n*${row[0]}*\n`;
        }
      });
    } else {
      msg += `*Principais Lançamentos:*\n`;
      preview.rows.slice(0, 15).forEach(row => {
        msg += `• ${row[0]} - ${row[1]}: *${row[6]}*\n`;
      });
      if (preview.rows.length > 15) {
        msg += `\n_E mais ${preview.rows.length - 15} lançamentos..._\n`;
      }
    }

    msg += `\n*Totais Consolidados:*\n`;
    preview.totais.forEach(t => {
      msg += `• *${t.label}:* ${t.value}\n`;
    });

    msg += `\n*Privilege Contabilidade e Consultoria*`;

    setWhatsappMessage(msg);
    setWhatsappPhone(empresa.telefone ? empresa.telefone.replace(/\D/g, '') : '46999048990');
    setShowWhatsAppModal(true);
  };

  const handleWhatsAppSend = async () => {
    if (!whatsappPhone || !whatsappMessage) {
      alert('Por favor, informe o telefone e a mensagem.');
      return;
    }
    setSendingWhatsApp(true);
    try {
      const res = await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: whatsappPhone, message: whatsappMessage })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('Relatório enviado com sucesso via WhatsApp!');
        setShowWhatsAppModal(false);
      } else {
        const confirmFallback = confirm(
          `A API do WhatsApp não está configurada no servidor (.env).\n\nDeseja abrir o WhatsApp Web/App para enviar esta mensagem manualmente?`
        );
        if (confirmFallback) {
          const cleanPhone = whatsappPhone.replace(/\D/g, '');
          const encodedText = encodeURIComponent(whatsappMessage);
          window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`, '_blank');
          setShowWhatsAppModal(false);
        }
      }
    } catch (err) {
      console.error(err);
      const confirmFallback = confirm(
        'Falha de rede ao conectar com o servidor. Deseja abrir o WhatsApp para enviar manualmente?'
      );
      if (confirmFallback) {
        const cleanPhone = whatsappPhone.replace(/\D/g, '');
        const encodedText = encodeURIComponent(whatsappMessage);
        window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`, '_blank');
        setShowWhatsAppModal(false);
      }
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const renderGroupRow = (id: string, group: any, months: Date[]) => {
    const isExpanded = !!expandedGroups[id];
    const valueColor = group.total < 0 ? 'var(--red)' : group.total > 0 ? (group.isDespesa ? 'var(--red)' : 'var(--green)') : 'var(--text-muted)';
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
            {months.map(m => {
              const val = group.monthlyTotals[m.toISOString().slice(0, 7)];
              return (
                <span key={m.getTime()} style={{ color: val === 0 ? 'var(--text-muted)' : valueColor, fontWeight: 700, minWidth: 100, textAlign: 'right' }}>
                  {group.isDespesa && val !== 0 ? '-' : ''}{fmt.currency(val)}
                </span>
              );
            })}
            <span style={{ color: valueColor, fontWeight: 800, minWidth: 100, textAlign: 'right', borderLeft: '1px solid var(--border)', paddingLeft: 8 }}>
              {group.isDespesa && group.total !== 0 ? '-' : ''}{fmt.currency(group.total)}
            </span>
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
                      {months.map(m => {
                        const val = sub.monthlyTotals[m.toISOString().slice(0, 7)];
                        return (
                          <span key={m.getTime()} style={{ fontWeight: 600, color: val === 0 ? 'var(--text-muted)' : (group.isDespesa ? 'var(--red)' : 'var(--green)'), minWidth: 100, textAlign: 'right' }}>
                            {group.isDespesa && val !== 0 ? '-' : ''}{fmt.currency(val)}
                          </span>
                        );
                      })}
                      <span style={{ fontWeight: 700, color: sub.total === 0 ? 'var(--text-muted)' : (group.isDespesa ? 'var(--red)' : 'var(--green)'), minWidth: 100, textAlign: 'right', borderLeft: '1px solid var(--border)', paddingLeft: 8 }}>
                        {group.isDespesa && sub.total !== 0 ? '-' : ''}{fmt.currency(sub.total)}
                      </span>
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
                              <td style={{ padding: '6px 8px', fontWeight: 500, color: 'var(--text-main)' }}>
                                <div>{l.descricao}</div>
                                {l.observacao && (
                                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, fontWeight: 'normal' }}>
                                    {l.observacao}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{portadores.find(p => p.id === l.portadorId)?.nome || '-'}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: (l.valorLinha ?? l.valor) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                {fmt.currency(l.valorLinha ?? (l.tipo === 'receita' ? l.valor : -l.valor))}
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
          {currentUser?.role === 'administrador' && (
            <button className="btn" onClick={handleWhatsAppClick} disabled={!!generating} style={{ background: '#25D366', borderColor: '#25D366', color: '#fff', fontWeight: 600 }}>
              💬 WhatsApp
            </button>
          )}
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
            <div style={{ display: 'flex', flexDirection: 'column', overflowX: 'auto' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', padding: '10px 18px',
                background: 'var(--bg-base)', borderBottom: '2px solid var(--border)',
                fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase'
              }}>
                <span>Categorias</span>
                <div style={{ display: 'flex', gap: 16 }}>
                  {drilldownData.months.map(m => (
                    <span key={m.getTime()} style={{ minWidth: 100, textAlign: 'right' }}>{m.toLocaleString('pt-BR', { month: 'short', year: '2-digit' })}</span>
                  ))}
                  <span style={{ minWidth: 100, textAlign: 'right', borderLeft: '1px solid var(--border)', paddingLeft: 8 }}>Total Acum.</span>
                </div>
              </div>

              {/* 1. Receitas */}
              {renderGroupRow('receitas', drilldownData.groups.receitas, drilldownData.months)}

              {/* 2. Custos de Mercadoria */}
              {renderGroupRow('custos', drilldownData.groups.custos, drilldownData.months)}

              {/* 3. Despesas */}
              {renderGroupRow('despesas', drilldownData.groups.despesas, drilldownData.months)}

              {/* 4. Receita Operacional Bruta */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 18px', background: 'rgba(96,0,0,0.04)',
                fontWeight: 700, fontSize: 13, borderBottom: '1px solid rgba(96,0,0,0.08)',
                borderTop: '1px solid rgba(96,0,0,0.1)'
              }}>
                <span>(=) Receita Operacional Bruta (Receita - Custos - Despesas)</span>
                <div style={{ display: 'flex', gap: 16 }}>
                  {drilldownData.monthlySummary.map(s => (
                    <span key={s.key} style={{ minWidth: 100, textAlign: 'right', color: s.recOp >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {fmt.currency(s.recOp)}
                    </span>
                  ))}
                  <span style={{ minWidth: 100, textAlign: 'right', fontWeight: 800, borderLeft: '1px solid var(--border)', paddingLeft: 8, color: drilldownData.monthlySummary.reduce((a, b) => a + b.recOp, 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {fmt.currency(drilldownData.monthlySummary.reduce((a, b) => a + b.recOp, 0))}
                  </span>
                </div>
              </div>

              {/* 5. Liberações Bancárias */}
              {renderGroupRow('liberacoes', drilldownData.groups.liberacoes, drilldownData.months)}

              {/* 6. Empréstimos */}
              {renderGroupRow('emprestimos', drilldownData.groups.emprestimos, drilldownData.months)}

              {/* 7. Investimentos */}
              {renderGroupRow('investimentos', drilldownData.groups.investimentos, drilldownData.months)}

              {/* 8. Resultado Mensal Líquido */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 18px', background: 'rgba(96,0,0,0.06)',
                fontWeight: 700, fontSize: 13, borderTop: '2px solid rgba(96,0,0,0.15)',
                borderBottom: '1px solid rgba(96,0,0,0.08)'
              }}>
                <span>(=) Resultado Mensal Líquido</span>
                <div style={{ display: 'flex', gap: 16 }}>
                  {drilldownData.monthlySummary.map(s => (
                    <span key={s.key} style={{ minWidth: 100, textAlign: 'right', color: s.resLiq >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {fmt.currency(s.resLiq)}
                    </span>
                  ))}
                  <span style={{ minWidth: 100, textAlign: 'right', fontWeight: 800, borderLeft: '1px solid var(--border)', paddingLeft: 8, color: drilldownData.monthlySummary.reduce((a, b) => a + b.resLiq, 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {fmt.currency(drilldownData.monthlySummary.reduce((a, b) => a + b.resLiq, 0))}
                  </span>
                </div>
              </div>

              {/* Saldos dos Portadores */}
              <div style={{ marginTop: 20, borderTop: '2px dashed var(--border)', paddingTop: 16 }}>
                <div style={{ padding: '0 18px', fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>
                  Saldos Finais dos Portadores no Período
                </div>
                {store.getPortadores(empresaId).filter(p => p.ativo).map(p => {
                  const saldo = store.getSaldoPortador(p.id, empresaId, dataFim);
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
                        <div className="empty-state-icon">📋</div>
                        <h3>Nenhum dado para o período</h3>
                      </div>
                    </td></tr>
                  ) : preview?.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => <td key={j}>{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showWhatsAppModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowWhatsAppModal(false)}>
          <div className="modal modal-md">
            <div className="modal-header">
              <h2 className="modal-title">Disparo de Relatório — WhatsApp</h2>
              <button className="modal-close" onClick={() => setShowWhatsAppModal(false)}>✕</button>
            </div>
            
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Número do WhatsApp (DDD + Número)</label>
              <input 
                type="text" 
                className="form-control" 
                value={whatsappPhone} 
                onChange={e => setWhatsappPhone(e.target.value.replace(/\D/g, ''))} 
                placeholder="Ex: 46999048990"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Mensagem Formatada (Você pode editar se quiser)</label>
              <textarea 
                className="form-control" 
                style={{ minHeight: 250, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
                value={whatsappMessage} 
                onChange={e => setWhatsappMessage(e.target.value)} 
              />
            </div>

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowWhatsAppModal(false)}>Cancelar</button>
              <button 
                className="btn btn-success" 
                onClick={handleWhatsAppSend} 
                disabled={sendingWhatsApp}
                style={{ background: '#25D366', borderColor: '#25D366', color: '#fff' }}
              >
                {sendingWhatsApp ? 'Enviando...' : '✓ Enviar via WhatsApp'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
