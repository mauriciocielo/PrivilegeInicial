import { NextResponse } from 'next/server';
import db from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/api-auth';
import { ensureTarefasTable, isConsultorOrAdmin, mapRowToTarefa } from '../../../../../lib/tarefas-db';
import { apenasDigitos } from '../../../../../lib/nfse/dps';
import { encontrarSessaoAdminPorNumero } from '../../../../../lib/nfse/enviar-whatsapp-nfse';
import { buscarGrupoWhatsAppEmpresa } from '../../../../../lib/agenda-lembretes';
import { listarSessoesBaileysAtivas, sendBaileysLiveMessage } from '../../../../../lib/baileys-manager';
import { resolveWhatsAppOwnerId } from '../../../../../lib/whatsapp-owner';
import { registrarDisparoWhatsApp } from '../../../../../lib/whatsapp-disparos-log';

export const dynamic = 'force-dynamic';

const PRIORIDADE_LABEL: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'URGENTE',
};

function fmtPrazo(prazo: string | null): string {
  if (!prazo) return 'Sem prazo definido';
  const [a, m, d] = prazo.split('-');
  return a && m && d ? `${d}/${m}/${a}` : prazo;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (!isConsultorOrAdmin(auth.session.role)) {
      return NextResponse.json({ error: 'Sem permissão para disparar aviso.' }, { status: 403 });
    }

    await ensureTarefasTable();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const tipoAviso = body?.tipo === 'lembrete' ? 'lembrete' : 'nova';

    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT
         t.*,
         COALESCE(e."nomeFantasia", e."razaoSocial") AS empresa_nome,
         u.name AS responsavel_nome,
         u.phone AS responsavel_phone
       FROM cf_tarefas t
       LEFT JOIN "Empresa" e ON e.id = t.empresa_id
       LEFT JOIN "User" u ON u.id = t.responsavel_user_id
       WHERE t.id = $1 LIMIT 1`,
      id
    );
    if (!rows[0]) {
      return NextResponse.json({ error: 'Tarefa não encontrada.' }, { status: 404 });
    }
    const tarefa = mapRowToTarefa(rows[0]);

    let destino = '';
    let destinoNome = '';

    // 1. Se destinada a cliente/ambos e tem empresa com grupo vinculado, envia no grupo do cliente
    if ((tarefa.destinoTipo === 'cliente' || tarefa.destinoTipo === 'ambos') && tarefa.empresaId) {
      const grupo = await buscarGrupoWhatsAppEmpresa(tarefa.empresaId);
      if (grupo?.groupJid) {
        destino = grupo.groupJid;
        destinoNome = grupo.groupName;
      }
    }

    // 2. Fallback: telefone do usuário responsável (ou telefone manual enviado no body)
    if (!destino) {
      const telRaw = typeof body?.telefone === 'string' && body.telefone.trim()
        ? body.telefone.trim()
        : (tarefa.responsavelPhone || '');
      const dig = apenasDigitos(telRaw);
      if (dig.length >= 10) {
        destino = dig.startsWith('55') ? dig : `55${dig}`;
        destinoNome = tarefa.responsavelNome || telRaw;
      }
    }

    if (!destino) {
      return NextResponse.json(
        { error: 'Nenhum grupo WhatsApp vinculado à empresa e nenhum telefone cadastrado para o responsável.' },
        { status: 400 }
      );
    }

    const cabecalho = tipoAviso === 'lembrete'
      ? '⏰ *Lembrete de Tarefa — Privilege*'
      : '📋 *Nova Tarefa Atribuída — Privilege*';

    const linhas = [
      cabecalho,
      '',
      `*Tarefa:* ${tarefa.titulo}`,
      tarefa.empresaNome ? `*Empresa:* ${tarefa.empresaNome}` : '',
      tarefa.responsavelNome ? `*Responsável:* ${tarefa.responsavelNome}` : '',
      `*Prioridade:* ${PRIORIDADE_LABEL[tarefa.prioridade] || tarefa.prioridade}`,
      `*Prazo:* ${fmtPrazo(tarefa.prazo)}`,
      tarefa.recorrente ? `*Recorrência:* Mensal (todo dia ${tarefa.recorrenciaDia || '--'})` : '',
      tarefa.descricao ? `\n*Detalhes:*\n${tarefa.descricao}` : '',
      tarefa.subtarefas.length > 0
        ? `\n*Checklist:*\n${tarefa.subtarefas.map(s => `${s.concluida ? '✅' : '⬜'} ${s.titulo}`).join('\n')}`
        : '',
      tarefa.visivelCliente ? '\n_Você pode acompanhar, comentar e anexar comprovantes direto no Portal do Cliente em *Tarefas*._' : '',
    ].filter(Boolean);

    const mensagem = linhas.join('\n');

    const ownerIdPreferencial = resolveWhatsAppOwnerId(request);
    const ownerId = await encontrarSessaoAdminPorNumero('46999800010', ownerIdPreferencial);
    if (!ownerId) {
      const ativas = listarSessoesBaileysAtivas().map(s => `${s.ownerId}:${s.connected ? 'on' : 'off'}`).join(', ');
      const erroMsg = `WhatsApp não está conectado no servidor no momento (${ativas || '0 sessões'}).`;
      await registrarDisparoWhatsApp({ categoria: 'agenda_criacao', destino, destinoNome, mensagem, status: 'erro', erro: erroMsg });
      return NextResponse.json({ error: erroMsg }, { status: 422 });
    }

    const res = await sendBaileysLiveMessage(destino, mensagem, undefined, ownerId);
    await registrarDisparoWhatsApp({
      categoria: 'agenda_criacao',
      destino,
      destinoNome,
      mensagem,
      status: res?.sent ? 'enviado' : 'erro',
      erro: res?.sent ? null : (res?.error || `sessão ${ownerId}`),
      ownerId,
    });

    if (!res?.sent) {
      return NextResponse.json(
        { error: `Falha ao entregar mensagem no WhatsApp (${res?.error || ownerId}).` },
        { status: 500 }
      );
    }

    await db.$executeRawUnsafe(`UPDATE cf_tarefas SET notificado_whatsapp_em = NOW() WHERE id = $1`, id);

    return NextResponse.json({
      ok: true,
      destino,
      destinoNome,
      isGrupo: destino.endsWith('@g.us'),
    });
  } catch (error) {
    console.error('Erro em POST /api/tarefas/[id]/notificar-whatsapp:', error);
    return NextResponse.json({ error: 'Erro interno ao notificar tarefa no WhatsApp.' }, { status: 500 });
  }
}
