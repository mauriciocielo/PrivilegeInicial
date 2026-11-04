import { NextResponse } from 'next/server';
import db from '../../../../../../lib/prisma';
import { requireAuth } from '../../../../../../lib/api-auth';
import { captureError } from '../../../../../../lib/sentry-helper';
import { acessoEmissaoNegado } from '../../../../../../lib/nfse/servidor';
import { sincronizarSequenciaOficial } from '../../../../../../lib/nfse/sincronizar-adn';

/**
 * Consulta a sequência oficial (último número emitido e próximo número na base oficial)
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { id: empresaId } = await params;
    const negado = await acessoEmissaoNegado(auth.session, empresaId);
    if (negado) return negado;

    const resultado = await sincronizarSequenciaOficial(empresaId, false);
    return NextResponse.json(resultado);
  } catch (error) {
    console.error('Erro em GET sequencia oficial:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao consultar sequência oficial.' }, { status: 500 });
  }
}

/**
 * Sincroniza ativamente a sequência com a base oficial (ADN Nacional),
 * buscando as últimas notas emitidas e avançando o contador para o próximo número da sequência.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { id: empresaId } = await params;
    const negado = await acessoEmissaoNegado(auth.session, empresaId);
    if (negado) return negado;

    const resultado = await sincronizarSequenciaOficial(empresaId, true);
    return NextResponse.json(resultado);
  } catch (error: any) {
    console.error('Erro em POST sequencia oficial:', error);
    captureError(error);
    return NextResponse.json({ error: error?.message || 'Erro ao sincronizar sequência com a base oficial.' }, { status: 500 });
  }
}

