// ============================================================
// AUTENTICAÇÃO DA API v1 — Bearer token contra a tabela ApiKey
// ============================================================
// Token no formato "{prefixo}.{secret}". O prefixo é público e serve só para
// localizar a linha em O(1) (SELECT ... WHERE prefixo = ?); a comparação real
// de posse é sempre contra o hash do secret, nunca contra o secret em si —
// o banco jamais guarda o valor que autentica.
//
// SHA-256 (não bcrypt) de propósito: o secret já nasce com ~256 bits de
// entropia (gerado por crypto.randomBytes), então não há o que um hash lento
// protegeria contra força bruta — bcrypt existe para senhas de baixa entropia
// escolhidas por humanos. Para um token aleatório, hash rápido e determinístico
// é a prática correta (é o que GitHub/Stripe fazem com tokens de API).

import crypto from 'crypto';
import { NextResponse } from 'next/server';
import db from './prisma';

export interface ApiKeyContexto {
  apiKeyId: string;
  empresaId: string;
  prefixo: string;
}

export type ApiAuthResult =
  | { contexto: ApiKeyContexto; error?: undefined }
  | { contexto?: undefined; error: NextResponse };

function hashSecret(tokenCompleto: string): string {
  return crypto.createHash('sha256').update(tokenCompleto).digest('hex');
}

/** Gera uma nova credencial. O `token` completo só existe nesta chamada — não é recuperável depois. */
export function gerarTokenApiKey(): { prefixo: string; token: string; chaveHash: string } {
  const prefixo = 'bpo_' + crypto.randomBytes(6).toString('hex');
  const secret = crypto.randomBytes(32).toString('hex');
  const token = `${prefixo}.${secret}`;
  return { prefixo, token, chaveHash: hashSecret(token) };
}

/**
 * Verifica o header `Authorization: Bearer <token>` contra a tabela ApiKey e
 * resolve o tenant (empresaId) da credencial — todo endpoint da API v1 chama
 * isto antes de tocar em qualquer dado.
 */
export async function requireApiKey(request: Request): Promise<ApiAuthResult> {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { error: NextResponse.json({ error: 'Cabeçalho Authorization: Bearer <token> ausente.' }, { status: 401 }) };
  }

  const token = match[1].trim();
  const prefixo = token.split('.')[0];
  if (!prefixo) {
    return { error: NextResponse.json({ error: 'Token em formato inválido.' }, { status: 401 }) };
  }

  const credencial = await db.apiKey.findFirst({ where: { prefixo } });
  if (!credencial || !credencial.ativo || credencial.revokedAt) {
    return { error: NextResponse.json({ error: 'Credencial inválida ou revogada.' }, { status: 401 }) };
  }

  const hashRecebido = hashSecret(token);
  // Comparação em tempo constante — evita vazar, por timing, quantos bytes
  // do hash já batem, o que ajudaria um atacante a adivinhar o token aos poucos.
  const a = Buffer.from(hashRecebido);
  const b = Buffer.from(credencial.chaveHash);
  const bate = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!bate) {
    return { error: NextResponse.json({ error: 'Credencial inválida ou revogada.' }, { status: 401 }) };
  }

  db.apiKey.update({ where: { id: credencial.id }, data: { ultimoUsoEm: new Date() } }).catch(() => {});

  return { contexto: { apiKeyId: credencial.id, empresaId: credencial.empresaId, prefixo: credencial.prefixo } };
}
