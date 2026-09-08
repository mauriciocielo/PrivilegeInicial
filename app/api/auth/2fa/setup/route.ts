import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/api-auth';
import { generateTwoFactorSecret, buildOtpAuthUrl, generateQrCodeDataUrl } from '../../../../../lib/two-factor';
import { captureError } from '../../../../../lib/sentry-helper';

/**
 * Gera um novo segredo TOTP (ainda não persistido) + QR code para o app
 * autenticador escanear. O segredo só é salvo no banco em /2fa/enable,
 * depois que o usuário provar que configurou o app corretamente.
 */
export async function POST(request: Request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;

    const secret = generateTwoFactorSecret();
    const otpAuthUrl = buildOtpAuthUrl(auth.session.email, secret);
    const qrCodeDataUrl = await generateQrCodeDataUrl(otpAuthUrl);

    return NextResponse.json({ secret, qrCodeDataUrl });
  } catch (error) {
    console.error('Erro ao iniciar configuração 2FA:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao gerar configuração de 2FA.' }, { status: 500 });
  }
}
