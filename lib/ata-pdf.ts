// ============================================================
// PDF DA ATA DE ATENDIMENTO — A4 nativo, texto real
// ============================================================
// Antes a ata era exportada como uma captura de tela (html2canvas) fatiada em
// páginas por altura fixa: o corte caía no meio das linhas e a escrita ficava
// partida ao meio na virada de página. Além disso a imagem era colada de borda
// a borda, sem margem, e o texto do PDF não era selecionável nem pesquisável.
//
// Aqui o documento é montado com texto nativo do jsPDF: as linhas são medidas e
// quebradas antes de escrever, e a paginação só acontece entre linhas inteiras.

import {
  PDF_ACCENT, PDF_DARK, PDF_GRAY, PDF_BORDER,
  drawPdfHeaderBand, drawPdfFooter, getOfficeLogoBase64, slugifyFileName,
} from './pdf-branding';

export interface AtaPdfData {
  id: string;
  data: string;
  titulo: string;
  conteudo: string;
  participantes: string;
  consultorNome: string;
  empresaNome: string;
  empresaLogoData?: string | null;
}

// A4 retrato em milímetros: 210 x 297.
const MARGIN = 18;
const HEADER_H = 30;
const LINE_H = 5.4;

const fmtData = (iso: string) => {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  } catch { return iso; }
};

async function montarAtaPdf(ata: AtaPdfData) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF('p', 'mm', 'a4');

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const contentW = W - MARGIN * 2;
  // Reserva para o rodapé — nada é escrito abaixo desta linha.
  const maxY = H - 20;

  const officeLogo = await getOfficeLogoBase64();

  const { textX } = drawPdfHeaderBand(doc, {
    pageWidth: W, margin: MARGIN, headerHeight: HEADER_H,
    officeLogoBase64: officeLogo, empresaLogoData: ata.empresaLogoData,
  });

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('ATA DE ATENDIMENTO', textX, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(ata.empresaNome || '—', textX, 22);

  let y = HEADER_H + 14;

  // ── Identificação ──────────────────────────────────────────
  doc.setTextColor(...PDF_GRAY);
  doc.setFontSize(8);
  doc.text(`Nº ${ata.id.substring(0, 8).toUpperCase()}`, MARGIN, y);
  doc.text(fmtData(ata.data), W - MARGIN, y, { align: 'right' });
  y += 3;
  doc.setDrawColor(...PDF_ACCENT);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, W - MARGIN, y);
  y += 10;

  /** Escreve um rótulo + valor com quebra de linha, paginando entre linhas. */
  const bloco = (label: string, valor: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_GRAY);
    doc.text(label.toUpperCase(), MARGIN, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...PDF_DARK);
    const linhas: string[] = doc.splitTextToSize(valor || '—', contentW);
    for (const linha of linhas) {
      if (y > maxY) { doc.addPage(); y = MARGIN + 6; }
      doc.text(linha, MARGIN, y);
      y += LINE_H;
    }
    y += 6;
  };

  bloco('Assunto / Pauta', ata.titulo);
  bloco('Consultor responsável', ata.consultorNome);
  bloco('Participantes', ata.participantes);

  // ── Conteúdo / deliberações ────────────────────────────────
  if (y > maxY - 20) { doc.addPage(); y = MARGIN + 6; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_GRAY);
  doc.text('CONTEÚDO / DELIBERAÇÕES', MARGIN, y);
  y += 3;
  doc.setDrawColor(...PDF_BORDER);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y, W - MARGIN, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...PDF_DARK);

  // Preserva os parágrafos do texto original: cada quebra manual vira um bloco
  // próprio, e só então cada bloco é quebrado pela largura útil da página.
  for (const paragrafo of (ata.conteudo || '—').split(/\r?\n/)) {
    if (paragrafo.trim() === '') { y += LINE_H * 0.6; continue; }
    const linhas: string[] = doc.splitTextToSize(paragrafo, contentW);
    for (const linha of linhas) {
      if (y > maxY) { doc.addPage(); y = MARGIN + 6; }
      doc.text(linha, MARGIN, y);
      y += LINE_H;
    }
  }

  // ── Assinaturas ────────────────────────────────────────────
  if (y > maxY - 34) { doc.addPage(); y = MARGIN + 6; } else { y += 20; }
  const larguraAssinatura = (contentW - 16) / 2;
  doc.setDrawColor(...PDF_GRAY);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, MARGIN + larguraAssinatura, y);
  doc.line(W - MARGIN - larguraAssinatura, y, W - MARGIN, y);
  y += 4.5;
  doc.setFontSize(8);
  doc.setTextColor(...PDF_GRAY);
  doc.text(ata.consultorNome || 'Consultor responsável', MARGIN, y);
  doc.text(ata.empresaNome || 'Cliente', W - MARGIN, y, { align: 'right' });

  // O registro de visualizações é controle interno e fica apenas na tela —
  // por decisão do cliente, não entra no documento exportado.

  drawPdfFooter(doc, { pageWidth: W, pageHeight: H, margin: MARGIN });

  const nome = slugifyFileName(`Ata-${ata.empresaNome}-${ata.data}-${ata.titulo}`).slice(0, 80) || 'Ata';
  return { doc, nome };
}

/** Gera e baixa o PDF da ata. */
export async function gerarAtaPdf(ata: AtaPdfData) {
  const { doc, nome } = await montarAtaPdf(ata);
  doc.save(`${nome}.pdf`);
}

/**
 * Gera o mesmo PDF, porém em memória — usado para enviar a ata à assinatura
 * eletrônica sem passar por download e novo upload pelo usuário.
 */
export async function gerarAtaPdfBlob(ata: AtaPdfData): Promise<{ blob: Blob; nome: string }> {
  const { doc, nome } = await montarAtaPdf(ata);
  return { blob: doc.output('blob') as Blob, nome };
}
