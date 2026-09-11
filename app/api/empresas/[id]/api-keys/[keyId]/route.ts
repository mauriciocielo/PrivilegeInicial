import { NextResponse } from 'next/server';
import db from '../../../../../../lib/prisma';
import { requireAuth } from '../../../../../../lib/api-auth';
import { captureError } from '../../../../../../lib/sentry-helper';

/** Revoga uma credencial — nunca apaga a linha, para manter o histórico de auditoria. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; keyId: string }> }) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;
    const { id: empresaId, keyId } = await params;

    if (auth.session.role !== 'administrador' && !auth.session.empresaIds.includes(empresaId)) {
      return NextResponse.json({ error: 'Sem acesso a esta empresa.' }, { status: 403 });
    }

    const chave = await db.apiKey.findFirst({ where: { id: keyId, empresaId } });
    if (!chave) return NextResponse.json({ error: 'Credencial não encontrada.' }, { status: 404 });

    await db.apiKey.update({ where: { id: keyId }, data: { ativo: false, revokedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao revogar chave de API:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao revogar a credencial.' }, { status: 500 });
  }
}
