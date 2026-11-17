import { NextResponse } from 'next/server';
import db from '../../../lib/prisma';
import { requireAuth } from '../../../lib/api-auth';
import { captureError } from '../../../lib/sentry-helper';
import { filtroEmpresasNfse } from '../../../lib/nfse/escopo';
import { cnpjValido } from '../../../lib/nfse/dps';
import { ORIGEM_ANEXO, categoriaFederal, ehAnexoManual, type CategoriaFederal } from '../../../lib/certidoes/situacao';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 });

    const empresaIdParam = new URL(request.url).searchParams.get('empresaId');
    const empresasBrutas = await db.empresa.findMany({
      // O filtro de escopo sempre vale: pedir uma empresa específica não pode abrir outra carteira.
      where: { AND: [await filtroEmpresasNfse(auth.session), ...(empresaIdParam ? [{ id: empresaIdParam }] : [])] },
      select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, uf: true, cidade: true },
      orderBy: { razaoSocial: 'asc' },
    });
    const empresas = empresasBrutas.filter(e => cnpjValido(e.cnpj));

    const ids = empresas.map(e => e.id);
    const colunas = {
      id: true, empresaId: true, tipo: true, uf: true, situacao: true, protocolo: true, emitidoEm: true, validoAte: true,
      observacoes: true, pendencias: true, criadoAutomaticamente: true, createdAt: true,
    } as const;
    // Federal traz as consultas do SITFIS e as CNDs anexadas; estadual, só o que foi anexado.
    // Os registros estaduais antigos foram gerados pelo sistema, sem consultar a SEFAZ, e ficam de fora.
    const federaisTodas = await db.certidaoFiscal.findMany({
      where: { empresaId: { in: ids }, tipo: 'FEDERAL' },
      orderBy: { createdAt: 'desc' },
      select: colunas,
    });
    const anexadas = await db.certidaoFiscal.findMany({
      where: { empresaId: { in: ids }, tipo: 'ESTADUAL', pendencias: { path: ['origem'], equals: ORIGEM_ANEXO } },
      orderBy: { createdAt: 'desc' },
      select: colunas,
    });

    const agrupar = (registros: typeof anexadas) => {
      const mapa = new Map<string, typeof anexadas>();
      for (const c of registros) {
        const lista = mapa.get(c.empresaId);
        if (lista) lista.push(c); else mapa.set(c.empresaId, [c]);
      }
      return mapa;
    };
    const federaisPorEmpresa = agrupar(federaisTodas);
    const anexadasPorEmpresa = agrupar(anexadas);

    const metricas: Record<CategoriaFederal, number> = { pendencias: 0, atencao: 0, nao_consultada: 0, com_efeito: 0, sem_pendencias: 0 };
    const lista = empresas.map(e => {
      const federaisTodasEmp = federaisPorEmpresa.get(e.id) || [];
      const consultasFederais = federaisTodasEmp.filter(c => !ehAnexoManual(c.pendencias));
      const cndFederal = federaisTodasEmp.find(c => ehAnexoManual(c.pendencias)) || null;
      const estaduaisTodas = anexadasPorEmpresa.get(e.id) || [];

      const federal = consultasFederais[0] || null;
      const categoria = categoriaFederal(federal);
      metricas[categoria]++;
      // Vale a mais recente de cada estado: uma empresa pode ter certidão de vários.
      const vistas = new Set<string>();
      const estaduais = estaduaisTodas.filter(c => {
        const uf = c.uf || '';
        if (vistas.has(uf)) return false;
        vistas.add(uf);
        return true;
      });
      const historico = [...federaisTodasEmp, ...estaduaisTodas]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 15);
      return { ...e, federal, cndFederal, categoria, estaduais, historico };
    });

    const configAgendamento = await db.certidaoConfig.findFirst({ where: { empresaId: null } });

    return NextResponse.json({
      empresas: lista,
      metricas: { total: empresas.length, ...metricas },
      configAgendamento: configAgendamento || { ativo: false, notificarEmail: true, emailsNotificacao: '' },
    });
  } catch (error) {
    console.error('Erro em GET /api/certidoes:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao listar a situação fiscal.' }, { status: 500 });
  }
}
