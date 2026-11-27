import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { listCampaigns } from '../../../../lib/campaign-manager';
import {
  ID_ESCRITORIO_PADRAO,
  idsEmpresasDeTerceiros,
  idsEmpresasDoEscritorio,
  obterEscritorioDoUsuario,
} from '../../../../lib/nfse/escritorios-terceiros';

export const dynamic = 'force-dynamic';

export interface NotificacaoSistema {
  id: string;
  tipo: 'erro' | 'alerta' | 'ativo' | 'info';
  categoria: 'whatsapp' | 'email' | 'fiscal' | 'financeiro' | 'certificado';
  titulo: string;
  descricao: string;
  href: string;
  count?: number;
}

/**
 * Resolve estritamente quais empresaIds este usuário pode enxergar na Central de Notificações:
 * - Administrador global: todas (null = sem restrição, ou a empresaId selecionada).
 * - Contador terceiro (Contador A, Contador B...): SOMENTE empresas vinculadas ao escritório dele.
 * - Cliente / Cliente avulso: SOMENTE user.empresaIds.
 * - Consultor Privilege: SOMENTE user.empresaIds (excluindo empresas de contadores terceiros).
 */
async function resolverEscopoNotificacoes(userId: string, role: string, empresaIdQuery: string) {
  const isAdmin = role === 'administrador';
  const isCliente = role === 'cliente';
  const vinculoTerceiro = !isAdmin && !isCliente ? await obterEscritorioDoUsuario(userId) : null;
  const ehContadorTerceiro = Boolean(vinculoTerceiro);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { empresaIds: true, allowedRoutes: true },
  });
  const allowedRoutes = Array.isArray(user?.allowedRoutes) ? user!.allowedRoutes : [];
  const userEmpresaIds = Array.isArray(user?.empresaIds) ? user!.empresaIds : [];

  let empresaIdsPermitidos: string[] | null = null; // null = admin global sem filtro

  if (isAdmin) {
    empresaIdsPermitidos = null;
  } else if (vinculoTerceiro) {
    empresaIdsPermitidos = await idsEmpresasDoEscritorio(vinculoTerceiro.escritorioId);
  } else if (isCliente) {
    empresaIdsPermitidos = userEmpresaIds;
  } else {
    // Consultor interno Privilege: apenas suas empresas, nunca de contadores terceiros
    const terceiros = new Set(await idsEmpresasDeTerceiros());
    empresaIdsPermitidos = userEmpresaIds.filter(id => !terceiros.has(id));
  }

  const temEmpresaEspecifica = Boolean(empresaIdQuery && !empresaIdQuery.startsWith('grupo:'));
  let empresaAlvo: string | null = null;
  if (temEmpresaEspecifica) {
    if (empresaIdsPermitidos === null || empresaIdsPermitidos.includes(empresaIdQuery)) {
      empresaAlvo = empresaIdQuery;
    }
  }

  // Filtro Prisma pronto para consultas por empresaId
  const filtroEmpresas: { empresaId?: string | { in: string[] } } | null =
    empresaAlvo
      ? { empresaId: empresaAlvo }
      : empresaIdsPermitidos === null
        ? {}
        : empresaIdsPermitidos.length > 0
          ? { empresaId: { in: empresaIdsPermitidos } }
          : null; // null = usuário sem nenhuma empresa vinculada (não deve consultar nada!)

  return {
    isAdmin,
    isCliente,
    ehContadorTerceiro,
    vinculoTerceiro,
    allowedRoutes,
    empresaAlvo,
    filtroEmpresas,
  };
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const empresaIdQuery = (searchParams.get('empresaId') || '').trim();
    const role = (auth.session.role || '').toLowerCase();
    const escopo = await resolverEscopoNotificacoes(auth.session.userId, role, empresaIdQuery);
    const prefixo = escopo.isCliente ? '/cliente' : '/consultor';

    const itens: NotificacaoSistema[] = [];
    const agora = new Date();
    const em30Dias = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000);
    const hojeIso = agora.toISOString().slice(0, 10);

    // 1. Campanhas / Lotes WhatsApp 24h: NUNCA para clientes nem contadores terceiros;
    // para consultores, apenas se tiver acesso ao WhatsApp e somente campanhas criadas por ele (admin vê todas)
    const podeVerWhatsapp =
      escopo.isAdmin ||
      (!escopo.isCliente && !escopo.ehContadorTerceiro && (
        escopo.allowedRoutes.includes('/consultor/whatsapp') || escopo.allowedRoutes.includes('somente-whatsapp')
      ));

    if (podeVerWhatsapp) {
      try {
        const campanhas = await listCampaigns();
        const ativas = campanhas.filter(c => {
          if (c.status !== 'em_andamento') return false;
          if (escopo.isAdmin) return true;
          const owner = (c as any).owner_id || (c as any).user_id || (c as any).created_by;
          return !owner || owner === auth.session.userId;
        });
        for (const c of ativas.slice(0, 3)) {
          const total = Number(c.total_count || 0);
          const sent = Number(c.sent_count || 0);
          const prog = total > 0 ? Math.round((sent / total) * 100) : 0;
          itens.push({
            id: `camp-${c.id}`,
            tipo: 'ativo',
            categoria: 'whatsapp',
            titulo: `Lote WhatsApp ativo (${prog}%)`,
            descricao: `${c.name} — ${sent}/${total} enviados em 24h no servidor`,
            href: '/consultor/whatsapp',
            count: Math.max(0, total - sent),
          });
        }
      } catch {
        // tabela opcional
      }
    }

    // 2. Fila de E-mail 24h (Newsletter): apenas Admin ou consultor Privilege com acesso à Newsletter (nunca contador terceiro ou cliente)
    const podeVerNewsletter =
      escopo.isAdmin ||
      (!escopo.isCliente && !escopo.ehContadorTerceiro && escopo.allowedRoutes.includes('/consultor/newsletter'));

    if (podeVerNewsletter) {
      try {
        const rows = await db.$queryRawUnsafe<Array<{ status: string; total: number }>>(
          `SELECT status, COUNT(*)::int AS total FROM email_queue WHERE status IN ('pendente', 'enviando', 'erro') GROUP BY status`
        );
        const pendentes = rows.filter(r => r.status === 'pendente' || r.status === 'enviando').reduce((s, r) => s + Number(r.total || 0), 0);
        const erros = rows.find(r => r.status === 'erro')?.total || 0;
        if (pendentes > 0) {
          itens.push({
            id: 'email-queue-ativa',
            tipo: 'ativo',
            categoria: 'email',
            titulo: `Fila de E-mail 24h (${pendentes} pendente${pendentes > 1 ? 's' : ''})`,
            descricao: 'Disparo automático em andamento pelo servidor mesmo com o navegador fechado.',
            href: '/consultor/newsletter',
            count: pendentes,
          });
        }
        if (erros > 0) {
          itens.push({
            id: 'email-queue-erros',
            tipo: 'alerta',
            categoria: 'email',
            titulo: `${erros} e-mail${erros > 1 ? 's' : ''} com falha no envio`,
            descricao: 'Verifique a fila de e-mails ou configuração SMTP.',
            href: '/consultor/newsletter',
            count: erros,
          });
        }
      } catch {
        // tabela email_queue ainda não criada
      }
    }

    // 3. Certificado do Escritório (EXCLUSIVAMENTE o do próprio escritório do usuário) e Certificados A1 das empresas permitidas
    try {
      if (!escopo.isCliente) {
        const idCertEscritorio = escopo.vinculoTerceiro
          ? escopo.vinculoTerceiro.escritorioId
          : ID_ESCRITORIO_PADRAO;
        const certEsc = await db.nfseCertificadoEscritorio.findUnique({
          where: { id: idCertEscritorio },
          select: { titular: true, validoAte: true },
        });
        if (certEsc?.validoAte && certEsc.validoAte <= em30Dias) {
          const vencido = certEsc.validoAte < agora;
          const dias = Math.max(0, Math.ceil((certEsc.validoAte.getTime() - agora.getTime()) / (24 * 60 * 60 * 1000)));
          itens.push({
            id: `cert-escritorio-${idCertEscritorio}`,
            tipo: vencido ? 'erro' : 'alerta',
            categoria: 'certificado',
            titulo: vencido ? 'Certificado A1 do Escritório VENCIDO' : `Certificado A1 do Escritório vence em ${dias}d`,
            descricao: `${certEsc.titular} — renove para evitar interrupção nas emissões por procuração.`,
            href: '/consultor/nfse',
          });
        }
      }

      if (escopo.filtroEmpresas !== null) {
        const certsEmp = await db.nfseConfig.findMany({
          where: {
            ...escopo.filtroEmpresas,
            certValidoAte: { not: null, lte: em30Dias },
          },
          select: {
            empresaId: true,
            certValidoAte: true,
            empresa: { select: { nomeFantasia: true, razaoSocial: true } },
          },
          take: 5,
        });
        for (const c of certsEmp) {
          if (!c.certValidoAte) continue;
          const vencido = c.certValidoAte < agora;
          const dias = Math.max(0, Math.ceil((c.certValidoAte.getTime() - agora.getTime()) / (24 * 60 * 60 * 1000)));
          const nome = c.empresa?.nomeFantasia || c.empresa?.razaoSocial || 'Empresa';
          itens.push({
            id: `cert-${c.empresaId}`,
            tipo: vencido ? 'erro' : 'alerta',
            categoria: 'certificado',
            titulo: vencido ? `Certificado A1 vencido — ${nome}` : `Certificado A1 vence em ${dias}d — ${nome}`,
            descricao: 'Atualize o certificado digital na configuração da NFS-e.',
            href: `${prefixo}/nfse`,
          });
        }
      }
    } catch {
      // ignora erro pontual
    }

    // 4. Notas Fiscais (NFS-e) com erro de rejeição no Sefin — SOMENTE das empresas permitidas deste usuário
    if (escopo.filtroEmpresas !== null) {
      try {
        const notasComErro = await db.nfsE.count({
          where: {
            ...escopo.filtroEmpresas,
            status: 'rascunho',
            ultimoErro: { not: null },
          },
        });
        if (notasComErro > 0) {
          itens.push({
            id: 'nfse-erros',
            tipo: 'erro',
            categoria: 'fiscal',
            titulo: `${notasComErro} NFS-e com erro de transmissão`,
            descricao: 'Rascunhos rejeitados pelo Sefin aguardando ajuste e reenvio.',
            href: `${prefixo}/nfse`,
            count: notasComErro,
          });
        }
      } catch {
        // ignora
      }
    }

    // 5. Contas a Receber / Pagar vencidas — SOMENTE se a empresa estiver no escopo autorizado (e nunca para contador terceiro só-fiscal)
    if (escopo.empresaAlvo && !escopo.ehContadorTerceiro) {
      try {
        const [crVencidas, cpVencidas] = await Promise.all([
          db.contaReceber.count({
            where: {
              empresaId: escopo.empresaAlvo,
              status: 'aberto',
              dataVencimento: { lt: hojeIso },
            },
          }),
          db.contaPagar.count({
            where: {
              empresaId: escopo.empresaAlvo,
              status: 'aberto',
              dataVencimento: { lt: hojeIso },
            },
          }),
        ]);
        if (crVencidas > 0) {
          itens.push({
            id: `cr-vencidas-${escopo.empresaAlvo}`,
            tipo: 'alerta',
            categoria: 'financeiro',
            titulo: `${crVencidas} conta${crVencidas > 1 ? 's' : ''} a receber vencida${crVencidas > 1 ? 's' : ''}`,
            descricao: 'Títulos em aberto com vencimento anterior a hoje.',
            href: `${prefixo}/contas-receber`,
            count: crVencidas,
          });
        }
        if (cpVencidas > 0) {
          itens.push({
            id: `cp-vencidas-${escopo.empresaAlvo}`,
            tipo: 'alerta',
            categoria: 'financeiro',
            titulo: `${cpVencidas} conta${cpVencidas > 1 ? 's' : ''} a pagar vencida${cpVencidas > 1 ? 's' : ''}`,
            descricao: 'Compromissos em aberto com vencimento anterior a hoje.',
            href: `${prefixo}/contas-pagar`,
            count: cpVencidas,
          });
        }
      } catch {
        // ignora
      }
    }

    const criticos = itens.filter(i => i.tipo === 'erro').length;
    const alertas = itens.filter(i => i.tipo === 'alerta').length;
    const ativos24h = itens.filter(i => i.tipo === 'ativo').length;

    return NextResponse.json({
      itens,
      resumo: {
        criticos,
        alertas,
        ativos24h,
        total: itens.length,
      },
      atualizadoEm: agora.toISOString(),
    });
  } catch (error) {
    console.error('Erro em GET /api/system/notificacoes:', error);
    return NextResponse.json({
      itens: [],
      resumo: { criticos: 0, alertas: 0, ativos24h: 0, total: 0 },
    });
  }
}
