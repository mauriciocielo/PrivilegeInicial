import { NextResponse } from 'next/server';
import db from '../../../lib/prisma';

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID não fornecido' }, { status: 400 });
    }

    // Tenta deletar no banco
    const pc = await db.planoConta.findUnique({ where: { id } });
    if (pc) {
      await db.planoConta.delete({
        where: { id }
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Erro ao deletar Plano de Conta:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
