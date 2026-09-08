// ============================================================
// HASH DE SENHA — usado tanto no cliente (login local) quanto no servidor
// ============================================================
// bcryptjs (implementação pura em JS) funciona igual em ambos os lados,
// então o mesmo helper serve para o `store.login()` no navegador e para as
// rotas de API (usuários, recuperação de senha).

import bcrypt from 'bcryptjs';

const BCRYPT_PREFIX = /^\$2[aby]\$/;

/** Identifica se a string já é um hash bcrypt (vs. senha antiga em texto puro). */
export function isHashed(password: string | null | undefined): boolean {
  return typeof password === 'string' && BCRYPT_PREFIX.test(password);
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

/**
 * Compara a senha informada com a armazenada. Contas antigas (criadas antes
 * do hashing) ainda têm a senha em texto puro — nesse caso compara direto,
 * permitindo que o chamador faça o upgrade lazy (re-hash) após o login OK.
 */
export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  if (isHashed(stored)) return bcrypt.compareSync(password, stored);
  return password === stored;
}
