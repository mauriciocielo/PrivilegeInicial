import { NextResponse } from 'next/server';
import db from '../../../lib/prisma';
import { captureError } from '../../../lib/sentry-helper';
import { requireAuth } from '../../../lib/api-auth';

export async function DELETE(req: Request) {
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID não fornecido' }, { status: 400 });
    }

    // Tenta deletar no banco
    const pc = await db.planoConta.findUnique({ where: { id } });
    if (pc) {
      if (auth.session.role !== 'administrador' && !auth.session.empresaIds.includes(pc.empresaId)) {
        return NextResponse.json({ error: 'Sem acesso a esta empresa.' }, { status: 403 });
      }
      await db.planoConta.delete({
        where: { id }
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Erro ao deletar Plano de Conta:', err);
    captureError(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
