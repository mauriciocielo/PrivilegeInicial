// ============================================================
// IDENTIDADE VISUAL PADRÃO PARA TODOS OS PDFs DO SISTEMA
// ============================================================
// Fonte única para cor institucional, logo do escritório e rodapé — usada por
// todo gerador de PDF (Balanço Patrimonial, Diagnóstico 360º, Relatórios
// Financeiros etc). Evita que cada relatório reimplemente (e eventualmente
// desalinhe) o mesmo cabeçalho/rodapé com a marca do escritório.

export const PDF_ACCENT: [number, number, number] = [96, 0, 0]; // #600000 — vinho institucional
export const PDF_DARK: [number, number, number] = [17, 24, 39];
export const PDF_GRAY: [number, number, number] = [107, 114, 128];
export const PDF_LIGHT: [number, number, number] = [243, 244, 246];
export const PDF_BORDER: [number, number, number] = [226, 232, 240];
export const PDF_GREEN: [number, number, number] = [21, 128, 61];
export const PDF_RED: [number, number, number] = [185, 28, 28];

export const PDF_BRAND_NAME = 'Privilege Contabilidade e Consultoria';

const LOGO_BOX = 26;
const LOGO_PAD = 2;

let officeLogoCache: string | null | undefined; // undefined = ainda não tentou buscar

/** Busca e cacheia (em memória, por sessão) a logo do escritório como base64. */
export async function getOfficeLogoBase64(): Promise<string | undefined> {
  if (officeLogoCache !== undefined) return officeLogoCache ?? undefined;
  try {
    const res = await fetch('/logo.png');
    if (res.ok) {
      const blob = await res.blob();
      officeLogoCache = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      return officeLogoCache;
    }
  } catch {
    /* sem logo.png disponível — segue sem a logo do escritório */
  }
  officeLogoCache = null;
  return undefined;
}

/**
 * Desenha a faixa institucional no topo de um PDF: fundo vinho, logo do
 * escritório sobre uma placa branca (canto esquerdo — evita "sumir" fundida
 * na faixa quando o PNG tem fundo transparente) e logo do cliente, se houver,
 * também sobre placa branca (canto direito).
 *
 * Retorna `textX`: a coordenada X onde o título deve começar, para nunca
 * ficar coberto pela logo do escritório.
 */
export function drawPdfHeaderBand(
  doc: any,
  opts: {
    pageWidth: number;
    margin: number;
    headerHeight: number;
    officeLogoBase64?: string;
    empresaLogoData?: string | null;
  }
): { textX: number } {
  const { pageWidth: W, margin: M, headerHeight, officeLogoBase64, empresaLogoData } = opts;

  doc.setFillColor(...PDF_ACCENT);
  doc.rect(0, 0, W, headerHeight, 'F');

  if (officeLogoBase64) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(M, 7, LOGO_BOX, LOGO_BOX, 2, 2, 'F');
    try {
      doc.addImage(officeLogoBase64, 'PNG', M + LOGO_PAD, 7 + LOGO_PAD, LOGO_BOX - LOGO_PAD * 2, LOGO_BOX - LOGO_PAD * 2, undefined, 'FAST');
    } catch {
      /* logo do escritório inválida — segue só com a placa branca */
    }
  }

  if (empresaLogoData) {
    try {
      const tipo = empresaLogoData.includes('image/png') ? 'PNG' : 'JPEG';
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(W - M - 30, 7, 30, 18, 2, 2, 'F');
      doc.addImage(empresaLogoData, tipo, W - M - 29, 8, 28, 16, undefined, 'FAST');
    } catch {
      /* logo do cliente inválida — segue sem imagem */
    }
  }

  return { textX: M + LOGO_BOX + 8 };
}

/** Rodapé padrão (nome do escritório + aviso de confidencialidade + página X de Y) em todas as páginas do documento. */
export function drawPdfFooter(doc: any, opts: { pageWidth: number; pageHeight: number; margin: number; marca?: string }) {
  const { pageWidth: W, pageHeight: H, margin: M } = opts;
  const marca = opts.marca || PDF_BRAND_NAME;
  const totalPaginas = doc.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_GRAY);
    if (p > 1) {
      doc.setDrawColor(...PDF_BORDER);
      doc.setLineWidth(0.2);
      doc.line(M, H - 14, W - M, H - 14);
    }
    doc.text(`${marca} · Documento confidencial de uso restrito · Emitido em ${new Date().toLocaleString('pt-BR')}`, M, H - 9);
    doc.text(`Página ${p} de ${totalPaginas}`, W - M, H - 9, { align: 'right' });
  }
}

/** Remove acentos/caracteres especiais para nomes de arquivo seguros. */
export function slugifyFileName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
