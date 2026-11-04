import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/api-auth';
import { captureError } from '../../../../../lib/sentry-helper';
import { acessoNegado } from '../../../../../lib/nfse/servidor';
import { MAX_NOTAS_POR_ENVIO, registrarCiencia } from '../../../../../lib/nfe/manifestacao';

export const maxDuration = 60;

/** Registra a Ciência da Operação das notas indicadas, em nome da empresa. */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const empresaId = typeof body?.empresaId === 'string' ? body.empresaId : '';
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((i: unknown) => typeof i === 'string') : [];
    if (!empresaId || ids.length === 0) return NextResponse.json({ error: 'Informe a empresa e as notas.' }, { status: 400 });
    if (ids.length > MAX_NOTAS_POR_ENVIO) {
      return NextResponse.json({ error: `Envie no máximo ${MAX_NOTAS_POR_ENVIO} notas por vez.` }, { status: 400 });
    }
    const negado = await acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    return NextResponse.json(await registrarCiencia(empresaId, ids, { userId: auth.session.userId, email: auth.session.email }));
  } catch (error) {
    // Tabela do histórico ausente: a migração não foi aplicada e nada saiu para a SEFAZ.
    if ((error as { code?: string })?.code === 'P2021') {
      return NextResponse.json({ error: 'A atualização do banco de dados para a manifestação ainda não foi aplicada. Nada foi enviado à SEFAZ.' }, { status: 503 });
    }
    console.error('Erro em POST nfe/destinadas/manifestar:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao registrar a manifestação.' }, { status: 500 });
  }
}
