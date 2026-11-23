import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/api-auth';
import {
  buscarDisparoWhatsAppPorId,
  listarDisparosWhatsApp,
  registrarDisparoWhatsApp,
  type CategoriaDisparo,
} from '../../../../lib/whatsapp-disparos-log';
import { encontrarSessaoAdminPorNumero } from '../../../../lib/nfse/enviar-whatsapp-nfse';
import { sendBaileysLiveMessage } from '../../../../lib/baileys-manager';
import { resolveWhatsAppOwnerId } from '../../../../lib/whatsapp-owner';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') {
      return NextResponse.json({ error: 'Acesso restrito a consultores e administradores.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') || 50);
    const logs = await listarDisparosWhatsApp(Number.isFinite(limit) ? limit : 50);
    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Erro em GET /api/agenda/logs:', error);
    return NextResponse.json({ error: 'Erro ao consultar histórico de disparos.' }, { status: 500 });
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
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!id) {
      return NextResponse.json({ error: 'Informe o ID do disparo para reenviar.' }, { status: 400 });
    }

    const original = await buscarDisparoWhatsAppPorId(id);
    if (!original) {
      return NextResponse.json({ error: 'Registro de disparo não encontrado.' }, { status: 404 });
    }

    const ownerIdPreferencial = resolveWhatsAppOwnerId(request);
    const ownerId = await encontrarSessaoAdminPorNumero('46999800010', ownerIdPreferencial);
    if (!ownerId) {
      return NextResponse.json(
        { error: 'WhatsApp não está conectado no servidor no momento. Reconecte no painel WhatsApp.' },
        { status: 422 }
      );
    }

    const res = await sendBaileysLiveMessage(original.destino, original.mensagem, undefined, ownerId);
    await registrarDisparoWhatsApp({
      categoria: (original.categoria as CategoriaDisparo) || 'agenda_criacao',
      destino: original.destino,
      destinoNome: original.destinoNome,
      mensagem: original.mensagem,
      status: res?.sent ? 'enviado' : 'erro',
      erro: res?.sent ? null : (res?.error || 'Falha ao reenviar'),
      ownerId,
    });

    if (!res?.sent) {
      return NextResponse.json(
        { error: `Falha ao reenviar no WhatsApp (${res?.error || 'erro desconhecido'}).` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, destinoNome: original.destinoNome });
  } catch (error) {
    console.error('Erro em POST /api/agenda/logs:', error);
    return NextResponse.json({ error: 'Erro ao reenviar disparo.' }, { status: 500 });
  }
}
