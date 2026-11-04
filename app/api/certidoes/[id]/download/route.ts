import { NextResponse } from 'next/server';
import db from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/api-auth';
import { captureError } from '../../../../../lib/sentry-helper';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    const certidao = await db.certidaoFiscal.findUnique({
      where: { id },
      include: { empresa: { select: { razaoSocial: true, cnpj: true } } },
    });

    if (!certidao) {
      return NextResponse.json({ error: 'Certidão não encontrada.' }, { status: 404 });
    }

    if (auth.session.role !== 'administrador' && !auth.session.empresaIds.includes(certidao.empresaId)) {
      return NextResponse.json({ error: 'Sem acesso a esta certidão.' }, { status: 403 });
    }

    if (!certidao.pdfBase64) {
      return NextResponse.json({ error: 'Documento PDF não disponível para esta certidão.' }, { status: 404 });
    }

    const pdfBuffer = Buffer.from(certidao.pdfBase64, 'base64');
    const nomeArquivo = `CND_${certidao.tipo}_${certidao.empresa.cnpj.replace(/\D/g, '')}_${certidao.id.slice(0, 8)}.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${nomeArquivo}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Erro em download de certidão:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao baixar o documento PDF.' }, { status: 500 });
  }
}

