import { NextResponse } from 'next/server';
import db from '@/lib/prisma';
import { captureError } from '../../../../lib/sentry-helper';
import { requireAuth } from '../../../../lib/api-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Rota dedicada e ultra-leve para upsert de Plano de Contas.
 * Recebe 1 item por vez e responde imediatamente.
 * Evita o Inactivity Timeout do Vercel Free (10s).
 */
export async function POST(req: Request) {
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  try {
    const pc = await req.json();

    if (!pc || !pc.id) {
      return NextResponse.json({ error: 'Item inválido' }, { status: 400 });
    }

    const empresaId = String(pc.empresaId || 'empresa_default');

    // Garante que a empresa existe
    const empresaExists = await db.empresa.findUnique({ where: { id: empresaId }, select: { id: true } });
    if (empresaExists && auth.session.role !== 'administrador' && !auth.session.empresaIds.includes(empresaId)) {
      return NextResponse.json({ error: 'Sem acesso a esta empresa.' }, { status: 403 });
    }
    if (!empresaExists) {
      await db.empresa.upsert({
        where: { id: empresaId },
        update: {},
        create: {
          id: empresaId,
          razaoSocial: 'Empresa Auto-Criada',
          nomeFantasia: 'Empresa Auto-Criada',
          cnpj: `CNPJ-${empresaId.substring(0, 10)}`,
          responsavel: 'Responsável',
          email: 'contato@empresa.com',
          telefone: '0000000000',
        }
      });
    }

    // Tenta upsert com parentId — se falhar, tenta sem
    let savedWithParent = false;
    if (pc.parentId) {
      const parentId = String(pc.parentId);
      try {
        const parentExists = await db.planoConta.findUnique({ where: { id: parentId }, select: { id: true } });
        if (parentExists) {
          await db.planoConta.upsert({
            where: { id: String(pc.id) },
            update: {
              codigo: String(pc.codigo || ''),
              descricao: String(pc.descricao || ''),
              tipo: String(pc.tipo || 'receita'),
              nivel: Math.round(Number(pc.nivel)) || 1,
              parentId: parentId,
              ativo: pc.ativo === undefined ? true : Boolean(pc.ativo),
              empresaId,
              dreCategoria: pc.dreCategoria ? String(pc.dreCategoria) : null,
            },
            create: {
              id: String(pc.id),
              codigo: String(pc.codigo || ''),
              descricao: String(pc.descricao || ''),
              tipo: String(pc.tipo || 'receita'),
              nivel: Math.round(Number(pc.nivel)) || 1,
              parentId: parentId,
              ativo: pc.ativo === undefined ? true : Boolean(pc.ativo),
              empresaId,
              dreCategoria: pc.dreCategoria ? String(pc.dreCategoria) : null,
            }
          });
          savedWithParent = true;
        } else {
          // Se o pai não existe, cria um pai "fantasma" para manter a integridade
          await db.planoConta.create({
            data: {
              id: parentId,
              empresaId,
              codigo: `TEMP-${parentId.slice(0, 8)}`,
              descricao: 'Pai Ausente (Auto-Criado)',
              tipo: 'despesa',
              nivel: (Math.round(Number(pc.nivel)) || 1) - 1,
              ativo: pc.ativo === undefined ? true : Boolean(pc.ativo),
              dreCategoria: pc.dreCategoria ? String(pc.dreCategoria) : null,
            }
          });
          savedWithParent = true;
        }
      } catch (e) {
        console.warn(`Falha ao tentar salvar PlanoConta ${pc.id} com parentId ${parentId}. Tentando novamente sem o pai. Erro:`, e);
        // Se mesmo com o pai fantasma falhar, salva sem o pai como último recurso.
        savedWithParent = false;
      }

      // Se a criação com o pai (real ou fantasma) foi bem-sucedida, faz o upsert final do item.
      if (savedWithParent) {
        await db.planoConta.upsert({
          where: { id: String(pc.id) },
          update: {
            codigo: String(pc.codigo || ''),
            descricao: String(pc.descricao || ''),
            tipo: String(pc.tipo || 'receita'),
            nivel: Math.round(Number(pc.nivel)) || 1,
            parentId: parentId,
            ativo: pc.ativo === undefined ? true : Boolean(pc.ativo),
            empresaId,
            dreCategoria: pc.dreCategoria ? String(pc.dreCategoria) : null,
          },
          create: { id: String(pc.id), codigo: String(pc.codigo || ''), descricao: String(pc.descricao || ''), tipo: String(pc.tipo || 'receita'), nivel: Math.round(Number(pc.nivel)) || 1, parentId: parentId, ativo: pc.ativo === undefined ? true : Boolean(pc.ativo), empresaId, dreCategoria: pc.dreCategoria ? String(pc.dreCategoria) : null, }
        });
      }
    }

    if (!savedWithParent) {
      await db.planoConta.upsert({
        where: { id: String(pc.id) },
        update: {
          codigo: String(pc.codigo || ''),
          descricao: String(pc.descricao || ''),
          tipo: String(pc.tipo || 'receita'),
          nivel: Math.round(Number(pc.nivel)) || 1,
          parentId: null,
          ativo: pc.ativo === undefined ? true : Boolean(pc.ativo),
          empresaId,
          dreCategoria: pc.dreCategoria ? String(pc.dreCategoria) : null,
        },
        create: {
          id: String(pc.id),
          codigo: String(pc.codigo || ''),
          descricao: String(pc.descricao || ''),
          tipo: String(pc.tipo || 'receita'),
          nivel: Math.round(Number(pc.nivel)) || 1,
          parentId: null,
          ativo: pc.ativo === undefined ? true : Boolean(pc.ativo),
          empresaId,
          dreCategoria: pc.dreCategoria ? String(pc.dreCategoria) : null,
        }
      });
    }

    return NextResponse.json({ success: true, id: pc.id, parentSaved: savedWithParent });
  } catch (err: any) {
    console.error('Erro ao salvar PlanoConta:', err);
    captureError(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
