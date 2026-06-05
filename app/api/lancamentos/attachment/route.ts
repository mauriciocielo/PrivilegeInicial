import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID do lançamento não fornecido' }, { status: 400 });
  }

  try {
    const lancamento = await db.lancamento.findUnique({
      where: { id },
      select: {
        attachmentName: true,
        attachmentData: true,
      },
    });

    if (!lancamento || !lancamento.attachmentData) {
      return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 });
    }

    let base64Data = lancamento.attachmentData;
    let contentType = 'application/octet-stream';

    // Se tiver prefixo data:...;base64,
    if (base64Data.startsWith('data:')) {
      const parts = base64Data.split(';base64,');
      if (parts.length === 2) {
        contentType = parts[0].substring(5);
        base64Data = parts[1];
      }
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const filename = lancamento.attachmentName || 'anexo';

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar anexo:', error);
    return NextResponse.json({ error: 'Erro interno ao buscar anexo' }, { status: 500 });
  }
}
