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
  return !!usuario?.allowedRoutes?.some(rota => rota.includes('nfse') || rota.includes('nfe-destinadas') || ROTA_NFSE_CONSULTOR.startsWith(rota));
}

/** Empresas do certificado que este usuário opera: todas se ele opera o módulo fiscal. */
export async function idsEmpresasDoCertificado(userId: string): Promise<string[]> {
  if (!(await temTelaNfse(userId))) return [];
  const empresas = await db.empresa.findMany({ select: { id: true } });
  return empresas.map(e => e.id);
}

export async function operaEmpresaDoCertificado(userId: string, empresaId: string): Promise<boolean> {
  if (!(await temTelaNfse(userId))) return false;
  return true;
}

/** Filtro das empresas listadas no módulo fiscal: todas as empresas para administradores e equipe fiscal/consultores. */
export async function filtroEmpresasNfse(session: SessionPayload): Promise<Prisma.EmpresaWhereInput> {
  if (session.role === 'administrador' || session.role === 'consultor') return {};
  
  // Usuários do setor fiscal ou consultores com acesso aos módulos fiscais operam toda a carteira
  const usuario = await db.user.findUnique({ where: { id: session.userId }, select: { allowedRoutes: true } });
  const operaFiscal = usuario?.allowedRoutes?.some(r => r.includes('nfse') || r.includes('nfe-destinadas'));
  if (operaFiscal) {
    return {};
  }

  const carteira: Prisma.EmpresaWhereInput = { id: { in: session.empresaIds } };
  return (await temTelaNfse(session.userId)) ? {} : carteira;
}
