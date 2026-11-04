import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';

// Para quem está fora do escopo, a resposta é a mesma de um id inexistente:
// a rota não confirma que uma avaliação de outra empresa existe.
const escopo = (session: { role: string; empresaIds: string[] }, id: string) =>
  session.role === 'administrador' ? { id } : { id, empresaId: { in: session.empresaIds } };

const naoEncontrada = () => NextResponse.json({ error: 'Avaliação não encontrada.' }, { status: 404 });

/** O relatório salvo de uma avaliação. As respostas brutas ficam só no banco. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 });

    const { id } = await params;
    const avaliacao = await db.perfilDiscAvaliacao.findFirst({
      where: escopo(auth.session, id),
      select: {
        id: true, tipoRespondente: true, nomeRespondente: true, cargoRespondente: true, status: true,
        concluidoEm: true, consentimentoEm: true, tempoRespostaSeg: true, resultado: true,
        empresa: { select: { razaoSocial: true, nomeFantasia: true, logoData: true } },
      },
    });
    if (!avaliacao) return naoEncontrada();
    return NextResponse.json({ avaliacao });
  } catch (error) {
    console.error('Erro em GET perfil-disc/[id]:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao carregar a avaliação.' }, { status: 500 });
  }
}

/** Exclui a avaliação: invalida um link ainda não respondido ou apaga o resultado guardado. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 });

    const { id } = await params;
    const { count } = await db.perfilDiscAvaliacao.deleteMany({ where: escopo(auth.session, id) });
    if (count === 0) return naoEncontrada();
    return NextResponse.json({ excluida: true });
  } catch (error) {
    console.error('Erro em DELETE perfil-disc/[id]:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao excluir a avaliação.' }, { status: 500 });
  }
}
