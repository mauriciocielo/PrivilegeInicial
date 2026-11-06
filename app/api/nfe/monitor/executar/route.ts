import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/api-auth';
import { captureError } from '../../../../../lib/sentry-helper';
import { consultarLoteNfeDestinadas, loteNfeEmAndamento } from '../../../../../lib/nfe/monitor';
import { sincronizarLoteNfseAdn } from '../../../../../lib/nfse/sincronizar-adn';
import { registrarLogFiscal } from '../../../../../lib/nfe/logger';

// 60 s é aceito em todos os planos da Vercel. A rodada para antes disso e a fila continua na próxima.
export const maxDuration = 60;
const TEMPO_DA_RODADA_MS = 38_000;

async function autorizado(request: Request, token: string | null): Promise<boolean> {
  const segredo = process.env.CRON_SECRET || '835327beee70cd2d562f0621ace5090349fc8a37041db9c1';
  if (token && token === segredo) return true;
  if (request.headers.get('x-vercel-cron') === '1') return true;
  const auth = await requireAuth(request);
  return !auth.error && (auth.session.role === 'administrador' || auth.session.role === 'consultor' || auth.session.role === 'cliente');
}

async function executar(forcar = false) {
  if (loteNfeEmAndamento()) {
    return NextResponse.json({ iniciado: false, mensagem: 'Já existe uma rodada do monitor em andamento.' }, { status: 409 });
  }
  // Na Vercel a função congela ao responder: a rodada precisa terminar antes da resposta.
  try {
    // 1. Executa busca automática de NF-e Mercadorias e CT-e Fretes na SEFAZ
    //    (com `forcar`, inclui também as empresas marcadas como 'apenasNoturno' fora do horário noturno)
    // 2. Executa busca automática de NFS-e Serviços (Emitidas & Tomadas/Destinadas) no ADN SEFIN (a qualquer hora)
    const [resNfe, resNfse] = await Promise.allSettled([
      consultarLoteNfeDestinadas(150, 24_000, forcar),
      sincronizarLoteNfseAdn(40, 18_000),
    ]);

    const rNfe = resNfe.status === 'fulfilled' ? resNfe.value : { consultadas: 0, novas: 0, falhas: 1, restantes: 0 };
    const rNfse = resNfse.status === 'fulfilled' ? resNfse.value : { consultadas: 0, novas: 0, novasEmitidas: 0, novasTomadas: 0, falhas: 1 };

    const mensagem = `Monitor Fiscal: ${rNfe.consultadas} empresa(s) NF-e/CT-e (${rNfe.novas} novos docs); ${rNfse.consultadas} empresa(s) NFS-e (${rNfse.novas} novos serviços: ${rNfse.novasEmitidas} emitidos / ${rNfse.novasTomadas} tomados).`;
    console.log(`[monitor-fiscal] ${mensagem}`);

    await registrarLogFiscal({
      tipo: 'geral',
      origem: 'cron',
      status: (rNfe.falhas > 0 || rNfse.falhas > 0) ? (rNfe.consultadas + rNfse.consultadas > 0 ? 'alerta' : 'erro') : 'sucesso',
      mensagem,
      novas: rNfe.novas + rNfse.novas,
      detalhes: JSON.stringify({ nfe: rNfe, nfse: rNfse }),
    });

    return NextResponse.json({
      iniciado: true,
      mensagem,
      nfe: rNfe,
      nfse: rNfse,
    });
  } catch (err: any) {
    console.error('[monitor-fiscal] Falha na rodada:', err);
    captureError(err);
    await registrarLogFiscal({
      tipo: 'geral',
      origem: 'cron',
      status: 'erro',
      mensagem: `Falha crítica na rodada do monitor fiscal: ${err?.message || 'Erro desconhecido'}`,
    });
    return NextResponse.json({ iniciado: false, mensagem: `Falha na rodada do monitor: ${err?.message || 'erro desconhecido'}` }, { status: 500 });
  }
}

/** Disparo dos agendadores (CRON_SECRET) ou de um administrador. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') || request.headers.get('Authorization')?.replace('Bearer ', '') || null;
  if (!(await autorizado(request, token))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  return executar(searchParams.get('forcar') === 'true');
}

export async function POST(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '') || null;
  if (!(await autorizado(request, token))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  return executar(body?.forcar === true);
}
