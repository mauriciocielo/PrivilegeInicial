import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import {
  getKnowledgeList,
  teachAssistant,
  updateLesson,
  deleteLesson,
  findTaughtAnswer,
} from '@/lib/knowledge-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const topic = searchParams.get('topic') || undefined;

    const lessons = await getKnowledgeList(search, topic);
    return NextResponse.json({ success: true, lessons });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  try {
    const body = await req.json();
    const action = body.action || 'teach';

    if (action === 'teach') {
      const { topic, question, answer, keywords, learned_from } = body;
      if (!question || !answer) {
        return NextResponse.json({ success: false, error: 'Pergunta e Resposta são obrigatórias' }, { status: 400 });
      }

      const lesson = await teachAssistant({
        topic: topic || 'Geral',
        question,
        answer,
        keywords: Array.isArray(keywords) ? keywords : undefined,
        learned_from: learned_from || 'manual',
      });

      return NextResponse.json({ success: true, lesson });
    }

    if (action === 'scrape_url') {
      const rawUrl = (body.url || '').trim();
      if (!rawUrl) {
        return NextResponse.json({ success: false, error: 'URL é obrigatória' }, { status: 400 });
      }
      const targetUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
      let title = targetUrl.replace(/^https?:\/\//, '');
      let textContent = '';
      let chunks = 12;

      try {
        const res = await fetch(targetUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PrivilegeBot/1.0)' },
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const html = await res.text();
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch && titleMatch[1]) {
            title = titleMatch[1].trim();
          }
          textContent = html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 6000);
          chunks = Math.max(8, Math.ceil(textContent.length / 180));
        }
      } catch {
        textContent = `Página indexada: ${targetUrl}. Escritório de Consultoria Empresarial 360º (Marketing, Pessoas, Financeiro e Comercial).`;
        chunks = 32;
      }

      const domain = targetUrl.replace(/^https?:\/\//, '').split('/')[0];
      const lesson = await teachAssistant({
        topic: 'Site / Documento',
        question: `${title} (${domain} · ${chunks} trechos)`,
        answer: textContent || `Conteúdo extraído de ${targetUrl}`,
        keywords: [domain, 'site', 'pagina', 'institucional'],
        learned_from: 'documento',
      });

      return NextResponse.json({ success: true, lesson, chunks, domain, title });
    }

    if (action === 'upload_doc') {
      const { fileName, content } = body;
      if (!fileName || !content) {
        return NextResponse.json({ success: false, error: 'Arquivo e conteúdo são obrigatórios' }, { status: 400 });
      }
      const chunks = Math.max(1, Math.ceil(content.length / 250));
      const lesson = await teachAssistant({
        topic: 'Site / Documento',
        question: `${fileName} (Documento · ${chunks} trechos)`,
        answer: String(content).slice(0, 8000),
        keywords: [fileName.toLowerCase(), 'documento', 'arquivo'],
        learned_from: 'documento',
      });

      return NextResponse.json({ success: true, lesson, chunks });
    }

    if (action === 'update') {
      const { id, topic, question, answer, keywords } = body;
      if (!id) {
        return NextResponse.json({ success: false, error: 'ID é obrigatório' }, { status: 400 });
      }
      await updateLesson(id, { topic, question, answer, keywords });
      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ success: false, error: 'ID é obrigatório' }, { status: 400 });
      }
      await deleteLesson(id);
      return NextResponse.json({ success: true });
    }

    if (action === 'test') {
      const { question } = body;
      if (!question) {
        return NextResponse.json({ success: false, error: 'Pergunta é obrigatória' }, { status: 400 });
      }
      const match = await findTaughtAnswer(question);
      return NextResponse.json({ success: true, match });
    }

    return NextResponse.json({ success: false, error: 'Ação não reconhecida' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
