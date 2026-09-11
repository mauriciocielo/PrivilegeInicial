// ============================================================
// PDF DA DOCUMENTAÇÃO DA API v1 (CP/CR)
// ============================================================
// Mesmo motor de paginação em milímetros usado por contrato-pdf.ts/ata-pdf.ts,
// com blocos de código monoespaçados em caixa escura (para não se confundir
// com o texto corrido) e o mesmo cabeçalho/rodapé institucional dos demais
// PDFs do sistema. Conteúdo vem de lib/api-docs-content.ts — a mesma fonte
// que alimenta a tela — para os dois nunca divergirem.

import {
  getOfficeLogoBase64, slugifyFileName, drawPdfHeaderBand, drawPdfFooter,
  PDF_ACCENT, PDF_DARK, PDF_GRAY, PDF_BORDER,
} from './pdf-branding';
import { getApiDocSecoes, tokenizarInline, type ApiDocBloco } from './api-docs-content';

const M = 18;
const HEADER_H = 30;
const TOP = 46;
const BOTTOM = 22;
const PT = 0.3528; // 1pt em mm — mesma conversão usada em contrato-pdf.ts

const CODE_BG: [number, number, number] = [15, 17, 23];
const CODE_TEXT: [number, number, number] = [226, 232, 240];
const METODO_COR: Record<string, [number, number, number]> = {
  POST: [5, 150, 105], GET: [37, 99, 235], DELETE: [220, 38, 38],
};

async function montarApiDocsPdf(baseUrl: string) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const largura = W - M * 2;
  const logo = await getOfficeLogoBase64();

  let y = TOP;

  const decorarPagina = () => {
    const { textX } = drawPdfHeaderBand(doc, { pageWidth: W, margin: M, headerHeight: HEADER_H, officeLogoBase64: logo });
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('DOCUMENTAÇÃO DA API — CONTAS A PAGAR/RECEBER', textX, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(baseUrl, textX, 21);
  };

  const novaPagina = () => { doc.addPage(); decorarPagina(); y = TOP; };
  const garanteEspaco = (altura: number) => { if (y + altura > H - BOTTOM) novaPagina(); };

  const tituloSecao = (t: string) => {
    garanteEspaco(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...PDF_ACCENT);
    doc.text(t, M, y);
    y += 2.5;
    doc.setDrawColor(...PDF_ACCENT);
    doc.setLineWidth(0.4);
    doc.line(M, y, M + largura, y);
    y += 7;
  };

  /** Parágrafo com `código` e **negrito** inline, quebrando linha por largura real (não por token). */
  const paragrafoRico = (texto: string, tamanho = 9.5) => {
    const alturaLinha = tamanho * PT * 1.5;
    const tokens = tokenizarInline(texto);
    // Explode em palavras preservando o estilo de cada uma, para poder
    // quebrar linha no meio de uma frase sem perder qual trecho é código/negrito.
    type Palavra = { texto: string; estilo: 'normal' | 'code' | 'bold' };
    const palavras: Palavra[] = [];
    for (const t of tokens) {
      const estilo = t.tipo === 'codigo' ? 'code' : t.tipo === 'negrito' ? 'bold' : 'normal';
      const partes = t.conteudo.split(/(\s+)/).filter(p => p !== '');
      for (const p of partes) palavras.push({ texto: p, estilo });
    }

    const setFonte = (estilo: Palavra['estilo']) => {
      doc.setFontSize(tamanho);
      if (estilo === 'code') { doc.setFont('courier', 'normal'); doc.setTextColor(...PDF_ACCENT); }
      else if (estilo === 'bold') { doc.setFont('helvetica', 'bold'); doc.setTextColor(...PDF_DARK); }
      else { doc.setFont('helvetica', 'normal'); doc.setTextColor(...PDF_DARK); }
    };

    garanteEspaco(alturaLinha);
    let x = M;
    for (const p of palavras) {
      setFonte(p.estilo);
      const w = doc.getTextWidth(p.texto);
      if (x + w > M + largura && p.texto.trim() !== '') {
        y += alturaLinha;
        garanteEspaco(alturaLinha);
        x = M;
        if (p.texto.trim() === '') continue;
      }
      doc.text(p.texto, x, y);
      x += w;
    }
    y += alturaLinha + 3;
    doc.setTextColor(...PDF_DARK);
  };

  const blocoCodigo = (codigoTexto: string, label?: string) => {
    const linhas = codigoTexto.split('\n');
    const tamanho = 8;
    const alturaLinha = tamanho * PT * 1.55;
    const padding = 3.5;
    const alturaLabel = label ? 5 : 0;
    const alturaTotal = alturaLabel + linhas.length * alturaLinha + padding * 2;

    // Bloco curto: mantém junto numa página só. Bloco maior que a página
    // inteira: deixa fluir naturalmente, quebrando entre linhas de código.
    if (alturaTotal <= H - TOP - BOTTOM) garanteEspaco(alturaTotal + 4);

    if (label) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...PDF_GRAY);
      doc.text(label.toUpperCase(), M, y);
      y += 5;
    }

    const inicioCaixa = y;
    doc.setFont('courier', 'normal');
    doc.setFontSize(tamanho);

    // Desenha linha a linha, abrindo página nova (com nova caixa) se preciso.
    let yCaixaTopo = y;
    const fecharCaixa = (fimY: number) => {
      doc.setFillColor(...CODE_BG);
      doc.roundedRect(M, yCaixaTopo - 4, largura, fimY - yCaixaTopo + padding, 1.5, 1.5, 'F');
    };

    // Primeiro desenha o fundo estimado para o trecho que cabe nesta página,
    // depois o texto por cima (senão o texto ficaria atrás do retângulo).
    const linhasNestaPagina: string[] = [];
    let yTeste = y;
    let resto = linhas;
    for (let i = 0; i < linhas.length; i++) {
      if (yTeste + alturaLinha > H - BOTTOM) { resto = linhas.slice(i); break; }
      linhasNestaPagina.push(linhas[i]);
      yTeste += alturaLinha;
      resto = [];
    }
    fecharCaixa(yTeste);
    doc.setTextColor(...CODE_TEXT);
    for (const linha of linhasNestaPagina) { doc.text(linha, M + padding, y); y += alturaLinha; }
    y += padding;

    if (resto.length > 0) {
      novaPagina();
      blocoCodigo(resto.join('\n'));
    }
    doc.setTextColor(...PDF_DARK);
    y += 3;
  };

  const blocoEndpoint = (verbo: 'POST' | 'GET' | 'DELETE', rota: string) => {
    garanteEspaco(8);
    const cor = METODO_COR[verbo];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const largPill = doc.getTextWidth(verbo) + 6;
    doc.setFillColor(...cor);
    doc.roundedRect(M, y - 4, largPill, 5.5, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(verbo, M + 3, y);
    doc.setFont('courier', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...PDF_DARK);
    doc.text(rota, M + largPill + 4, y);
    y += 8;
  };

  const blocoErros = (itens: { codigo: string; desc: string }[]) => {
    for (const it of itens) {
      garanteEspaco(6);
      doc.setFont('courier', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(220, 38, 38);
      doc.text(it.codigo, M, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...PDF_DARK);
      const linhas: string[] = doc.splitTextToSize(`— ${it.desc.replace(/`/g, '')}`, largura - 16);
      doc.text(linhas, M + 14, y);
      y += Math.max(6, linhas.length * 4.8);
    }
    y += 2;
  };

  const renderBloco = (b: ApiDocBloco) => {
    if (b.tipo === 'texto') paragrafoRico(b.texto);
    else if (b.tipo === 'codigo') blocoCodigo(b.codigo, b.label);
    else if (b.tipo === 'endpoint') blocoEndpoint(b.verbo, b.rota);
    else blocoErros(b.itens);
  };

  // ── Capa curta / introdução ─────────────────────────────────
  decorarPagina();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...PDF_DARK);
  doc.text('API de Integração — Contas a Pagar/Receber', M, y);
  y += 8;
  paragrafoRico(
    'Documentação para o time técnico do ERP do cliente conectar diretamente com o sistema: '
    + 'cadastrar sacados/fornecedores e lançar títulos a pagar/receber, com baixa e estorno.'
  );

  doc.setDrawColor(...PDF_BORDER);
  doc.setFillColor(246, 246, 248);
  doc.roundedRect(M, y, largura, 20, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_GRAY);
  doc.text('BASE URL', M + 6, y + 8);
  doc.text('FORMATO', M + largura / 2, y + 8);
  doc.text('AUTENTICAÇÃO', M + (largura / 2) * 1.6, y + 8);
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...PDF_ACCENT);
  doc.text(baseUrl, M + 6, y + 15);
  doc.setTextColor(...PDF_DARK);
  doc.text('JSON', M + largura / 2, y + 15);
  doc.text('Bearer token', M + (largura / 2) * 1.6, y + 15);
  y += 30;

  for (const secao of getApiDocSecoes(baseUrl)) {
    tituloSecao(secao.titulo);
    for (const bloco of secao.blocos) renderBloco(bloco);
    y += 2;
  }

  drawPdfFooter(doc, { pageWidth: W, pageHeight: H, margin: M });

  const nome = slugifyFileName('Documentacao-API-CPCR').slice(0, 80) || 'Documentacao-API';
  return { doc, nome };
}

/** Gera e baixa o PDF da documentação. */
export async function gerarApiDocsPdf(baseUrl: string) {
  const { doc, nome } = await montarApiDocsPdf(baseUrl);
  doc.save(`${nome}.pdf`);
}

/** Mesmo PDF, em memória — usado pelo teste automatizado (sem download no navegador). */
export async function gerarApiDocsPdfBlob(baseUrl: string) {
  const { doc, nome } = await montarApiDocsPdf(baseUrl);
  return { bytes: doc.output('arraybuffer') as ArrayBuffer, paginas: doc.getNumberOfPages(), nome };
}
