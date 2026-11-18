import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppConfig } from '@/lib/whatsapp-service';
import { generateText } from '@/lib/ai-provider';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history = [], pageTitle = '', pageUrl = '', pageContext = '', provider = 'auto' } = body;

    if (!message || !String(message).trim()) {
      return NextResponse.json({ success: false, error: 'Mensagem obrigatória' }, { status: 400, headers: CORS_HEADERS });
    }

    const cfg = await getWhatsAppConfig('default').catch(() => null);

    const systemInstruction = `Você é o "Privilege AI Assistant", assistente inteligente incorporado ao site e plataforma da Privilege Contabilidade e Consultoria 360º (Francisco Beltrão - PR e atendimento online em todo o Brasil).
Atuamos nos 6 pilares: Planejamento Estratégico 2027, Contábil/Tributário, Financeiro/BPO, Comercial, Marketing e Gestão de Pessoas/Treinamentos.
${pageTitle || pageUrl ? `Página atual do usuário: ${pageTitle} (${pageUrl})` : ''}
${pageContext ? `Conteúdo visível na página:\n${String(pageContext).slice(0, 2500)}` : ''}

Responda de forma executiva, clara, objetiva e consultiva em português do Brasil (Markdown curto).`;

    const ai = await generateText({
      system: systemInstruction,
      messages: [
        ...history.slice(-8).map((h: any) => ({
          role: (h.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: String(h.text || h.content || ''),
        })),
        { role: 'user' as const, content: String(message) },
      ],
      maxTokens: 1200,
      temperature: 0.4,
      preferred: provider,
      configs: [cfg],
      timeoutMs: 20000,
    });

    if (ai.text) {
      return NextResponse.json({ success: true, reply: ai.text, provider: ai.provider }, { headers: CORS_HEADERS });
    }

    return NextResponse.json(
      { success: false, error: ai.error || 'Nenhum provedor de IA disponível no momento.' },
      { status: 503, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Erro interno' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
