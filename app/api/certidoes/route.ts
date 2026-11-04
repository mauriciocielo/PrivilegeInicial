import { NextResponse } from 'next/server';
import db from '../../../lib/prisma';
import { requireAuth } from '../../../lib/api-auth';
import { captureError } from '../../../lib/sentry-helper';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const empresaIdParam = url.searchParams.get('empresaId');

    // Filtra empresas acessíveis
    const whereEmpresa: any = {};
    if (auth.session.role !== 'administrador') {
      whereEmpresa.id = { in: auth.session.empresaIds };
    }
    if (empresaIdParam) {
      whereEmpresa.id = empresaIdParam;
    }

    const empresas = await db.empresa.findMany({
      where: whereEmpresa,
      select: {
        id: true,
        razaoSocial: true,
        nomeFantasia: true,
        cnpj: true,
        uf: true,
        cidade: true,
      },
      orderBy: { razaoSocial: 'asc' },
    });

    // Busca as certidões mais recentes de cada empresa
    const empresaIds = empresas.map(e => e.id);
    const ultimasCertidoes = await db.certidaoFiscal.findMany({
      where: { empresaId: { in: empresaIds } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        empresaId: true,
        tipo: true,
        uf: true,
        situacao: true,
        protocolo: true,
        numeroCertidao: true,
        codigoAutenticidade: true,
        emitidoEm: true,
        validoAte: true,
        observacoes: true,
        criadoAutomaticamente: true,
        createdAt: true,
      },
    });

    // Agrupa por empresa: mais recente federal e estadual
    const mapaCertidoes = new Map<string, { federal?: any; estadual?: any; historico: any[] }>();
    for (const c of ultimasCertidoes) {
      if (!mapaCertidoes.has(c.empresaId)) {
        mapaCertidoes.set(c.empresaId, { historico: [] });
      }
      const item = mapaCertidoes.get(c.empresaId)!;
      item.historico.push(c);
      if (c.tipo === 'FEDERAL' && !item.federal) {
        item.federal = c;
      } else if (c.tipo === 'ESTADUAL' && !item.estadual) {
        item.estadual = c;
      }
    }

    let totalRegulares = 0;
    let totalComEfeito = 0;
    let totalPendencias = 0;
    let totalNaoConsultadas = 0;

    const lista = empresas.map(e => {
      const c = mapaCertidoes.get(e.id) || { historico: [] };
      const fedSit = c.federal?.situacao;
      const estSit = c.estadual?.situacao;

      if (!fedSit && !estSit) {
        totalNaoConsultadas++;
      } else if (fedSit === 'POSITIVA' || estSit === 'POSITIVA') {
        totalPendencias++;
      } else if (fedSit === 'POSITIVA_COM_EFEITO_NEGATIVA' || estSit === 'POSITIVA_COM_EFEITO_NEGATIVA') {
        totalComEfeito++;
      } else if (fedSit === 'NEGATIVA' || estSit === 'NEGATIVA') {
        totalRegulares++;
      }

      return {
        ...e,
        federal: c.federal || null,
        estadual: c.estadual || null,
        historico: c.historico.slice(0, 10),
      };
    });

    // Configuração de agendamento automático
    const configAgendamento = await db.certidaoConfig.findFirst({
      where: { empresaId: null },
    });

    return NextResponse.json({
      empresas: lista,
      metricas: {
        total: empresas.length,
        regulares: totalRegulares,
        comEfeito: totalComEfeito,
        pendencias: totalPendencias,
        naoConsultadas: totalNaoConsultadas,
      },
      configAgendamento: configAgendamento || {
        ativo: true,
        executarUltimoDia: true,
        horario: '23:00',
        consultarFederal: true,
        consultarEstadual: true,
        notificarEmail: true,
      },
    });
  } catch (error) {
    console.error('Erro em GET /api/certidoes:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao listar certidões fiscais.' }, { status: 500 });
  }
}

