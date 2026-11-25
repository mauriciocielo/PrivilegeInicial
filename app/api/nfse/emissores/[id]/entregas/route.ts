import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../../lib/api-auth';
import { acessoEmissaoNegado } from '../../../../../../lib/nfse/servidor';
import { listarEntregasEmpresa } from '../../../../../../lib/nfse/entregas-db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { id: empresaId } = await params;

    const negado = await acessoEmissaoNegado(auth.session, empresaId);
    if (negado) return negado;

    const entregas = await listarEntregasEmpresa(empresaId);
    return NextResponse.json({ entregas });
  } catch (error) {
    console.error('Erro em GET /api/nfse/emissores/[id]/entregas:', error);
    return NextResponse.json({ entregas: {} });
  }
}
