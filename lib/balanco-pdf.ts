// ============================================================
// BALANÇO PATRIMONIAL — Geração do relatório em PDF (cores do escritório)
// ============================================================

import { fmt } from './reports';
import type { Empresa, ContaBalanco, BalancoPatrimonial, GrupoContaBalanco } from './store';
import {
  PDF_ACCENT as ACCENT,
  PDF_DARK as DARK,
  PDF_GRAY as GRAY,
  PDF_LIGHT as LIGHT,
  PDF_BORDER as BORDER,
  PDF_GREEN as GREEN,
  PDF_RED as RED,
  PDF_BRAND_NAME,
  getOfficeLogoBase64,
  drawPdfHeaderBand,
  drawPdfFooter,
  slugifyFileName,
} from './pdf-branding';

const W = 210;
const H = 297;
const M = 15;
const CW = W - M * 2;
const GAP = 8;
const COL_W = (CW - GAP) / 2;

const GRUPO_LABELS: Record<GrupoContaBalanco, string> = {
  ativo_circulante: 'Ativo Circulante',
  ativo_nao_circulante: 'Ativo Não Circulante',
  passivo_circulante: 'Passivo Circulante',
  passivo_nao_circulante: 'Passivo Não Circulante',
  patrimonio_liquido: 'Patrimônio Líquido',
};

const GRUPOS_ATIVO: GrupoContaBalanco[] = ['ativo_circulante', 'ativo_nao_circulante'];
const GRUPOS_PASSIVO: GrupoContaBalanco[] = ['passivo_circulante', 'passivo_nao_circulante', 'patrimonio_liquido'];

function formatCompetencia(competencia: string) {
  const [y, m] = competencia.split('-');
  if (!y || !m) return competencia;
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
}

export interface PdfBalancoOptions {
  empresa: Empresa | null;
  balanco: BalancoPatrimonial;
  contas: ContaBalanco[];
  /** Nome exibido no rodapé do relatório */
  marca?: string;
}

export async function gerarPdfBalancoPatrimonial(options: PdfBalancoOptions): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const { empresa, balanco, contas } = options;
  const marca = options.marca || PDF_BRAND_NAME;
  const nomeEmpresa = empresa?.nomeFantasia || empresa?.razaoSocial || 'Empresa';
  const valores = balanco.valores || {};

  const totalAtivo = contas.filter(c => GRUPOS_ATIVO.includes(c.grupo)).reduce((a, c) => a + (valores[c.id] || 0), 0);
  const totalPassivoPL = contas.filter(c => GRUPOS_PASSIVO.includes(c.grupo)).reduce((a, c) => a + (valores[c.id] || 0), 0);
  const diferenca = totalAtivo - totalPassivoPL;
  const balanceado = Math.abs(diferenca) < 0.005;

  const HEADER_H = 46;
  const FOOTER_MARGIN = 16;

  // -------------------- CABEÇALHO --------------------
  const officeLogoBase64 = await getOfficeLogoBase64();
  const { textX } = drawPdfHeaderBand(doc, {
    pageWidth: W,
    margin: M,
    headerHeight: HEADER_H,
    officeLogoBase64,
    empresaLogoData: empresa?.logoData,
  });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('RELATÓRIO CONTÁBIL', textX, 14);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Balanço Patrimonial', textX, 25);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(nomeEmpresa, textX, 33);
  doc.setFontSize(9);
  doc.text(`Competência: ${formatCompetencia(balanco.competencia)}`, textX, 39);

  let y = HEADER_H + 12;

  // -------------------- INDICADOR DE FECHAMENTO --------------------
  doc.setFillColor(...LIGHT);
  doc.roundedRect(M, y, CW, 16, 2, 2, 'F');
  const chipW = CW / 3;
  const chip = (idx: number, label: string, valor: string, cor: [number, number, number]) => {
    const x = M + idx * chipW;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(label, x + chipW / 2, y + 6, { align: 'center' });
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...cor);
    doc.text(valor, x + chipW / 2, y + 12.5, { align: 'center' });
  };
  chip(0, 'TOTAL DO ATIVO', fmt.currency(totalAtivo), ACCENT);
  chip(1, 'TOTAL PASSIVO + PL', fmt.currency(totalPassivoPL), ACCENT);
  chip(2, balanceado ? 'SITUAÇÃO' : 'DIFERENÇA (ATIVO − PASSIVO/PL)', balanceado ? 'Balanceado ✓' : fmt.currency(diferenca), balanceado ? GREEN : RED);

  y += 24;
  const startY = y;

  // -------------------- COLUNAS (ATIVO / PASSIVO+PL) --------------------
  const continuationHeader = (titulo: string) => {
    doc.setFillColor(...ACCENT);
    doc.rect(0, 0, W, 4, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(`Balanço Patrimonial · ${nomeEmpresa} · ${titulo} (continuação)`, M, 11);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.line(M, 13.5, W - M, 13.5);
    return 20;
  };

  const drawColuna = (x: number, grupos: GrupoContaBalanco[], titulo: string, totalLabel: string, totalValor: number) => {
    doc.setPage(1);
    let cy = startY;

    const ensure = (h: number) => {
      if (cy + h > H - FOOTER_MARGIN) {
        doc.addPage();
        cy = continuationHeader(titulo);
      }
    };

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(titulo, x, cy);
    cy += 6;

    grupos.forEach(grupo => {
      const contasDoGrupo = contas.filter(c => c.grupo === grupo && c.ativo).sort((a, b) => a.ordem - b.ordem);
      if (contasDoGrupo.length === 0) return;
      const subgrupos = Array.from(new Set(contasDoGrupo.map(c => c.subgrupo || '')));
      const totalGrupo = contasDoGrupo.reduce((a, c) => a + (valores[c.id] || 0), 0);

      ensure(7);
      doc.setFillColor(240, 230, 230);
      doc.rect(x, cy - 3.6, COL_W, 5.5, 'F');
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...ACCENT);
      doc.text(GRUPO_LABELS[grupo].toUpperCase(), x + 2, cy);
      cy += 6;

      subgrupos.forEach(sub => {
        const rows = contasDoGrupo.filter(c => (c.subgrupo || '') === sub);
        if (sub) {
          ensure(5);
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(...GRAY);
          doc.text(sub, x + 2, cy);
          cy += 4.5;
        }
        rows.forEach(conta => {
          ensure(5);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...DARK);
          const desc = doc.splitTextToSize(conta.descricao, COL_W - 40)[0] as string;
          doc.text(desc, x + 4, cy);
          doc.text(fmt.currency(valores[conta.id] || 0), x + COL_W - 2, cy, { align: 'right' });
          cy += 4.8;
        });
      });

      ensure(6);
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.2);
      doc.line(x, cy - 2.5, x + COL_W, cy - 2.5);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.text(`Total ${GRUPO_LABELS[grupo]}`, x + 2, cy + 1.5);
      doc.text(fmt.currency(totalGrupo), x + COL_W - 2, cy + 1.5, { align: 'right' });
      cy += 8;
    });

    ensure(10);
    doc.setFillColor(...ACCENT);
    doc.rect(x, cy - 4.5, COL_W, 9, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(totalLabel, x + 2, cy + 1);
    doc.text(fmt.currency(totalValor), x + COL_W - 2, cy + 1, { align: 'right' });
  };

  drawColuna(M, GRUPOS_ATIVO, 'Ativo', 'TOTAL DO ATIVO', totalAtivo);
  drawColuna(M + COL_W + GAP, GRUPOS_PASSIVO, 'Passivo e Patrimônio Líquido', 'TOTAL PASSIVO + PL', totalPassivoPL);

  // -------------------- OBSERVAÇÕES --------------------
  if (balanco.observacao) {
    doc.setPage(doc.getNumberOfPages());
    let oy = H - FOOTER_MARGIN - 28;
    if (oy < startY) { doc.addPage(); oy = continuationHeader('Observações'); }
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text('Observações do Fechamento', M, oy);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    const linhas = doc.splitTextToSize(balanco.observacao, CW) as string[];
    doc.text(linhas, M, oy + 5);
  }

  // -------------------- RODAPÉ --------------------
  drawPdfFooter(doc, { pageWidth: W, pageHeight: H, margin: M, marca });

  const slug = slugifyFileName(nomeEmpresa);
  doc.save(`Balanco-Patrimonial-${slug || 'empresa'}-${balanco.competencia}.pdf`);
}
