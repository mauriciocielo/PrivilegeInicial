// ============================================================
// NF-e DESTINADAS — filtro compartilhado
// ============================================================
// A lista e a exportação usam a mesma regra: exportar "o filtro atual" entrega
// exatamente as notas que a pessoa está vendo.

import type { Prisma } from '@prisma/client';

export interface FiltroNotas {
  mes?: string | null;
  de?: string | null;
  ate?: string | null;
  situacao?: string | null;
  busca?: string | null;
}

export function filtroNotasDestinadas(empresaId: string, f: FiltroNotas): Prisma.NfeDestinadaWhereInput {
  const busca = (f.busca || '').trim();
  const digitos = busca.replace(/\D/g, '');
  const situacao = f.situacao || '';

  const dataEmissao: { gte?: string; lte?: string } = {};
  if (/^\d{4}-\d{2}$/.test(f.mes || '')) { dataEmissao.gte = `${f.mes}-01`; dataEmissao.lte = `${f.mes}-31`; }
  if (/^\d{4}-\d{2}-\d{2}$/.test(f.de || '')) dataEmissao.gte = f.de as string;
  if (/^\d{4}-\d{2}-\d{2}$/.test(f.ate || '')) dataEmissao.lte = f.ate as string;

  return {
    empresaId,
    ...(Object.keys(dataEmissao).length ? { dataEmissao } : {}),
    ...(['autorizada', 'denegada', 'cancelada'].includes(situacao) ? { situacao } : {}),
    ...(busca
      ? {
          OR: [
            { emitenteNome: { contains: busca, mode: 'insensitive' as const } },
            ...(digitos ? [{ emitenteCnpj: { contains: digitos } }, { chaveAcesso: { contains: digitos } }, { numero: digitos }] : []),
          ],
        }
      : {}),
  };
}
