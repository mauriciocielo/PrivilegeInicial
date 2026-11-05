import { NextResponse } from 'next/server';
import db from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/api-auth';
import { captureError } from '../../../../../lib/sentry-helper';
import { filtroEmpresasNfse } from '../../../../../lib/nfse/escopo';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get('empresaId');
    const tipo = searchParams.get('tipo');
    const status = searchParams.get('status');
    const apenasErros = searchParams.get('apenasErros') === 'true';
    const limit = Math.min(200, Math.max(10, Number(searchParams.get('limit') || 60)));

    const filtroEmpresas = await filtroEmpresasNfse(auth.session);
    const empresasPermitidas = await db.empresa.findMany({
      where: filtroEmpresas,
      select: { id: true },
    });
    const idsPermitidos = empresasPermitidas.map(e => e.id);

    const isCliente = auth.session.role === 'cliente';
    const where: any = isCliente
      ? { empresaId: { in: idsPermitidos } }
      : {
          OR: [
            { empresaId: { in: idsPermitidos } },
            { empresaId: null }, // Logs gerais do lote/cron
          ],
        };

    if (empresaId && empresaId !== 'todas') {
      where.empresaId = empresaId;
    }

    if (tipo && tipo !== 'todos') {
      where.tipo = tipo;
    }

    if (apenasErros) {
      where.status = { in: ['erro', 'alerta'] };
    } else if (status && status !== 'todos') {
      where.status = status;
    }

    const [logs, totalErros24h, totalGeral] = await Promise.all([
      db.fiscalMonitorLog.findMany({
        where,
        include: {
          empresa: {
            select: {
              id: true,
              razaoSocial: true,
              nomeFantasia: true,
              cnpj: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      db.fiscalMonitorLog.count({
        where: {
          ...where,
          status: 'erro',
          createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
        },
      }),
      db.fiscalMonitorLog.count({ where }),
    ]);

    return NextResponse.json({
      logs: logs.map(l => ({
        id: l.id,
        empresaId: l.empresaId,
        empresaNome: l.empresa?.nomeFantasia || l.empresa?.razaoSocial || 'Monitor Geral / Lote',
        empresaCnpj: l.empresa?.cnpj || '',
        tipo: l.tipo,
        origem: l.origem,
        status: l.status,
        cStat: l.cStat,
        mensagem: l.mensagem,
        novas: l.novas,
        atualizadas: l.atualizadas,
        detalhes: l.detalhes,
        createdAt: l.createdAt.toISOString(),
      })),
      totalErros24h,
      totalGeral,
    });
  } catch (error) {
    console.error('Erro em GET nfe/monitor/logs:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao carregar logs do monitor fiscal.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role !== 'administrador') return NextResponse.json({ error: 'Apenas administradores podem limpar logs.' }, { status: 403 });

    // Mantém logs dos últimos 3 dias e apaga anteriores
    const dias = 3;
    const dataCorte = new Date(Date.now() - dias * 24 * 3600 * 1000);
    const { count } = await db.fiscalMonitorLog.deleteMany({
      where: { createdAt: { lt: dataCorte } },
    });

    return NextResponse.json({ sucesso: true, apagados: count });
  } catch (error) {
    console.error('Erro em DELETE nfe/monitor/logs:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao limpar logs.' }, { status: 500 });
  }
}

