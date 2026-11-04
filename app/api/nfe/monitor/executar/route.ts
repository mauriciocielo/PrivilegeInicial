import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/api-auth';
import { captureError } from '../../../../../lib/sentry-helper';
import { consultarLoteNfeDestinadas, loteNfeEmAndamento } from '../../../../../lib/nfe/monitor';

async function autorizado(request: Request, token: string | null): Promise<boolean> {
  const segredo = process.env.CRON_SECRET;
  if (segredo && token === segredo) return true;
  const auth = await requireAuth(request);
  return !auth.error && (auth.session.role === 'administrador' || auth.session.role === 'consultor');
}

function iniciar() {
  if (loteNfeEmAndamento()) {
    return NextResponse.json({ iniciado: false, mensagem: 'Já existe uma rodada do monitor em andamento.' }, { status: 409 });
  }
  // Centenas de CNPJs levam minutos: roda em segundo plano e responde na hora.
  consultarLoteNfeDestinadas()
    .then(r => console.log(`[nfe-monitor] ${r.consultadas} consultada(s), ${r.puladas} em espera, ${r.novas} nota(s) nova(s), ${r.falhas} falha(s).`))
    .catch(err => { console.error('[nfe-monitor] Falha na rodada:', err); captureError(err); });
  return NextResponse.json({ iniciado: true, mensagem: 'Rodada do monitor iniciada em segundo plano.' }, { status: 202 });
}

/** Disparo do agendador do servidor (CRON_SECRET) ou de um administrador. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') || request.headers.get('Authorization')?.replace('Bearer ', '') || null;
  if (!(await autorizado(request, token))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  return iniciar();
}

export async function POST(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '') || null;
  if (!(await autorizado(request, token))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  return iniciar();
}

