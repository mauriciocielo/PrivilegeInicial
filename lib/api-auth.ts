import { NextResponse } from 'next/server';
import db from './prisma';
import { getSessionFromRequest, type SessionPayload } from './session';

export type AuthResult =
  | { session: SessionPayload; error?: undefined }
  | { session?: undefined; error: NextResponse };

/**
 * Exige uma sessão válida (cookie httpOnly assinado). Use no início de toda
 * rota de API que não seja explicitamente pública:
 *
 *   const auth = await requireAuth(request);
 *   if (auth.error) return auth.error;
 *   // auth.session.userId / .role / .empresaIds disponíveis daqui pra baixo
 */
export async function requireAuth(request: Request): Promise<AuthResult> {
  const session = getSessionFromRequest(request);
  if (!session) {
    return { error: NextResponse.json({ error: 'Não autenticado. Faça login novamente.' }, { status: 401 }) };
  }
  if (!session.carteiraNoBanco) return { session };

  // A lista não coube no cookie (ver createSessionToken). Sem usuário, sem empresas.
  const usuario = await db.user.findUnique({ where: { id: session.userId }, select: { empresaIds: true } });
  return { session: { ...session, empresaIds: usuario?.empresaIds ?? [] } };
}
