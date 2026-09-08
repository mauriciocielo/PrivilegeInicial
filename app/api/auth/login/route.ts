import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { verifyPassword, isHashed, hashPassword } from '../../../../lib/auth-hash';
import { createSessionToken, createTwoFactorPendingToken, sessionCookieHeader } from '../../../../lib/session';
import { checkRateLimit, getClientKey } from '../../../../lib/rate-limit';
import { captureError } from '../../../../lib/sentry-helper';

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(`login:${getClientKey(request)}`, 10, 15 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: `Muitas tentativas. Tente novamente em ${Math.ceil(rate.retryAfterSeconds / 60)} minuto(s).` },
        { status: 429 }
      );
    }

    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios.' }, { status: 400 });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await db.user.findFirst({ where: { email: cleanEmail } });

    // Mensagem genérica de propósito — não revela se o e-mail existe ou não.
    if (!user || !verifyPassword(password, user.password)) {
      return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
    }

    // Upgrade lazy: conta antiga com senha em texto puro vira hash no primeiro login OK.
    let finalUser = user;
    if (!isHashed(user.password)) {
      finalUser = await db.user.update({ where: { id: user.id }, data: { password: hashPassword(password) } });
    }

    const token = createSessionToken({
      userId: finalUser.id,
      email: finalUser.email,
      role: finalUser.role,
      empresaIds: finalUser.empresaIds,
    });

    const { password: _password, twoFactorSecret: _tfs, twoFactorBackupCodes: _tfbc, ...userWithoutPassword } = finalUser;

    if (finalUser.twoFactorEnabled) {
      // 2FA tornou-se opcional: entregamos o cookie de sessão normalmente,
      // mas sinalizamos a UI para exibir a tela de 2FA onde o usuário pode optar por pular.
      const twoFactorToken = createTwoFactorPendingToken(finalUser.id);
      const response = NextResponse.json({ 
        requiresTwoFactor: true, 
        twoFactorToken,
        user: userWithoutPassword
      });
      response.headers.set('Set-Cookie', sessionCookieHeader(token));
      return response;
    }

    const response = NextResponse.json({ success: true, user: userWithoutPassword });
    response.headers.set('Set-Cookie', sessionCookieHeader(token));
    return response;
  } catch (error) {
    console.error('Erro no login:', error);
    captureError(error);
    // Erro de configuração do servidor é a causa mais comum aqui (ex: deploy sem
    // SESSION_SECRET). Sem distinguir, tudo virava um 500 genérico impossível de
    // diagnosticar pela tela de login.
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('SESSION_SECRET')) {
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta: SESSION_SECRET não definida. Avise o administrador.' },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: 'Erro ao processar login.' }, { status: 500 });
  }
}
