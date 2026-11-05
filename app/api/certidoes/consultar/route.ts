import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { acessoNegado } from '../../../../lib/nfse/servidor';
import { processarCertidaoEmpresa } from '../../../../lib/certidoes/gerenciador-certidoes';

export const maxDuration = 60;

/**
 * Consulta uma empresa por chamada. O lote é feito pela tela, uma por vez: várias empresas
 * na mesma requisição não cabem no tempo da função, e a resposta se perderia no meio.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const empresaId = typeof body?.empresaId === 'string' ? body.empresaId : '';
    if (!empresaId) return NextResponse.json({ error: 'Selecione a empresa para consultar.' }, { status: 400 });

    const negado = await acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    return NextResponse.json({ sucesso: true, resultado: await processarCertidaoEmpresa(empresaId) });
  } catch (error) {
    console.error('Erro em POST /api/certidoes/consultar:', error);
    captureError(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao consultar a situação fiscal.' }, { status: 500 });
  }
}
