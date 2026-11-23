import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { ensureAgendaGruposTables } from '../../../../lib/agenda-lembretes';
import { encontrarSessaoAdminPorNumero } from '../../../../lib/nfse/enviar-whatsapp-nfse';
import { listarGruposBaileys } from '../../../../lib/baileys-manager';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') {
      return NextResponse.json({ error: 'Acesso restrito a consultores e administradores.' }, { status: 403 });
    }

    await ensureAgendaGruposTables();

    const vinculosRows = await db.$queryRawUnsafe<
      Array<{ empresa_id: string; group_jid: string; group_name: string | null; notificar_agenda: boolean }>
    >(`SELECT empresa_id, group_jid, group_name, notificar_agenda FROM empresa_whatsapp_grupos`);

    const vinculos = vinculosRows.map(r => ({
      empresaId: r.empresa_id,
      groupJid: r.group_jid,
      groupName: r.group_name || r.group_jid,
      notificarAgenda: r.notificar_agenda !== false,
    }));

    const { searchParams } = new URL(request.url);
    const listarAoVivo = searchParams.get('live') !== '0';

    let gruposWhatsApp: Array<{ jid: string; nome: string; participantes: number }> = [];
    let sessaoConectada = false;

    if (listarAoVivo) {
      const ownerId = await encontrarSessaoAdminPorNumero('46999800010');
      if (ownerId) {
        sessaoConectada = true;
        gruposWhatsApp = await listarGruposBaileys(ownerId);
      }
    }

    return NextResponse.json({
      sessaoConectada,
      gruposWhatsApp,
      vinculos,
    });
  } catch (error) {
    console.error('Erro em GET /api/agenda/grupos:', error);
    return NextResponse.json({ error: 'Erro ao consultar grupos do WhatsApp.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const empresaId = typeof body?.empresaId === 'string' ? body.empresaId.trim() : '';
    const groupJid = typeof body?.groupJid === 'string' ? body.groupJid.trim() : '';
    const groupName = typeof body?.groupName === 'string' ? body.groupName.trim() : '';
    const notificarAgenda = body?.notificarAgenda !== false;

    if (!empresaId || !groupJid.endsWith('@g.us')) {
      return NextResponse.json({ error: 'Selecione uma empresa e um grupo válido do WhatsApp.' }, { status: 400 });
    }

    await ensureAgendaGruposTables();
    await db.$executeRawUnsafe(
      `INSERT INTO empresa_whatsapp_grupos (empresa_id, group_jid, group_name, notificar_agenda, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (empresa_id) DO UPDATE SET
         group_jid = EXCLUDED.group_jid,
         group_name = EXCLUDED.group_name,
         notificar_agenda = EXCLUDED.notificar_agenda,
         updated_at = NOW()`,
      empresaId,
      groupJid,
      groupName || groupJid,
      notificarAgenda
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro em POST /api/agenda/grupos:', error);
    return NextResponse.json({ error: 'Erro ao salvar vínculo de grupo.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const empresaId = (searchParams.get('empresaId') || '').trim();
    if (!empresaId) return NextResponse.json({ error: 'Informe empresaId.' }, { status: 400 });

    await ensureAgendaGruposTables();
    await db.$executeRawUnsafe(`DELETE FROM empresa_whatsapp_grupos WHERE empresa_id = $1`, empresaId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro em DELETE /api/agenda/grupos:', error);
    return NextResponse.json({ error: 'Erro ao remover vínculo.' }, { status: 500 });
  }
}
