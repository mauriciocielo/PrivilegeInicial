import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { EMAIL_SETOR_FISCAL_PADRAO, enviarRelatorioFiscalDiario } from '../../../../lib/nfse/relatorio-fiscal';

/**
 * GET /api/nfse/relatorio-diario
 * Executado pelo Cron diário (com CRON_SECRET) ou por usuário autenticado do escritório.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientToken = searchParams.get('token') || request.headers.get('Authorization')?.replace('Bearer ', '');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && clientToken !== cronSecret) {
      const auth = requireAuth(request);
      if (auth.error || auth.session.role === 'cliente') {
        return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
      }
    }

    const resultado = await enviarRelatorioFiscalDiario({
      dataInicio: searchParams.get('dataInicio') || undefined,
      dataFim: searchParams.get('dataFim') || undefined,
      empresaId: searchParams.get('empresaId') || undefined,
      sincronizarAdn: searchParams.get('sincronizarAdn') !== '0',
      anexarZip: searchParams.get('anexarZip') !== '0',
    });

    if (!resultado.sucesso) {
      return NextResponse.json({ error: resultado.mensagem, ...resultado }, { status: 500 });
    }
    return NextResponse.json(resultado);
  } catch (error) {
    console.error('Erro em GET /api/nfse/relatorio-diario:', error);
    captureError(error);
    return NextResponse.json({ error: (error as Error).message || 'Erro ao enviar relatório fiscal diário.' }, { status: 500 });
  }
}

/**
 * POST /api/nfse/relatorio-diario
 * Disparo sob demanda a partir da tela de NFS-e para fiscal@privilegecontabilidade.com.br (ou outros destinatários).
 */
export async function POST(request: Request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const emailInformado = typeof body?.email === 'string' ? body.email.trim() : '';
    const destinatarios = emailInformado
      ? emailInformado.split(/[;,]+/).map((s: string) => s.trim()).filter(Boolean)
      : [EMAIL_SETOR_FISCAL_PADRAO];

    const resultado = await enviarRelatorioFiscalDiario({
      dataInicio: body?.dataInicio || undefined,
      dataFim: body?.dataFim || undefined,
      empresaId: body?.empresaId || undefined,
      destinatarios,
      sincronizarAdn: Boolean(body?.sincronizarAdn),
      anexarZip: body?.anexarZip !== false,
    });

    if (!resultado.sucesso) {
      return NextResponse.json({ error: resultado.mensagem, ...resultado }, { status: 500 });
    }
    return NextResponse.json(resultado);
  } catch (error) {
    console.error('Erro em POST /api/nfse/relatorio-diario:', error);
    captureError(error);
    return NextResponse.json({ error: (error as Error).message || 'Erro ao enviar relatório fiscal.' }, { status: 500 });
  }
}

