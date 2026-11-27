import { NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { apenasDigitos } from '../../../../lib/nfse/dps';
import { obterBrandingEscritorioDoUsuario } from '../../../../lib/nfse/escritorios-terceiros';
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

async function consultarReceitaCnpj(cnpj: string): Promise<any | null> {
  const tentar = async (url: string) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        cache: 'no-store',
        headers: { 'User-Agent': 'PortalFiscal/1.0', Accept: 'application/json' },
      });
      if (!res.ok) return null;
      return await res.json().catch(() => null);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  return (
    (await tentar(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)) ||
    (await tentar(`https://minhareceita.org/${cnpj}`)) ||
    (await tentar(`https://receitaws.com.br/v1/cnpj/${cnpj}`))
  );
}

/**
 * POST /api/escritorio/raio-x-prospect
 * Máquina de Vendas White-Label para o contador: consulta o CNPJ do prospect na Receita Federal,
 * calcula projeção RBT12, economia no Fator R (28% — Anexo V -> III) e pontos da Reforma Tributária.
 * Se `formato === 'pdf'`, devolve um PDF comercial pronto com a identidade visual do escritório parceiro.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    if (auth.session.role === 'cliente') {
      return NextResponse.json({ error: 'Acesso restrito ao escritório contábil.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const cnpj = apenasDigitos(String(body?.cnpj || ''));
    const faturamentoMensal = Math.max(0, Number(body?.faturamentoMensal || 0));
    const folhaMensal = Math.max(0, Number(body?.folhaMensal || 0));
    const formato = body?.formato === 'pdf' ? 'pdf' : 'json';

    if (cnpj.length !== 14) {
      return NextResponse.json({ error: 'Informe um CNPJ válido com 14 dígitos.' }, { status: 400 });
    }

    const [dadosRf, branding] = await Promise.all([
      consultarReceitaCnpj(cnpj),
      obterBrandingEscritorioDoUsuario(auth.session.userId, auth.session.role),
    ]);

    if (!dadosRf || dadosRf.status === 'ERROR') {
      return NextResponse.json(
        { error: 'Não foi possível consultar este CNPJ na Receita Federal no momento. Tente novamente em instantes.' },
        { status: 404 }
      );
    }

    const razaoSocial = String(dadosRf.razao_social || dadosRf.nome || 'Empresa Prospect').trim();
    const nomeFantasia = String(dadosRf.nome_fantasia || dadosRf.fantasia || razaoSocial).trim();
    const situacao = String(dadosRf.descricao_situacao_cadastral || dadosRf.situacao || 'ATIVA');
    const porte = String(dadosRf.porte || dadosRf.descricao_porte || 'Não informado');
    const cnaePrincipal = dadosRf.cnae_fiscal_descricao
      ? `${dadosRf.cnae_fiscal || ''} — ${dadosRf.cnae_fiscal_descricao}`
      : dadosRf.atividade_principal?.[0]
      ? `${dadosRf.atividade_principal[0].code} — ${dadosRf.atividade_principal[0].text}`
      : 'Não informado';
    const municipio = `${dadosRf.municipio || ''}${dadosRf.uf ? ` / ${dadosRf.uf}` : ''}`.trim() || 'Não informado';
    const optanteSimples = Boolean(dadosRf.opcao_pelo_simples ?? dadosRf.simples?.optante);
    const optanteMei = Boolean(dadosRf.opcao_pelo_mei ?? dadosRf.simei?.optante);
    const capitalSocial = Number(dadosRf.capital_social || 0);

    const rbt12Projetado = faturamentoMensal * 12;
    const folhaIdeal28 = faturamentoMensal * 0.28;
    const fatorRAtual = faturamentoMensal > 0 ? Math.round((folhaMensal / faturamentoMensal) * 1000) / 10 : 0;

    // Simulação Fator R (Anexo V ~15,5% vs Anexo III ~6% para primeira faixa / base comparativa)
    const impostoAnexoVMes = faturamentoMensal * 0.155;
    const impostoAnexoIIIMes = faturamentoMensal * 0.06;
    const inssFolhaAdicional = Math.max(0, folhaIdeal28 - folhaMensal) * 0.11;
    const economiaMensalFatorR = Math.max(0, impostoAnexoVMes - impostoAnexoIIIMes - inssFolhaAdicional);
    const economiaAnualFatorR = Math.round(economiaMensalFatorR * 12 * 100) / 100;

    const oportunidades: string[] = [];
    if (optanteMei && rbt12Projetado > 64_800) {
      oportunidades.push(
        `Alerta MEI: projeção anual de ${fmtBRL(rbt12Projetado)} supera 80% do teto MEI (R$ 81 mil). Migração planejada para ME evita retroativo de 20%+ de multa.`
      );
    }
    if (faturamentoMensal > 0 && economiaAnualFatorR > 1200) {
      oportunidades.push(
        `Planejamento Fator R (28%): com pró-labore/folha de ${fmtBRL(folhaIdeal28)}/mês, prestadores enquadrados no Anexo V (15,5%) podem migrar para o Anexo III (6%), gerando economia estimada de até ${fmtBRL(economiaAnualFatorR)}/ano.`
      );
    }
    if (rbt12Projetado >= 2_880_000 && optanteSimples) {
      oportunidades.push(
        `Sublimite Estadual (R$ 3,6M): projeção anual de ${fmtBRL(rbt12Projetado)} exige estudo comparativo entre Simples Nacional, Lucro Presumido e Lucro Real.`
      );
    }
    oportunidades.push(
      `Reforma Tributária (IBS/CBS — NT 009): adequação do emissor de NFS-e Nacional e revisão de créditos B2B para preservar margem a partir de 2026/2027.`
    );
    oportunidades.push(
      `Automação Fiscal & Financeira: monitoramento 24h de NF-e recebidas na SEFAZ, emissão recorrente automática e controle de Certificados A1 sem risco de bloqueio.`
    );

    const cnpjFmt = cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

    const resultado = {
      prospect: {
        cnpj: cnpjFmt,
        razaoSocial,
        nomeFantasia,
        situacao,
        porte,
        cnaePrincipal,
        municipio,
        optanteSimples,
        optanteMei,
        capitalSocial,
      },
      simulacao: {
        faturamentoMensal,
        rbt12Projetado,
        folhaMensal,
        folhaIdeal28: Math.round(folhaIdeal28 * 100) / 100,
        fatorRAtual,
        economiaMensalFatorR: Math.round(economiaMensalFatorR * 100) / 100,
        economiaAnualFatorR,
      },
      oportunidades,
    };

    await registrarAuditoriaEscritorio({
      userId: auth.session.userId,
      acao: 'raio_x_prospect_gerado',
      detalhes: `Gerou Raio-X Comercial para ${nomeFantasia} (${cnpjFmt})${economiaAnualFatorR > 0 ? ` — Economia potencial ${fmtBRL(economiaAnualFatorR)}/ano` : ''}`,
    });

    if (formato === 'json') {
      return NextResponse.json(resultado);
    }

    // Gera PDF Comercial White-Label
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const corHex = branding?.corPrimaria || '#600000';
    const [r, g, b] = hexToRgb(corHex);
    const nomeMarca = branding?.nome || 'Privilege Consultoria';
    const contatoMarca = [branding?.telefone, branding?.email].filter(Boolean).join(' · ');

    doc.setFillColor(r, g, b);
    doc.rect(0, 0, 210, 36, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(nomeMarca.toUpperCase(), 14, 11);
    doc.setFontSize(18);
    doc.text('Raio-X Fiscal & Diagnostico Tributario', 14, 21);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Preparado exclusivamente para ${nomeFantasia} (${cnpjFmt})`, 14, 29);

    let y = 46;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('1. Dados Cadastrais (Receita Federal)', 14, y);
    y += 4;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, 182, 42, 3, 3, 'FD');

    doc.setFontSize(9);
    const linhasCad = [
      `Razao Social: ${razaoSocial}`,
      `CNPJ: ${cnpjFmt}   |   Situacao: ${situacao}   |   Porte: ${porte}`,
      `Regime: ${optanteMei ? 'MEI' : optanteSimples ? 'Simples Nacional' : 'Lucro Presumido / Real'}   |   Municipio: ${municipio}`,
      `CNAE Principal: ${cnaePrincipal.slice(0, 88)}`,
    ];
    let cy = y + 8;
    doc.setFont('helvetica', 'normal');
    for (const l of linhasCad) {
      doc.text(l, 18, cy);
      cy += 8.5;
    }

    y = 98;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('2. Simulacao de Fator R & Economia Tributaria', 14, y);
    y += 4;

    const cards = [
      { label: 'Faturamento Anual (Proj.)', value: fmtBRL(rbt12Projetado) },
      { label: 'Pro-Labore Ideal (28%)', value: fmtBRL(folhaIdeal28) },
      { label: 'Economia Estimada / Ano', value: fmtBRL(economiaAnualFatorR) },
    ];
    cards.forEach((c, idx) => {
      const cx = 14 + idx * 62;
      doc.setFillColor(idx === 2 ? 240 : 248, idx === 2 ? 253 : 250, idx === 2 ? 244 : 252);
      doc.setDrawColor(idx === 2 ? 187 : 226, idx === 2 ? 247 : 232, idx === 2 ? 208 : 240);
      doc.roundedRect(cx, y, 58, 22, 3, 3, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(c.label, cx + 4, y + 7);
      doc.setFontSize(12);
      doc.setTextColor(idx === 2 ? 21 : 15, idx === 2 ? 128 : 23, idx === 2 ? 61 : 42);
      doc.text(c.value, cx + 4, y + 16);
    });

    y = 132;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(r, g, b);
    doc.text('3. Oportunidades Identificadas para sua Empresa', 14, y);
    y += 5;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, 182, 115, 3, 3, 'FD');

    let oy = y + 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(31, 41, 55);
    for (const op of oportunidades) {
      const wrapped = doc.splitTextToSize(`• ${op}`, 172);
      doc.text(wrapped, 18, oy);
      oy += wrapped.length * 5.5 + 5;
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(14, 274, 196, 274);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(r, g, b);
    doc.text(nomeMarca, 14, 281);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(contatoMarca || 'Diagnostico consultivo preparado para reuniao comercial', 14, 286);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 196, 281, { align: 'right' });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="RaioX_Fiscal_${cnpj}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Erro em POST /api/escritorio/raio-x-prospect:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao gerar Raio-X Fiscal do prospect.' }, { status: 500 });
  }
}
