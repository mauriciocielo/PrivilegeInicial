import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID do usuário não fornecido' }, { status: 400 });
  }

  try {
    const user = await db.user.findUnique({
      where: { id },
      select: {
        avatarData: true,
      },
    });

    if (!user || !user.avatarData || user.avatarData === '__PRUNED_IN_LOCAL_STAGE__') {
      return NextResponse.json({ error: 'Avatar não encontrado' }, { status: 404 });
    }

    let base64Data = user.avatarData;
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
    console.error('Erro ao buscar avatar do usuário:', error);
    return NextResponse.json({ error: 'Erro interno ao buscar avatar' }, { status: 500 });
  }
}
