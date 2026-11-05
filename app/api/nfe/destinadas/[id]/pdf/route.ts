import { NextResponse } from 'next/server';
import db from '../../../../../../lib/prisma';
import { requireAuth } from '../../../../../../lib/api-auth';
import { captureError } from '../../../../../../lib/sentry-helper';
import { acessoNegado } from '../../../../../../lib/nfse/servidor';
import { XmlNfeInvalidoError, gerarDanfePdf } from '../../../../../../lib/nfe/danfe';
import { XmlCteInvalidoError, gerarDactePdf } from '../../../../../../lib/cte/dacte';

/** Modelo do documento pela chave de 44 dígitos (posições 20-21): 55=NF-e, 57=CT-e, 65=NFC-e. */
const modeloDaChave = (chave: string) => (/^\d{44}$/.test(chave) ? chave.slice(20, 22) : '');

/** Abre o DANFE da nota. Só existe depois que a SEFAZ libera o XML completo ao destinatário. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

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
        { error: 'A SEFAZ ainda só entregou o resumo deste documento. O PDF depende do XML completo, liberado depois da Manifestação do Destinatário.' },
        { status: 404 },
      );
    }

    // CT-e (modelo 57) tem layout próprio (DACTE); os demais usam o DANFE da NF-e.
    const ehCte = modeloDaChave(nota.chaveAcesso) === '57';
    const pdf = ehCte ? gerarDactePdf(nota.xml, nota.situacao) : gerarDanfePdf(nota.xml, nota.situacao);
    const prefixo = ehCte ? 'DACTE' : 'DANFE';

    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${prefixo}-${nota.chaveAcesso}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    if (error instanceof XmlNfeInvalidoError || error instanceof XmlCteInvalidoError) return NextResponse.json({ error: error.message }, { status: 422 });
    console.error('Erro em GET nfe/destinadas/[id]/pdf:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao gerar o PDF da nota.' }, { status: 500 });
  }
}
