import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, isHashed } from './auth-hash';

describe('auth-hash', () => {
  describe('hashPassword / isHashed', () => {
    it('gera um hash bcrypt reconhecível', () => {
      const hash = hashPassword('minhaSenha123');
      expect(isHashed(hash)).toBe(true);
      expect(hash).not.toBe('minhaSenha123');
    });

    it('gera hashes diferentes para a mesma senha (salt aleatório)', () => {
      const h1 = hashPassword('mesmaSenha');
      const h2 = hashPassword('mesmaSenha');
      expect(h1).not.toBe(h2);
    });

    it('não reconhece texto puro como hash', () => {
      expect(isHashed('123456')).toBe(false);
      expect(isHashed('')).toBe(false);
      expect(isHashed(undefined)).toBe(false);
      expect(isHashed(null)).toBe(false);
    });
  });

  describe('verifyPassword', () => {
    it('aceita a senha correta contra um hash', () => {
      const hash = hashPassword('correta123');
      expect(verifyPassword('correta123', hash)).toBe(true);
    });

    it('rejeita senha errada contra um hash', () => {
      const hash = hashPassword('correta123');
      expect(verifyPassword('errada456', hash)).toBe(false);
    });

    it('faz fallback para comparação em texto puro em contas legadas (pré-hash)', () => {
      // Contas criadas antes do hashing existir ainda têm senha em texto puro
      // no banco — login precisa continuar funcionando pra elas até o
      // upgrade lazy (ver lib/store.ts login/upgrade).
      expect(verifyPassword('senhaAntiga', 'senhaAntiga')).toBe(true);
      expect(verifyPassword('senhaErrada', 'senhaAntiga')).toBe(false);
    });

    it('rejeita quando não há senha armazenada', () => {
      expect(verifyPassword('qualquer', null)).toBe(false);
      expect(verifyPassword('qualquer', undefined)).toBe(false);
      expect(verifyPassword('qualquer', '')).toBe(false);
    });
  });
});
