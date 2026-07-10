import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Rota dedicada e ultra-leve para upsert de Plano de Contas.
 * Recebe 1 item por vez e responde imediatamente.
 * Evita o Inactivity Timeout do Vercel Free (10s).
 */
export async function POST(req: Request) {
  try {
    const pc = await req.json();

    if (!pc || !pc.id) {
      return NextResponse.json({ error: 'Item inválido' }, { status: 400 });
    }

    const empresaId = String(pc.empresaId || 'empresa_default');

    // Garante que a empresa existe
    const empresaExists = await db.empresa.findUnique({ where: { id: empresaId }, select: { id: true } });
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
      try {
        const parentExists = await db.planoConta.findUnique({ where: { id: String(pc.parentId) }, select: { id: true } });
        if (parentExists) {
          await db.planoConta.upsert({
            where: { id: String(pc.id) },
            update: {
              codigo: String(pc.codigo || ''),
              descricao: String(pc.descricao || ''),
              tipo: String(pc.tipo || 'receita'),
              nivel: Math.round(Number(pc.nivel)) || 1,
              parentId: String(pc.parentId),
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
              parentId: String(pc.parentId),
              ativo: pc.ativo === undefined ? true : Boolean(pc.ativo),
              empresaId,
              dreCategoria: pc.dreCategoria ? String(pc.dreCategoria) : null,
            }
          });
          savedWithParent = true;
        }
      } catch (_) {
        // parentId inválido — salva sem ele
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
