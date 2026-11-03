import { NextResponse } from 'next/server';
import db from '../../../../../../lib/prisma';
import { requireAuth } from '../../../../../../lib/api-auth';
import { captureError } from '../../../../../../lib/sentry-helper';
import { abrirCredencialEscritorio, acessoNegado } from '../../../../../../lib/nfse/servidor';
import { apenasDigitos } from '../../../../../../lib/nfse/dps';
import { CertificadoInvalidoError } from '../../../../../../lib/nfse/assinatura';
import { CofreNaoConfiguradoError } from '../../../../../../lib/nfse/cofre';
import { criarTransporteMtls, SefinIndisponivelError, verificarProcuracao, type StatusProcuracao } from '../../../../../../lib/nfse/sefin';

/** Consulta no ADN, com o certificado do contador, se ele pode agir em nome desta empresa. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;
    const { id: empresaId } = await params;
    const negado = acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    const empresa = await db.empresa.findUnique({ where: { id: empresaId }, select: { cnpj: true } });
    if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });

    const aberta = await abrirCredencialEscritorio();
    if ('erro' in aberta) return NextResponse.json({ error: aberta.erro }, { status: 422 });

    let resultado: { status: StatusProcuracao; mensagem: string | null };
    try {
      // As procurações reais valem em produção. A consulta só lê: não emite nem altera nada.
      resultado = await verificarProcuracao(criarTransporteMtls('producao', aberta.credencial, 'adn'), apenasDigitos(empresa.cnpj));
    } catch (error) {
      if (!(error instanceof SefinIndisponivelError)) throw error;
      resultado = { status: 'indeterminada', mensagem: error.message };
    }

    const dados = { procuracaoStatus: resultado.status, procuracaoMensagem: resultado.mensagem, procuracaoVerificadaEm: new Date() };
    await db.nfseConfig.upsert({
      where: { empresaId },
      update: dados,
      create: { ...dados, empresaId },
    });
    return NextResponse.json(dados);
  } catch (error) {
    if (error instanceof CertificadoInvalidoError || error instanceof CofreNaoConfiguradoError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error('Erro em POST nfse/emissores/verificar:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao verificar a procuração.' }, { status: 500 });
  }
}
