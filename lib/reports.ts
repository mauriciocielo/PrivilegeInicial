import { Lancamento, PlanoConta, Portador, Empresa } from './store';

export const fmt = {
  currency: (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
  date: (s: string) => {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  },
  percent: (v: number) => `${v.toFixed(1)}%`,
};

export async function generatePDF(options: {
  title: string;
  empresa: Empresa;
  periodo: string;
  columns: string[];
  rows: (string | number)[][];
  summary?: { label: string; value: string; color?: string }[];
  tipo?: 'fluxo' | 'extrato' | 'dre';
}): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const W = doc.internal.pageSize.getWidth();
  const margin = 15;
  const blue = [26, 54, 93] as [number, number, number];
  const gray = [100, 116, 139] as [number, number, number];
  const lightGray = [248, 250, 252] as [number, number, number];
  const green = [34, 197, 94] as [number, number, number];
  const red = [239, 68, 68] as [number, number, number];

  // Header
  doc.setFillColor(...blue);
  doc.rect(0, 0, W, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FluxoCaixa Pro', margin, 15);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(options.empresa.razaoSocial, margin, 22);
  doc.text(`Período: ${options.periodo}`, margin, 27);

  doc.setFontSize(14);
  doc.text(options.title, W - margin, 15, { align: 'right' });
  doc.setFontSize(8);
  doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, W - margin, 25, { align: 'right' });

  let y = 40;

  // Summary
  if (options.summary && options.summary.length > 0) {
    const cardW = (W - (margin * 2) - (options.summary.length - 1) * 5) / options.summary.length;
    options.summary.forEach((s, i) => {
      const x = margin + i * (cardW + 5);
      doc.setFillColor(...lightGray);
      doc.roundedRect(x, y, cardW, 15, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(...gray);
      doc.text(s.label, x + cardW / 2, y + 5, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      if (s.color === 'green') doc.setTextColor(...green);
      else if (s.color === 'red') doc.setTextColor(...red);
      else doc.setTextColor(...blue);
      doc.text(s.value, x + cardW / 2, y + 12, { align: 'center' });
    });
    y += 25;
  }

  // Table
  const colW = (W - margin * 2) / options.columns.length;
  doc.setFillColor(...blue);
  doc.rect(margin, y, W - margin * 2, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  options.columns.forEach((col, i) => {
    doc.text(col, margin + i * colW + 2, y + 5.5);
  });
  y += 8;

  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  options.rows.forEach(row => {
    if (y > 180) { doc.addPage(); y = 20; }
    row.forEach((cell, i) => {
      doc.text(String(cell), margin + i * colW + 2, y + 5);
    });
    y += 6;
  });

  doc.save(`${options.title.replace(/\s+/g, '_')}.pdf`);
}

export async function generateXLS(options: {
  title: string;
  empresa: Empresa;
  periodo: string;
  columns: string[];
  rows: (string | number)[][];
}): Promise<void> {
  const XLSX = await import('xlsx');
  const wsData = [
    [options.empresa.razaoSocial],
    [options.title],
    [`Período: ${options.periodo}`],
    [],
    options.columns,
    ...options.rows
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
  XLSX.writeFile(wb, `${options.title.replace(/\s+/g, '_')}.xlsx`);
}

export function buildFluxoCaixaData(
  lancamentos: Lancamento[],
  planoContas: PlanoConta[],
  portadores: Portador[]
) {
  const pcMap = new Map(planoContas.map(p => [p.id, p]));
  const ptMap = new Map(portadores.map(p => [p.id, p]));

  return lancamentos.map(l => {
    const pc = pcMap.get(l.planoContaId);
    const isRedutora = pc && pc.codigo.startsWith('1') && pc.descricao.trim().startsWith('( - )');
    const valorGerencial = isRedutora ? -l.valor : (l.tipo === 'receita' ? l.valor : -l.valor);
    return {
      data: l.data, // YYYY-MM-DD
      descricao: l.descricao,
      tipo: l.tipo === 'receita' ? 'Receita' : 'Despesa',
      planoConta: pc?.descricao || '-',
      portador: ptMap.get(l.portadorId)?.nome || '-',
      status: l.status === 'realizado' ? 'Realizado' : 'Previsto',
      valor: fmt.currency(valorGerencial),
      valorNum: valorGerencial
    };
  });
}
