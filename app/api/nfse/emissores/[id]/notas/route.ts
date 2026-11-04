import { NextResponse } from 'next/server';
import db from '../../../../../../lib/prisma';
import { requireAuth } from '../../../../../../lib/api-auth';
import { captureError } from '../../../../../../lib/sentry-helper';
import { acessoEmissaoNegado } from '../../../../../../lib/nfse/servidor';
import { CertificadoInvalidoError } from '../../../../../../lib/nfse/assinatura';
import { CofreNaoConfiguradoError } from '../../../../../../lib/nfse/cofre';
import { SefinIndisponivelError } from '../../../../../../lib/nfse/sefin';
import { sincronizarNotasAdn } from '../../../../../../lib/nfse/sincronizar-adn';

const colunasDevolvidas = {
  id: true, empresaId: true, numero: true, serie: true, status: true, motivoCancelamento: true,
  prestadorCnpj: true, prestadorRazaoSocial: true, prestadorInscricaoMunicipal: true,
  clienteId: true, tomadorCnpjCpf: true, tomadorRazaoSocial: true, tomadorEmail: true, tomadorEndereco: true,
  tomadorCep: true, tomadorInscricaoMunicipal: true, tomadorCodigoMunicipio: true, tomadorNumero: true, tomadorBairro: true,
  dataEmissao: true, dataCompetencia: true, codigoServico: true, cTribMun: true, cNbs: true, discriminacao: true, municipioPrestacao: true,
  valorServicos: true, valorDeducoes: true, valorPis: true, valorCofins: true, valorInss: true, valorIr: true, valorCsll: true,
  issRetido: true, valorIss: true, aliquotaIss: true, valorBaseCalculo: true, valorLiquido: true,
  ambiente: true, nDps: true, idDps: true, chaveAcesso: true, gerarContaReceber: true, cancelamentoEmAnalise: true, lancamentoId: true, createdAt: true,
} as const;

/** Lista todas as notas fiscais (prestadas e tomadas) desta empresa salvas no servidor. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;
    const { id: empresaId } = await params;
    const negado = await acessoEmissaoNegado(auth.session, empresaId);
    if (negado) return negado;

    const notas = await db.nfsE.findMany({
      where: { empresaId },
      select: colunasDevolvidas,
      orderBy: [{ dataEmissao: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ notas });
  } catch (error) {
    console.error('Erro em GET nfse/emissores/notas:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao listar as notas da empresa.' }, { status: 500 });
  }
}

/**
 * Traz as notas emitidas e tomadas no portal (ADN). Só lê: cada chamada avança
 * até 3 páginas a partir de onde parou e avisa se ainda há mais. Nota que já existe
 * no sistema é mantida; só o cancelamento é atualizado. Não gera conta a receber.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;
    const { id: empresaId } = await params;
    const negado = await acessoEmissaoNegado(auth.session, empresaId);
    if (negado) return negado;

    const body = await request.json().catch(() => ({}));
    const resultado = await sincronizarNotasAdn(empresaId, { meses: Number(body?.meses), reiniciar: body?.reiniciar === true });
    if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.status });

    const { idsAlterados, criadas, criadasEmitidas, criadasTomadas, foraDoPeriodo, servicos, temMais } = resultado;
    const notas = idsAlterados.length > 0
      ? await db.nfsE.findMany({ where: { id: { in: [...new Set(idsAlterados)] } }, select: colunasDevolvidas })
      : [];

    return NextResponse.json({ notas, criadas, criadasEmitidas, criadasTomadas, foraDoPeriodo, servicos, temMais });
  } catch (error) {
    if (error instanceof SefinIndisponivelError) {
      return NextResponse.json({ error: `${error.message} Tente de novo: a leitura continua de onde parou.` }, { status: 503 });
    }
    if (error instanceof CertificadoInvalidoError || error instanceof CofreNaoConfiguradoError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error('Erro em POST nfse/emissores/notas:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao buscar as notas do portal.' }, { status: 500 });
  }
}
