// ============================================================
// DIAGNÓSTICO 360º — Geração do relatório em PDF (entrega ao cliente)
// ============================================================

import {
  AREAS,
  NIVEIS,
  radarPontos,
  type Diagnostico360,
  type ResultadoDiagnostico,
} from './diagnostico360';
import { fmt } from './reports';
import type { Empresa } from './store';
import {
  PDF_ACCENT as ACCENT,
  PDF_DARK as DARK,
  PDF_GRAY as GRAY,
  PDF_LIGHT as LIGHT,
  PDF_BORDER as BORDER,
  PDF_BRAND_NAME,
  getOfficeLogoBase64,
  drawPdfHeaderBand,
  drawPdfFooter,
  slugifyFileName,
} from './pdf-branding';

export interface FinanceiroSnapshot {
  receitas: number;
  despesas: number;
  saldo: number;
  mediaFaturamento: number;
  totalEndividamento: number;
}

export interface PdfDiagnosticoOptions {
  diagnostico: Diagnostico360;
  resultado: ResultadoDiagnostico;
  empresa: Empresa | null;
  financeiro?: FinanceiroSnapshot;
  /** Nome exibido no rodapé do relatório */
  marca?: string;
}

const W = 210;
const H = 297;
const M = 15;
const CW = W - M * 2;

export async function gerarPdfDiagnostico360(options: PdfDiagnosticoOptions): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const { diagnostico, resultado, empresa, financeiro } = options;
  const marca = options.marca || PDF_BRAND_NAME;
  const nomeEmpresa =
    diagnostico.respondente.nomeEmpresa || empresa?.nomeFantasia || empresa?.razaoSocial || 'Empresa';

  let y = 0;

  // -------------------- helpers --------------------
  const wrap = (text: string, width: number, size: number, style: 'normal' | 'bold' | 'italic' = 'normal') => {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    return doc.splitTextToSize(text || '', width) as string[];
  };

  const paragraph = (
    text: string,
    opts: { size?: number; style?: 'normal' | 'bold' | 'italic'; color?: [number, number, number]; x?: number; width?: number; leading?: number } = {},
  ) => {
    const size = opts.size ?? 10;
    const leading = opts.leading ?? size * 0.45 + 1.2;
    const x = opts.x ?? M;
    const width = opts.width ?? CW;
    const linhas = wrap(text, width, size, opts.style ?? 'normal');
    doc.setTextColor(...(opts.color ?? DARK));
    linhas.forEach(linha => {
      ensure(leading + 1);
      doc.text(linha, x, y);
      y += leading;
    });
  };

  const novaPagina = () => {
    doc.addPage();
    doc.setFillColor(...ACCENT);
    doc.rect(0, 0, W, 4, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(`Diagnóstico Empresarial 360º · ${nomeEmpresa}`, M, 11);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.line(M, 13.5, W - M, 13.5);
    y = 22;
  };

  function ensure(h: number) {
    if (y + h > H - 18) novaPagina();
  }

  const tituloSecao = (texto: string, cor: [number, number, number] = ACCENT) => {
    ensure(16);
    doc.setFillColor(...cor);
    doc.rect(M, y - 3.6, 1.6, 6, 'F');
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...cor);
    doc.text(texto.toUpperCase(), M + 4.5, y);
    y += 8;
  };

  const barra = (
    x: number,
    yy: number,
    largura: number,
    altura: number,
    pct: number,
    cor: [number, number, number],
  ) => {
    doc.setFillColor(...LIGHT);
    doc.roundedRect(x, yy, largura, altura, altura / 2, altura / 2, 'F');
    const w = Math.max(0, Math.min(100, pct)) / 100 * largura;
    if (w > 0.6) {
      doc.setFillColor(...cor);
      doc.roundedRect(x, yy, Math.max(w, altura), altura, altura / 2, altura / 2, 'F');
    }
  };

  // -------------------- CAPA --------------------
  // Logos sobre placa branca (evita "sumir" fundida na faixa vinho quando o
  // PNG tem fundo transparente) — a capa é alta o bastante (85mm) para o
  // título começar bem abaixo delas, então mantém o título alinhado em M.
  const officeLogoBase64 = await getOfficeLogoBase64();
  drawPdfHeaderBand(doc, {
    pageWidth: W,
    margin: M,
    headerHeight: 85,
    officeLogoBase64,
    empresaLogoData: empresa?.logoData,
  });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('RELATÓRIO DE CONSULTORIA', M, 42);
  doc.setFontSize(30);
  doc.setFont('helvetica', 'bold');
  doc.text('Diagnóstico', M, 55);
  doc.text('Empresarial 360º', M, 68);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(nomeEmpresa, M, 79);

  y = 98;

  tituloSecao('Identificação');

  const info: [string, string][] = [
    ['Nome', diagnostico.respondente.nome || '—'],
    ['Cargo', diagnostico.respondente.cargo || '—'],
    ['Nome Empresa', diagnostico.respondente.nomeEmpresa || empresa?.razaoSocial || '—'],
    ['Cidade', diagnostico.respondente.cidade || '—'],
    ['CNPJ', diagnostico.respondente.cnpj || empresa?.cnpj || '—'],
    ['Segmento', diagnostico.respondente.segmento || '—'],
    ['Telefone (WhatsApp)', diagnostico.respondente.telefone || '—'],
    ['Fat. Médio (Mensal)', diagnostico.respondente.faturamentoMedio ? fmt.currency(diagnostico.respondente.faturamentoMedio) : '—'],
    ['Nº de Funcionários', diagnostico.respondente.numFuncionarios ? String(diagnostico.respondente.numFuncionarios) : '—'],
    ['Data do Diagnóstico', fmt.date(diagnostico.data)],
  ];

  const linhaAltura = 7;
  info.forEach(([label, valor], i) => {
    if (i % 2 === 0) {
      doc.setFillColor(...LIGHT);
      doc.rect(M, y - 4.6, CW, linhaAltura, 'F');
    }
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GRAY);
    doc.text(label, M + 3, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK);
    doc.text(String(valor).slice(0, 60), M + 58, y);
    y += linhaAltura;
  });

  y += 8;
  tituloSecao('O Diagnóstico');
  paragraph(
    'O diagnóstico empresarial é uma metodologia de avaliação de empresas que possibilita uma análise aprofundada das principais áreas de gestão de um negócio. Com um entendimento mais profundo da organização, é possível resolver problemas de maneira prática e direcionada para o que realmente importa e sem gastar tempo com itens pouco relevantes.',
    { size: 9.5, color: GRAY },
  );
  y += 2;
  paragraph('Utilizamos um método de perguntas, respostas e feedbacks direcionados para avaliar as 5 principais áreas que todo negócio possui:', {
    size: 9.5,
    color: GRAY,
  });
  y += 2;
  AREAS.forEach(a => {
    ensure(6);
    doc.setFillColor(...a.rgb);
    doc.circle(M + 3, y - 1.2, 1.1, 'F');
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(a.nome, M + 7, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(`— ${a.descricao}`, M + 7 + doc.getTextWidth(a.nome) + 2, y);
    y += 5.5;
  });

  // -------------------- RESULTADO GERAL --------------------
  novaPagina();
  tituloSecao('Resultado Geral');

  const nivel = resultado.nivelGeral;

  // Cartão do índice geral
  doc.setFillColor(...LIGHT);
  doc.roundedRect(M, y, CW, 30, 3, 3, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GRAY);
  doc.text('ÍNDICE DE MATURIDADE DA GESTÃO', M + 6, y + 9);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...nivel.rgb);
  doc.text(`${resultado.geral.toFixed(1)}%`, M + 6, y + 23);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GRAY);
  doc.text('NÍVEL', M + 60, y + 9);
  doc.setFontSize(15);
  doc.setTextColor(...nivel.rgb);
  doc.text(nivel.label, M + 60, y + 18);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(`${resultado.respondidas} de ${resultado.total} questões respondidas`, M + 60, y + 25);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GRAY);
  doc.text('DESTAQUES', M + 112, y + 9);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK);
  doc.text(`Maior: ${resultado.melhorArea ? `${resultado.melhorArea.area.nome} (${resultado.melhorArea.pontuacao.toFixed(0)}%)` : '—'}`, M + 112, y + 17);
  doc.text(`Menor: ${resultado.piorArea ? `${resultado.piorArea.area.nome} (${resultado.piorArea.pontuacao.toFixed(0)}%)` : '—'}`, M + 112, y + 23);

  y += 38;
  paragraph(nivel.descricao, { size: 9, style: 'italic', color: GRAY });
  y += 6;

  // Radar
  tituloSecao('Mapa das Áreas');
  const cx = M + 48;
  const cy = y + 44;
  const raio = 34;
  const valores = resultado.areas.map(a => a.pontuacao);

  doc.setLineWidth(0.15);
  [25, 50, 75, 100].forEach(escala => {
    const pts = radarPontos(AREAS.map(() => escala), cx, cy, raio);
    doc.setDrawColor(...BORDER);
    pts.forEach((p, i) => {
      const n = pts[(i + 1) % pts.length];
      doc.line(p.x, p.y, n.x, n.y);
    });
  });

  const eixos = radarPontos(AREAS.map(() => 100), cx, cy, raio);
  eixos.forEach(p => doc.line(cx, cy, p.x, p.y));

  const dataPts = radarPontos(valores, cx, cy, raio);
  doc.setDrawColor(...ACCENT);
  doc.setFillColor(233, 213, 213);
  doc.setLineWidth(0.7);
  try {
    const deltas = dataPts.map((p, i) => {
      const ant = i === 0 ? dataPts[0] : dataPts[i - 1];
      return [p.x - ant.x, p.y - ant.y] as [number, number];
    });
    doc.lines(deltas.slice(1), dataPts[0].x, dataPts[0].y, [1, 1], 'FD', true);
  } catch {
    dataPts.forEach((p, i) => {
      const n = dataPts[(i + 1) % dataPts.length];
      doc.line(p.x, p.y, n.x, n.y);
    });
  }
  dataPts.forEach(p => {
    doc.setFillColor(...ACCENT);
    doc.circle(p.x, p.y, 0.9, 'F');
  });

  // Rótulos dos eixos
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  const rotulos = radarPontos(AREAS.map(() => 100), cx, cy, raio + 8);
  rotulos.forEach((p, i) => {
    const align = Math.abs(p.x - cx) < 3 ? 'center' : p.x > cx ? 'left' : 'right';
    doc.text(resultado.areas[i].area.nome, p.x, p.y + 1, { align: align as 'center' | 'left' | 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(`${resultado.areas[i].pontuacao.toFixed(0)}%`, p.x, p.y + 4.5, { align: align as 'center' | 'left' | 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
  });

  // Barras por área ao lado do radar
  let by = y + 8;
  const bx = M + 100;
  const bw = CW - 100;
  resultado.areas.forEach(a => {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(a.area.nome, bx, by);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...a.nivel.rgb);
    doc.text(`${a.pontuacao.toFixed(0)}%`, bx + bw, by, { align: 'right' });
    barra(bx, by + 1.8, bw, 3, a.pontuacao, a.area.rgb);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(a.nivel.label, bx, by + 8.5);
    by += 15;
  });

  y = Math.max(cy + raio + 16, by) + 4;

  // Legenda dos níveis
  ensure(16);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  let lx = M;
  NIVEIS.forEach((n, i) => {
    const faixa = ['0 a 24%', '25 a 49%', '50 a 74%', '75 a 100%'][i];
    doc.setFillColor(...n.rgb);
    doc.circle(lx + 1.5, y - 1, 1.3, 'F');
    doc.setTextColor(...GRAY);
    doc.text(`${n.label} (${faixa})`, lx + 4.5, y);
    lx += 45;
  });
  y += 10;

  // Snapshot financeiro do sistema
  if (financeiro) {
    tituloSecao('Indicadores Financeiros do Sistema');
    const cards: [string, string, [number, number, number]][] = [
      ['Receitas realizadas', fmt.currency(financeiro.receitas), [16, 185, 129]],
      ['Despesas realizadas', fmt.currency(financeiro.despesas), [239, 68, 68]],
      ['Resultado', fmt.currency(financeiro.saldo), financeiro.saldo >= 0 ? [16, 185, 129] : [239, 68, 68]],
      ['Faturamento médio', fmt.currency(financeiro.mediaFaturamento), DARK],
      ['Dívidas ativas', fmt.currency(financeiro.totalEndividamento), [239, 68, 68]],
    ];
    ensure(24);
    const cardW = (CW - 4 * 3) / 5;
    cards.forEach(([label, valor, cor], i) => {
      const x = M + i * (cardW + 3);
      doc.setFillColor(...LIGHT);
      doc.roundedRect(x, y, cardW, 18, 2, 2, 'F');
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      wrap(label, cardW - 4, 6.5).slice(0, 2).forEach((l, li) => doc.text(l, x + 2, y + 5 + li * 3));
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...cor);
      doc.text(valor, x + 2, y + 15);
    });
    y += 24;
  }

  // -------------------- DETALHAMENTO POR ÁREA --------------------
  resultado.areas.forEach(area => {
    novaPagina();

    doc.setFillColor(...area.area.rgb);
    doc.roundedRect(M, y - 4, CW, 20, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text(area.area.nome, M + 5, y + 4);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`${area.respondidas}/${area.total} questões · Nível ${area.nivel.label}`, M + 5, y + 11);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(`${area.pontuacao.toFixed(0)}%`, W - M - 5, y + 8, { align: 'right' });
    y += 24;

    area.questoes.forEach(qa => {
      const enunciadoLinhas = wrap(`${qa.questao.numero}. ${qa.questao.enunciado}`, CW - 8, 9.5, 'bold');
      const respostaLinhas = wrap(
        qa.letra ? `${qa.letra}) ${qa.texto}` : 'Não respondida.',
        CW - 8,
        8.5,
      );
      const altura = 12 + enunciadoLinhas.length * 4.4 + respostaLinhas.length * 3.9;
      ensure(altura + 4);

      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.2);
      doc.roundedRect(M, y - 4, CW, altura, 2, 2, 'S');

      const corPonto: [number, number, number] =
        qa.pontuacao === null ? GRAY : qa.pontuacao >= 75 ? [16, 185, 129] : qa.pontuacao >= 50 ? [59, 130, 246] : qa.pontuacao >= 25 ? [245, 158, 11] : [239, 68, 68];

      doc.setTextColor(...DARK);
      let inner = y + 1;
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      enunciadoLinhas.forEach(l => {
        doc.text(l, M + 4, inner);
        inner += 4.4;
      });

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      respostaLinhas.forEach(l => {
        doc.text(l, M + 4, inner);
        inner += 3.9;
      });

      inner += 1.5;
      barra(M + 4, inner - 2, CW - 30, 2.4, qa.pontuacao ?? 0, corPonto);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...corPonto);
      doc.text(qa.pontuacao === null ? '—' : `${qa.pontuacao.toFixed(0)}%`, W - M - 4, inner, { align: 'right' });

      y += altura + 3;
    });

    const anotacao = (diagnostico.anotacoes?.[area.area.key] || '').trim();
    if (anotacao) {
      ensure(16);
      y += 3;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...area.area.rgb);
      doc.text('Anotações do consultor', M, y);
      y += 5;
      paragraph(anotacao, { size: 8.5, color: DARK });
    }
  });

  // -------------------- PLANO DE AÇÃO --------------------
  novaPagina();
  tituloSecao('Plano de Ação Recomendado');
  paragraph(
    'As recomendações abaixo estão ordenadas da maior para a menor criticidade, considerando as respostas com menor nível de maturidade. Priorize os itens do topo da lista.',
    { size: 9, color: GRAY },
  );
  y += 4;

  if (!resultado.pontosCriticos.length) {
    paragraph(
      resultado.respondidas === 0
        ? 'Nenhuma questão foi respondida — o plano de ação será gerado após o preenchimento do questionário.'
        : 'Todas as questões respondidas estão no nível máximo de maturidade. Foco em manutenção e melhoria contínua das práticas atuais.',
      { size: 9.5 },
    );
  } else {
    resultado.pontosCriticos.forEach((qa, i) => {
      const area = AREAS.find(a => a.key === qa.questao.area)!;
      const tituloLinhas = wrap(qa.questao.enunciado, CW - 26, 9, 'bold');
      const acaoLinhas = wrap(qa.questao.recomendacao, CW - 26, 8.5);
      const altura = 10 + tituloLinhas.length * 4.2 + acaoLinhas.length * 3.9;
      ensure(altura + 4);

      doc.setFillColor(...area.rgb);
      doc.roundedRect(M, y - 4, 18, altura, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(String(i + 1).padStart(2, '0'), M + 9, y + 3, { align: 'center' });
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`${(qa.pontuacao ?? 0).toFixed(0)}%`, M + 9, y + 8, { align: 'center' });

      let inner = y + 1;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...area.rgb);
      doc.text(area.nome.toUpperCase(), M + 22, inner);
      inner += 4;

      doc.setFontSize(9);
      doc.setTextColor(...DARK);
      tituloLinhas.forEach(l => {
        doc.text(l, M + 22, inner);
        inner += 4.2;
      });

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      acaoLinhas.forEach(l => {
        doc.text(l, M + 22, inner);
        inner += 3.9;
      });

      y += altura + 4;
    });
  }

  // -------------------- PARECER --------------------
  const parecer = (diagnostico.parecer || '').trim();
  ensure(40);
  y += 6;
  tituloSecao('Parecer do Consultor');
  if (parecer) {
    paragraph(parecer, { size: 9.5 });
  } else {
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    for (let i = 0; i < 8; i++) {
      ensure(8);
      doc.line(M, y, W - M, y);
      y += 8;
    }
  }

  y += 12;
  ensure(24);
  doc.setDrawColor(...DARK);
  doc.setLineWidth(0.3);
  doc.line(M + 20, y, M + 80, y);
  doc.line(W - M - 80, y, W - M - 20, y);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(diagnostico.consultor || 'Consultor responsável', M + 50, y + 5, { align: 'center' });
  doc.text(diagnostico.respondente.nome || 'Representante da empresa', W - M - 50, y + 5, { align: 'center' });

  // -------------------- RODAPÉ --------------------
  drawPdfFooter(doc, { pageWidth: W, pageHeight: H, margin: M, marca });

  const slug = slugifyFileName(nomeEmpresa);
  doc.save(`Diagnostico-360-${slug || 'empresa'}-${diagnostico.data}.pdf`);
}
