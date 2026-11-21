import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/api-auth';
import { apenasDigitos } from '../../../../lib/nfse/dps';
import { encontrarSessaoAdminPorNumero } from '../../../../lib/nfse/enviar-whatsapp-nfse';
import { sendBaileysLiveMessage } from '../../../../lib/baileys-manager';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const telefoneRaw = typeof body?.telefone === 'string' ? body.telefone.trim() : '';
    const mensagem = typeof body?.mensagem === 'string' ? body.mensagem.trim() : '';
    const pdfBase64 = typeof body?.pdfBase64 === 'string' ? body.pdfBase64.trim() : '';
    const pdfFileName = typeof body?.pdfFileName === 'string' && body.pdfFileName.trim()
      ? body.pdfFileName.trim()
      : 'relatorio-privilege.pdf';

    const digits = apenasDigitos(telefoneRaw);
    if (digits.length < 10) {
      return NextResponse.json({ error: 'Informe um número de WhatsApp válido com DDD.' }, { status: 400 });
    }
    if (!mensagem && !pdfBase64) {
      return NextResponse.json({ error: 'Informe a mensagem ou o arquivo para envio.' }, { status: 400 });
    }

    const telefone = digits.startsWith('55') ? digits : `55${digits}`;
    const ownerId = await encontrarSessaoAdminPorNumero('46999800010');
    if (!ownerId) {
      return NextResponse.json(
        { error: 'WhatsApp (46) 99980-0010 não está conectado no servidor no momento.' },
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

    const res = await sendBaileysLiveMessage(telefone, mensagem, options, ownerId);
    if (!res?.sent) {
      return NextResponse.json({ error: 'Não foi possível enviar no WhatsApp.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, telefone, ownerId });
  } catch (error) {
    console.error('Erro em POST /api/whatsapp/disparar-direto:', error);
    return NextResponse.json({ error: 'Erro interno ao enviar no WhatsApp.' }, { status: 500 });
  }
}
