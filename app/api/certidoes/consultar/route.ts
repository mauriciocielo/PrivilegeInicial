import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { processarCertidaoEmpresa } from '../../../../lib/certidoes/gerenciador-certidoes';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const { empresaId, todas, federal = true, estadual = true } = body;

    // Consulta em lote para todas as empresas acessíveis
    if (todas === true) {
      const whereEmpresa: any = {};
      if (auth.session.role !== 'administrador') {
        whereEmpresa.id = { in: auth.session.empresaIds };
      }

      const empresas = await db.empresa.findMany({
        where: whereEmpresa,
        select: { id: true },
        take: 50, // Limite seguro por lote
      });

      const resultados = [];
      for (const e of empresas) {
        try {
          const res = await processarCertidaoEmpresa(e.id, {
            federal,
            estadual,
            automatico: false,
          });
          resultados.push(res);
        } catch (err) {
          console.error(`Erro ao consultar empresa ${e.id} no lote:`, err);
        }
      }

      return NextResponse.json({
        sucesso: true,
        total: resultados.length,
        resultados,
      });
    }

    // Consulta de uma única empresa
    if (!empresaId) {
      return NextResponse.json({ error: 'Selecione a empresa para consultar.' }, { status: 400 });
    }

    if (auth.session.role !== 'administrador' && !auth.session.empresaIds.includes(empresaId)) {
      return NextResponse.json({ error: 'Sem acesso a esta empresa.' }, { status: 403 });
    }

    const resultado = await processarCertidaoEmpresa(empresaId, {
      federal,
      estadual,
      automatico: false,
    });

    return NextResponse.json({
      sucesso: true,
      resultado,
    });
  } catch (error) {
    console.error('Erro em POST /api/certidoes/consultar:', error);
    captureError(error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Erro ao processar consulta de certidões.',
    }, { status: 500 });
  }
}

