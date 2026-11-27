import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import {
  ID_ESCRITORIO_PADRAO,
  obterEscritorioDoUsuario,
} from '../../../../lib/nfse/escritorios-terceiros';
import { ensureEscritorioRecursosTables } from '../../../../lib/escritorio-recursos';

export const dynamic = 'force-dynamic';

/**
 * GET /api/escritorio/auditoria?acao=...&busca=...
 * Retorna a trilha de auditoria das atividades da equipe do escritório (emissões, cancelamentos,
 * downloads de fechamento, gestão de auxiliares e envio de certificados).
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    if (auth.session.role === 'cliente') {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    await ensureEscritorioRecursosTables();
    const vinculo = await obterEscritorioDoUsuario(auth.session.userId);
    const escritorioId = vinculo?.escritorioId || ID_ESCRITORIO_PADRAO;

    const url = new URL(request.url);
    const acao = (url.searchParams.get('acao') || '').trim();
    const busca = (url.searchParams.get('busca') || '').trim().toLowerCase();

    const rows = acao
      ? await db.$queryRawUnsafe<any[]>(
          `SELECT * FROM escritorio_auditoria
           WHERE escritorio_id = $1 AND acao = $2
           ORDER BY created_at DESC
           LIMIT 200`,
          escritorioId,
          acao
        )
      : await db.$queryRawUnsafe<any[]>(
          `SELECT * FROM escritorio_auditoria
           WHERE escritorio_id = $1
           ORDER BY created_at DESC
           LIMIT 200`,
          escritorioId
        );

    let eventos = rows.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      userNome: String(r.user_nome || ''),
      userEmail: String(r.user_email || ''),
      acao: String(r.acao || ''),
      empresaId: r.empresa_id || null,
      empresaNome: r.empresa_nome || null,
      detalhes: String(r.detalhes || ''),
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));

    if (busca) {
      eventos = eventos.filter(
        (e) =>
          e.userNome.toLowerCase().includes(busca) ||
          e.userEmail.toLowerCase().includes(busca) ||
          (e.empresaNome || '').toLowerCase().includes(busca) ||
          e.detalhes.toLowerCase().includes(busca)
      );
    }

    return NextResponse.json({ eventos });
  } catch (error) {
    console.error('Erro em GET /api/escritorio/auditoria:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao carregar trilha de auditoria.' }, { status: 500 });
  }
}
