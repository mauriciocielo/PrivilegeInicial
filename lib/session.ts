// ============================================================
// SESSÃO — cookie httpOnly assinado (JWT), verificado no servidor
// ============================================================
// Antes disso, "estar logado" era só um objeto no localStorage do navegador —
// as rotas de API não tinham como saber quem (ou se alguém) estava chamando.
// Agora o login (e-mail/senha ou Google) emite este cookie, e as rotas
// protegidas exigem ele via requireAuth() (ver lib/api-auth.ts).

import jwt from 'jsonwebtoken';

const SESSION_SECRET = process.env.SESSION_SECRET || '';
export const SESSION_COOKIE_NAME = 'cf_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 dias

export interface SessionPayload {
  userId: string;
  email: string;
  role: string;
  empresaIds: string[];
}

export function createSessionToken(payload: SessionPayload): string {
  if (!SESSION_SECRET) throw new Error('SESSION_SECRET não configurado no servidor.');
  return jwt.sign(payload, SESSION_SECRET, { expiresIn: SESSION_MAX_AGE_SECONDS });
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!SESSION_SECRET || !token) return null;
  try {
    return jwt.verify(token, SESSION_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Lê e valida a sessão a partir dos headers de uma Request (rotas de API). */
export function getSessionFromRequest(request: Request): SessionPayload | null {
  const token = readCookie(request.headers.get('cookie'), SESSION_COOKIE_NAME);
  if (!token) return null;
  return verifySessionToken(token);
}

export function sessionCookieHeader(token: string): string {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

// ------------------------------------------------------------
// Token de desafio 2FA — curta duração, emitido após senha/Google OK mas
// antes do código TOTP ser confirmado. Não serve como sessão (sem
// `purpose: '2fa-pending'` o requireAuth() nunca aceita este token).
// ------------------------------------------------------------
const TWO_FACTOR_PENDING_MAX_AGE_SECONDS = 5 * 60; // 5 minutos

export interface TwoFactorPendingPayload {
  userId: string;
  purpose: '2fa-pending';
}

export function createTwoFactorPendingToken(userId: string): string {
  if (!SESSION_SECRET) throw new Error('SESSION_SECRET não configurado no servidor.');
  const payload: TwoFactorPendingPayload = { userId, purpose: '2fa-pending' };
  return jwt.sign(payload, SESSION_SECRET, { expiresIn: TWO_FACTOR_PENDING_MAX_AGE_SECONDS });
}

export function verifyTwoFactorPendingToken(token: string): string | null {
  if (!SESSION_SECRET || !token) return null;
  try {
    const decoded = jwt.verify(token, SESSION_SECRET) as TwoFactorPendingPayload;
    if (decoded.purpose !== '2fa-pending') return null;
    return decoded.userId;
  } catch {
    return null;
  }
}

export function clearSessionCookieHeader(): string {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    'SameSite=Lax',
  ];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}
