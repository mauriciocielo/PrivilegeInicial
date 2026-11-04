import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { acessoNegado } from '../../../../lib/nfse/servidor';
import { ehAnexoManual } from '../../../../lib/certidoes/situacao';

/** Remove uma certidão anexada por engano. Consultas do SERPRO e registros antigos não saem por aqui. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    const certidao = await db.certidaoFiscal.findUnique({ where: { id }, select: { empresaId: true, tipo: true, pendencias: true } });
    if (!certidao) return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });

    const negado = await acessoNegado(auth.session, certidao.empresaId);
    if (negado) return negado;

    // Só o que foi anexado sai por aqui. Consultas do SITFIS e registros antigos ficam protegidos.
    if (!ehAnexoManual(certidao.pendencias)) {
      return NextResponse.json({ error: 'Só certidões anexadas podem ser removidas.' }, { status: 409 });
    }
    await db.certidaoFiscal.delete({ where: { id } });
    return NextResponse.json({ sucesso: true });
  } catch (error) {
    console.error('Erro em DELETE /api/certidoes/[id]:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao remover a certidão.' }, { status: 500 });
  }
}
