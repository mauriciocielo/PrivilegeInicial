import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { consultarCertidaoNegativaFederal, apenasDigitos } from '../../../../lib/serpro/integra-contador';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const empresaId = url.searchParams.get('empresaId') || '';
    const cnpjParam = url.searchParams.get('cnpj') || '';

    let cnpj = apenasDigitos(cnpjParam);
    let empresaNome = '';

    if (empresaId) {
      const empresa = await db.empresa.findUnique({
        where: { id: empresaId },
        select: { id: true, cnpj: true, razaoSocial: true, nomeFantasia: true },
      });
      if (empresa) {
        cnpj = apenasDigitos(empresa.cnpj);
        empresaNome = empresa.nomeFantasia || empresa.razaoSocial;
      }
    }

    if (!cnpj || cnpj.length !== 14) {
      return NextResponse.json(
        { error: 'CNPJ inválido ou empresa não informada.' },
        { status: 400 }
      );
    }

    const resultado = await consultarCertidaoNegativaFederal(cnpj);

    return NextResponse.json({
      ...resultado,
      empresaNome,
      cnpj,
    });
  } catch (error) {
    console.error('Erro em GET /api/serpro/certidao-federal:', error);
    captureError(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao consultar Certidão Negativa Federal no Integra Contador.' },
      { status: 500 }
    );
  }
}

