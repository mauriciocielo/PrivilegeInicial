import { NextResponse } from 'next/server';
import db from '../../../../../lib/prisma';
import { createSessionToken, sessionCookieHeader, verifyTwoFactorPendingToken } from '../../../../../lib/session';
import { checkRateLimit, getClientKey } from '../../../../../lib/rate-limit';
import { verifyTotpCode, matchBackupCode } from '../../../../../lib/two-factor';
import { captureError } from '../../../../../lib/sentry-helper';

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(`2fa-verify:${getClientKey(request)}`, 10, 15 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: `Muitas tentativas. Tente novamente em ${Math.ceil(rate.retryAfterSeconds / 60)} minuto(s).` },
        { status: 429 }
      );
    }

    const { twoFactorToken, code } = await request.json();
    if (!twoFactorToken || !code) {
      return NextResponse.json({ error: 'Código de verificação obrigatório.' }, { status: 400 });
    }

    const userId = verifyTwoFactorPendingToken(twoFactorToken);
    if (!userId) {
      return NextResponse.json({ error: 'Sessão de verificação expirada. Faça login novamente.' }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json({ error: 'Verificação em duas etapas não está ativa para esta conta.' }, { status: 400 });
    }

    let usedBackupCode = false;
    if (verifyTotpCode(code, user.twoFactorSecret)) {
      // ok
    } else {
      const idx = matchBackupCode(code, user.twoFactorBackupCodes);
      if (idx === -1) {
        return NextResponse.json({ error: 'Código inválido ou expirado.' }, { status: 401 });
      }
      usedBackupCode = true;
      const remaining = [...user.twoFactorBackupCodes];
      remaining.splice(idx, 1);
      await db.user.update({ where: { id: user.id }, data: { twoFactorBackupCodes: remaining } });
    }

    const token = createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      empresaIds: user.empresaIds,
    });

    const { password: _password, twoFactorSecret: _tfs, twoFactorBackupCodes: _tfbc, ...userWithoutPassword } = user;
    const response = NextResponse.json({ success: true, user: userWithoutPassword, usedBackupCode });
    response.headers.set('Set-Cookie', sessionCookieHeader(token));
    return response;
  } catch (error) {
    console.error('Erro na verificação 2FA:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao verificar o código.' }, { status: 500 });
  }
}
