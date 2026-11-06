import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { acessoNegado } from '../../../../lib/nfse/servidor';
import { filtroEmpresasNfse } from '../../../../lib/nfse/escopo';
import { cnpjValido } from '../../../../lib/nfse/dps';
import { ehHorarioNoturnoBrasilia } from '../../../../lib/nfe/monitor';

/** Empresas com configuração fiscal que o usuário opera, com a situação do monitor de NF-e destinadas. */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const filtro = await filtroEmpresasNfse(auth.session);
    const empresas = await db.empresa.findMany({
      where: filtro,
      select: {
        id: true, razaoSocial: true, nomeFantasia: true, cnpj: true,
        nfseConfig: { select: { usarProcuracao: true, procuracaoStatus: true, certValidoAte: true, certTitular: true } },
        nfeDistribuicao: true,
        _count: { select: { nfesDestinadas: true, nfsList: true } },
      },
      orderBy: { razaoSocial: 'asc' },
    });

    return NextResponse.json({
      ehHorarioNoturno: ehHorarioNoturnoBrasilia(),
      empresas: empresas
        .filter(e => cnpjValido(e.cnpj))
        .map(e => ({
          id: e.id,
          razaoSocial: e.razaoSocial,
          nomeFantasia: e.nomeFantasia,
          cnpj: e.cnpj,
          certificado: e.nfseConfig?.usarProcuracao ? 'escritorio' : (e.nfseConfig?.certValidoAte ? 'propria' : 'ausente'),
          procuracaoStatus: e.nfseConfig?.procuracaoStatus ?? null,
          certValidoAte: e.nfseConfig?.certValidoAte ? e.nfseConfig.certValidoAte.toISOString() : null,
          certTitular: e.nfseConfig?.certTitular ?? null,
          temCertProprio: Boolean(e.nfseConfig?.certValidoAte),
          usarProcuracao: e.nfseConfig?.usarProcuracao ?? true,
          monitor: e.nfeDistribuicao
            ? {
                ativo: e.nfeDistribuicao.ativo,
                apenasNoturno: e.nfeDistribuicao.apenasNoturno,
                ultimaConsultaEm: e.nfeDistribuicao.ultimaConsultaEm,
                proximaConsultaEm: e.nfeDistribuicao.proximaConsultaEm,
                ultimoStatus: e.nfeDistribuicao.ultimoStatus,
                ultimaMensagem: e.nfeDistribuicao.ultimaMensagem,
                ultNsu: e.nfeDistribuicao.ultNsu,
                maxNsu: e.nfeDistribuicao.maxNsu,
              }
            : null,
          totalNotas: e._count.nfesDestinadas,
          totalNfse: e._count.nfsList,
          totalDocumentos: e._count.nfesDestinadas + e._count.nfsList,
        })),
    });
  } catch (error) {
    console.error('Erro em GET nfe/monitor:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao carregar o monitor de NF-e destinadas.' }, { status: 500 });
  }
}

/** Liga ou desliga o monitoramento automático ou a restrição noturna (22h às 05h). */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));

    // Ativa o monitoramento de TODAS as empresas com certificado (cria a linha de quem nunca
    // foi ativado), opcionalmente já em modo noturno. Não toca na espera da SEFAZ de quem já roda.
    if (body?.ativarTodasComCertificado === true) {
      if (auth.session.role === 'cliente') {
        return NextResponse.json({ error: 'Apenas consultores e administradores podem ativar em lote.' }, { status: 403 });
      }
      const apenasNoturno = typeof body?.apenasNoturno === 'boolean' ? body.apenasNoturno : true;
      const filtro = await filtroEmpresasNfse(auth.session);
      const empresas = await db.empresa.findMany({
        where: {
          AND: [
            filtro,
            // Tem certificado próprio (certValidoAte) ou opera pela procuração do escritório.
            { nfseConfig: { is: { OR: [{ certValidoAte: { not: null } }, { usarProcuracao: true }] } } },
          ],
        },
        // Seleciona só o necessário (evita desserializar colunas de CT-e que podem estar nulas).
        select: { id: true, nfeDistribuicao: { select: { empresaId: true } } },
      });
      const comLinha = empresas.filter(e => e.nfeDistribuicao).map(e => e.id);
      const semLinha = empresas.filter(e => !e.nfeDistribuicao).map(e => e.id);
      if (comLinha.length) {
        await db.nfeDistribuicao.updateMany({ where: { empresaId: { in: comLinha } }, data: { ativo: true, apenasNoturno } });
      }
      if (semLinha.length) {
        await db.nfeDistribuicao.createMany({ data: semLinha.map(id => ({ empresaId: id, ativo: true, apenasNoturno })), skipDuplicates: true });
      }
      return NextResponse.json({ sucesso: true, ativadas: empresas.length, criadas: semLinha.length, apenasNoturno });
    }

    // Atualização em lote de todas as empresas monitoradas (ex: ativar modo noturno em todas)
    if (body?.aplicarTodos === true && typeof body?.apenasNoturno === 'boolean') {
      if (auth.session.role === 'cliente') {
        return NextResponse.json({ error: 'Apenas consultores e administradores podem aplicar alterações globais.' }, { status: 403 });
      }
      const filtro = await filtroEmpresasNfse(auth.session);
      const empresasPermitidas = await db.empresa.findMany({
        where: filtro,
        select: { id: true },
      });
      const ids = empresasPermitidas.map(e => e.id);
      await db.nfeDistribuicao.updateMany({
        where: { empresaId: { in: ids } },
        data: { apenasNoturno: body.apenasNoturno },
      });
      return NextResponse.json({ sucesso: true, aplicadas: ids.length, apenasNoturno: body.apenasNoturno });
    }

    const empresaId = typeof body?.empresaId === 'string' ? body.empresaId : '';
    if (!empresaId) return NextResponse.json({ error: 'Informe a empresa.' }, { status: 400 });
    const negado = await acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    const data: { ativo?: boolean; apenasNoturno?: boolean } = {};
    if (typeof body?.ativo === 'boolean') data.ativo = body.ativo;
    if (typeof body?.apenasNoturno === 'boolean') data.apenasNoturno = body.apenasNoturno;

    const monitor = await db.nfeDistribuicao.upsert({
      where: { empresaId },
      update: data,
      create: { empresaId, ativo: data.ativo ?? true, apenasNoturno: data.apenasNoturno ?? false },
    });
    return NextResponse.json({ ativo: monitor.ativo, apenasNoturno: monitor.apenasNoturno });
  } catch (error) {
    console.error('Erro em POST nfe/monitor:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao atualizar o monitoramento.' }, { status: 500 });
  }
}

