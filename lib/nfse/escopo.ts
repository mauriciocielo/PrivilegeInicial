// ============================================================
// NFS-e NACIONAL — quais empresas cada usuário do escritório opera
// ============================================================

import type { Prisma } from '@prisma/client';
import db from '../prisma';
import type { SessionPayload } from '../session';
import { TIPO_EMPRESA_SO_EMISSOR } from './emissor';

const ROTA_NFSE_CONSULTOR = '/consultor/nfse';

/**
 * Empresas que trabalham com o certificado do escritório. Só o administrador as
 * importa e elas não entram em empresaIds de ninguém: sem esta regra, a equipe
 * fiscal não as enxerga. A importação conta mesmo com a procuração por verificar,
 * porque trocar o certificado apaga as verificações e alguém precisa refazê-las.
 */
const EMPRESA_DO_CERTIFICADO: Prisma.EmpresaWhereInput = {
  OR: [
    { tipo: TIPO_EMPRESA_SO_EMISSOR },
    {
      nfseConfig: {
        is: {
          usarProcuracao: true,
          OR: [{ procuracaoStatus: 'ativa' }, { dadosImportadosEm: { not: null } }],
        },
      },
    },
  ],
};

/** Lido do banco, e não da sessão, que não carrega as telas do usuário. */
async function temTelaNfse(userId: string): Promise<boolean> {
  const usuario = await db.user.findUnique({ where: { id: userId }, select: { allowedRoutes: true } });
  return !!usuario?.allowedRoutes?.some(rota => ROTA_NFSE_CONSULTOR.startsWith(rota));
}

/** Empresas do certificado que este usuário opera: nenhuma, se ele não tem a tela de NFS-e. */
export async function idsEmpresasDoCertificado(userId: string): Promise<string[]> {
  if (!(await temTelaNfse(userId))) return [];
  const empresas = await db.empresa.findMany({ where: EMPRESA_DO_CERTIFICADO, select: { id: true } });
  return empresas.map(e => e.id);
}

export async function operaEmpresaDoCertificado(userId: string, empresaId: string): Promise<boolean> {
  if (!(await temTelaNfse(userId))) return false;
  const empresa = await db.empresa.findFirst({ where: { id: empresaId, ...EMPRESA_DO_CERTIFICADO }, select: { id: true } });
  return !!empresa;
}

/** Filtro das empresas listadas na emissão: as da carteira do usuário e as do certificado. */
export async function filtroEmpresasNfse(session: SessionPayload): Promise<Prisma.EmpresaWhereInput> {
  if (session.role === 'administrador') return {};
  const carteira: Prisma.EmpresaWhereInput = { id: { in: session.empresaIds } };
  return (await temTelaNfse(session.userId)) ? { OR: [carteira, EMPRESA_DO_CERTIFICADO] } : carteira;
}
