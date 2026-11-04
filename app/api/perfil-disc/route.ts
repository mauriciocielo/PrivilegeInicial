import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '../../../lib/prisma';
import { requireAuth } from '../../../lib/api-auth';
import { captureError } from '../../../lib/sentry-helper';
import { VERSAO_QUESTIONARIO } from '../../../lib/perfil-disc/questionario';
import type { ResultadoPerfil } from '../../../lib/perfil-disc/pontuacao';
import { fimDoPrazo, linkExpirado } from '../../../lib/perfil-disc/prazo';

const MAX_LINKS_POR_VEZ = 50;
const TIPOS_RESPONDENTE = ['empresario', 'colaborador'];

const texto = (valor: unknown, limite: number): string | null => {
  const limpo = typeof valor === 'string' ? valor.trim().slice(0, limite) : '';
  return limpo || null;
};

/** Avaliações das empresas que o usuário atende. O token só sai enquanto o link ainda pode ser respondido. */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 });

    const avaliacoes = await db.perfilDiscAvaliacao.findMany({
      where: auth.session.role === 'administrador' ? {} : { empresaId: { in: auth.session.empresaIds } },
      select: {
        id: true, empresaId: true, token: true, tipoRespondente: true, nomeRespondente: true,
        emailRespondente: true, cargoRespondente: true, status: true, createdAt: true,
        iniciadoEm: true, concluidoEm: true, tempoRespostaSeg: true, resultado: true,
        empresa: { select: { razaoSocial: true, nomeFantasia: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      avaliacoes: avaliacoes.map(({ token, resultado, empresa, ...a }) => {
        const expirado = a.status === 'pendente' && linkExpirado(a);
        return {
          ...a,
          empresaNome: empresa.nomeFantasia || empresa.razaoSocial,
          token: a.status === 'pendente' && !expirado ? token : null,
          expirado,
          expiraEm: fimDoPrazo(a.createdAt),
          perfilNatural: (resultado as unknown as ResultadoPerfil | null)?.perfilNatural ?? null,
        };
      }),
    });
  } catch (error) {
    console.error('Erro em GET perfil-disc:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao carregar as avaliações.' }, { status: 500 });
  }
}

/** Gera um ou vários links, cada um para uma única resposta. */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 });

    const body = await request.json().catch(() => null);
    const empresaId = typeof body?.empresaId === 'string' ? body.empresaId : '';
    if (!empresaId) return NextResponse.json({ error: 'Selecione a empresa.' }, { status: 422 });
    if (auth.session.role !== 'administrador' && !auth.session.empresaIds.includes(empresaId)) {
      return NextResponse.json({ error: 'Sem acesso a esta empresa.' }, { status: 403 });
    }

    const empresa = await db.empresa.findUnique({ where: { id: empresaId }, select: { id: true } });
    if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });

    const tipoRespondente = TIPOS_RESPONDENTE.includes(body?.tipoRespondente) ? body.tipoRespondente : 'colaborador';
    const nomeRespondente = texto(body?.nomeRespondente, 120);
    const emailRespondente = texto(body?.emailRespondente, 160);
    const cargoRespondente = texto(body?.cargoRespondente, 120);

    const quantidade = body?.quantidade === undefined ? 1 : Number(body.quantidade);
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > MAX_LINKS_POR_VEZ) {
      return NextResponse.json({ error: `Informe de 1 a ${MAX_LINKS_POR_VEZ} links.` }, { status: 422 });
    }
    // Um nome em vários links faria respostas de pessoas diferentes parecerem da mesma pessoa.
    if (quantidade > 1 && (nomeRespondente || emailRespondente)) {
      return NextResponse.json({ error: 'Para gerar vários links, deixe nome e e-mail em branco: cada pessoa se identifica ao abrir.' }, { status: 422 });
    }

    const criadas = await db.$transaction(
      Array.from({ length: quantidade }, () => db.perfilDiscAvaliacao.create({
        data: {
          empresaId,
          token: crypto.randomBytes(32).toString('base64url'),
          tipoRespondente,
          nomeRespondente,
          emailRespondente,
          cargoRespondente,
          versaoQuestionario: VERSAO_QUESTIONARIO,
          criadoPorId: auth.session.userId,
        },
        select: { id: true, token: true, nomeRespondente: true },
      })),
    );

    return NextResponse.json({ criadas }, { status: 201 });
  } catch (error) {
    console.error('Erro em POST perfil-disc:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao gerar o link.' }, { status: 500 });
  }
}
