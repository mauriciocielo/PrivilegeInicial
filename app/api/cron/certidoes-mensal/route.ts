import { NextResponse } from 'next/server';
import { captureError } from '../../../../lib/sentry-helper';
import { executarRotinaMensalCertidoes } from '../../../../lib/certidoes/gerenciador-certidoes';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const forcar = url.searchParams.get('forcar') === 'true';

    const authHeader = request.headers.get('authorization') || '';
    const cronSecret = process.env.CRON_SECRET || 'privilege_cron_cnd_secret_2026';

    // Se houver CRON_SECRET configurado e não for execução forçada com token
    if (process.env.CRON_SECRET && !forcar) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
      }
    }

    const resultado = await executarRotinaMensalCertidoes(forcar);

    return NextResponse.json({
      sucesso: true,
      mensagem: resultado.executado
        ? `Rotina mensal concluída com sucesso: ${resultado.totalProcessado} empresas processadas.`
        : resultado.motivo,
      resultado,
    });
  } catch (error) {
    console.error('Erro em cron de certidões mensal:', error);
    captureError(error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Erro na execução da rotina mensal de certidões.',
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}

