import { NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { acessoEmissaoNegado } from '../../../../lib/nfse/servidor';
import { apenasDigitos } from '../../../../lib/nfse/dps';
import { obterBrandingDaEmpresa } from '../../../../lib/nfse/escritorios-terceiros';
import { buscarGrupoWhatsAppEmpresa } from '../../../../lib/agenda-lembretes';
import { encontrarSessaoAdminPorNumero } from '../../../../lib/nfse/enviar-whatsapp-nfse';
import { sendBaileysLiveMessage } from '../../../../lib/baileys-manager';
import { resolveWhatsAppOwnerId } from '../../../../lib/whatsapp-owner';
import { registrarAuditoriaEscritorio } from '../../../../lib/escritorio-recursos';

export const dynamic = 'force-dynamic';

function fmtBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!m) return [96, 0, 0];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function ultimos6Meses(competencia: string): string[] {
  const [anoStr, mesStr] = competencia.split('-');
  const ano = Number(anoStr) || new Date().getFullYear();
  const mes = Number(mesStr) || new Date().getMonth() + 1;
  const lista: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(ano, mes - 1 - i, 1);
    lista.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return lista;
}

function inicio12Meses(competencia: string): string {
  const [anoStr, mesStr] = competencia.split('-');
  const ano = Number(anoStr) || new Date().getFullYear();
  const mes = Number(mesStr) || new Date().getMonth() + 1;
  const d = new Date(ano, mes - 12, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

async function gerarDossiePdf(empresaId: string, competencia: string) {
  const [empresa, branding] = await Promise.all([
    db.empresa.findUnique({
      where: { id: empresaId },
      select: {
        id: true,
        razaoSocial: true,
        nomeFantasia: true,
        cnpj: true,
        telefone: true,
        email: true,
        nfseConfig: {
          select: {
            opSimpNac: true,
            certValidoAte: true,
            usarProcuracao: true,
            procuracaoStatus: true,
          },
        },
      },
    }),
    obterBrandingDaEmpresa(empresaId),
  ]);

  if (!empresa) return null;

  const inicio12m = inicio12Meses(competencia);
  const [nfses, nfes] = await Promise.all([
    db.nfsE.findMany({
      where: {
        empresaId,
        status: 'emitida',
        dataEmissao: { gte: inicio12m },
      },
      select: {
        prestadorCnpj: true,
        prestadorRazaoSocial: true,
        tomadorRazaoSocial: true,
        dataEmissao: true,
        dataCompetencia: true,
        valorServicos: true,
        valorIss: true,
      },
    }),
    db.nfeDestinada.findMany({
      where: {
        empresaId,
        situacao: 'autorizada',
        dataEmissao: { gte: inicio12m },
      },
      select: {
        emitenteCnpj: true,
        emitenteNome: true,
        dataEmissao: true,
        valorNf: true,
      },
    }),
  ]);

  const cnpjEmp = apenasDigitos(empresa.cnpj);
  const meses6 = ultimos6Meses(competencia);
  const fatPorMes = new Map<string, number>(meses6.map((m) => [m, 0]));
  const clientesMap = new Map<string, number>();
  const fornecedoresMap = new Map<string, number>();

  let fatMes = 0;
  let comprasMes = 0;
  let rbt12 = 0;
  let qtdNfseMes = 0;
  let qtdNfeEmitMes = 0;
  let qtdComprasMes = 0;

  for (const n of nfses) {
    const pCnpj = apenasDigitos(n.prestadorCnpj);
    const ehPrestada = !pCnpj || pCnpj === cnpjEmp;
    const val = Number(n.valorServicos || 0);
    const ym = (n.dataCompetencia && /^\d{4}-\d{2}$/.test(n.dataCompetencia) ? n.dataCompetencia : n.dataEmissao.slice(0, 7));

    if (ehPrestada) {
      rbt12 += val;
      if (fatPorMes.has(ym)) fatPorMes.set(ym, (fatPorMes.get(ym) || 0) + val);
      if (ym === competencia) {
        fatMes += val;
        qtdNfseMes++;
        const cli = n.tomadorRazaoSocial || 'Cliente';
        clientesMap.set(cli, (clientesMap.get(cli) || 0) + val);
      }
    } else if (ym === competencia) {
      comprasMes += val;
      qtdComprasMes++;
      const forn = n.prestadorRazaoSocial || 'Fornecedor de Serviço';
      fornecedoresMap.set(forn, (fornecedoresMap.get(forn) || 0) + val);
    }
  }

  for (const n of nfes) {
    const eCnpj = apenasDigitos(n.emitenteCnpj);
    const ehEmitida = Boolean(cnpjEmp && eCnpj === cnpjEmp);
    const val = Number(n.valorNf || 0);
    const ym = n.dataEmissao.slice(0, 7);

    if (ehEmitida) {
      rbt12 += val;
      if (fatPorMes.has(ym)) fatPorMes.set(ym, (fatPorMes.get(ym) || 0) + val);
      if (ym === competencia) {
        fatMes += val;
        qtdNfeEmitMes++;
      }
    } else if (ym === competencia) {
      comprasMes += val;
      qtdComprasMes++;
      const forn = n.emitenteNome || 'Fornecedor';
      fornecedoresMap.set(forn, (fornecedoresMap.get(forn) || 0) + val);
    }
  }

  const topClientes = Array.from(clientesMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topFornecedores = Array.from(fornecedoresMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const opSimp = empresa.nfseConfig?.opSimpNac ?? 3;
  const regime = opSimp === 2 ? 'MEI' : opSimp === 1 ? 'Regime Normal' : 'Simples Nacional';
  const teto = regime === 'MEI' ? 81_000 : regime === 'Simples Nacional' ? 4_800_000 : 0;
  const pctTeto = teto > 0 ? Math.round((rbt12 / teto) * 1000) / 10 : null;

  const certVal = empresa.nfseConfig?.certValidoAte;
  const diasCert = certVal ? Math.ceil((certVal.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  // Recomendações Consultivas Automáticas
  const recomendacoes: string[] = [];
  if (diasCert !== null && diasCert <= 30) {
    recomendacoes.push(
      diasCert < 0
        ? `URGENTE: Certificado Digital A1 vencido há ${Math.abs(diasCert)} dias. Renove imediatamente para não paralisar o faturamento.`
        : `Certificado Digital A1 vence em ${diasCert} dias (${certVal?.toLocaleDateString('pt-BR')}). Programe a renovação antecipada.`
    );
  }
  if (regime === 'MEI' && rbt12 >= 64_800) {
    recomendacoes.push(`Faturamento acumulado de ${fmtBRL(rbt12)} (${pctTeto}% do teto MEI de R$ 81 mil). Planeje a migração segura para Microempresa (ME).`);
  } else if (regime === 'Simples Nacional' && rbt12 >= 2_880_000) {
    recomendacoes.push(`RBT12 em ${fmtBRL(rbt12)} — próximo ou acima do sublimite estadual de R$ 3,6M. Avalie planejamento tributário para Lucro Presumido/Real.`);
  }
  if (comprasMes > fatMes && comprasMes > 0) {
    recomendacoes.push(`Atenção: Compras com NF-e (${fmtBRL(comprasMes)}) superaram o faturamento registrado (${fmtBRL(fatMes)}) no mês. Verifique se todas as vendas foram faturadas.`);
  }
  if (recomendacoes.length === 0) {
    recomendacoes.push('Operação fiscal regular no período, sem alertas críticos de certificado A1 ou limite de enquadramento.');
  }

  // Montagem do PDF com jsPDF
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const corHex = branding?.corPrimaria || '#600000';
  const [r, g, b] = hexToRgb(corHex);
  const nomeMarca = branding?.nome || 'Privilege Consultoria';
  const contatoMarca = [branding?.telefone, branding?.email].filter(Boolean).join(' · ');

  // Cabeçalho
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(nomeMarca.toUpperCase(), 14, 11);
  doc.setFontSize(17);
  doc.text('Dossie Executivo Mensal do Empresario', 14, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${empresa.nomeFantasia || empresa.razaoSocial}  |  CNPJ ${empresa.cnpj}  |  Competencia: ${competencia}`, 14, 28);

  // 4 Cards KPI
  const kpis = [
    { label: `Faturamento (${competencia})`, value: fmtBRL(fatMes), sub: `${qtdNfseMes} NFS-e · ${qtdNfeEmitMes} NF-e` },
    { label: `Compras NF-e (${competencia})`, value: fmtBRL(comprasMes), sub: `${qtdComprasMes} documento(s)` },
    { label: 'RBT12 (12 meses)', value: fmtBRL(rbt12), sub: pctTeto !== null ? `${pctTeto}% teto ${regime}` : regime },
    {
      label: 'Certificado Digital A1',
      value: diasCert !== null ? (diasCert < 0 ? 'VENCIDO' : `${diasCert} dias`) : empresa.nfseConfig?.usarProcuracao ? 'Procuracao' : 'Nao config.',
      sub: certVal ? `Valido ate ${certVal.toLocaleDateString('pt-BR')}` : 'Monitoramento fiscal',
    },
  ];

  let y = 42;
  kpis.forEach((k, idx) => {
    const x = 14 + idx * 46.5;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, 44, 22, 3, 3, 'FD');
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(k.label, x + 3, y + 6);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.text(k.value, x + 3, y + 13.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(k.sub.slice(0, 28), x + 3, y + 19);
  });

  // Gráfico de Evolução de Faturamento (6 meses)
  y = 72;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Evolucao de Faturamento — Ultimos 6 Meses', 14, y);

  y += 4;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, 182, 48, 3, 3, 'FD');

  const vals6 = meses6.map((m) => fatPorMes.get(m) || 0);
  const maxVal = Math.max(...vals6, 1);
  meses6.forEach((m, i) => {
    const val = vals6[i];
    const barMaxH = 28;
    const h = Math.max(2, (val / maxVal) * barMaxH);
    const bx = 24 + i * 28;
    const by = y + 36 - h;
    doc.setFillColor(r, g, b);
    doc.roundedRect(bx, by, 16, h, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(0), bx + 8, by - 2, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`${m.slice(5)}/${m.slice(2, 4)}`, bx + 8, y + 43, { align: 'center' });
  });

  // Top 5 Clientes & Top 5 Fornecedores lado a lado
  y = 132;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Top 5 Clientes (${competencia})`, 14, y);
  doc.text(`Top 5 Fornecedores (${competencia})`, 108, y);

  y += 4;
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, 88, 46, 3, 3, 'S');
  doc.roundedRect(108, y, 88, 46, 3, 3, 'S');

  doc.setFontSize(8.2);
  if (topClientes.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('Sem NFS-e emitidas no mes.', 18, y + 10);
  } else {
    topClientes.forEach(([nome, val], idx) => {
      const ly = y + 8 + idx * 8;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(`${idx + 1}. ${nome.slice(0, 26)}`, 18, ly);
      doc.setFont('helvetica', 'bold');
      doc.text(fmtBRL(val), 98, ly, { align: 'right' });
    });
  }

  if (topFornecedores.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('Sem compras registradas no mes.', 112, y + 10);
  } else {
    topFornecedores.forEach(([nome, val], idx) => {
      const ly = y + 8 + idx * 8;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(`${idx + 1}. ${nome.slice(0, 26)}`, 112, ly);
      doc.setFont('helvetica', 'bold');
      doc.text(fmtBRL(val), 192, ly, { align: 'right' });
    });
  }

  // Recomendações Consultivas Automáticas
  y = 190;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(r, g, b);
  doc.text('Recomendacoes Consultivas do Escritorio', 14, y);

  y += 4;
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, 182, 52, 3, 3, 'FD');

  let ry = y + 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(31, 41, 55);
  for (const rec of recomendacoes) {
    const linhas = doc.splitTextToSize(`• ${rec}`, 172);
    doc.text(linhas, 18, ry);
    ry += linhas.length * 5 + 3;
  }

  // Rodapé White-Label
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 276, 196, 276);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(r, g, b);
  doc.text(nomeMarca, 14, 282);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(contatoMarca || 'Relatorio gerado automaticamente pelo portal fiscal', 14, 287);
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, 196, 282, { align: 'right' });

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return { pdfBuffer, empresa, branding, fatMes, comprasMes, rbt12 };
}

/**
 * GET /api/escritorio/dossie-cliente?empresaId=...&mes=YYYY-MM
 * Faz download do Dossiê Executivo Mensal do Empresário em PDF White-Label.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const empresaId = (url.searchParams.get('empresaId') || '').trim();
    const mesParam = (url.searchParams.get('mes') || '').trim();
    const competencia = /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : new Date().toISOString().slice(0, 7);

    if (!empresaId) return NextResponse.json({ error: 'empresaId obrigatório.' }, { status: 400 });
    const negado = await acessoEmissaoNegado(auth.session, empresaId);
    if (negado) return negado;

    const res = await gerarDossiePdf(empresaId, competencia);
    if (!res) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });

    const slug = (res.empresa.nomeFantasia || res.empresa.razaoSocial)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .slice(0, 32);

    return new NextResponse(new Uint8Array(res.pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Dossie_${slug}_${competencia}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Erro em GET /api/escritorio/dossie-cliente:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao gerar Dossiê Executivo em PDF.' }, { status: 500 });
  }
}

/**
 * POST /api/escritorio/dossie-cliente
 * Gera o Dossiê Executivo em PDF White-Label e envia direto no WhatsApp do cliente!
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const empresaId = String(body?.empresaId || '').trim();
    const competencia = /^\d{4}-\d{2}$/.test(String(body?.competencia || ''))
      ? String(body.competencia)
      : new Date().toISOString().slice(0, 7);
    const telefoneManual = typeof body?.telefone === 'string' ? body.telefone.trim() : '';

    if (!empresaId) return NextResponse.json({ error: 'empresaId obrigatório.' }, { status: 400 });
    const negado = await acessoEmissaoNegado(auth.session, empresaId);
    if (negado) return negado;

    const res = await gerarDossiePdf(empresaId, competencia);
    if (!res) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });

    let destino = '';
    const dig = apenasDigitos(telefoneManual || res.empresa.telefone || '');
    if (dig.length >= 10) {
      destino = dig.startsWith('55') ? dig : `55${dig}`;
    } else {
      const grupo = await buscarGrupoWhatsAppEmpresa(empresaId);
      if (grupo?.groupJid) destino = grupo.groupJid;
    }

    if (!destino) {
      return NextResponse.json({ error: 'Empresa sem telefone cadastrado nem grupo WhatsApp vinculado.' }, { status: 400 });
    }

    const ownerId = await encontrarSessaoAdminPorNumero('46999800010', resolveWhatsAppOwnerId(request));
    if (!ownerId) {
      return NextResponse.json({ error: 'WhatsApp não conectado no servidor.' }, { status: 422 });
    }

    const nomeMarca = res.branding?.nome || 'Privilege Consultoria';
    const contatoMarca = res.branding?.telefone ? ` · ${res.branding.telefone}` : '';
    const legenda = [
      `📊 *Dossiê Executivo Mensal — ${competencia}*`,
      `*Empresa:* ${res.empresa.nomeFantasia || res.empresa.razaoSocial}`,
      '',
      `💰 *Faturamento no mês:* ${fmtBRL(res.fatMes)}`,
      `🛒 *Compras NF-e no mês:* ${fmtBRL(res.comprasMes)}`,
      `📈 *Acumulado 12 meses (RBT12):* ${fmtBRL(res.rbt12)}`,
      '',
      `Segue em anexo o relatório consultivo completo preparado pelo nosso escritório.`,
      `_${nomeMarca}${contatoMarca}_`,
    ].join('\n');

    const envio = await sendBaileysLiveMessage(
      destino,
      legenda,
      {
        mediaType: 'document',
        mediaUrl: `data:application/pdf;base64,${res.pdfBuffer.toString('base64')}`,
        fileName: `Dossie_Executivo_${competencia}.pdf`,
        mimeType: 'application/pdf',
      },
      ownerId
    );

    if (!envio?.sent) {
      return NextResponse.json({ error: envio?.error || 'Falha ao enviar Dossiê no WhatsApp.' }, { status: 422 });
    }

    await registrarAuditoriaEscritorio({
      userId: auth.session.userId,
      acao: 'dossie_enviado_whatsapp',
      empresaId,
      empresaNome: res.empresa.nomeFantasia || res.empresa.razaoSocial,
      detalhes: `Enviou Dossiê Executivo PDF (${competencia}) no WhatsApp do cliente`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro em POST /api/escritorio/dossie-cliente:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao enviar Dossiê no WhatsApp.' }, { status: 500 });
  }
}
