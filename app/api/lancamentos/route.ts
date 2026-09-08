import { NextResponse } from 'next/server';
import db from '../../../lib/prisma';
import { Lancamento } from '../../../lib/store';
import { captureError } from '../../../lib/sentry-helper';
import { requireAuth } from '../../../lib/api-auth';

export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get('empresaId');
    const since = searchParams.get('since'); // ISO timestamp (optional)
    const isAdmin = auth.session.role === 'administrador';

    if (empresaId && !isAdmin && !auth.session.empresaIds.includes(empresaId)) {
      return NextResponse.json({ error: 'Sem acesso a esta empresa.' }, { status: 403 });
    }

    try {
        const whereClause: any = {};
        if (empresaId) {
          whereClause.empresaId = empresaId;
        } else if (!isAdmin) {
          // Sem empresaId no request (ex: polling "since=") — nunca devolve o
          // sistema inteiro pra quem não é administrador.
          whereClause.empresaId = { in: auth.session.empresaIds };
        }
        if (since) whereClause.updatedAt = { gte: new Date(since) };

        const lancamentos = await db.lancamento.findMany({
            where: whereClause,
            select: {
                id: true,
                empresaId: true,
                data: true,
                descricao: true,
                valor: true,
                tipo: true,
                planoContaId: true,
                portadorId: true,
                status: true,
                numeroDocumento: true,
                observacao: true,
                origem: true,
                ofxId: true,
                unidadeId: true,
                clienteId: true,
                attachmentName: true,
                conferido: true,
                createdAt: true,
            },
            orderBy: [
                { data: 'desc' },
                { createdAt: 'desc' }
            ]
        });
        return NextResponse.json(lancamentos);
    } catch (error) {
        console.error('DB Error:', error);
        captureError(error);
        return NextResponse.json({ error: 'Erro ao buscar lançamentos' }, { status: 500 });
    }
}

export async function POST(request: Request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
    try {
        const data = await request.json();
        const items: Lancamento[] = Array.isArray(data) ? data : [data];

        const isAdmin = auth.session.role === 'administrador';
        if (!isAdmin) {
          const forbidden = items.find(l => !auth.session!.empresaIds.includes(l.empresaId));
          if (forbidden) {
            return NextResponse.json({ error: `Sem acesso à empresa ${forbidden.empresaId}.` }, { status: 403 });
          }
        }

        for (const l of items) {
            // Garantir que as entidades relacionadas existem no banco de dados para evitar violação de chaves estrangeiras
            await db.empresa.upsert({
                where: { id: l.empresaId },
                update: {},
                create: {
                    id: l.empresaId,
                    razaoSocial: 'Empresa Auto-Criada',
                    nomeFantasia: 'Empresa Auto-Criada',
                    cnpj: `CNPJ-${l.empresaId.substring(0, 10)}`,
                    responsavel: 'Responsável',
                    email: 'contato@empresa.com',
                    telefone: '0000000000',
                }
            });

            await db.planoConta.upsert({
                where: { id: l.planoContaId },
                update: {},
                create: {
                    id: l.planoContaId,
                    codigo: '999',
                    descricao: 'Plano de Conta Auto-Criado',
                    tipo: l.tipo,
                    nivel: 1,
                    empresaId: l.empresaId,
                    ativo: true
                }
            });

            await db.portador.upsert({
                where: { id: l.portadorId },
                update: {},
                create: {
                    id: l.portadorId,
                    nome: 'Portador Auto-Criado',
                    tipo: 'outro',
                    saldoInicial: 0,
                    empresaId: l.empresaId,
                    ativo: true
                }
            });

            const existing = await db.lancamento.findUnique({
                where: { id: l.id }
            });

            // Upsert do Lançamento
            await db.lancamento.upsert({
                where: { id: l.id },
                update: {
                    empresaId: l.empresaId,
                    data: l.data,
                    descricao: l.descricao,
                    valor: l.valor,
                    tipo: l.tipo,
                    planoContaId: l.planoContaId,
                    portadorId: l.portadorId,
                    status: l.status,
                    numeroDocumento: l.numeroDocumento || null,
                    observacao: l.observacao || null,
                    origem: l.origem,
                    ofxId: l.ofxId || null,
                    attachmentName: l.attachmentName || null,
                    attachmentData: l.attachmentData || null,
                    conferido: Boolean(l.conferido),
                },
                create: {
                    id: l.id,
                    empresaId: l.empresaId,
                    data: l.data,
                    descricao: l.descricao,
                    valor: l.valor,
                    tipo: l.tipo,
                    planoContaId: l.planoContaId,
                    portadorId: l.portadorId,
                    status: l.status,
                    numeroDocumento: l.numeroDocumento || null,
                    observacao: l.observacao || null,
                    origem: l.origem,
                    ofxId: l.ofxId || null,
                    attachmentName: l.attachmentName || null,
                    attachmentData: l.attachmentData || null,
                    conferido: Boolean(l.conferido),
                }
            });

            if ((global as any).io) {
                if (!existing) {
                    (global as any).io.emit('lancamento_criado', l);
                } else {
                    (global as any).io.emit('lancamento_atualizado', l);
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DB Error:', error);
        captureError(error);
        return NextResponse.json({ error: 'Erro ao salvar lançamento(s)' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID não fornecido' }, { status: 400 });
    try {
        if (auth.session.role !== 'administrador') {
          const existing = await db.lancamento.findUnique({ where: { id }, select: { empresaId: true } });
          if (existing && !auth.session.empresaIds.includes(existing.empresaId)) {
            return NextResponse.json({ error: 'Sem acesso a esta empresa.' }, { status: 403 });
          }
        }
        await db.lancamento.delete({
            where: { id }
        });
        if ((global as any).io) {
            (global as any).io.emit('lancamento_excluido', id);
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DB Error:', error);
        captureError(error);
        return NextResponse.json({ error: 'Erro ao excluir' }, { status: 500 });
    }
}