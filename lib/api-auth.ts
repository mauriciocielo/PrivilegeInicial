import { NextResponse } from 'next/server';
import { getSessionFromRequest, type SessionPayload } from './session';

export type AuthResult =
  | { session: SessionPayload; error?: undefined }
  | { session?: undefined; error: NextResponse };

/**
 * Exige uma sessão válida (cookie httpOnly assinado). Use no início de toda
 * rota de API que não seja explicitamente pública:
 *
 *   const auth = requireAuth(request);
 *   if (auth.error) return auth.error;
 *   // auth.session.userId / .role / .empresaIds disponíveis daqui pra baixo
 */
export function requireAuth(request: Request): AuthResult {
  const session = getSessionFromRequest(request);
  if (!session) {
    return { error: NextResponse.json({ error: 'Não autenticado. Faça login novamente.' }, { status: 401 }) };
  }
  return { session };
}
