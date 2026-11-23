import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/api-auth';
import { apenasDigitos } from '../../../../lib/nfse/dps';
import { encontrarSessaoAdminPorNumero } from '../../../../lib/nfse/enviar-whatsapp-nfse';
import { buscarGrupoWhatsAppEmpresa } from '../../../../lib/agenda-lembretes';
import { sendBaileysLiveMessage } from '../../../../lib/baileys-manager';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const telefoneRaw = typeof body?.telefone === 'string' ? body.telefone.trim() : '';
    const groupJidRaw = typeof body?.groupJid === 'string' ? body.groupJid.trim() : '';
    const empresaId = typeof body?.empresaId === 'string' ? body.empresaId.trim() : '';
    const mensagem = typeof body?.mensagem === 'string' ? body.mensagem.trim() : '';

    if (!mensagem) {
      return NextResponse.json({ error: 'Mensagem da agenda vazia.' }, { status: 400 });
    }

    let destino = '';
    let destinoNome = '';

    // 1. Se veio groupJid direto ou empresaId com grupo vinculado, envia no grupo do cliente
    if (groupJidRaw.endsWith('@g.us')) {
      destino = groupJidRaw;
      destinoNome = typeof body?.groupName === 'string' ? body.groupName : 'Grupo do cliente';
    } else if (empresaId) {
      const grupo = await buscarGrupoWhatsAppEmpresa(empresaId);
      if (grupo?.groupJid && grupo.notificarAgenda) {
        destino = grupo.groupJid;
        destinoNome = grupo.groupName;
      }
    }

    // 2. Fallback para telefone individual
    if (!destino) {
      const digits = apenasDigitos(telefoneRaw);
      if (digits.length < 10) {
        return NextResponse.json(
          { error: 'Nenhum grupo vinculado à empresa e nenhum WhatsApp válido informado.' },
          { status: 400 }
        );
      }
      destino = digits.startsWith('55') ? digits : `55${digits}`;
      destinoNome = telefoneRaw;
    }

    const ownerId = await encontrarSessaoAdminPorNumero('46999800010');
    if (!ownerId) {
      return NextResponse.json(
        { error: 'WhatsApp (46) 99980-0010 não está conectado no servidor no momento.' },
        { status: 422 }
      );
    }

    const res = await sendBaileysLiveMessage(destino, mensagem, undefined, ownerId);
    if (!res?.sent) {
      return NextResponse.json({ error: 'Não foi possível entregar a mensagem no WhatsApp.' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      destino,
      destinoNome,
      isGrupo: destino.endsWith('@g.us'),
      ownerId,
    });
  } catch (error) {
    console.error('Erro em POST /api/agenda/enviar-whatsapp:', error);
    return NextResponse.json({ error: 'Erro interno ao enviar agenda no WhatsApp.' }, { status: 500 });
  }
}
