import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { acessoNegado } from '../../../../lib/nfse/servidor';
import { filtroNotasDestinadas } from '../../../../lib/nfe/filtro';

const colunas = {
  id: true, empresaId: true, chaveAcesso: true, numero: true, serie: true, emitenteCnpj: true, emitenteNome: true,
  dataEmissao: true, tipoOperacao: true, valorNf: true, situacao: true, manifestacao: true, possuiXml: true,
} as const;

const LIMITE = 1000;

/** Notas destinadas já gravadas para a empresa, com filtro de período, situação e busca. */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const empresaId = url.searchParams.get('empresaId') || '';
    if (!empresaId) return NextResponse.json({ error: 'Informe a empresa.' }, { status: 400 });
    const negado = await acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    const empresa = await db.empresa.findUnique({
      where: { id: empresaId },
      select: { cnpj: true, razaoSocial: true },
    });
    if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });

    const papel = url.searchParams.get('papel') || 'todas';
    const cnpjLimpo = empresa.cnpj.replace(/\D/g, '');

    const [notasBrutas, monitor, contagemEmitidas, contagemRecebidas] = await Promise.all([
      db.nfeDestinada.findMany({
        where: filtroNotasDestinadas(empresaId, {
          mes: url.searchParams.get('mes'),
          de: url.searchParams.get('de'),
          ate: url.searchParams.get('ate'),
          situacao: url.searchParams.get('situacao'),
          busca: url.searchParams.get('busca'),
          papel,
          cnpjEmpresa: empresa.cnpj,
        }),
        select: colunas,
        orderBy: [{ dataEmissao: 'desc' }, { nsu: 'desc' }],
        take: LIMITE,
      }),
      db.nfeDistribuicao.findUnique({
        where: { empresaId },
        select: { ativo: true, apenasNoturno: true, ultimaConsultaEm: true, proximaConsultaEm: true, ultimoStatus: true, ultimaMensagem: true, ultNsu: true, maxNsu: true, certOrigem: true },
      }),
      db.nfeDestinada.count({
        where: {
          empresaId,
          emitenteCnpj: { contains: cnpjLimpo },
        },
      }),
      db.nfeDestinada.count({
        where: {
          empresaId,
          NOT: { emitenteCnpj: { contains: cnpjLimpo } },
        },
      }),
    ]);

    const notas = notasBrutas.map(n => {
      const emitLimpo = (n.emitenteCnpj || '').replace(/\D/g, '');
      const ehEmitida = cnpjLimpo.length >= 8 && emitLimpo.includes(cnpjLimpo);
      return {
        ...n,
        papel: ehEmitida ? ('emitida' as const) : ('recebida' as const),
      };
    });

    const totais = {
      totalGeral: contagemEmitidas + contagemRecebidas,
      totalEmitidas: contagemEmitidas,
      totalRecebidas: contagemRecebidas,
    };

    return NextResponse.json({
      notas,
      totais,
      monitor,
      limitado: notas.length >= LIMITE,
      empresa: { cnpj: empresa.cnpj, razaoSocial: empresa.razaoSocial },
    });
  } catch (error) {
    console.error('Erro em GET nfe/destinadas:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao listar as NF-e destinadas.' }, { status: 500 });
  }
}

