import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';

export const dynamic = 'force-dynamic';

let tabelaGarantida = false;

async function ensureTable() {
  if (tabelaGarantida) return;
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS google_calendar_tokens (
      user_id TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at BIGINT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  tabelaGarantida = true;
}

function getGoogleOAuthCreds() {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  return { clientId, clientSecret, supported: Boolean(clientId && clientSecret) };
}

/**
 * GET /api/google-calendar/token
 * Devolve um access_token válido para o usuário logado, renovando automaticamente
 * via refresh_token no servidor sempre que estiver perto de expirar (< 5 min).
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { clientId, clientSecret, supported } = getGoogleOAuthCreds();
    await ensureTable();

    const rows = await db.$queryRawUnsafe<
      Array<{ access_token: string; refresh_token: string | null; expires_at: string | number }>
    >(
      `SELECT access_token, refresh_token, expires_at FROM google_calendar_tokens WHERE user_id = $1 LIMIT 1`,
      auth.session.userId
    );

    const row = rows[0];
    if (!row) {
      return NextResponse.json({
        permanentSupported: supported,
        connected: false,
        accessToken: null,
      });
    }

    const now = Date.now();
    const expiresAt = Number(row.expires_at || 0);

    // Token ainda válido com folga de 5 minutos
    if (row.access_token && expiresAt > now + 5 * 60 * 1000) {
      return NextResponse.json({
        permanentSupported: supported,
        connected: true,
        hasRefreshToken: Boolean(row.refresh_token),
        accessToken: row.access_token,
        expiresAt,
      });
    }

    // Token expirado ou expirando: renova automaticamente com refresh_token
    if (row.refresh_token && supported) {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: row.refresh_token,
          grant_type: 'refresh_token',
        }),
      });
      const tokenJson = await tokenRes.json().catch(() => ({}));

      if (tokenRes.ok && tokenJson.access_token) {
        const novoExpiresAt = Date.now() + Number(tokenJson.expires_in || 3600) * 1000;
        await db.$executeRawUnsafe(
          `UPDATE google_calendar_tokens
              SET access_token = $2, expires_at = $3, updated_at = NOW()
            WHERE user_id = $1`,
          auth.session.userId,
          tokenJson.access_token,
          novoExpiresAt
        );
        return NextResponse.json({
          permanentSupported: supported,
          connected: true,
          hasRefreshToken: true,
          accessToken: tokenJson.access_token,
          expiresAt: novoExpiresAt,
          refreshed: true,
        });
      }

      // Se o Google revogou o refresh_token (invalid_grant), limpa do banco
      if (tokenJson?.error === 'invalid_grant') {
        await db.$executeRawUnsafe(`DELETE FROM google_calendar_tokens WHERE user_id = $1`, auth.session.userId);
      }
    }

    return NextResponse.json({
      permanentSupported: supported,
      connected: false,
      hasRefreshToken: Boolean(row?.refresh_token),
      accessToken: null,
      reason: !supported ? 'missing_secret' : !row?.refresh_token ? 'no_refresh_token' : 'refresh_failed',
    });
  } catch (error) {
    console.error('Erro em GET /api/google-calendar/token:', error);
    return NextResponse.json({ permanentSupported: false, connected: false, accessToken: null });
  }
}

/**
 * POST /api/google-calendar/token
 * Troca o `code` do Google OAuth (flow: 'auth-code') por access_token + refresh_token permanente.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { clientId, clientSecret, supported } = getGoogleOAuthCreds();
    if (!supported) {
      return NextResponse.json(
        { error: 'GOOGLE_CLIENT_SECRET não configurado no servidor.' },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    if (!code) {
      return NextResponse.json({ error: 'Código OAuth ausente.' }, { status: 400 });
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: 'postmessage',
        grant_type: 'authorization_code',
      }),
    });

    const tokenJson = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson.access_token) {
      return NextResponse.json(
        { error: tokenJson?.error_description || tokenJson?.error || 'Falha ao trocar código OAuth do Google.' },
        { status: 400 }
      );
    }

    await ensureTable();
    const expiresAt = Date.now() + Number(tokenJson.expires_in || 3600) * 1000;

    await db.$executeRawUnsafe(
      `INSERT INTO google_calendar_tokens (user_id, access_token, refresh_token, expires_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = COALESCE(EXCLUDED.refresh_token, google_calendar_tokens.refresh_token),
         expires_at = EXCLUDED.expires_at,
         updated_at = NOW()`,
      auth.session.userId,
      tokenJson.access_token,
      tokenJson.refresh_token || null,
      expiresAt
    );

    return NextResponse.json({
      ok: true,
      accessToken: tokenJson.access_token,
      expiresAt,
      hasRefreshToken: Boolean(tokenJson.refresh_token),
    });
  } catch (error) {
    console.error('Erro em POST /api/google-calendar/token:', error);
    return NextResponse.json({ error: 'Erro interno ao salvar conexão Google Calendar.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    await ensureTable();

    // Revoga o token no Google para que a próxima conexão force consentimento e devolva um refresh_token novo
    const rows = await db.$queryRawUnsafe<Array<{ access_token: string; refresh_token: string | null }>>(
      `SELECT access_token, refresh_token FROM google_calendar_tokens WHERE user_id = $1 LIMIT 1`,
      auth.session.userId
    );
    const tokenParaRevogar = rows[0]?.refresh_token || rows[0]?.access_token;
    if (tokenParaRevogar) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenParaRevogar)}`, {
        method: 'POST',
      }).catch(() => {});
    }

    await db.$executeRawUnsafe(`DELETE FROM google_calendar_tokens WHERE user_id = $1`, auth.session.userId);
    return NextResponse.json({ ok: true, revoked: Boolean(tokenParaRevogar) });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
