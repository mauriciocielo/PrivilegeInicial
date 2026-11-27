import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import {
  ensureFinancasPessoaisTables,
  resolverChavesFinancasUsuario,
} from '../../../../lib/financas-pessoais';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financas-pessoais/comprovante?id=...
 * Faz download do documento fiscal (PDF ou imagem do recibo/nota) salvo na Pasta IRPF.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await ensureFinancasPessoaisTables();
    const { allKeys } = await resolverChavesFinancasUsuario(auth.session.userId);
    const url = new URL(request.url);
    const id = (url.searchParams.get('id') || '').trim();
    if (!id) return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 });

    const rows = await db.$queryRawUnsafe<Array<{ comprovante_data: string | null; comprovante_nome: string | null }>>(
      `SELECT comprovante_data, comprovante_nome
       FROM financas_pessoais_lancamentos
       WHERE id = $1 AND owner_key = ANY($2::text[])
       LIMIT 1`,
      id,
      allKeys
    );

    const reg = rows[0];
    if (!reg?.comprovante_data) {
      return NextResponse.json({ error: 'Nenhum documento fiscal anexado a este lançamento.' }, { status: 404 });
    }

    const m = /^data:([^;]+);base64,(.+)$/.exec(reg.comprovante_data);
    if (!m) {
      return NextResponse.json({ error: 'Formato de documento inválido.' }, { status: 422 });
    }

    const contentType = m[1];
    const buffer = Buffer.from(m[2], 'base64');
    const ext = contentType.includes('pdf') ? 'pdf' : contentType.includes('png') ? 'png' : 'jpg';
    const nome = (reg.comprovante_nome || `Documento_IRPF.${ext}`).replace(/[^a-zA-Z0-9._-]/g, '_');

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${nome}"`,
      },
    });
  } catch (error) {
    console.error('Erro em GET /api/financas-pessoais/comprovante:', error);
    return NextResponse.json({ error: 'Erro ao baixar documento fiscal.' }, { status: 500 });
  }
}
