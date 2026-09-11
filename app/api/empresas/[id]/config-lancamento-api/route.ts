import { NextResponse } from 'next/server';
import db from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/api-auth';
import { captureError } from '../../../../../lib/sentry-helper';

/**
 * Plano de conta e portador padrão usados para gerar o lançamento-espelho
 * (ver lib/lancamento-espelho-api.ts) sempre que um título chega pela API v1
 * (CP/CR). Sem isso configurado, o título fica só no livro-razão imutável e
 * não aparece em Contas a Receber/Pagar nem entra no fluxo de baixa/OFX.
 *
 * Reaproveita Empresa.osPlanoContaPadraoId/osPortadorPadraoId — campos já
 * existentes no schema (criados pela integração "OS Oficina" de outra sessão
 * para o mesmo propósito: dar destino contábil padrão a lançamentos gerados
 * por API), em vez de duplicar a configuração.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;
    const { id: empresaId } = await params;

    if (auth.session.role !== 'administrador' && !auth.session.empresaIds.includes(empresaId)) {
      return NextResponse.json({ error: 'Sem acesso a esta empresa.' }, { status: 403 });
    }

    const empresa = await db.empresa.findUnique({
      where: { id: empresaId },
      select: { osPlanoContaPadraoId: true, osPortadorPadraoId: true },
    });
    if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });

    return NextResponse.json({
      planoContaId: empresa.osPlanoContaPadraoId,
      portadorId: empresa.osPortadorPadraoId,
    });
  } catch (error) {
    console.error('Erro em GET config-lancamento-api:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao carregar a configuração.' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;
    const { id: empresaId } = await params;

    if (auth.session.role !== 'administrador' && !auth.session.empresaIds.includes(empresaId)) {
      return NextResponse.json({ error: 'Sem acesso a esta empresa.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const planoContaId = typeof body?.planoContaId === 'string' && body.planoContaId ? body.planoContaId : null;
    const portadorId = typeof body?.portadorId === 'string' && body.portadorId ? body.portadorId : null;

    if (planoContaId) {
      const pc = await db.planoConta.findFirst({ where: { id: planoContaId, empresaId } });
      if (!pc) return NextResponse.json({ error: 'Plano de conta não pertence a esta empresa.' }, { status: 422 });
    }
    if (portadorId) {
      const port = await db.portador.findFirst({ where: { id: portadorId, empresaId } });
      if (!port) return NextResponse.json({ error: 'Portador não pertence a esta empresa.' }, { status: 422 });
    }

    await db.empresa.update({
      where: { id: empresaId },
      data: { osPlanoContaPadraoId: planoContaId, osPortadorPadraoId: portadorId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro em PUT config-lancamento-api:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao salvar a configuração.' }, { status: 500 });
  }
}
