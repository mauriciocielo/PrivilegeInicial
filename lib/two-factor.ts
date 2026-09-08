// ============================================================
// 2FA (TOTP) — segredo por usuário + códigos de backup de uso único
// ============================================================
// Padrão compatível com Google Authenticator / Authy / 1Password etc.
// (RFC 6238). O segredo nunca é enviado de volta ao cliente depois de
// confirmado — só durante a etapa de configuração (setup → enable).

import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const ISSUER = 'Privilege Contabilidade';

export function generateTwoFactorSecret(): string {
  return authenticator.generateSecret();
}

export function buildOtpAuthUrl(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

export async function generateQrCodeDataUrl(otpAuthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpAuthUrl);
}

export function verifyTotpCode(code: string, secret: string): boolean {
  try {
    return authenticator.verify({ token: code.replace(/\s/g, ''), secret });
  } catch {
    return false;
  }
}

/** Gera 10 códigos de backup de uso único (formato XXXX-XXXX). */
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
  }
  return codes;
}

export function hashBackupCodes(codes: string[]): string[] {
  return codes.map(c => bcrypt.hashSync(c, 10));
}

/**
 * Verifica um código de backup contra a lista de hashes armazenados.
 * Retorna o índice do hash consumido (para removê-lo da lista) ou -1.
 */
export function matchBackupCode(code: string, hashedCodes: string[]): number {
  const clean = code.trim().toUpperCase();
  return hashedCodes.findIndex(hash => bcrypt.compareSync(clean, hash));
}
