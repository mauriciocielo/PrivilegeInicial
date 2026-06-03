import { NextResponse } from 'next/server';

export async function POST(request: Request) {
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

    const cleanPhone = String(phone).replace(/\D/g, '');
    const payload: Record<string, any> = {};

    if (whatsappApiUrl.includes('z-api') || whatsappApiUrl.includes('zapi')) {
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
      if (whatsappApiKey.startsWith('Bearer ')) {
        wsHeaders['Authorization'] = whatsappApiKey;
      } else {
        wsHeaders['Authorization'] = `Bearer ${whatsappApiKey}`;
        wsHeaders['apikey'] = whatsappApiKey;
        wsHeaders['X-API-KEY'] = whatsappApiKey;
      }
    }

    console.log(`[WhatsApp Sender] Enviando mensagem para ${cleanPhone} via ${whatsappApiUrl}...`);
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
    return NextResponse.json({ error: (error as Error).message || 'Erro interno' }, { status: 500 });
  }
}
