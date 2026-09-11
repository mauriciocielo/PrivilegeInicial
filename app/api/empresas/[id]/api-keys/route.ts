import { NextResponse } from 'next/server';
import db from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/api-auth';
import { gerarTokenApiKey } from '../../../../../lib/api-v1-auth';
import { captureError } from '../../../../../lib/sentry-helper';

/**
 * Provisionamento de credenciais da API v1 — protegido pela sessão normal do
 * portal (login do consultor), não pela própria API-key (galinha e ovo: quem
 * cria a chave precisa estar logado no portal, não portar uma chave ainda
 * inexistente).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const { id: empresaId } = await params;

  if (auth.session.role !== 'administrador' && !auth.session.empresaIds.includes(empresaId)) {
    return NextResponse.json({ error: 'Sem acesso a esta empresa.' }, { status: 403 });
  }

  const chaves = await db.apiKey.findMany({
    where: { empresaId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, nome: true, prefixo: true, ativo: true, ultimoUsoEm: true, createdAt: true, revokedAt: true },
  });
  return NextResponse.json({ chaves });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;
    const { id: empresaId } = await params;

    if (auth.session.role !== 'administrador' && !auth.session.empresaIds.includes(empresaId)) {
      return NextResponse.json({ error: 'Sem acesso a esta empresa.' }, { status: 403 });
    }

    const empresa = await db.empresa.findUnique({ where: { id: empresaId } });
    if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const nome = String(body?.nome || 'Integração ERP').trim().slice(0, 120);

    const { prefixo, token, chaveHash } = gerarTokenApiKey();
    const chave = await db.apiKey.create({ data: { empresaId, nome, prefixo, chaveHash } });

    // O token completo só existe nesta resposta — o banco guarda só o hash.
    return NextResponse.json({
      id: chave.id, nome: chave.nome, prefixo: chave.prefixo,
      token,
      aviso: 'Guarde este token agora — ele não será mostrado novamente.',
    }, { status: 201 });
  } catch (error) {
    console.error('Erro ao gerar chave de API:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao gerar a credencial.' }, { status: 500 });
  }
}
