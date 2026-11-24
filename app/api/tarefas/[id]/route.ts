import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import {
  calcularProximoPrazoMensal,
  ensureTarefasTable,
  isConsultorOrAdmin,
  mapRowToTarefa,
  type TarefaRecord,
} from '../../../../lib/tarefas-db';
import { obterEscritorioDoUsuario } from '../../../../lib/nfse/escritorios-terceiros';

export const dynamic = 'force-dynamic';

async function carregarTarefa(id: string) {
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
  return rows[0] ? mapRowToTarefa(rows[0]) : null;
}

function clientePodeAcessar(tarefa: TarefaRecord, userId: string, empresaIds: string[]): boolean {
  if (!tarefa.visivelCliente) return false;
  if (tarefa.responsavelUserId === userId) return true;
  if (tarefa.empresaId && empresaIds.includes(tarefa.empresaId)) return true;
  return false;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role !== 'administrador' && await obterEscritorioDoUsuario(auth.session.userId)) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
    }
    await ensureTarefasTable();

    const { id } = await context.params;
    const atual = await carregarTarefa(id);
    if (!atual) {
      return NextResponse.json({ error: 'Tarefa não encontrada.' }, { status: 404 });
    }

    const ehEquipe = isConsultorOrAdmin(auth.session.role);
    const empIds = Array.isArray(auth.session.empresaIds) ? auth.session.empresaIds : [];
    if (!ehEquipe && !clientePodeAcessar(atual, auth.session.userId, empIds)) {
      return NextResponse.json({ error: 'Sem permissão para alterar esta tarefa.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));

    const novoStatus = ['a_fazer', 'em_andamento', 'aguardando', 'concluida'].includes(body?.status)
      ? body.status
      : atual.status;

    const titulo = ehEquipe && typeof body?.titulo === 'string' && body.titulo.trim()
      ? body.titulo.trim()
      : atual.titulo;
    const descricao = ehEquipe && typeof body?.descricao === 'string'
      ? body.descricao.trim()
      : atual.descricao;
    const prioridade = ehEquipe && ['baixa', 'media', 'alta', 'urgente'].includes(body?.prioridade)
      ? body.prioridade
      : atual.prioridade;
    const categoria = ehEquipe && typeof body?.categoria === 'string'
      ? body.categoria.trim()
      : atual.categoria;
    const destinoTipo = ehEquipe && ['usuario', 'cliente', 'ambos'].includes(body?.destinoTipo)
      ? body.destinoTipo
      : atual.destinoTipo;
    const empresaId = ehEquipe && body?.empresaId !== undefined
      ? (typeof body.empresaId === 'string' && body.empresaId.trim() ? body.empresaId.trim() : null)
      : atual.empresaId;
    const responsavelUserId = ehEquipe && body?.responsavelUserId !== undefined
      ? (typeof body.responsavelUserId === 'string' && body.responsavelUserId.trim() ? body.responsavelUserId.trim() : null)
      : atual.responsavelUserId;
    const prazo = ehEquipe && body?.prazo !== undefined
      ? (typeof body.prazo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.prazo.trim()) ? body.prazo.trim() : null)
      : atual.prazo;
    const recorrente = ehEquipe && typeof body?.recorrente === 'boolean'
      ? body.recorrente
      : atual.recorrente;
    const recorrenciaDia = ehEquipe && body?.recorrenciaDia !== undefined
      ? (body.recorrenciaDia ? Math.max(1, Math.min(31, Number(body.recorrenciaDia) || 5)) : null)
      : atual.recorrenciaDia;
    const visivelCliente = ehEquipe && typeof body?.visivelCliente === 'boolean'
      ? body.visivelCliente
      : atual.visivelCliente;

    // Subtarefas (equipe e cliente podem marcar/desmarcar; equipe pode editar livremente)
    const subtarefas = Array.isArray(body?.subtarefas)
      ? body.subtarefas
          .filter((s: any) => s && typeof s.titulo === 'string' && s.titulo.trim())
          .map((s: any) => ({
            id: typeof s.id === 'string' && s.id ? s.id : crypto.randomUUID(),
            titulo: s.titulo.trim(),
            concluida: Boolean(s.concluida),
          }))
      : atual.subtarefas;

    const usuarioAtual = (typeof body?.novoComentario === 'string' && body.novoComentario.trim()) || body?.novoAnexo
      ? await db.user.findUnique({ where: { id: auth.session.userId }, select: { name: true } })
      : null;
    const autorNome = usuarioAtual?.name || auth.session.email || 'Usuário';

    // Novo comentário (append seguro)
    let comentarios = atual.comentarios;
    if (typeof body?.novoComentario === 'string' && body.novoComentario.trim()) {
      comentarios = [
        ...atual.comentarios,
        {
          id: crypto.randomUUID(),
          autorId: auth.session.userId,
          autorNome,
          autorRole: auth.session.role,
          texto: body.novoComentario.trim(),
          criadoEm: new Date().toISOString(),
        },
      ];
    }

    // Novo anexo ou remoção de anexo
    let anexos = atual.anexos;
    if (body?.novoAnexo && typeof body.novoAnexo === 'object' && body.novoAnexo.dataUrl) {
      const a = body.novoAnexo;
      anexos = [
        ...atual.anexos,
        {
          id: crypto.randomUUID(),
          nome: String(a.nome || 'arquivo'),
          tipo: String(a.tipo || 'application/octet-stream'),
          tamanho: Number(a.tamanho || 0),
          dataUrl: String(a.dataUrl),
          enviadoPor: autorNome,
          criadoEm: new Date().toISOString(),
        },
      ].slice(-12);
    }
    if (typeof body?.removerAnexoId === 'string' && body.removerAnexoId) {
      anexos = anexos.filter((a) => a.id !== body.removerAnexoId);
    }

    const concluiuAgora = atual.status !== 'concluida' && novoStatus === 'concluida';
    const reabriu = atual.status === 'concluida' && novoStatus !== 'concluida';
    const concluidaEm = concluiuAgora ? new Date() : reabriu ? null : (atual.concluidaEm ? new Date(atual.concluidaEm) : null);

    await db.$executeRawUnsafe(
      `UPDATE cf_tarefas SET
         titulo = $2,
         descricao = $3,
         status = $4,
         prioridade = $5,
         categoria = $6,
         destino_tipo = $7,
         empresa_id = $8,
         responsavel_user_id = $9,
         prazo = $10,
         recorrente = $11,
         recorrencia_dia = $12,
         visivel_cliente = $13,
         subtarefas = $14::jsonb,
         comentarios = $15::jsonb,
         anexos = $16::jsonb,
         concluida_em = $17,
         updated_at = NOW()
       WHERE id = $1`,
      id,
      titulo,
      descricao,
      novoStatus,
      prioridade,
      categoria,
      destinoTipo,
      empresaId,
      responsavelUserId,
      prazo,
      recorrente,
      recorrenciaDia,
      visivelCliente,
      JSON.stringify(subtarefas),
      JSON.stringify(comentarios),
      JSON.stringify(anexos),
      concluidaEm
    );

    // Se a tarefa é recorrente mensal e acabou de ser concluída, cria automaticamente a ocorrência do próximo mês
    let proximaRecorrencia: TarefaRecord | null = null;
    if (concluiuAgora && recorrente) {
      const novoPrazo = calcularProximoPrazoMensal(prazo, recorrenciaDia);
      const novoId = crypto.randomUUID();
      const subtarefasReset = subtarefas.map((s: any) => ({
        id: crypto.randomUUID(),
        titulo: s.titulo,
        concluida: false,
      }));
      await db.$executeRawUnsafe(
        `INSERT INTO cf_tarefas (
           id, titulo, descricao, status, prioridade, categoria, destino_tipo,
           empresa_id, responsavel_user_id, criado_por_user_id, criado_por_nome,
           prazo, recorrente, recorrencia_dia, visivel_cliente,
           subtarefas, comentarios, anexos, created_at, updated_at
         ) VALUES (
           $1, $2, $3, 'a_fazer', $4, $5, $6,
           $7, $8, $9, $10,
           $11, TRUE, $12, $13,
           $14::jsonb, '[]'::jsonb, '[]'::jsonb, NOW(), NOW()
         )`,
        novoId,
        titulo,
        descricao,
        prioridade,
        categoria,
        destinoTipo,
        empresaId,
        responsavelUserId,
        atual.criadoPorUserId,
        atual.criadoPorNome,
        novoPrazo,
        recorrenciaDia || Number(novoPrazo.slice(8, 10)),
        visivelCliente,
        JSON.stringify(subtarefasReset)
      );
      proximaRecorrencia = await carregarTarefa(novoId);
    }

    const atualizada = await carregarTarefa(id);
    return NextResponse.json({ ok: true, tarefa: atualizada, proximaRecorrencia });
  } catch (error) {
    console.error('Erro em PATCH /api/tarefas/[id]:', error);
    return NextResponse.json({ error: 'Erro ao atualizar tarefa.' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (!isConsultorOrAdmin(auth.session.role)) {
      return NextResponse.json({ error: 'Apenas consultores ou administradores podem excluir tarefas.' }, { status: 403 });
    }
    await ensureTarefasTable();
    const { id } = await context.params;
    await db.$executeRawUnsafe(`DELETE FROM cf_tarefas WHERE id = $1`, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro em DELETE /api/tarefas/[id]:', error);
    return NextResponse.json({ error: 'Erro ao excluir tarefa.' }, { status: 500 });
  }
}
