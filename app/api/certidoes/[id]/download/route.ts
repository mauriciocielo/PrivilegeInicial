import { NextResponse } from 'next/server';
import db from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/api-auth';
import { captureError } from '../../../../../lib/sentry-helper';
import { acessoNegado } from '../../../../../lib/nfse/servidor';
import { ehAnexoManual } from '../../../../../lib/certidoes/situacao';

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
      include: { empresa: { select: { cnpj: true } } },
    });
    if (!certidao) return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });

    const negado = await acessoNegado(auth.session, certidao.empresaId);
    if (negado) return negado;

    // Estadual sem a marca de anexo foi gerado pelo sistema, sem consulta à SEFAZ: não é certidão válida.
    if (certidao.tipo === 'ESTADUAL' && !ehAnexoManual(certidao.pendencias)) {
      return NextResponse.json({ error: 'Este documento não veio de uma consulta à SEFAZ e não tem validade. Emita a certidão no portal da SEFAZ.' }, { status: 410 });
    }
    if (!certidao.pdfBase64) return NextResponse.json({ error: 'Esta consulta não gerou PDF.' }, { status: 404 });

    const pdfBuffer = Buffer.from(certidao.pdfBase64, 'base64');
    const nomeArquivo = `Situacao-Fiscal-${certidao.tipo}_${certidao.empresa.cnpj.replace(/\D/g, '')}_${certidao.id.slice(0, 8)}.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${nomeArquivo}"`,
        'Content-Length': String(pdfBuffer.length),
        // Dado fiscal de cliente: nenhum cache compartilhado pode guardar este arquivo.
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Erro em download de certidão:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao baixar o documento PDF.' }, { status: 500 });
  }
}
