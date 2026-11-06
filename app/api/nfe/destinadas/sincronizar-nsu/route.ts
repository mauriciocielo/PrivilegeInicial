import { NextResponse } from 'next/server';
import db from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/api-auth';
import { captureError } from '../../../../../lib/sentry-helper';
import { acessoNegado } from '../../../../../lib/nfse/servidor';
import { registrarLogFiscal } from '../../../../../lib/nfe/logger';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const empresaId = typeof body?.empresaId === 'string' ? body.empresaId : '';
    const novoNsuManual = typeof body?.novoNsu === 'string' ? body.novoNsu : null;

    if (!empresaId) {
      return NextResponse.json({ error: 'Informe a empresa.' }, { status: 400 });
    }

    const negado = await acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    const estado = await db.nfeDistribuicao.findUnique({
      where: { empresaId },
    });

    if (!estado) {
      return NextResponse.json({ error: 'Registro de monitoramento da empresa não encontrado.' }, { status: 404 });
    }

    // Define o novo NSU: ou o manual fornecido, ou o maxNsu conhecido da SEFAZ
    const alvoNsu = novoNsuManual ? novoNsuManual.padStart(15, '0') : (estado.maxNsu || estado.ultNsu);

    const atualizado = await db.nfeDistribuicao.update({
      where: { empresaId },
      data: {
        ultNsu: alvoNsu,
        ultimoStatus: '138',
        ultimaMensagem: `Ponteiro de NSU sincronizado manualmente para ${alvoNsu}.`,
      },
    });

    await registrarLogFiscal({
      empresaId,
      tipo: 'nfe',
      origem: 'manual',
      status: 'sucesso',
      cStat: '138',
      mensagem: `Ponteiro NSU sincronizado: avançado de ${estado.ultNsu} para ${alvoNsu} para resolver rejeição 656 de consumo indevido.`,
    });

    return NextResponse.json({
      sucesso: true,
      mensagem: `Ponteiro de NSU sincronizado com sucesso para ${alvoNsu}.`,
      ultNsuAnterior: estado.ultNsu,
      ultNsuAtual: atualizado.ultNsu,
      maxNsu: atualizado.maxNsu,
    });
  } catch (error) {
    console.error('Erro em POST /api/nfe/destinadas/sincronizar-nsu:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao sincronizar NSU da empresa.' }, { status: 500 });
  }
}

