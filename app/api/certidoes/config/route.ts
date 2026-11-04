import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    let config = await db.certidaoConfig.findFirst({
      where: { empresaId: null },
    });

    if (!config) {
      config = await db.certidaoConfig.create({
        data: {
          id: 'global_config',
          ativo: true,
          executarUltimoDia: true,
          horario: '23:00',
          consultarFederal: true,
          consultarEstadual: true,
          notificarEmail: true,
          emailsNotificacao: 'contato@privilegecontabilidade.com.br',
          notificarApenasComPendencias: true,
        },
      });
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Erro em GET /api/certidoes/config:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao obter configuração de certidões.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    if (auth.session.role !== 'administrador' && auth.session.role !== 'consultor') {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      ativo = true,
      executarUltimoDia = true,
      horario = '23:00',
      consultarFederal = true,
      consultarEstadual = true,
      notificarEmail = true,
      emailsNotificacao = '',
      notificarApenasComPendencias = true,
    } = body;

    const config = await db.certidaoConfig.upsert({
      where: { id: 'global_config' },
      create: {
        id: 'global_config',
        ativo,
        executarUltimoDia,
        horario,
        consultarFederal,
        consultarEstadual,
        notificarEmail,
        emailsNotificacao,
        notificarApenasComPendencias,
      },
      update: {
        ativo,
        executarUltimoDia,
        horario,
        consultarFederal,
        consultarEstadual,
        notificarEmail,
        emailsNotificacao,
        notificarApenasComPendencias,
      },
    });

    return NextResponse.json({ sucesso: true, config });
  } catch (error) {
    console.error('Erro em POST /api/certidoes/config:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao salvar configuração.' }, { status: 500 });
  }
}

