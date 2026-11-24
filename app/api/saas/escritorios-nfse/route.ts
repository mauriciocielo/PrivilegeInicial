import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { ensureEscritoriosNfseTables } from '../../../../lib/nfse/escritorios-terceiros';

export const dynamic = 'force-dynamic';

/**
 * GET /api/saas/escritorios-nfse
 * Lista todos os escritórios contábeis terceiros cadastrados, com status do certificado,
 * quantidade de usuários e empresas vinculadas (isolados entre si e da Privilege).
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role !== 'administrador') {
      return NextResponse.json({ error: 'Apenas administradores podem gerenciar escritórios terceiros.' }, { status: 403 });
    }

    await ensureEscritoriosNfseTables();

    const rows = await db.$queryRawUnsafe<any[]>(`
      SELECT
        e.id,
        e.nome,
        e.cnpj,
        e.responsavel,
        e.email,
        e.telefone,
        e.ativo,
        e.limite_empresas,
        e.created_at,
        c.titular AS cert_titular,
        c.documento AS cert_documento,
        c."validoAte" AS cert_valido_ate,
        (SELECT COUNT(*)::int FROM nfse_escritorio_usuarios u WHERE u.escritorio_id = e.id) AS total_usuarios,
        (SELECT COUNT(*)::int FROM nfse_empresa_escritorio em WHERE em.escritorio_id = e.id) AS total_empresas
      FROM nfse_escritorios e
      LEFT JOIN "NfseCertificadoEscritorio" c ON c.id = e.id
      ORDER BY e.created_at DESC
    `);

    const usuariosVinculados = await db.$queryRawUnsafe<any[]>(`
      SELECT eu.escritorio_id, eu.papel, u.id, u.name, u.email
      FROM nfse_escritorio_usuarios eu
      INNER JOIN "User" u ON u.id = eu.user_id
      ORDER BY u.name ASC
    `);

    const usersByEsc = new Map<string, any[]>();
    for (const u of usuariosVinculados) {
      const arr = usersByEsc.get(u.escritorio_id) || [];
      arr.push({ id: u.id, name: u.name, email: u.email, papel: u.papel });
      usersByEsc.set(u.escritorio_id, arr);
    }

    return NextResponse.json({
      success: true,
      escritorios: rows.map((r) => ({
        id: r.id,
        nome: r.nome,
        cnpj: r.cnpj || '',
        responsavel: r.responsavel || '',
        email: r.email || '',
        telefone: r.telefone || '',
        ativo: Boolean(r.ativo),
        limiteEmpresas: Number(r.limite_empresas || 50),
        createdAt: r.created_at,
        certificado: r.cert_titular
          ? { titular: r.cert_titular, documento: r.cert_documento, validoAte: r.cert_valido_ate }
          : null,
        totalUsuarios: Number(r.total_usuarios || 0),
        totalEmpresas: Number(r.total_empresas || 0),
        usuarios: usersByEsc.get(r.id) || [],
      })),
    });
  } catch (error) {
    console.error('Erro em GET /api/saas/escritorios-nfse:', error);
    return NextResponse.json({ error: 'Erro ao listar escritórios terceiros.' }, { status: 500 });
  }
}

/**
 * POST /api/saas/escritorios-nfse
 * Cria um novo Escritório Contábil Terceiro isolado e, opcionalmente, já cria
 * o usuário administrador desse contador (com acesso exclusivo ao módulo NFS-e).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role !== 'administrador') {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
    }

    await ensureEscritoriosNfseTables();
    const body = await request.json().catch(() => ({}));

    const nome = typeof body?.nome === 'string' ? body.nome.trim() : '';
    if (!nome) {
      return NextResponse.json({ error: 'Informe o nome do escritório contábil.' }, { status: 400 });
    }

    const cnpj = typeof body?.cnpj === 'string' ? body.cnpj.trim() : '';
    const responsavel = typeof body?.responsavel === 'string' ? body.responsavel.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const telefone = typeof body?.telefone === 'string' ? body.telefone.trim() : '';
    const limiteEmpresas = Math.max(1, Math.min(2000, Number(body?.limiteEmpresas) || 50));

    const criarLogin = Boolean(body?.criarLogin);
    const loginEmail = typeof body?.loginEmail === 'string' ? body.loginEmail.trim().toLowerCase() : email;
    const loginSenha = typeof body?.loginSenha === 'string' ? body.loginSenha.trim() : '';

    if (criarLogin) {
      if (!loginEmail || !loginEmail.includes('@')) {
        return NextResponse.json({ error: 'Informe um e-mail válido para o login do contador.' }, { status: 400 });
      }
      if (loginSenha.length < 6) {
        return NextResponse.json({ error: 'A senha inicial deve ter pelo menos 6 caracteres.' }, { status: 400 });
      }
      const existente = await db.user.findUnique({ where: { email: loginEmail }, select: { id: true } });
      if (existente) {
        return NextResponse.json({ error: `Já existe um usuário com o e-mail ${loginEmail}.` }, { status: 409 });
      }
    }

    const escritorioId = `esc_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    await db.$executeRawUnsafe(
      `INSERT INTO nfse_escritorios (id, nome, cnpj, responsavel, email, telefone, ativo, limite_empresas, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, NOW(), NOW())`,
      escritorioId,
      nome,
      cnpj,
      responsavel,
      email,
      telefone,
      limiteEmpresas
    );

    let usuarioCriado: { id: string; email: string } | null = null;
    if (criarLogin) {
      const passwordHash = await bcrypt.hash(loginSenha, 10);
      const novoUser = await db.user.create({
        data: {
          name: responsavel || nome,
          email: loginEmail,
          password: passwordHash,
          role: 'consultor',
          phone: telefone || null,
          empresaIds: [],
          allowedRoutes: ['/consultor/nfse', 'somente-painel-fiscal'],
        },
        select: { id: true, email: true },
      });

      await db.$executeRawUnsafe(
        `INSERT INTO nfse_escritorio_usuarios (user_id, escritorio_id, papel, created_at)
         VALUES ($1, $2, 'admin_escritorio', NOW())`,
        novoUser.id,
        escritorioId
      );
      usuarioCriado = novoUser;
    }

    return NextResponse.json({ success: true, id: escritorioId, usuarioCriado }, { status: 201 });
  } catch (error) {
    console.error('Erro em POST /api/saas/escritorios-nfse:', error);
    return NextResponse.json({ error: 'Erro ao cadastrar escritório terceiro.' }, { status: 500 });
  }
}

/**
 * PATCH /api/saas/escritorios-nfse
 * Atualiza status (ativo/suspenso) ou limite de empresas do escritório terceiro.
 */
export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role !== 'administrador') {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
    }

    await ensureEscritoriosNfseTables();
    const body = await request.json().catch(() => ({}));
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!id) return NextResponse.json({ error: 'ID do escritório ausente.' }, { status: 400 });

    if (typeof body?.ativo === 'boolean') {
      await db.$executeRawUnsafe(
        `UPDATE nfse_escritorios SET ativo = $2, updated_at = NOW() WHERE id = $1`,
        id,
        body.ativo
      );
    }
    if (body?.limiteEmpresas != null) {
      const lim = Math.max(1, Math.min(2000, Number(body.limiteEmpresas) || 50));
      await db.$executeRawUnsafe(
        `UPDATE nfse_escritorios SET limite_empresas = $2, updated_at = NOW() WHERE id = $1`,
        id,
        lim
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro em PATCH /api/saas/escritorios-nfse:', error);
    return NextResponse.json({ error: 'Erro ao atualizar escritório terceiro.' }, { status: 500 });
  }
}

/**
 * DELETE /api/saas/escritorios-nfse?id=esc_...
 * Remove o escritório terceiro e seu certificado isolado (não apaga empresas nem notas emitidas).
 */
export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role !== 'administrador') {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
    }

    await ensureEscritoriosNfseTables();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim() || '';
    if (!id || id === 'padrao') {
      return NextResponse.json({ error: 'Escritório inválido para exclusão.' }, { status: 400 });
    }

    await db.$executeRawUnsafe(`DELETE FROM nfse_escritorios WHERE id = $1`, id);
    await db.nfseCertificadoEscritorio.deleteMany({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro em DELETE /api/saas/escritorios-nfse:', error);
    return NextResponse.json({ error: 'Erro ao remover escritório terceiro.' }, { status: 500 });
  }
}
