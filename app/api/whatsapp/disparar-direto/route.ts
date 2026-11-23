import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/api-auth';
import { apenasDigitos } from '../../../../lib/nfse/dps';
import { encontrarSessaoAdminPorNumero } from '../../../../lib/nfse/enviar-whatsapp-nfse';
import { buscarGrupoWhatsAppEmpresa } from '../../../../lib/agenda-lembretes';
import { listarSessoesBaileysAtivas, sendBaileysLiveMessage } from '../../../../lib/baileys-manager';
import { resolveWhatsAppOwnerId } from '../../../../lib/whatsapp-owner';
import { registrarDisparoWhatsApp } from '../../../../lib/whatsapp-disparos-log';

export const dynamic = 'force-dynamic';

/**
 * GET /api/whatsapp/disparar-direto?empresaId=...
 * Consulta se a empresa possui grupo de WhatsApp vinculado (sem expor mensagens nem outros grupos).
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const empresaId = (searchParams.get('empresaId') || '').trim();
    if (!empresaId) return NextResponse.json({ grupo: null });

    const grupo = await buscarGrupoWhatsAppEmpresa(empresaId);
    return NextResponse.json({
      grupo: grupo ? { groupJid: grupo.groupJid, groupName: grupo.groupName } : null,
    });
  } catch {
    return NextResponse.json({ grupo: null });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const telefoneRaw = typeof body?.telefone === 'string' ? body.telefone.trim() : '';
    const groupJidRaw = typeof body?.groupJid === 'string' ? body.groupJid.trim() : '';
    const empresaId = typeof body?.empresaId === 'string' ? body.empresaId.trim() : '';
    const usarGrupo = body?.usarGrupo === true;
    const mensagem = typeof body?.mensagem === 'string' ? body.mensagem.trim() : '';
    const pdfBase64 = typeof body?.pdfBase64 === 'string' ? body.pdfBase64.trim() : '';
    const pdfFileName = typeof body?.pdfFileName === 'string' && body.pdfFileName.trim()
      ? body.pdfFileName.trim()
      : 'relatorio-privilege.pdf';

    if (!mensagem && !pdfBase64) {
      return NextResponse.json({ error: 'Informe a mensagem ou o arquivo para envio.' }, { status: 400 });
    }

    let destino = '';
    let destinoNome = '';

    if (groupJidRaw.endsWith('@g.us')) {
      destino = groupJidRaw;
      destinoNome = typeof body?.groupName === 'string' ? body.groupName : 'Grupo do cliente';
    } else if (usarGrupo && empresaId) {
      const grupo = await buscarGrupoWhatsAppEmpresa(empresaId);
      if (!grupo?.groupJid) {
        return NextResponse.json({ error: 'Esta empresa não possui um grupo de WhatsApp vinculado.' }, { status: 400 });
      }
      destino = grupo.groupJid;
      destinoNome = grupo.groupName;
    } else {
      const digits = apenasDigitos(telefoneRaw);
      if (digits.length < 10) {
        return NextResponse.json({ error: 'Informe um número de WhatsApp válido com DDD.' }, { status: 400 });
      }
      destino = digits.startsWith('55') ? digits : `55${digits}`;
      destinoNome = telefoneRaw;
    }

    const ownerIdPreferencial = resolveWhatsAppOwnerId(request);
    const ownerId = await encontrarSessaoAdminPorNumero('46999800010', ownerIdPreferencial);
    if (!ownerId) {
      const ativas = listarSessoesBaileysAtivas().map(s => `${s.ownerId}:${s.connected ? 'on' : 'off'}`).join(', ');
      return NextResponse.json(
        { error: `WhatsApp não está conectado no servidor no momento (${ativas || '0 sessões em memória'}). Reconecte no painel WhatsApp.` },
        { status: 422 }
      );
    }

    const options = pdfBase64
      ? {
          mediaType: 'document' as const,
          mediaUrl: pdfBase64.startsWith('data:') ? pdfBase64 : `data:application/pdf;base64,${pdfBase64}`,
          fileName: pdfFileName.endsWith('.pdf') ? pdfFileName : `${pdfFileName}.pdf`,
          mimeType: 'application/pdf',
        }
      : undefined;

    const res = await sendBaileysLiveMessage(destino, mensagem, options, ownerId);
    await registrarDisparoWhatsApp({
      categoria: 'relatorio',
      destino,
      destinoNome,
      mensagem,
      status: res?.sent ? 'enviado' : 'erro',
      erro: res?.sent ? null : (res?.error || `sessão ${ownerId}`),
      ownerId,
    });
    if (!res?.sent) {
      return NextResponse.json(
        { error: `Não foi possível enviar no WhatsApp (${res?.error || `sessão ${ownerId}`}).` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      destino,
      destinoNome,
      isGrupo: destino.endsWith('@g.us'),
      ownerId,
    });
  } catch (error) {
    console.error('Erro em POST /api/whatsapp/disparar-direto:', error);
    return NextResponse.json({ error: 'Erro interno ao enviar no WhatsApp.' }, { status: 500 });
  }
}
