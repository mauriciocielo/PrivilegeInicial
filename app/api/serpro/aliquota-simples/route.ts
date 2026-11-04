import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { buscarAliquotaSimplesNacional, apenasDigitos } from '../../../../lib/serpro/integra-contador';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const empresaId = url.searchParams.get('empresaId') || '';
    const cnpjParam = url.searchParams.get('cnpj') || '';

    let cnpj = apenasDigitos(cnpjParam);

    if (empresaId) {
      const empresa = await db.empresa.findUnique({
        where: { id: empresaId },
        select: { id: true, cnpj: true, razaoSocial: true },
      });
      if (empresa) {
        cnpj = apenasDigitos(empresa.cnpj);
      }
    }

    if (!cnpj || cnpj.length !== 14) {
      return NextResponse.json(
        { error: 'CNPJ inválido ou empresa não encontrada.' },
        { status: 400 }
      );
    }

    const resultado = await buscarAliquotaSimplesNacional(cnpj);

    if (!resultado.sucesso) {
      return NextResponse.json(
        {
          sucesso: false,
          error: resultado.aviso || 'Não foi possível obter a alíquota do Simples Nacional.',
        },
        { status: 422 }
      );
    }

    // Se empresaId foi fornecido e alíquota encontrada > 0, atualiza o NfseConfig
    let atualizadoNoBanco = false;
    if (empresaId && resultado.aliquota > 0) {
      try {
        await db.nfseConfig.upsert({
          where: { empresaId },
          create: {
            empresaId,
            pTotTribSN: resultado.aliquota,
            opSimpNac: 3, // Simples Nacional
          },
          update: {
            pTotTribSN: resultado.aliquota,
            opSimpNac: 3,
          },
        });
        atualizadoNoBanco = true;
      } catch (err) {
        console.warn('Erro ao atualizar pTotTribSN em NfseConfig:', err);
      }
    }

    return NextResponse.json({
      sucesso: true,
      aliquota: resultado.aliquota,
      rbt12: resultado.rbt12,
      rpa: resultado.rpa,
      valorDevido: resultado.valorDevido,
      periodoApuracao: resultado.periodoApuracao,
      numeroDeclaracao: resultado.numeroDeclaracao,
      detalhes: resultado.detalhes,
      atualizadoNoBanco,
    });
  } catch (error) {
    console.error('Erro em GET /api/serpro/aliquota-simples:', error);
    captureError(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao consultar alíquota no Integra Contador.' },
      { status: 500 }
    );
  }
}

