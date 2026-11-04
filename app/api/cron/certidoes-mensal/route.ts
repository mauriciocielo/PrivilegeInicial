import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { executarRotinaMensalCertidoes } from '../../../../lib/certidoes/gerenciador-certidoes';

/** Só o agendador (CRON_SECRET) ou um administrador: a rotina consulta a carteira inteira e dispara e-mail. */
async function autorizado(request: Request): Promise<boolean> {
  const segredo = process.env.CRON_SECRET;
  if (segredo && request.headers.get('authorization') === `Bearer ${segredo}`) return true;
  const auth = await requireAuth(request);
  return !auth.error && auth.session.role === 'administrador';
}

export async function GET(request: Request) {
  try {
    if (!(await autorizado(request))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const forcar = new URL(request.url).searchParams.get('forcar') === 'true';
    const resultado = await executarRotinaMensalCertidoes(forcar);

    return NextResponse.json({
      sucesso: true,
      mensagem: resultado.executado
        ? `Rotina mensal concluída: ${resultado.totalProcessado} empresas processadas.`
        : resultado.motivo,
      resultado,
    });
  } catch (error) {
    console.error('Erro em cron de certidões mensal:', error);
    captureError(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro na rotina mensal.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
