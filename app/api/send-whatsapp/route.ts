import { NextResponse } from 'next/server';
import { captureError } from '../../../lib/sentry-helper';
import { requireAuth } from '../../../lib/api-auth';

export async function POST(request: Request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  try {
    const { phone, message } = await request.json();

    if (!phone || !message) {
      return NextResponse.json({ error: 'Telefone e mensagem são obrigatórios.' }, { status: 400 });
    }

    const whatsappApiUrl = process.env.WHATSAPP_API_URL;
    const whatsappApiKey = process.env.WHATSAPP_API_KEY;

    if (!whatsappApiUrl) {
      return NextResponse.json({
        success: false,
        error: 'WhatsApp API não está configurada no servidor (WHATSAPP_API_URL ausente).'
      }, { status: 500 });
    }

    let cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length >= 10 && cleanPhone.length <= 11 && !cleanPhone.startsWith('55')) {
      cleanPhone = '55' + cleanPhone;
    }
    const payload: Record<string, any> = {};

    const isMeta = whatsappApiUrl.includes('graph.facebook.com');

    if (isMeta || whatsappApiUrl.includes('zappfy')) {
      payload['messaging_product'] = 'whatsapp';
      payload['recipient_type'] = 'individual';
      payload['to'] = cleanPhone;
      payload['type'] = 'template';
      payload['template'] = {
        name: 'alerta_relatorio_diario',
        language: { code: 'pt_BR' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: message }
            ]
          }
        ]
      };
    } else if (whatsappApiUrl.includes('z-api') || whatsappApiUrl.includes('zapi')) {
      payload['phone'] = cleanPhone;
      payload['message'] = message;
    } else {
      payload['to'] = cleanPhone;
      payload['phone'] = cleanPhone;
      payload['number'] = cleanPhone;
      payload['message'] = message;
      payload['text'] = message;
    }

    const wsHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (whatsappApiKey) {
      if (whatsappApiKey.startsWith('Bearer ') || isMeta) {
        const token = whatsappApiKey.replace('Bearer ', '');
        wsHeaders['Authorization'] = `Bearer ${token}`;
      } else {
        wsHeaders['Authorization'] = `Bearer ${whatsappApiKey}`;
        wsHeaders['apikey'] = whatsappApiKey;
        wsHeaders['X-API-KEY'] = whatsappApiKey;
      }
    }

    console.log(`[WhatsApp Sender] Enviando mensagem para ${cleanPhone} via ${whatsappApiUrl}...`);
    // Bypass self-signed certs que são comuns em instâncias Evolution API/Z-API hospedadas em VPS
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    const wsRes = await fetch(whatsappApiUrl, {
      method: 'POST',
      headers: wsHeaders,
      body: JSON.stringify(payload)
    });

    if (wsRes.ok) {
      return NextResponse.json({ success: true, message: `Mensagem enviada com sucesso para ${cleanPhone}` });
    } else {
      const wsErrText = await wsRes.text();
      return NextResponse.json({
        success: false,
        error: `Erro retornado pela API do WhatsApp: Código ${wsRes.status}`,
        details: wsErrText
      }, { status: wsRes.status });
    }

  } catch (error) {
    console.error('Erro ao enviar mensagem de WhatsApp:', error);
    captureError(error);
    return NextResponse.json({ error: (error as Error).message || 'Erro interno' }, { status: 500 });
  }
}
