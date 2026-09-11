import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';

const STATUS_VALIDOS = ['ABERTO', 'EM_ANDAMENTO', 'ATRASADO', 'CONCLUIDO'];

/**
 * Monitor de SLA de fechamento contábil — antes era só uma barra de
 * progresso fake (`100 - index*25`) em app/consultor/bpo/page.tsx. O modelo
 * SLAFechamento já existia no banco (aplicado direto em produção por outra
 * sessão, sem rota nenhuma usando ele ainda) — esta rota é o primeiro
 * consumidor real.
 *
 * GET /api/bpo/sla?competencia=2026-09 — uma linha por empresa no escopo da
 * sessão; empresas sem registro ainda para a competência voltam com
 * status "ABERTO"/progresso 0 (sem criar linha no banco à toa).
 */
export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const competencia = url.searchParams.get('competencia');
    if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
      return NextResponse.json({ error: 'Informe competencia no formato YYYY-MM.' }, { status: 400 });
    }

    const isAdmin = auth.session.role === 'administrador';
    const empresas = await db.empresa.findMany({
      where: isAdmin ? {} : { id: { in: auth.session.empresaIds } },
      select: { id: true, nomeFantasia: true, razaoSocial: true },
      orderBy: { nomeFantasia: 'asc' },
    });

    const registros = await db.sLAFechamento.findMany({
      where: { competencia, empresaId: { in: empresas.map(e => e.id) } },
    });
    const porEmpresa = new Map(registros.map(r => [r.empresaId, r]));

    const linhas = empresas.map(e => {
      const r = porEmpresa.get(e.id);
      return {
        empresaId: e.id,
        nomeFantasia: e.nomeFantasia || e.razaoSocial,
        competencia,
        status: r?.status || 'ABERTO',
        percentualProgresso: r?.percentualProgresso ?? 0,
        responsavelId: r?.responsavelId || null,
        updatedAt: r?.updatedAt || null,
      };
    });

    return NextResponse.json({ linhas });
  } catch (error) {
    console.error('Erro em GET /api/bpo/sla:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao carregar o monitor de SLA.' }, { status: 500 });
  }
}

/** PUT /api/bpo/sla — upsert de uma linha (empresaId + competencia). */
export async function PUT(request: Request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { empresaId, competencia, status, percentualProgresso, responsavelId } = body || {};

    if (auth.session.role !== 'administrador' && !auth.session.empresaIds.includes(empresaId)) {
      return NextResponse.json({ error: 'Sem acesso a esta empresa.' }, { status: 403 });
    }
    if (!empresaId || !competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
      return NextResponse.json({ error: 'empresaId e competencia (YYYY-MM) são obrigatórios.' }, { status: 422 });
    }
    if (status !== undefined && !STATUS_VALIDOS.includes(status)) {
      return NextResponse.json({ error: `status deve ser um de: ${STATUS_VALIDOS.join(', ')}.` }, { status: 422 });
    }
    if (percentualProgresso !== undefined && (typeof percentualProgresso !== 'number' || percentualProgresso < 0 || percentualProgresso > 100)) {
      return NextResponse.json({ error: 'percentualProgresso deve ser um número entre 0 e 100.' }, { status: 422 });
    }

    const registro = await db.sLAFechamento.upsert({
      where: { empresaId_competencia: { empresaId, competencia } },
      update: {
        ...(status !== undefined ? { status } : {}),
        ...(percentualProgresso !== undefined ? { percentualProgresso } : {}),
        ...(responsavelId !== undefined ? { responsavelId: responsavelId || null } : {}),
      },
      create: {
        empresaId, competencia,
        status: status || 'ABERTO',
        percentualProgresso: percentualProgresso ?? 0,
        responsavelId: responsavelId || null,
      },
    });

    return NextResponse.json(registro);
  } catch (error) {
    console.error('Erro em PUT /api/bpo/sla:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao salvar o SLA.' }, { status: 500 });
  }
}
