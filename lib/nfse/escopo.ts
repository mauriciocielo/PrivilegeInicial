// ============================================================
// NFS-e NACIONAL — quais empresas cada usuário do escritório opera
// ============================================================

import type { Prisma } from '@prisma/client';
import db from '../prisma';
import type { SessionPayload } from '../session';
import { TIPO_EMPRESA_SO_EMISSOR } from './emissor';
import {
  idsEmpresasDeTerceiros,
  idsEmpresasDoEscritorio,
  obterEscritorioDaEmpresa,
  obterEscritorioDoUsuario,
} from './escritorios-terceiros';

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
  const vinculoTerceiro = await obterEscritorioDoUsuario(userId);
  if (vinculoTerceiro) {
    return vinculoTerceiro.ativo ? idsEmpresasDoEscritorio(vinculoTerceiro.escritorioId) : [];
  }
  if (!(await temTelaNfse(userId))) return [];
  const terceiros = await idsEmpresasDeTerceiros();
  const where: Prisma.EmpresaWhereInput = terceiros.length > 0
    ? { AND: [EMPRESA_DO_CERTIFICADO, { id: { notIn: terceiros } }] }
    : EMPRESA_DO_CERTIFICADO;
  const empresas = await db.empresa.findMany({ where, select: { id: true } });
  return empresas.map(e => e.id);
}

export async function operaEmpresaDoCertificado(userId: string, empresaId: string): Promise<boolean> {
  const vinculoTerceiro = await obterEscritorioDoUsuario(userId);
  if (vinculoTerceiro) {
    if (!vinculoTerceiro.ativo) return false;
    const escEmp = await obterEscritorioDaEmpresa(empresaId);
    return escEmp === vinculoTerceiro.escritorioId;
  }
  if (!(await temTelaNfse(userId))) return false;
  const escEmp = await obterEscritorioDaEmpresa(empresaId);
  if (escEmp !== 'padrao') return false;
  const empresa = await db.empresa.findFirst({ where: { id: empresaId, ...EMPRESA_DO_CERTIFICADO }, select: { id: true } });
  return !!empresa;
}

/** Filtro das empresas listadas na emissão: respeita o isolamento entre escritórios contábeis. */
export async function filtroEmpresasNfse(session: SessionPayload): Promise<Prisma.EmpresaWhereInput> {
  // Contador terceiro: vê EXCLUSIVAMENTE as empresas vinculadas ao próprio escritório (e sua carteira explícita)
  const vinculoTerceiro = await obterEscritorioDoUsuario(session.userId);
  if (vinculoTerceiro) {
    if (!vinculoTerceiro.ativo) return { id: { in: [] } };
    const idsEsc = await idsEmpresasDoEscritorio(vinculoTerceiro.escritorioId);
    const idsPermitidos = Array.from(new Set([...idsEsc, ...(session.empresaIds || [])]));
    return { id: { in: idsPermitidos } };
  }

  if (session.role === 'administrador') return {};
  const carteira: Prisma.EmpresaWhereInput = { id: { in: session.empresaIds } };
  if (!(await temTelaNfse(session.userId))) return carteira;

  const terceiros = await idsEmpresasDeTerceiros();
  const doCertificadoPadrao: Prisma.EmpresaWhereInput = terceiros.length > 0
    ? { AND: [EMPRESA_DO_CERTIFICADO, { id: { notIn: terceiros } }] }
    : EMPRESA_DO_CERTIFICADO;
  return { OR: [carteira, doCertificadoPadrao] };
}
