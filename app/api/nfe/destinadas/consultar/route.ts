import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/api-auth';
import { captureError } from '../../../../../lib/sentry-helper';
import { acessoNegado } from '../../../../../lib/nfse/servidor';
import { consultarNfeDestinadas } from '../../../../../lib/nfe/monitor';
import { consultarCteEmpresa } from '../../../../../lib/cte/monitor';

export const maxDuration = 60;
const TEMPO_DA_CONSULTA_MS = 40_000;

/**
 * Consulta a SEFAZ agora, para uma empresa (NF-e Mercadorias + CT-e Transportes e Fretes).
 * Respeita a espera exigida pela SEFAZ: se ainda não puder consultar, responde 200 com `executada: false` e o motivo.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const empresaId = typeof body?.empresaId === 'string' ? body.empresaId : '';
    if (!empresaId) return NextResponse.json({ error: 'Informe a empresa.' }, { status: 400 });
    const negado = await acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    // Consulta paralela: NF-e (Ambiente Nacional) e CT-e (SVRS), ambas com o mesmo prazo.
    const prazo = Date.now() + TEMPO_DA_CONSULTA_MS;
    const [resNfePromise, resCtePromise] = await Promise.allSettled([
      consultarNfeDestinadas(empresaId, prazo),
      consultarCteEmpresa(empresaId, prazo),
    ]);

    const resNfe = resNfePromise.status === 'fulfilled' ? resNfePromise.value : null;
    const resCte = resCtePromise.status === 'fulfilled' ? resCtePromise.value : null;

    // Antes o erro da NF-e era engolido: se ela falhasse, a tela mostrava só o CT-e, sem explicar
    // (parecia que "só busca CT-e"). Agora o motivo aparece e vai para o log.
    let erroNfe: string | null = null;
    if (resNfePromise.status === 'rejected') {
      erroNfe = (resNfePromise.reason as Error)?.message || 'Falha ao consultar a NF-e.';
      console.error('Falha na consulta de NF-e:', resNfePromise.reason);
      captureError(resNfePromise.reason);
    }
    let erroCte: string | null = null;
    if (resCtePromise.status === 'rejected') {
      erroCte = (resCtePromise.reason as Error)?.message || 'Falha ao consultar o CT-e.';
      console.error('Falha na consulta de CT-e:', resCtePromise.reason);
      captureError(resCtePromise.reason);
    }

    const novasTotal = (resNfe?.novas || 0) + (resCte?.novas || 0);
    const atualizadasTotal = (resNfe?.atualizadas || 0) + (resCte?.atualizadas || 0);

    const partes: string[] = [];
    if (resNfe?.mensagem) partes.push(resNfe.mensagem);
    if (resCte && resCte.novas > 0) partes.push(`+${resCte.novas} CT-e (fretes) importados!`);
    if (erroNfe) partes.push(`NF-e não consultada: ${erroNfe}`);
    if (erroCte) partes.push(`CT-e não consultado: ${erroCte}`);
    const mensagemFinal = partes.join(' • ') || 'Consulta concluída.';

    return NextResponse.json({
      ...(resNfe || {}),
      novas: novasTotal,
      atualizadas: atualizadasTotal,
      cte: resCte,
      erroNfe,
      erroCte,
      mensagem: mensagemFinal,
    });
  } catch (error) {
    console.error('Erro em POST nfe/destinadas/consultar:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao consultar a SEFAZ.' }, { status: 500 });
  }
}

