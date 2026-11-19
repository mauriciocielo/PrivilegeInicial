import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { abrirCredencial, acessoEmissaoNegado } from '../../../../lib/nfse/servidor';
import { apenasDigitos, type AmbienteNfse } from '../../../../lib/nfse/dps';
import { consultarAliquotaMunicipio, criarTransporteMtls } from '../../../../lib/nfse/sefin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const empresaId = (url.searchParams.get('empresaId') || '').trim();
    const codigoMunicipioParam = apenasDigitos(url.searchParams.get('codigoMunicipio'));
    const codigoServico = apenasDigitos(url.searchParams.get('codigoServico'));
    const competencia = (url.searchParams.get('competencia') || '').trim();

    if (!empresaId) {
      return NextResponse.json({ error: 'empresaId obrigatório.' }, { status: 400 });
    }
    const negado = await acessoEmissaoNegado(auth.session, empresaId);
    if (negado) return negado;

    const config = await db.nfseConfig.findUnique({ where: { empresaId } });
    const codigoMunicipio = codigoMunicipioParam.length === 7
      ? codigoMunicipioParam
      : apenasDigitos(config?.codigoMunicipio);

    if (codigoMunicipio.length !== 7 || codigoServico.length !== 6) {
      return NextResponse.json(
        { error: 'Informe o código IBGE do município (7 dígitos) e o código de serviço (6 dígitos).' },
        { status: 400 }
      );
    }

    // 1) Consulta oficial nos Parâmetros Municipais do ADN (via mTLS com o certificado A1 da empresa)
    if (config) {
      const aberta = await abrirCredencial(config);
      if (!('erro' in aberta)) {
        const ambiente = (config.ambiente || 'producao') as AmbienteNfse;
        const transporteAdn = criarTransporteMtls(ambiente, aberta.credencial, 'adn');
        const resAdn = await consultarAliquotaMunicipio(transporteAdn, codigoMunicipio, codigoServico, competencia);
        if (resAdn.aliquota !== null) {
          return NextResponse.json({
            sucesso: true,
            aliquota: resAdn.aliquota,
            fonte: 'adn',
            codigoMunicipio,
            codigoServico,
            detalhe: resAdn.detalhe || `Alíquota oficial do município (ADN ${codigoMunicipio}): ${resAdn.aliquota}%`,
          });
        }
      }
    }

    // 2) Fallback: última nota autorizada no sistema para o mesmo município + código de serviço
    const ultimaNota = await db.nfsE.findFirst({
      where: {
        status: 'emitida',
        municipioPrestacao: codigoMunicipio,
        codigoServico,
        aliquotaIss: { gt: 0 },
      },
      orderBy: { createdAt: 'desc' },
      select: { aliquotaIss: true, numero: true },
    });

    if (ultimaNota && Number(ultimaNota.aliquotaIss) > 0) {
      const aliq = Number(ultimaNota.aliquotaIss);
      return NextResponse.json({
        sucesso: true,
        aliquota: aliq,
        fonte: 'historico_municipio',
        codigoMunicipio,
        codigoServico,
        detalhe: `Alíquota apurada em notas autorizadas no município ${codigoMunicipio} (cód. ${codigoServico}): ${aliq}%`,
      });
    }

    return NextResponse.json(
      {
        sucesso: false,
        error: `O município ${codigoMunicipio} não retornou alíquota cadastrada no ADN para o serviço ${codigoServico}.`,
      },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro ao consultar alíquota do município.' },
      { status: 500 }
    );
  }
}
