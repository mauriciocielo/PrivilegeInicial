import { NextResponse } from 'next/server';
import db from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/api-auth';
import { verifyPassword } from '../../../../../lib/auth-hash';
import { captureError } from '../../../../../lib/sentry-helper';

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;

    const { password } = await request.json();
    if (!password) {
      return NextResponse.json({ error: 'Confirme sua senha para desativar a verificação em duas etapas.' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id: auth.session.userId } });
    if (!user || !verifyPassword(password, user.password)) {
      return NextResponse.json({ error: 'Senha incorreta.' }, { status: 401 });
    }

    await db.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao desativar 2FA:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao desativar a verificação em duas etapas.' }, { status: 500 });
  }
}
