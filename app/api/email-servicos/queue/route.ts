import { NextResponse } from 'next/server';
import {
  lerFila,
  obterCampanhaAtiva,
  enfileirarCampanha,
  processarProximoLote,
  pausarFila,
  retomarFila,
  cancelarFila,
  iniciarWorkerFilaEmail,
} from '../../../../lib/email-queue';

export const dynamic = 'force-dynamic';

// Inicia o worker de fundo na primeira requisição
iniciarWorkerFilaEmail();

export async function GET(req: Request) {
  try {
    const fila = lerFila();
    const ativa = obterCampanhaAtiva();

    return NextResponse.json({
      ok: true,
      campanhaAtiva: ativa,
      fila,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao carregar fila' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, campanhaId } = body;

    if (action === 'enqueue') {
      const {
        empresaId,
        assunto,
        mensagem,
        somenteImagem,
        linkImagem,
        imagens,
        destinatarios,
        tamanhoLote,
        intervaloMinutos,
        iniciarEmMinutos,
        smtpUserCustom,
        smtpPassCustom,
      } = body;

      if (!assunto || !destinatarios || destinatarios.length === 0) {
        return NextResponse.json({ error: 'Assunto e lista de destinatários são obrigatórios.' }, { status: 400 });
      }

      const camp = enfileirarCampanha({
        empresaId,
        assunto,
        mensagem,
        somenteImagem,
        linkImagem,
        imagens,
        destinatarios,
        tamanhoLote: Number(tamanhoLote) || 70,
        intervaloMinutos: Number(intervaloMinutos) || 65,
        iniciarEmMinutos: typeof iniciarEmMinutos === 'number' ? iniciarEmMinutos : 0,
        smtpUserCustom,
        smtpPassCustom,
      });

      // Se iniciarEmMinutos === 0, processa o primeiro lote imediatamente!
      let resultadoPrimeiroLote = null;
      if (typeof iniciarEmMinutos === 'undefined' || iniciarEmMinutos === 0) {
        resultadoPrimeiroLote = await processarProximoLote(camp.id);
      }

      return NextResponse.json({
        ok: true,
        campanha: camp,
        resultadoPrimeiroLote,
      });
    }

    if (action === 'process_now') {
      const resultado = await processarProximoLote(campanhaId);
      return NextResponse.json({ ok: true, resultado });
    }

    if (action === 'pause') {
      if (!campanhaId) return NextResponse.json({ error: 'campanhaId obrigatório' }, { status: 400 });
      pausarFila(campanhaId);
      return NextResponse.json({ ok: true });
    }

    if (action === 'resume') {
      if (!campanhaId) return NextResponse.json({ error: 'campanhaId obrigatório' }, { status: 400 });
      retomarFila(campanhaId);
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete') {
      if (!campanhaId) return NextResponse.json({ error: 'campanhaId obrigatório' }, { status: 400 });
      cancelarFila(campanhaId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao processar ação na fila' }, { status: 500 });
  }
}

