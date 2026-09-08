import { describe, it, expect } from 'vitest';
import {
  generateTwoFactorSecret,
  buildOtpAuthUrl,
  verifyTotpCode,
  generateBackupCodes,
  hashBackupCodes,
  matchBackupCode,
} from './two-factor';
import { authenticator } from 'otplib';

describe('two-factor', () => {
  it('gera um segredo válido e aceita o código TOTP correspondente', () => {
    const secret = generateTwoFactorSecret();
    const code = authenticator.generate(secret);
    expect(verifyTotpCode(code, secret)).toBe(true);
  });

  it('rejeita um código incorreto', () => {
    const secret = generateTwoFactorSecret();
    expect(verifyTotpCode('000000', secret)).toBe(false);
  });

  it('constrói uma URL otpauth:// com o e-mail e o emissor', () => {
    const secret = generateTwoFactorSecret();
    const url = buildOtpAuthUrl('user@example.com', secret);
    expect(url).toContain('otpauth://totp/');
    expect(url).toContain(encodeURIComponent('user@example.com'));
  });

  it('gera 10 códigos de backup únicos no formato XXXXX-XXXXX', () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    codes.forEach(c => expect(c).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}$/));
  });

  it('encontra e verifica um código de backup entre os hashes salvos', () => {
    const codes = generateBackupCodes(3);
    const hashed = hashBackupCodes(codes);
    const idx = matchBackupCode(codes[1], hashed);
    expect(idx).toBe(1);
  });

  it('retorna -1 para um código de backup que não existe', () => {
    const codes = generateBackupCodes(3);
    const hashed = hashBackupCodes(codes);
    expect(matchBackupCode('ZZZZZ-ZZZZZ', hashed)).toBe(-1);
  });
});
