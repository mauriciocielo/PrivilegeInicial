import { NextRequest, NextResponse } from 'next/server';
import { createAgendaTaskFromDemand } from '@/lib/whatsapp-agenda';
import { getSessionFromRequest } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    const body = await req.json();
    const title = String(body.title || '').trim();
    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Título da tarefa é obrigatório' },
        { status: 400 }
      );
    }

    const task = await createAgendaTaskFromDemand({
      title,
      clienteParticipante: body.clienteParticipante,
      dateStr: body.dateStr,
      horario: body.horario,
      empresaId: body.empresaId,
      consultorId: body.consultorId || session?.userId,
      location: body.location || 'WhatsApp',
    });

    return NextResponse.json({ success: true, task });
  } catch (error: any) {
    console.error('[WhatsApp Agenda] Erro ao criar tarefa:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao criar tarefa na agenda' },
      { status: 500 }
    );
  }
}
