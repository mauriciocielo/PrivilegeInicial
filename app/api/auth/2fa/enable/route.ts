import { NextResponse } from 'next/server';
import db from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/api-auth';
import { verifyTotpCode, generateBackupCodes, hashBackupCodes } from '../../../../../lib/two-factor';
import { checkRateLimit, getClientKey } from '../../../../../lib/rate-limit';
import { captureError } from '../../../../../lib/sentry-helper';

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;

    const rate = checkRateLimit(`2fa-enable:${getClientKey(request)}`, 10, 15 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: `Muitas tentativas. Tente novamente em ${Math.ceil(rate.retryAfterSeconds / 60)} minuto(s).` },
        { status: 429 }
      );
    }

    const { secret, code } = await request.json();
    if (!secret || !code) {
      return NextResponse.json({ error: 'Segredo e código de confirmação são obrigatórios.' }, { status: 400 });
    }

    if (!verifyTotpCode(code, secret)) {
      return NextResponse.json({ error: 'Código incorreto. Confira o horário do seu celular e tente novamente.' }, { status: 400 });
    }

    const backupCodes = generateBackupCodes();
    await db.user.update({
      where: { id: auth.session.userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        twoFactorBackupCodes: hashBackupCodes(backupCodes),
      },
    });

    // Os códigos de backup em texto puro só existem nesta resposta — nunca são
    // recuperáveis depois (só os hashes ficam salvos).
    return NextResponse.json({ success: true, backupCodes });
  } catch (error) {
    console.error('Erro ao ativar 2FA:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao ativar a verificação em duas etapas.' }, { status: 500 });
  }
}
