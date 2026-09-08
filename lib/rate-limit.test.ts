import { describe, it, expect } from 'vitest';
import { checkRateLimit, getClientKey } from './rate-limit';

describe('rate-limit', () => {
  it('permite requisições até o limite', () => {
    const key = `teste-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
    }
  });

  it('bloqueia a partir da requisição que excede o limite', () => {
    const key = `teste-${Math.random()}`;
    checkRateLimit(key, 2, 60_000);
    checkRateLimit(key, 2, 60_000);
    const result = checkRateLimit(key, 2, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('mantém contadores de chaves diferentes isolados entre si', () => {
    const keyA = `isolamento-a-${Math.random()}`;
    const keyB = `isolamento-b-${Math.random()}`;
    checkRateLimit(keyA, 1, 60_000);
    expect(checkRateLimit(keyA, 1, 60_000).allowed).toBe(false);
    expect(checkRateLimit(keyB, 1, 60_000).allowed).toBe(true);
  });

  it('libera de novo depois que a janela expira', async () => {
    const key = `janela-${Math.random()}`;
    expect(checkRateLimit(key, 1, 50).allowed).toBe(true);
    expect(checkRateLimit(key, 1, 50).allowed).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 70));
    expect(checkRateLimit(key, 1, 50).allowed).toBe(true);
  });

  describe('getClientKey', () => {
    it('usa o primeiro IP de x-forwarded-for', () => {
      const req = new Request('http://localhost', { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } });
      expect(getClientKey(req)).toBe('1.2.3.4');
    });

    it('cai para x-real-ip quando não há x-forwarded-for', () => {
      const req = new Request('http://localhost', { headers: { 'x-real-ip': '9.9.9.9' } });
      expect(getClientKey(req)).toBe('9.9.9.9');
    });

    it('retorna "unknown" sem nenhum header de IP', () => {
      const req = new Request('http://localhost');
      expect(getClientKey(req)).toBe('unknown');
    });
  });
});
