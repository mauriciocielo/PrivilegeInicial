import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { listCampaigns } from '../../../../lib/campaign-manager';

export interface NotificacaoSistema {
  id: string;
  tipo: 'erro' | 'alerta' | 'ativo' | 'info';
  categoria: 'whatsapp' | 'email' | 'fiscal' | 'financeiro' | 'certificado';
  titulo: string;
  descricao: string;
  href: string;
  count?: number;
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const empresaId = (searchParams.get('empresaId') || '').trim();
    const role = (auth.session.role || '').toLowerCase();
    const isCliente = role === 'cliente';
    const prefixo = isCliente ? '/cliente' : '/consultor';

    const itens: NotificacaoSistema[] = [];
    const agora = new Date();
    const em30Dias = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000);
    const hojeIso = agora.toISOString().slice(0, 10);

    // 1. Campanhas / Lotes WhatsApp 24h em andamento (Consultor/Admin)
    if (!isCliente) {
      try {
        const campanhas = await listCampaigns();
        const ativas = campanhas.filter(c => c.status === 'em_andamento');
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

    // 2. Fila de E-mail 24h (Consultor/Admin)
    if (!isCliente) {
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

    // 3. Certificado do Escritório (Consultor/Admin) e Certificados A1 das empresas
    try {
      if (!isCliente) {
        const certEsc = await db.nfseCertificadoEscritorio.findFirst({
          select: { titular: true, validoAte: true },
        });
        if (certEsc?.validoAte && certEsc.validoAte <= em30Dias) {
          const vencido = certEsc.validoAte < agora;
          const dias = Math.max(0, Math.ceil((certEsc.validoAte.getTime() - agora.getTime()) / (24 * 60 * 60 * 1000)));
          itens.push({
            id: 'cert-escritorio',
            tipo: vencido ? 'erro' : 'alerta',
            categoria: 'certificado',
            titulo: vencido ? 'Certificado A1 do Escritório VENCIDO' : `Certificado A1 do Escritório vence em ${dias}d`,
            descricao: `${certEsc.titular} — renove para evitar interrupção nas emissões por procuração.`,
            href: '/consultor/nfse',
          });
        }
      }

      const filtroEmpresa = empresaId && !empresaId.startsWith('grupo:') ? { empresaId } : {};
      const certsEmp = await db.nfseConfig.findMany({
        where: {
          ...filtroEmpresa,
          usarProcuracao: false,
          certValidoAte: { lte: em30Dias },
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
    } catch {
      // ignora erro pontual
    }

    // 4. Notas Fiscais (NFS-e) com erro de rejeição no Sefin
    try {
      const filtroEmpresa = empresaId && !empresaId.startsWith('grupo:') ? { empresaId } : {};
      const notasComErro = await db.nfsE.count({
        where: {
          ...filtroEmpresa,
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

    // 5. Contas a Receber / Pagar vencidas (empresa selecionada)
    if (empresaId && !empresaId.startsWith('grupo:')) {
      try {
        const [crVencidas, cpVencidas] = await Promise.all([
          db.contaReceber.count({
            where: {
              empresaId,
              status: 'aberto',
              dataVencimento: { lt: hojeIso },
            },
          }),
          db.contaPagar.count({
            where: {
              empresaId,
              status: 'aberto',
              dataVencimento: { lt: hojeIso },
            },
          }),
        ]);
        if (crVencidas > 0) {
          itens.push({
            id: `cr-vencidas-${empresaId}`,
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
            id: `cp-vencidas-${empresaId}`,
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
