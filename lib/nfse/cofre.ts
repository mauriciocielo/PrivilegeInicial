// ============================================================
// NFS-e NACIONAL — cofre do certificado (AES-256-GCM)
// ============================================================
// O .pfx e a senha só existem no servidor, cifrados no banco, e nunca voltam ao
// navegador. A chave fica em NFSE_CERT_KEY (32 bytes em base64), separada do
// banco: quem tiver só um dump não consegue emitir nota em nome da empresa.
// O empresaId entra como dado autenticado, então um valor copiado para outra
// empresa não decifra.

import crypto from 'crypto';

export class CofreNaoConfiguradoError extends Error {}

function obterChave(): Buffer {
  const bruta = (process.env.NFSE_CERT_KEY || '').trim().replace(/^["']+|["']+$/g, '').trim();
  if (!bruta) {
    throw new CofreNaoConfiguradoError('NFSE_CERT_KEY não configurada no servidor (adicione nas variáveis de ambiente e faça um novo deploy).');
  }
  const chave = Buffer.from(bruta, 'base64');
  if (chave.length !== 32) {
    throw new CofreNaoConfiguradoError(`NFSE_CERT_KEY inválida no servidor (decodificou ${chave.length} bytes, mas precisa ter 32 bytes em base64).`);
  }
  return chave;
}

export function cifrar(conteudo: Buffer, empresaId: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', obterChave(), iv);
  cipher.setAAD(Buffer.from(empresaId, 'utf8'));
  const cifrado = Buffer.concat([cipher.update(conteudo), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), cifrado.toString('base64')].join('.');
}

export function decifrar(valor: string, empresaId: string): Buffer {
  const [versao, iv, tag, cifrado] = valor.split('.');
  if (versao !== 'v1' || !iv || !tag || !cifrado) throw new Error('Formato de certificado cifrado desconhecido.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', obterChave(), Buffer.from(iv, 'base64'));
  decipher.setAAD(Buffer.from(empresaId, 'utf8'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(cifrado, 'base64')), decipher.final()]);
}
