import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/api-auth';
import { captureError } from '../../../../../lib/sentry-helper';
import { consultarLoteNfeDestinadas, loteNfeEmAndamento } from '../../../../../lib/nfe/monitor';
import { sincronizarLoteNfseAdn } from '../../../../../lib/nfse/sincronizar-adn';

// 60 s é aceito em todos os planos da Vercel. A rodada para antes disso e a fila continua na próxima.
export const maxDuration = 60;
const TEMPO_DA_RODADA_MS = 38_000;

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
    // 1. Executa busca automática de NF-e Mercadorias (Destinadas & Emitidas) na SEFAZ
    // 2. Executa busca automática de NFS-e Serviços (Emitidas & Tomadas/Destinadas) no ADN SEFIN
    const [resNfe, resNfse] = await Promise.allSettled([
      consultarLoteNfeDestinadas(150, 24_000),
      sincronizarLoteNfseAdn(30, 18_000),
    ]);

    const rNfe = resNfe.status === 'fulfilled' ? resNfe.value : { consultadas: 0, novas: 0, falhas: 1, restantes: 0 };
    const rNfse = resNfse.status === 'fulfilled' ? resNfse.value : { consultadas: 0, novas: 0, novasEmitidas: 0, novasTomadas: 0, falhas: 1 };

    const mensagem = `Monitor Fiscal: ${rNfe.consultadas} empresa(s) NF-e (${rNfe.novas} novas mercadorias); ${rNfse.consultadas} empresa(s) NFS-e (${rNfse.novas} novos serviços: ${rNfse.novasEmitidas} emitidos / ${rNfse.novasTomadas} tomados).`;
    console.log(`[monitor-fiscal] ${mensagem}`);

    return NextResponse.json({
      iniciado: true,
      mensagem,
      nfe: rNfe,
      nfse: rNfse,
    });
  } catch (err) {
    console.error('[monitor-fiscal] Falha na rodada:', err);
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
