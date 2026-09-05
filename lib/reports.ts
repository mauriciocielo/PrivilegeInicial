import { Lancamento, PlanoConta, Portador, Empresa } from './store';
import {
  PDF_ACCENT,
  PDF_GRAY,
  PDF_LIGHT,
  PDF_GREEN,
  PDF_RED,
  getOfficeLogoBase64,
  drawPdfHeaderBand,
  drawPdfFooter,
  slugifyFileName,
} from './pdf-branding';

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
  const H = doc.internal.pageSize.getHeight();
  const margin = 15;
  const HEADER_H = 36;
  const FOOTER_MARGIN = 16;

  const officeLogoBase64 = await getOfficeLogoBase64();
  const { textX } = drawPdfHeaderBand(doc, {
    pageWidth: W,
    margin,
    headerHeight: HEADER_H,
    officeLogoBase64,
    empresaLogoData: options.empresa.logoData,
  });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(options.title, textX, 16);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(options.empresa.razaoSocial, textX, 24);
  doc.text(`Período: ${options.periodo}`, textX, 30);
  doc.setFontSize(7.5);
  doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, W - margin, HEADER_H - 4, { align: 'right' });

  let y = HEADER_H + 10;

  // Summary
  if (options.summary && options.summary.length > 0) {
    const cardW = (W - (margin * 2) - (options.summary.length - 1) * 5) / options.summary.length;
    options.summary.forEach((s, i) => {
      const x = margin + i * (cardW + 5);
      doc.setFillColor(...PDF_LIGHT);
      doc.roundedRect(x, y, cardW, 15, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(...PDF_GRAY);
      doc.text(s.label, x + cardW / 2, y + 5, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      if (s.color === 'green') doc.setTextColor(...PDF_GREEN);
      else if (s.color === 'red') doc.setTextColor(...PDF_RED);
      else doc.setTextColor(...PDF_ACCENT);
      doc.text(s.value, x + cardW / 2, y + 12, { align: 'center' });
    });
    y += 25;
  }

  // Table
  const colW = (W - margin * 2) / options.columns.length;
  const drawTableHeader = () => {
    doc.setFillColor(...PDF_ACCENT);
    doc.rect(margin, y, W - margin * 2, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    options.columns.forEach((col, i) => {
      doc.text(col, margin + i * colW + 2, y + 5.5);
    });
    y += 8;
  };
  drawTableHeader();

  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  options.rows.forEach(row => {
    if (y > H - FOOTER_MARGIN - 8) {
      doc.addPage();
      y = margin;
      drawTableHeader();
      doc.setTextColor(50, 50, 50);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    }
    row.forEach((cell, i) => {
      doc.text(String(cell), margin + i * colW + 2, y + 5);
    });
    y += 6;
  });

  drawPdfFooter(doc, { pageWidth: W, pageHeight: H, margin });

  doc.save(`${slugifyFileName(options.title) || options.title.replace(/\s+/g, '_')}.pdf`);
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
