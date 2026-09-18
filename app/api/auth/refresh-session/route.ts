import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { createSessionToken, sessionCookieHeader, clearSessionCookieHeader } from '../../../../lib/session';
import { captureError } from '../../../../lib/sentry-helper';

// O cookie de sessão (JWT) carrega `role`/`empresaIds` congelados no momento
// do login, por até 7 dias. Se um administrador muda depois quais empresas um
// consultor atende, a sessão já aberta dele continuava presa à lista antiga —
// a API filtrava tudo por esse valor velho e o app parecia "não carregar nada"
// pras empresas novas, sem nenhum erro visível. Isso é chamado pelo cliente no
// início de cada sessão de aba e periodicamente durante o uso: se os dados do
// usuário no banco mudaram, emite um cookie novo (e devolve o registro
// atualizado) sem exigir logout/login.
export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const user = await db.user.findUnique({ where: { id: auth.session.userId } });
    if (!user) {
      const response = NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 401 });
      response.headers.set('Set-Cookie', clearSessionCookieHeader());
      return response;
    }

    const { password: _password, twoFactorSecret: _tfs, twoFactorBackupCodes: _tfbc, ...userSemSenha } = user;

    const empresaIdsMudou = JSON.stringify([...user.empresaIds].sort())
      !== JSON.stringify([...auth.session.empresaIds].sort());
    const roleMudou = user.role !== auth.session.role;
    const mudou = empresaIdsMudou || roleMudou;

    const response = NextResponse.json({ user: userSemSenha, changed: mudou });

    if (mudou) {
      const novoToken = createSessionToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        empresaIds: user.empresaIds,
      });
      response.headers.set('Set-Cookie', sessionCookieHeader(novoToken));
    }

    return response;
  } catch (error) {
    console.error('Erro ao atualizar sessão:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao atualizar sessão.' }, { status: 500 });
  }
}
