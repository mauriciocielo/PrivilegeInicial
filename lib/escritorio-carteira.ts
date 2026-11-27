import db from './prisma';
import {
  idsEmpresasDeTerceiros,
  idsEmpresasDoEscritorio,
  obterEscritorioDoUsuario,
} from './nfse/escritorios-terceiros';

/**
 * Resolve o conjunto de empresas acessíveis na carteira do escritório logado:
 * - Contador parceiro admin: todas as empresas vinculadas ao escritório dele.
 * - Contador parceiro operador (auxiliar): apenas as empresas liberadas para ele dentro do escritório.
 * - Administrador interno: toda a carteira padrão (sem misturar empresas de terceiros).
 * - Consultor interno: empresas vinculadas ao usuário.
 */
export async function resolverEmpresasDaCarteira(userId: string, role: string) {
  const vinculo = await obterEscritorioDoUsuario(userId);
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { empresaIds: true },
  });
  const userEmpIds = Array.isArray(user?.empresaIds) ? user!.empresaIds : [];

  if (vinculo) {
    const idsEsc = await idsEmpresasDoEscritorio(vinculo.escritorioId);
    const idsPermitidos =
      vinculo.papel === 'operador'
        ? idsEsc.filter((id) => userEmpIds.includes(id))
        : Array.from(new Set([...idsEsc, ...userEmpIds]));
    return {
      vinculo,
      ehAdminEscritorio: vinculo.papel === 'admin_escritorio',
      empresaIds: idsPermitidos,
    };
  }

  if (role === 'administrador') {
    const terceiros = new Set(await idsEmpresasDeTerceiros());
    const todas = await db.empresa.findMany({ select: { id: true } });
    return {
      vinculo: null,
      ehAdminEscritorio: true,
      empresaIds: todas.map((e) => e.id).filter((id) => !terceiros.has(id)),
    };
  }

  return {
    vinculo: null,
    ehAdminEscritorio: false,
    empresaIds: userEmpIds,
  };
}
