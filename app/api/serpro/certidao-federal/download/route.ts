import { NextResponse } from 'next/server';
import db from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/api-auth';
import { consultarCertidaoNegativaFederal, apenasDigitos } from '../../../../../lib/serpro/integra-contador';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const empresaId = url.searchParams.get('empresaId') || '';
    const cnpjParam = url.searchParams.get('cnpj') || '';

    let cnpj = apenasDigitos(cnpjParam);

    if (empresaId) {
      const empresa = await db.empresa.findUnique({
        where: { id: empresaId },
        select: { id: true, cnpj: true },
      });
      if (empresa) {
        cnpj = apenasDigitos(empresa.cnpj);
      }
    }

    if (!cnpj || cnpj.length !== 14) {
      return new NextResponse('CNPJ inválido.', { status: 400 });
    }

    const resultado = await consultarCertidaoNegativaFederal(cnpj);

    if (!resultado.sucesso || !resultado.pdfBase64) {
      return new NextResponse(resultado.mensagem || 'Não foi possível emitir a certidão.', { status: 422 });
    }

    const pdfBuffer = Buffer.from(resultado.pdfBase64, 'base64');

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="CND-Federal-${cnpj}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error('Erro em download certidao-federal:', error);
    return new NextResponse('Erro interno ao gerar o PDF da certidão.', { status: 500 });
  }
}
