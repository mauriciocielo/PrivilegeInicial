import { NextResponse } from 'next/server';
import db from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/api-auth';
import { captureError } from '../../../../../lib/sentry-helper';
import { acessoEmissaoNegado } from '../../../../../lib/nfse/servidor';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;
    const { id } = await params;

    const nota = await db.nfsE.findUnique({
      where: { id },
      select: { empresaId: true, chaveAcesso: true, documento: { select: { nfseXml: true } } },
    });
    if (!nota?.documento) return NextResponse.json({ error: 'XML não encontrado.' }, { status: 404 });
    const negado = await acessoEmissaoNegado(auth.session, nota.empresaId);
    if (negado) return negado;

    return new Response(nota.documento.nfseXml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="NFSe-${nota.chaveAcesso || id}.xml"`,
      },
    });
  } catch (error) {
    console.error('Erro em GET nfse/xml:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao baixar o XML.' }, { status: 500 });
  }
}
