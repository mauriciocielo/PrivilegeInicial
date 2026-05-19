import { Lancamento, PlanoConta, Portador, Empresa } from './store';

// PDF Generation using jsPDF
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
  const H = doc.internal.pageSize.getHeight();
  const margin = 15;
  const blue = [26, 54, 93] as [number, number, number];
  const lightBlue = [66, 133, 244] as [number, number, number];
  const green = [34, 197, 94] as [number, number, number];
  const red = [239, 68, 68] as [number, number, number];
  const gray = [100, 116, 139] as [number, number, number];
  const lightGray = [248, 250, 252] as [number, number, number];

  // Header background
  doc.setFillColor(...blue);
  doc.rect(0, 0, W, 30, 'F');

  // Logo / Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FluxoCaixa Pro', margin, 12);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(options.empresa.nomeFantasia || options.empresa.razaoSocial, margin, 20);
  doc.text(`CNPJ: ${options.empresa.cnpj}`, margin, 26);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(options.title, W / 2, 16, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${options.periodo}`, W / 2, 23, { align: 'center' });
  doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, W - margin, 23, { align: 'right' });

  let y = 38;

  // Summary cards if provided
  if (options.summary && options.summary.length > 0) {
    const cardW = (W - margin * 2 - (options.summary.length - 1) * 5) / options.summary.length;
    options.summary.forEach((s, i) => {
      const x = margin + i * (cardW + 5);
      doc.setFillColor(...lightGray);
      doc.roundedRect(x, y, cardW, 16, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(...gray);
      doc.setFont('helvetica', 'normal');
      doc.text(s.label, x + cardW / 2, y + 6, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      if (s.color === 'green') doc.setTextColor(...green);
      else if (s.color === 'red') doc.setTextColor(...red);
      else doc.setTextColor(...blue);
      doc.text(s.value, x + cardW / 2, y + 13, { align: 'center' });
    });
    y += 24;
  }

  // Table header
  const colW = (W - margin * 2) / options.columns.length;
  doc.setFillColor(...lightBlue);
  doc.rect(margin, y, W - margin * 2, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  options.columns.forEach((col, i) => {
    doc.text(col, margin + i * colW + 3, y + 6);
  });
  y += 9;

  // Table rows
  options.rows.forEach((row, ri) => {
    if (y > H - 20) {
      doc.addPage();
      y = 20;
      doc.setFillColor(...lightBlue);
      doc.rect(margin, y, W - margin * 2, 9, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      options.columns.forEach((col, i) => doc.text(col, margin + i * colW + 3, y + 6));
      y += 9;
    }

    if (ri % 2 === 0) {
      doc.setFillColor(245, 248, 255);
      doc.rect(margin, y, W - margin * 2, 8, 'F');
    }

    doc.setTextColor(30, 30, 50);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    row.forEach((cell, i) => {
      doc.text(String(cell), margin + i * colW + 3, y + 5.5);
    });
    y += 8;
  });

  // Footer
  doc.setFillColor(...blue);
  doc.rect(0, H - 10, W, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.text('FluxoCaixa Pro — Sistema de Gestão Financeira', W / 2, H - 4, { align: 'center' });

  doc.save(`${options.title.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
}

// Excel generation using SheetJS
export async function generateXLS(options: {
  title: string;
  empresa: Empresa;
  periodo: string;
  columns: string[];
  rows: (string | number)[][];
}): Promise<void> {
  const XLSX = await import('xlsx');

  const wb = XLSX.utils.book_new();
  const wsData = [
    [options.empresa.razaoSocial],
    [options.title],
    [`Período: ${options.periodo}`],
    [`Emitido em: ${new Date().toLocaleString('pt-BR')}`],
    [],
    options.columns,
    ...options.rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = options.columns.map(() => ({ wch: 20 }));

  XLSX.utils.book_append_sheet(wb, ws, options.title.slice(0, 31));
  XLSX.writeFile(wb, `${options.title.replace(/\s+/g, '_')}_${Date.now()}.xlsx`);
}

// Format helpers
export const fmt = {
  currency: (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
  date: (s: string) => {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  },
  percent: (v: number) => `${v.toFixed(1)}%`,
};

// Build report data from lancamentos
export function buildFluxoCaixaData(
  lancamentos: Lancamento[],
  planoContas: PlanoConta[],
  portadores: Portador[]
) {
  const sorted = [...lancamentos].sort((a, b) => a.data.localeCompare(b.data));
  
  return sorted.map(l => {
    const pc = planoContas.find(p => p.id === l.planoContaId);
    const port = portadores.find(p => p.id === l.portadorId);
    return {
      data: fmt.date(l.data),
      descricao: l.descricao,
      tipo: l.tipo === 'receita' ? 'Receita' : 'Despesa',
      planoConta: pc ? `${pc.codigo} - ${pc.descricao}` : '-',
      portador: port?.nome || '-',
      status: l.status === 'realizado' ? 'Realizado' : 'Previsto',
      valor: fmt.currency(l.valor),
      valorNum: l.tipo === 'receita' ? l.valor : -l.valor,
    };
  });
}
