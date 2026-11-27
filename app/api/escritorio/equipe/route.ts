import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import {
  ensureEscritoriosNfseTables,
  idsEmpresasDoEscritorio,
  obterEscritorioDoUsuario,
} from '../../../../lib/nfse/escritorios-terceiros';

export const dynamic = 'force-dynamic';

const ROTAS_OPERADOR = [
  'contador-terceiro-nfse',
  '/consultor/nfse',
  '/consultor/nfe-destinadas',
  '/consultor/carteira',
];

async function resolverEscritorioAdmin(userId: string) {
  await ensureEscritoriosNfseTables();
  const vinculo = await obterEscritorioDoUsuario(userId);
  if (!vinculo || !vinculo.ativo) {
    return { erro: NextResponse.json({ error: 'Recurso exclusivo para escritórios contábeis parceiros.' }, { status: 403 }) };
  }
  if (vinculo.papel !== 'admin_escritorio') {
    return { erro: NextResponse.json({ error: 'Apenas o administrador do escritório pode gerenciar a equipe.' }, { status: 403 }) };
  }
  return { vinculo };
}

/**
 * GET /api/escritorio/equipe
 * Lista os membros (auxiliares/operadores e admins) e as empresas do escritório parceiro.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { vinculo, erro } = await resolverEscritorioAdmin(auth.session.userId);
    if (erro || !vinculo) return erro!;

    const idsEmpresas = await idsEmpresasDoEscritorio(vinculo.escritorioId);
    const [membrosRaw, empresas] = await Promise.all([
      db.$queryRawUnsafe<Array<{ user_id: string; papel: string; created_at: Date }>>(
        `SELECT user_id, papel, created_at
         FROM nfse_escritorio_usuarios
         WHERE escritorio_id = $1
         ORDER BY created_at ASC`,
        vinculo.escritorioId
      ),
      db.empresa.findMany({
        where: { id: { in: idsEmpresas } },
        select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true },
        orderBy: { razaoSocial: 'asc' },
      }),
    ]);

    const userIds = membrosRaw.map((m) => m.user_id);
    const users = userIds.length
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true, phone: true, empresaIds: true, createdAt: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const membros = membrosRaw
      .map((m) => {
        const u = userMap.get(m.user_id);
        if (!u) return null;
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone || '',
          papel: m.papel === 'operador' ? 'operador' : 'admin_escritorio',
          empresaIds: Array.isArray(u.empresaIds) ? u.empresaIds : [],
          createdAt: u.createdAt.toISOString(),
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      escritorio: { id: vinculo.escritorioId, nome: vinculo.nomeEscritorio },
      membros,
      empresas,
    });
  } catch (error) {
    console.error('Erro em GET /api/escritorio/equipe:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao carregar equipe do escritório.' }, { status: 500 });
  }
}

/**
 * POST /api/escritorio/equipe
 * Cria um novo auxiliar/operador para o escritório parceiro com acesso somente às empresas selecionadas.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { vinculo, erro } = await resolverEscritorioAdmin(auth.session.userId);
    if (erro || !vinculo) return erro!;

    const body = await request.json().catch(() => ({}));
    const name = String(body?.name || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '').trim();
    const phone = String(body?.phone || '').trim();
    const todasEmpresas = Boolean(body?.todasEmpresas);
    const empresaIdsReq = Array.isArray(body?.empresaIds) ? body.empresaIds.map(String) : [];

    if (!name || !email || !email.includes('@')) {
      return NextResponse.json({ error: 'Informe nome e e-mail válidos para o membro da equipe.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter no mínimo 6 caracteres.' }, { status: 400 });
    }

    const existente = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existente) {
      return NextResponse.json({ error: 'Já existe um usuário cadastrado com este e-mail.' }, { status: 409 });
    }

    const idsCarteira = await idsEmpresasDoEscritorio(vinculo.escritorioId);
    const setCarteira = new Set(idsCarteira);
    const empresaIdsFinais = todasEmpresas
      ? idsCarteira
      : empresaIdsReq.filter((id: string) => setCarteira.has(id));

    const passwordHash = await bcrypt.hash(password, 10);
    const novoId = crypto.randomUUID();

    await db.user.create({
      data: {
        id: novoId,
        name,
        email,
        password: passwordHash,
        phone: phone || null,
        role: 'consultor',
        empresaIds: empresaIdsFinais,
        allowedRoutes: ROTAS_OPERADOR,
      },
    });

    await db.$executeRawUnsafe(
      `INSERT INTO nfse_escritorio_usuarios (user_id, escritorio_id, papel, created_at)
       VALUES ($1, $2, 'operador', NOW())`,
      novoId,
      vinculo.escritorioId
    );

    return NextResponse.json({
      ok: true,
      membro: {
        id: novoId,
        name,
        email,
        phone,
        papel: 'operador',
        empresaIds: empresaIdsFinais,
      },
    });
  } catch (error) {
    console.error('Erro em POST /api/escritorio/equipe:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao criar membro da equipe.' }, { status: 500 });
  }
}

/**
 * PATCH /api/escritorio/equipe
 * Atualiza dados, empresas permitidas e/ou senha de um operador do escritório.
 */
export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { vinculo, erro } = await resolverEscritorioAdmin(auth.session.userId);
    if (erro || !vinculo) return erro!;

    const body = await request.json().catch(() => ({}));
    const membroId = String(body?.id || '').trim();
    if (!membroId) {
      return NextResponse.json({ error: 'ID do membro obrigatório.' }, { status: 400 });
    }

    const vinculoMembro = await db.$queryRawUnsafe<Array<{ papel: string }>>(
      `SELECT papel FROM nfse_escritorio_usuarios WHERE user_id = $1 AND escritorio_id = $2 LIMIT 1`,
      membroId,
      vinculo.escritorioId
    );
    if (!vinculoMembro[0]) {
      return NextResponse.json({ error: 'Membro não pertence a este escritório.' }, { status: 404 });
    }

    const dataUpdate: Record<string, any> = {};
    if (typeof body?.name === 'string' && body.name.trim()) dataUpdate.name = body.name.trim();
    if (typeof body?.phone === 'string') dataUpdate.phone = body.phone.trim() || null;

    if (typeof body?.password === 'string' && body.password.trim()) {
      if (body.password.trim().length < 6) {
        return NextResponse.json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' }, { status: 400 });
      }
      dataUpdate.password = await bcrypt.hash(body.password.trim(), 10);
    }

    if (Array.isArray(body?.empresaIds) || body?.todasEmpresas) {
      const idsCarteira = await idsEmpresasDoEscritorio(vinculo.escritorioId);
      const setCarteira = new Set(idsCarteira);
      dataUpdate.empresaIds = body?.todasEmpresas
        ? idsCarteira
        : body.empresaIds.map(String).filter((id: string) => setCarteira.has(id));
    }

    await db.user.update({ where: { id: membroId }, data: dataUpdate });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro em PATCH /api/escritorio/equipe:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao atualizar membro da equipe.' }, { status: 500 });
  }
}

/**
 * DELETE /api/escritorio/equipe?id=...
 * Remove um auxiliar/operador do escritório parceiro.
 */
export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { vinculo, erro } = await resolverEscritorioAdmin(auth.session.userId);
    if (erro || !vinculo) return erro!;

    const url = new URL(request.url);
    const membroId = (url.searchParams.get('id') || '').trim();
    if (!membroId) {
      return NextResponse.json({ error: 'ID do membro obrigatório.' }, { status: 400 });
    }
    if (membroId === auth.session.userId) {
      return NextResponse.json({ error: 'Você não pode excluir o próprio acesso administrador.' }, { status: 400 });
    }

    const vinculoMembro = await db.$queryRawUnsafe<Array<{ papel: string }>>(
      `SELECT papel FROM nfse_escritorio_usuarios WHERE user_id = $1 AND escritorio_id = $2 LIMIT 1`,
      membroId,
      vinculo.escritorioId
    );
    if (!vinculoMembro[0]) {
      return NextResponse.json({ error: 'Membro não pertence a este escritório.' }, { status: 404 });
    }
    if (vinculoMembro[0].papel !== 'operador') {
      return NextResponse.json({ error: 'Não é possível excluir um administrador do escritório por esta tela.' }, { status: 400 });
    }

    await db.$executeRawUnsafe(
      `DELETE FROM nfse_escritorio_usuarios WHERE user_id = $1 AND escritorio_id = $2`,
      membroId,
      vinculo.escritorioId
    );
    await db.user.delete({ where: { id: membroId } }).catch(() => null);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro em DELETE /api/escritorio/equipe:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao remover membro da equipe.' }, { status: 500 });
  }
}
