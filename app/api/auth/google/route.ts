import { NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import db from '../../../../lib/prisma';
import { hashPassword } from '../../../../lib/auth-hash';
import { checkRateLimit, getClientKey } from '../../../../lib/rate-limit';
import { captureError } from '../../../../lib/sentry-helper';
import { createSessionToken, createTwoFactorPendingToken, sessionCookieHeader } from '../../../../lib/session';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const client = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

const cleanCnpj = (val: string) => String(val || '').replace(/\D/g, '');

export async function POST(request: Request) {
  try {
    if (!client || !GOOGLE_CLIENT_ID) {
      return NextResponse.json(
        { error: 'Login com Google não está configurado no servidor (GOOGLE_CLIENT_ID ausente).' },
        { status: 501 }
      );
    }

    const rate = checkRateLimit(`auth-google:${getClientKey(request)}`, 15, 5 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: `Muitas tentativas. Tente novamente em ${Math.ceil(rate.retryAfterSeconds / 60)} minuto(s).` },
        { status: 429 }
      );
    }

    const { credential, cnpj } = await request.json();
    if (!credential) {
      return NextResponse.json({ error: 'Credencial do Google ausente.' }, { status: 400 });
    }

    // Verifica a assinatura do token direto com o Google — é o único jeito seguro de
    // confiar no e-mail. Decodificar o JWT sem validar (como era feito antes, só no
    // navegador) permite forjar login como qualquer usuário do sistema.
    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
      payload = ticket.getPayload();
    } catch {
      return NextResponse.json({ error: 'Token do Google inválido ou expirado.' }, { status: 401 });
    }

    if (!payload || !payload.email || !payload.email_verified) {
      return NextResponse.json({ error: 'Não foi possível verificar o e-mail da conta Google.' }, { status: 401 });
    }

    const email = payload.email.toLowerCase();
    const name = payload.name || email;
    const picture = payload.picture || null;

    let user = await db.user.findFirst({ where: { email } });

    const needsEmpresa = !user || user.empresaIds.length === 0;

    if (needsEmpresa) {
      if (!cnpj) {
        // Primeiro acesso (ou conta sem empresa vinculada) — pede o CNPJ antes de criar/vincular.
        return NextResponse.json({ requiresCnpj: true, email, name, picture });
      }

      const cnpjDigits = cleanCnpj(cnpj);
      const empresas = await db.empresa.findMany({ select: { id: true, cnpj: true } });
      const empresa = empresas.find(e => cleanCnpj(e.cnpj) === cnpjDigits);
      if (!empresa) {
        return NextResponse.json({ error: 'Nenhuma empresa encontrada com este CNPJ.' }, { status: 404 });
      }

      if (!user) {
        user = await db.user.create({
          data: {
            name,
            email,
            // Login desta conta é só via Google — senha aleatória com hash, nunca usada/exibida.
            password: hashPassword(crypto.randomUUID()),
            role: 'cliente',
            empresaIds: [empresa.id],
            avatarData: picture,
          }
        });
      } else {
        user = await db.user.update({
          where: { id: user.id },
          data: { empresaIds: Array.from(new Set([...user.empresaIds, empresa.id])) }
        });
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Não foi possível localizar ou criar o usuário.' }, { status: 500 });
    }

    const token = createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      empresaIds: user.empresaIds,
    });

    const { password: _password, twoFactorSecret: _tfs, twoFactorBackupCodes: _tfbc, ...userWithoutPassword } = user;

    if (user.twoFactorEnabled) {
      const twoFactorToken = createTwoFactorPendingToken(user.id);
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
    console.error('Erro na autenticação Google:', error);
    captureError(error);
    return NextResponse.json({ error: 'Falha ao processar o login com Google.' }, { status: 500 });
  }
}
