import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/api-auth';
import { captureError } from '../../../../../lib/sentry-helper';
import { acessoNegado } from '../../../../../lib/nfse/servidor';
import { consultarNfeDestinadas } from '../../../../../lib/nfe/monitor';

export const maxDuration = 60;
const TEMPO_DA_CONSULTA_MS = 40_000;

/**
 * Consulta a SEFAZ agora, para uma empresa. Respeita a espera exigida pela SEFAZ:
 * se ainda não puder consultar, responde 200 com `executada: false` e o motivo.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const empresaId = typeof body?.empresaId === 'string' ? body.empresaId : '';
    if (!empresaId) return NextResponse.json({ error: 'Informe a empresa.' }, { status: 400 });
    const negado = await acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    return NextResponse.json(await consultarNfeDestinadas(empresaId, Date.now() + TEMPO_DA_CONSULTA_MS));
  } catch (error) {
    console.error('Erro em POST nfe/destinadas/consultar:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao consultar a SEFAZ.' }, { status: 500 });
  }
}

