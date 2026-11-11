import { NextResponse } from 'next/server';
import { processarProximoLote, lerFila } from '../../../../../lib/email-queue';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Endpoint chamado pelo Vercel Cron para processar lotes da fila automaticamente
export async function GET(req: Request) {
  try {
    const fila = lerFila();
    const campanhaPronta = fila.find(
      c => c.status === 'aguardando' && c.proximoLoteEm && new Date(c.proximoLoteEm).getTime() <= Date.now()
    );

    if (!campanhaPronta) {
      return NextResponse.json({ ok: true, mensagem: 'Nenhum lote pronto para disparo neste momento.' });
    }

    const resultado = await processarProximoLote(campanhaPronta.id);

    return NextResponse.json({
      ok: true,
      mensagem: `Lote processado com sucesso. ${resultado.enviados} enviados, ${resultado.restantes} restantes.`,
      resultado,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro no processamento do cron de e-mail' }, { status: 500 });
  }
}

