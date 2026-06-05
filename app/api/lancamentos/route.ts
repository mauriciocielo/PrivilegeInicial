import { NextResponse } from 'next/server';
import db from '../../../lib/prisma';
import { Lancamento } from '../../../lib/store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get('empresaId');

    try {
        const lancamentos = await db.lancamento.findMany({
            where: empresaId ? { empresaId } : {},
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
        return NextResponse.json({ error: 'Erro ao buscar lançamentos' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const data = await request.json();
        const items: Lancamento[] = Array.isArray(data) ? data : [data];

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
        return NextResponse.json({ error: 'Erro ao salvar lançamento(s)' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID não fornecido' }, { status: 400 });
    try {
        await db.lancamento.delete({
            where: { id }
        });
        if ((global as any).io) {
            (global as any).io.emit('lancamento_excluido', id);
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DB Error:', error);
        return NextResponse.json({ error: 'Erro ao excluir' }, { status: 500 });
    }
}