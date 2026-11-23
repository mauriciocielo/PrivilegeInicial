import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { listCampaigns, startCampaignWorker } from '../../../../lib/campaign-manager';
import {
  bootAllSavedBaileysSessions,
  getBaileysSocketForOwner,
  sendBaileysLiveMessage,
} from '../../../../lib/baileys-manager';
import { iniciarWorkerFilaEmail } from '../../../../lib/email-queue';
import { runWhatsAppBackgroundTick } from '../../../../lib/whatsapp-service';

export const dynamic = 'force-dynamic';

async function coletarSaude() {
  const agora = new Date();
  const em30Dias = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000);

  // 1. PostgreSQL latency
  let dbOk = false;
  let dbLatencyMs = 0;
  try {
    const t0 = Date.now();
    await db.$queryRawUnsafe('SELECT 1');
    dbLatencyMs = Date.now() - t0;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  // 2. Sessões WhatsApp (Baileys)
  const sessoes: Array<{ ownerId: string; status: string; conectada: boolean }> = [];
  try {
    const rows = await db.$queryRawUnsafe<Array<{ owner_id: string }>>(
      `SELECT DISTINCT owner_id FROM whatsapp_auth_state WHERE owner_id IS NOT NULL`
    );
    const owners = rows.length > 0 ? rows.map(r => r.owner_id || 'default') : ['default'];
    for (const ownerId of owners) {
      const sock = getBaileysSocketForOwner(ownerId);
      const conectada = Boolean(sock?.user);
      sessoes.push({
        ownerId,
        status: conectada ? 'conectada' : 'desconectada',
        conectada,
      });
    }
  } catch {
    const sock = getBaileysSocketForOwner('default');
    sessoes.push({
      ownerId: 'default',
      status: sock?.user ? 'conectada' : 'desconectada',
      conectada: Boolean(sock?.user),
    });
  }

  // 3. Campanhas WhatsApp 24h
  let campanhasAtivas = 0;
  let campanhasPausadas = 0;
  let campanhasTotalRestante = 0;
  try {
    const camps = await listCampaigns();
    for (const c of camps) {
      if (c.status === 'em_andamento') {
        campanhasAtivas++;
        campanhasTotalRestante += Math.max(0, Number(c.total_count || 0) - Number(c.sent_count || 0));
      } else if (c.status === 'pausada') {
        campanhasPausadas++;
      }
    }
  } catch {
    // tabela opcional
  }

  // 4. Fila de E-mail 24h
  let emailsPendentes = 0;
  let emailsErros = 0;
  try {
    const rows = await db.$queryRawUnsafe<Array<{ status: string; total: number }>>(
      `SELECT status, COUNT(*)::int AS total FROM email_queue WHERE status IN ('pendente', 'enviando', 'erro') GROUP BY status`
    );
    emailsPendentes = rows
      .filter(r => r.status === 'pendente' || r.status === 'enviando')
      .reduce((s, r) => s + Number(r.total || 0), 0);
    emailsErros = rows.find(r => r.status === 'erro')?.total || 0;
  } catch {
    // tabela opcional
  }

  // 5. Certificados Digitais A1 (vencidos ou vencendo em <= 30 dias)
  const certificadosAlerta: Array<{ nome: string; validoAte: string; vencido: boolean; dias: number }> = [];
  try {
    const certEsc = await db.nfseCertificadoEscritorio.findFirst({
      select: { titular: true, validoAte: true },
    });
    if (certEsc?.validoAte && certEsc.validoAte <= em30Dias) {
      const vencido = certEsc.validoAte < agora;
      const dias = Math.max(0, Math.ceil((certEsc.validoAte.getTime() - agora.getTime()) / (24 * 60 * 60 * 1000)));
      certificadosAlerta.push({
        nome: `Escritório (${certEsc.titular})`,
        validoAte: certEsc.validoAte.toISOString().slice(0, 10),
        vencido,
        dias,
      });
    }

    const certsEmp = await db.nfseConfig.findMany({
      where: { usarProcuracao: false, certValidoAte: { lte: em30Dias } },
      select: {
        certValidoAte: true,
        empresa: { select: { nomeFantasia: true, razaoSocial: true } },
      },
      take: 10,
    });
    for (const c of certsEmp) {
      if (!c.certValidoAte) continue;
      const vencido = c.certValidoAte < agora;
      const dias = Math.max(0, Math.ceil((c.certValidoAte.getTime() - agora.getTime()) / (24 * 60 * 60 * 1000)));
      certificadosAlerta.push({
        nome: c.empresa?.nomeFantasia || c.empresa?.razaoSocial || 'Empresa',
        validoAte: c.certValidoAte.toISOString().slice(0, 10),
        vencido,
        dias,
      });
    }
  } catch {
    // ignora
  }

  // 6. Notas NFS-e com erro pendente
  let nfseComErro = 0;
  try {
    nfseComErro = await db.nfsE.count({
      where: { status: 'rascunho', ultimoErro: { not: null } },
    });
  } catch {
    // ignora
  }

  // 7. Variáveis de ambiente críticas
  const integracoes = {
    gemini: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    serpro: Boolean(process.env.SERPRO_CONSUMER_KEY && process.env.SERPRO_CONSUMER_SECRET),
    smtp: Boolean(process.env.SMTP_HOST || process.env.EMAIL_USER),
  };

  return {
    atualizadoEm: agora.toISOString(),
    uptimeSegundos: Math.round(process.uptime()),
    banco: { ok: dbOk, latencyMs: dbLatencyMs },
    whatsapp: {
      totalSessoes: sessoes.length,
      conectadas: sessoes.filter(s => s.conectada).length,
      sessoes,
    },
    filas24h: {
      campanhasAtivas,
      campanhasPausadas,
      campanhasTotalRestante,
      emailsPendentes,
      emailsErros,
    },
    fiscal: {
      certificadosAlerta,
      nfseComErro,
    },
    integracoes,
  };
}

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  if (auth.session.role === 'cliente') {
    return NextResponse.json({ error: 'Acesso restrito a consultores e administradores.' }, { status: 403 });
  }

  const dados = await coletarSaude();
  return NextResponse.json(dados);
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  if (auth.session.role === 'cliente') {
    return NextResponse.json({ error: 'Acesso restrito a consultores e administradores.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || '');

  if (action === 'rodar_daemon') {
    const booted = await bootAllSavedBaileysSessions().catch(() => []);
    await runWhatsAppBackgroundTick().catch(() => {});
    const camps = await listCampaigns().catch(() => []);
    const ativas = camps.filter(c => c.status === 'em_andamento');
    if (ativas.length > 0) startCampaignWorker();
    iniciarWorkerFilaEmail();
    const saude = await coletarSaude();
    return NextResponse.json({
      ok: true,
      tick: { bootedSessions: booted.length, campanhasAtivas: ativas.length },
      saude,
    });
  }

  if (action === 'enviar_alerta_gestao') {
    const telefoneRaw = String(body?.telefone || '46999048990').replace(/\D/g, '');
    if (telefoneRaw.length < 10) {
      return NextResponse.json({ error: 'Informe um número de WhatsApp válido (com DDD).' }, { status: 400 });
    }
    const telefone = telefoneRaw.startsWith('55') ? telefoneRaw : `55${telefoneRaw}`;
    const saude = await coletarSaude();

    const sessaoAtiva = saude.whatsapp.sessoes.find(s => s.conectada);
    if (!sessaoAtiva) {
      return NextResponse.json(
        { error: 'Nenhuma sessão do WhatsApp está conectada no momento para enviar o alerta.' },
        { status: 422 }
      );
    }

    const linhas = [
      `🛡️ *Monitor 24h — Privilege Gestão*`,
      ``,
      `• *Banco PostgreSQL:* ${saude.banco.ok ? `OK (${saude.banco.latencyMs}ms)` : 'ERRO'}`,
      `• *WhatsApp 24h:* ${saude.whatsapp.conectadas}/${saude.whatsapp.totalSessoes} sessão(ões) conectada(s)`,
      `• *Campanhas WhatsApp:* ${saude.filas24h.campanhasAtivas} ativa(s) (${saude.filas24h.campanhasTotalRestante} envios pendentes)`,
      `• *Fila de E-mail 24h:* ${saude.filas24h.emailsPendentes} pendente(s) | ${saude.filas24h.emailsErros} falha(s)`,
      `• *NFS-e com erro:* ${saude.fiscal.nfseComErro}`,
    ];

    if (saude.fiscal.certificadosAlerta.length > 0) {
      linhas.push(``, `⚠️ *Certificados A1 em atenção:*`);
      for (const c of saude.fiscal.certificadosAlerta.slice(0, 5)) {
        linhas.push(`  - ${c.nome}: ${c.vencido ? 'VENCIDO' : `vence em ${c.dias}d (${c.validoAte})`}`);
      }
    } else {
      linhas.push(`• *Certificados A1:* Todos em dia`);
    }

    const res = await sendBaileysLiveMessage(telefone, linhas.join('\n'), undefined, sessaoAtiva.ownerId);
    if (!res?.sent) {
      return NextResponse.json({ error: 'Não foi possível enviar o alerta no WhatsApp.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, enviadoPara: telefone });
  }

  if (action === 'enviar_alerta_certificados') {
    const { enviarAlertaCertificadosWhatsApp } = await import('@/lib/certificado-alertas');
    const resultado = await enviarAlertaCertificadosWhatsApp(body?.telefone);
    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.erro || 'Falha ao enviar aviso de certificados.' }, { status: 422 });
    }
    return NextResponse.json({
      ok: true,
      enviadoPara: resultado.enviadoPara,
      quantidade: resultado.quantidade,
    });
  }

  return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
}
