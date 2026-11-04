// ============================================================
// PERFIL COMPORTAMENTAL — relatório em PDF
// ============================================================

import type { jsPDF } from 'jspdf';
import {
  PDF_BORDER as BORDER, PDF_DARK as DARK, PDF_GRAY as GRAY, PDF_LIGHT as LIGHT,
  drawPdfFooter, drawPdfHeaderBand, getOfficeLogoBase64, slugifyFileName,
} from '../pdf-branding';
import type { ResultadoPerfil } from './pontuacao';
import { formatarTempoResposta, montarRelatorio, nomeTipoRespondente } from './relatorio';
import { AVISO_METODOLOGICO } from './textos';

export interface OpcoesPdfPerfil {
  resultado: ResultadoPerfil;
  nome: string;
  cargo?: string | null;
  empresa: string;
  tipo: string;
  concluidoEm?: string | null;
  tempoRespostaSeg?: number | null;
  empresaLogoData?: string | null;
}

type Cor = [number, number, number];

const NATURAL: Cor = [42, 120, 214];
const ADAPTADO: Cor = [235, 104, 52];

const W = 210;
const H = 297;
const M = 15;
const CW = W - M * 2;
const LIMITE_Y = H - 20;

export async function montarPdfPerfil(opcoes: OpcoesPdfPerfil): Promise<jsPDF> {
  const { jsPDF: Pdf } = await import('jspdf');
  const doc = new Pdf({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const rel = montarRelatorio(opcoes.resultado);

  let y = 0;

  const novaPagina = () => {
    doc.addPage();
    y = 16;
  };
  const reservar = (altura: number) => {
    if (y + altura > LIMITE_Y) novaPagina();
  };

  const linhas = (texto: string, largura: number, tamanho: number, estilo: 'normal' | 'bold' = 'normal') => {
    doc.setFont('helvetica', estilo);
    doc.setFontSize(tamanho);
    return doc.splitTextToSize(texto, largura) as string[];
  };

  const paragrafo = (texto: string, op: { tamanho?: number; estilo?: 'normal' | 'bold'; cor?: Cor; x?: number; largura?: number; depois?: number } = {}) => {
    const tamanho = op.tamanho ?? 9.5;
    const x = op.x ?? M;
    const largura = op.largura ?? CW - (x - M);
    const entrelinha = tamanho * 0.46;
    const partes = linhas(texto, largura, tamanho, op.estilo);
    // Só um texto que não caiba numa página inteira se divide; os demais ficam juntos.
    if (partes.length * entrelinha < LIMITE_Y - 16) reservar(partes.length * entrelinha);
    for (const linha of partes) {
      reservar(entrelinha);
      doc.setFont('helvetica', op.estilo ?? 'normal');
      doc.setFontSize(tamanho);
      doc.setTextColor(...(op.cor ?? DARK));
      doc.text(linha, x, y);
      y += entrelinha;
    }
    y += op.depois ?? 2;
  };

  const tituloSecao = (titulo: string, subtitulo?: string) => {
    // Espaço para o título, o subtítulo e o começo do conteúdo: título nunca fica sozinho no pé da página.
    reservar(46);
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(...DARK);
    doc.text(titulo, M, y);
    y += 2;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(M, y, W - M, y);
    y += 5;
    if (subtitulo) paragrafo(subtitulo, { tamanho: 8.5, cor: GRAY, depois: 3 });
  };

  const rotulo = (texto: string) => {
    reservar(10);
    paragrafo(texto, { tamanho: 9.5, estilo: 'bold', depois: 0.8 });
  };

  const lista = (itens: readonly string[], op: { x?: number; largura?: number } = {}) => {
    const x = op.x ?? M;
    const largura = op.largura ?? CW - (x - M);
    for (const item of itens) {
      const partes = linhas(item, largura - 4, 9.5);
      reservar(partes.length * 4.4);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...DARK);
      doc.text('•', x, y);
      partes.forEach((linha, i) => doc.text(linha, x + 4, y + i * 4.4));
      y += partes.length * 4.4 + 0.6;
    }
    y += 2;
  };

  const alturaParagrafo = (texto: string) => linhas(texto, CW, 9.5).length * 9.5 * 0.46 + 2;
  const alturaLista = (itens: readonly string[]) =>
    itens.reduce((total, item) => total + linhas(item, CW - 4, 9.5).length * 4.4 + 0.6, 2);

  // Rótulo e conteúdo mudam de página juntos.
  const blocoTexto = (titulo: string, texto: string) => {
    reservar(5 + alturaParagrafo(texto));
    rotulo(titulo);
    paragrafo(texto);
  };
  const blocoLista = (titulo: string, itens: readonly string[]) => {
    reservar(5 + alturaLista(itens));
    rotulo(titulo);
    lista(itens);
  };

  const legenda = (xInicial: number = M) => {
    reservar(6);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.setFillColor(...NATURAL);
    doc.roundedRect(xInicial, y - 2.6, 3, 3, 0.6, 0.6, 'F');
    doc.text('Natural', xInicial + 4.5, y);
    doc.setFillColor(...ADAPTADO);
    doc.roundedRect(xInicial + 20, y - 2.6, 3, 3, 0.6, 0.6, 'F');
    doc.text('Adaptado', xInicial + 24.5, y);
    y += 5;
  };

  /** Colunas agrupadas numa só escala de 0 a 100, com os valores na tabela ao lado. */
  const graficoDisc = () => {
    const altura = 48;
    const larguraGrafico = 112;
    reservar(altura + 12);
    const base = y + altura;
    const x0 = M + 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    for (const marca of [0, 25, 50, 75, 100]) {
      const yMarca = base - (marca / 100) * altura;
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(marca === 0 ? 0.3 : 0.15);
      doc.line(x0, yMarca, x0 + larguraGrafico, yMarca);
      doc.text(String(marca), x0 - 1.5, yMarca + 1, { align: 'right' });
    }
    doc.setDrawColor(...GRAY);
    doc.setLineWidth(0.3);
    doc.line(x0, base - altura / 2, x0 + larguraGrafico, base - altura / 2);

    const faixa = larguraGrafico / rel.fatores.length;
    const largBarra = 6.5;
    rel.fatores.forEach((f, i) => {
      const centro = x0 + faixa * i + faixa / 2;
      const coluna = (valor: number, x: number, cor: Cor) => {
        const h = (valor / 100) * altura;
        if (h <= 0) return;
        doc.setFillColor(...cor);
        doc.roundedRect(x, base - h, largBarra, h, 0.8, 0.8, 'F');
        // Canto reto na base: só a ponta do dado é arredondada.
        doc.rect(x, base - Math.min(h, 1), largBarra, Math.min(h, 1), 'F');
      };
      coluna(f.natural, centro - largBarra - 0.4, NATURAL);
      coluna(f.adaptado, centro + 0.4, ADAPTADO);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...DARK);
      doc.text(f.fator, centro, base + 4.5, { align: 'center' });
    });

    // Tabela com os valores, ao lado do gráfico.
    const xTabela = x0 + larguraGrafico + 6;
    let yTabela = y + 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text('Fator', xTabela, yTabela);
    doc.text('Nat.', xTabela + 34, yTabela, { align: 'right' });
    doc.text('Adap.', xTabela + 46, yTabela, { align: 'right' });
    yTabela += 5;
    rel.fatores.forEach(f => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...DARK);
      doc.text(f.nome, xTabela, yTabela);
      doc.text(String(f.natural), xTabela + 34, yTabela, { align: 'right' });
      doc.text(String(f.adaptado), xTabela + 46, yTabela, { align: 'right' });
      yTabela += 5.5;
    });
    y = base + 12;
  };

  const barraValor = (nome: string, detalhe: string, valor: number, sufixo = '') => {
    reservar(9);
    const xBarra = M + 56;
    const larg = CW - 56 - 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text(nome, M, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(detalhe, M, y + 3.2);
    doc.setFillColor(...LIGHT);
    doc.roundedRect(xBarra, y - 2.6, larg, 3.2, 1, 1, 'F');
    if (valor > 0) {
      doc.setFillColor(...NATURAL);
      doc.roundedRect(xBarra, y - 2.6, Math.max(2, (Math.min(valor, 100) / 100) * larg), 3.2, 1, 1, 'F');
    }
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text(`${valor}${sufixo}`, W - M, y, { align: 'right' });
    y += 8;
  };

  // ---------------- Capa ----------------
  const logoEscritorio = await getOfficeLogoBase64();
  const { textX } = drawPdfHeaderBand(doc, {
    pageWidth: W, margin: M, headerHeight: 28,
    officeLogoBase64: logoEscritorio,
    empresaLogoData: opcoes.empresaLogoData,
  });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('Perfil Comportamental', textX, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Análise DISC, tipos psicológicos e valores', textX, 20);

  y = 38;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...DARK);
  doc.text(opcoes.nome, M, y);
  y += 5.5;
  const detalhes = [nomeTipoRespondente(opcoes.tipo), opcoes.cargo, opcoes.empresa].filter(Boolean).join(' · ');
  paragrafo(detalhes, { tamanho: 9.5, cor: GRAY, depois: 0.5 });
  const quando = opcoes.concluidoEm ? `Respondido em ${new Date(opcoes.concluidoEm).toLocaleDateString('pt-BR')} · ` : '';
  paragrafo(`${quando}Tempo de resposta: ${formatarTempoResposta(opcoes.tempoRespostaSeg)}`, { tamanho: 8.5, cor: GRAY, depois: 5 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...DARK);
  doc.text(rel.perfil, M, y + 5);
  y += 12;
  paragrafo(rel.titulo, { tamanho: 11, estilo: 'bold', depois: 2 });
  rel.visaoGeral.forEach(p => paragrafo(p));

  // ---------------- DISC ----------------
  tituloSecao('Intensidade dos fatores DISC', 'Natural é como a pessoa tende a agir sem pressão. Adaptado é o que ela percebe que o dia a dia exige. Acima de 50, o fator está acima da própria média.');
  legenda();
  graficoDisc();

  blocoTexto(`Esforço de adaptação: ${rel.esforco.nome} (${rel.esforco.valor})`, rel.esforco.texto);

  // ---------------- Características ----------------
  tituloSecao('Características principais');
  blocoTexto('Potencialidades', rel.potencialidades);
  blocoTexto('Relações interpessoais', rel.relacoes);
  blocoTexto('Tomada de decisão', rel.decisao);
  blocoTexto('O que motiva', rel.motivacao);
  blocoTexto('Onde tende a render mais', rel.adequacao);
  blocoLista('Receios comuns', rel.receios);

  // ---------------- Fatores ----------------
  tituloSecao('Leitura de cada fator');
  rel.fatores.forEach(f => {
    const noAmbiente = `No ambiente atual: ${f.adaptacao}`;
    reservar(5 + alturaParagrafo(f.leitura) + alturaParagrafo(noAmbiente));
    rotulo(`${f.titulo} (${f.fator}: natural ${f.natural}, adaptado ${f.adaptado})`);
    paragrafo(f.leitura, { depois: 1 });
    paragrafo(noAmbiente, { depois: 3 });
  });

  tituloSecao('Pontos de atenção sob pressão', 'Comportamentos que costumam aparecer neste perfil em momentos de estresse. Vale avaliar quais já foram superados e quais ainda pedem atenção.');
  lista(rel.pressao);

  // ---------------- Tipos ----------------
  tituloSecao(`Tipos psicológicos: ${rel.tipoJung}`, 'Preferências baseadas nos conceitos de Jung: onde foca a atenção, como capta informação e como tira conclusões.');
  rel.jung.forEach(l => {
    const leitura = `${l.preferencia.nome}: ${l.preferencia.descricao} ${l.preferencia.tracos.join('. ')}.`;
    reservar(12 + alturaParagrafo(leitura));
    const [a, b] = l.polos;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    doc.text(`${a.nome} (${a.letra}): ${a.pct}%`, M, y);
    doc.text(`${b.nome} (${b.letra}): ${b.pct}%`, W - M, y, { align: 'right' });
    y += 1.5;
    const vao = a.pct > 0 && b.pct > 0 ? 0.6 : 0;
    const larguraA = (a.pct / 100) * (CW - vao);
    const larguraB = (b.pct / 100) * (CW - vao);
    if (larguraA > 0) { doc.setFillColor(...NATURAL); doc.roundedRect(M, y, larguraA, 6, 1, 1, 'F'); }
    if (larguraB > 0) { doc.setFillColor(...ADAPTADO); doc.roundedRect(M + larguraA + vao, y, larguraB, 6, 1, 1, 'F'); }
    y += 10;
    paragrafo(leitura, { depois: 3 });
  });

  // ---------------- Valores ----------------
  tituloSecao('Valores e motivadores', 'O que tende a impulsionar as escolhas da pessoa, do mais forte para o mais fraco.');
  rel.valores.forEach(v => barraValor(v.nome, `${v.motivador} · ${v.nomeNivel}`, v.pontos));
  y += 2;
  rel.valores.filter(v => v.nivel === 'significativo').forEach(v => {
    const estimulo = `O que costuma estimular: ${v.estimulo}`;
    reservar(5 + alturaParagrafo(v.descricao) + alturaParagrafo(estimulo));
    rotulo(v.nome);
    paragrafo(v.descricao, { depois: 1 });
    paragrafo(estimulo, { depois: 3 });
  });

  // ---------------- Liderança ----------------
  tituloSecao('Estilo de liderança', `Estilo predominante: ${rel.liderancaPrincipal.nome}. ${rel.liderancaPrincipal.resumo}`);
  rel.lideranca.forEach(l => barraValor(l.nome, '', l.pct, '%'));
  blocoLista('Pontos fortes', rel.liderancaPrincipal.fortes);
  blocoLista('Cuidados', rel.liderancaPrincipal.cuidados);

  // ---------------- Competências ----------------
  tituloSecao('Mapa de competências', 'Estimativas calculadas a partir dos fatores DISC, nos estilos natural e adaptado.');
  legenda();
  rel.competencias.forEach(grupo => {
    reservar(6 + grupo.itens.length * 5.6);
    paragrafo(grupo.nome, { tamanho: 8.5, estilo: 'bold', cor: GRAY, depois: 1 });
    grupo.itens.forEach(item => {
      reservar(7);
      const xBarras = M + 50;
      const larg = (CW - 50 - 22) / 2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...DARK);
      doc.text(item.nome, M, y);
      const medidor = (x: number, valor: number, cor: Cor) => {
        doc.setFillColor(...LIGHT);
        doc.roundedRect(x, y - 2.4, larg, 2.6, 0.8, 0.8, 'F');
        if (valor > 0) {
          doc.setFillColor(...cor);
          doc.roundedRect(x, y - 2.4, Math.max(1.6, (valor / 100) * larg), 2.6, 0.8, 0.8, 'F');
        }
        doc.setFontSize(8.5);
        doc.setTextColor(...DARK);
        doc.text(String(valor), x + larg + 7, y, { align: 'right' });
      };
      medidor(xBarras, item.natural, NATURAL);
      medidor(xBarras + larg + 11, item.adaptado, ADAPTADO);
      y += 5.6;
    });
    y += 2;
  });

  // ---------------- Tendências ----------------
  tituloSecao('Tendências de comportamento', 'Para que lado a pessoa tende a pender em cada par, no estilo natural.');
  rel.tendencias.forEach(t => {
    reservar(6);
    doc.setFontSize(9);
    doc.setFont('helvetica', t.lado === 'a' ? 'bold' : 'normal');
    doc.setTextColor(...(t.lado === 'a' ? DARK : GRAY));
    doc.text(t.lado === 'a' ? `• ${t.a}` : t.a, M, y);
    if (t.lado === 'equilibrio') {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.text('equilíbrio', W / 2, y, { align: 'center' });
    }
    doc.setFontSize(9);
    doc.setFont('helvetica', t.lado === 'b' ? 'bold' : 'normal');
    doc.setTextColor(...(t.lado === 'b' ? DARK : GRAY));
    doc.text(t.lado === 'b' ? `${t.b} •` : t.b, W - M, y, { align: 'right' });
    y += 5.4;
  });
  y += 2;

  // ---------------- Comunicação ----------------
  tituloSecao('Comunicação');
  blocoLista('Para se comunicar bem com esta pessoa', rel.comunicarComPessoa);
  rel.comunicarComOutros.forEach((g, i) => {
    reservar((i === 0 ? 10 : 5) + alturaLista(g.dicas));
    if (i === 0) rotulo('Como esta pessoa pode se adaptar a cada perfil');
    paragrafo(`Com quem tem ${g.nome} alta`, { tamanho: 9, estilo: 'bold', cor: GRAY, depois: 1 });
    lista(g.dicas);
  });

  // ---------------- Plano ----------------
  tituloSecao('Plano de ação');
  blocoLista('Forças para aproveitar', rel.plano.forcas);
  blocoLista('O que desenvolver primeiro', rel.plano.desenvolver);
  blocoLista('Ações sugeridas', rel.plano.acoes);
  reservar(28);
  rotulo('Perguntas para a conversa de retorno');
  rel.plano.perguntas.forEach(p => {
    reservar(20);
    paragrafo(p, { depois: 3 });
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    for (let i = 0; i < 2; i++) {
      doc.line(M, y, W - M, y);
      y += 6;
    }
    y += 1;
  });

  reservar(20);
  y += 2;
  paragrafo(AVISO_METODOLOGICO, { tamanho: 7.5, cor: GRAY });

  drawPdfFooter(doc, { pageWidth: W, pageHeight: H, margin: M });
  return doc;
}

export async function baixarPdfPerfil(opcoes: OpcoesPdfPerfil): Promise<void> {
  const doc = await montarPdfPerfil(opcoes);
  const data = opcoes.concluidoEm ? new Date(opcoes.concluidoEm).toISOString().slice(0, 10) : '';
  doc.save(`perfil-comportamental-${slugifyFileName(opcoes.nome) || 'respondente'}${data ? `-${data}` : ''}.pdf`);
}
