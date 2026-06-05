import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const type = searchParams.get('type'); // 'receber' | 'compras' | 'cobranca'

  if (!id || !type) {
    return NextResponse.json({ error: 'Parâmetros id e tipo são obrigatórios' }, { status: 400 });
  }

  try {
    let selectFields: Record<string, boolean> = {};
    if (type === 'receber') {
      selectFields = { politicaReceberName: true, politicaReceberData: true };
    } else if (type === 'compras') {
      selectFields = { politicaComprasName: true, politicaComprasData: true };
    } else if (type === 'cobranca') {
      selectFields = { politicaCobrancaName: true, politicaCobrancaData: true };
    } else {
      return NextResponse.json({ error: 'Tipo de política inválido' }, { status: 400 });
    }

    const empresa = await db.empresa.findUnique({
      where: { id },
      select: selectFields,
    }) as any;

    if (!empresa) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
    }

    let base64Data = '';
    let filename = '';

    if (type === 'receber') {
      base64Data = empresa.politicaReceberData;
      filename = empresa.politicaReceberName || 'politica_receber.pdf';
    } else if (type === 'compras') {
      base64Data = empresa.politicaComprasData;
      filename = empresa.politicaComprasName || 'politica_compras.pdf';
    } else if (type === 'cobranca') {
      base64Data = empresa.politicaCobrancaData;
      filename = empresa.politicaCobrancaName || 'politica_cobranca.pdf';
    }

    if (!base64Data) {
      return NextResponse.json({ error: 'Política não encontrada para esta empresa' }, { status: 404 });
    }

    let contentType = 'application/pdf';

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
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar política da empresa:', error);
    return NextResponse.json({ error: 'Erro interno ao buscar política' }, { status: 500 });
  }
}
