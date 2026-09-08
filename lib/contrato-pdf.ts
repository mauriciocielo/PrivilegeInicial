// ============================================================
// CONTRATO DE PRESTAÇÃO DE SERVIÇOS — modelo oficial Privilege
// ============================================================
// Reproduz o modelo em uso pelo escritório (20 cláusulas + Anexo I de serviços
// + contrato de confidencialidade), com a identidade visual padrão: logo no
// topo, marca d'água lateral, texto justificado e rodapé de contato.
//
// Os dados do CLIENTE vêm do cadastro da empresa — o modelo antigo era digitado
// a cada contrato, o que já produziu ao menos um documento com o cliente de
// outro contrato no anexo de sigilo.

import {
  getOfficeLogoBase64, slugifyFileName, drawPdfHeaderBand, drawPdfFooter,
  PDF_ACCENT, PDF_DARK, PDF_GRAY,
} from './pdf-branding';

const WINE = PDF_ACCENT;
const INK = PDF_DARK;
const SOFT = PDF_GRAY;

/** Texto padrão do Anexo I — ponto de partida, editável por cliente. */
export const SERVICOS_PADRAO = `1.1 - FINANCEIRO
Fluxo de caixa: Obter através de ferramenta uma visão detalhada das entradas e saídas de recurso da empresa, com apresentação mensal.
Demonstração de Resultado: Demonstrar a viabilidade econômica da empresa com apresentação mensal.
Endividamento: Compreender a situação atual da empresa em relação as suas dívidas e capacidade de pagamento e oferecer estratégias para otimizar taxas e prazos.
Orçamento: Desenvolvimento de um fluxo de caixa projetado tendo assim a gestão dos custos e despesas. Através de um orçamento embasado nas necessidades de compras e de gastos, de acordo com a demanda.
Ponto de Equilíbrio: Identificar quanto é necessário a empresa obter de receita para cumprir com suas obrigações (custos e despesas).

1.2 - GESTÃO | MARKETING | VENDAS
Diagnóstico Empresarial: Identificação de gargalos, oportunidades e prioridades.
Gestão e Processos: Estruturação de metas, rotinas, responsabilidades e planos de ação.
Gestão Comercial: Organização do processo de vendas, carteira de clientes, prospecção, negociação e pós-venda.
Marketing e Posicionamento: Estratégias para fortalecimento da marca e geração de oportunidades comerciais.
Indicadores e Acompanhamento: Definição e acompanhamento de metas, indicadores e resultados.
Pessoas e Liderança: Desenvolvimento de gestores e equipes para aumento de performance.`;

/** Dados da contratada — fixos, conferidos no contrato oficial. */
export const PRIVILEGE = {
  razaoSocial: 'PRIVILEGE CONSULTORIA LTDA',
  nomeContrato: 'PRIVILEGE CONTABILIDADE E CONSULTORIA',
  cnpj: '58.033.979/0001-84',
  endereco: 'Rua Pará, 127, Sala 103, Centro',
  cep: '85.601-290',
  cidade: 'Francisco Beltrão',
  uf: 'PR',
  whatsapp: '(46) 99904-8990',
  instagram: 'privilegefb',
};

export interface ContratoCliente {
  razaoSocial: string;
  cnpj: string;
  endereco: string;
  cep: string;
  cidade: string;
  uf: string;
}

export interface ContratoCondicoes {
  /** Valor total da remuneração, em reais. */
  valorTotal: number;
  /** Entrada paga na assinatura. */
  valorEntrada: number;
  parcelas: number;
  /** Dia do vencimento das parcelas. */
  diaVencimento: number;
  /** Data da primeira parcela (texto livre, ex.: "10 de outubro de 2026"). */
  primeiroVencimento: string;
  inicioServicos: string;
  duracaoMeses: number;
  horasSemanais: number;
  /** Data de assinatura por extenso. */
  dataAssinatura: string;
  /** Inclui o contrato de confidencialidade como anexo final. */
  incluirConfidencialidade: boolean;
  /** Descrição dos serviços do Anexo I. Vazio usa SERVICOS_PADRAO. */
  servicos?: string;
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Valor por extenso — cobre as faixas usadas em contratos deste porte. */
function porExtenso(v: number): string {
  const u = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
    'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const d = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const c = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos',
    'setecentos', 'oitocentos', 'novecentos'];

  const ate999 = (n: number): string => {
    if (n === 0) return '';
    if (n === 100) return 'cem';
    const partes: string[] = [];
    const cen = Math.floor(n / 100);
    const resto = n % 100;
    if (cen) partes.push(c[cen]);
    if (resto) {
      if (resto < 20) partes.push(u[resto]);
      else {
        const dez = Math.floor(resto / 10);
        const un = resto % 10;
        partes.push(un ? `${d[dez]} e ${u[un]}` : d[dez]);
      }
    }
    return partes.join(' e ');
  };

  const inteiro = Math.floor(Math.abs(v));
  if (inteiro === 0) return 'zero reais';

  const mil = Math.floor(inteiro / 1000);
  const resto = inteiro % 1000;
  const partes: string[] = [];
  if (mil === 1) partes.push('mil');
  else if (mil > 1) partes.push(`${ate999(mil)} mil`);
  if (resto) partes.push(ate999(resto));

  const texto = partes.join(mil && resto ? (resto < 100 ? ' e ' : ' ') : '');
  return `${texto} ${inteiro === 1 ? 'real' : 'reais'}`;
}

// ── Motor de texto com paginação (milímetros, como os demais PDFs) ──
const M = 18;          // margem lateral
const HEADER_H = 30;   // faixa institucional
const TOP = 46;        // início do corpo, abaixo da faixa
const BOTTOM = 24;     // reserva para o rodapé

export async function gerarContratoPdf(
  cliente: ContratoCliente,
  cond: ContratoCondicoes,
): Promise<{ blob: Blob; nome: string }> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const largura = W - M * 2;
  const logo = await getOfficeLogoBase64();

  let y = TOP;

  /** Faixa institucional idêntica à dos demais relatórios do sistema. */
  const decorarPagina = () => {
    const { textX } = drawPdfHeaderBand(doc, {
      pageWidth: W, margin: M, headerHeight: HEADER_H, officeLogoBase64: logo,
    });
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('CONTRATO DE PRESTAÇÃO DE SERVIÇOS', textX, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`${PRIVILEGE.whatsapp} · @${PRIVILEGE.instagram}`, textX, 21);
  };

  const novaPagina = () => { doc.addPage(); decorarPagina(); y = TOP; };
  const espaco = (v: number) => { y += v; };

  // jsPDF mede fonte em pontos mesmo quando o documento está em milímetros:
  // 1pt = 0,3528mm. A entrelinha precisa dessa conversão para não ficar
  // absurdamente espaçada (era o caso quando o documento estava em pontos).
  const PT = 0.3528;

  /** Escreve um parágrafo justificado, quebrando entre linhas. */
  const paragrafo = (
    texto: string,
    opts: { negritoAte?: number; tamanho?: number; espacoDepois?: number; alinhamento?: 'justify' | 'center' } = {}
  ) => {
    const tam = opts.tamanho ?? 9.5;
    const alturaLinha = tam * PT * 1.34;
    doc.setFontSize(tam);
    doc.setTextColor(...INK);

    // "Cláusula 1ª" e afins saem em negrito, como no modelo.
    if (opts.negritoAte) {
      const rotulo = texto.slice(0, opts.negritoAte);
      const resto = texto.slice(opts.negritoAte);
      doc.setFont('helvetica', 'bold');
      const larguraRotulo = doc.getTextWidth(rotulo);
      if (y + alturaLinha > H - BOTTOM) novaPagina();
      doc.text(rotulo, M, y);
      doc.setFont('helvetica', 'normal');
      const linhas: string[] = doc.splitTextToSize(resto.trimStart(), largura - larguraRotulo - 4);
      doc.text(linhas[0] ?? '', M + larguraRotulo + 4, y);
      y += alturaLinha;
      const demais: string[] = doc.splitTextToSize(
        resto.trimStart().slice((linhas[0] ?? '').length).trimStart(), largura
      );
      for (const l of demais) {
        if (y + alturaLinha > H - BOTTOM) novaPagina();
        doc.text(l, M, y);
        y += alturaLinha;
      }
    } else {
      doc.setFont('helvetica', 'normal');
      const linhas: string[] = doc.splitTextToSize(texto, largura);
      for (const l of linhas) {
        if (y + alturaLinha > H - BOTTOM) novaPagina();
        if (opts.alinhamento === 'center') doc.text(l, W / 2, y, { align: 'center' });
        else doc.text(l, M, y);
        y += alturaLinha;
      }
    }
    espaco(opts.espacoDepois ?? 2.4);
  };

  const titulo = (t: string, espacoAntes = 5) => {
    espaco(espacoAntes);
    if (y + 10 > H - BOTTOM) novaPagina();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...WINE);
    doc.text(t, W / 2, y, { align: 'center' });
    y += 3;
    doc.setDrawColor(...WINE);
    doc.setLineWidth(0.4);
    const meia = doc.getTextWidth(t) / 2;
    doc.line(W / 2 - meia, y, W / 2 + meia, y);
    y += 5;
    doc.setTextColor(...INK);
  };

  const assinaturas = (esq: string, dir: string) => {
    if (y + 26 > H - BOTTOM) novaPagina(); else espaco(16);
    const larguraLinha = (largura - 14) / 2;
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.3);
    doc.line(M, y, M + larguraLinha, y);
    doc.line(W - M - larguraLinha, y, W - M, y);
    y += 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    const linhasEsq: string[] = doc.splitTextToSize(esq, larguraLinha);
    const linhasDir: string[] = doc.splitTextToSize(dir, larguraLinha);
    linhasEsq.forEach((l, i) => doc.text(l, M + larguraLinha / 2, y + i * 4, { align: 'center' }));
    linhasDir.forEach((l, i) => doc.text(l, W - M - larguraLinha / 2, y + i * 4, { align: 'center' }));
    y += Math.max(linhasEsq.length, linhasDir.length) * 4 + 3;
  };

  const clienteQualificado =
    `${cliente.razaoSocial}, sediada no endereço ${cliente.endereco}, ${cliente.cidade}, ${cliente.uf}, `
    + `CEP ${cliente.cep}, CNPJ ${cliente.cnpj}, doravante denominada "CLIENTE"`;
  const privilegeQualificada =
    `${PRIVILEGE.razaoSocial}, sediada no endereço ${PRIVILEGE.endereco}, CEP ${PRIVILEGE.cep}, `
    + `${PRIVILEGE.cidade}, ${PRIVILEGE.uf}, CNPJ ${PRIVILEGE.cnpj}, doravante denominada `
    + `"${PRIVILEGE.nomeContrato}".`;

  // ── Página 1 ────────────────────────────────────────────────
  decorarPagina();
  titulo('Contrato de Prestação de Serviços', 0);
  paragrafo(`Contrato de prestação de serviços que entre si fazem ${clienteQualificado} e ${privilegeQualificada}`);
  paragrafo(
    `Considerando que a ${PRIVILEGE.nomeContrato} está disposta a prestar os serviços descritos no ANEXO I `
    + `deste contrato definidos ao CLIENTE, que está disposto a remunerar tais serviços de acordo com as `
    + `condições também a seguir estipuladas, RESOLVEM:`
  );

  titulo('DO OBJETO');
  paragrafo(`Cláusula 1ª O presente instrumento tem por objeto a contratação da ${PRIVILEGE.nomeContrato} para a prestação dos serviços descritos no ANEXO I, doravante denominados "SERVIÇOS".`, { negritoAte: 11 });
  paragrafo(`Cláusula 2ª A ${PRIVILEGE.nomeContrato} concorda em realizar os SERVIÇOS em estrita observância do estabelecido no ANEXO I deste.`, { negritoAte: 11 });
  paragrafo(`Cláusula 3ª Os serviços ora outorgados à ${PRIVILEGE.nomeContrato} são conferidos em caráter de exclusividade durante o prazo de vigência deste contrato, não podendo o CLIENTE outorgar poderes iguais ou semelhantes aos conferidos à ${PRIVILEGE.nomeContrato} para terceiros.`, { negritoAte: 11 });
  paragrafo(`Cláusula 4ª A presente contratação não limita, de qualquer forma, o relacionamento comercial, de investimento, ou qualquer outro relacionamento da ${PRIVILEGE.nomeContrato} com terceiros, ainda que concorrentes ou do mesmo segmento de atuação do CLIENTE.`, { negritoAte: 11 });

  titulo('DO PRAZO');
  paragrafo('Cláusula 5ª Este contrato se faz em caráter irrevogável e irretratável, por exceção das hipóteses expressamente previstas neste instrumento, e tem prazo de validade conforme definido no ANEXO I deste instrumento, podendo este prazo ser prorrogado por comum acordo das partes.', { negritoAte: 11 });

  titulo('DA REMUNERAÇÃO');
  paragrafo(`Cláusula 6ª Em remuneração aos SERVIÇOS prestados pela ${PRIVILEGE.nomeContrato}, por meio deste contrato, o CLIENTE concorda em pagar à ${PRIVILEGE.nomeContrato}, de acordo com valores, cronograma de desembolsos e condições definidas no ANEXO I deste instrumento.`, { negritoAte: 11 });
  paragrafo(`§ 1º Os pagamentos serão efetuados via boleto bancário ou depósito identificado na conta corrente da ${PRIVILEGE.nomeContrato}.`, { tamanho: 9.5 });
  paragrafo('§ 2º As despesas de material necessárias ao desenvolvimento das atividades e produtos serão custeadas pelo CLIENTE, com orçamentos e decisões pré-estabelecidas por ambas as partes.', { tamanho: 9.5 });
  paragrafo('Cláusula 7ª O atraso no pagamento de valores fará com que o CLIENTE incorra em multa de 2% (dois por cento) sobre o valor devido e não pago, acrescida de juro de mora de 1% (um por cento) ao mês e correção monetária pelo IGPM/FGV. Sendo ainda passível de inclusão nos órgãos de proteção ao crédito.', { negritoAte: 11 });

  titulo(`DAS OBRIGAÇÕES DA ${PRIVILEGE.nomeContrato}`);
  paragrafo(`Cláusula 8ª A ${PRIVILEGE.nomeContrato} no desenvolvimento de suas atividades, além de outras obrigações dispostas ao longo deste instrumento, compromete-se a: (a) iniciar os esforços para a prestação dos SERVIÇOS imediatamente após a assinatura deste contrato; (b) prestar os serviços contratados com qualidade, zelo, responsabilidade e em consonância com a legislação vigente; e (c) fornecer e dirigir, sob sua exclusiva responsabilidade, profissionais especializados para a execução dos trabalhos e para a consecução do SERVIÇOS.`, { negritoAte: 11 });
  paragrafo(`Cláusula 9ª A ${PRIVILEGE.nomeContrato} se compromete a utilizar todas as informações cedidas pelo CLIENTE com a finalidade de desenvolver os serviços contratados, sempre tendo como premissa a confidencialidade das informações.`, { negritoAte: 11 });
  paragrafo('§ Único. Este Contrato não poderá ser cedido, no todo ou em parte, ressalvada a concordância expressa, escrita, de ambas as partes.', { tamanho: 9.5 });

  titulo('DAS OBRIGAÇÕES DO CLIENTE');
  paragrafo(`Cláusula 10ª O CLIENTE, no desenvolvimento de suas atividades, além de outras obrigações dispostas ao longo deste instrumento, compromete-se a: (a) transmitir à ${PRIVILEGE.nomeContrato}, em tempo hábil à execução dos SERVIÇOS contratados, todos os dados e informações necessárias, documentos, meios, recursos, pessoas, etc., garantindo-lhe acesso aos seus conselheiros, diretores, empregados e representantes e às suas informações corporativas, financeiras ou não, relevantes aos SERVIÇOS contratados; e (b) efetuar pontualmente os pagamentos pelos serviços prestados pela ${PRIVILEGE.nomeContrato}, em conformidade com as cláusulas e condições deste contrato.`, { negritoAte: 12 });
  paragrafo(`§ 1º As informações passadas pelo CLIENTE à ${PRIVILEGE.nomeContrato} devem ser válidas, completas, corretas e verdadeiras, sendo que o CLIENTE deverá informar à ${PRIVILEGE.nomeContrato} imediatamente e por escrito caso quaisquer das informações se torne falsa, incompleta ou incorreta. A ${PRIVILEGE.nomeContrato} não terá o dever de conferência das informações recebidas do CLIENTE e não se responsabilizará pela idoneidade delas.`, { tamanho: 9.5 });
  paragrafo(`Cláusula 11ª É obrigação do CLIENTE, manter exclusividade com a ${PRIVILEGE.nomeContrato} do que está estipulado neste instrumento, ficando impedida de contratar outra empresa que execute os mesmos serviços.`, { negritoAte: 12 });

  titulo('DA RESCISÃO');
  paragrafo('Cláusula 12ª Este contrato poderá ser rescindido a qualquer tempo por qualquer uma das partes, mediante aviso prévio de 30 dias, podendo ser realizado por e-mail, WhatsApp ou qualquer outro meio hábil.', { negritoAte: 12 });
  paragrafo('§ Único. Em caso de rescisão do contrato por parte da CONTRATANTE, o valor atribuído a remuneração total deverá ser liquidado de acordo com o cronograma de vencimentos, tendo em vista que o parcelamento ora concedido se trata de benefício concedido pela CONTRATADA à CONTRATANTE.', { tamanho: 9.5 });

  titulo('CONDIÇÕES GERAIS');
  paragrafo(`Cláusula 13ª O CLIENTE declara e garante à ${PRIVILEGE.nomeContrato} que atua em nome próprio e tomou e tomará suas próprias decisões em relação à realização e à adequação dos SERVIÇOS prestados em vista de seus objetivos, com base em sua própria análise e mediante assessoria dos consultores que considerou necessários e que está apto a avaliar e entender, de forma independente ou por meio de assessoria profissional, e que de fato entende e aceita, os termos, condições, deveres e riscos envolvidos nos SERVIÇOS, e que está apto a assumir, e que de fato assume, os riscos dos SERVIÇOS.`, { negritoAte: 12 });
  paragrafo('Cláusula 14ª Qualquer modificação que afete os termos, condições ou especificações do presente Contrato deverá ser objeto de alteração por escrito com anuência de ambas as partes.', { negritoAte: 12 });
  paragrafo('Cláusula 15ª O descumprimento das obrigações assumidas pelas Partes neste instrumento, não sanadas no prazo de 3 (três) dias da comunicação de uma Parte à outra, fará com que este contrato possa ser rescindido de pleno direito, independentemente de notificação prévia. Neste caso, a Parte inocente poderá pleitear da Parte inadimplente as perdas e danos incorridos.', { negritoAte: 12 });
  paragrafo(`Cláusula 16ª O inadimplemento da obrigação de exclusividade de que trata a Cláusula Terceira deste Contrato pelo CLIENTE, dará à ${PRIVILEGE.nomeContrato} o direito de pleitear multa equivalente ao valor deste contrato conforme definido no ANEXO I.`, { negritoAte: 12 });
  paragrafo(`Cláusula 17ª De forma a permitir à ${PRIVILEGE.nomeContrato} o aproveitamento da expertise de suas coligadas, afiliadas, controladas ou controladoras em relação aos SERVIÇOS contratados no âmbito deste contrato, o CLIENTE concorda que a ${PRIVILEGE.nomeContrato} poderá fornecer a essas as informações recebidas do CLIENTE, desde que no intuito de realizar o SERVIÇO, sem que tal fato seja considerado quebra de confidencialidade, ou ainda ceder os direitos e obrigações deste contrato para suas empresas coligadas, afiliadas, controladas ou controladoras.`, { negritoAte: 12 });
  // A cláusula que nomeava a empresa coligada AZHUM foi retirada do modelo:
  // valia apenas para um contrato específico. A Cláusula 17ª já autoriza, de
  // forma genérica, o uso de coligadas quando necessário.
  paragrafo(`Cláusula 18ª O CLIENTE autoriza desde já o uso e divulgação de seu nome pela ${PRIVILEGE.nomeContrato}, para composição de experiências e informações adicionais em portifólio.`, { negritoAte: 12 });

  titulo('DO FORO');
  paragrafo(`Cláusula 19ª Este contrato é regido e interpretado de acordo com as leis da República Federativa do Brasil, sendo que as Partes elegem o foro da Comarca de ${PRIVILEGE.cidade}, Estado do Paraná, para dirimir quaisquer disputas ou controvérsias deste instrumento, com expressa renúncia a qualquer outro, por mais privilegiado que seja.`, { negritoAte: 12 });
  paragrafo('E, por estarem assim justas e contratadas, as partes assinam o presente instrumento em 2 (duas) vias de igual forma e teor, para um só efeito.');
  espaco(6);
  paragrafo(`${PRIVILEGE.cidade}, ${cond.dataAssinatura}`, { alinhamento: 'center' });
  assinaturas(PRIVILEGE.nomeContrato, 'CLIENTE');

  // ── ANEXO I ─────────────────────────────────────────────────
  novaPagina();
  titulo('ANEXO I - SERVIÇOS', 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Descrição dos Serviços:', M, y); y += 16;

  // Serviços descritos pelo consultor. Convenções de formatação do texto livre:
  //  · linha no padrão "1.2 - TÍTULO" vira subtítulo centralizado;
  //  · "Rótulo: descrição" destaca o rótulo em negrito;
  //  · linha em branco separa blocos.
  const servicos = (cond.servicos?.trim() || SERVICOS_PADRAO).split(/\r?\n/);
  for (const linha of servicos) {
    const t = linha.trim();
    if (!t) { espaco(2); continue; }

    if (/^\d+(\.\d+)*\s*[-–]\s*.+/.test(t)) {
      titulo(t, y === TOP ? 0 : 4);
      continue;
    }

    const sep = t.indexOf(':');
    // Só trata como rótulo se os dois pontos vierem cedo e houver texto depois.
    if (sep > 0 && sep <= 42 && t.length > sep + 1) {
      paragrafo(t, { negritoAte: sep + 1 });
    } else {
      paragrafo(t);
    }
  }

  titulo('1.3 - CONDIÇÕES E PRAZOS DA PRESTAÇÃO DOS SERVIÇOS');
  paragrafo('A assessoria Financeira será prestada ao CLIENTE, de forma presencial ou internamente conforme demanda e necessidade.');

  const parcela = cond.parcelas > 0 ? (cond.valorTotal - cond.valorEntrada) / cond.parcelas : 0;
  paragrafo('Valor da Remuneração:', { negritoAte: 21, espacoDepois: 2 });
  paragrafo(`${brl(cond.valorTotal)} (${porExtenso(cond.valorTotal)})`);
  paragrafo('Forma de Pagamento - Cronograma de Desembolso:', { negritoAte: 46, espacoDepois: 2 });
  paragrafo(
    `- ${brl(cond.valorEntrada)} (${porExtenso(cond.valorEntrada)}) na assinatura do contrato e `
    + `${brl(cond.valorTotal - cond.valorEntrada)} (${porExtenso(cond.valorTotal - cond.valorEntrada)}) `
    + `em ${cond.parcelas} parcelas de ${brl(parcela)} (${porExtenso(parcela)}) no boleto, com vencimento `
    + `no dia ${cond.diaVencimento} de cada mês, iniciando em ${cond.primeiroVencimento}.`
  );
  paragrafo('Início e Prazo dos Serviços:', { negritoAte: 27, espacoDepois: 2 });
  paragrafo(
    `Início em ${cond.inicioServicos} com duração de ${String(cond.duracaoMeses).padStart(2, '0')} `
    + `(${porExtenso(cond.duracaoMeses).replace(' reais', '').replace(' real', '')}) meses com atendimento `
    + `semanal de ${cond.horasSemanais} horas, totalizando ${cond.horasSemanais * 4} horas mensais.`
  );

  // ── Contrato de confidencialidade ───────────────────────────
  if (cond.incluirConfidencialidade) {
    novaPagina();
    titulo('CONTRATO DE CONFIDENCIALIDADE DAS INFORMAÇÕES', 0);
    paragrafo(
      `${cliente.razaoSocial}, pessoa jurídica de direito privado, com sede na ${cliente.endereco}, `
      + `${cliente.cidade}, ${cliente.uf}, CEP ${cliente.cep}, inscrito no CNPJ ${cliente.cnpj}, neste ato `
      + `por seu representante legal que ao final assina, doravante designada "CONTRATANTE".`
    );
    paragrafo(
      `${PRIVILEGE.razaoSocial}, pessoa jurídica de direito privado, com sede na ${PRIVILEGE.endereco}, `
      + `CEP ${PRIVILEGE.cep}, ${PRIVILEGE.cidade}, ${PRIVILEGE.uf}, inscrito no CNPJ ${PRIVILEGE.cnpj}, neste ato `
      + `por seu representante legal que ao final assina, doravante designada "${PRIVILEGE.nomeContrato}".`
    );
    paragrafo('Pelo presente instrumento, as partes acima qualificadas resolvem em comum acordo firmar o presente contrato de confidencialidade, nas seguintes condições:');
    paragrafo('CONSIDERANDO que as partes desejam estabelecer o modo pelo qual poderão disponibilizar, entre si, informações, documentos, diretrizes ou dados relacionados aos NEGÓCIOS, os quais pretendem tratar sob o mais estrito sigilo e confidencialidade, doravante referidos apenas como "INFORMAÇÕES CONFIDENCIAIS";');
    paragrafo('1. São consideradas INFORMAÇÕES CONFIDENCIAIS, e assim doravante denominadas, todas e quaisquer informações que forem divulgadas e/ou recebidas pelas partes mutuamente, seja verbalmente, por escrito, por meio eletrônico ou por qualquer outra forma de transmissão, e que por determinação das partes, em razão de suas características essenciais ou em virtude de circunstâncias fáticas, não possam ser tornadas públicas, devendo ser protegidas pela confidencialidade e pelo sigilo, na forma deste instrumento.');
    paragrafo('2. As PARTES se comprometem mutuamente a:');
    paragrafo('a) Zelar pela manutenção do sigilo e confidencialidade de todas as INFORMAÇÕES CONFIDENCIAIS de que venham a ter ciência ou acesso, ou que lhes venham a ser confiadas por qualquer razão;');
    paragrafo('b) Fazer com que seus sócios, empregados, prepostos, consultores, contratados, diretores, representantes ou quaisquer outras pessoas sob sua responsabilidade (direta ou indireta), mantenham sob sigilo e confidencialidade todas as INFORMAÇÕES CONFIDENCIAIS a que tiverem acesso;');
    paragrafo('c) Não divulgar a terceiros, revelar, comercializar, reproduzir ou de qualquer modo dispor das INFORMAÇÕES CONFIDENCIAIS recebidas e/ou divulgadas entre si sobre terceiros ou sobre os NEGÓCIOS, salvo se houver autorização prévia da outra PARTE;');
    paragrafo('d) Tomar todas as precauções de segurança razoáveis para proteger a integridade e confidencialidade das INFORMAÇÕES CONFIDENCIAIS divulgadas e/ou recebidas uma da outra;');
    paragrafo('3. As PARTES concordam que a confidencialidade disciplinada neste contrato impõe obrigações de fazer e de não fazer, sendo cabível a execução específica destas obrigações para evitar ou remediar a violação do presente instrumento, podendo uma PARTE em relação à outra PARTE proceder na forma dos artigos 815 e seguintes do Código de Processo Civil Brasileiro, sem prejuízo das demais medidas previstas pela Lei.');
    paragrafo('4. As obrigações de confidencialidade, na forma deste contrato, passam a ter vigência a partir da data da sua assinatura e perdurarão até o final do prazo de 05 (cinco) anos, contados da conclusão dos NEGÓCIOS, concordando as PARTES que mencionadas obrigações de confidencialidade são ora assumidas para vigorarem independentemente da duração dos NEGÓCIOS e até que se esgote integralmente o prazo fixado nesta cláusula.');
    paragrafo('5. Qualquer modificação ao presente contrato deverá ser feita por escrito e assinada por representantes autorizados de cada uma das PARTES.');
    paragrafo(`6. Fica eleito o foro da cidade de ${PRIVILEGE.cidade}, Estado do Paraná, com expressa renúncia a qualquer outro, por mais privilegiado que possa vir a ser, para dirimir qualquer demanda oriunda deste contrato.`);
    paragrafo('E por estarem assim, justas e contratadas, assinam a partes o presente instrumento em 02 (duas) vias de igual teor e forma, na presença de 02 (duas) testemunhas.');
    espaco(6);
    paragrafo(`${PRIVILEGE.cidade}-${PRIVILEGE.uf}, ${cond.dataAssinatura}`, { alinhamento: 'center' });
    assinaturas('CONTRATANTE', PRIVILEGE.nomeContrato);

    espaco(16);
    if (y + 70 > H - BOTTOM) novaPagina();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text('TESTEMUNHAS', M, y); y += 12;
    doc.setDrawColor(...SOFT);
    doc.setLineWidth(0.5);
    const meia = largura / 2;
    doc.rect(M, y, meia, 22);
    doc.rect(M + meia, y, meia, 22);
    doc.rect(M, y + 22, meia, 22);
    doc.rect(M + meia, y + 22, meia, 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('NOME:', M + 6, y + 14);
    doc.text('NOME:', M + meia + 6, y + 14);
    doc.text('CPF:', M + 6, y + 36);
    doc.text('CPF:', M + meia + 6, y + 36);
    y += 52;
  }

  drawPdfFooter(doc, { pageWidth: W, pageHeight: H, margin: M });

  const nome = slugifyFileName(`Contrato-${cliente.razaoSocial}-${cond.dataAssinatura}`).slice(0, 80) || 'Contrato';
  return { blob: doc.output('blob') as Blob, nome };
}
