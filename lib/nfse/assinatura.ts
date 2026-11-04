// ============================================================
// NFS-e NACIONAL — certificado A1 e assinatura XMLDSIG
// ============================================================
// Perfil exigido pelo Sefin: assinatura enveloped sobre infDPS/infPedReg, com
// RSA-SHA1 e C14N inclusiva. `montarDps`/`montarCancelamento` já geram o XML em
// forma canônica, então aqui só falta declarar o namespace herdado no nó assinado.

import crypto from 'crypto';
import forge from 'node-forge';
import { NS_NFSE, apenasDigitos } from './dps';

const NS_DSIG = 'http://www.w3.org/2000/09/xmldsig#';
const ALG_C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';

export interface CredencialA1 {
  chavePem: string;
  /** Certificado do titular seguido da cadeia, para o mTLS. */
  certificadosPem: string;
  /** Certificado do titular em base64 (DER), para o KeyInfo. */
  certificadoB64: string;
  titular: string;
  /** CNPJ do titular, quando o certificado segue o padrão ICP-Brasil "NOME:CNPJ". */
  cnpj: string | null;
  /** CNPJ ou CPF do titular: o certificado do procurador pode ser e-CNPJ ou e-CPF. */
  documento: string | null;
  validoAte: Date;
}

export class CertificadoInvalidoError extends Error {}

function lerBags(p12: forge.pkcs12.Pkcs12Pfx, tipo: string): forge.pkcs12.Bag[] {
  return p12.getBags({ bagType: tipo })[tipo] || [];
}

export function lerCertificadoA1(pfx: Buffer, senha: string): CredencialA1 {
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    // strict=false: .pfx ICP-Brasil costuma vir em BER, não DER.
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfx.toString('binary')), false);
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha);
  } catch {
    throw new CertificadoInvalidoError('Não foi possível abrir o certificado: arquivo inválido ou senha incorreta.');
  }

  const bagChave = [...lerBags(p12, forge.pki.oids.pkcs8ShroudedKeyBag), ...lerBags(p12, forge.pki.oids.keyBag)]
    .find(b => b.key)?.key as forge.pki.rsa.PrivateKey | undefined;
  if (!bagChave) throw new CertificadoInvalidoError('O certificado não contém a chave privada.');

  const certificados = lerBags(p12, forge.pki.oids.certBag)
    .map(b => b.cert)
    .filter((c): c is forge.pki.Certificate => !!c);
  const titular = certificados.find(c => {
    const pub = c.publicKey as forge.pki.rsa.PublicKey;
    return pub.n && pub.n.equals(bagChave.n);
  });
  if (!titular) throw new CertificadoInvalidoError('O certificado do titular não foi encontrado no arquivo.');

  const nome = String(titular.subject.getField('CN')?.value || '');
  const documento = nome.match(/:(\d{14}|\d{11})\s*$/)?.[1] || null;
  const cnpj = documento?.length === 14 ? documento : null;
  const cadeia = [titular, ...certificados.filter(c => c !== titular)];

  return {
    chavePem: forge.pki.privateKeyToPem(bagChave),
    certificadosPem: cadeia.map(c => forge.pki.certificateToPem(c)).join(''),
    certificadoB64: forge.util.encode64(forge.asn1.toDer(forge.pki.certificateToAsn1(titular)).getBytes()),
    titular: nome,
    cnpj,
    documento,
    validoAte: titular.validity.notAfter,
  };
}

/** O certificado precisa ser da mesma empresa: compara a raiz do CNPJ, para aceitar o e-CNPJ da matriz nas filiais. */
export function certificadoPertenceAoCnpj(credencial: Pick<CredencialA1, 'cnpj'>, cnpjEmpresa: string): boolean {
  if (!credencial.cnpj) return true;
  return credencial.cnpj.slice(0, 8) === apenasDigitos(cnpjEmpresa).slice(0, 8);
}

/** Monta o elemento Signature (RSA-SHA1, C14N inclusiva) para um nó já em forma canônica. */
export function gerarAssinatura(canonico: string, id: string, credencial: CredencialA1): string {
  const digest = crypto.createHash('sha1').update(canonico, 'utf8').digest('base64');

  const corpoSignedInfo =
    `<CanonicalizationMethod Algorithm="${ALG_C14N}"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="${NS_DSIG}rsa-sha1"></SignatureMethod>` +
    `<Reference URI="#${id}"><Transforms>` +
    `<Transform Algorithm="${NS_DSIG}enveloped-signature"></Transform>` +
    `<Transform Algorithm="${ALG_C14N}"></Transform>` +
    `</Transforms><DigestMethod Algorithm="${NS_DSIG}sha1"></DigestMethod>` +
    `<DigestValue>${digest}</DigestValue></Reference>`;

  const valor = crypto.createSign('RSA-SHA1')
    .update(`<SignedInfo xmlns="${NS_DSIG}">${corpoSignedInfo}</SignedInfo>`, 'utf8')
    .sign(credencial.chavePem, 'base64');

  return `<Signature xmlns="${NS_DSIG}"><SignedInfo>${corpoSignedInfo}</SignedInfo>` +
    `<SignatureValue>${valor}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${credencial.certificadoB64}</X509Certificate></X509Data></KeyInfo></Signature>`;
}

/**
 * Assina o nó `noAssinado` (filho da raiz) e devolve o XML com prolog UTF-8 —
 * sem ele o Sefin rejeita com E1229. O XML não pode ser alterado depois disso (E0714).
 */
export function assinarXml(xml: string, noAssinado: 'infDPS' | 'infPedReg', id: string, credencial: CredencialA1): string {
  const abertura = `<${noAssinado} Id="${id}">`;
  const inicio = xml.indexOf(abertura);
  const fechamento = `</${noAssinado}>`;
  const fim = xml.indexOf(fechamento);
  if (inicio < 0 || fim < 0) throw new Error(`XML sem o nó ${noAssinado} com o Id informado.`);

  // Na C14N inclusiva o nó assinado carrega o namespace herdado da raiz.
  const canonico = `<${noAssinado} xmlns="${NS_NFSE}" Id="${id}">${xml.slice(inicio + abertura.length, fim)}${fechamento}`;
  const assinatura = gerarAssinatura(canonico, id, credencial);

  const posicaoFinal = fim + fechamento.length;
  return `<?xml version="1.0" encoding="UTF-8"?>${xml.slice(0, posicaoFinal)}${assinatura}${xml.slice(posicaoFinal)}`;
}
