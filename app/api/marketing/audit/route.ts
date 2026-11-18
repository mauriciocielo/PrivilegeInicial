import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getComercialData, saveComercialSection } from '@/lib/comercial-store';

export const dynamic = 'force-dynamic';

async function fetchPublicPageSnippet(rawUrl?: string): Promise<string> {
  const url = String(rawUrl || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) return '';
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PrivilegeAuditBot/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return `Status HTTP ${res.status} ao acessar ${url}`;
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
    const textOnly = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2200);

    return [
      titleMatch?.[1] ? `Título: ${titleMatch[1].trim()}` : '',
      descMatch?.[1] ? `Meta Description: ${descMatch[1].trim()}` : '',
      textOnly ? `Conteúdo visível: ${textOnly}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  } catch (err: any) {
    return `Não foi possível ler diretamente (${err?.message || 'timeout'})`;
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const empresaId = body.empresaId || 'default';
    const empresaNome = body.empresaNome || 'Empresa';
    const links = body.links || {};

    const geminiKey =
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      '';

    if (!geminiKey || geminiKey.length < 20) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY não configurada no servidor.' },
        { status: 400 }
      );
    }

    const [siteSnippet, ecomSnippet] = await Promise.all([
      fetchPublicPageSnippet(links.site),
      fetchPublicPageSnippet(links.ecommerce),
    ]);

    const channelsList = [
      links.site ? `- Site Próprio: ${links.site}\n${siteSnippet ? `  [Dados extraídos do site]:\n  ${siteSnippet}` : ''}` : '',
      links.ecommerce ? `- E-commerce / Loja Virtual: ${links.ecommerce}\n${ecomSnippet ? `  [Dados extraídos do e-commerce]:\n  ${ecomSnippet}` : ''}` : '',
      links.instagram ? `- Instagram: ${links.instagram}` : '',
      links.facebook ? `- Facebook: ${links.facebook}` : '',
      links.google ? `- Google / Perfil da Empresa: ${links.google}` : '',
      links.linkedin ? `- LinkedIn: ${links.linkedin}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    if (!channelsList) {
      return NextResponse.json(
        { success: false, error: 'Informe pelo menos 1 link ou @ de canal para analisar.' },
        { status: 400 }
      );
    }

    const prompt = `Você é um Diretor Estratégico de Marketing 360º e Vendas Online da Privilege Consultoria.
Faça uma auditoria digital prática, objetiva e consultiva para a empresa "${empresaNome}" com base nos canais informados abaixo:

${channelsList}

Retorne APENAS um JSON válido (sem markdown \`\`\`json) com este formato exato:
{
  "score": 72,
  "resumoExecutivo": "Resumo direto de 2 a 3 linhas sobre a presença digital atual e principal oportunidade de caixa.",
  "icpSugerido": "Sugestão clara de ICP (Perfil de Cliente Ideal)",
  "bigIdeaSugerida": "Sugestão de Grande Promessa / Diferenciação",
  "gargalosPrincipais": "Principais gargalos identificados entre atração, site/e-commerce e conversão",
  "canais": [
    {
      "canal": "Site Próprio / E-commerce / Instagram / Facebook / Google / LinkedIn",
      "situacao": "Bom | Precisa Ajustes | Crítico",
      "pontosFortes": "O que está positivo ou potencial",
      "melhorias": "Ações práticas de conversão, SEO, copy, prova social e CTA"
    }
  ],
  "planoImediato": [
    "Ação prática 1 para os próximos 7 dias",
    "Ação prática 2",
    "Ação prática 3"
  ]
}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;

    const callGemini = async (withSearch: boolean) => {
      return fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          ...(withSearch ? { tools: [{ google_search: {} }] } : {}),
          generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
        }),
        signal: AbortSignal.timeout(25000),
      });
    };

    let res = await callGemini(true);
    if (!res.ok) {
      res = await callGemini(false);
    }
    if (!res.ok) {
      const errTxt = await res.text().catch(() => '');
      return NextResponse.json(
        { success: false, error: `Erro na API Gemini (${res.status}): ${errTxt.slice(0, 160)}` },
        { status: 500 }
      );
    }

    const json = await res.json();
    const rawText = String(json?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    let audit: any;
    try {
      audit = JSON.parse(cleaned);
    } catch {
      audit = {
        score: 70,
        resumoExecutivo: rawText.slice(0, 400),
        icpSugerido: '',
        bigIdeaSugerida: '',
        gargalosPrincipais: '',
        canais: [],
        planoImediato: [],
      };
    }

    audit.analyzedAt = new Date().toISOString();

    const current = await getComercialData(empresaId);
    const currentFluxo = current.mkt_fluxograma || {};
    await saveComercialSection(empresaId, 'mkt_fluxograma', {
      ...currentFluxo,
      links,
      aiAudit: audit,
    });

    return NextResponse.json({ success: true, audit });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
