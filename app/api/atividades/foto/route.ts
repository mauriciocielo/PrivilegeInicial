import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const tipo = searchParams.get('tipo');

  if (!id || !['inicio', 'fim'].includes(tipo || '')) {
    return NextResponse.json({ error: 'ID ou tipo de foto não fornecido' }, { status: 400 });
  }

  try {
    const atividade = await db.atividade.findUnique({
      where: { id },
      select: {
        fotoInicio: true,
        fotoFim: true,
      },
    });

    const fotoData = tipo === 'inicio' ? atividade?.fotoInicio : atividade?.fotoFim;

    if (!atividade || !fotoData || fotoData === '__PRUNED_IN_LOCAL_STAGE__') {
      return NextResponse.json({ error: 'Foto não encontrada' }, { status: 404 });
    }

    let base64Data = fotoData;
    let contentType = 'image/jpeg'; // padrão se não tiver prefixo.

    // Se tiver prefixo data:...;base64,
    if (base64Data.startsWith('data:')) {
      const parts = base64Data.split(';base64,');
      if (parts.length === 2) {
        contentType = parts[0].substring(5);
        base64Data = parts[1];
      }
    }

    const buffer = Buffer.from(base64Data, 'base64');

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar foto da atividade:', error);
    return NextResponse.json({ error: 'Erro interno ao buscar foto' }, { status: 500 });
  }
}
