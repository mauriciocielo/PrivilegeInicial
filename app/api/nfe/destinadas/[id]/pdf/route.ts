import { NextResponse } from 'next/server';
import db from '../../../../../../lib/prisma';
import { requireAuth } from '../../../../../../lib/api-auth';
import { captureError } from '../../../../../../lib/sentry-helper';
import { acessoNegado } from '../../../../../../lib/nfse/servidor';
import { XmlNfeInvalidoError, gerarDanfePdf } from '../../../../../../lib/nfe/danfe';

/** Abre o DANFE da nota. Só existe depois que a SEFAZ libera o XML completo ao destinatário. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 });

    const { id } = await params;
    const nota = await db.nfeDestinada.findUnique({
      where: { id },
      select: { empresaId: true, chaveAcesso: true, situacao: true, possuiXml: true, xml: true },
    });
    if (!nota) return NextResponse.json({ error: 'Nota não encontrada.' }, { status: 404 });
    const negado = await acessoNegado(auth.session, nota.empresaId);
    if (negado) return negado;

    if (!nota.possuiXml || !nota.xml) {
      return NextResponse.json(
        { error: 'A SEFAZ ainda só entregou o resumo desta nota. O PDF depende do XML completo, liberado depois da Manifestação do Destinatário.' },
        { status: 404 },
      );
    }

    return new Response(new Uint8Array(gerarDanfePdf(nota.xml, nota.situacao)), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="DANFE-${nota.chaveAcesso}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    if (error instanceof XmlNfeInvalidoError) return NextResponse.json({ error: error.message }, { status: 422 });
    console.error('Erro em GET nfe/destinadas/[id]/pdf:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao gerar o PDF da nota.' }, { status: 500 });
  }
}
