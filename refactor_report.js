const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Add new groups
  content = content.replace(
    /investimentos:\s*initGroup\('investimentos',\s*'Investimentos',\s*true\),/g,
    `investimentos: initGroup('investimentos', 'Investimentos', true),
      transferencias: initGroup('transferencias', 'Transferências', false),
      nao_categorizados: initGroup('nao_categorizados', '⚠️ Lançamentos Inconsistentes / Não Categorizados', false),`
  );

  // 2. Fix the pc logic
  const oldPcLogic = `      const pc = plano.find(p => p.id === l.planoContaId);
      if (!pc) return;
      const cod = pc.codigo;
      const valorGerencial = cod.startsWith('1') && isContaRedutoraReceita(pc.descricao) ? -l.valor : l.valor;
      const mesKey = l.data.slice(0, 7);

      let groupKey: keyof typeof catGroups | null = null;
      if (cod.startsWith('1')) groupKey = 'receitas';
      else if (cod.startsWith('2')) groupKey = 'custos';
      else if (cod.startsWith('3')) {
        let cat = pc.dreCategoria;
        if (!cat) {
          if (cod.startsWith('3.1')) cat = 'despesas_fixas';
          else if (cod.startsWith('3.2')) cat = 'despesas_variaveis';
          else if (cod.startsWith('3.3')) cat = 'impostos';
          else if (cod.startsWith('3.4')) cat = 'despesas_terceiros';
          else if (cod.startsWith('3.5')) cat = 'despesas_pessoal';
          else if (cod.startsWith('3.6')) cat = 'despesas_bancarias';
        }
        
        if (cat === 'impostos') groupKey = 'despesas_impostos';
        else if (cat === 'despesas_fixas') groupKey = 'despesas_fixas';
        else if (cat === 'despesas_variaveis') groupKey = 'despesas_variaveis';
        else if (cat === 'despesas_pessoal') groupKey = 'despesas_pessoal';
        else if (cat === 'despesas_bancarias') groupKey = 'despesas_bancarias';
        else if (cat === 'despesas_terceiros') groupKey = 'despesas_terceiros';
        else groupKey = 'outras_despesas';
      }
      else if (cod.startsWith('4.1')) groupKey = 'liberacoes';
      else if (cod.startsWith('4.2')) groupKey = 'emprestimos';
      else if (cod.startsWith('5')) groupKey = 'investimentos';`;

  const newPcLogic = `      const pc = plano.find(p => p.id === l.planoContaId);
      const cod = pc ? pc.codigo : '';
      const isRedutora = pc && cod.startsWith('1') && isContaRedutoraReceita(pc.descricao);
      
      const mesKey = l.data.slice(0, 7);

      let groupKey: keyof typeof catGroups | null = null;
      if (cod.startsWith('1')) groupKey = 'receitas';
      else if (cod.startsWith('2')) groupKey = 'custos';
      else if (cod.startsWith('3')) {
        let cat = pc?.dreCategoria;
        if (!cat) {
          if (cod.startsWith('3.1')) cat = 'despesas_fixas';
          else if (cod.startsWith('3.2')) cat = 'despesas_variaveis';
          else if (cod.startsWith('3.3')) cat = 'impostos';
          else if (cod.startsWith('3.4')) cat = 'despesas_terceiros';
          else if (cod.startsWith('3.5')) cat = 'despesas_pessoal';
          else if (cod.startsWith('3.6')) cat = 'despesas_bancarias';
        }
        
        if (cat === 'impostos') groupKey = 'despesas_impostos';
        else if (cat === 'despesas_fixas') groupKey = 'despesas_fixas';
        else if (cat === 'despesas_variaveis') groupKey = 'despesas_variaveis';
        else if (cat === 'despesas_pessoal') groupKey = 'despesas_pessoal';
        else if (cat === 'despesas_bancarias') groupKey = 'despesas_bancarias';
        else if (cat === 'despesas_terceiros') groupKey = 'despesas_terceiros';
        else groupKey = 'outras_despesas';
      }
      else if (cod.startsWith('4.1')) groupKey = 'liberacoes';
      else if (cod.startsWith('4.2')) groupKey = 'emprestimos';
      else if (cod.startsWith('5')) groupKey = 'investimentos';
      else if (cod.startsWith('6') || l.tipo === 'transferencia' || (pc && pc.descricao.toLowerCase().includes('transfer'))) groupKey = 'transferencias';

      if (!groupKey) groupKey = 'nao_categorizados';

      let valorGerencial = l.valor;
      if (isRedutora) {
        valorGerencial = -l.valor;
      } else if (groupKey === 'nao_categorizados' || groupKey === 'transferencias') {
        valorGerencial = l.tipo === 'despesa' ? -l.valor : l.valor;
      }`;

  content = content.replace(oldPcLogic, newPcLogic);

  // Fix subaccount map logic to not crash on undefined planoContaId
  content = content.replace(
    /if \(\!subaccountMap\[l\.planoContaId\]\) \{/g,
    `const fallbackId = l.planoContaId || 'sem-plano-' + l.descricao;
        if (!subaccountMap[fallbackId]) {`
  );
  content = content.replace(
    /subaccountMap\[l\.planoContaId\] = \{/g,
    `subaccountMap[fallbackId] = {`
  );
  content = content.replace(
    /id: l\.planoContaId,/g,
    `id: fallbackId,`
  );
  content = content.replace(
    /desc: \`\$\{pc\.codigo\} - \$\{pc\.descricao\}\`,/g,
    `desc: pc ? \`\${pc.codigo} - \${pc.descricao}\` : (l.descricao || 'Sem Plano de Contas'),`
  );
  content = content.replace(
    /catGroups\[groupKey\]\.subaccounts\.push\(subaccountMap\[l\.planoContaId\]\);/g,
    `catGroups[groupKey].subaccounts.push(subaccountMap[fallbackId]);`
  );
  content = content.replace(
    /subaccountMap\[l\.planoContaId\]\.total \+\= valorGerencial;/g,
    `subaccountMap[fallbackId].total += valorGerencial;`
  );
  content = content.replace(
    /subaccountMap\[l\.planoContaId\]\.monthlyTotals\[mesKey\] \+\= valorGerencial;/g,
    `subaccountMap[fallbackId].monthlyTotals[mesKey] += valorGerencial;`
  );
  content = content.replace(
    /subaccountMap\[l\.planoContaId\]\.lancs\.push\(\{ \.\.\.l, valorLinha: valorGerencial \}\);/g,
    `subaccountMap[fallbackId].lancs.push({ ...l, valorLinha: valorGerencial });`
  );

  // 3. Update monthlySummary calculation
  const oldSummaryLogic = `      const recOp = receitas - custos - despesas;
      const resLiq = recOp + liberacoes - emprestimos - investimentos;

      return { key: k, recOp, resLiq };`;

  const newSummaryLogic = `      const recOp = receitas - custos - despesas;
      const resBruto = recOp + liberacoes - emprestimos - investimentos;
      const transferencias = catGroups.transferencias.monthlyTotals[k];
      const naoCat = catGroups.nao_categorizados.monthlyTotals[k];
      const resLiq = resBruto + transferencias + naoCat;

      return { key: k, recOp, resBruto, resLiq };`;

  content = content.replace(oldSummaryLogic, newSummaryLogic);

  // 4. Update the preview.rows (Export)
  const oldExportRows = `        ['(=) Receita Operacional Bruta', fmt.currency(recOp)],
        ['(+) Liberações Bancárias', fmt.currency(drilldownData.groups.liberacoes.total)],
        ['(-) Empréstimos', fmt.currency(drilldownData.groups.emprestimos.total)],
        ['(-) Investimentos', fmt.currency(drilldownData.groups.investimentos.total)],
        ['(=) Resultado Mensal Líquido', fmt.currency(resLiq)],`;

  const newExportRows = `        ['(=) Receita Operacional Bruta', fmt.currency(recOp)],
        ['(+) Liberações Bancárias', fmt.currency(drilldownData.groups.liberacoes.total)],
        ['(-) Empréstimos', fmt.currency(drilldownData.groups.emprestimos.total)],
        ['(-) Investimentos', fmt.currency(drilldownData.groups.investimentos.total)],
        ['(=) Resultado Bruto Mensal', fmt.currency(recOp + drilldownData.groups.liberacoes.total - drilldownData.groups.emprestimos.total - drilldownData.groups.investimentos.total)],
        ['(+/-) Transferências', fmt.currency(drilldownData.groups.transferencias.total)],
        ['(+/-) Lançamentos Inconsistentes / Não Categorizados', fmt.currency(drilldownData.groups.nao_categorizados.total)],
        ['(=) Resultado Mensal Líquido', fmt.currency(recOp + drilldownData.groups.liberacoes.total - drilldownData.groups.emprestimos.total - drilldownData.groups.investimentos.total + drilldownData.groups.transferencias.total + drilldownData.groups.nao_categorizados.total)],`;

  content = content.replace(oldExportRows, newExportRows);

  // 5. Update UI rendering block (JSX)
  const oldUILogic = `                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 18px', fontSize: 12, fontWeight: 600, color: 'var(--text-main)', background: 'var(--bg-body)' }}>
                  <span>(=) Saldo Final Calculado</span>`;

  const newUILogic = `                {/* Resultado Bruto Mensal */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 18px', fontSize: 13, fontWeight: 700, color: 'var(--text-main)', background: 'var(--bg-body)' }}>
                  <span>(=) Resultado Bruto Mensal</span>
                  <div style={{ display: 'flex', gap: 16 }}>
                    {drilldownData.months.map(m => {
                      const k = m.toISOString().slice(0, 7);
                      const rec = drilldownData.groups.receitas.monthlyTotals[k];
                      const cus = drilldownData.groups.custos.monthlyTotals[k];
                      const desp = drilldownData.groups.despesas_impostos.monthlyTotals[k] + drilldownData.groups.despesas_fixas.monthlyTotals[k] + drilldownData.groups.despesas_variaveis.monthlyTotals[k] + drilldownData.groups.despesas_pessoal.monthlyTotals[k] + drilldownData.groups.despesas_bancarias.monthlyTotals[k] + drilldownData.groups.despesas_terceiros.monthlyTotals[k] + drilldownData.groups.outras_despesas.monthlyTotals[k];
                      const recOp = rec - cus - desp;
                      const resBruto = recOp + drilldownData.groups.liberacoes.monthlyTotals[k] - drilldownData.groups.emprestimos.monthlyTotals[k] - drilldownData.groups.investimentos.monthlyTotals[k];
                      return <span key={m.getTime()} style={{ minWidth: 100, textAlign: 'right' }}>{fmt.currency(resBruto)}</span>;
                    })}
                    {(() => {
                      const despTotal = drilldownData.groups.despesas_impostos.total + drilldownData.groups.despesas_fixas.total + drilldownData.groups.despesas_variaveis.total + drilldownData.groups.despesas_pessoal.total + drilldownData.groups.despesas_bancarias.total + drilldownData.groups.despesas_terceiros.total + drilldownData.groups.outras_despesas.total;
                      const recOpTotal = drilldownData.groups.receitas.total - drilldownData.groups.custos.total - despTotal;
                      const resBrutoTotal = recOpTotal + drilldownData.groups.liberacoes.total - drilldownData.groups.emprestimos.total - drilldownData.groups.investimentos.total;
                      return <span style={{ minWidth: 100, textAlign: 'right', borderLeft: '1px solid var(--border)', paddingLeft: 8 }}>{fmt.currency(resBrutoTotal)}</span>;
                    })()}
                  </div>
                </div>

                {/* Transferencias */}
                {renderGroupRow('transferencias', drilldownData.groups.transferencias, drilldownData.months)}

                {/* Nao Categorizados (Diagnostico) */}
                {drilldownData.groups.nao_categorizados.total !== 0 && (
                   <div style={{ border: '2px solid var(--red)', margin: '10px 0', borderRadius: 4 }}>
                     {renderGroupRow('nao_categorizados', drilldownData.groups.nao_categorizados, drilldownData.months)}
                   </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 18px', fontSize: 13, fontWeight: 700, color: 'var(--text-main)', background: 'rgba(34,197,94,0.1)' }}>
                  <span>(=) Resultado Mensal Líquido</span>
                  <div style={{ display: 'flex', gap: 16 }}>
                    {drilldownData.months.map(m => {
                      const k = m.toISOString().slice(0, 7);
                      const rec = drilldownData.groups.receitas.monthlyTotals[k];
                      const cus = drilldownData.groups.custos.monthlyTotals[k];
                      const desp = drilldownData.groups.despesas_impostos.monthlyTotals[k] + drilldownData.groups.despesas_fixas.monthlyTotals[k] + drilldownData.groups.despesas_variaveis.monthlyTotals[k] + drilldownData.groups.despesas_pessoal.monthlyTotals[k] + drilldownData.groups.despesas_bancarias.monthlyTotals[k] + drilldownData.groups.despesas_terceiros.monthlyTotals[k] + drilldownData.groups.outras_despesas.monthlyTotals[k];
                      const recOp = rec - cus - desp;
                      const resBruto = recOp + drilldownData.groups.liberacoes.monthlyTotals[k] - drilldownData.groups.emprestimos.monthlyTotals[k] - drilldownData.groups.investimentos.monthlyTotals[k];
                      const resLiq = resBruto + drilldownData.groups.transferencias.monthlyTotals[k] + drilldownData.groups.nao_categorizados.monthlyTotals[k];
                      return <span key={m.getTime()} style={{ minWidth: 100, textAlign: 'right' }}>{fmt.currency(resLiq)}</span>;
                    })}
                    {(() => {
                      const despTotal = drilldownData.groups.despesas_impostos.total + drilldownData.groups.despesas_fixas.total + drilldownData.groups.despesas_variaveis.total + drilldownData.groups.despesas_pessoal.total + drilldownData.groups.despesas_bancarias.total + drilldownData.groups.despesas_terceiros.total + drilldownData.groups.outras_despesas.total;
                      const recOpTotal = drilldownData.groups.receitas.total - drilldownData.groups.custos.total - despTotal;
                      const resBrutoTotal = recOpTotal + drilldownData.groups.liberacoes.total - drilldownData.groups.emprestimos.total - drilldownData.groups.investimentos.total;
                      const resLiqTotal = resBrutoTotal + drilldownData.groups.transferencias.total + drilldownData.groups.nao_categorizados.total;
                      return <span style={{ minWidth: 100, textAlign: 'right', borderLeft: '1px solid var(--border)', paddingLeft: 8 }}>{fmt.currency(resLiqTotal)}</span>;
                    })()}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 18px', fontSize: 12, fontWeight: 600, color: 'var(--text-main)', background: 'var(--bg-body)', marginTop: 24 }}>
                  <span>(=) Saldo Final Calculado</span>`;

  content = content.replace(oldUILogic, newUILogic);

  const oldLiqLogic = `                {/* (=) Resultado Mensal Líquido */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 18px', fontSize: 13, fontWeight: 700, color: 'var(--text-main)', background: 'rgba(34,197,94,0.1)' }}>
                  <span>(=) Resultado Mensal Líquido</span>
                  <div style={{ display: 'flex', gap: 16 }}>
                    {drilldownData.monthlySummary.map((s: any) => (
                      <span key={s.key} style={{ minWidth: 100, textAlign: 'right' }}>{fmt.currency(s.resLiq)}</span>
                    ))}
                    <span style={{ minWidth: 100, textAlign: 'right', borderLeft: '1px solid var(--border)', paddingLeft: 8 }}>
                      {fmt.currency(drilldownData.monthlySummary.reduce((acc: number, s: any) => acc + s.resLiq, 0))}
                    </span>
                  </div>
                </div>`;
  content = content.replace(oldLiqLogic, "");

  const oldAuditLogic = `const calc = sInicial + entradas - saidas;`;
  const newAuditLogic = `const transferencias = drilldownData.groups.transferencias.monthlyTotals[m.toISOString().slice(0, 7)];
                      const naoCat = drilldownData.groups.nao_categorizados.monthlyTotals[m.toISOString().slice(0, 7)];
                      const calc = sInicial + entradas - saidas + transferencias + naoCat;`;
  content = content.replace(oldAuditLogic, newAuditLogic);

  const oldAuditLogicTotal = `const calcGlobal = globalInicial + entradas - saidas;`;
  const newAuditLogicTotal = `const calcGlobal = globalInicial + entradas - saidas + drilldownData.groups.transferencias.total + drilldownData.groups.nao_categorizados.total;`;
  content = content.replace(oldAuditLogicTotal, newAuditLogicTotal);

  fs.writeFileSync(filePath, content);
  console.log("Updated report logic in", filePath);
}

processFile(path.join(__dirname, 'app/consultor/relatorios/page.tsx'));
processFile(path.join(__dirname, 'app/cliente/relatorios/page.tsx'));
