import { NextResponse } from 'next/server';
import db from '../../../lib/prisma';
import { requireAuth } from '../../../lib/api-auth';
import { captureError } from '../../../lib/sentry-helper';

/**
 * POST /api/atividades — salva uma atividade (com foto de início/fim) direto
 * no Postgres assim que o consultor clica em "Finalizar", em vez de depender
 * só do ciclo de sync geral (components/TransitionProvider.tsx), que é
 * debounced e fica pendurado enquanto `cf_postgres_synced` não estiver
 * "true" na sessão — uma atividade fechada bem no início do carregamento da
 * página podia nunca chegar ao servidor até outro evento de sync qualquer
 * disparar de novo. `Atividade` não tem FK para Empresa no schema (é um
 * scalar solto), então não precisa do upsert-de-empresa-fantasma que
 * app/api/lancamentos/route.ts faz.
 */
export async function POST(request: Request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    if (!auth.session.empresaIds.includes(body.empresaId) && auth.session.role !== 'administrador') {
      return NextResponse.json({ error: `Sem acesso à empresa ${body.empresaId}.` }, { status: 403 });
    }
    if (!body?.id || !body?.empresaId || !body?.descricao || typeof body?.tempoSegundos !== 'number' || !body?.data) {
      return NextResponse.json({ error: 'Payload incompleto.' }, { status: 422 });
    }

    await db.atividade.upsert({
      where: { id: body.id },
      update: {
        empresaId: body.empresaId,
        descricao: body.descricao,
        tempoSegundos: body.tempoSegundos,
        data: body.data,
        lat: body.localizacao?.lat ?? null,
        lng: body.localizacao?.lng ?? null,
        fotoInicio: body.fotoInicio || null,
        fotoFim: body.fotoFim || null,
      },
      create: {
        id: body.id,
        empresaId: body.empresaId,
        descricao: body.descricao,
        tempoSegundos: body.tempoSegundos,
        data: body.data,
        lat: body.localizacao?.lat ?? null,
        lng: body.localizacao?.lng ?? null,
        fotoInicio: body.fotoInicio || null,
        fotoFim: body.fotoFim || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao salvar atividade:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao salvar a atividade.' }, { status: 500 });
  }
}
