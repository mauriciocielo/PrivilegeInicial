import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { acessoNegado } from '../../../../lib/nfse/servidor';

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
    if (auth.session.role === 'cliente') return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 });

    const url = new URL(request.url);
    const empresaId = url.searchParams.get('empresaId') || '';
    if (!empresaId) return NextResponse.json({ error: 'Informe a empresa.' }, { status: 400 });
    const negado = await acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    const mes = url.searchParams.get('mes') || '';
    const de = url.searchParams.get('de') || '';
    const ate = url.searchParams.get('ate') || '';
    const situacao = url.searchParams.get('situacao') || '';
    const busca = (url.searchParams.get('busca') || '').trim();
    const digitos = busca.replace(/\D/g, '');

    const dataEmissao: { gte?: string; lte?: string } = {};
    if (/^\d{4}-\d{2}$/.test(mes)) { dataEmissao.gte = `${mes}-01`; dataEmissao.lte = `${mes}-31`; }
    if (/^\d{4}-\d{2}-\d{2}$/.test(de)) dataEmissao.gte = de;
    if (/^\d{4}-\d{2}-\d{2}$/.test(ate)) dataEmissao.lte = ate;

    const [notas, monitor] = await Promise.all([
      db.nfeDestinada.findMany({
        where: {
          empresaId,
          ...(Object.keys(dataEmissao).length ? { dataEmissao } : {}),
          ...(['autorizada', 'denegada', 'cancelada'].includes(situacao) ? { situacao } : {}),
          ...(busca
            ? {
                OR: [
                  { emitenteNome: { contains: busca, mode: 'insensitive' as const } },
                  ...(digitos ? [{ emitenteCnpj: { contains: digitos } }, { chaveAcesso: { contains: digitos } }, { numero: digitos }] : []),
                ],
              }
            : {}),
        },
        select: colunas,
        orderBy: [{ dataEmissao: 'desc' }, { nsu: 'desc' }],
        take: LIMITE,
      }),
      db.nfeDistribuicao.findUnique({
        where: { empresaId },
        select: { ativo: true, apenasNoturno: true, ultimaConsultaEm: true, proximaConsultaEm: true, ultimoStatus: true, ultimaMensagem: true, ultNsu: true, maxNsu: true, certOrigem: true },
      }),
    ]);

    return NextResponse.json({ notas, monitor, limitado: notas.length >= LIMITE });
  } catch (error) {
    console.error('Erro em GET nfe/destinadas:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao listar as NF-e destinadas.' }, { status: 500 });
  }
}

