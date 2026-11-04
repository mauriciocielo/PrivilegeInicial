import { NextResponse } from 'next/server';
import db from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/api-auth';
import { captureError } from '../../../../../lib/sentry-helper';
import { acessoNegado } from '../../../../../lib/nfse/servidor';
import { filtroNotasDestinadas } from '../../../../../lib/nfe/filtro';
import { calcularDifalNota, ALIQUOTAS_INTERNAS_PADRAO } from '../../../../../lib/nfe/difal';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 });

    const url = new URL(request.url);
    const empresaId = url.searchParams.get('empresaId') || '';
    if (!empresaId) return NextResponse.json({ error: 'Informe a empresa.' }, { status: 400 });
    const negado = await acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    const empresa = await db.empresa.findUnique({
      where: { id: empresaId },
      select: { cnpj: true, razaoSocial: true, nfseConfig: { select: { codigoMunicipio: true } } },
    });
    if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });

    // Determina a UF padrão da empresa pelo código do município ou padrão PR
    const codMun = empresa.nfseConfig?.codigoMunicipio || '';
    const codUf = codMun.slice(0, 2);
    const ufPorCod: Record<string, string> = {
      '41': 'PR', '35': 'SP', '42': 'SC', '43': 'RS', '31': 'MG', '33': 'RJ', '32': 'ES',
    };
    const ufDestino = url.searchParams.get('ufDestino')?.toUpperCase() || ufPorCod[codUf] || 'PR';

    const where = filtroNotasDestinadas(empresaId, {
      mes: url.searchParams.get('mes'),
      de: url.searchParams.get('de'),
      ate: url.searchParams.get('ate'),
      situacao: 'autorizada',
      papel: 'recebidas',
      cnpjEmpresa: empresa.cnpj,
    });

    const notas = await db.nfeDestinada.findMany({
      where,
      select: {
        id: true,
        chaveAcesso: true,
        numero: true,
        serie: true,
        dataEmissao: true,
        emitenteNome: true,
        emitenteCnpj: true,
        valorNf: true,
        xml: true,
        possuiXml: true,
      },
      orderBy: [{ dataEmissao: 'desc' }, { numero: 'desc' }],
      take: 2000,
    });

    const todosItens = notas.map(n => calcularDifalNota(n, ufDestino));
    const apenasInterestaduais = url.searchParams.get('apenasInterestaduais') !== 'false';
    const itens = apenasInterestaduais ? todosItens.filter(i => i.isInterestadual) : todosItens;

    const totais = {
      totalNotas: itens.length,
      totalInterestaduais: todosItens.filter(i => i.isInterestadual).length,
      valorTotalNotas: itens.reduce((acc, i) => acc + i.valorTotalNf, 0),
      valorTotalProdutos: itens.reduce((acc, i) => acc + i.valorProdutos, 0),
      baseCalculoTotal: itens.reduce((acc, i) => acc + i.baseCalculoIcms, 0),
      difalTotalEstimado: itens.reduce((acc, i) => acc + i.valorDifalEstimado, 0),
    };

    const formato = url.searchParams.get('formato');
    if (formato === 'csv') {
      const cabecalho = 'Data;NF;Serie;Chave;Emitente;CNPJ Emitente;UF Origem;UF Destino;Valor Total;Base Calc ICMS;Aliq Interestadual (%);Aliq Interna (%);Diferencial (%);Valor DIFAL\n';
      const linhas = itens.map(i => [
        i.dataEmissao,
        i.numero,
        i.serie,
        i.chaveAcesso,
        `"${i.emitenteNome.replace(/"/g, '""')}"`,
        i.emitenteCnpj,
        i.ufOrigem,
        i.ufDestino,
        i.valorTotalNf.toFixed(2).replace('.', ','),
        i.baseCalculoIcms.toFixed(2).replace('.', ','),
        i.aliquotaInterestadual.toFixed(1).replace('.', ','),
        i.aliquotaInterna.toFixed(1).replace('.', ','),
        i.diferencialAliquota.toFixed(1).replace('.', ','),
        i.valorDifalEstimado.toFixed(2).replace('.', ','),
      ].join(';')).join('\n');

      return new NextResponse('\uFEFF' + cabecalho + linhas, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="relatorio-difal-${empresa.cnpj.replace(/\D/g, '')}.csv"`,
        },
      });
    }

    return NextResponse.json({
      empresa: { id: empresaId, cnpj: empresa.cnpj, razaoSocial: empresa.razaoSocial },
      ufDestino,
      aliquotaInternaPadrao: ALIQUOTAS_INTERNAS_PADRAO[ufDestino] || 19.5,
      totais,
      itens,
    });
  } catch (error) {
    console.error('Erro em GET nfe/destinadas/difal:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao gerar relatório do DIFAL.' }, { status: 500 });
  }
}

