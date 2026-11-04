import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '../../../../../../lib/prisma';
import { requireAuth } from '../../../../../../lib/api-auth';
import { captureError } from '../../../../../../lib/sentry-helper';
import { acessoNegado } from '../../../../../../lib/nfse/servidor';
import { hashPassword } from '../../../../../../lib/auth-hash';

const ROTA_CLIENTE_NFSE = '/cliente/nfse';

/** Lista os usuários com perfil "cliente" vinculados a esta empresa emissora. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
    }
    const { id: empresaId } = await params;
    const negado = await acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    const usuarios = await db.user.findMany({
      where: {
        role: 'cliente',
        empresaIds: { has: empresaId },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        empresaIds: true,
        allowedRoutes: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ usuarios });
  } catch (error) {
    console.error('Erro em GET nfse/emissores/[id]/acesso:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao carregar usuários da empresa.' }, { status: 500 });
  }
}

/**
 * Cria um novo login de cliente para emitir NFS-e por esta empresa
 * (ou vincula/atualiza a senha se o e-mail já existir como cliente).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
    }
    const { id: empresaId } = await params;
    const negado = await acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    const empresa = await db.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true, razaoSocial: true, nomeFantasia: true },
    });
    if (!empresa) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const name = String(body?.name || '').trim() || empresa.nomeFantasia || empresa.razaoSocial;
    const rawPassword = String(body?.password || '').trim();
    const phone = body?.phone ? String(body.phone).replace(/\D/g, '') : null;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Informe um e-mail válido para o login do cliente.' }, { status: 422 });
    }

    const existente = await db.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (existente) {
      if (existente.role !== 'cliente') {
        return NextResponse.json(
          { error: 'Este e-mail já pertence a um usuário interno (consultor/administrador). Use o e-mail do próprio cliente.' },
          { status: 422 }
        );
      }

      const novasEmpresas = Array.from(new Set([...(existente.empresaIds || []), empresaId]));
      const novasRotas = Array.from(new Set([...(existente.allowedRoutes || []), ROTA_CLIENTE_NFSE]));

      const atualizado = await db.user.update({
        where: { id: existente.id },
        data: {
          name: name || existente.name,
          phone: phone ?? existente.phone,
          empresaIds: novasEmpresas,
          allowedRoutes: novasRotas,
          ...(rawPassword ? { password: hashPassword(rawPassword) } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          empresaIds: true,
          allowedRoutes: true,
          createdAt: true,
        },
      });

      return NextResponse.json({
        usuario: atualizado,
        vinculadoExistente: true,
        senhaAlterada: Boolean(rawPassword),
      });
    }

    if (rawPassword.length < 4) {
      return NextResponse.json({ error: 'Defina uma senha inicial com pelo menos 4 caracteres.' }, { status: 422 });
    }

    const criado = await db.user.create({
      data: {
        id: crypto.randomUUID(),
        name,
        email,
        password: hashPassword(rawPassword),
        role: 'cliente',
        empresaIds: [empresaId],
        allowedRoutes: [ROTA_CLIENTE_NFSE],
        phone,
        receberEmailDiario: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        empresaIds: true,
        allowedRoutes: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      usuario: criado,
      vinculadoExistente: false,
      senhaAlterada: true,
    });
  } catch (error) {
    console.error('Erro em POST nfse/emissores/[id]/acesso:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao salvar o acesso do cliente.' }, { status: 500 });
  }
}

/** Remove o vínculo de um usuário cliente com esta empresa (ou exclui o usuário se só tinha ela). */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
    }
    const { id: empresaId } = await params;
    const negado = await acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    const userId = new URL(request.url).searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'ID do usuário não informado.' }, { status: 400 });
    }

    const usuario = await db.user.findUnique({ where: { id: userId } });
    if (!usuario || usuario.role !== 'cliente' || !usuario.empresaIds.includes(empresaId)) {
      return NextResponse.json({ error: 'Usuário não encontrado nesta empresa.' }, { status: 404 });
    }

    const restantes = usuario.empresaIds.filter(id => id !== empresaId);
    if (restantes.length === 0) {
      await db.user.delete({ where: { id: userId } });
      return NextResponse.json({ removido: true, excluido: true });
    }

    await db.user.update({
      where: { id: userId },
      data: { empresaIds: restantes },
    });
    return NextResponse.json({ removido: true, excluido: false });
  } catch (error) {
    console.error('Erro em DELETE nfse/emissores/[id]/acesso:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao remover o acesso do cliente.' }, { status: 500 });
  }
}

