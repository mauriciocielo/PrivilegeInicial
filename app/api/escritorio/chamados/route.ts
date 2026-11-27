import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import {
  ID_ESCRITORIO_PADRAO,
  obterEscritorioDoUsuario,
} from '../../../../lib/nfse/escritorios-terceiros';
import {
  ensureEscritorioRecursosTables,
  registrarAuditoriaEscritorio,
} from '../../../../lib/escritorio-recursos';
import { encontrarSessaoAdminPorNumero } from '../../../../lib/nfse/enviar-whatsapp-nfse';
import { sendBaileysLiveMessage } from '../../../../lib/baileys-manager';
import { apenasDigitos } from '../../../../lib/nfse/dps';

export const dynamic = 'force-dynamic';

const WHATSAPP_SUPORTE_PRIVILEGE = '5546999800010';

export interface MensagemChamado {
  id: string;
  autorId: string;
  autorNome: string;
  ehSuporte: boolean;
  texto: string;
  criadoEm: string;
}

/**
 * GET /api/escritorio/chamados
 * Lista os chamados do escritório parceiro (ou todos os chamados para o administrador).
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    if (auth.session.role === 'cliente') {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    await ensureEscritorioRecursosTables();
    const vinculo = await obterEscritorioDoUsuario(auth.session.userId);
    const ehAdminGeral = auth.session.role === 'administrador' && !vinculo;

    const rows = ehAdminGeral
      ? await db.$queryRawUnsafe<any[]>(
          `SELECT * FROM escritorio_chamados ORDER BY
             CASE status WHEN 'aberto' THEN 0 WHEN 'em_atendimento' THEN 1 ELSE 2 END,
             updated_at DESC
           LIMIT 120`
        )
      : await db.$queryRawUnsafe<any[]>(
          `SELECT * FROM escritorio_chamados
           WHERE escritorio_id = $1
           ORDER BY updated_at DESC
           LIMIT 100`,
          vinculo?.escritorioId || ID_ESCRITORIO_PADRAO
        );

    const chamados = rows.map((r) => ({
      id: String(r.id),
      protocolo: String(r.protocolo),
      escritorioId: String(r.escritorio_id),
      escritorioNome: String(r.escritorio_nome || ''),
      userId: String(r.user_id),
      userNome: String(r.user_nome || ''),
      userEmail: String(r.user_email || ''),
      empresaId: r.empresa_id || null,
      empresaNome: r.empresa_nome || null,
      categoria: String(r.categoria || 'duvida'),
      prioridade: String(r.prioridade || 'normal'),
      assunto: String(r.assunto || ''),
      descricao: String(r.descricao || ''),
      status: String(r.status || 'aberto'),
      mensagens: Array.isArray(r.mensagens_json) ? r.mensagens_json : [],
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
    }));

    return NextResponse.json({ ehAdminGeral, chamados });
  } catch (error) {
    console.error('Erro em GET /api/escritorio/chamados:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao carregar chamados.' }, { status: 500 });
  }
}

/**
 * POST /api/escritorio/chamados
 * Abre um novo chamado de suporte prioritário e notifica a equipe via WhatsApp.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    if (auth.session.role === 'cliente') {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    await ensureEscritorioRecursosTables();
    const body = await request.json().catch(() => ({}));
    const assunto = String(body?.assunto || '').trim().slice(0, 160);
    const descricao = String(body?.descricao || '').trim().slice(0, 4000);
    const categoria = String(body?.categoria || 'duvida').trim();
    const prioridade = body?.prioridade === 'urgente' ? 'urgente' : 'normal';
    const empresaId = typeof body?.empresaId === 'string' && body.empresaId.trim() ? body.empresaId.trim() : null;

    if (!assunto || !descricao) {
      return NextResponse.json({ error: 'Informe o assunto e a descrição do chamado.' }, { status: 400 });
    }

    const [vinculo, user, empresa] = await Promise.all([
      obterEscritorioDoUsuario(auth.session.userId),
      db.user.findUnique({ where: { id: auth.session.userId }, select: { name: true, email: true } }),
      empresaId
        ? db.empresa.findUnique({ where: { id: empresaId }, select: { razaoSocial: true, nomeFantasia: true } })
        : Promise.resolve(null),
    ]);

    const escritorioId = vinculo?.escritorioId || ID_ESCRITORIO_PADRAO;
    const escritorioNome = vinculo?.nomeEscritorio || 'Equipe Interna';
    const empresaNome = empresa ? empresa.nomeFantasia || empresa.razaoSocial : null;

    const countRows = await db.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT COUNT(*)::int AS total FROM escritorio_chamados`
    );
    const seq = Number(countRows[0]?.total || 0) + 1;
    const protocolo = `SUP-${String(seq).padStart(4, '0')}`;
    const id = crypto.randomUUID();

    await db.$executeRawUnsafe(
      `INSERT INTO escritorio_chamados
        (id, protocolo, escritorio_id, escritorio_nome, user_id, user_nome, user_email, empresa_id, empresa_nome, categoria, prioridade, assunto, descricao, status, mensagens_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'aberto', '[]'::jsonb, NOW(), NOW())`,
      id,
      protocolo,
      escritorioId,
      escritorioNome,
      auth.session.userId,
      user?.name || 'Usuário',
      user?.email || '',
      empresaId,
      empresaNome,
      categoria,
      prioridade,
      assunto,
      descricao
    );

    await registrarAuditoriaEscritorio({
      userId: auth.session.userId,
      userNome: user?.name,
      userEmail: user?.email,
      escritorioId,
      acao: 'chamado_aberto',
      empresaId,
      empresaNome,
      detalhes: `Abriu chamado #${protocolo} (${prioridade}): ${assunto}`,
    });

    // Notifica WhatsApp do suporte Privilege em segundo plano (sem falhar a criação se offline)
    (async () => {
      try {
        const ownerId = await encontrarSessaoAdminPorNumero('46999800010');
        if (!ownerId) return;
        const msg = [
          prioridade === 'urgente'
            ? `🚨 *CHAMADO URGENTE — #${protocolo}*`
            : `🎫 *Novo Chamado de Suporte — #${protocolo}*`,
          '',
          `🏢 *Escritório:* ${escritorioNome}`,
          `👤 *Solicitante:* ${user?.name || 'Usuário'} (${user?.email || ''})`,
          empresaNome ? `📄 *Empresa:* ${empresaNome}` : '',
          `🏷️ *Categoria:* ${categoria}`,
          `📌 *Assunto:* ${assunto}`,
          '',
          descricao.slice(0, 600),
        ]
          .filter(Boolean)
          .join('\n');
        await sendBaileysLiveMessage(WHATSAPP_SUPORTE_PRIVILEGE, msg, undefined, ownerId);
      } catch {
        // ignora erro de WhatsApp
      }
    })();

    return NextResponse.json({ ok: true, id, protocolo });
  } catch (error) {
    console.error('Erro em POST /api/escritorio/chamados:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao abrir chamado.' }, { status: 500 });
  }
}

/**
 * PATCH /api/escritorio/chamados
 * Adiciona resposta ao chamado e/ou altera status (aberto | em_atendimento | resolvido).
 */
export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    if (auth.session.role === 'cliente') {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    await ensureEscritorioRecursosTables();
    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || '').trim();
    const resposta = typeof body?.resposta === 'string' ? body.resposta.trim() : '';
    const novoStatus =
      body?.status === 'aberto' || body?.status === 'em_atendimento' || body?.status === 'resolvido'
        ? body.status
        : null;

    if (!id) return NextResponse.json({ error: 'ID do chamado obrigatório.' }, { status: 400 });

    const [vinculo, user, rows] = await Promise.all([
      obterEscritorioDoUsuario(auth.session.userId),
      db.user.findUnique({ where: { id: auth.session.userId }, select: { name: true, email: true } }),
      db.$queryRawUnsafe<any[]>(`SELECT * FROM escritorio_chamados WHERE id = $1 LIMIT 1`, id),
    ]);

    const chamado = rows[0];
    if (!chamado) return NextResponse.json({ error: 'Chamado não encontrado.' }, { status: 404 });

    const ehAdminGeral = auth.session.role === 'administrador' && !vinculo;
    if (!ehAdminGeral && String(chamado.escritorio_id) !== (vinculo?.escritorioId || ID_ESCRITORIO_PADRAO)) {
      return NextResponse.json({ error: 'Sem permissão para acessar este chamado.' }, { status: 403 });
    }

    const mensagensAtuais: MensagemChamado[] = Array.isArray(chamado.mensagens_json) ? chamado.mensagens_json : [];
    if (resposta) {
      mensagensAtuais.push({
        id: crypto.randomUUID(),
        autorId: auth.session.userId,
        autorNome: user?.name || (ehAdminGeral ? 'Suporte' : 'Contador'),
        ehSuporte: ehAdminGeral,
        texto: resposta.slice(0, 3000),
        criadoEm: new Date().toISOString(),
      });
    }

    const statusFinal = novoStatus || (ehAdminGeral && resposta && chamado.status === 'aberto' ? 'em_atendimento' : chamado.status);

    await db.$executeRawUnsafe(
      `UPDATE escritorio_chamados
       SET status = $2, mensagens_json = $3::jsonb, updated_at = NOW()
       WHERE id = $1`,
      id,
      statusFinal,
      JSON.stringify(mensagensAtuais)
    );

    // Se o suporte respondeu/resolveu, avisa o WhatsApp do escritório parceiro (quando houver telefone)
    if (ehAdminGeral && String(chamado.escritorio_id) !== ID_ESCRITORIO_PADRAO && (resposta || novoStatus === 'resolvido')) {
      (async () => {
        try {
          const escRows = await db.$queryRawUnsafe<Array<{ telefone: string | null }>>(
            `SELECT telefone FROM nfse_escritorios WHERE id = $1 LIMIT 1`,
            String(chamado.escritorio_id)
          );
          const tel = apenasDigitos(escRows[0]?.telefone || '');
          if (tel.length < 10) return;
          const ownerId = await encontrarSessaoAdminPorNumero('46999800010');
          if (!ownerId) return;
          const destino = tel.startsWith('55') ? tel : `55${tel}`;
          const msg = [
            `💬 *Atualização do Chamado #${chamado.protocolo}*`,
            `📌 *Assunto:* ${chamado.assunto}`,
            `✅ *Status:* ${statusFinal === 'resolvido' ? 'Resolvido' : 'Em atendimento'}`,
            resposta ? `\n*Resposta do Suporte:*\n${resposta.slice(0, 600)}` : '',
          ]
            .filter(Boolean)
            .join('\n');
          await sendBaileysLiveMessage(destino, msg, undefined, ownerId);
        } catch {
          // ignora
        }
      })();
    }

    return NextResponse.json({ ok: true, status: statusFinal, mensagens: mensagensAtuais });
  } catch (error) {
    console.error('Erro em PATCH /api/escritorio/chamados:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao atualizar chamado.' }, { status: 500 });
  }
}
