import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import {
  ID_ESCRITORIO_PADRAO,
  obterEscritorioDoUsuario,
} from '../../../../lib/nfse/escritorios-terceiros';
import { registrarAuditoriaEscritorio } from '../../../../lib/escritorio-recursos';
import { encontrarSessaoAdminPorNumero } from '../../../../lib/nfse/enviar-whatsapp-nfse';
import { sendBaileysLiveMessage } from '../../../../lib/baileys-manager';

export const dynamic = 'force-dynamic';

const DESCONTO_POR_INDICACAO_ATIVA = 100; // R$ 100/mês de crédito recorrente por escritório parceiro ativo
const WHATSAPP_COMERCIAL = '5546999800010';

let tabelaIndicacoesGarantida = false;

async function ensureIndicacoesTable() {
  if (tabelaIndicacoesGarantida) return;
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS escritorio_indicacoes (
      id TEXT PRIMARY KEY,
      escritorio_id TEXT NOT NULL,
      escritorio_nome TEXT NOT NULL DEFAULT '',
      indicador_user_id TEXT NOT NULL,
      indicado_nome TEXT NOT NULL,
      indicado_escritorio TEXT NOT NULL DEFAULT '',
      indicado_whatsapp TEXT NOT NULL DEFAULT '',
      indicado_email TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pendente',
      desconto_mensal DOUBLE PRECISION NOT NULL DEFAULT 100,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_esc_ind_esc ON escritorio_indicacoes(escritorio_id, created_at DESC)`
  );
  tabelaIndicacoesGarantida = true;
}

/**
 * GET /api/escritorio/indicacoes
 * Programa "Indique um Contador" (Mensalidade Zero / Revenue Share):
 * Retorna código de indicação, estatísticas de desconto acumulado e lista de indicações.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    if (auth.session.role === 'cliente') {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    await ensureIndicacoesTable();
    const vinculo = await obterEscritorioDoUsuario(auth.session.userId);
    const ehAdminGeral = auth.session.role === 'administrador' && !vinculo;
    const escritorioId = vinculo?.escritorioId || ID_ESCRITORIO_PADRAO;

    const rows = ehAdminGeral
      ? await db.$queryRawUnsafe<any[]>(`SELECT * FROM escritorio_indicacoes ORDER BY created_at DESC LIMIT 150`)
      : await db.$queryRawUnsafe<any[]>(
          `SELECT * FROM escritorio_indicacoes WHERE escritorio_id = $1 ORDER BY created_at DESC LIMIT 100`,
          escritorioId
        );

    const indicacoes = rows.map((r) => ({
      id: String(r.id),
      escritorioId: String(r.escritorio_id),
      escritorioNome: String(r.escritorio_nome || ''),
      indicadoNome: String(r.indicado_nome || ''),
      indicadoEscritorio: String(r.indicado_escritorio || ''),
      indicadoWhatsapp: String(r.indicado_whatsapp || ''),
      indicadoEmail: String(r.indicado_email || ''),
      status: String(r.status || 'pendente'),
      descontoMensal: Number(r.desconto_mensal || DESCONTO_POR_INDICACAO_ATIVA),
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));

    const ativas = indicacoes.filter((i) => i.status === 'ativo');
    const descontoMensalTotal = ativas.reduce((acc, i) => acc + i.descontoMensal, 0);
    const codigoRef = `PARCEIRO-${escritorioId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}`;

    const origin =
      request.headers.get('origin') ||
      (request.headers.get('host') ? `https://${request.headers.get('host')}` : 'https://privilegecontabilidade.cnt.br');
    const linkIndicacao = `${origin.replace(/\/$/, '')}/?ref=${codigoRef}`;

    return NextResponse.json({
      ehAdminGeral,
      codigoRef,
      linkIndicacao,
      descontoPorIndicacao: DESCONTO_POR_INDICACAO_ATIVA,
      resumo: {
        total: indicacoes.length,
        pendentes: indicacoes.filter((i) => i.status === 'pendente' || i.status === 'em_negociacao').length,
        ativas: ativas.length,
        descontoMensalTotal,
      },
      indicacoes,
    });
  } catch (error) {
    console.error('Erro em GET /api/escritorio/indicacoes:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao carregar indicações.' }, { status: 500 });
  }
}

/**
 * POST /api/escritorio/indicacoes
 * Registra uma indicação de outro contador/escritório e avisa o time comercial no WhatsApp.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    if (auth.session.role === 'cliente') {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    await ensureIndicacoesTable();
    const body = await request.json().catch(() => ({}));
    const indicadoNome = String(body?.indicadoNome || '').trim().slice(0, 120);
    const indicadoEscritorio = String(body?.indicadoEscritorio || '').trim().slice(0, 140);
    const indicadoWhatsapp = String(body?.indicadoWhatsapp || '').trim().slice(0, 30);
    const indicadoEmail = String(body?.indicadoEmail || '').trim().toLowerCase().slice(0, 140);

    if (!indicadoNome || (!indicadoWhatsapp && !indicadoEmail)) {
      return NextResponse.json({ error: 'Informe o nome do contador indicado e WhatsApp ou e-mail.' }, { status: 400 });
    }

    const vinculo = await obterEscritorioDoUsuario(auth.session.userId);
    const escritorioId = vinculo?.escritorioId || ID_ESCRITORIO_PADRAO;
    const escritorioNome = vinculo?.nomeEscritorio || 'Equipe Interna';
    const id = crypto.randomUUID();

    await db.$executeRawUnsafe(
      `INSERT INTO escritorio_indicacoes
        (id, escritorio_id, escritorio_nome, indicador_user_id, indicado_nome, indicado_escritorio, indicado_whatsapp, indicado_email, status, desconto_mensal, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pendente', $9, NOW(), NOW())`,
      id,
      escritorioId,
      escritorioNome,
      auth.session.userId,
      indicadoNome,
      indicadoEscritorio,
      indicadoWhatsapp,
      indicadoEmail,
      DESCONTO_POR_INDICACAO_ATIVA
    );

    await registrarAuditoriaEscritorio({
      userId: auth.session.userId,
      escritorioId,
      acao: 'indicacao_contador_criada',
      detalhes: `Indicou ${indicadoNome} (${indicadoEscritorio || 'Escritório'}) para o programa de parceiros`,
    });

    (async () => {
      try {
        const ownerId = await encontrarSessaoAdminPorNumero('46999800010');
        if (!ownerId) return;
        const msg = [
          `🤝 *Nova Indicação de Contador Parceiro!*`,
          '',
          `🏆 *Indicado por:* ${escritorioNome}`,
          `👤 *Nome:* ${indicadoNome}`,
          indicadoEscritorio ? `🏢 *Escritório:* ${indicadoEscritorio}` : '',
          indicadoWhatsapp ? `📱 *WhatsApp:* ${indicadoWhatsapp}` : '',
          indicadoEmail ? `📧 *E-mail:* ${indicadoEmail}` : '',
        ]
          .filter(Boolean)
          .join('\n');
        await sendBaileysLiveMessage(WHATSAPP_COMERCIAL, msg, undefined, ownerId);
      } catch {
        // ignora
      }
    })();

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error('Erro em POST /api/escritorio/indicacoes:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao registrar indicação.' }, { status: 500 });
  }
}

/**
 * PATCH /api/escritorio/indicacoes
 * Administrador geral atualiza o status de uma indicação (em_negociacao | ativo | cancelado).
 */
export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role !== 'administrador') {
      return NextResponse.json({ error: 'Apenas o administrador geral pode aprovar indicações.' }, { status: 403 });
    }

    await ensureIndicacoesTable();
    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || '').trim();
    const status = String(body?.status || '').trim();
    if (!id || !['pendente', 'em_negociacao', 'ativo', 'cancelado'].includes(status)) {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
    }

    await db.$executeRawUnsafe(
      `UPDATE escritorio_indicacoes SET status = $2, updated_at = NOW() WHERE id = $1`,
      id,
      status
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro em PATCH /api/escritorio/indicacoes:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao atualizar status da indicação.' }, { status: 500 });
  }
}
