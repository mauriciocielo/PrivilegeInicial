import { NextResponse } from 'next/server';
import db from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/api-auth';
import { captureError } from '../../../../../lib/sentry-helper';
import { abrirCredencial, acessoEmissaoNegado, resumirErros } from '../../../../../lib/nfse/servidor';
import { assinarXml, CertificadoInvalidoError } from '../../../../../lib/nfse/assinatura';
import { CofreNaoConfiguradoError } from '../../../../../lib/nfse/cofre';
import { montarCancelamento, MOTIVOS_CANCELAMENTO, validarCancelamento, type AmbienteNfse, type ModoCancelamento } from '../../../../../lib/nfse/dps';
import { criarTransporteMtls, registrarEvento, SefinIndisponivelError } from '../../../../../lib/nfse/sefin';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;
    const { id } = await params;

    const nota = await db.nfsE.findUnique({ where: { id } });
    if (!nota) return NextResponse.json({ error: 'Nota não encontrada no servidor.' }, { status: 404 });
    const negado = await acessoEmissaoNegado(auth.session, nota.empresaId);
    if (negado) return negado;
    if (!nota.chaveAcesso || !nota.ambiente) return NextResponse.json({ error: 'Esta nota não foi autorizada pelo Sefin.' }, { status: 409 });
    if (nota.status === 'cancelada') return NextResponse.json({ error: 'Esta nota já está cancelada.' }, { status: 409 });

    const body = await request.json().catch(() => ({}));
    const motivo = Number(body?.motivo);
    const justificativa = typeof body?.justificativa === 'string' ? body.justificativa.trim() : '';
    const modo: ModoCancelamento = body?.modo === 'analise' ? 'analise' : 'direto';
    const problemas = validarCancelamento(nota.chaveAcesso, motivo, justificativa);
    if (problemas.length > 0) return NextResponse.json({ error: problemas.join(' ') }, { status: 422 });

    const config = await db.nfseConfig.findUnique({ where: { empresaId: nota.empresaId } });
    if (!config) return NextResponse.json({ error: 'Configuração do Emissor Nacional não encontrada.' }, { status: 422 });
    const aberta = await abrirCredencial(config);
    if ('erro' in aberta) return NextResponse.json({ error: aberta.erro }, { status: 422 });

    // O ambiente é o da nota, não o da configuração atual.
    const ambiente = nota.ambiente as AmbienteNfse;
    const pedido = montarCancelamento({ chave: nota.chaveAcesso, cnpjAutor: nota.prestadorCnpj, motivo, justificativa, ambiente, modo });
    const assinado = assinarXml(pedido.xml, 'infPedReg', pedido.id, aberta.credencial);
    const resultado = await registrarEvento(criarTransporteMtls(ambiente, aberta.credencial), nota.chaveAcesso, assinado);
    const motivoCancelamento = `${MOTIVOS_CANCELAMENTO[motivo]}: ${justificativa}`;

    if (!resultado.ok) {
      const codigos = resultado.erros.map(e => e.codigo);
      // E0840: o evento já está vinculado; a nota foi cancelada em outra tentativa ou no portal.
      if (codigos.includes('E0840')) {
        await db.nfsE.update({ where: { id }, data: { status: 'cancelada', motivoCancelamento, cancelamentoEmAnalise: false } });
        return NextResponse.json({ nota: { status: 'cancelada', motivoCancelamento, cancelamentoEmAnalise: false } });
      }
      return NextResponse.json({
        error: resumirErros(resultado.erros, resultado.mensagem, config.usarProcuracao),
        // E0823: o município não aceita cancelamento direto; só por análise fiscal.
        exigeAnalise: codigos.includes('E0823'),
      }, { status: 422 });
    }

    // Na análise fiscal a nota continua válida até o município deferir.
    const dados = modo === 'direto'
      ? { status: 'cancelada', motivoCancelamento, cancelamentoEmAnalise: false }
      : { status: nota.status, motivoCancelamento, cancelamentoEmAnalise: true };
    await db.nfsE.update({
      where: { id },
      data: { ...dados, documento: { update: { eventoXml: resultado.eventoXml } } },
    });
    return NextResponse.json({ nota: dados });
  } catch (error) {
    if (error instanceof SefinIndisponivelError) {
      return NextResponse.json({ error: `${error.message} O cancelamento não foi confirmado: tente de novo.` }, { status: 503 });
    }
    if (error instanceof CertificadoInvalidoError || error instanceof CofreNaoConfiguradoError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error('Erro em POST nfse/cancelar:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao cancelar a nota.' }, { status: 500 });
  }
}
