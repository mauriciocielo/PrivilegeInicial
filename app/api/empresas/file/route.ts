import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { captureError } from '../../../../lib/sentry-helper';
import { requireAuth } from '../../../../lib/api-auth';

export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const type = searchParams.get('type');

  if (!id || !['logo', 'politicaReceber', 'politicaCompras', 'politicaCobranca'].includes(type || '')) {
    return NextResponse.json({ error: 'ID ou tipo de arquivo inválido/ausente' }, { status: 400 });
  }

  try {
    const empresa = await db.empresa.findUnique({
      where: { id },
      select: {
        logoData: true,
        politicaReceberData: true,
        politicaComprasData: true,
        politicaCobrancaData: true,
      },
    });

    if (!empresa) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
    }

    let fileData: string | null = null;
    if (type === 'logo') fileData = empresa.logoData;
    else if (type === 'politicaReceber') fileData = empresa.politicaReceberData;
    else if (type === 'politicaCompras') fileData = empresa.politicaComprasData;
    else if (type === 'politicaCobranca') fileData = empresa.politicaCobrancaData;

    if (!fileData || fileData === '__PRUNED_IN_LOCAL_STAGE__') {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
    }

    let base64Data = fileData;
    let contentType = 'application/octet-stream';

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
    console.error('Erro ao buscar arquivo da empresa:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro interno ao buscar arquivo' }, { status: 500 });
  }
}
