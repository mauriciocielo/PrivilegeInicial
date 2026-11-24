import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import db from '../../../lib/prisma';
import { requireAuth } from '../../../lib/api-auth';
import {
  ensureTarefasTable,
  isConsultorOrAdmin,
  mapRowToTarefa,
  type TarefaDestinoTipo,
  type TarefaPrioridade,
  type TarefaStatus,
} from '../../../lib/tarefas-db';
import { obterEscritorioDoUsuario } from '../../../lib/nfse/escritorios-terceiros';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role !== 'administrador' && await obterEscritorioDoUsuario(auth.session.userId)) {
      return NextResponse.json({ tarefas: [] });
    }
    await ensureTarefasTable();

    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get('empresaId')?.trim() || '';
    const responsavelUserId = searchParams.get('responsavelUserId')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';

    const ehEquipe = isConsultorOrAdmin(auth.session.role);

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (!ehEquipe) {
      // Cliente vê apenas tarefas visíveis ao cliente vinculadas às suas empresas ou atribuídas diretamente ao seu usuário
      const empIds = Array.isArray(auth.session.empresaIds) ? auth.session.empresaIds : [];
      conditions.push(`t.visivel_cliente = TRUE`);
      if (empIds.length > 0) {
        conditions.push(`(t.empresa_id = ANY($${idx}::text[]) OR t.responsavel_user_id = $${idx + 1})`);
        params.push(empIds, auth.session.userId);
        idx += 2;
      } else {
        conditions.push(`t.responsavel_user_id = $${idx}`);
        params.push(auth.session.userId);
        idx += 1;
      }
    }

    if (empresaId) {
      conditions.push(`t.empresa_id = $${idx}`);
      params.push(empresaId);
      idx += 1;
    }

    if (responsavelUserId) {
      conditions.push(`t.responsavel_user_id = $${idx}`);
      params.push(responsavelUserId);
      idx += 1;
    }

    if (status) {
      conditions.push(`t.status = $${idx}`);
      params.push(status);
      idx += 1;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT
         t.*,
         COALESCE(e."nomeFantasia", e."razaoSocial") AS empresa_nome,
         u.name AS responsavel_nome,
         u.phone AS responsavel_phone
       FROM cf_tarefas t
       LEFT JOIN "Empresa" e ON e.id = t.empresa_id
       LEFT JOIN "User" u ON u.id = t.responsavel_user_id
       ${whereClause}
       ORDER BY
         CASE t.status
           WHEN 'a_fazer' THEN 1
           WHEN 'em_andamento' THEN 2
           WHEN 'aguardando' THEN 3
           ELSE 4
         END ASC,
         CASE WHEN t.prazo IS NULL OR t.prazo = '' THEN 1 ELSE 0 END ASC,
         t.prazo ASC,
         t.created_at DESC`,
      ...params
    );

    return NextResponse.json({ tarefas: rows.map(mapRowToTarefa) });
  } catch (error) {
    console.error('Erro em GET /api/tarefas:', error);
    return NextResponse.json({ error: 'Erro ao carregar tarefas.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role !== 'administrador' && await obterEscritorioDoUsuario(auth.session.userId)) {
      return NextResponse.json({ tarefas: [] });
    }
    await ensureTarefasTable();

    const body = await request.json().catch(() => ({}));
    const titulo = typeof body?.titulo === 'string' ? body.titulo.trim() : '';
    if (!titulo) {
      return NextResponse.json({ error: 'Informe o título da tarefa.' }, { status: 400 });
    }

    const ehEquipe = isConsultorOrAdmin(auth.session.role);

    const descricao = typeof body?.descricao === 'string' ? body.descricao.trim() : '';
    const status: TarefaStatus = ['a_fazer', 'em_andamento', 'aguardando', 'concluida'].includes(body?.status)
      ? body.status
      : 'a_fazer';
    const prioridade: TarefaPrioridade = ['baixa', 'media', 'alta', 'urgente'].includes(body?.prioridade)
      ? body.prioridade
      : 'media';
    const categoria = typeof body?.categoria === 'string' ? body.categoria.trim() : '';
    const destinoTipo: TarefaDestinoTipo = ehEquipe
      ? (['usuario', 'cliente', 'ambos'].includes(body?.destinoTipo) ? body.destinoTipo : 'usuario')
      : 'cliente';

    let empresaId: string | null = typeof body?.empresaId === 'string' && body.empresaId.trim() ? body.empresaId.trim() : null;
    let responsavelUserId: string | null = typeof body?.responsavelUserId === 'string' && body.responsavelUserId.trim()
      ? body.responsavelUserId.trim()
      : null;

    if (!ehEquipe) {
      const empIds = Array.isArray(auth.session.empresaIds) ? auth.session.empresaIds : [];
      if (empresaId && !empIds.includes(empresaId)) {
        return NextResponse.json({ error: 'Empresa não autorizada.' }, { status: 403 });
      }
      if (!empresaId && empIds.length > 0) empresaId = empIds[0];
      responsavelUserId = auth.session.userId;
    }

    const prazo = typeof body?.prazo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.prazo.trim())
      ? body.prazo.trim()
      : null;
    const recorrente = Boolean(body?.recorrente);
    const recorrenciaDia = recorrente && body?.recorrenciaDia
      ? Math.max(1, Math.min(31, Number(body.recorrenciaDia) || 5))
      : (recorrente && prazo ? Number(prazo.slice(8, 10)) : null);

    const visivelCliente = ehEquipe
      ? (typeof body?.visivelCliente === 'boolean' ? body.visivelCliente : destinoTipo !== 'usuario')
      : true;

    const subtarefas = Array.isArray(body?.subtarefas)
      ? body.subtarefas
          .filter((s: any) => s && typeof s.titulo === 'string' && s.titulo.trim())
          .map((s: any) => ({
            id: typeof s.id === 'string' && s.id ? s.id : crypto.randomUUID(),
            titulo: s.titulo.trim(),
            concluida: Boolean(s.concluida),
          }))
      : [];

    const usuarioAtual = await db.user.findUnique({
      where: { id: auth.session.userId },
      select: { name: true },
    });
    const criadoPorNome = usuarioAtual?.name || auth.session.email || 'Usuário';

    const anexos = Array.isArray(body?.anexos)
      ? body.anexos.slice(0, 10).map((a: any) => ({
          id: typeof a.id === 'string' && a.id ? a.id : crypto.randomUUID(),
          nome: String(a.nome || 'arquivo'),
          tipo: String(a.tipo || 'application/octet-stream'),
          tamanho: Number(a.tamanho || 0),
          dataUrl: String(a.dataUrl || ''),
          enviadoPor: criadoPorNome,
          criadoEm: new Date().toISOString(),
        }))
      : [];

    const id = crypto.randomUUID();

    await db.$executeRawUnsafe(
      `INSERT INTO cf_tarefas (
         id, titulo, descricao, status, prioridade, categoria, destino_tipo,
         empresa_id, responsavel_user_id, criado_por_user_id, criado_por_nome,
         prazo, recorrente, recorrencia_dia, visivel_cliente,
         subtarefas, comentarios, anexos, concluida_em, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11,
         $12, $13, $14, $15,
         $16::jsonb, '[]'::jsonb, $17::jsonb, $18, NOW(), NOW()
       )`,
      id,
      titulo,
      descricao,
      status,
      prioridade,
      categoria,
      destinoTipo,
      empresaId,
      responsavelUserId,
      auth.session.userId,
      criadoPorNome,
      prazo,
      recorrente,
      recorrenciaDia,
      visivelCliente,
      JSON.stringify(subtarefas),
      JSON.stringify(anexos),
      status === 'concluida' ? new Date() : null
    );

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

    return NextResponse.json({ ok: true, tarefa: mapRowToTarefa(rows[0]) }, { status: 201 });
  } catch (error) {
    console.error('Erro em POST /api/tarefas:', error);
    return NextResponse.json({ error: 'Erro ao criar tarefa.' }, { status: 500 });
  }
}
