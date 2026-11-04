import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { acessoNegado } from '../../../../lib/nfse/servidor';
import { filtroEmpresasNfse } from '../../../../lib/nfse/escopo';
import { cnpjValido } from '../../../../lib/nfse/dps';

/** Empresas com configuração fiscal que o usuário opera, com a situação do monitor de NF-e destinadas. */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 });

    const filtro = await filtroEmpresasNfse(auth.session);
    const empresas = await db.empresa.findMany({
      where: { AND: [filtro, { nfseConfig: { isNot: null } }] },
      select: {
        id: true, razaoSocial: true, nomeFantasia: true, cnpj: true,
        nfseConfig: { select: { usarProcuracao: true, procuracaoStatus: true, certValidoAte: true } },
        nfeDistribuicao: true,
        _count: { select: { nfesDestinadas: true } },
      },
      orderBy: { razaoSocial: 'asc' },
    });

    return NextResponse.json({
      empresas: empresas
        .filter(e => cnpjValido(e.cnpj))
        .map(e => ({
          id: e.id,
          razaoSocial: e.razaoSocial,
          nomeFantasia: e.nomeFantasia,
          cnpj: e.cnpj,
          certificado: e.nfseConfig?.usarProcuracao ? 'escritorio' : (e.nfseConfig?.certValidoAte ? 'propria' : 'ausente'),
          procuracaoStatus: e.nfseConfig?.procuracaoStatus ?? null,
          monitor: e.nfeDistribuicao
            ? {
                ativo: e.nfeDistribuicao.ativo,
                ultimaConsultaEm: e.nfeDistribuicao.ultimaConsultaEm,
                proximaConsultaEm: e.nfeDistribuicao.proximaConsultaEm,
                ultimoStatus: e.nfeDistribuicao.ultimoStatus,
                ultimaMensagem: e.nfeDistribuicao.ultimaMensagem,
                ultNsu: e.nfeDistribuicao.ultNsu,
                maxNsu: e.nfeDistribuicao.maxNsu,
              }
            : null,
          totalNotas: e._count.nfesDestinadas,
        })),
    });
  } catch (error) {
    console.error('Erro em GET nfe/monitor:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao carregar o monitor de NF-e destinadas.' }, { status: 500 });
  }
}

/** Liga ou desliga o monitoramento automático de uma empresa. Nada é consultado sem estar ligado. */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const empresaId = typeof body?.empresaId === 'string' ? body.empresaId : '';
    if (!empresaId) return NextResponse.json({ error: 'Informe a empresa.' }, { status: 400 });
    const negado = await acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    const ativo = body?.ativo !== false;
    const monitor = await db.nfeDistribuicao.upsert({
      where: { empresaId },
      update: { ativo },
      create: { empresaId, ativo },
    });
    return NextResponse.json({ ativo: monitor.ativo });
  } catch (error) {
    console.error('Erro em POST nfe/monitor:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao atualizar o monitoramento.' }, { status: 500 });
  }
}

