import { NextResponse } from 'next/server';
import db from '../../../../../../lib/prisma';
import { requireAuth } from '../../../../../../lib/api-auth';
import { captureError } from '../../../../../../lib/sentry-helper';
import { acessoNegado } from '../../../../../../lib/nfse/servidor';

/** Baixa o XML completo (procNFe) da nota. Só existe depois que a SEFAZ o libera ao destinatário. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 });

    const { id } = await params;
    const nota = await db.nfeDestinada.findUnique({
      where: { id },
      select: { empresaId: true, chaveAcesso: true, possuiXml: true, xml: true },
    });
    if (!nota) return NextResponse.json({ error: 'Nota não encontrada.' }, { status: 404 });
    const negado = await acessoNegado(auth.session, nota.empresaId);
    if (negado) return negado;

    if (!nota.possuiXml || !nota.xml) {
      return NextResponse.json(
        { error: 'A SEFAZ ainda só entregou o resumo desta nota. O XML completo é liberado depois da Manifestação do Destinatário (ex.: Ciência da Operação).' },
        { status: 404 },
      );
    }

    return new Response(nota.xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="NFe-${nota.chaveAcesso}.xml"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Erro em GET nfe/destinadas/[id]/xml:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao baixar o XML.' }, { status: 500 });
  }
}

