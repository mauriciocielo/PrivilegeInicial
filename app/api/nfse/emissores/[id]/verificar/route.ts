import { NextResponse } from 'next/server';
import db from '../../../../../../lib/prisma';
import { requireAuth } from '../../../../../../lib/api-auth';
import { captureError } from '../../../../../../lib/sentry-helper';
import { abrirCredencialEscritorio, acessoNegado } from '../../../../../../lib/nfse/servidor';
import { apenasDigitos } from '../../../../../../lib/nfse/dps';
import { CertificadoInvalidoError } from '../../../../../../lib/nfse/assinatura';
import { CofreNaoConfiguradoError } from '../../../../../../lib/nfse/cofre';
import { criarTransporteMtls, SefinIndisponivelError, verificarProcuracao, type StatusProcuracao } from '../../../../../../lib/nfse/sefin';
import { consultarCnpjPublico } from '../../../../../../lib/nfse/emissor';

/** Consulta no ADN, com o certificado do contador, se ele pode agir em nome desta empresa. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { id: empresaId } = await params;
    const negado = await acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    const empresa = await db.empresa.findUnique({
      where: { id: empresaId },
      select: { cnpj: true, razaoSocial: true, nomeFantasia: true, nfseConfig: true },
    });
    if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });

    const aberta = await abrirCredencialEscritorio();
    if ('erro' in aberta) return NextResponse.json({ error: aberta.erro }, { status: 422 });

    const cnpjLimpo = apenasDigitos(empresa.cnpj);
    let resultado: { status: StatusProcuracao; mensagem: string | null };
    try {
      // As procurações reais valem em produção. A consulta só lê: não emite nem altera nada.
      resultado = await verificarProcuracao(criarTransporteMtls('producao', aberta.credencial, 'adn'), cnpjLimpo);
    } catch (error) {
      if (!(error instanceof SefinIndisponivelError)) throw error;
      resultado = { status: 'indeterminada', mensagem: error.message };
    }

    const faltaNome = /^Empresa\s+\d/.test(empresa.razaoSocial || '');
    const faltaIbge = !empresa.nfseConfig?.codigoMunicipio;
    const publico = resultado.status === 'ativa' && (faltaNome || faltaIbge)
      ? await consultarCnpjPublico(cnpjLimpo)
      : null;

    if (publico?.razaoSocial && faltaNome) {
      await db.empresa.update({
        where: { id: empresaId },
        data: {
          razaoSocial: publico.razaoSocial,
          nomeFantasia: publico.nomeFantasia || publico.razaoSocial,
          ...(publico.cidade ? { cidade: publico.cidade } : {}),
          ...(publico.uf ? { uf: publico.uf } : {}),
          ...(publico.cep ? { cep: publico.cep } : {}),
        },
      });
    }

    const dados = {
      procuracaoStatus: resultado.status,
      procuracaoMensagem: resultado.mensagem,
      procuracaoVerificadaEm: new Date(),
      ...(faltaIbge && publico?.codigoMunicipio ? { codigoMunicipio: publico.codigoMunicipio } : {}),
    };
    await db.nfseConfig.upsert({
      where: { empresaId },
      update: dados,
      create: { ...dados, empresaId },
    });
    return NextResponse.json({
      ...dados,
      ...(publico?.razaoSocial && faltaNome
        ? { razaoSocial: publico.razaoSocial, nomeFantasia: publico.nomeFantasia || publico.razaoSocial }
        : {}),
    });
  } catch (error) {
    if (error instanceof CertificadoInvalidoError || error instanceof CofreNaoConfiguradoError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error('Erro em POST nfse/emissores/verificar:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao verificar a procuração.' }, { status: 500 });
  }
}
