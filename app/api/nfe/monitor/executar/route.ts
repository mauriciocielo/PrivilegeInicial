import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/api-auth';
import { captureError } from '../../../../../lib/sentry-helper';
import { consultarLoteNfeDestinadas, loteNfeEmAndamento } from '../../../../../lib/nfe/monitor';

// 60 s é aceito em todos os planos da Vercel. A rodada para antes disso e a fila continua na próxima.
export const maxDuration = 60;
const TEMPO_DA_RODADA_MS = 40_000;

async function autorizado(request: Request, token: string | null): Promise<boolean> {
  const segredo = process.env.CRON_SECRET;
  if (segredo && token === segredo) return true;
  const auth = await requireAuth(request);
  return !auth.error && (auth.session.role === 'administrador' || auth.session.role === 'consultor');
}

async function executar() {
  if (loteNfeEmAndamento()) {
    return NextResponse.json({ iniciado: false, mensagem: 'Já existe uma rodada do monitor em andamento.' }, { status: 409 });
  }
  // Na Vercel a função congela ao responder: a rodada precisa terminar antes da resposta.
  try {
    const r = await consultarLoteNfeDestinadas(150, TEMPO_DA_RODADA_MS);
    const mensagem = `${r.consultadas} empresa(s) consultada(s), ${r.novas} nota(s) nova(s), ${r.falhas} falha(s)`
      + (r.restantes > 0 ? `, ${r.restantes} para a próxima rodada.` : '.');
    console.log(`[nfe-monitor] ${mensagem}`);
    return NextResponse.json({ iniciado: true, mensagem, resumo: r });
  } catch (err) {
    console.error('[nfe-monitor] Falha na rodada:', err);
    captureError(err);
    return NextResponse.json({ iniciado: false, mensagem: 'Falha na rodada do monitor.' }, { status: 500 });
  }
}

/** Disparo dos agendadores (CRON_SECRET) ou de um administrador. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') || request.headers.get('Authorization')?.replace('Bearer ', '') || null;
  if (!(await autorizado(request, token))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  return executar();
}

export async function POST(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '') || null;
  if (!(await autorizado(request, token))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  return executar();
}
