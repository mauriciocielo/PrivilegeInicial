import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { acessoEmissaoNegado } from '../../../../lib/nfse/servidor';
import { consultarTributosIbpt } from '../../../../lib/nfse/ibpt';

export const dynamic = 'force-dynamic';

/**
 * GET /api/nfse/ibpt?empresaId=...&codigoServico=...&uf=...
 * Consulta os percentuais aproximados de tributos (Federal, Estadual, Municipal)
 * na API oficial do IBPT (quando IBPT_TOKEN estiver configurado) ou na tabela
 * de referência IBPT de Serviços LC 116.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get('empresaId')?.trim() || '';
    let codigoServico = searchParams.get('codigoServico')?.trim() || '';
    let uf = searchParams.get('uf')?.trim() || '';
    const aliquotaIssRaw = searchParams.get('aliquotaIss');
    const aliquotaIss = aliquotaIssRaw != null && aliquotaIssRaw !== '' ? Number(aliquotaIssRaw) : null;

    let cnpj = '';
    if (empresaId) {
      const negado = await acessoEmissaoNegado(auth.session, empresaId);
      if (negado) return negado;
      const emp = await db.empresa.findUnique({
        where: { id: empresaId },
        select: { cnpj: true, uf: true, nfseConfig: { select: { cTribNacPadrao: true } } },
      });
      if (emp) {
        cnpj = emp.cnpj || '';
        if (!uf && emp.uf) uf = emp.uf;
        if (!codigoServico && emp.nfseConfig?.cTribNacPadrao) codigoServico = emp.nfseConfig.cTribNacPadrao;
      }
    }

    const resultado = await consultarTributosIbpt({ cnpj, codigoServico, uf, aliquotaIss });
    return NextResponse.json(resultado);
  } catch (error) {
    console.error('Erro em GET /api/nfse/ibpt:', error);
    return NextResponse.json({ error: 'Erro ao consultar tributos no IBPT.' }, { status: 500 });
  }
}
