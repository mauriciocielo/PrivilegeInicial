import jsPDF from 'jspdf';
import {
  PDF_ACCENT,
  PDF_DARK,
  PDF_GRAY,
  PDF_LIGHT,
  PDF_BORDER,
  getOfficeLogoBase64,
  drawPdfHeaderBand,
  drawPdfFooter,
  slugifyFileName,
} from './pdf-branding';
import type { LeadGarimpado } from '../app/api/garimpo-leads/route';

export async function gerarDossieLeadPdf(lead: LeadGarimpado): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const contentW = W - M * 2;

  const officeLogo = await getOfficeLogoBase64();
  const headerH = 30;
  const { textX } = drawPdfHeaderBand(doc, {
    pageWidth: W,
    margin: M,
    headerHeight: headerH,
    officeLogoBase64: officeLogo,
  });

  // Título na faixa institucional
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('PRÉ-DIAGNÓSTICO EMPRESARIAL 360º', textX, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Consultoria voltada ao Financeiro integrada a todas as áreas do negócio', textX, 19);
  doc.setFontSize(8);
  doc.text(`Preparado exclusivamente para: ${lead.nome}`, textX, 24.5);

  let y = headerH + 10;

  // Cartão de Identificação do Lead
  doc.setFillColor(...PDF_LIGHT);
  doc.setDrawColor(...PDF_BORDER);
  doc.roundedRect(M, y, contentW, 28, 3, 3, 'FD');

  doc.setTextColor(...PDF_ACCENT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(lead.nome, M + 5, y + 7);

  doc.setTextColor(...PDF_DARK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const linha1 = [
    `Segmento: ${lead.categoria || 'Empresarial'}`,
    `Localidade: ${lead.cidade}/${lead.estado}`,
    lead.cnpj ? `CNPJ: ${lead.cnpj}` : '',
  ]
    .filter(Boolean)
    .join('   ·   ');
  doc.text(linha1, M + 5, y + 13.5);

  const linha2 = [
    lead.porte ? `Porte: ${lead.porte}` : '',
    lead.nota ? `Avaliação Google: ${lead.nota.toFixed(1)}★ (${lead.avaliacoes || 0} avaliações)` : '',
    lead.socios ? `Decisores: ${lead.socios.slice(0, 55)}` : '',
  ]
    .filter(Boolean)
    .join('   ·   ');
  if (linha2) {
    doc.setTextColor(...PDF_GRAY);
    doc.text(linha2, M + 5, y + 19.5);
  }

  doc.setTextColor(...PDF_GRAY);
  doc.text(`Contato: ${lead.telefone || lead.whatsapp || 'Não informado'}   ·   E-mail: ${lead.email || 'Não informado'}`, M + 5, y + 25);

  y += 35;

  // Bloco 1: Leitura Estratégica Inicial
  doc.setTextColor(...PDF_ACCENT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('1. LEITURA ESTRATÉGICA INICIAL', M, y);
  y += 5;

  const diagTexto =
    lead.iaDiagnostico ||
    `Empresas do segmento de ${lead.categoria || 'gestão empresarial'} em ${lead.cidade || 'sua região'} frequentemente vendem bem, mas enfrentam vazamento de lucro porque o Financeiro (fluxo de caixa, DRE gerencial e precificação real) atua desconectado de Comercial, Marketing, Processos e Pessoas. A Consultoria 360º da Privilege conecta todas as áreas a partir dos números.`;

  doc.setTextColor(...PDF_DARK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.2);
  const diagLines = doc.splitTextToSize(diagTexto, contentW);
  doc.text(diagLines, M, y);
  y += diagLines.length * 4.6 + 6;

  // Bloco 2: Os 5 Pilares da Consultoria 360º (Foco no Financeiro)
  doc.setTextColor(...PDF_ACCENT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('2. METODOLOGIA PRIVILEGE 360º (COM BASE NO FINANCEIRO)', M, y);
  y += 6;

  const pilares: { titulo: string; desc: string }[] = [
    {
      titulo: 'Financeiro & Lucratividade (Núcleo Central)',
      desc: 'Estruturação de DRE gerencial, DFC diário, precificação real (impostos, taxas e custos fixos), ponto de equilíbrio e redução de vazamentos de caixa.',
    },
    {
      titulo: 'Comercial & Previsibilidade de Receita',
      desc: 'Definição de metas por margem (e não só faturamento), funil comercial, curva ABC de clientes/produtos e políticas de remuneração ligadas ao lucro.',
    },
    {
      titulo: 'Marketing Orientado a ROI',
      desc: 'Alinhamento do investimento em aquisição de clientes com CAC, ticket médio e capacidade real de caixa da operação.',
    },
    {
      titulo: 'Processos & Governança Operacional',
      desc: 'Mapeamento de rotinas financeiras, compras, estoque e entrega para eliminar retrabalho e dependência operacional dos sócios.',
    },
    {
      titulo: 'Pessoas, Cargos & Cultura de Resultado',
      desc: 'Organograma claro, descritivo de cargos, indicadores por equipe, CLT x PJ estratégico e pesquisa de clima voltada à produtividade.',
    },
  ];

  for (const p of pilares) {
    doc.setFillColor(250, 249, 247);
    doc.setDrawColor(...PDF_BORDER);
    const descLines = doc.splitTextToSize(p.desc, contentW - 10);
    const boxH = 8 + descLines.length * 4.2 + 3;
    doc.roundedRect(M, y, contentW, boxH, 2, 2, 'FD');

    doc.setTextColor(...PDF_ACCENT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.3);
    doc.text(p.titulo, M + 5, y + 6);

    doc.setTextColor(...PDF_DARK);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.6);
    doc.text(descLines, M + 5, y + 11);

    y += boxH + 3.5;
  }

  y += 3;

  // Bloco 3: Próximo Passo / Convite
  doc.setFillColor(...PDF_ACCENT);
  doc.roundedRect(M, y, contentW, 28, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('PRÓXIMO PASSO: SESSÃO DE DIAGNÓSTICO 360º (15 A 30 MIN)', M + 6, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.text(
    'Uma conversa executiva e gratuita com Maurício Cielo e equipe para mapear onde seu lucro está',
    M + 6,
    y + 14
  );
  doc.text(
    'vazando e montar um plano prático de 90 a 180 dias para a sua empresa.',
    M + 6,
    y + 18.5
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(
    'Site: privilegecontabilidade.cnt.br   ·   Instagram: @privilegeconsultoria.fb   ·   WhatsApp: (46) 99980-0010',
    M + 6,
    y + 24
  );

  drawPdfFooter(doc, {
    pageWidth: W,
    pageHeight: H,
    margin: M,
    marca: 'Privilege Consultoria 360º',
  });

  doc.save(`Pre-Diagnostico-360-${slugifyFileName(lead.nome)}.pdf`);
}
