import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import {
  enviarRelatorioFiscalDiario, relatorioEmAndamento, type OpcoesRelatorioFiscal,
} from '../../../../lib/nfse/relatorio-fiscal';

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

async function autorizado(request: Request, token: string | null): Promise<boolean> {
  const segredo = process.env.CRON_SECRET;
  if (segredo && token === segredo) return true;
  const auth = await requireAuth(request);
  return !auth.error && auth.session.role !== 'cliente';
}

function iniciar(opcoes: OpcoesRelatorioFiscal) {
  if (relatorioEmAndamento()) {
    return NextResponse.json({ iniciado: false, mensagem: 'Já existe um envio em andamento. O e-mail chega ao terminar.' }, { status: 409 });
  }
  // A leitura do ADN de centenas de empresas leva minutos: roda em segundo plano e envia o e-mail ao terminar.
  enviarRelatorioFiscalDiario(opcoes)
    .then(r => console.log(`[relatorio-fiscal] ${r.mensagem} Emitidas: ${r.qtdEmitidas}, tomadas: ${r.qtdTomadas}.`))
    .catch(err => { console.error('[relatorio-fiscal] Falha no envio:', err); captureError(err); });
  return NextResponse.json({ iniciado: true, mensagem: 'Envio iniciado. O e-mail chega ao setor fiscal assim que a leitura terminar.' }, { status: 202 });
}

/** Disparo do agendador diário: lê o ADN de todas as empresas e envia as notas de ontem. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') || request.headers.get('Authorization')?.replace('Bearer ', '') || null;
  if (!(await autorizado(request, token))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const dataInicio = searchParams.get('dataInicio');
  const dataFim = searchParams.get('dataFim');
  return iniciar({
    dataInicio: dataInicio && DATA_ISO.test(dataInicio) ? dataInicio : undefined,
    dataFim: dataFim && DATA_ISO.test(dataFim) ? dataFim : undefined,
    sincronizarAdn: searchParams.get('sincronizarAdn') !== '0',
  });
}

/** Disparo manual pela tela de NFS-e (período e destinatário opcionais). */
export async function POST(request: Request) {
  if (!(await autorizado(request, null))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const emails = typeof body?.email === 'string'
    ? body.email.split(/[;,]+/).map((s: string) => s.trim().toLowerCase()).filter((s: string) => s.includes('@'))
    : [];
  return iniciar({
    dataInicio: DATA_ISO.test(body?.dataInicio || '') ? body.dataInicio : undefined,
    dataFim: DATA_ISO.test(body?.dataFim || '') ? body.dataFim : undefined,
    empresaId: typeof body?.empresaId === 'string' && body.empresaId ? body.empresaId : undefined,
    destinatarios: emails.length ? emails : undefined,
    sincronizarAdn: body?.sincronizarAdn === true,
  });
}
